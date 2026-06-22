import { setTimeout as delay } from 'node:timers/promises';

import {
  getAssetIfExists,
  getEntryIfExists,
  getExistingAssetIds,
  getExistingEntryIds
} from './contentful-client.js';
import type { ContentfulContext } from './contentful-client.js';
import {
  padIndex,
  renderTemplate,
  slugify,
  toContentfulResourceId
} from './ids.js';
import type { ConventionsConfig, ValidationIssue } from './types.js';

export interface EntityCloneOptions {
  rootEntryId: string;
  seedName: string;
  conventions: ConventionsConfig;
  newRootEntryId?: string;
}

export interface EntityCloneGraph {
  rootEntryId: string;
  newRootEntryId: string;
  seedName: string;
  seedSlug: string;
  sourceRootName?: string;
  entries: Map<string, EntityCloneEntry>;
  assets: Map<string, EntityCloneAsset>;
  removedLinks: EntityCloneRemovedLink[];
  issues: ValidationIssue[];
}

export interface EntityCloneEntry {
  sourceId: string;
  newId: string;
  sourceName?: string;
  newName: string;
  contentType: string;
  displayField?: string;
  role: 'root' | 'child';
  parentSourceId?: string;
  fields: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  linkedEntryIds: string[];
  linkedAssetIds: string[];
  sequence: number;
}

export interface EntityCloneAsset {
  sourceId: string;
  newId: string;
  sourceName?: string;
  newName: string;
  fields: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  sequence: number;
}

export interface EntityCloneRemovedLink {
  kind: 'entry' | 'asset' | 'resource';
  sourceEntryId: string;
  targetId?: string;
  path: string;
  reason: string;
}

export interface EntityClonePreflight {
  passed: boolean;
  issues: ValidationIssue[];
  operations: {
    entries: EntityCloneEntryOperation[];
    assets: EntityCloneAssetOperation[];
  };
  orderedEntrySourceIds: string[];
  orderedAssetSourceIds: string[];
}

export interface EntityCloneEntryOperation {
  sourceId: string;
  newId: string;
  sourceName?: string;
  newName: string;
  contentType: string;
  role: EntityCloneEntry['role'];
  action: 'create' | 'blocked';
  reason?: string;
}

export interface EntityCloneAssetOperation {
  sourceId: string;
  newId: string;
  sourceName?: string;
  newName: string;
  action: 'create' | 'blocked';
  reason?: string;
}

export interface EntityCloneExecutionResult {
  createdEntries: string[];
  createdAssets: string[];
}

export class EntityCloneExecutionFailure extends Error {
  constructor(
    message: string,
    readonly result: EntityCloneExecutionResult
  ) {
    super(message);
    this.name = 'EntityCloneExecutionFailure';
  }
}

interface QueuedEntry {
  sourceId: string;
  parentSourceId?: string;
  siblingSequence: number;
  graphSequence: number;
}

interface FieldReference {
  kind: 'entry' | 'asset' | 'resource';
  id?: string;
  path: string;
}

const OMIT_LINK = Symbol('omitLink');
const NAME_FIELD_IDS = new Set(['internalName', 'name']);
const ROOT_NAME_FIELD_IDS = new Set(['internalName', 'name', 'title']);
const ROOT_SLUG_FIELD_IDS = ['slug', 'urlSlug', 'pageSlug'];

