import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import { createContentfulContext } from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import {
  collectPromotionGraph,
  executePromotion,
  preflightPromotion,
  PromotionExecutionFailure,
  renderPromotionMarkdownReport
} from '../lib/promotion-service.js';
import type {
  PromotionExecutionResult,
  PromotionOptions,
  PromotionPreflight
} from '../lib/promotion-service.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, RuntimeEnv } from '../lib/types.js';

interface PromotionCommandConfig {
  source: {
    spaceId: string;
    environmentId: string;
  };
  target: {
    spaceId: string;
    environmentId: string;
  };
  entryIds: string[];
  options: PromotionOptions;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'promote-content');
  const projectConfig = await loadProjectConfig();
  const commandConfig = await resolveCommandConfig(flags, projectConfig.env);
  const mode = flags.yes ? 'upload' : 'dry-run';

  if (
    commandConfig.source.spaceId === commandConfig.target.spaceId
    && commandConfig.source.environmentId === commandConfig.target.environmentId
  ) {
    throw new Error('Source and target must be different space/environment pairs.');
  }

  logger.info('Preparing content promotion', {
    mode,
    source: commandConfig.source,
    target: commandConfig.target,
    entries: commandConfig.entryIds.length,
    allowOverwrite: commandConfig.options.allowOverwrite,
    reuseExistingDependencies: commandConfig.options.reuseExistingDependencies,
    requirePublishedSource: commandConfig.options.requirePublishedSource,
    includeDrafts: commandConfig.options.includeDrafts,
    allowDirtyTargetReuse: commandConfig.options.allowDirtyTargetReuse,
    overwriteUnpublishedTargetDependencies: commandConfig.options.overwriteUnpublishedTargetDependencies,
    uniqueFields: commandConfig.options.uniqueFields
  });

  const sourceContext = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_SPACE_ID: commandConfig.source.spaceId,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.source.environmentId
  });
  const targetContext = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_SPACE_ID: commandConfig.target.spaceId,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.target.environmentId
  });

  const graph = await collectPromotionGraph(
    sourceContext,
    commandConfig.entryIds,
    commandConfig.options
  );
  logger.info('Source dependency graph collected', {
    rootEntries: graph.rootEntryIds.length,
    entries: graph.entries.size,
    assets: graph.assets.size,
    graphIssues: graph.issues.length
  });

  const preflight = await preflightPromotion(targetContext, graph, commandConfig.options);
  logger.info('Preflight complete', {
    passed: preflight.passed,
    issues: preflight.issues.length,
    errors: preflight.issues.filter((issue) => issue.severity === 'error').length,
    warnings: preflight.issues.filter((issue) => issue.severity === 'warning').length
  });

  let execution: PromotionExecutionResult | undefined;
  let executionFailed = false;
  if (mode === 'upload') {
    if (!preflight.passed) {
      await writePromotionReports(projectConfig.paths.buildReportsDir, mode, commandConfig, preflight);
      throw new Error('Preflight failed. Upload was not attempted; see the promotion report.');
    }

    logger.info('Executing promotion', {
      assets: preflight.orderedAssetIds.length,
      entries: preflight.orderedEntryIds.length
    });
    try {
      execution = await executePromotion(
        targetContext,
        graph,
        preflight,
        commandConfig.options
      );
      logger.info('Promotion upload complete', {
        createdEntries: execution.createdEntries.length,
        updatedEntries: execution.updatedEntries.length,
        reusedEntries: execution.reusedEntries.length,
        draftEntries: execution.draftEntries.length,
        publishedEntries: execution.publishedEntries.length,
        createdAssets: execution.createdAssets.length,
        updatedAssets: execution.updatedAssets.length,
        reusedAssets: execution.reusedAssets.length,
        draftAssets: execution.draftAssets.length,
        publishedAssets: execution.publishedAssets.length
      });
    } catch (error) {
      executionFailed = true;
      if (error instanceof PromotionExecutionFailure) {
        execution = error.result;
      }
      const message = error instanceof Error ? error.message : String(error);
      preflight.issues.push({
        severity: 'error',
        code: 'PROMOTION_EXECUTION_FAILED',
        message
      });
      preflight.passed = false;
      logger.error('Promotion upload failed', { error: message });
    }
  }

  const reportPaths = await writePromotionReports(
    projectConfig.paths.buildReportsDir,
    mode,
    commandConfig,
    preflight,
    execution
  );

  logger.info('Promotion report written', reportPaths);

  if (!preflight.passed || executionFailed) {
    process.exitCode = 1;
  }
}

