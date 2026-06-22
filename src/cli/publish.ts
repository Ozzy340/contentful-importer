import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { assertSafeEnvironment, createContentfulContext } from '../lib/contentful-client.js';
import { pullDiscoverySnapshot } from '../lib/contentful-discovery.js';
import { Logger } from '../lib/logger.js';
import { buildArtifacts, ensureNoErrors, summarizeIssuesMarkdown } from '../lib/pipeline.js';
import { publishAssets, publishEntries } from '../lib/publish-service.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  completeDocument,
  createInitialRunState,
  failDocument,
  finalizeRunState,
  persistRunState,
  startDocument
} from '../lib/state-store.js';

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'publish');
  const config = await loadProjectConfig();
  const context = await createContentfulContext(config.env);
  const source = String(flags.source ?? config.paths.sourceDocsDir);
  const allowNonSandbox = Boolean(flags['allow-non-sandbox']);
  const confirmed = Boolean(flags.yes);
  const chunkSize = Number(flags['chunk-size'] ?? 10);

  if (!confirmed) {
    throw new Error('Publishing is disabled by default. Re-run with --yes after sandbox review.');
  }

  assertSafeEnvironment(context.environmentId, config.conventions, allowNonSandbox);
  const discovery = await pullDiscoverySnapshot(context);
  const artifacts = await buildArtifacts(source, config, discovery);
  await writeJsonArtifact(config.paths.buildReportsDir, 'publish-validation-report.json', {
    generatedAt: new Date().toISOString(),
    issues: artifacts.issues
  });
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'publish-validation-report.md',
    summarizeIssuesMarkdown(artifacts.issues)
  );
  ensureNoErrors(artifacts.issues);

  const state = createInitialRunState('publish', context.environmentId);
  for (const plan of artifacts.mappedPlans) {
    startDocument(state, plan.sourceId, plan.sourcePath);

    try {
      state.summary.publishedAssets += await publishAssets(
        context,
        plan.assets.map((asset) => asset.assetId),
        chunkSize
      );
      state.summary.publishedEntries += await publishEntries(
        context,
        plan.childEntries.map((entry) => entry.entryId),
        chunkSize
      );
      state.summary.publishedEntries += await publishEntries(
        context,
        [plan.parentEntry.entryId],
        1
      );

      completeDocument(
        state,
        plan.sourceId,
        [...plan.childEntries.map((entry) => entry.entryId), plan.parentEntry.entryId],
        plan.assets.map((asset) => asset.assetId)
      );
    } catch (error) {
      failDocument(
        state,
        plan.sourceId,
        error instanceof Error ? error.message : String(error)
      );
    }

    await persistRunState(config.paths.buildStateDir, state);
  }

  finalizeRunState(state);
  const statePath = await persistRunState(config.paths.buildStateDir, state);
  await writeJsonArtifact(config.paths.buildReportsDir, 'publish-report.json', state);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'publish-report.md',
    `# Publish Report\n\n- Run ID: ${state.runId}\n- Environment: ${context.environmentId}\n- Published entries: ${state.summary.publishedEntries}\n- Published assets: ${state.summary.publishedAssets}\n- Failed documents: ${state.summary.failed}\n- State file: ${statePath}\n`
  );

  logger.info('Publish finished', { statePath, summary: state.summary });

  if (state.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
