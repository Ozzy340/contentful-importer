import {
  createTag,
  getEntryIfExists,
  getExistingEntryIds,
  getTagIfExists
} from './contentful-client.js';
import type { ContentfulContext } from './contentful-client.js';
import type { OperationIntent, PlannedEntry } from './types.js';

export async function inspectEntryIntent(
  context: ContentfulContext,
  entry: PlannedEntry
): Promise<OperationIntent> {
  const existing = await getEntryIfExists(context, entry.entryId);
  assertMatchingContentType(existing, entry);
  return {
    entryId: entry.entryId,
    contentType: entry.contentType,
    role: entry.role,
    action: existing ? 'update' : 'create'
  };
}

export async function inspectEntryIntents(
  context: ContentfulContext,
  entries: PlannedEntry[],
  batchSize?: number
): Promise<OperationIntent[]> {
  const existingIds = await getExistingEntryIds(
    context,
    entries.map((entry) => entry.entryId),
    batchSize
  );

  return entries.map((entry) => ({
    entryId: entry.entryId,
    contentType: entry.contentType,
    role: entry.role,
    action: existingIds.has(entry.entryId) ? 'update' : 'create'
  }));
}

export async function upsertEntry(
  context: ContentfulContext,
  entry: PlannedEntry,
  dryRun: boolean,
  knownAction?: OperationIntent['action']
): Promise<OperationIntent> {
  const existing = knownAction === 'create' ? undefined : await getEntryIfExists(context, entry.entryId);
  assertMatchingContentType(existing, entry);
  const action = knownAction === 'create' ? 'create' : existing ? 'update' : 'create';
  const intent: OperationIntent = {
    entryId: entry.entryId,
    contentType: entry.contentType,
    role: entry.role,
    action
  };

  if (dryRun) {
    return intent;
  }

  const payload = {
    fields: entry.fields,
    metadata: entry.metadata
  };

  if (existing) {
    existing.fields = payload.fields;
    existing.metadata = payload.metadata;
    await existing.update();
    return intent;
  }

  await context.environment.createEntryWithId(entry.contentType, entry.entryId, payload);
  return intent;
}

function assertMatchingContentType(existing: any | undefined, entry: PlannedEntry): void {
  const existingContentType = existing?.sys?.contentType?.sys?.id;
  if (!existingContentType || existingContentType === entry.contentType) {
    return;
  }

  throw new Error(
    `Existing entry ${entry.entryId} is content type ${existingContentType}, but this import now maps it as ${entry.contentType}. Change the planned entry ID or delete the old entry before retrying.`
  );
}

export async function ensureTags(
  context: ContentfulContext,
  tagIds: string[],
  options: { dryRun: boolean; createIfMissing: boolean }
): Promise<{ created: string[]; existing: string[]; missing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const missing: string[] = [];

  for (const tagId of tagIds) {
    const current = await getTagIfExists(context, tagId);
    if (current) {
      existing.push(tagId);
      continue;
    }

    if (!options.createIfMissing) {
      missing.push(tagId);
      continue;
    }

    if (!options.dryRun) {
      const result = await createTag(context, tagId, humanizeTagName(tagId));
      if (result === 'existing') {
        existing.push(tagId);
        continue;
      }
    }
    created.push(tagId);
  }

  return { created, existing, missing };
}

function humanizeTagName(tagId: string): string {
  return tagId
    .split(/[:_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