async function resolveCommandConfig(
  flags: CliFlags,
  env: RuntimeEnv
): Promise<PromotionCommandConfig> {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN']);
  const sourceSpaceId = stringFlag(flags, 'source-space')
    ?? env.CONTENTFUL_SOURCE_SPACE_ID
    ?? env.CONTENTFUL_SPACE_ID;
  const sourceEnvironmentId = stringFlag(flags, 'source-env')
    ?? env.CONTENTFUL_SOURCE_ENVIRONMENT_ID
    ?? env.CONTENTFUL_ENVIRONMENT_ID;
  const targetSpaceId = stringFlag(flags, 'target-space')
    ?? env.CONTENTFUL_TARGET_SPACE_ID
    ?? env.CONTENTFUL_SPACE_ID;
  const targetEnvironmentId = stringFlag(flags, 'target-env')
    ?? env.CONTENTFUL_TARGET_ENVIRONMENT_ID;

  const missing = [
    ['source space', sourceSpaceId],
    ['source environment', sourceEnvironmentId],
    ['target space', targetSpaceId],
    ['target environment', targetEnvironmentId]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing promotion target configuration: ${missing.map(([name]) => name).join(', ')}. ` +
      'Pass --source-env/--target-env or set CONTENTFUL_SOURCE_ENVIRONMENT_ID and CONTENTFUL_TARGET_ENVIRONMENT_ID.'
    );
  }

  const entryIds = await resolveEntryIds(flags);
  if (entryIds.length === 0) {
    throw new Error(
      'No entries supplied. Use --entry-id <id>, --entry-ids <id1,id2>, --ids <id1,id2>, or --ids-file <path>.'
    );
  }

  return {
    source: {
      spaceId: sourceSpaceId!,
      environmentId: sourceEnvironmentId!
    },
    target: {
      spaceId: targetSpaceId!,
      environmentId: targetEnvironmentId!
    },
    entryIds,
    options: {
      allowOverwrite: Boolean(flags['allow-overwrite']),
      reuseExistingDependencies: Boolean(flags['reuse-existing-dependencies']),
      requirePublishedSource: !flags['allow-source-drafts'] && !flags['include-drafts'],
      includeDrafts: Boolean(flags['include-drafts']),
      allowDirtyTargetReuse: Boolean(flags['allow-dirty-target-reuse']),
      overwriteUnpublishedTargetDependencies: Boolean(flags['overwrite-unpublished-target-dependencies']),
      uniqueFields: parseCsv(stringFlag(flags, 'unique-fields') ?? 'slug')
    }
  };
}

async function resolveEntryIds(flags: CliFlags): Promise<string[]> {
  const values: string[] = [];
  values.push(...parseCsv(stringFlag(flags, 'entry-id')));
  values.push(...parseCsv(stringFlag(flags, 'entry-ids')));
  values.push(...parseCsv(stringFlag(flags, 'ids')));

  const idsFile = stringFlag(flags, 'ids-file');
  if (idsFile) {
    values.push(...parseCsv(await readFile(path.resolve(idsFile), 'utf8')));
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function writePromotionReports(
  reportsDir: string,
  mode: 'dry-run' | 'upload',
  commandConfig: PromotionCommandConfig,
  preflight: PromotionPreflight,
  execution?: PromotionExecutionResult
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `content-promotion-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    source: commandConfig.source,
    target: commandConfig.target,
    rootEntryIds: commandConfig.entryIds,
    options: commandConfig.options,
    preflight,
    execution
  };

  const jsonPath = await writeJsonArtifact(reportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    reportsDir,
    `${runId}.md`,
    renderPromotionMarkdownReport({
      mode,
      source: commandConfig.source,
      target: commandConfig.target,
      rootEntryIds: commandConfig.entryIds,
      options: commandConfig.options,
      preflight,
      execution
    })
  );

  return { jsonPath, markdownPath };
}

function stringFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
