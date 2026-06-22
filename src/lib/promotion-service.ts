import { setTimeout as delay } from 'node:timers/promises';

import {
  getAssetIfExists,
  getEntryIfExists,
  getExistingAssetIds,
  getExistingEntryIds,
  getTags
} from './contentful-client.js';
import type { ContentfulContext } from './contentful-client.js';
import type { ValidationIssue } from './types.js';

export interface PromotionOptions {
  allowOverwrite: boolean;
  reuseExistingDependencies: boolean;
  requirePublishedSource: boolean;
  includeDrafts: boolean;
  allowDirtyTargetReuse: boolean;
  overwriteUnpublishedTargetDependencies: boolean;
  uniqueFields: string[];
}

export interface PromotionGraph {
  rootEntryIds: string[];
  entries: Map<string, PromotionEntry>;
  assets: Map<string, PromotionAsset>;
  externalResourceLinks: ExternalResourceLink[];
  issues: ValidationIssue[];
}

export interface PromotionEntry {
  id: string;
  contentType: string;
  fields: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  linkedEntryIds: string[];
  linkedAssetIds: string[];
  role: 'root' | 'dependency';
  referenceBoundary: boolean;
  sourceState: PublicationState;
}

export interface PromotionAsset {
  id: string;
  fields: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  sourceState: PublicationState;
}

export interface PublicationState {
  published: boolean;
  updated: boolean;
  archived: boolean;
}

export interface ExternalResourceLink {
  path: string;
  value: unknown;
}

export interface PromotionPreflight {
  passed: boolean;
  issues: ValidationIssue[];
  operations: PromotionOperations;
  orderedEntryIds: string[];
  orderedAssetIds: string[];
}

export interface PromotionOperations {
  entries: PromotionEntryOperation[];
  assets: PromotionAssetOperation[];
}

export interface PromotionEntryOperation {
  entryId: string;
  contentType: string;
  role: PromotionEntry['role'];
  action: 'create' | 'update' | 'reuse' | 'skip' | 'blocked';
  reason?: string;
}

export interface PromotionAssetOperation {
  assetId: string;
  action: 'create' | 'update' | 'reuse' | 'blocked';
  reason?: string;
}

export interface PromotionExecutionResult {
  createdEntries: string[];
  updatedEntries: string[];
  reusedEntries: string[];
  skippedEntries: string[];
  draftEntries: string[];
  publishedEntries: string[];
  createdAssets: string[];
  updatedAssets: string[];
  reusedAssets: string[];
  draftAssets: string[];
  publishedAssets: string[];
}

export class PromotionExecutionFailure extends Error {
  constructor(
    message: string,
    readonly result: PromotionExecutionResult
  ) {
    super(message);
    this.name = 'PromotionExecutionFailure';
  }
}

interface CollectedReferences {
  entryIds: Set<string>;
  assetIds: Set<string>;
  externalResourceLinks: ExternalResourceLink[];
}

interface UniqueValue {
  entryId: string;
  contentType: string;
  fieldId: string;
  locale: string;
  value: string;
}

const DEFAULT_PAGE_SIZE = 100;
const OMIT_SKIPPED_LINK = Symbol('omitSkippedEntryLink');

export async function collectPromotionGraph(
  source: ContentfulContext,
  rootEntryIds: string[],
  options: Pick<PromotionOptions, 'requirePublishedSource'>
): Promise<PromotionGraph> {
  const uniqueRootIds = [...new Set(rootEntryIds.map((id) => id.trim()).filter(Boolean))];
  const entries = new Map<string, PromotionEntry>();
  const assets = new Map<string, PromotionAsset>();
  const queuedEntryIds = [...uniqueRootIds];
  const queuedAssetIds: string[] = [];
  const queuedEntrySet = new Set(queuedEntryIds);
  const queuedAssetSet = new Set<string>();
  const externalResourceLinks: ExternalResourceLink[] = [];
  const issues: ValidationIssue[] = [];

  while (queuedEntryIds.length > 0) {
    const entryId = queuedEntryIds.shift();
    if (!entryId || entries.has(entryId)) {
      continue;
    }

    const sourceEntry = await getEntryIfExists(source, entryId);
    if (!sourceEntry) {
      issues.push({
        severity: 'error',
        code: 'SOURCE_ENTRY_MISSING',
        message: `Source entry ${entryId} was not found in ${source.environmentId}.`,
        documentId: entryId
      });
      continue;
    }

    const contentType = String(sourceEntry.sys?.contentType?.sys?.id ?? '');
    const role = uniqueRootIds.includes(entryId) ? 'root' : 'dependency';
    const referenceBoundary = role === 'dependency' && isPageReferenceContentType(contentType);
    const sourceState = getPublicationState(sourceEntry);
    if (!referenceBoundary) {
      appendSourceStateIssues(issues, 'entry', entryId, sourceState, options.requirePublishedSource);
    }

    const references = referenceBoundary ? emptyReferences() : collectReferences(sourceEntry.fields);
    externalResourceLinks.push(...references.externalResourceLinks);
    if (!referenceBoundary) {
      for (const linkedEntryId of references.entryIds) {
        if (!entries.has(linkedEntryId) && !queuedEntrySet.has(linkedEntryId)) {
          queuedEntryIds.push(linkedEntryId);
          queuedEntrySet.add(linkedEntryId);
        }
      }
      for (const linkedAssetId of references.assetIds) {
        if (!assets.has(linkedAssetId) && !queuedAssetSet.has(linkedAssetId)) {
          queuedAssetIds.push(linkedAssetId);
          queuedAssetSet.add(linkedAssetId);
        }
      }
    }

    entries.set(entryId, {
      id: entryId,
      contentType,
      fields: cloneJson(sourceEntry.fields ?? {}),
      metadata: cloneJson(sourceEntry.metadata ?? {}),
      linkedEntryIds: [...references.entryIds],
      linkedAssetIds: [...references.assetIds],
      role,
      referenceBoundary,
      sourceState
    });
  }

  while (queuedAssetIds.length > 0) {
    const assetId = queuedAssetIds.shift();
    if (!assetId || assets.has(assetId)) {
      continue;
    }

    const sourceAsset = await getAssetIfExists(source, assetId);
    if (!sourceAsset) {
      issues.push({
        severity: 'error',
        code: 'SOURCE_ASSET_MISSING',
        message: `Source asset ${assetId} was referenced but not found in ${source.environmentId}.`,
        documentId: assetId
      });
      continue;
    }

    const sourceState = getPublicationState(sourceAsset);
    appendSourceStateIssues(issues, 'asset', assetId, sourceState, options.requirePublishedSource);
    appendAssetFileIssues(issues, assetId, sourceAsset.fields?.file ?? {});

    assets.set(assetId, {
      id: assetId,
      fields: cloneJson(sourceAsset.fields ?? {}),
      metadata: cloneJson(sourceAsset.metadata ?? {}),
      sourceState
    });
  }

  if (externalResourceLinks.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'EXTERNAL_RESOURCE_LINKS_NOT_MIGRATED',
      message: `${externalResourceLinks.length} ResourceLink value(s) were found. They will be preserved as field values but not copied as local dependencies.`,
      details: externalResourceLinks.slice(0, 25)
    });
  }

  return {
    rootEntryIds: uniqueRootIds,
    entries,
    assets,
    externalResourceLinks,
    issues
  };
}

