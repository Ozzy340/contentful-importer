import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  getAssetIfExists,
  getEntryIfExists,
  type ContentfulContext
} from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'publishing');
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_REQUEST_THROTTLE = 25;
const DEFAULT_PUBLISH_INTERVAL_MS = 10_000;
const DEFAULT_PUBLISH_INCLUDE_DEPTH = 10;
const DEFAULT_PARENT_LOOKUP_DEPTH = 8;
const DEFAULT_PAGE_CONTENT_TYPE_IDS = [
  'contentPage',
  'resourcePage',
  'homePage',
  'listingPage',
  'searchPage'
];
const SUPPORTED_INPUT_EXTENSIONS = new Set(['.csv', '.tsv', '.txt', '.xlsx']);
const ENTRY_ID_HEADER_NAMES = [
  'entryId',
  'entryID',
  'entry id',
  'entity id',
  'contentful entry id',
  'contentful id',
  'contentfulUrl',
  'contentful URL',
  'url'
];
const HEADER_LIKE_VALUES = new Set(
  ENTRY_ID_HEADER_NAMES.map(normalizeHeaderName)
);

type EntityLinkType = 'Entry' | 'Asset';
type InputEntityKind = 'entry' | 'asset';
type SourceAction =
  | 'skipped-empty'
  | 'missing-entry'
  | 'missing-asset'
  | 'direct-page'
  | 'resolved-parent-page'
  | 'resolved-parent-pages'
  | 'no-parent-page'
  | 'unsupported-entity';
type PublishGroupAction =
  | 'blocked'
  | 'would-publish'
  | 'published'
  | 'not-needed'
  | 'failed';
type ResourcePublishAction =
  | 'publish'
  | 'already-published'
  | 'skipped-archived'
  | 'missing';

interface CommandConfig {
  allowNonSandbox: boolean;
  dryRun: boolean;
  environmentId: string;
  inputPath: string;
  limit?: number;
  pageContentTypeIds: string[];
  pageSize: number;
  parentLookupDepth: number;
  publishIncludeDepth: number;
  publishIntervalMs: number;
  requestThrottle: number;
  startRow: number;
}

interface SourceFileReadResult {
  filePath: string;
  rows: string[][];
}

interface InputEntity {
  columnNumber: number;
  filePath: string;
  id: string;
  kind: InputEntityKind;
  rawValue: string;
  rowNumber: number;
  sourceIndex: number;
}

interface ParentPageMatch {
  contentType: string;
  entryId: string;
  entryName: string;
  path: string[];
  slug: string;
}

interface SourceResolution {
  action: SourceAction;
  columnNumber: number;
  contentfulUrl: string;
  errors: string[];
  filePath: string;
  id: string;
  kind: InputEntityKind;
  rawValue: string;
  referencePaths: string[][];
  rowNumber: number;
  sourceContentType?: string;
  sourceName?: string;
  sourceStatus?: string;
  targetPageIds: string[];
  warnings: string[];
}

interface PublishResource {
  action: ResourcePublishAction;
  contentType?: string;
  id: string;
  linkType: EntityLinkType;
  name: string;
  role: 'page' | 'reference';
  status: string;
  version?: number;
  warnings: string[];
}

interface PublishGroup {
  action: PublishGroupAction;
  bulkActionId?: string;
  candidateAssetCount: number;
  candidateEntryCount: number;
  contentType: string;
  errors: string[];
  firstSourceIndex: number;
  pageId: string;
  pageWillPublish: boolean;
  pageName: string;
  pageSlug: string;
  pageStatus: string;
  publishedAssetCount: number;
  publishedEntryCount: number;
  referenceCandidateAssetCount: number;
  referenceCandidateEntryCount: number;
  referenceTotalAssetCount: number;
  referenceTotalEntryCount: number;
  resources: PublishResource[];
  sourceIndexes: number[];
  sourceRows: string[];
  warnings: string[];
}

interface PagePublishingReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  spaceId?: string;
  environmentId: string;
  input: {
    inputPath: string;
    limit?: number;
    pageContentTypeIds: string[];
    pageSize: number;
    parentLookupDepth: number;
    publishIncludeDepth: number;
    publishIntervalMs: number;
    requestThrottle: number;
    startRow: number;
  };
  summary: PagePublishingSummary;
  sources: SourceResolution[];
  publishGroups: PublishGroup[];
}

interface PagePublishingSummary {
  directPageInputs: number;
  duplicateTargetPageReferences: number;
  errors: number;
  inputEntities: number;
  missingAssets: number;
  missingEntries: number;
  noParentPageInputs: number;
  publishGroups: number;
  publishGroupsBlocked: number;
  publishGroupsFailed: number;
  publishGroupsNotNeeded: number;
  publishGroupsPublished: number;
  publishGroupsWouldPublish: number;
  resolvedNonPageInputs: number;
  sourceFiles: number;
  targetPages: number;
  totalCandidateAssets: number;
  totalCandidateEntries: number;
  totalCandidateReferenceAssets: number;
  totalCandidateReferenceEntries: number;
  totalCandidateReferences: number;
  totalPublishedAssets: number;
  totalPublishedEntries: number;
  totalReferences: number;
  warnings: number;
}

interface ReferenceResources {
  entriesById: Map<string, any>;
  assetsById: Map<string, any>;
  missingAssetIds: Set<string>;
  missingEntryIds: Set<string>;
}

interface CollectedReferenceIds {
  assetIds: Set<string>;
  entryIds: Set<string>;
}

interface ParentSearchNode {
  id: string;
  linkType: EntityLinkType;
  path: string[];
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'publish-pages');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);

  logger.info(commandConfig.dryRun ? 'Preparing page publishing dry run' : 'Preparing page publishing apply run', {
    environmentId: commandConfig.environmentId,
    inputPath: commandConfig.inputPath,
    pageContentTypeIds: commandConfig.pageContentTypeIds,
    parentLookupDepth: commandConfig.parentLookupDepth,
    publishIncludeDepth: commandConfig.publishIncludeDepth,
    publishIntervalMs: commandConfig.publishIntervalMs,
    requestThrottle: commandConfig.requestThrottle
  });

  const sourceFiles = await readSourceFiles(commandConfig.inputPath);
  const inputEntities = extractInputEntities(sourceFiles, commandConfig);
  if (inputEntities.length === 0) {
    throw new Error(`No entry IDs or Contentful entity URLs were found in ${commandConfig.inputPath}.`);
  }

  const context = await createContentfulContext(
    {
      ...projectConfig.env,
      CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
    },
    {
      throttle: commandConfig.requestThrottle
    }
  );

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  const sources = await resolveSourcesToPages(context, commandConfig, inputEntities, logger);
  const publishGroups = await buildPublishGroups(context, commandConfig, sources, logger);

  if (!commandConfig.dryRun) {
    await publishGroupsWithRateLimit(context, commandConfig, publishGroups, logger);
  }

  const report = buildReport(projectConfig, commandConfig, sourceFiles, sources, publishGroups);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  logger.info(commandConfig.dryRun ? 'Page publishing dry run finished' : 'Page publishing apply run finished', {
    markdownReport: reportPaths.markdownPath,
    jsonReport: reportPaths.jsonPath,
    ...report.summary
  });

  if (report.summary.errors > 0 || report.summary.publishGroupsFailed > 0) {
    process.exitCode = 1;
  }
}

