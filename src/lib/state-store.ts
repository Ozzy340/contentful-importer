import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DocumentRunState, RunState } from './types.js';
import { writeJsonArtifact } from './reporter.js';

export function createInitialRunState(
  mode: RunState['mode'],
  environmentId?: string
): RunState {
  return {
    runId: `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    mode,
    environmentId,
    startedAt: new Date().toISOString(),
    summary: {
      completed: 0,
      failed: 0,
      skipped: 0,
      createdEntries: 0,
      updatedEntries: 0,
      createdAssets: 0,
      updatedAssets: 0,
      publishedEntries: 0,
      publishedAssets: 0,
      deletedEntries: 0,
      deletedAssets: 0
    },
    documents: {}
  };
}

export async function persistRunState(directoryPath: string, state: RunState): Promise<string> {
  return writeJsonArtifact(directoryPath, `${state.runId}.json`, state);
}

export function startDocument(
  state: RunState,
  sourceId: string,
  sourcePath: string
): DocumentRunState {
  const next: DocumentRunState = {
    sourceId,
    sourcePath,
    status: 'running',
    startedAt: new Date().toISOString(),
    entryIds: [],
    assetIds: []
  };
  state.documents[sourceId] = next;
  return next;
}

export function completeDocument(
  state: RunState,
  sourceId: string,
  entryIds: string[],
  assetIds: string[]
): void {
  const current = state.documents[sourceId];
  if (!current) {
    return;
  }

  current.status = 'completed';
  current.entryIds = entryIds;
  current.assetIds = assetIds;
  current.finishedAt = new Date().toISOString();
  state.summary.completed += 1;
}

export function failDocument(state: RunState, sourceId: string, reason: string): void {
  const current = state.documents[sourceId];
  if (!current) {
    return;
  }

  current.status = 'failed';
  current.reason = reason;
  current.finishedAt = new Date().toISOString();
  state.summary.failed += 1;
}

export function skipDocument(state: RunState, sourceId: string, reason: string): void {
  state.documents[sourceId] = {
    sourceId,
    sourcePath: state.documents[sourceId]?.sourcePath ?? '',
    status: 'skipped',
    reason,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    entryIds: [],
    assetIds: []
  };
  state.summary.skipped += 1;
}

export function finalizeRunState(state: RunState): void {
  state.finishedAt = new Date().toISOString();
}

export async function findLatestRunState(
  directoryPath: string,
  mode?: RunState['mode']
): Promise<RunState | undefined> {
  const files = (await readdir(directoryPath))
    .filter((fileName) => fileName.endsWith('.json'))
    .filter((fileName) => !mode || fileName.startsWith(`${mode}-`));
  const latest = [...files].sort().at(-1);
  if (!latest) {
    return undefined;
  }

  const payload = await readFile(path.join(directoryPath, latest), 'utf8');
  return JSON.parse(payload) as RunState;
}
