import { inspectAssetIntents } from '../lib/asset-service.js';
import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { createContentfulContext } from '../lib/contentful-client.js';
import { pullDiscoverySnapshot } from '../lib/contentful-discovery.js';
import { inspectEntryIntents } from '../lib/entry-service.js';
import { applyImportFlagOverrides, summarizeImportOptions } from '../lib/import-options.js';
import { Logger } from '../lib/logger.js';
import { buildArtifacts, summarizeIssuesMarkdown } from '../lib/pipeline.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { createInitialRunState, finalizeRunState, persistRunState } from '../lib/state-store.js';
import type { AssetIntent, MappedDocumentPlan, OperationIntent, ValidationIssue } from '../lib/types.js';
import { validateEnvironmentSafety } from '../lib/validator.js';

const EXISTENCE_CHECK_BATCH_SIZE = 75;

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const verbose = Boolean(flags.verbose);
  const logger = new Logger(verbose, 'dry-run');
  const baseConfig = await loadProjectConfig();
  const config = applyImportFlagOverrides(baseConfig, flags);
  const context = await createContentfulContext(config.env);
  const source = String(flags.source ?? config.paths.sourceDocsDir);
  const importOptions = summarizeImportOptions(config.conventions);
  logger.info('Preparing dry-run', { source, environmentId: context.environmentId, importOptions });
  const discovery = await pullDiscoverySnapshot(context);
  const artifacts = await buildArtifacts(source, config, discovery);
  const totals = countPlannedOperations(artifacts.mappedPlans);
  logger.info('Dry-run plan built', {
    documents: artifacts.mappedPlans.length,
    entries: totals.entries,
    assets: totals.assets,
    validationIssues: artifacts.issues.length
  });

  const issues = [
    ...validateEnvironmentSafety(context.environmentId, config.conventions, Boolean(flags['allow-non-sandbox'])),
    ...artifacts.issues
  ];

  let plannedDocuments = 0;
  for (const plan of artifacts.mappedPlans) {
    plannedDocuments += 1;
    logger.info('Dry-run prepared document', {
      document: plannedDocuments,
      documents: artifacts.mappedPlans.length,
      sourceId: plan.sourceId,
      entries: plan.childEntries.length + 1,
      assets: plan.assets.length
    });
  }

  const plannedAssets = uniqueAssetsById(artifacts.mappedPlans.flatMap((plan) => plan.assets));
  const plannedEntries = artifacts.mappedPlans.flatMap((plan) => [
    ...plan.childEntries,
    plan.parentEntry
  ]);
  logger.info('Dry-run checking existing assets in batches', {
    assets: plannedAssets.length,
    batches: Math.ceil(plannedAssets.length / EXISTENCE_CHECK_BATCH_SIZE),
    batchSize: EXISTENCE_CHECK_BATCH_SIZE
  });
  const assetIntents: AssetIntent[] = [];
  let checkedAssets = 0;
  for (const batch of chunk(plannedAssets, EXISTENCE_CHECK_BATCH_SIZE)) {
    assetIntents.push(...await inspectAssetIntents(context, batch, EXISTENCE_CHECK_BATCH_SIZE));
    checkedAssets += batch.length;
    logProgress(logger, verbose, 'Dry-run checked asset batch', checkedAssets, plannedAssets.length, {
      batchItems: batch.length
    });
  }

  logger.info('Dry-run checking existing entries in batches', {
    entries: plannedEntries.length,
    batches: Math.ceil(plannedEntries.length / EXISTENCE_CHECK_BATCH_SIZE),
    batchSize: EXISTENCE_CHECK_BATCH_SIZE
  });
  const entryIntents: OperationIntent[] = [];
  let checkedEntries = 0;
  for (const batch of chunk(plannedEntries, EXISTENCE_CHECK_BATCH_SIZE)) {
    entryIntents.push(...await inspectEntryIntents(context, batch, EXISTENCE_CHECK_BATCH_SIZE));
    checkedEntries += batch.length;
    logProgress(logger, verbose, 'Dry-run checked entry batch', checkedEntries, plannedEntries.length, {
      batchItems: batch.length
    });
  }

  if (verbose) {
    for (const asset of plannedAssets) {
      logger.debug('Dry-run planned asset', {
        assetId: asset.assetId
      });
    }
    for (const entry of plannedEntries) {
      logger.debug('Dry-run planned entry', {
        entryId: entry.entryId,
        contentType: entry.contentType
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environmentId: context.environmentId,
    documentCount: artifacts.mappedPlans.length,
    options: importOptions,
    operations: {
      entries: entryIntents,
      assets: assetIntents
    },
    validation: issues
  };

  await writeJsonArtifact(config.paths.buildReportsDir, 'dry-run-report.json', report);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'dry-run-report.md',
    `${summarizeIssuesMarkdown(issues)}${summarizeImportOptionsMarkdown(importOptions)}${summarizeOperationsMarkdown(
      entryIntents,
      assetIntents,
      issues
    )}`
  );

  const state = createInitialRunState('dry-run', context.environmentId);
  for (const plan of artifacts.mappedPlans) {
    state.documents[plan.sourceId] = {
      sourceId: plan.sourceId,
      sourcePath: plan.sourcePath,
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      entryIds: [...plan.childEntries.map((entry) => entry.entryId), plan.parentEntry.entryId],
      assetIds: plan.assets.map((asset) => asset.assetId)
    };
    state.summary.completed += 1;
  }
  finalizeRunState(state);
  await persistRunState(config.paths.buildStateDir, state);

  logger.info('Dry-run finished', {
    entries: entryIntents.length,
    assets: assetIntents.length
  });

  if (issues.some((issue) => issue.severity === 'error')) {
    process.exitCode = 1;
  }
}

function summarizeImportOptionsMarkdown(options: ReturnType<typeof summarizeImportOptions>): string {
  const lines = ['## Import Options', ''];
  lines.push(`- Default parent entry: ${options.defaultParentEntryId ?? 'not set'}`);
  lines.push(
    `- Placeholder asset: ${options.placeholderAsset?.enabled
      ? `${options.placeholderAsset.assetId} (${options.placeholderAsset.mode ?? 'all'})`
      : 'not enabled'}`
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function summarizeOperationsMarkdown(
  entryIntents: OperationIntent[],
  assetIntents: AssetIntent[],
  issues: ValidationIssue[]
): string {
  const entriesCreated = entryIntents.filter((intent) => intent.action === 'create').length;
  const entriesUpdated = entryIntents.filter((intent) => intent.action === 'update').length;
  const assetsUploaded = assetIntents.filter((intent) => intent.action === 'create').length;
  const assetsReused = assetIntents.filter((intent) => intent.action === 'update').length;
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  return [
    '## Dry Run Summary',
    '',
    '| Metric | Count |',
    '| --- | ---: |',
    `| Entities created | ${entriesCreated} |`,
    `| Entities updated | ${entriesUpdated} |`,
    `| Assets uploaded | ${assetsUploaded} |`,
    `| Assets reused | ${assetsReused} |`,
    `| Errors | ${errors} |`,
    `| Warnings | ${warnings} |`,
    ''
  ].join('\n');
}

function countPlannedOperations(plans: MappedDocumentPlan[]): { entries: number; assets: number } {
  const assetIds = new Set(plans.flatMap((plan) => plan.assets.map((asset) => asset.assetId)));
  return plans.reduce(
    (totals, plan) => ({
      entries: totals.entries + plan.childEntries.length + 1,
      assets: assetIds.size
    }),
    { entries: 0, assets: 0 }
  );
}

function uniqueAssetsById<T extends { assetId: string }>(assets: T[]): T[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.assetId)) {
      return false;
    }
    seen.add(asset.assetId);
    return true;
  });
}

function logProgress(
  logger: Logger,
  verbose: boolean,
  message: string,
  current: number,
  total: number,
  context: Record<string, unknown>
): void {
  if (total === 0) {
    return;
  }

  const shouldLog = verbose || current === 1 || current === total || current % 50 === 0;
  if (!shouldLog) {
    return;
  }

  logger.info(message, {
    current,
    total,
    percent: Math.round((current / total) * 100),
    ...context
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