function resolveCommandConfig(flags: CliFlags, env: RuntimeEnv): CommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);

  const environmentId =
    stringFlag(flags, 'env') ??
    stringFlag(flags, 'environment') ??
    env.CONTENTFUL_ENVIRONMENT_ID;

  if (!environmentId) {
    throw new Error('Missing Contentful environment. Use --env <environment>.');
  }

  const pageContentTypeIds = parseListFlag(flags, 'page-types') ?? DEFAULT_PAGE_CONTENT_TYPE_IDS;
  const row = parsePositiveIntegerFlag(flags, ['row', 'data-row']);
  const hasRangeFlag = hasAnyFlag(flags, ['start-row', 'start', 'from-row', 'limit', 'rows']);
  if (row !== undefined && hasRangeFlag) {
    throw new Error('Use either --row <data-row> or --start-row/--limit, not both.');
  }

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    dryRun: !flags.yes,
    environmentId,
    inputPath: path.resolve(stringFlag(flags, 'input') ?? stringFlag(flags, 'source') ?? DEFAULT_INPUT_PATH),
    limit: row !== undefined ? 1 : parsePositiveIntegerFlag(flags, ['limit', 'rows']),
    pageContentTypeIds,
    pageSize: parsePositiveIntegerFlag(flags, ['page-size']) ?? DEFAULT_PAGE_SIZE,
    parentLookupDepth:
      parsePositiveIntegerFlag(flags, ['parent-lookup-depth', 'reverse-depth']) ??
      DEFAULT_PARENT_LOOKUP_DEPTH,
    publishIncludeDepth:
      parseIntegerInRangeFlag(flags, ['publish-include-depth', 'include-depth'], 1, 10) ??
      DEFAULT_PUBLISH_INCLUDE_DEPTH,
    publishIntervalMs:
      parseNonNegativeIntegerFlag(flags, ['publish-interval-ms', 'publish-delay-ms']) ??
      DEFAULT_PUBLISH_INTERVAL_MS,
    requestThrottle:
      parseIntegerInRangeFlag(flags, ['throttle', 'request-throttle'], 1, 30) ??
      DEFAULT_REQUEST_THROTTLE,
    startRow: row ?? parsePositiveIntegerFlag(flags, ['start-row', 'start', 'from-row']) ?? 1
  };
}

async function readSourceFiles(inputPath: string): Promise<SourceFileReadResult[]> {
  const inputStat = await stat(inputPath);
  const filePaths = inputStat.isDirectory()
    ? (await readdir(inputPath))
      .map((fileName) => path.join(inputPath, fileName))
      .filter((filePath) => SUPPORTED_INPUT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
      .sort((left, right) => left.localeCompare(right))
    : [inputPath];

  if (filePaths.length === 0) {
    throw new Error(`No supported input files found in ${inputPath}. Expected CSV, TSV, TXT, or XLSX.`);
  }

  const results: SourceFileReadResult[] = [];
  for (const filePath of filePaths) {
    const extension = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_INPUT_EXTENSIONS.has(extension)) {
      continue;
    }

    if (extension === '.xlsx') {
      results.push({
        filePath,
        rows: await readXlsxFirstSheet(filePath)
      });
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    results.push({
      filePath,
      rows: extension === '.csv'
        ? parseDelimitedRows(content, ',')
        : extension === '.tsv'
          ? parseDelimitedRows(content, '\t')
          : content.split(/\r?\n/).map((line) => [line])
    });
  }

  return results;
}

function extractInputEntities(
  sourceFiles: SourceFileReadResult[],
  commandConfig: CommandConfig
): InputEntity[] {
  const entities: InputEntity[] = [];
  let sourceIndex = 1;

  for (const sourceFile of sourceFiles) {
    const headerColumnIndex = findInputHeaderColumn(sourceFile.rows[0] ?? []);
    const dataRows = headerColumnIndex >= 0 ? sourceFile.rows.slice(1) : sourceFile.rows;
    const startIndex = commandConfig.startRow - 1;
    const endIndex = commandConfig.limit === undefined
      ? dataRows.length
      : startIndex + commandConfig.limit;
    const selectedRows = dataRows.slice(startIndex, endIndex);

    for (const [selectedIndex, row] of selectedRows.entries()) {
      const rowNumber = (headerColumnIndex >= 0 ? 2 : 1) + startIndex + selectedIndex;
      const cells = headerColumnIndex >= 0
        ? [{ value: row[headerColumnIndex] ?? '', columnNumber: headerColumnIndex + 1 }]
        : row.map((value, index) => ({ value, columnNumber: index + 1 }));

      for (const cell of cells) {
        for (const extracted of extractEntityReferencesFromCell(cell.value)) {
          entities.push({
            columnNumber: cell.columnNumber,
            filePath: sourceFile.filePath,
            id: extracted.id,
            kind: extracted.kind,
            rawValue: cell.value,
            rowNumber,
            sourceIndex
          });
          sourceIndex += 1;
        }
      }
    }
  }

  return entities;
}

async function resolveSourcesToPages(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  inputEntities: InputEntity[],
  logger: Logger
): Promise<SourceResolution[]> {
  const resolutions: SourceResolution[] = [];
  const pageContentTypes = new Set(commandConfig.pageContentTypeIds);

  for (const [index, input] of inputEntities.entries()) {
    logger.info('Resolving source entity', {
      current: index + 1,
      total: inputEntities.length,
      id: input.id,
      kind: input.kind,
      row: input.rowNumber
    });

    const baseResolution: SourceResolution = {
      action: 'unsupported-entity',
      columnNumber: input.columnNumber,
      contentfulUrl: contentfulEntityUrl(context, input.kind === 'asset' ? 'Asset' : 'Entry', input.id),
      errors: [],
      filePath: input.filePath,
      id: input.id,
      kind: input.kind,
      rawValue: input.rawValue,
      referencePaths: [],
      rowNumber: input.rowNumber,
      targetPageIds: [],
      warnings: []
    };

    try {
      if (input.kind === 'asset') {
        const asset = await getAssetIfExists(context, input.id);
        if (!asset) {
          baseResolution.action = 'missing-asset';
          baseResolution.errors.push(`Asset ${input.id} was not found.`);
          resolutions.push(baseResolution);
          continue;
        }

        baseResolution.sourceName = formatAssetName(asset);
        baseResolution.sourceStatus = getEntityStatus(asset);
        const parentPages = await findParentPagesForEntity(
          context,
          { id: input.id, linkType: 'Asset', path: [`Asset:${input.id}`] },
          pageContentTypes,
          commandConfig
        );
        applyParentPagesToResolution(baseResolution, parentPages);
        resolutions.push(baseResolution);
        continue;
      }

      const entry = await getEntryIfExists(context, input.id);
      if (!entry) {
        baseResolution.action = 'missing-entry';
        baseResolution.errors.push(`Entry ${input.id} was not found.`);
        resolutions.push(baseResolution);
        continue;
      }

      const contentType = getEntryContentType(entry);
      baseResolution.sourceContentType = contentType;
      baseResolution.sourceName = formatEntryDisplayName(entry);
      baseResolution.sourceStatus = getEntityStatus(entry);

      if (isPageContentType(contentType, pageContentTypes)) {
        baseResolution.action = 'direct-page';
        baseResolution.targetPageIds = [input.id];
        baseResolution.referencePaths = [[`Entry:${input.id}`]];
        resolutions.push(baseResolution);
        continue;
      }

      const parentPages = await findParentPagesForEntity(
        context,
        { id: input.id, linkType: 'Entry', path: [`Entry:${input.id}`] },
        pageContentTypes,
        commandConfig
      );
      applyParentPagesToResolution(baseResolution, parentPages);
      resolutions.push(baseResolution);
    } catch (error) {
      baseResolution.errors.push(errorMessage(error));
      resolutions.push(baseResolution);
    }
  }

  return resolutions;
}

function applyParentPagesToResolution(
  resolution: SourceResolution,
  parentPages: ParentPageMatch[]
): void {
  if (parentPages.length === 0) {
    resolution.action = 'no-parent-page';
    resolution.errors.push(`No parent page was found for ${resolution.kind} ${resolution.id}.`);
    return;
  }

  resolution.action = parentPages.length === 1 ? 'resolved-parent-page' : 'resolved-parent-pages';
  resolution.targetPageIds = parentPages.map((page) => page.entryId);
  resolution.referencePaths = parentPages.map((page) => page.path);
}

async function findParentPagesForEntity(
  context: ContentfulContext,
  root: ParentSearchNode,
  pageContentTypes: Set<string>,
  commandConfig: CommandConfig
): Promise<ParentPageMatch[]> {
  const parentPagesById = new Map<string, ParentPageMatch>();
  const visited = new Set<string>([entityKey(root)]);
  let frontier: ParentSearchNode[] = [root];

  for (let depth = 0; depth < commandConfig.parentLookupDepth && frontier.length > 0; depth += 1) {
    const nextFrontier: ParentSearchNode[] = [];

    for (const node of frontier) {
      const parents = await fetchIncomingReferences(context, node, commandConfig.pageSize);
      for (const parent of parents) {
        const parentId = stringValue(parent?.sys?.id);
        if (!parentId) {
          continue;
        }

        const parentNode: ParentSearchNode = {
          id: parentId,
          linkType: 'Entry',
          path: [...node.path, `Entry:${parentId}`]
        };
        const key = entityKey(parentNode);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);

        const parentContentType = getEntryContentType(parent);
        if (isPageContentType(parentContentType, pageContentTypes)) {
          parentPagesById.set(parentId, {
            contentType: parentContentType,
            entryId: parentId,
            entryName: formatEntryDisplayName(parent),
            path: parentNode.path,
            slug: formatFieldValue(parent, 'slug')
          });
          continue;
        }

        nextFrontier.push(parentNode);
      }
    }

    frontier = nextFrontier;
  }

  return [...parentPagesById.values()].sort((left, right) =>
    left.entryId.localeCompare(right.entryId)
  );
}