export async function collectEntityCloneGraph(
  context: ContentfulContext,
  options: EntityCloneOptions
): Promise<EntityCloneGraph> {
  const seedName = options.seedName.trim();
  const seedSlug = slugify(seedName);
  if (!seedName) {
    throw new Error('A non-empty --name / --seed-name value is required.');
  }
  if (!seedSlug) {
    throw new Error(`Unable to derive a slug from seed name "${options.seedName}".`);
  }

  const rootEntry = await getEntryIfExists(context, options.rootEntryId);
  if (!rootEntry) {
    throw new Error(`Source entry ${options.rootEntryId} was not found in ${context.environmentId}.`);
  }

  const displayFieldCache = new Map<string, string | undefined>();
  const sourceEntryCache = new Map<string, any>();
  sourceEntryCache.set(options.rootEntryId, rootEntry);

  const rootContentType = getEntryContentType(rootEntry);
  const rootDisplayField = await getDisplayField(context, rootContentType, displayFieldCache);
  const sourceRootName = extractEntryName(rootEntry.fields ?? {}, rootDisplayField);
  const sourceRootSlug = firstLocalizedString(rootEntry.fields?.slug);
  const newRootEntryId = toContentfulResourceId(
    options.newRootEntryId?.trim()
      || buildRootEntryId(options.rootEntryId, rootContentType, seedName, seedSlug, options.conventions)
  );
  const rootNameCandidates = [
    sourceRootName,
    sourceRootSlug ? humanizeSlug(sourceRootSlug) : undefined
  ].filter((value): value is string => Boolean(value));

  const graph: EntityCloneGraph = {
    rootEntryId: options.rootEntryId,
    newRootEntryId,
    seedName,
    seedSlug,
    sourceRootName,
    entries: new Map(),
    assets: new Map(),
    removedLinks: [],
    issues: []
  };

  const queuedSourceIds = new Set([options.rootEntryId]);
  const queue: QueuedEntry[] = [{
    sourceId: options.rootEntryId,
    siblingSequence: 1,
    graphSequence: 1
  }];
  const childCounters = new Map<string, number>();
  let graphSequence = 1;

  while (queue.length > 0) {
    const queued = queue.shift();
    if (!queued || graph.entries.has(queued.sourceId)) {
      continue;
    }

    const sourceEntry = await getCachedEntry(context, queued.sourceId, sourceEntryCache);
    if (!sourceEntry) {
      graph.issues.push({
        severity: 'error',
        code: 'SOURCE_ENTRY_MISSING',
        message: `Source entry ${queued.sourceId} was linked but could not be fetched.`,
        documentId: queued.sourceId
      });
      continue;
    }

    const contentType = getEntryContentType(sourceEntry);
    const displayField = await getDisplayField(context, contentType, displayFieldCache);
    const sourceName = extractEntryName(sourceEntry.fields ?? {}, displayField);
    const parent = queued.parentSourceId ? graph.entries.get(queued.parentSourceId) : undefined;
    const newId = queued.sourceId === options.rootEntryId
      ? newRootEntryId
      : buildChildEntryId({
        sourceEntryId: queued.sourceId,
        sourceParentId: queued.parentSourceId ?? options.rootEntryId,
        newParentId: parent?.newId ?? newRootEntryId,
        contentType,
        sequence: queued.siblingSequence,
        conventions: options.conventions
      });
    const newName = queued.sourceId === options.rootEntryId
      ? seedName
      : buildDerivedName({
        seedName,
        sourceName,
        sourceRootNameCandidates: rootNameCandidates,
        fallbackLabel: humanizeIdentifier(contentType),
        sequence: queued.siblingSequence,
        conventions: options.conventions
      });

    const references = collectFieldReferences(sourceEntry.fields ?? {});
    const linkedEntryIds = new Set<string>();
    const linkedAssetIds = new Set<string>();

    for (const reference of references.filter((item) => item.kind === 'entry')) {
      if (!reference.id) {
        continue;
      }

      const linkedEntry = await getCachedEntry(context, reference.id, sourceEntryCache);
      if (!linkedEntry) {
        graph.removedLinks.push({
          kind: 'entry',
          sourceEntryId: queued.sourceId,
          targetId: reference.id,
          path: reference.path,
          reason: 'linked entry could not be fetched'
        });
        graph.issues.push({
          severity: 'warning',
          code: 'CLONE_LINKED_ENTRY_MISSING',
          message: `Linked entry ${reference.id} will be removed because it could not be fetched.`,
          documentId: queued.sourceId,
          path: reference.path
        });
        continue;
      }

      const linkedContentType = getEntryContentType(linkedEntry);
      if (reference.id !== options.rootEntryId && isBoundaryContentType(linkedContentType)) {
        graph.removedLinks.push({
          kind: 'entry',
          sourceEntryId: queued.sourceId,
          targetId: reference.id,
          path: reference.path,
          reason: `content type ${linkedContentType} is treated as an external page-like reference`
        });
        continue;
      }

      linkedEntryIds.add(reference.id);
      if (!queuedSourceIds.has(reference.id)) {
        queuedSourceIds.add(reference.id);
        graphSequence += 1;
        queue.push({
          sourceId: reference.id,
          parentSourceId: queued.sourceId,
          siblingSequence: nextChildSequence(childCounters, queued.sourceId),
          graphSequence
        });
      }
    }

    for (const reference of references.filter((item) => item.kind === 'asset')) {
      if (!reference.id) {
        continue;
      }

      const asset = await getAssetIfExists(context, reference.id);
      if (!asset) {
        graph.removedLinks.push({
          kind: 'asset',
          sourceEntryId: queued.sourceId,
          targetId: reference.id,
          path: reference.path,
          reason: 'linked asset could not be fetched'
        });
        graph.issues.push({
          severity: 'error',
          code: 'SOURCE_ASSET_MISSING',
          message: `Source asset ${reference.id} was linked but could not be fetched.`,
          documentId: queued.sourceId,
          path: reference.path
        });
        continue;
      }

      linkedAssetIds.add(reference.id);
      if (!graph.assets.has(reference.id)) {
        const assetSequence = graph.assets.size + 1;
        const sourceName = extractAssetName(asset.fields ?? {});
        graph.assets.set(reference.id, {
          sourceId: reference.id,
          newId: buildAssetId({
            sourceAssetId: reference.id,
            sourceRootEntryId: options.rootEntryId,
            newRootEntryId,
            sourceRootSlug,
            seedSlug,
            sequence: assetSequence,
            conventions: options.conventions
          }),
          sourceName,
          newName: buildDerivedName({
            seedName,
            sourceName,
            sourceRootNameCandidates: rootNameCandidates,
            fallbackLabel: 'asset',
            sequence: assetSequence,
            conventions: options.conventions
          }),
          fields: cloneJson(asset.fields ?? {}),
          metadata: cloneJson(asset.metadata ?? {}),
          sequence: assetSequence
        });
        appendAssetFileIssues(graph.issues, reference.id, asset.fields?.file ?? {});
      }
    }

    for (const reference of references.filter((item) => item.kind === 'resource')) {
      graph.removedLinks.push({
        kind: 'resource',
        sourceEntryId: queued.sourceId,
        path: reference.path,
        reason: 'ResourceLink values are external references'
      });
    }

    graph.entries.set(queued.sourceId, {
      sourceId: queued.sourceId,
      newId,
      sourceName,
      newName,
      contentType,
      displayField,
      role: queued.sourceId === options.rootEntryId ? 'root' : 'child',
      parentSourceId: queued.parentSourceId,
      fields: cloneJson(sourceEntry.fields ?? {}),
      metadata: cloneJson(sourceEntry.metadata ?? {}),
      linkedEntryIds: [...linkedEntryIds],
      linkedAssetIds: [...linkedAssetIds],
      sequence: queued.graphSequence
    });
  }

  if (graph.removedLinks.length > 0) {
    graph.issues.push({
      severity: 'warning',
      code: 'CLONE_LINKS_REMOVED',
      message: `${graph.removedLinks.length} external or non-cloned link(s) will be removed from copied fields.`,
      details: graph.removedLinks.slice(0, 50)
    });
  }

  return graph;
}