export async function preflightPromotion(
  target: ContentfulContext,
  graph: PromotionGraph,
  options: PromotionOptions
): Promise<PromotionPreflight> {
  const entryIds = [...graph.entries.keys()];
  const assetIds = [...graph.assets.keys()];
  const existingEntryIds = await getExistingEntryIds(target, entryIds);
  const existingAssetIds = await getExistingAssetIds(target, assetIds);

  const allEntryOperations: PromotionEntryOperation[] = [];
  for (const entry of graph.entries.values()) {
    const exists = existingEntryIds.has(entry.id);
    if (entry.referenceBoundary) {
      allEntryOperations.push(
        await resolveBoundaryPageOperation(
          target,
          entry,
          exists,
          options.allowDirtyTargetReuse
        )
      );
      continue;
    }

    if (exists && !options.allowOverwrite) {
      if (options.reuseExistingDependencies && entry.role === 'dependency') {
        allEntryOperations.push(
          await resolveExistingDependencyEntryOperation(
            target,
            entry,
            options.overwriteUnpublishedTargetDependencies
          )
        );
        continue;
      }

      allEntryOperations.push({
        entryId: entry.id,
        contentType: entry.contentType,
        role: entry.role,
        action: 'blocked' as const,
        reason: 'Entry ID already exists in target.'
      });
      continue;
    }

    allEntryOperations.push({
      entryId: entry.id,
      contentType: entry.contentType,
      role: entry.role,
      action: exists ? 'update' as const : 'create' as const
    });
  }

  const allAssetOperations: PromotionAssetOperation[] = [];
  for (const asset of graph.assets.values()) {
    const exists = existingAssetIds.has(asset.id);
    if (exists && !options.allowOverwrite) {
      if (options.reuseExistingDependencies) {
        allAssetOperations.push(
          await resolveExistingDependencyAssetOperation(
            target,
            asset,
            options.overwriteUnpublishedTargetDependencies
          )
        );
        continue;
      }

      allAssetOperations.push({
        assetId: asset.id,
        action: 'blocked' as const,
        reason: 'Asset ID already exists in target.'
      });
      continue;
    }

    allAssetOperations.push({
      assetId: asset.id,
      action: exists ? 'update' as const : 'create' as const
    });
  }

  const requiredIds = determineRequiredPromotionIds(graph, allEntryOperations);
  const effectiveGraph = filterPromotionGraph(graph, requiredIds);
  const entryOperations = allEntryOperations.filter((operation) =>
    requiredIds.entryIds.has(operation.entryId)
  );
  const assetOperations = allAssetOperations.filter((operation) =>
    requiredIds.assetIds.has(operation.assetId)
  );
  const reusedIds = collectOperationIds(entryOperations, assetOperations, 'reuse');
  const skippedIds = collectOperationIds(entryOperations, assetOperations, 'skip');
  const copiedIds = collectOperationIds(entryOperations, assetOperations, ['create', 'update', 'blocked']);
  const copiedGraph = filterPromotionGraph(effectiveGraph, copiedIds);
  const issues: ValidationIssue[] = filterGraphIssues(
    graph.issues,
    requiredIds,
    mergeCollectedIds(reusedIds, skippedIds)
  );
  const orderGraph = filterPromotionGraph(
    effectiveGraph,
    collectOperationIds(entryOperations, assetOperations, ['create', 'update', 'reuse', 'blocked'])
  );
  const orderResult = orderEntriesByDependencies(orderGraph);
  const contentTypeIssues = await checkTargetContentTypes(target, [...copiedGraph.entries.values()]);
  const localeIssues = await checkTargetLocales(target, copiedGraph);
  const tagIssues = await checkTargetTags(target, copiedGraph);
  const uniqueFieldIssues = await checkUniqueFieldCollisions(
    target,
    copiedGraph,
    options.uniqueFields,
    collectIgnoredTargetEntryIds(entryOperations)
  );
  const reusedTargetIssues = await checkReusableTargetEntities(
    target,
    effectiveGraph,
    entryOperations,
    assetOperations,
    options.allowDirtyTargetReuse
  );

  issues.push(
    ...contentTypeIssues,
    ...localeIssues,
    ...tagIssues,
    ...uniqueFieldIssues,
    ...reusedTargetIssues,
    ...buildSkippedBoundaryWarnings(entryOperations)
  );
  issues.push(...orderResult.issues);

  for (const operation of entryOperations) {
    if (operation.action === 'blocked') {
      issues.push({
        severity: 'error',
        code: 'TARGET_ENTRY_ID_COLLISION',
        message: `Target already contains entry ${operation.entryId}. Re-run with --allow-overwrite only if replacing it is intentional.`,
        documentId: operation.entryId
      });
    }
  }

  for (const operation of assetOperations) {
    if (operation.action === 'blocked') {
      issues.push({
        severity: 'error',
        code: 'TARGET_ASSET_ID_COLLISION',
        message: `Target already contains asset ${operation.assetId}. Re-run with --allow-overwrite only if replacing it is intentional.`,
        documentId: operation.assetId
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
    orderedEntryIds: orderResult.entryIds,
    orderedAssetIds: [...effectiveGraph.assets.keys()]
  };
}

async function resolveExistingDependencyEntryOperation(
  target: ContentfulContext,
  entry: PromotionEntry,
  overwriteUnpublishedTargetDependencies: boolean
): Promise<PromotionEntryOperation> {
  const reuseOperation: PromotionEntryOperation = {
    entryId: entry.id,
    contentType: entry.contentType,
    role: entry.role,
    action: 'reuse',
    reason: 'Existing target dependency will be reused without overwriting.'
  };

  if (!overwriteUnpublishedTargetDependencies) {
    return reuseOperation;
  }

  const targetEntry = await getEntryIfExists(target, entry.id);
  if (!targetEntry) {
    return reuseOperation;
  }

  const targetContentType = String(targetEntry.sys?.contentType?.sys?.id ?? '');
  const state = getPublicationState(targetEntry);
  if (!state.archived && !state.published && targetContentType === entry.contentType) {
    return {
      entryId: entry.id,
      contentType: entry.contentType,
      role: entry.role,
      action: 'update',
      reason: 'Existing unpublished target dependency will be overwritten from source.'
    };
  }

  return reuseOperation;
}

async function resolveExistingDependencyAssetOperation(
  target: ContentfulContext,
  asset: PromotionAsset,
  overwriteUnpublishedTargetDependencies: boolean
): Promise<PromotionAssetOperation> {
  const reuseOperation: PromotionAssetOperation = {
    assetId: asset.id,
    action: 'reuse',
    reason: 'Existing target asset dependency will be reused without overwriting.'
  };

  if (!overwriteUnpublishedTargetDependencies) {
    return reuseOperation;
  }

  const targetAsset = await getAssetIfExists(target, asset.id);
  if (!targetAsset) {
    return reuseOperation;
  }

  const state = getPublicationState(targetAsset);
  if (!state.archived && !state.published) {
    return {
      assetId: asset.id,
      action: 'update',
      reason: 'Existing unpublished target asset dependency will be overwritten from source.'
    };
  }

  return reuseOperation;
}

async function resolveBoundaryPageOperation(
  target: ContentfulContext,
  entry: PromotionEntry,
  exists: boolean,
  allowDirtyTargetReuse: boolean
): Promise<PromotionEntryOperation> {
  const operation = {
    entryId: entry.id,
    contentType: entry.contentType,
    role: entry.role
  };

  if (!exists) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: 'linked page does not exist cleanly in target'
    };
  }

  const targetEntry = await getEntryIfExists(target, entry.id);
  if (!targetEntry) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: 'linked page could not be fetched from target'
    };
  }

  const targetContentType = String(targetEntry.sys?.contentType?.sys?.id ?? '');
  if (targetContentType !== entry.contentType) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: `target entry is ${targetContentType}, not ${entry.contentType}`
    };
  }

  const state = getPublicationState(targetEntry);
  if (state.archived) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: 'target page is archived'
    };
  }
  if (!state.published) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: 'target page is not published'
    };
  }
  if (state.updated && !allowDirtyTargetReuse) {
    return {
      ...operation,
      action: 'skip' as const,
      reason: 'target page has unpublished changes'
    };
  }

  return {
    ...operation,
    action: 'reuse' as const,
    reason: state.updated
      ? 'Existing target page dependency will be reused from its currently published version as a reference-only link.'
      : 'Existing clean target page dependency will be reused as a reference-only link.'
  };
}