async function fetchIncomingReferences(
  context: ContentfulContext,
  node: ParentSearchNode,
  pageSize: number
): Promise<any[]> {
  const queryKey = node.linkType === 'Asset' ? 'links_to_asset' : 'links_to_entry';
  return fetchEntries(context, { [queryKey]: node.id }, pageSize);
}

async function buildPublishGroups(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  sources: SourceResolution[],
  logger: Logger
): Promise<PublishGroup[]> {
  const sourceIndexesByPageId = new Map<string, number[]>();
  const firstSourceIndexByPageId = new Map<string, number>();

  for (const [sourceIndex, source] of sources.entries()) {
    for (const pageId of source.targetPageIds) {
      const indexes = sourceIndexesByPageId.get(pageId) ?? [];
      indexes.push(sourceIndex);
      sourceIndexesByPageId.set(pageId, indexes);
      if (!firstSourceIndexByPageId.has(pageId)) {
        firstSourceIndexByPageId.set(pageId, sourceIndex);
      }
    }
  }

  const groups: PublishGroup[] = [];
  const pageIds = [...sourceIndexesByPageId.keys()].sort((left, right) =>
    (firstSourceIndexByPageId.get(left) ?? 0) - (firstSourceIndexByPageId.get(right) ?? 0)
  );

  for (const [index, pageId] of pageIds.entries()) {
    logger.info('Inspecting page references for publishing', {
      current: index + 1,
      total: pageIds.length,
      pageId,
      includeDepth: commandConfig.publishIncludeDepth
    });

    const sourceIndexes = sourceIndexesByPageId.get(pageId) ?? [];
    const group = await inspectPagePublishGroup(
      context,
      commandConfig,
      pageId,
      sourceIndexes,
      sources
    );
    groups.push(group);
  }

  return groups;
}

async function inspectPagePublishGroup(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  pageId: string,
  sourceIndexes: number[],
  sources: SourceResolution[]
): Promise<PublishGroup> {
  const group: PublishGroup = {
    action: 'blocked',
    candidateAssetCount: 0,
    candidateEntryCount: 0,
    contentType: '',
    errors: [],
    firstSourceIndex: Math.min(...sourceIndexes),
    pageId,
    pageWillPublish: false,
    pageName: '',
    pageSlug: '',
    pageStatus: '',
    publishedAssetCount: 0,
    publishedEntryCount: 0,
    referenceCandidateAssetCount: 0,
    referenceCandidateEntryCount: 0,
    referenceTotalAssetCount: 0,
    referenceTotalEntryCount: 0,
    resources: [],
    sourceIndexes: sourceIndexes.map((index) => index + 1),
    sourceRows: sourceIndexes
      .map((index) => sources[index])
      .filter((source): source is SourceResolution => Boolean(source))
      .map((source) => formatSourcePointer(source)),
    warnings: []
  };

  const pageEntry = await getEntryIfExists(context, pageId);
  if (!pageEntry) {
    group.errors.push(`Target page ${pageId} was not found.`);
    return group;
  }

  group.contentType = getEntryContentType(pageEntry);
  group.pageName = formatEntryDisplayName(pageEntry);
  group.pageSlug = formatFieldValue(pageEntry, 'slug');
  group.pageStatus = getEntityStatus(pageEntry);

  if (isArchived(pageEntry)) {
    group.errors.push(`Target page ${pageId} is archived and cannot be published.`);
    return group;
  }

  const resources = await collectPageReferenceResources(
    context,
    pageEntry,
    commandConfig.publishIncludeDepth
  );
  group.resources = buildPublishResources(resources, pageId);
  group.candidateEntryCount = group.resources.filter(
    (resource) => resource.linkType === 'Entry' && resource.action === 'publish'
  ).length;
  group.candidateAssetCount = group.resources.filter(
    (resource) => resource.linkType === 'Asset' && resource.action === 'publish'
  ).length;
  group.referenceCandidateEntryCount = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.linkType === 'Entry' && resource.action === 'publish'
  ).length;
  group.referenceCandidateAssetCount = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.linkType === 'Asset' && resource.action === 'publish'
  ).length;
  group.referenceTotalEntryCount = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.linkType === 'Entry'
  ).length;
  group.referenceTotalAssetCount = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.linkType === 'Asset'
  ).length;
  group.pageWillPublish = group.resources.some(
    (resource) => resource.role === 'page' && resource.action === 'publish'
  );

  const archivedReferences = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.action === 'skipped-archived'
  );
  for (const resource of archivedReferences) {
    group.warnings.push(`${resource.linkType} ${resource.id} is archived and will be skipped.`);
  }
  const missingReferences = group.resources.filter(
    (resource) => resource.role === 'reference' && resource.action === 'missing'
  );
  for (const resource of missingReferences) {
    group.errors.push(`${resource.linkType} ${resource.id} is referenced by this page but was not found.`);
  }

  group.action = group.errors.length > 0
    ? 'blocked'
    : group.candidateEntryCount + group.candidateAssetCount > 0
      ? commandConfig.dryRun ? 'would-publish' : 'not-needed'
      : 'not-needed';

  return group;
}