export async function preflightEntityClone(
  context: ContentfulContext,
  graph: EntityCloneGraph
): Promise<EntityClonePreflight> {
  const duplicateEntryIds = findDuplicateValues([...graph.entries.values()].map((entry) => entry.newId));
  const duplicateAssetIds = findDuplicateValues([...graph.assets.values()].map((asset) => asset.newId));
  const existingEntryIds = await getExistingEntryIds(
    context,
    [...graph.entries.values()].map((entry) => entry.newId)
  );
  const existingAssetIds = await getExistingAssetIds(
    context,
    [...graph.assets.values()].map((asset) => asset.newId)
  );
  const orderResult = orderEntriesByDependencies(graph);

  const issues = [...graph.issues, ...orderResult.issues];
  for (const entryId of duplicateEntryIds) {
    issues.push({
      severity: 'error',
      code: 'CLONE_PLANNED_ENTRY_ID_DUPLICATE',
      message: `The clone plan generates entry ID ${entryId} more than once. Choose a different seed name or source entry.`,
      documentId: entryId
    });
  }
  for (const assetId of duplicateAssetIds) {
    issues.push({
      severity: 'error',
      code: 'CLONE_PLANNED_ASSET_ID_DUPLICATE',
      message: `The clone plan generates asset ID ${assetId} more than once. Choose a different seed name or source entry.`,
      documentId: assetId
    });
  }

  const entryOperations = [...graph.entries.values()].map((entry) => {
    const duplicate = duplicateEntryIds.has(entry.newId);
    const exists = existingEntryIds.has(entry.newId);
    const action = duplicate || exists ? 'blocked' as const : 'create' as const;
    return {
      sourceId: entry.sourceId,
      newId: entry.newId,
      sourceName: entry.sourceName,
      newName: entry.newName,
      contentType: entry.contentType,
      role: entry.role,
      action,
      reason: duplicate
        ? 'Generated entry ID is duplicated inside the clone plan.'
        : exists
          ? 'Entry ID already exists in the environment.'
          : undefined
    };
  });

  const assetOperations = [...graph.assets.values()].map((asset) => {
    const duplicate = duplicateAssetIds.has(asset.newId);
    const exists = existingAssetIds.has(asset.newId);
    const action = duplicate || exists ? 'blocked' as const : 'create' as const;
    return {
      sourceId: asset.sourceId,
      newId: asset.newId,
      sourceName: asset.sourceName,
      newName: asset.newName,
      action,
      reason: duplicate
        ? 'Generated asset ID is duplicated inside the clone plan.'
        : exists
          ? 'Asset ID already exists in the environment.'
          : undefined
    };
  });

  for (const operation of entryOperations) {
    if (operation.action === 'blocked') {
      issues.push({
        severity: 'error',
        code: 'CLONE_TARGET_ENTRY_ID_COLLISION',
        message: `Cannot create ${operation.newId}: ${operation.reason}`,
        documentId: operation.newId,
        details: operation
      });
    }
  }

  for (const operation of assetOperations) {
    if (operation.action === 'blocked') {
      issues.push({
        severity: 'error',
        code: 'CLONE_TARGET_ASSET_ID_COLLISION',
        message: `Cannot create ${operation.newId}: ${operation.reason}`,
        documentId: operation.newId,
        details: operation
      });
    }
  }

  return {
    passed: !issues.some((issue) => issue.severity === 'error'),
    issues,
    operations: {
      entries: entryOperations,
      assets: assetOperations
    },
    orderedEntrySourceIds: orderResult.entrySourceIds,
    orderedAssetSourceIds: [...graph.assets.keys()]
  };
}