function buildSkippedBoundaryWarnings(
  entryOperations: PromotionEntryOperation[]
): ValidationIssue[] {
  return entryOperations
    .filter((operation) => operation.action === 'skip')
    .map((operation) => ({
      severity: 'warning' as const,
      code: 'TARGET_BOUNDARY_PAGE_LINK_SKIPPED',
      message: `Linked page ${operation.entryId} will be removed from copied fields because ${operation.reason}.`,
      documentId: operation.entryId,
      details: {
        entryId: operation.entryId,
        contentType: operation.contentType,
        reason: operation.reason
      }
    }));
}

export async function executePromotion(
  target: ContentfulContext,
  graph: PromotionGraph,
  preflight: PromotionPreflight,
  options: PromotionOptions
): Promise<PromotionExecutionResult> {
  if (!preflight.passed) {
    throw new Error('Cannot execute promotion because preflight has errors.');
  }

  const result: PromotionExecutionResult = {
    createdEntries: [],
    updatedEntries: [],
    reusedEntries: [],
    skippedEntries: preflight.operations.entries
      .filter((operation) => operation.action === 'skip')
      .map((operation) => operation.entryId),
    draftEntries: [],
    publishedEntries: [],
    createdAssets: [],
    updatedAssets: [],
    reusedAssets: [],
    draftAssets: [],
    publishedAssets: []
  };
  const entryOperationById = new Map(
    preflight.operations.entries.map((operation) => [operation.entryId, operation])
  );
  const assetOperationById = new Map(
    preflight.operations.assets.map((operation) => [operation.assetId, operation])
  );
  const skippedEntryIds = new Set(result.skippedEntries);

  try {
    for (const assetId of preflight.orderedAssetIds) {
      const asset = graph.assets.get(assetId);
      if (!asset) {
        continue;
      }
      const operation = assetOperationById.get(assetId);
      if (operation?.action === 'reuse') {
        result.reusedAssets.push(assetId);
        continue;
      }

      const copied = await upsertAssetFromSource(
        target,
        asset,
        options.allowOverwrite || operation?.action === 'update'
      );
      if (operation?.action === 'update') {
        result.updatedAssets.push(assetId);
      } else {
        result.createdAssets.push(assetId);
      }
      const processed = await waitForProcessedAsset(target, copied.sys.id);
      if (options.includeDrafts) {
        result.draftAssets.push(processed.sys.id);
        continue;
      }
      const published = await processed.publish();
      result.publishedAssets.push(published.sys.id);
    }

    for (const entryId of preflight.orderedEntryIds) {
      const entry = graph.entries.get(entryId);
      if (!entry) {
        continue;
      }
      const operation = entryOperationById.get(entryId);
      if (operation?.action === 'reuse') {
        result.reusedEntries.push(entryId);
        continue;
      }
      if (operation?.action === 'skip') {
        continue;
      }

      await upsertEntryFromSource(
        target,
        entry,
        options.allowOverwrite || operation?.action === 'update',
        skippedEntryIds
      );
      if (operation?.action === 'update') {
        result.updatedEntries.push(entryId);
      } else {
        result.createdEntries.push(entryId);
      }
    }

    for (const entryId of preflight.orderedEntryIds) {
      const operation = entryOperationById.get(entryId);
      if (operation?.action === 'reuse' || operation?.action === 'skip') {
        continue;
      }

      const targetEntry = await getEntryIfExists(target, entryId);
      if (!targetEntry) {
        throw new Error(`Target entry ${entryId} was not found after copy.`);
      }
      if (options.includeDrafts) {
        result.draftEntries.push(targetEntry.sys.id);
        continue;
      }
      const published = await targetEntry.publish();
      result.publishedEntries.push(published.sys.id);
    }
  } catch (error) {
    throw new PromotionExecutionFailure(
      error instanceof Error ? error.message : String(error),
      result
    );
  }

  return result;
}

