import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext
} from '../lib/contentful-client.js';
import {
  collectEntityCloneGraph,
  EntityCloneExecutionFailure,
  executeEntityClone,
  preflightEntityClone,
  renderEntityCloneMarkdownReport
} from '../lib/entity-clone-service.js';
import type {
  EntityCloneExecutionResult,
  EntityCloneGraph,
  EntityClonePreflight
} from '../lib/entity-clone-service.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

interface CloneCommandConfig {
  environmentId: string;
  rootEntryId: string;
  seedName: string;
  newRootEntryId?: string;
  mode: 'dry-run' | 'create';
  allowNonSandbox: boolean;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'clone-entity');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);

  logger.info('Preparing entity clone', {
    mode: commandConfig.mode,
    environmentId: commandConfig.environmentId,
    rootEntryId: commandConfig.rootEntryId,
    seedName: commandConfig.seedName,
    newRootEntryId: commandConfig.newRootEntryId
  });

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });

  if (commandConfig.mode === 'create') {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  const graph = await collectEntityCloneGraph(context, {
    rootEntryId: commandConfig.rootEntryId,
    seedName: commandConfig.seedName,
    newRootEntryId: commandConfig.newRootEntryId,
    conventions: projectConfig.conventions
  });
  logger.info('Source clone graph collected', {
    entries: graph.entries.size,
    assets: graph.assets.size,
    linksRemoved: graph.removedLinks.length,
    graphIssues: graph.issues.length
  });

  const preflight = await preflightEntityClone(context, graph);
  logger.info('Preflight complete', {
    passed: preflight.passed,
    entries: preflight.operations.entries.length,
    assets: preflight.operations.assets.length,
    errors: preflight.issues.filter((issue) => issue.severity === 'error').length,
    warnings: preflight.issues.filter((issue) => issue.severity === 'warning').length
  });

  let execution: EntityCloneExecutionResult | undefined;
  let executionFailed = false;
  if (commandConfig.mode === 'create') {
    if (!preflight.passed) {
      const reportPaths = await writeCloneReports(
        projectConfig,
        commandConfig,
        graph,
        preflight
      );
      logger.error('Preflight failed; clone was not created', reportPaths);
      throw new Error('Preflight failed. Create was not attempted; see the entity clone report.');
    }

    logger.info('Creating cloned draft entities', {
      entries: preflight.orderedEntrySourceIds.length,
      assets: preflight.orderedAssetSourceIds.length
    });

    try {
      execution = await executeEntityClone(context, graph, preflight);
      logger.info('Entity clone create complete', {
        createdEntries: execution.createdEntries.length,
        createdAssets: execution.createdAssets.length
      });
    } catch (error) {
      executionFailed = true;
      if (error instanceof EntityCloneExecutionFailure) {
        execution = error.result;
      }
      const message = error instanceof Error ? error.message : String(error);
      preflight.issues.push({
        severity: 'error',
        code: 'CLONE_EXECUTION_FAILED',
        message
      });
      preflight.passed = false;
      logger.error('Entity clone create failed', { error: message });
    }
  }

  const reportPaths = await writeCloneReports(
    projectConfig,
    commandConfig,
    graph,
    preflight,
    execution
  );
  logger.info('Entity clone report written', reportPaths);

  if (!preflight.passed || executionFailed) {
    process.exitCode = 1;
  }
}

function resolveCommandConfig(flags: CliFlags, env: RuntimeEnv): CloneCommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN']);

  const environmentId = stringFlag(flags, 'env')
    ?? stringFlag(flags, 'environment')
    ?? env.CONTENTFUL_ENVIRONMENT_ID;
  const rootEntryId = stringFlag(flags, 'entry-id')
    ?? stringFlag(flags, 'entity-id')
    ?? stringFlag(flags, 'id');
  const seedName = stringFlag(flags, 'name')
    ?? stringFlag(flags, 'seed-name')
    ?? stringFlag(flags, 'new-name');
  const newRootEntryId = stringFlag(flags, 'new-entry-id')
    ?? stringFlag(flags, 'new-id');

  const missing = [
    ['environment', environmentId],
    ['entry id', rootEntryId],
    ['new name', seedName]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing entity clone configuration: ${missing.map(([name]) => name).join(', ')}. ` +
      'Use --env <environment>, --entry-id <entry-id>, and --name "<new name>".'
    );
  }

  return {
    environmentId: environmentId!,
    rootEntryId: rootEntryId!,
    seedName: seedName!,
    newRootEntryId,
    mode: flags.create ? 'create' : 'dry-run',
    allowNonSandbox: Boolean(flags['allow-non-sandbox'])
  };
}

async function writeCloneReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CloneCommandConfig,
  graph: EntityCloneGraph,
  preflight: EntityClonePreflight,
  execution?: EntityCloneExecutionResult
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `entity-clone-${commandConfig.mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.mode,
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    rootEntryId: commandConfig.rootEntryId,
    seedName: commandConfig.seedName,
    newRootEntryId: graph.newRootEntryId,
    graph: serializeGraph(graph),
    preflight,
    execution
  };

  const jsonPath = await writeJsonArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.json`,
    report
  );
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderEntityCloneMarkdownReport({
      mode: commandConfig.mode,
      spaceId: projectConfig.env.CONTENTFUL_SPACE_ID ?? '',
      environmentId: commandConfig.environmentId,
      rootEntryId: commandConfig.rootEntryId,
      seedName: commandConfig.seedName,
      graph,
      preflight,
      execution
    })
  );

  return { jsonPath, markdownPath };
}

function serializeGraph(graph: EntityCloneGraph): Record<string, unknown> {
  return {
    rootEntryId: graph.rootEntryId,
    newRootEntryId: graph.newRootEntryId,
    seedName: graph.seedName,
    seedSlug: graph.seedSlug,
    sourceRootName: graph.sourceRootName,
    entries: [...graph.entries.values()],
    assets: [...graph.assets.values()],
    removedLinks: graph.removedLinks,
    issues: graph.issues
  };
}

function stringFlag(flags: CliFlags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
