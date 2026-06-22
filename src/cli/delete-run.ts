import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { assertSafeEnvironment, createContentfulContext } from '../lib/contentful-client.js';
import { deleteAssets, deleteEntries } from '../lib/delete-service.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  completeDocument,
  createInitialRunState,
  failDocument,
  finalizeRunState,
  persistRunState,
  startDocument
} from '../lib/state-store.js';
import type { CliFlags, DocumentRunState, RunState } from '../lib/types.js';

interface DeleteCandidate {
  sourceId: string;
  sourcePath: string;
  entryIds: string[];
  assetIds: string[];
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'delete-run');
  const config = await loadProjectConfig();
  const context = await createContentfulContext(config.env);
  const allowNonSandbox = Boolean(flags['allow-non-sandbox']);
  const confirmed = Boolean(flags.yes);
  const chunkSize = parsePositiveInteger(flags['chunk-size'], 10);
  const sourceState = await readSourceRunState(flags);
  const selectedSourceId = typeof flags.document === 'string' ? flags.document : undefined;

  if (sourceState.mode !== 'upload') {
    throw new Error(`Run state ${sourceState.runId} is a ${sourceState.mode} run. Delete by run expects an upload run state.`);
  }

  if (sourceState.environmentId && sourceState.environmentId !== context.environmentId && !flags['allow-env-mismatch']) {
    throw new Error(
      `Run state environment ${sourceState.environmentId} does not match current environment ${context.environmentId}. Re-run with --allow-env-mismatch only after review.`
    );
  }

  assertSafeEnvironment(context.environmentId, config.conventions, allowNonSandbox);
  const candidates = collectDeleteCandidates(sourceState, {
    includeFailed: Boolean(flags['include-failed']),
    selectedSourceId
  });

  if (candidates.length === 0) {
    throw new Error('No delete candidates were found in the selected upload state.');
  }

  const plannedEntries = candidates.reduce((total, candidate) => total + candidate.entryIds.length, 0);
  const plannedAssets = candidates.reduce((total, candidate) => total + candidate.assetIds.length, 0);
  logger.info(confirmed ? 'Deleting content from run' : 'Previewing content deletion from run', {
    sourceRunId: sourceState.runId,
    environmentId: context.environmentId,
    documents: candidates.length,
    entries: plannedEntries,
    assets: plannedAssets,
    dryRun: !confirmed
  });

  const state = createInitialRunState('delete', context.environmentId);
  const deleted: Array<{ sourceId: string; entries: string[]; assets: string[] }> = [];
  const missing: Array<{ sourceId: string; entries: string[]; assets: string[] }> = [];

  for (const candidate of candidates) {
    startDocument(state, candidate.sourceId, candidate.sourcePath);

    try {
      const entryResults = await deleteEntries(context, [...candidate.entryIds].reverse(), {
        dryRun: !confirmed,
        chunkSize
      });
      const assetResults = await deleteAssets(context, candidate.assetIds, {
        dryRun: !confirmed,
        chunkSize
      });

      const deletedEntries = entryResults.filter((result) => result.action === 'deleted' || result.action === 'would-delete').map((result) => result.id);
      const deletedAssets = assetResults.filter((result) => result.action === 'deleted' || result.action === 'would-delete').map((result) => result.id);
      const missingEntries = entryResults.filter((result) => result.action === 'missing').map((result) => result.id);
      const missingAssets = assetResults.filter((result) => result.action === 'missing').map((result) => result.id);

      state.summary.deletedEntries += confirmed ? deletedEntries.length : 0;
      state.summary.deletedAssets += confirmed ? deletedAssets.length : 0;
      deleted.push({ sourceId: candidate.sourceId, entries: deletedEntries, assets: deletedAssets });
      if (missingEntries.length > 0 || missingAssets.length > 0) {
        missing.push({ sourceId: candidate.sourceId, entries: missingEntries, assets: missingAssets });
      }

      completeDocument(state, candidate.sourceId, candidate.entryIds, candidate.assetIds);
      logger.info(confirmed ? 'Deleted document content' : 'Previewed document content', {
        sourceId: candidate.sourceId,
        entries: candidate.entryIds.length,
        assets: candidate.assetIds.length
      });
    } catch (error) {
      failDocument(
        state,
        candidate.sourceId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error('Delete document content failed', {
        sourceId: candidate.sourceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await persistRunState(config.paths.buildStateDir, state);
  }

  finalizeRunState(state);
  const statePath = await persistRunState(config.paths.buildStateDir, state);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceRunId: sourceState.runId,
    deleteRunId: state.runId,
    environmentId: context.environmentId,
    dryRun: !confirmed,
    planned: {
      documents: candidates.length,
      entries: plannedEntries,
      assets: plannedAssets
    },
    summary: state.summary,
    deleted,
    missing,
    statePath
  };

  await writeJsonArtifact(config.paths.buildReportsDir, 'delete-run-report.json', report);
  await writeTextArtifact(config.paths.buildReportsDir, 'delete-run-report.md', renderDeleteReport(report));
  logger.info('Delete run finished', { statePath, summary: state.summary, dryRun: !confirmed });

  if (state.summary.failed > 0) {
    process.exitCode = 1;
  }
}

async function readSourceRunState(flags: CliFlags): Promise<RunState> {
  if (typeof flags.state !== 'string') {
    throw new Error('Missing required --state <upload-state-json> argument.');
  }

  const payload = await readFile(path.resolve(flags.state), 'utf8');
  return JSON.parse(payload) as RunState;
}

function collectDeleteCandidates(
  state: RunState,
  options: { includeFailed: boolean; selectedSourceId?: string }
): DeleteCandidate[] {
  return Object.values(state.documents)
    .filter((document) => shouldIncludeDocument(document, options))
    .map((document) => ({
      sourceId: document.sourceId,
      sourcePath: document.sourcePath,
      entryIds: document.entryIds,
      assetIds: document.assetIds
    }))
    .filter((candidate) => candidate.entryIds.length > 0 || candidate.assetIds.length > 0);
}

function shouldIncludeDocument(
  document: DocumentRunState,
  options: { includeFailed: boolean; selectedSourceId?: string }
): boolean {
  if (options.selectedSourceId && document.sourceId !== options.selectedSourceId) {
    return false;
  }

  return document.status === 'completed' || (options.includeFailed && document.status === 'failed');
}

function renderDeleteReport(report: {
  generatedAt: string;
  sourceRunId: string;
  deleteRunId: string;
  environmentId: string;
  dryRun: boolean;
  planned: { documents: number; entries: number; assets: number };
  summary: RunState['summary'];
  missing: Array<{ sourceId: string; entries: string[]; assets: string[] }>;
  statePath: string;
}): string {
  const mode = report.dryRun ? 'Preview only' : 'Deleted';
  const lines = [
    '# Delete Run Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${mode}`,
    `- Source upload run: ${report.sourceRunId}`,
    `- Delete run: ${report.deleteRunId}`,
    `- Environment: ${report.environmentId}`,
    `- Documents: ${report.planned.documents}`,
    `- Entries planned: ${report.planned.entries}`,
    `- Assets planned: ${report.planned.assets}`,
    `- Deleted entries: ${report.summary.deletedEntries}`,
    `- Deleted assets: ${report.summary.deletedAssets}`,
    `- Failed documents: ${report.summary.failed}`,
    `- State file: ${report.statePath}`,
    ''
  ];

  if (report.missing.length > 0) {
    lines.push('## Missing');
    lines.push('');
    lines.push('| Source ID | Missing entries | Missing assets |');
    lines.push('| --- | ---: | ---: |');
    for (const item of report.missing) {
      lines.push(`| ${item.sourceId} | ${item.entries.length} | ${item.assets.length} |`);
    }
    lines.push('');
  }

  if (report.dryRun) {
    lines.push('No Contentful content was deleted. Re-run with `--yes` to delete the planned entries and assets.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function parsePositiveInteger(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