export function renderPromotionMarkdownReport(report: {
  mode: 'dry-run' | 'upload';
  source: { spaceId: string; environmentId: string };
  target: { spaceId: string; environmentId: string };
  rootEntryIds: string[];
  options: Pick<PromotionOptions, 'includeDrafts'>;
  preflight: PromotionPreflight;
  execution?: PromotionExecutionResult;
}): string {
  const errors = report.preflight.issues.filter((issue) => issue.severity === 'error');
  const warnings = report.preflight.issues.filter((issue) => issue.severity === 'warning');
  const createdEntries = report.preflight.operations.entries.filter((entry) => entry.action === 'create').length;
  const updatedEntries = report.preflight.operations.entries.filter((entry) => entry.action === 'update').length;
  const reusedEntries = report.preflight.operations.entries.filter((entry) => entry.action === 'reuse').length;
  const skippedEntries = report.preflight.operations.entries.filter((entry) => entry.action === 'skip').length;
  const createdAssets = report.preflight.operations.assets.filter((asset) => asset.action === 'create').length;
  const updatedAssets = report.preflight.operations.assets.filter((asset) => asset.action === 'update').length;
  const reusedAssets = report.preflight.operations.assets.filter((asset) => asset.action === 'reuse').length;
  const blockedEntries = report.preflight.operations.entries.filter((entry) => entry.action === 'blocked').length;
  const blockedAssets = report.preflight.operations.assets.filter((asset) => asset.action === 'blocked').length;

  const lines = [
    `# Content Promotion ${report.mode === 'upload' ? 'Upload' : 'Dry Run'} Report`,
    '',
    `- Source: ${report.source.spaceId}/${report.source.environmentId}`,
    `- Target: ${report.target.spaceId}/${report.target.environmentId}`,
    `- Root entries: ${report.rootEntryIds.join(', ')}`,
    `- Include drafts: ${report.options.includeDrafts ? 'yes' : 'no'}`,
    `- Preflight passed: ${report.preflight.passed ? 'yes' : 'no'}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Planned Operations',
    '',
    `- Entries to create: ${createdEntries}`,
    `- Entries to update: ${updatedEntries}`,
    `- Entries to reuse: ${reusedEntries}`,
    `- Entry links to skip: ${skippedEntries}`,
    `- Entries blocked: ${blockedEntries}`,
    `- Assets to create: ${createdAssets}`,
    `- Assets to update: ${updatedAssets}`,
    `- Assets to reuse: ${reusedAssets}`,
    `- Assets blocked: ${blockedAssets}`,
    ''
  ];

  if (report.execution) {
    lines.push(
      '## Executed Operations',
      '',
      `- Created entries: ${report.execution.createdEntries.length}`,
      `- Updated entries: ${report.execution.updatedEntries.length}`,
      `- Reused entries: ${report.execution.reusedEntries.length}`,
      `- Skipped entry links: ${report.execution.skippedEntries.length}`,
      `- Draft entries: ${report.execution.draftEntries.length}`,
      `- Published entries: ${report.execution.publishedEntries.length}`,
      `- Created assets: ${report.execution.createdAssets.length}`,
      `- Updated assets: ${report.execution.updatedAssets.length}`,
      `- Reused assets: ${report.execution.reusedAssets.length}`,
      `- Draft assets: ${report.execution.draftAssets.length}`,
      `- Published assets: ${report.execution.publishedAssets.length}`,
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

  lines.push('## Entry Order', '');
  for (const entryId of report.preflight.orderedEntryIds) {
    lines.push(`- ${entryId}`);
  }

  lines.push('', '## Asset Order', '');
  for (const assetId of report.preflight.orderedAssetIds) {
    lines.push(`- ${assetId}`);
  }

  return `${lines.join('\n')}\n`;
}

function collectReferences(value: unknown, path = '$'): CollectedReferences {
  const entryIds = new Set<string>();
  const assetIds = new Set<string>();
  const externalResourceLinks: ExternalResourceLink[] = [];

  visit(value, path);

  return {
    entryIds,
    assetIds,
    externalResourceLinks
  };

  function visit(candidate: unknown, currentPath: string): void {
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }

    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const object = candidate as Record<string, unknown>;
    const sys = object.sys;
    if (sys && typeof sys === 'object') {
      const link = sys as Record<string, unknown>;
      if (link.type === 'Link' && link.id && typeof link.id === 'string') {
        if (link.linkType === 'Entry') {
          entryIds.add(link.id);
          return;
        }
        if (link.linkType === 'Asset') {
          assetIds.add(link.id);
          return;
        }
      }

      if (link.type === 'ResourceLink') {
        externalResourceLinks.push({
          path: currentPath,
          value: cloneJson(candidate)
        });
        return;
      }
    }

    for (const [key, nested] of Object.entries(object)) {
      visit(nested, `${currentPath}.${key}`);
    }
  }
}

function emptyReferences(): CollectedReferences {
  return {
    entryIds: new Set<string>(),
    assetIds: new Set<string>(),
    externalResourceLinks: []
  };
}

function isPageReferenceContentType(contentType: string): boolean {
  return contentType.toLocaleLowerCase().endsWith('page');
}

function getPublicationState(entity: any): PublicationState {
  const published = callBoolean(entity, 'isPublished') ?? Boolean(entity?.sys?.publishedVersion);
  const updated = callBoolean(entity, 'isUpdated') ?? isUpdatedFromSys(entity?.sys);
  const archived = callBoolean(entity, 'isArchived') ?? Boolean(entity?.sys?.archivedVersion);

  return {
    published,
    updated,
    archived
  };
}

function callBoolean(entity: any, methodName: string): boolean | undefined {
  const value = entity?.[methodName];
  if (typeof value !== 'function') {
    return undefined;
  }
  return Boolean(value.call(entity));
}

function isUpdatedFromSys(sys: any): boolean {
  const version = Number(sys?.version ?? 0);
  const publishedVersion = Number(sys?.publishedVersion ?? 0);
  return publishedVersion > 0 && version > publishedVersion + 1;
}

function appendSourceStateIssues(
  issues: ValidationIssue[],
  kind: 'entry' | 'asset',
  id: string,
  state: PublicationState,
  requirePublishedSource: boolean
): void {
  if (state.archived) {
    issues.push({
      severity: 'error',
      code: `SOURCE_${kind.toUpperCase()}_ARCHIVED`,
      message: `Source ${kind} ${id} is archived and cannot be promoted safely.`,
      documentId: id
    });
    return;
  }

  if (!requirePublishedSource) {
    return;
  }

  if (!state.published) {
    issues.push({
      severity: 'error',
      code: `SOURCE_${kind.toUpperCase()}_UNPUBLISHED`,
      message: `Source ${kind} ${id} is not published in UAT. Publish it before promotion or pass --allow-source-drafts.`,
      documentId: id
    });
  }

  if (state.updated) {
    issues.push({
      severity: 'error',
      code: `SOURCE_${kind.toUpperCase()}_HAS_UNPUBLISHED_CHANGES`,
      message: `Source ${kind} ${id} has unpublished changes in UAT. Publish or discard those changes before promotion.`,
      documentId: id
    });
  }
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

async function checkTargetContentTypes(
  target: ContentfulContext,
  entries: PromotionEntry[]
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const contentTypes = [...new Set(entries.map((entry) => entry.contentType).filter(Boolean))];

  for (const contentType of contentTypes) {
    try {
      await target.environment.getContentType(contentType);
    } catch (error) {
      if (isNotFoundError(error)) {
        issues.push({
          severity: 'error',
          code: 'TARGET_CONTENT_TYPE_MISSING',
          message: `Target environment does not contain content type ${contentType}.`
        });
        continue;
      }
      throw error;
    }
  }

  return issues;
}

async function checkTargetLocales(
  target: ContentfulContext,
  graph: PromotionGraph
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const targetLocales = await getTargetLocaleCodes(target);
  const sourceLocales = new Set<string>();

  for (const entry of graph.entries.values()) {
    collectFieldLocales(entry.fields, sourceLocales);
  }
  for (const asset of graph.assets.values()) {
    collectFieldLocales(asset.fields, sourceLocales);
  }

  for (const locale of sourceLocales) {
    if (!targetLocales.has(locale)) {
      issues.push({
        severity: 'error',
        code: 'TARGET_LOCALE_MISSING',
        message: `Target environment does not contain source locale ${locale}.`
      });
    }
  }

  return issues;
}

async function getTargetLocaleCodes(target: ContentfulContext): Promise<Set<string>> {
  const response = await target.environment.getLocales();
  const items = Array.isArray(response?.items) ? response.items : [];
  return new Set(
    items
      .map((item: any) => item?.code)
      .filter((code: unknown): code is string => typeof code === 'string')
  );
}

function collectFieldLocales(
  fields: Record<string, Record<string, unknown>>,
  locales: Set<string>
): void {
  for (const localizedField of Object.values(fields)) {
    if (!localizedField || typeof localizedField !== 'object') {
      continue;
    }
    for (const locale of Object.keys(localizedField)) {
      locales.add(locale);
    }
  }
}

async function checkTargetTags(
  target: ContentfulContext,
  graph: PromotionGraph
): Promise<ValidationIssue[]> {
  const referencedTags = new Set<string>();
  for (const entry of graph.entries.values()) {
    collectMetadataLinkIds(entry.metadata, 'Tag', referencedTags);
  }
  for (const asset of graph.assets.values()) {
    collectMetadataLinkIds(asset.metadata, 'Tag', referencedTags);
  }

  if (referencedTags.size === 0) {
    return [];
  }

  const targetTagIds = new Set((await getTags(target)).map((tag) => tag.id));
  return [...referencedTags]
    .filter((tagId) => !targetTagIds.has(tagId))
    .map((tagId) => ({
      severity: 'error' as const,
      code: 'TARGET_TAG_MISSING',
      message: `Target environment is missing tag ${tagId}, which is referenced by source metadata.`
    }));
}

function collectMetadataLinkIds(
  value: unknown,
  linkType: string,
  output: Set<string>
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMetadataLinkIds(item, linkType, output);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const object = value as Record<string, unknown>;
  const sys = object.sys;
  if (sys && typeof sys === 'object') {
    const link = sys as Record<string, unknown>;
    if (link.type === 'Link' && link.linkType === linkType && typeof link.id === 'string') {
      output.add(link.id);
      return;
    }
  }

  for (const nested of Object.values(object)) {
    collectMetadataLinkIds(nested, linkType, output);
  }
}

async function checkReusableTargetEntities(
  target: ContentfulContext,
  graph: PromotionGraph,
  entryOperations: PromotionEntryOperation[],
  assetOperations: PromotionAssetOperation[],
  allowDirtyTargetReuse: boolean
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const reusedEntryIds = entryOperations
    .filter((operation) => operation.action === 'reuse')
    .map((operation) => operation.entryId);
  const reusedAssetIds = assetOperations
    .filter((operation) => operation.action === 'reuse')
    .map((operation) => operation.assetId);

  for (const entryId of reusedEntryIds) {
    const sourceEntry = graph.entries.get(entryId);
    const targetEntry = await getEntryIfExists(target, entryId);
    if (!targetEntry) {
      issues.push({
        severity: 'error',
        code: 'TARGET_REUSED_ENTRY_MISSING',
        message: `Target entry ${entryId} was selected for reuse but could not be fetched.`,
        documentId: entryId
      });
      continue;
    }

    const targetContentType = String(targetEntry.sys?.contentType?.sys?.id ?? '');
    if (sourceEntry && targetContentType !== sourceEntry.contentType) {
      issues.push({
        severity: 'error',
        code: 'TARGET_REUSED_ENTRY_CONTENT_TYPE_MISMATCH',
        message: `Target entry ${entryId} cannot be reused because it is ${targetContentType}, not ${sourceEntry.contentType}.`,
        documentId: entryId
      });
    }

    appendReuseStateIssues(
      issues,
      'entry',
      entryId,
      getPublicationState(targetEntry),
      allowDirtyTargetReuse
    );
  }

  for (const assetId of reusedAssetIds) {
    const targetAsset = await getAssetIfExists(target, assetId);
    if (!targetAsset) {
      issues.push({
        severity: 'error',
        code: 'TARGET_REUSED_ASSET_MISSING',
        message: `Target asset ${assetId} was selected for reuse but could not be fetched.`,
        documentId: assetId
      });
      continue;
    }

    appendReuseStateIssues(
      issues,
      'asset',
      assetId,
      getPublicationState(targetAsset),
      allowDirtyTargetReuse
    );
    appendTargetReusableAssetFileIssues(issues, assetId, targetAsset.fields?.file ?? {});
  }

  return issues;
}

function appendReuseStateIssues(
  issues: ValidationIssue[],
  kind: 'entry' | 'asset',
  id: string,
  state: PublicationState,
  allowDirtyTargetReuse: boolean
): void {
  if (state.archived) {
    issues.push({
      severity: 'error',
      code: `TARGET_REUSED_${kind.toUpperCase()}_ARCHIVED`,
      message: `Target ${kind} ${id} cannot be reused because it is archived.`,
      documentId: id
    });
    return;
  }

  if (!state.published) {
    issues.push({
      severity: 'error',
      code: `TARGET_REUSED_${kind.toUpperCase()}_UNPUBLISHED`,
      message: `Target ${kind} ${id} cannot be reused because it is not published.`,
      documentId: id
    });
  }

  if (state.updated) {
    if (allowDirtyTargetReuse) {
      issues.push({
        severity: 'warning',
        code: `TARGET_REUSED_${kind.toUpperCase()}_HAS_UNPUBLISHED_CHANGES`,
        message: `Target ${kind} ${id} will be reused from its currently published version even though it has unpublished changes in the target environment.`,
        documentId: id
      });
      return;
    }

    issues.push({
      severity: 'error',
      code: `TARGET_REUSED_${kind.toUpperCase()}_HAS_UNPUBLISHED_CHANGES`,
      message: `Target ${kind} ${id} cannot be reused because it has unpublished changes. Re-run with --allow-dirty-target-reuse only if linking to the currently published target version is intentional.`,
      documentId: id
    });
  }
}

function appendTargetReusableAssetFileIssues(
  issues: ValidationIssue[],
  assetId: string,
  fileFields: Record<string, unknown>
): void {
  if (Object.keys(fileFields).length === 0) {
    issues.push({
      severity: 'error',
      code: 'TARGET_REUSED_ASSET_FILE_MISSING',
      message: `Target asset ${assetId} cannot be reused because it does not have file fields.`,
      documentId: assetId
    });
    return;
  }

  for (const [locale, value] of Object.entries(fileFields)) {
    const file = value as Record<string, unknown>;
    if (!file?.url) {
      issues.push({
        severity: 'error',
        code: 'TARGET_REUSED_ASSET_FILE_NOT_AVAILABLE',
        message: `Target asset ${assetId} cannot be reused because locale ${locale} does not have a processed file URL.`,
        documentId: assetId
      });
    }
  }
}

async function checkUniqueFieldCollisions(
  target: ContentfulContext,
  graph: PromotionGraph,
  uniqueFields: string[],
  ignoredTargetEntryIds: Set<string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const sourceValues = collectUniqueValues(graph, uniqueFields);
  const sourceValuesByKey = new Map<string, UniqueValue[]>();

  if (sourceValues.length === 0) {
    return [];
  }

  for (const sourceValue of sourceValues) {
    const key = uniqueValueKey(sourceValue);
    const group = sourceValuesByKey.get(key) ?? [];
    group.push(sourceValue);
    sourceValuesByKey.set(key, group);
  }

  for (const [key, values] of sourceValuesByKey) {
    if (values.length > 1) {
      issues.push({
        severity: 'error',
        code: 'SOURCE_UNIQUE_FIELD_DUPLICATE',
        message: `Source graph contains duplicate unique field value ${key}: ${values.map((value) => value.entryId).join(', ')}.`,
        details: values
      });
    }
  }

  const targetContentTypes = await getTargetContentTypesWithFields(target, uniqueFields);
  for (const contentType of targetContentTypes) {
    let skip = 0;
    let total = 0;
    do {
      const response = await target.environment.getEntries({
        content_type: contentType,
        limit: DEFAULT_PAGE_SIZE,
        skip
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      total = Number(response?.total ?? items.length);
      skip += DEFAULT_PAGE_SIZE;

      for (const item of items) {
        const targetEntryId = String(item?.sys?.id ?? '');
        if (ignoredTargetEntryIds.has(targetEntryId)) {
          continue;
        }

        for (const fieldId of uniqueFields) {
          const localizedValues = item?.fields?.[fieldId];
          if (!localizedValues || typeof localizedValues !== 'object') {
            continue;
          }

          for (const [locale, rawValue] of Object.entries(localizedValues)) {
            if (typeof rawValue !== 'string') {
              continue;
            }
            const key = uniqueValueKey({
              entryId: targetEntryId,
              contentType,
              fieldId,
              locale,
              value: rawValue
            });
            const matchingSourceValues = sourceValuesByKey.get(key);
            if (!matchingSourceValues?.length) {
              continue;
            }

            issues.push({
              severity: 'error',
              code: 'TARGET_UNIQUE_FIELD_COLLISION',
              message: `Target entry ${targetEntryId} already uses ${fieldId} "${rawValue}" on content type ${contentType} (${locale}).`,
              details: {
                targetEntryId,
                sourceEntryIds: matchingSourceValues.map((value) => value.entryId),
                contentType,
                fieldId,
                locale,
                value: rawValue
              }
            });
          }
        }
      }
    } while (skip < total);
  }

  return issues;
}

function collectUniqueValues(graph: PromotionGraph, uniqueFields: string[]): UniqueValue[] {
  const values: UniqueValue[] = [];

  for (const entry of graph.entries.values()) {
    for (const fieldId of uniqueFields) {
      const localizedValues = entry.fields[fieldId];
      if (!localizedValues || typeof localizedValues !== 'object') {
        continue;
      }

      for (const [locale, rawValue] of Object.entries(localizedValues)) {
        if (typeof rawValue !== 'string' || rawValue.trim() === '') {
          continue;
        }
        values.push({
          entryId: entry.id,
          contentType: entry.contentType,
          fieldId,
          locale,
          value: rawValue
        });
      }
    }
  }

  return values;
}

async function getTargetContentTypesWithFields(
  target: ContentfulContext,
  fieldIds: string[]
): Promise<string[]> {
  const matchingContentTypes: string[] = [];
  let skip = 0;
  let total = 0;

  do {
    const response = await target.environment.getContentTypes({
      limit: DEFAULT_PAGE_SIZE,
      skip
    });
    const items = Array.isArray(response?.items) ? response.items : [];
    total = Number(response?.total ?? items.length);
    skip += DEFAULT_PAGE_SIZE;

    for (const item of items) {
      const contentTypeId = item?.sys?.id;
      const fields = Array.isArray(item?.fields) ? item.fields : [];
      const hasUniqueField = fields.some((field: any) => fieldIds.includes(String(field?.id ?? '')));
      if (typeof contentTypeId === 'string' && hasUniqueField) {
        matchingContentTypes.push(contentTypeId);
      }
    }
  } while (skip < total);

  return matchingContentTypes;
}

function uniqueValueKey(value: UniqueValue): string {
  return [
    value.fieldId,
    value.locale,
    value.value.trim().toLocaleLowerCase()
  ].join('::');
}

function determineRequiredPromotionIds(
  graph: PromotionGraph,
  entryOperations: PromotionEntryOperation[]
): { entryIds: Set<string>; assetIds: Set<string> } {
  const entryOperationById = new Map(
    entryOperations.map((operation) => [operation.entryId, operation])
  );
  const entryIds = new Set<string>();
  const assetIds = new Set<string>();
  const queue = [...graph.rootEntryIds];

  while (queue.length > 0) {
    const entryId = queue.shift();
    if (!entryId || entryIds.has(entryId)) {
      continue;
    }

    entryIds.add(entryId);
    const entry = graph.entries.get(entryId);
    if (!entry) {
      continue;
    }

    const operation = entryOperationById.get(entryId);
    if (operation?.action === 'reuse') {
      continue;
    }

    for (const linkedEntryId of entry.linkedEntryIds) {
      if (!entryIds.has(linkedEntryId)) {
        queue.push(linkedEntryId);
      }
    }
    for (const linkedAssetId of entry.linkedAssetIds) {
      assetIds.add(linkedAssetId);
    }
  }

  return { entryIds, assetIds };
}

function filterPromotionGraph(
  graph: PromotionGraph,
  requiredIds: { entryIds: Set<string>; assetIds: Set<string> }
): PromotionGraph {
  return {
    rootEntryIds: graph.rootEntryIds.filter((entryId) => requiredIds.entryIds.has(entryId)),
    entries: new Map(
      [...graph.entries].filter(([entryId]) => requiredIds.entryIds.has(entryId))
    ),
    assets: new Map(
      [...graph.assets].filter(([assetId]) => requiredIds.assetIds.has(assetId))
    ),
    externalResourceLinks: graph.externalResourceLinks,
    issues: filterGraphIssues(graph.issues, requiredIds)
  };
}

function filterGraphIssues(
  issues: ValidationIssue[],
  requiredIds: { entryIds: Set<string>; assetIds: Set<string> },
  skippedIds?: { entryIds: Set<string>; assetIds: Set<string> }
): ValidationIssue[] {
  return issues.filter((issue) => {
    if (!issue.documentId) {
      return true;
    }
    if (skippedIds?.entryIds.has(issue.documentId) || skippedIds?.assetIds.has(issue.documentId)) {
      return false;
    }
    return requiredIds.entryIds.has(issue.documentId) || requiredIds.assetIds.has(issue.documentId);
  });
}

function collectOperationIds(
  entryOperations: PromotionEntryOperation[],
  assetOperations: PromotionAssetOperation[],
  actions: PromotionEntryOperation['action'] | Array<PromotionEntryOperation['action']>
): { entryIds: Set<string>; assetIds: Set<string> } {
  const allowedActions = new Set(Array.isArray(actions) ? actions : [actions]);
  return {
    entryIds: new Set(
      entryOperations
        .filter((operation) => allowedActions.has(operation.action))
        .map((operation) => operation.entryId)
    ),
    assetIds: new Set(
      assetOperations
        .filter((operation) => allowedActions.has(operation.action))
        .map((operation) => operation.assetId)
    )
  };
}

function mergeCollectedIds(
  ...ids: Array<{ entryIds: Set<string>; assetIds: Set<string> }>
): { entryIds: Set<string>; assetIds: Set<string> } {
  return {
    entryIds: new Set(ids.flatMap((item) => [...item.entryIds])),
    assetIds: new Set(ids.flatMap((item) => [...item.assetIds]))
  };
}

function collectIgnoredTargetEntryIds(entryOperations: PromotionEntryOperation[]): Set<string> {
  return new Set(
    entryOperations
      .filter((operation) => operation.action === 'update')
      .map((operation) => operation.entryId)
  );
}

function orderEntriesByDependencies(graph: PromotionGraph): { entryIds: string[]; issues: ValidationIssue[] } {
  const ordered: string[] = [];
  const issues: ValidationIssue[] = [];
  const pending = new Map(graph.entries);
  const completed = new Set<string>();

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((entry) =>
      entry.linkedEntryIds.every((linkedEntryId) =>
        completed.has(linkedEntryId)
        || !isBlockingDependencyForOrder(linkedEntryId, pending)
      )
    );

    if (ready.length === 0) {
      const blocked = [...pending.values()].map((entry) => entry.id);
      issues.push({
        severity: 'error',
        code: 'ENTRY_REFERENCE_CYCLE',
        message: `Unable to order entries because the source graph contains a reference cycle: ${blocked.join(', ')}.`,
        details: blocked
      });
      break;
    }

    for (const entry of ready.sort(compareEntriesForPromotion)) {
      ordered.push(entry.id);
      pending.delete(entry.id);
      completed.add(entry.id);
    }
  }

  return { entryIds: ordered, issues };
}

function isBlockingDependencyForOrder(
  linkedEntryId: string,
  pending: Map<string, PromotionEntry>
): boolean {
  const linkedEntry = pending.get(linkedEntryId);
  if (!linkedEntry) {
    return false;
  }

  return !isPageReferenceContentType(linkedEntry.contentType);
}

function compareEntriesForPromotion(left: PromotionEntry, right: PromotionEntry): number {
  if (left.role !== right.role) {
    return left.role === 'dependency' ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

async function upsertEntryFromSource(
  target: ContentfulContext,
  sourceEntry: PromotionEntry,
  allowOverwrite: boolean,
  skippedEntryIds = new Set<string>()
): Promise<any> {
  const existing = await getEntryIfExists(target, sourceEntry.id);
  const payload = {
    fields: buildEntryFieldsForCopy(sourceEntry.fields, skippedEntryIds),
    metadata: cloneJson(sourceEntry.metadata ?? {})
  };

  if (existing) {
    if (!allowOverwrite) {
      throw new Error(`Refusing to overwrite existing target entry ${sourceEntry.id}.`);
    }
    existing.fields = payload.fields;
    existing.metadata = payload.metadata;
    return existing.update();
  }

  return target.environment.createEntryWithId(sourceEntry.contentType, sourceEntry.id, payload);
}

function buildEntryFieldsForCopy(
  sourceFields: Record<string, Record<string, unknown>>,
  skippedEntryIds: Set<string>
): Record<string, Record<string, unknown>> {
  const fields = cloneJson(sourceFields);
  if (skippedEntryIds.size === 0) {
    return fields;
  }

  for (const [fieldId, localizedField] of Object.entries(fields)) {
    if (!localizedField || typeof localizedField !== 'object') {
      continue;
    }

    for (const [locale, rawValue] of Object.entries(localizedField)) {
      const stripped = stripSkippedEntryLinks(rawValue, skippedEntryIds);
      if (stripped === OMIT_SKIPPED_LINK) {
        delete localizedField[locale];
      } else {
        localizedField[locale] = stripped;
      }
    }

    if (Object.keys(localizedField).length === 0) {
      delete fields[fieldId];
    }
  }

  return fields;
}

function stripSkippedEntryLinks(
  value: unknown,
  skippedEntryIds: Set<string>
): unknown | typeof OMIT_SKIPPED_LINK {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripSkippedEntryLinks(item, skippedEntryIds))
      .filter((item) => item !== OMIT_SKIPPED_LINK);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (isSkippedEntryLink(value, skippedEntryIds)) {
    return OMIT_SKIPPED_LINK;
  }

  const object = value as Record<string, unknown>;
  const data = object.data;
  if (data && typeof data === 'object') {
    const target = (data as Record<string, unknown>).target;
    if (isSkippedEntryLink(target, skippedEntryIds)) {
      return OMIT_SKIPPED_LINK;
    }
  }

  const strippedObject: Record<string, unknown> = { ...object };
  for (const [key, nested] of Object.entries(object)) {
    const stripped = stripSkippedEntryLinks(nested, skippedEntryIds);
    if (stripped === OMIT_SKIPPED_LINK) {
      delete strippedObject[key];
    } else {
      strippedObject[key] = stripped;
    }
  }

  return strippedObject;
}

function isSkippedEntryLink(value: unknown, skippedEntryIds: Set<string>): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const sys = (value as Record<string, unknown>).sys;
  if (!sys || typeof sys !== 'object') {
    return false;
  }

  const link = sys as Record<string, unknown>;
  return link.type === 'Link'
    && link.linkType === 'Entry'
    && typeof link.id === 'string'
    && skippedEntryIds.has(link.id);
}

async function upsertAssetFromSource(
  target: ContentfulContext,
  sourceAsset: PromotionAsset,
  allowOverwrite: boolean
): Promise<any> {
  const existing = await getAssetIfExists(target, sourceAsset.id);
  const payload = {
    fields: buildAssetFieldsForCopy(sourceAsset.fields),
    metadata: cloneJson(sourceAsset.metadata ?? {})
  };

  let targetAsset;
  if (existing) {
    if (!allowOverwrite) {
      throw new Error(`Refusing to overwrite existing target asset ${sourceAsset.id}.`);
    }
    existing.fields = payload.fields;
    existing.metadata = payload.metadata;
    targetAsset = await existing.update();
  } else {
    targetAsset = await target.environment.createAssetWithId(sourceAsset.id, payload);
  }

  await targetAsset.processForAllLocales();
  return targetAsset;
}

function buildAssetFieldsForCopy(
  sourceFields: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const fields = cloneJson(sourceFields);
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
  target: ContentfulContext,
  assetId: string,
  attempts = 15
): Promise<any> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const asset = await getAssetIfExists(target, assetId);
    if (!asset) {
      throw new Error(`Target asset ${assetId} disappeared during processing.`);
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number | string;
    response?: {
      status?: number | string;
    };
  };
  return normalizeStatusCode(candidate.status) === 404
    || normalizeStatusCode(candidate.response?.status) === 404;
}

function normalizeStatusCode(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}