async function collectPageReferenceResources(
  context: ContentfulContext,
  pageEntry: any,
  includeDepth: number
): Promise<ReferenceResources> {
  const entriesById = new Map<string, any>();
  const assetsById = new Map<string, any>();
  const missingAssetIds = new Set<string>();
  const missingEntryIds = new Set<string>();
  const visitedEntryIds = new Set<string>();
  const seenAssetIds = new Set<string>();
  const pageId = stringValue(pageEntry?.sys?.id);
  if (pageId) {
    entriesById.set(pageId, pageEntry);
    visitedEntryIds.add(pageId);
  }

  let currentEntries = [pageEntry];
  for (let depth = 1; depth <= includeDepth && currentEntries.length > 0; depth += 1) {
    const nextEntryIds = new Set<string>();
    const nextAssetIds = new Set<string>();

    for (const entry of currentEntries) {
      const references = collectReferenceIds(entry?.fields ?? {});
      for (const entryId of references.entryIds) {
        if (!visitedEntryIds.has(entryId) && !missingEntryIds.has(entryId)) {
          nextEntryIds.add(entryId);
        }
      }
      for (const assetId of references.assetIds) {
        if (!seenAssetIds.has(assetId) && !missingAssetIds.has(assetId)) {
          nextAssetIds.add(assetId);
        }
      }
    }

    if (nextAssetIds.size > 0) {
      const fetchedAssets = await fetchAssetsByIds(context, [...nextAssetIds]);
      for (const assetId of nextAssetIds) {
        const asset = fetchedAssets.get(assetId);
        if (asset) {
          assetsById.set(assetId, asset);
          seenAssetIds.add(assetId);
        } else {
          missingAssetIds.add(assetId);
        }
      }
    }

    if (nextEntryIds.size === 0) {
      currentEntries = [];
      continue;
    }

    const fetchedEntries = await fetchEntriesByIds(context, [...nextEntryIds]);
    const nextEntries: any[] = [];
    for (const entryId of nextEntryIds) {
      const entry = fetchedEntries.get(entryId);
      if (entry) {
        entriesById.set(entryId, entry);
        visitedEntryIds.add(entryId);
        nextEntries.push(entry);
      } else {
        missingEntryIds.add(entryId);
      }
    }

    currentEntries = nextEntries;
  }

  return {
    entriesById,
    assetsById,
    missingAssetIds,
    missingEntryIds
  };
}

function collectReferenceIds(value: unknown): CollectedReferenceIds {
  const entryIds = new Set<string>();
  const assetIds = new Set<string>();

  visit(value);

  return { entryIds, assetIds };

  function visit(candidate: unknown): void {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }

    if (!isRecord(candidate)) {
      return;
    }

    const sys = candidate.sys;
    if (isRecord(sys) && sys.type === 'Link' && typeof sys.id === 'string') {
      if (sys.linkType === 'Entry') {
        entryIds.add(sys.id);
        return;
      }
      if (sys.linkType === 'Asset') {
        assetIds.add(sys.id);
        return;
      }
    }

    for (const item of Object.values(candidate)) {
      visit(item);
    }
  }
}

function buildPublishResources(resources: ReferenceResources, pageId: string): PublishResource[] {
  const publishResources: PublishResource[] = [];

  for (const entry of resources.entriesById.values()) {
    const entryId = stringValue(entry?.sys?.id);
    if (!entryId) {
      continue;
    }

    publishResources.push({
      action: getResourcePublishAction(entry),
      contentType: getEntryContentType(entry),
      id: entryId,
      linkType: 'Entry',
      name: formatEntryDisplayName(entry),
      role: entryId === pageId ? 'page' : 'reference',
      status: getEntityStatus(entry),
      version: numberValue(entry?.sys?.version),
      warnings: []
    });
  }

  for (const asset of resources.assetsById.values()) {
    const assetId = stringValue(asset?.sys?.id);
    if (!assetId) {
      continue;
    }

    publishResources.push({
      action: getResourcePublishAction(asset),
      id: assetId,
      linkType: 'Asset',
      name: formatAssetName(asset),
      role: 'reference',
      status: getEntityStatus(asset),
      version: numberValue(asset?.sys?.version),
      warnings: []
    });
  }

  for (const entryId of resources.missingEntryIds) {
    publishResources.push({
      action: 'missing',
      id: entryId,
      linkType: 'Entry',
      name: '',
      role: 'reference',
      status: 'missing',
      warnings: ['Referenced entry was not found.']
    });
  }

  for (const assetId of resources.missingAssetIds) {
    publishResources.push({
      action: 'missing',
      id: assetId,
      linkType: 'Asset',
      name: '',
      role: 'reference',
      status: 'missing',
      warnings: ['Referenced asset was not found.']
    });
  }

  return publishResources.sort(comparePublishResources);
}

async function publishGroupsWithRateLimit(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  groups: PublishGroup[],
  logger: Logger
): Promise<void> {
  let lastPublishStartedAt = 0;
  let publishActionCount = 0;

  for (const [index, group] of groups.entries()) {
    if (group.errors.length > 0) {
      group.action = 'blocked';
      continue;
    }

    const candidates = group.resources.filter((resource) => resource.action === 'publish');
    if (candidates.length === 0) {
      group.action = 'not-needed';
      continue;
    }

    const waitMs = publishActionCount === 0
      ? 0
      : Math.max(0, commandConfig.publishIntervalMs - (Date.now() - lastPublishStartedAt));
    if (waitMs > 0) {
      logger.info('Waiting before next page publish', {
        groupIndex: index + 1,
        groupTotal: groups.length,
        pageId: group.pageId,
        waitMs
      });
      await delay(waitMs);
    }

    publishActionCount += 1;
    lastPublishStartedAt = Date.now();
    logger.info('Publishing page with references', {
      candidateAssets: group.candidateAssetCount,
      candidateEntries: group.candidateEntryCount,
      groupIndex: index + 1,
      groupTotal: groups.length,
      pageId: group.pageId,
      pageName: group.pageName
    });

    try {
      const result = await publishBulkActionWithFreshVersions(context, group, candidates, logger);
      group.bulkActionId = result.bulkActionId;
      group.publishedEntryCount = result.publishedEntryCount;
      group.publishedAssetCount = result.publishedAssetCount;
      group.action = result.publishedEntryCount + result.publishedAssetCount > 0
        ? 'published'
        : 'not-needed';
    } catch (error) {
      group.action = 'failed';
      group.errors.push(errorMessage(error));
      logger.error('Failed to publish page with references', {
        pageId: group.pageId,
        error: errorMessage(error)
      });
    }
  }
}