export async function executeEntityClone(
  context: ContentfulContext,
  graph: EntityCloneGraph,
  preflight: EntityClonePreflight
): Promise<EntityCloneExecutionResult> {
  if (!preflight.passed) {
    throw new Error('Cannot create clone because preflight has errors.');
  }

  const result: EntityCloneExecutionResult = {
    createdEntries: [],
    createdAssets: []
  };

  const entryIdMap = new Map([...graph.entries].map(([sourceId, entry]) => [sourceId, entry.newId]));
  const assetIdMap = new Map([...graph.assets].map(([sourceId, asset]) => [sourceId, asset.newId]));

  try {
    for (const sourceAssetId of preflight.orderedAssetSourceIds) {
      const asset = graph.assets.get(sourceAssetId);
      if (!asset) {
        continue;
      }

      const existing = await getAssetIfExists(context, asset.newId);
      if (existing) {
        throw new Error(`Refusing to overwrite existing asset ${asset.newId}.`);
      }

      const created = await context.environment.createAssetWithId(asset.newId, {
        fields: buildAssetFieldsForClone(asset),
        metadata: cloneJson(asset.metadata ?? {})
      });
      await created.processForAllLocales();
      await waitForProcessedAsset(context, asset.newId);
      result.createdAssets.push(asset.newId);
    }

    for (const sourceEntryId of preflight.orderedEntrySourceIds) {
      const entry = graph.entries.get(sourceEntryId);
      if (!entry) {
        continue;
      }

      const existing = await getEntryIfExists(context, entry.newId);
      if (existing) {
        throw new Error(`Refusing to overwrite existing entry ${entry.newId}.`);
      }

      await context.environment.createEntryWithId(entry.contentType, entry.newId, {
        fields: buildEntryFieldsForClone(entry, graph.seedSlug, entryIdMap, assetIdMap),
        metadata: cloneJson(entry.metadata ?? {})
      });
      result.createdEntries.push(entry.newId);
    }
  } catch (error) {
    throw new EntityCloneExecutionFailure(
      error instanceof Error ? error.message : String(error),
      result
    );
  }

  return result;
}

