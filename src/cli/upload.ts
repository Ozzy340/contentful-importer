import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { inspectAssetIntents, upsertAsset } from '../lib/asset-service.js';
import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { assertSafeEnvironment, createContentfulContext } from '../lib/contentful-client.js';
import { pullDiscoverySnapshot } from '../lib/contentful-discovery.js';
import { ensureTags, inspectEntryIntents, upsertEntry } from '../lib/entry-service.js';
import { applyImportFlagOverrides, summarizeImportOptions } from '../lib/import-options.js';
import { Logger } from '../lib/logger.js';
import { buildArtifacts, ensureNoErrors, summarizeIssuesMarkdown } from '../lib/pipeline.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  completeDocument,
  createInitialRunState,
  failDocument,
  finalizeRunState,
  findLatestRunState,
  persistRunState,
  startDocument
} from '../lib/state-store.js';
import type {
  AssetIntent,
  CliFlags,
  MappedDocumentPlan,
  OperationIntent,
  PlannedEntry,
  RunState,
  RunSummary
} from '../lib/types.js';

const EXISTENCE_CHECK_BATCH_SIZE = 75;
const DEFAULT_UPLOAD_CONCURRENCY = 6;

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const verbose = Boolean(flags.verbose);
  const logger = new Logger(verbose, 'upload');
  const baseConfig = await loadProjectConfig();
  const config = applyImportFlagOverrides(baseConfig, flags);
  const context = await createContentfulContext(config.env);
  const source = String(flags.source ?? config.paths.sourceDocsDir);
  const allowNonSandbox = Boolean(flags['allow-non-sandbox']);
  const uploadConcurrency = parsePositiveInteger(flags.concurrency, DEFAULT_UPLOAD_CONCURRENCY);
  const limit = createLimiter(uploadConcurrency);
  const importOptions = summarizeImportOptions(config.conventions);

  logger.info('Preparing upload', {
    source,
    environmentId: context.environmentId,
    concurrency: uploadConcurrency,
    importOptions
  });
  assertSafeEnvironment(context.environmentId, config.conventions, allowNonSandbox);
  const discovery = await pullDiscoverySnapshot(context);
  const artifacts = await buildArtifacts(source, config, discovery);
  let mappedPlans = artifacts.mappedPlans;
  const failedSourceIds = await resolveFailedSourceIds(flags, config.paths.buildStateDir);
  if (failedSourceIds) {
    mappedPlans = mappedPlans.filter((plan) => failedSourceIds.has(plan.sourceId));
    logger.info('Filtered upload to failed documents', {
      failedDocuments: failedSourceIds.size,
      matchedDocuments: mappedPlans.length
    });

    if (mappedPlans.length === 0) {
      throw new Error('No generated documents matched the failed source IDs from the selected upload state.');
    }
  }

  const validationIssues = failedSourceIds
    ? artifacts.issues.filter((issue) => !issue.documentId || failedSourceIds.has(issue.documentId))
    : artifacts.issues;
  const totals = countPlannedOperations(mappedPlans);
  logger.info('Upload plan built', {
    documents: mappedPlans.length,
    entries: totals.entries,
    assets: totals.assets,
    validationIssues: validationIssues.length
  });

  await writeJsonArtifact(config.paths.buildReportsDir, 'upload-validation-report.json', {
    generatedAt: new Date().toISOString(),
    options: importOptions,
    issues: validationIssues
  });
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'upload-validation-report.md',
    `${summarizeIssuesMarkdown(validationIssues)}${summarizeImportOptionsMarkdown(importOptions)}`
  );
  ensureNoErrors(validationIssues);

  const state = createInitialRunState('upload', context.environmentId);
  const allTags = [...new Set(mappedPlans.flatMap((plan) => plan.parentEntry.metadata.tags.map((tag) => tag.sys.id)))];
  logger.info('Checking tags', { tags: allTags.length });
  const tagResult = await ensureTags(context, allTags, {
    dryRun: false,
    createIfMissing: config.conventions.tags.createIfMissing
  });
  logger.info('Tag check finished', {
    existing: tagResult.existing.length,
    created: tagResult.created.length,
    missing: tagResult.missing.length
  });

  if (tagResult.missing.length > 0) {
    throw new Error(
      `Missing required existing tags: ${tagResult.missing.join(', ')}. Create them in Contentful before rerunning upload.`
    );
  }

  const allAssets = uniqueAssetsById(mappedPlans.flatMap((plan) => plan.assets));
  const allEntries = mappedPlans.flatMap((plan) => [
    ...plan.childEntries,
    plan.parentEntry
  ]);
  logger.info('Checking existing assets in batches', {
    assets: allAssets.length,
    batches: Math.ceil(allAssets.length / EXISTENCE_CHECK_BATCH_SIZE),
    batchSize: EXISTENCE_CHECK_BATCH_SIZE
  });
  const assetIntentById = new Map<string, AssetIntent>();
  for (const batch of chunk(allAssets, EXISTENCE_CHECK_BATCH_SIZE)) {
    for (const intent of await inspectAssetIntents(context, batch, EXISTENCE_CHECK_BATCH_SIZE)) {
      assetIntentById.set(intent.assetId, intent);
    }
  }

  logger.info('Checking existing entries in batches', {
    entries: allEntries.length,
    batches: Math.ceil(allEntries.length / EXISTENCE_CHECK_BATCH_SIZE),
    batchSize: EXISTENCE_CHECK_BATCH_SIZE
  });
  const entryIntentById = new Map<string, OperationIntent>();
  for (const batch of chunk(allEntries, EXISTENCE_CHECK_BATCH_SIZE)) {
    for (const intent of await inspectEntryIntents(context, batch, EXISTENCE_CHECK_BATCH_SIZE)) {
      entryIntentById.set(intent.entryId, intent);
    }
  }

  let processedDocuments = 0;
  let processedAssets = 0;
  let processedEntries = 0;
  const uploadedAssetIds = new Set<string>();
  for (const [planIndex, plan] of mappedPlans.entries()) {
    processedDocuments += 1;
    startDocument(state, plan.sourceId, plan.sourcePath);
    await persistRunState(config.paths.buildStateDir, state);
    logger.info('Uploading document', {
      document: planIndex + 1,
      documents: mappedPlans.length,
      sourceId: plan.sourceId,
      entries: plan.childEntries.length + 1,
      assets: plan.assets.length
    });

    try {
      const assetsToUpload = uniqueAssetsById(plan.assets).filter((asset) => !uploadedAssetIds.has(asset.assetId));
      await Promise.all(assetsToUpload.map((asset) => limit(async () => {
        const knownAction = assetIntentById.get(asset.assetId)?.action;
        const result = await upsertAsset(context, asset, false, knownAction);
        uploadedAssetIds.add(asset.assetId);
        const current = incrementCounter(() => {
          processedAssets += 1;
          return processedAssets;
        });
        incrementSummary(state.summary, result.action === 'create' ? 'createdAssets' : 'updatedAssets');
        logProgress(logger, verbose, 'Uploaded assets', current, totals.assets, {
          sourceId: plan.sourceId,
          assetId: asset.assetId,
          action: result.action
        });
      })));

      await uploadEntriesInDependencyOrder(
        plan.childEntries,
        async (entry) => {
          const knownAction = entryIntentById.get(entry.entryId)?.action;
          const result = await upsertEntry(context, entry, false, knownAction);
          const current = incrementCounter(() => {
            processedEntries += 1;
            return processedEntries;
          });
          incrementSummary(state.summary, result.action === 'create' ? 'createdEntries' : 'updatedEntries');
          logProgress(logger, verbose, 'Uploaded child entries', current, totals.entries, {
            sourceId: plan.sourceId,
            entryId: entry.entryId,
            contentType: entry.contentType,
            action: result.action
          });
        },
        limit
      );

      const parentKnownAction = entryIntentById.get(plan.parentEntry.entryId)?.action;
      const parentResult = await limit(() => upsertEntry(context, plan.parentEntry, false, parentKnownAction));
      const current = incrementCounter(() => {
        processedEntries += 1;
        return processedEntries;
      });
      incrementSummary(state.summary, parentResult.action === 'create' ? 'createdEntries' : 'updatedEntries');
      logProgress(logger, verbose, 'Uploaded entries', current, totals.entries, {
        sourceId: plan.sourceId,
        entryId: plan.parentEntry.entryId,
        contentType: plan.parentEntry.contentType,
        action: parentResult.action
      });
      completeDocument(
        state,
        plan.sourceId,
        [...plan.childEntries.map((entry) => entry.entryId), plan.parentEntry.entryId],
        plan.assets.map((asset) => asset.assetId)
      );
      logger.info('Upload document completed', {
        document: planIndex + 1,
        documents: mappedPlans.length,
        sourceId: plan.sourceId,
        processedEntries,
        processedAssets
      });
    } catch (error) {
      failDocument(
        state,
        plan.sourceId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error('Upload document failed', {
        document: planIndex + 1,
        documents: mappedPlans.length,
        sourceId: plan.sourceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await persistRunState(config.paths.buildStateDir, state);
  }

  finalizeRunState(state);
  const statePath = await persistRunState(config.paths.buildStateDir, state);
  await writeJsonArtifact(config.paths.buildReportsDir, 'upload-report.json', state);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'upload-report.md',
    `# Upload Report\n\n- Run ID: ${state.runId}\n- Environment: ${context.environmentId}\n- Default parent entry: ${importOptions.defaultParentEntryId ?? 'not set'}\n- Placeholder asset: ${importOptions.placeholderAsset?.enabled ? `${importOptions.placeholderAsset.assetId} (${importOptions.placeholderAsset.mode ?? 'all'})` : 'not enabled'}\n- Completed: ${state.summary.completed}\n- Failed: ${state.summary.failed}\n- Created entries: ${state.summary.createdEntries}\n- Updated entries: ${state.summary.updatedEntries}\n- Created assets: ${state.summary.createdAssets}\n- Updated assets: ${state.summary.updatedAssets}\n- State file: ${statePath}\n`
  );

  logger.info('Upload finished', { statePath, summary: state.summary });

  if (state.summary.failed > 0) {
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

async function resolveFailedSourceIds(
  flags: CliFlags,
  stateDirectoryPath: string
): Promise<Set<string> | undefined> {
  if (!flags['only-failed'] && !flags['failed-from']) {
    return undefined;
  }

  const state = typeof flags['failed-from'] === 'string'
    ? await readRunStateFile(flags['failed-from'])
    : await findLatestRunState(stateDirectoryPath, 'upload');

  if (!state) {
    throw new Error('No upload state was found. Run upload once, or pass --failed-from <state-file>.');
  }
  if (state.mode !== 'upload') {
    throw new Error(`Run state ${state.runId} is a ${state.mode} state, not an upload state.`);
  }

  const failedSourceIds = Object.values(state.documents)
    .filter((document) => document.status === 'failed')
    .map((document) => document.sourceId);

  if (failedSourceIds.length === 0) {
    throw new Error(`Upload state ${state.runId} does not contain any failed documents.`);
  }

  return new Set(failedSourceIds);
}

async function readRunStateFile(filePath: string): Promise<RunState> {
  const payload = await readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(payload) as RunState;
}

async function uploadEntriesInDependencyOrder(
  entries: PlannedEntry[],
  uploadEntry: (entry: PlannedEntry) => Promise<void>,
  limit: <T>(task: () => Promise<T>) => Promise<T>
): Promise<void> {
  const pending = new Map(entries.map((entry) => [entry.entryId, entry]));
  const completed = new Set<string>();

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((entry) =>
      entry.linkedEntryIds.every((linkedEntryId) => completed.has(linkedEntryId) || !pending.has(linkedEntryId))
    );

    if (ready.length === 0) {
      throw new Error(
        `Unable to resolve entry dependency order for entries: ${[...pending.keys()].join(', ')}`
      );
    }

    await Promise.all(ready.map((entry) => limit(() => uploadEntry(entry))));
    for (const entry of ready) {
      pending.delete(entry.entryId);
      completed.add(entry.entryId);
    }
  }
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

function incrementCounter(increment: () => number): number {
  return increment();
}

type UploadSummaryCounterKey =
  | 'createdAssets'
  | 'updatedAssets'
  | 'createdEntries'
  | 'updatedEntries';

function incrementSummary(summary: RunSummary, key: UploadSummaryCounterKey): void {
  summary[key] += 1;
}

function parsePositiveInteger(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createLimiter(concurrency: number): <T>(task: () => Promise<T>) => Promise<T> {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    activeCount -= 1;
    const run = queue.shift();
    if (run) {
      run();
    }
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    activeCount += 1;
    try {
      return await task();
    } finally {
      next();
    }
  };
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