async function publishBulkActionWithFreshVersions(
  context: ContentfulContext,
  group: PublishGroup,
  candidates: PublishResource[],
  logger: Logger
): Promise<{ bulkActionId?: string; publishedAssetCount: number; publishedEntryCount: number }> {
  let publishCandidates = await refreshPublishCandidates(context, candidates);
  if (publishCandidates.length === 0) {
    return {
      publishedAssetCount: 0,
      publishedEntryCount: 0
    };
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const bulkAction = await context.environment.createPublishBulkAction({
        entities: {
          sys: { type: 'Array' },
          items: publishCandidates.map(toBulkActionLink)
        }
      });
      const completed = typeof bulkAction?.waitProcessing === 'function'
        ? await bulkAction.waitProcessing()
        : bulkAction;
      const status = stringValue(completed?.sys?.status);
      if (status && status !== 'succeeded') {
        throw new Error(`Bulk publish finished with status ${status}${formatBulkActionError(completed)}.`);
      }

      return {
        bulkActionId: stringValue(completed?.sys?.id) || stringValue(bulkAction?.sys?.id) || undefined,
        publishedAssetCount: publishCandidates.filter((candidate) => candidate.linkType === 'Asset').length,
        publishedEntryCount: publishCandidates.filter((candidate) => candidate.linkType === 'Entry').length
      };
    } catch (error) {
      if (attempt >= 2 || !isVersionMismatchError(error)) {
        throw error;
      }

      logger.warn('Bulk publish hit a version mismatch; refreshing candidate versions and retrying once', {
        pageId: group.pageId,
        entityIds: publishCandidates.map((candidate) => `${candidate.linkType}:${candidate.id}`)
      });

      publishCandidates = await refreshPublishCandidates(context, publishCandidates);
      if (publishCandidates.length === 0) {
        return {
          publishedAssetCount: 0,
          publishedEntryCount: 0
        };
      }
    }
  }

  return {
    publishedAssetCount: 0,
    publishedEntryCount: 0
  };
}

async function refreshPublishCandidates(
  context: ContentfulContext,
  candidates: PublishResource[]
): Promise<PublishResource[]> {
  const refreshed: PublishResource[] = [];
  const entryIds = candidates.filter((candidate) => candidate.linkType === 'Entry').map((candidate) => candidate.id);
  const assetIds = candidates.filter((candidate) => candidate.linkType === 'Asset').map((candidate) => candidate.id);
  const entries = await fetchEntriesByIds(context, entryIds);
  const assets = await fetchAssetsByIds(context, assetIds);

  for (const candidate of candidates) {
    const entity = candidate.linkType === 'Entry' ? entries.get(candidate.id) : assets.get(candidate.id);
    if (!entity || isArchived(entity) || isPublishedAndClean(entity)) {
      continue;
    }

    refreshed.push({
      ...candidate,
      status: getEntityStatus(entity),
      version: numberValue(entity?.sys?.version)
    });
  }

  return refreshed;
}

function toBulkActionLink(resource: PublishResource): {
  sys: { type: 'Link'; linkType: EntityLinkType; id: string; version: number };
} {
  const version = resource.version;
  if (!Number.isInteger(version) || !version || version < 1) {
    throw new Error(`Cannot publish ${resource.linkType} ${resource.id}; Contentful did not return a valid version.`);
  }

  return {
    sys: {
      type: 'Link',
      linkType: resource.linkType,
      id: resource.id,
      version
    }
  };
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  sourceFiles: SourceFileReadResult[],
  sources: SourceResolution[],
  publishGroups: PublishGroup[]
): PagePublishingReport {
  return {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      inputPath: commandConfig.inputPath,
      limit: commandConfig.limit,
      pageContentTypeIds: commandConfig.pageContentTypeIds,
      pageSize: commandConfig.pageSize,
      parentLookupDepth: commandConfig.parentLookupDepth,
      publishIncludeDepth: commandConfig.publishIncludeDepth,
      publishIntervalMs: commandConfig.publishIntervalMs,
      requestThrottle: commandConfig.requestThrottle,
      startRow: commandConfig.startRow
    },
    summary: summarize(sourceFiles, sources, publishGroups),
    sources,
    publishGroups
  };
}

