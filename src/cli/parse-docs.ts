import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { Logger } from '../lib/logger.js';
import { buildArtifacts, summarizeIssuesMarkdown } from '../lib/pipeline.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { createInitialRunState, finalizeRunState, persistRunState } from '../lib/state-store.js';

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'parse-docs');
  const config = await loadProjectConfig();
  const source = String(flags.source ?? config.paths.sourceDocsDir);
  const artifacts = await buildArtifacts(source, config);

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    documentCount: artifacts.canonicalDocuments.length,
    documents: artifacts.canonicalDocuments.map((document) => ({
      sourceId: document.sourceId,
      entryId: document.target.entryId,
      blocks: document.blocks.length
    })),
    validation: artifacts.issues
  };

  await writeJsonArtifact(config.paths.buildReportsDir, 'parse-report.json', report);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'parse-report.md',
    summarizeIssuesMarkdown(artifacts.issues)
  );

  const state = createInitialRunState('parse');
  for (const document of artifacts.canonicalDocuments) {
    state.documents[document.sourceId] = {
      sourceId: document.sourceId,
      sourcePath: document.sourcePath,
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      entryIds: [document.target.entryId],
      assetIds: []
    };
    state.summary.completed += 1;
  }
  finalizeRunState(state);
  await persistRunState(config.paths.buildStateDir, state);

  logger.info('Parsing finished', { documentCount: artifacts.canonicalDocuments.length });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