export function renderEntityCloneMarkdownReport(report: {
  mode: 'dry-run' | 'create';
  spaceId: string;
  environmentId: string;
  rootEntryId: string;
  seedName: string;
  graph: EntityCloneGraph;
  preflight: EntityClonePreflight;
  execution?: EntityCloneExecutionResult;
}): string {
  const errors = report.preflight.issues.filter((issue) => issue.severity === 'error');
  const warnings = report.preflight.issues.filter((issue) => issue.severity === 'warning');
  const blockedEntries = report.preflight.operations.entries.filter((operation) => operation.action === 'blocked');
  const blockedAssets = report.preflight.operations.assets.filter((operation) => operation.action === 'blocked');

  const lines = [
    `# Entity Clone ${report.mode === 'create' ? 'Create' : 'Dry Run'} Report`,
    '',
    `- Environment: ${report.spaceId}/${report.environmentId}`,
    `- Source entry: ${report.rootEntryId}`,
    `- New seed name: ${report.seedName}`,
    `- New root entry: ${report.graph.newRootEntryId}`,
    `- Preflight passed: ${report.preflight.passed ? 'yes' : 'no'}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Planned Summary',
    '',
    `- Entries to create: ${report.preflight.operations.entries.filter((operation) => operation.action === 'create').length}`,
    `- Assets to create: ${report.preflight.operations.assets.filter((operation) => operation.action === 'create').length}`,
    `- Links to remove: ${report.graph.removedLinks.length}`,
    `- Components in nested structure: ${report.graph.entries.size}`,
    `- Nested child components: ${Math.max(report.graph.entries.size - 1, 0)}`,
    `- Entries blocked: ${blockedEntries.length}`,
    `- Assets blocked: ${blockedAssets.length}`,
    ''
  ];

  if (report.execution) {
    lines.push(
      '## Executed Operations',
      '',
      `- Created entries: ${report.execution.createdEntries.length}`,
      `- Created assets: ${report.execution.createdAssets.length}`,
      '- Published entries: 0',
      '- Published assets: 0',
      ''
    );
  }

  if (report.preflight.issues.length > 0) {
    lines.push('## Issues', '');
    for (const issue of report.preflight.issues) {
      lines.push(
        `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${issue.documentId ? ` (${issue.documentId})` : ''}`
      );
    }
    lines.push('');
  }

  lines.push(
    '## New Entry Sequence',
    '',
    '| Order | Source ID | New ID | Content Type | New Name |',
    '| ---: | --- | --- | --- | --- |'
  );
  let entryOrder = 0;
  for (const sourceId of report.preflight.orderedEntrySourceIds) {
    const entry = report.graph.entries.get(sourceId);
    if (!entry) {
      continue;
    }
    entryOrder += 1;
    lines.push(
      `| ${entryOrder} | ${escapeTableCell(entry.sourceId)} | ${escapeTableCell(entry.newId)} | ${escapeTableCell(entry.contentType)} | ${escapeTableCell(entry.newName)} |`
    );
  }
  lines.push('');

  lines.push(
    '## New Asset Sequence',
    '',
    '| Order | Source ID | New ID | New Name |',
    '| ---: | --- | --- | --- |'
  );
  for (const sourceId of report.preflight.orderedAssetSourceIds) {
    const asset = report.graph.assets.get(sourceId);
    if (!asset) {
      continue;
    }
    lines.push(
      `| ${asset.sequence} | ${escapeTableCell(asset.sourceId)} | ${escapeTableCell(asset.newId)} | ${escapeTableCell(asset.newName)} |`
    );
  }
  lines.push('');

  if (report.graph.removedLinks.length > 0) {
    lines.push(
      '## Removed Links',
      '',
      '| Source Entry | Path | Type | Target | Reason |',
      '| --- | --- | --- | --- | --- |'
    );
    for (const link of report.graph.removedLinks) {
      lines.push(
        `| ${escapeTableCell(link.sourceEntryId)} | ${escapeTableCell(link.path)} | ${link.kind} | ${escapeTableCell(link.targetId ?? '')} | ${escapeTableCell(link.reason)} |`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildEntryFieldsForClone(
  entry: EntityCloneEntry,
  seedSlug: string,
  entryIdMap: Map<string, string>,
  assetIdMap: Map<string, string>
): Record<string, Record<string, unknown>> {
  const fields = rewriteLinksInFields(entry.fields, entryIdMap, assetIdMap);
  const nameFieldIds = new Set(entry.role === 'root' ? ROOT_NAME_FIELD_IDS : NAME_FIELD_IDS);
  if (entry.displayField) {
    nameFieldIds.add(entry.displayField);
  }

  for (const fieldId of nameFieldIds) {
    setLocalizedStringIfPresent(fields, fieldId, entry.newName);
  }

  if (entry.role === 'root') {
    for (const fieldId of ROOT_SLUG_FIELD_IDS) {
      setLocalizedStringIfPresent(fields, fieldId, seedSlug);
    }
  }

  return fields;
}

function buildAssetFieldsForClone(
  asset: EntityCloneAsset
): Record<string, Record<string, unknown>> {
  const fields = cloneJson(asset.fields);
  setLocalizedStringIfPresent(fields, 'title', asset.newName);
  const files = fields.file ?? {};
  const copiedFiles: Record<string, unknown> = {};

  for (const [locale, rawFile] of Object.entries(files)) {
    const file = rawFile as Record<string, unknown>;
    const url = typeof file.url === 'string' ? file.url : file.upload;
    if (typeof url !== 'string') {
      copiedFiles[locale] = file;
      continue;
    }

    copiedFiles[locale] = {
      contentType: file.contentType,
      fileName: file.fileName,
      upload: normalizeAssetUrl(url)
    };
  }

  fields.file = copiedFiles;
  return fields;
}

function rewriteLinksInFields(
  sourceFields: Record<string, Record<string, unknown>>,
  entryIdMap: Map<string, string>,
  assetIdMap: Map<string, string>
): Record<string, Record<string, unknown>> {
  const fields = cloneJson(sourceFields);
  for (const [fieldId, localizedField] of Object.entries(fields)) {
    if (!localizedField || typeof localizedField !== 'object') {
      continue;
    }

    for (const [locale, rawValue] of Object.entries(localizedField)) {
      const rewritten = rewriteLinks(rawValue, entryIdMap, assetIdMap);
      if (rewritten === OMIT_LINK) {
        delete localizedField[locale];
      } else {
        localizedField[locale] = rewritten;
      }
    }

    if (Object.keys(localizedField).length === 0) {
      delete fields[fieldId];
    }
  }

  return fields;
}

function rewriteLinks(
  value: unknown,
  entryIdMap: Map<string, string>,
  assetIdMap: Map<string, string>
): unknown | typeof OMIT_LINK {
  if (Array.isArray(value)) {
    return value
      .map((item) => rewriteLinks(item, entryIdMap, assetIdMap))
      .filter((item) => item !== OMIT_LINK);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const object = value as Record<string, unknown>;
  const sys = object.sys;
  if (sys && typeof sys === 'object') {
    const link = sys as Record<string, unknown>;
    if (link.type === 'ResourceLink') {
      return OMIT_LINK;
    }

    if (link.type === 'Link' && typeof link.id === 'string') {
      if (link.linkType === 'Entry') {
        const mappedId = entryIdMap.get(link.id);
        if (!mappedId) {
          return OMIT_LINK;
        }
        return {
          ...object,
          sys: {
            ...link,
            id: mappedId
          }
        };
      }

      if (link.linkType === 'Asset') {
        const mappedId = assetIdMap.get(link.id);
        if (!mappedId) {
          return OMIT_LINK;
        }
        return {
          ...object,
          sys: {
            ...link,
            id: mappedId
          }
        };
      }
    }
  }

  const rewrittenObject: Record<string, unknown> = { ...object };
  const data = object.data;
  if (data && typeof data === 'object' && 'target' in data) {
    const rewrittenTarget = rewriteLinks(
      (data as Record<string, unknown>).target,
      entryIdMap,
      assetIdMap
    );
    if (rewrittenTarget === OMIT_LINK) {
      return OMIT_LINK;
    }
    rewrittenObject.data = {
      ...(data as Record<string, unknown>),
      target: rewrittenTarget
    };
  }

  for (const [key, nested] of Object.entries(object)) {
    if (key === 'data' && rewrittenObject.data) {
      continue;
    }

    const rewritten = rewriteLinks(nested, entryIdMap, assetIdMap);
    if (rewritten === OMIT_LINK) {
      delete rewrittenObject[key];
    } else {
      rewrittenObject[key] = rewritten;
    }
  }

  return rewrittenObject;
}

function collectFieldReferences(fields: Record<string, Record<string, unknown>>): FieldReference[] {
  const references: FieldReference[] = [];
  visit(fields, '$');
  return references;

  function visit(candidate: unknown, path: string): void {
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const object = candidate as Record<string, unknown>;
    const sys = object.sys;
    if (sys && typeof sys === 'object') {
      const link = sys as Record<string, unknown>;
      if (link.type === 'Link' && typeof link.id === 'string') {
        if (link.linkType === 'Entry') {
          references.push({ kind: 'entry', id: link.id, path });
          return;
        }
        if (link.linkType === 'Asset') {
          references.push({ kind: 'asset', id: link.id, path });
          return;
        }
      }
      if (link.type === 'ResourceLink') {
        references.push({ kind: 'resource', path });
        return;
      }
    }

    for (const [key, nested] of Object.entries(object)) {
      visit(nested, `${path}.${key}`);
    }
  }
}

function orderEntriesByDependencies(graph: EntityCloneGraph): {
  entrySourceIds: string[];
  issues: ValidationIssue[];
} {
  const ordered: string[] = [];
  const issues: ValidationIssue[] = [];
  const pending = new Map(graph.entries);
  const completed = new Set<string>();

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((entry) =>
      entry.linkedEntryIds.every((linkedEntryId) =>
        completed.has(linkedEntryId) || !pending.has(linkedEntryId)
      )
    );

    if (ready.length === 0) {
      const blocked = [...pending.keys()];
      issues.push({
        severity: 'error',
        code: 'CLONE_ENTRY_REFERENCE_CYCLE',
        message: `Unable to order cloned entries because the source graph contains a reference cycle: ${blocked.join(', ')}.`,
        details: blocked
      });
      break;
    }

    for (const entry of ready.sort(compareEntriesForClone)) {
      ordered.push(entry.sourceId);
      pending.delete(entry.sourceId);
      completed.add(entry.sourceId);
    }
  }

  return { entrySourceIds: ordered, issues };
}

function compareEntriesForClone(left: EntityCloneEntry, right: EntityCloneEntry): number {
  if (left.role !== right.role) {
    return left.role === 'child' ? -1 : 1;
  }
  return left.sequence - right.sequence || left.newId.localeCompare(right.newId);
}

function buildRootEntryId(
  sourceRootEntryId: string,
  contentType: string,
  seedName: string,
  seedSlug: string,
  conventions: ConventionsConfig
): string {
  const delimiterIndex = sourceRootEntryId.indexOf('--');
  if (delimiterIndex > 0) {
    return `${sourceRootEntryId.slice(0, delimiterIndex)}--${seedSlug}`;
  }

  return renderTemplate(conventions.naming.parentEntryIdPattern, {
    contentType,
    name: seedName,
    seedName,
    slug: seedSlug
  });
}

function buildChildEntryId(params: {
  sourceEntryId: string;
  sourceParentId: string;
  newParentId: string;
  contentType: string;
  sequence: number;
  conventions: ConventionsConfig;
}): string {
  if (params.sourceEntryId.startsWith(`${params.sourceParentId}--`)) {
    return toContentfulResourceId(
      `${params.newParentId}${params.sourceEntryId.slice(params.sourceParentId.length)}`
    );
  }

  const token = slugify(params.contentType) || 'entry';
  return toContentfulResourceId(
    `${params.newParentId}--${token}--${padIndex(params.sequence, params.conventions.naming.childIndexPadding)}`
  );
}

function buildAssetId(params: {
  sourceAssetId: string;
  sourceRootEntryId: string;
  newRootEntryId: string;
  sourceRootSlug?: string;
  seedSlug: string;
  sequence: number;
  conventions: ConventionsConfig;
}): string {
  const replacements: Array<[string, string]> = [
    [`asset--${params.sourceRootEntryId}--`, `asset--${params.newRootEntryId}--`]
  ];

  if (params.sourceRootSlug) {
    replacements.push([`asset--${params.sourceRootSlug}--`, `asset--${params.seedSlug}--`]);
  }

  const delimiterIndex = params.sourceRootEntryId.indexOf('--');
  if (delimiterIndex > 0) {
    const rootSuffix = params.sourceRootEntryId.slice(delimiterIndex + 2);
    replacements.push([`asset--${rootSuffix}--`, `asset--${params.seedSlug}--`]);
  }

  for (const [sourcePrefix, targetPrefix] of replacements) {
    if (params.sourceAssetId.startsWith(sourcePrefix)) {
      return toContentfulResourceId(
        `${targetPrefix}${params.sourceAssetId.slice(sourcePrefix.length)}`
      );
    }
  }

  return toContentfulResourceId(
    `asset--${params.seedSlug}--${padIndex(params.sequence, params.conventions.naming.childIndexPadding)}`
  );
}

function buildDerivedName(params: {
  seedName: string;
  sourceName?: string;
  sourceRootNameCandidates: string[];
  fallbackLabel: string;
  sequence: number;
  conventions: ConventionsConfig;
}): string {
  const sourceName = params.sourceName?.trim();
  if (sourceName) {
    const replaced = replaceFirstMatchingName(
      sourceName,
      params.sourceRootNameCandidates,
      params.seedName
    );
    if (replaced !== sourceName) {
      return replaced;
    }
  }

  return `${params.seedName} ${params.fallbackLabel} ${padIndex(params.sequence, params.conventions.naming.childIndexPadding)}`;
}

function replaceFirstMatchingName(
  value: string,
  candidates: string[],
  replacement: string
): string {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    const index = value.toLocaleLowerCase().indexOf(trimmed.toLocaleLowerCase());
    if (index >= 0) {
      return `${value.slice(0, index)}${replacement}${value.slice(index + trimmed.length)}`;
    }
  }

  return value;
}

async function getCachedEntry(
  context: ContentfulContext,
  entryId: string,
  cache: Map<string, any>
): Promise<any | undefined> {
  if (cache.has(entryId)) {
    return cache.get(entryId);
  }

  const entry = await getEntryIfExists(context, entryId);
  if (entry) {
    cache.set(entryId, entry);
  }
  return entry;
}

async function getDisplayField(
  context: ContentfulContext,
  contentType: string,
  cache: Map<string, string | undefined>
): Promise<string | undefined> {
  if (cache.has(contentType)) {
    return cache.get(contentType);
  }

  const contentTypeRecord = await context.environment.getContentType(contentType);
  const displayField = typeof contentTypeRecord?.displayField === 'string'
    ? contentTypeRecord.displayField
    : undefined;
  cache.set(contentType, displayField);
  return displayField;
}

function getEntryContentType(entry: any): string {
  const contentType = entry?.sys?.contentType?.sys?.id;
  if (typeof contentType !== 'string' || contentType.trim() === '') {
    throw new Error(`Entry ${String(entry?.sys?.id ?? '')} does not expose a content type ID.`);
  }
  return contentType;
}

function extractEntryName(
  fields: Record<string, Record<string, unknown>>,
  displayField?: string
): string | undefined {
  const candidates = [
    displayField,
    'internalName',
    'name',
    'title',
    'heading'
  ].filter((value): value is string => Boolean(value));

  for (const fieldId of candidates) {
    const value = firstLocalizedString(fields[fieldId]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function extractAssetName(fields: Record<string, Record<string, unknown>>): string | undefined {
  return firstLocalizedString(fields.title)
    ?? firstLocalizedString(fields.file);
}

function firstLocalizedString(localizedField: unknown): string | undefined {
  if (!localizedField || typeof localizedField !== 'object') {
    return undefined;
  }

  for (const value of Object.values(localizedField as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested.title === 'string' && nested.title.trim() !== '') {
        return nested.title;
      }
      if (typeof nested.fileName === 'string' && nested.fileName.trim() !== '') {
        return nested.fileName;
      }
    }
  }

  return undefined;
}

function setLocalizedStringIfPresent(
  fields: Record<string, Record<string, unknown>>,
  fieldId: string,
  value: string
): void {
  const localizedField = fields[fieldId];
  if (!localizedField || typeof localizedField !== 'object') {
    return;
  }

  for (const locale of Object.keys(localizedField)) {
    if (typeof localizedField[locale] === 'string') {
      localizedField[locale] = value;
    }
  }
}

function nextChildSequence(counters: Map<string, number>, parentSourceId: string): number {
  const next = (counters.get(parentSourceId) ?? 0) + 1;
  counters.set(parentSourceId, next);
  return next;
}

function isBoundaryContentType(contentType: string): boolean {
  return contentType.toLocaleLowerCase().endsWith('page');
}

function findDuplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return duplicates;
}

function appendAssetFileIssues(
  issues: ValidationIssue[],
  assetId: string,
  fileFields: Record<string, unknown>
): void {
  if (Object.keys(fileFields).length === 0) {
    issues.push({
      severity: 'error',
      code: 'SOURCE_ASSET_FILE_MISSING',
      message: `Source asset ${assetId} does not have file fields to copy.`,
      documentId: assetId
    });
    return;
  }

  for (const [locale, value] of Object.entries(fileFields)) {
    const file = value as Record<string, unknown>;
    if (!file?.url && !file?.upload) {
      issues.push({
        severity: 'error',
        code: 'SOURCE_ASSET_FILE_NOT_AVAILABLE',
        message: `Source asset ${assetId} does not have a processed file URL for locale ${locale}.`,
        documentId: assetId
      });
    }
  }
}

function normalizeAssetUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

async function waitForProcessedAsset(
  context: ContentfulContext,
  assetId: string,
  attempts = 15
): Promise<any> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const asset = await getAssetIfExists(context, assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} disappeared during processing.`);
    }
    if (assetHasProcessedFiles(asset)) {
      return asset;
    }
    await delay(1000);
  }

  throw new Error(`Timed out waiting for asset ${assetId} to finish processing.`);
}

function assetHasProcessedFiles(asset: any): boolean {
  const files = asset?.fields?.file;
  if (!files || typeof files !== 'object') {
    return false;
  }

  return Object.values(files).every((rawFile) => {
    const file = rawFile as Record<string, unknown>;
    return typeof file.url === 'string' && file.url.length > 0;
  });
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .toLocaleLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toLocaleUpperCase());
}

function humanizeSlug(value: string): string {
  return humanizeIdentifier(value);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