function summarize(
  sourceFiles: SourceFileReadResult[],
  sources: SourceResolution[],
  publishGroups: PublishGroup[]
): PagePublishingSummary {
  const allTargetPageReferences = sources.flatMap((source) => source.targetPageIds);
  const uniqueTargetPages = new Set(allTargetPageReferences);

  return {
    directPageInputs: sources.filter((source) => source.action === 'direct-page').length,
    duplicateTargetPageReferences: allTargetPageReferences.length - uniqueTargetPages.size,
    errors:
      sources.reduce((sum, source) => sum + source.errors.length, 0) +
      publishGroups.reduce((sum, group) => sum + group.errors.length, 0),
    inputEntities: sources.length,
    missingAssets: sources.filter((source) => source.action === 'missing-asset').length,
    missingEntries: sources.filter((source) => source.action === 'missing-entry').length,
    noParentPageInputs: sources.filter((source) => source.action === 'no-parent-page').length,
    publishGroups: publishGroups.length,
    publishGroupsBlocked: publishGroups.filter((group) => group.action === 'blocked').length,
    publishGroupsFailed: publishGroups.filter((group) => group.action === 'failed').length,
    publishGroupsNotNeeded: publishGroups.filter((group) => group.action === 'not-needed').length,
    publishGroupsPublished: publishGroups.filter((group) => group.action === 'published').length,
    publishGroupsWouldPublish: publishGroups.filter((group) => group.action === 'would-publish').length,
    resolvedNonPageInputs: sources.filter(
      (source) => source.action === 'resolved-parent-page' || source.action === 'resolved-parent-pages'
    ).length,
    sourceFiles: sourceFiles.length,
    targetPages: uniqueTargetPages.size,
    totalCandidateAssets: publishGroups.reduce((sum, group) => sum + group.candidateAssetCount, 0),
    totalCandidateEntries: publishGroups.reduce((sum, group) => sum + group.candidateEntryCount, 0),
    totalCandidateReferenceAssets: publishGroups.reduce((sum, group) => sum + group.referenceCandidateAssetCount, 0),
    totalCandidateReferenceEntries: publishGroups.reduce((sum, group) => sum + group.referenceCandidateEntryCount, 0),
    totalCandidateReferences: publishGroups.reduce(
      (sum, group) => sum + group.referenceCandidateEntryCount + group.referenceCandidateAssetCount,
      0
    ),
    totalPublishedAssets: publishGroups.reduce((sum, group) => sum + group.publishedAssetCount, 0),
    totalPublishedEntries: publishGroups.reduce((sum, group) => sum + group.publishedEntryCount, 0),
    totalReferences: publishGroups.reduce(
      (sum, group) => sum + group.referenceTotalEntryCount + group.referenceTotalAssetCount,
      0
    ),
    warnings:
      sources.reduce((sum, source) => sum + source.warnings.length, 0) +
      publishGroups.reduce((sum, group) => sum + group.warnings.length, 0)
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: PagePublishingReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `page-publishing-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${commandConfig.environmentId}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: PagePublishingReport): string {
  const lines: string[] = [];
  lines.push('# Page Publishing Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- Input: ${report.input.inputPath}`);
  lines.push(`- Selection: data row ${report.input.startRow}${report.input.limit ? `, limit ${report.input.limit}` : ' to end'}`);
  lines.push(`- Page content types: ${report.input.pageContentTypeIds.join(', ')}`);
  lines.push('- Additional page detection: any content type ID ending in `Page`');
  lines.push(`- Parent lookup depth: ${report.input.parentLookupDepth}`);
  lines.push(`- Publish reference include depth: ${report.input.publishIncludeDepth}`);
  lines.push(`- Publish interval: ${report.input.publishIntervalMs} ms`);
  lines.push(`- Request throttle: ${report.input.requestThrottle} requests/second`);
  if (report.mode === 'dry-run') {
    lines.push('- Contentful writes: none. Re-run with `--yes` after reviewing this report.');
  }
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Source files | ${report.summary.sourceFiles} |`);
  lines.push(`| Input entities | ${report.summary.inputEntities} |`);
  lines.push(`| Direct page inputs | ${report.summary.directPageInputs} |`);
  lines.push(`| Non-page inputs resolved to pages | ${report.summary.resolvedNonPageInputs} |`);
  lines.push(`| Inputs without parent page | ${report.summary.noParentPageInputs} |`);
  lines.push(`| Missing entries | ${report.summary.missingEntries} |`);
  lines.push(`| Missing assets | ${report.summary.missingAssets} |`);
  lines.push(`| Target pages | ${report.summary.targetPages} |`);
  lines.push(`| Duplicate target page references | ${report.summary.duplicateTargetPageReferences} |`);
  lines.push(`| Publish groups | ${report.summary.publishGroups} |`);
  lines.push(`| Publish groups that would publish | ${report.summary.publishGroupsWouldPublish} |`);
  lines.push(`| Publish groups published | ${report.summary.publishGroupsPublished} |`);
  lines.push(`| Publish groups not needed | ${report.summary.publishGroupsNotNeeded} |`);
  lines.push(`| Publish groups blocked | ${report.summary.publishGroupsBlocked} |`);
  lines.push(`| Publish groups failed | ${report.summary.publishGroupsFailed} |`);
  lines.push(`| Candidate entries | ${report.summary.totalCandidateEntries} |`);
  lines.push(`| Candidate assets | ${report.summary.totalCandidateAssets} |`);
  lines.push(`| References discovered | ${report.summary.totalReferences} |`);
  lines.push(`| References that would publish | ${report.summary.totalCandidateReferences} |`);
  lines.push(`| Reference entries that would publish | ${report.summary.totalCandidateReferenceEntries} |`);
  lines.push(`| Reference assets that would publish | ${report.summary.totalCandidateReferenceAssets} |`);
  lines.push(`| Published entries | ${report.summary.totalPublishedEntries} |`);
  lines.push(`| Published assets | ${report.summary.totalPublishedAssets} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  lines.push('## Source Resolution');
  lines.push('');
  lines.push('| # | Row | Kind | Entity ID | Content type | Status | Action | Target pages |');
  lines.push('| ---: | --- | --- | --- | --- | --- | --- | --- |');
  report.sources.forEach((source, index) => {
    lines.push(
      `| ${index + 1} | ${markdownTableCell(formatSourcePointer(source))} | ${source.kind} | ${markdownTableCell(source.id)} | ${markdownTableCell(source.sourceContentType ?? '')} | ${markdownTableCell(source.sourceStatus ?? '')} | ${source.action} | ${markdownTableCell(source.targetPageIds.join(', '))} |`
    );
  });
  lines.push('');

  for (const source of report.sources) {
    if (source.warnings.length === 0 && source.errors.length === 0 && source.referencePaths.length === 0) {
      continue;
    }

    lines.push(`### Source ${source.id}`);
    lines.push('');
    lines.push(`- File row: ${formatSourcePointer(source)}`);
    lines.push(`- Entity URL: ${source.contentfulUrl}`);
    if (source.sourceName) {
      lines.push(`- Name: ${source.sourceName}`);
    }
    if (source.referencePaths.length > 0) {
      lines.push('- Reference path(s):');
      for (const referencePath of source.referencePaths) {
        lines.push(`  - ${referencePath.join(' -> ')}`);
      }
    }
    for (const warning of source.warnings) {
      lines.push(`- Warning: ${warning}`);
    }
    for (const error of source.errors) {
      lines.push(`- Error: ${error}`);
    }
    lines.push('');
  }

  lines.push('## Publish Groups');
  lines.push('');
  lines.push('| Page ID | Action | References to publish | Reference entries | Reference assets | References discovered | Page entry publishes |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const group of report.publishGroups) {
    const referencesToPublish = group.referenceCandidateEntryCount + group.referenceCandidateAssetCount;
    const referencesDiscovered = group.referenceTotalEntryCount + group.referenceTotalAssetCount;
    lines.push(
      `| ${markdownTableCell(group.pageId)} | ${group.action} | ${referencesToPublish} | ${group.referenceCandidateEntryCount} | ${group.referenceCandidateAssetCount} | ${referencesDiscovered} | ${group.pageWillPublish ? 'yes' : 'no'} |`
    );
  }
  lines.push('');

  for (const group of report.publishGroups) {
    lines.push(`### ${group.pageId}`);
    lines.push('');
    lines.push(`- Action: ${group.action}`);
    lines.push(`- Page name: ${group.pageName || 'n/a'}`);
    lines.push(`- Content type: ${group.contentType || 'n/a'}`);
    lines.push(`- Slug: ${group.pageSlug || 'n/a'}`);
    lines.push(`- Page status before run: ${group.pageStatus || 'n/a'}`);
    lines.push(`- Source rows: ${group.sourceRows.join('; ') || 'n/a'}`);
    lines.push(
      `- References to publish with page: ${group.referenceCandidateEntryCount + group.referenceCandidateAssetCount} ` +
      `(${group.referenceCandidateEntryCount} entries, ${group.referenceCandidateAssetCount} assets)`
    );
    lines.push(
      `- References discovered: ${group.referenceTotalEntryCount + group.referenceTotalAssetCount} ` +
      `(${group.referenceTotalEntryCount} entries, ${group.referenceTotalAssetCount} assets)`
    );
    lines.push(`- Page entry will publish: ${group.pageWillPublish ? 'yes' : 'no'}`);
    lines.push(`- Candidate entries: ${group.candidateEntryCount}`);
    lines.push(`- Candidate assets: ${group.candidateAssetCount}`);
    if (group.bulkActionId) {
      lines.push(`- Bulk action ID: ${group.bulkActionId}`);
    }
    for (const warning of group.warnings) {
      lines.push(`- Warning: ${warning}`);
    }
    for (const error of group.errors) {
      lines.push(`- Error: ${error}`);
    }
    lines.push('');
    lines.push('| Entity | Kind | Content type | Role | Status | Publish action |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const resource of group.resources) {
      lines.push(
        `| ${markdownTableCell(resource.id)} | ${resource.linkType} | ${markdownTableCell(resource.contentType ?? '')} | ${resource.role} | ${markdownTableCell(resource.status)} | ${resource.action} |`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function fetchEntries(
  context: ContentfulContext,
  query: Record<string, string>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<any[]> {
  const entries: any[] = [];
  let limit = Math.max(1, Math.min(pageSize, 1000));
  let skip = 0;
  let total = 0;

  while (true) {
    try {
      const response = await context.environment.getEntries({
        ...query,
        limit,
        skip
      });
      const items = (response?.items ?? []) as any[];
      entries.push(...items);
      total = Number(response?.total ?? 0);
      skip += limit;

      if (skip >= total) {
        break;
      }
    } catch (error) {
      if (limit > 1 && isResponseSizeTooBigError(error)) {
        limit = Math.max(1, Math.floor(limit / 2));
        continue;
      }

      throw error;
    }
  }

  return entries;
}

async function fetchEntriesByIds(
  context: ContentfulContext,
  entryIds: string[]
): Promise<Map<string, any>> {
  const entriesById = new Map<string, any>();
  const uniqueIds = [...new Set(entryIds)].filter(Boolean);
  for (const batch of chunk(uniqueIds, 100)) {
    const response = await context.environment.getEntries({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    for (const entry of (response?.items ?? []) as any[]) {
      const entryId = stringValue(entry?.sys?.id);
      if (entryId) {
        entriesById.set(entryId, entry);
      }
    }
  }

  return entriesById;
}

async function fetchAssetsByIds(
  context: ContentfulContext,
  assetIds: string[]
): Promise<Map<string, any>> {
  const assetsById = new Map<string, any>();
  const uniqueIds = [...new Set(assetIds)].filter(Boolean);
  for (const batch of chunk(uniqueIds, 100)) {
    const response = await context.environment.getAssets({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    for (const asset of (response?.items ?? []) as any[]) {
      const assetId = stringValue(asset?.sys?.id);
      if (assetId) {
        assetsById.set(assetId, asset);
      }
    }
  }

  return assetsById;
}

async function readXlsxFirstSheet(filePath: string): Promise<string[][]> {
  const archive = readZipEntries(await readFile(filePath));
  const sharedStrings = parseSharedStrings(archive.get('xl/sharedStrings.xml')?.toString('utf8') ?? '');
  const sheetPath = resolveFirstWorksheetPath(archive) ?? 'xl/worksheets/sheet1.xml';
  const sheetXml = archive.get(sheetPath)?.toString('utf8');
  if (!sheetXml) {
    throw new Error(`Unable to find first worksheet in ${filePath}.`);
  }

  return parseWorksheetRows(sheetXml, sharedStrings);
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new Error('Invalid XLSX file: ZIP end of central directory was not found.');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid XLSX file: central directory entry was malformed.');
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid XLSX file: local header missing for ${fileName}.`);
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = compressionMethod === 0
      ? Buffer.from(compressed)
      : compressionMethod === 8
        ? inflateRawSync(compressed)
        : undefined;

    if (!content) {
      throw new Error(`Unsupported XLSX ZIP compression method ${compressionMethod} for ${fileName}.`);
    }

    entries.set(fileName, content);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function resolveFirstWorksheetPath(archive: Map<string, Buffer>): string | undefined {
  const workbookXml = archive.get('xl/workbook.xml')?.toString('utf8');
  const relsXml = archive.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbookXml || !relsXml) {
    return undefined;
  }

  const sheetMatch = workbookXml.match(/<sheet\b([^>]*)\/?>/);
  const relationshipId = sheetMatch ? readXmlAttribute(sheetMatch[1] ?? '', 'r:id') : undefined;
  if (!relationshipId) {
    return undefined;
  }

  const relRegex = /<Relationship\b([^>]*)\/?>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    const attributes = relMatch[1] ?? '';
    if (readXmlAttribute(attributes, 'Id') !== relationshipId) {
      continue;
    }

    const target = readXmlAttribute(attributes, 'Target');
    if (!target) {
      return undefined;
    }

    return target.startsWith('/')
      ? target.replace(/^\/+/, '')
      : path.posix.normalize(path.posix.join('xl', target));
  }

  return undefined;
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) {
    return [];
  }

  const values: string[] = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    values.push(extractTextFromXmlFragment(match[1] ?? ''));
  }

  return values;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowAttributes = rowMatch[1] ?? '';
    const rowNumber = Number(readXmlAttribute(rowAttributes, 'r') ?? rows.length + 1);
    const row: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[2] ?? '')) !== null) {
      const cellAttributes = cellMatch[1] ?? '';
      const cellReference = readXmlAttribute(cellAttributes, 'r');
      const columnIndex = cellReference ? columnIndexFromCellReference(cellReference) : row.length;
      row[columnIndex] = parseCellValue(cellAttributes, cellMatch[2] ?? '', sharedStrings);
    }

    if (row.some((cell) => (cell ?? '').trim() !== '')) {
      rows[rowNumber - 1] = row.map((cell) => cell ?? '');
    }
  }

  const finalRows: string[][] = [];
  for (let index = 0; index < rows.length; index += 1) {
    finalRows.push(rows[index] ?? []);
  }

  return finalRows;
}

function parseCellValue(attributes: string, body: string, sharedStrings: string[]): string {
  const type = readXmlAttribute(attributes, 't');
  if (type === 'inlineStr') {
    return extractTextFromXmlFragment(body);
  }

  const rawValue = extractFirstXmlElementText(body, 'v');
  if (type === 's') {
    return sharedStrings[Number(rawValue)] ?? '';
  }
  if (type === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }

  return decodeXmlEntities(rawValue);
}

function parseDelimitedRows(content: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inQuotes) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (content[index + 1] === '\n') {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error('Delimited input has an unterminated quoted field.');
  }

  if (field.length > 0 || row.length > 0 || (content.length > 0 && !content.endsWith('\n') && !content.endsWith('\r'))) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function extractEntityReferencesFromCell(value: string): Array<{ id: string; kind: InputEntityKind }> {
  const trimmed = value.trim();
  if (!trimmed || HEADER_LIKE_VALUES.has(normalizeHeaderName(trimmed))) {
    return [];
  }

  const references: Array<{ id: string; kind: InputEntityKind }> = [];
  const contentfulUrlRegex = /https?:\/\/app\.contentful\.com\/[^\s,;]+/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = contentfulUrlRegex.exec(trimmed)) !== null) {
    const parsed = parseContentfulEntityUrl(urlMatch[0] ?? '');
    if (parsed) {
      references.push(parsed);
    }
  }

  const withoutUrls = trimmed.replace(contentfulUrlRegex, ' ');
  const tokens = withoutUrls.split(/[\s,;|]+/).map((token) => token.trim()).filter(Boolean);
  for (const token of tokens) {
    const cleaned = token.replace(/^["'(<[]+|[)"'\]>.,]+$/g, '');
    if (isLikelyContentfulResourceId(cleaned) && !HEADER_LIKE_VALUES.has(normalizeHeaderName(cleaned))) {
      references.push({
        id: cleaned,
        kind: 'entry'
      });
    }
  }

  return dedupeReferences(references);
}

function parseContentfulEntityUrl(value: string): { id: string; kind: InputEntityKind } | undefined {
  const entryMatch = value.match(/\/entries\/([^/?#]+)/i);
  if (entryMatch?.[1]) {
    return {
      id: decodeURIComponent(entryMatch[1]),
      kind: 'entry'
    };
  }

  const assetMatch = value.match(/\/assets\/([^/?#]+)/i);
  if (assetMatch?.[1]) {
    return {
      id: decodeURIComponent(assetMatch[1]),
      kind: 'asset'
    };
  }

  return undefined;
}

function dedupeReferences(
  references: Array<{ id: string; kind: InputEntityKind }>
): Array<{ id: string; kind: InputEntityKind }> {
  const seen = new Set<string>();
  const deduped: Array<{ id: string; kind: InputEntityKind }> = [];
  for (const reference of references) {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(reference);
  }

  return deduped;
}

function findInputHeaderColumn(row: string[]): number {
  return row.findIndex((cell) => HEADER_LIKE_VALUES.has(normalizeHeaderName(cell)));
}

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isLikelyContentfulResourceId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/.test(value);
}

function getResourcePublishAction(entity: any): ResourcePublishAction {
  if (!entity) {
    return 'missing';
  }

  if (isArchived(entity)) {
    return 'skipped-archived';
  }

  return isPublishedAndClean(entity) ? 'already-published' : 'publish';
}

function getEntityStatus(entity: any): string {
  if (!entity) {
    return 'missing';
  }

  if (isArchived(entity)) {
    return 'archived';
  }

  if (isPublished(entity) && isUpdated(entity)) {
    return 'published with unpublished changes';
  }

  if (isPublished(entity)) {
    return 'published';
  }

  if (typeof entity?.isDraft === 'function' && entity.isDraft()) {
    return 'draft';
  }

  return 'unpublished';
}

function isArchived(entity: any): boolean {
  return typeof entity?.isArchived === 'function'
    ? entity.isArchived()
    : Boolean(entity?.sys?.archivedVersion);
}

function isPublished(entity: any): boolean {
  return typeof entity?.isPublished === 'function'
    ? entity.isPublished()
    : Boolean(entity?.sys?.publishedVersion);
}

function isPublishedAndClean(entity: any): boolean {
  return isPublished(entity) && !isUpdated(entity);
}

function isUpdated(entity: any): boolean {
  return typeof entity?.isUpdated === 'function'
    ? entity.isUpdated()
    : Boolean(entity?.sys?.publishedVersion && entity?.sys?.version > entity.sys.publishedVersion + 1);
}

function getEntryContentType(entry: any): string {
  return stringValue(entry?.sys?.contentType?.sys?.id);
}

function isPageContentType(contentType: string, configuredPageContentTypes: Set<string>): boolean {
  return configuredPageContentTypes.has(contentType) || contentType.toLowerCase().endsWith('page');
}

function formatEntryDisplayName(entry: any): string {
  return (
    formatFieldValue(entry, 'internalName') ||
    formatFieldValue(entry, 'title') ||
    formatFieldValue(entry, 'name') ||
    stringValue(entry?.sys?.id)
  );
}

function formatAssetName(asset: any): string {
  return (
    formatFieldValue(asset, 'title') ||
    formatFieldValue(asset, 'file') ||
    stringValue(asset?.sys?.id)
  );
}

function formatFieldValue(entry: any, fieldId: string): string {
  const rawValue = entry?.fields?.[fieldId];
  const values = isLocalizedFieldMap(rawValue)
    ? Object.values(rawValue)
    : rawValue === undefined
      ? []
      : [rawValue];

  for (const value of values) {
    const formatted = stringifyFieldValue(value);
    if (formatted) {
      return formatted;
    }
  }

  return '';
}

function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value) && isRecord(value.file) && typeof value.file.fileName === 'string') {
    return value.file.fileName;
  }

  return '';
}

function isLocalizedFieldMap(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'sys') &&
    !Object.prototype.hasOwnProperty.call(value, 'nodeType')
  );
}

function contentfulEntityUrl(
  context: ContentfulContext,
  linkType: EntityLinkType,
  id: string
): string {
  const collection = linkType === 'Asset' ? 'assets' : 'entries';
  return `https://app.contentful.com/spaces/${encodeURIComponent(
    context.spaceId
  )}/environments/${encodeURIComponent(context.environmentId)}/${collection}/${encodeURIComponent(id)}`;
}

function formatSourcePointer(source: Pick<SourceResolution, 'filePath' | 'rowNumber' | 'columnNumber'>): string {
  return `${path.basename(source.filePath)}:${source.rowNumber}:${source.columnNumber}`;
}

function comparePublishResources(left: PublishResource, right: PublishResource): number {
  const leftRole = left.role === 'page' ? 1 : 0;
  const rightRole = right.role === 'page' ? 1 : 0;
  return (
    leftRole - rightRole ||
    left.linkType.localeCompare(right.linkType) ||
    (left.contentType ?? '').localeCompare(right.contentType ?? '') ||
    left.id.localeCompare(right.id)
  );
}

function columnIndexFromCellReference(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return Math.max(0, index - 1);
}

function extractFirstXmlElementText(xml: string, elementName: string): string {
  const regex = new RegExp(`<${elementName}\\b[^>]*>([\\s\\S]*?)<\\/${elementName}>`);
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1] ?? '') : '';
}

function extractTextFromXmlFragment(xml: string): string {
  const texts: string[] = [];
  const regex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    texts.push(decodeXmlEntities(match[1] ?? ''));
  }

  return texts.join('');
}

function readXmlAttribute(attributes: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`));
  return match?.[1] ? decodeXmlEntities(match[1]) : undefined;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity === 'amp') {
      return '&';
    }
    if (entity === 'lt') {
      return '<';
    }
    if (entity === 'gt') {
      return '>';
    }
    if (entity === 'quot') {
      return '"';
    }
    if (entity === 'apos') {
      return "'";
    }
    if (entity.toLowerCase().startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return match;
  });
}

function entityKey(value: { id: string; linkType: EntityLinkType }): string {
  return `${value.linkType}:${value.id}`;
}

function isResource(value: unknown, linkType: EntityLinkType): boolean {
  return isRecord(value) && stringValue(value.sys?.type) === linkType && isRecord(value.fields);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseListFlag(flags: CliFlags, name: string): string[] | undefined {
  const value = flags[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    throw new Error(`--${name} must include at least one comma-separated value.`);
  }

  return items;
}

function stringFlag(flags: CliFlags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
}

function hasAnyFlag(flags: CliFlags, names: string[]): boolean {
  return names.some((name) => flags[name] !== undefined);
}

function parsePositiveIntegerFlag(flags: CliFlags, names: string[]): number | undefined {
  for (const name of names) {
    const value = flags[name];
    if (value === undefined || value === true) {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`--${name} must be a positive integer.`);
    }

    return parsed;
  }

  return undefined;
}

function parseNonNegativeIntegerFlag(flags: CliFlags, names: string[]): number | undefined {
  for (const name of names) {
    const value = flags[name];
    if (value === undefined || value === true) {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`--${name} must be a non-negative integer.`);
    }

    return parsed;
  }

  return undefined;
}

function parseIntegerInRangeFlag(
  flags: CliFlags,
  names: string[],
  minimum: number,
  maximum: number
): number | undefined {
  for (const name of names) {
    const value = flags[name];
    if (value === undefined || value === true) {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new Error(`--${name} must be an integer from ${minimum} to ${maximum}.`);
    }

    return parsed;
  }

  return undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function isResponseSizeTooBigError(error: unknown): boolean {
  const record = isRecord(error) ? error : {};
  const messages = [
    record.message,
    isRecord(record.details) ? record.details.message : undefined,
    isRecord(record.response) && isRecord(record.response.data) ? record.response.data.message : undefined
  ];

  return messages.some(
    (message) => typeof message === 'string' && message.includes('Response size too big')
  );
}

function isVersionMismatchError(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  const text = error instanceof Error
    ? `${error.name}\n${error.message}`
    : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  return /VersionMismatch|version mismatch/i.test(text);
}

function formatBulkActionError(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.error)) {
    return '';
  }

  const error = value.error;
  const message = typeof error.message === 'string' ? error.message : '';
  const details = isRecord(error.details) && Array.isArray(error.details.errors)
    ? error.details.errors
      .map((item: unknown) => JSON.stringify(item))
      .join('; ')
    : '';
  const parts = [message, details].filter(Boolean);
  return parts.length > 0 ? `: ${parts.join('; ')}` : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
