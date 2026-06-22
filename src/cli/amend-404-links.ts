import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  type ContentfulContext
} from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'amendments', '404-links-with-replacements.csv');
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_REFERENCE_INCLUDE_DEPTH = 10;
const DEFAULT_REQUEST_THROTTLE = 25;
const DEFAULT_PUBLISH_INTERVAL_MS = 5000;
const DEFAULT_PUBLISH_INCLUDE_DEPTH = 2;
const PAGE_CONTENT_TYPE_IDS = [
  'listingPage',
  'searchPage',
  'resourcePage',
  'homePage',
  'contentPage'
];
const SOURCE_COLUMN = 'Source';
const DESTINATION_COLUMN = 'Destination';
const REPLACEMENT_LINK_COLUMN = 'Replacement link';
const ANCHOR_COLUMN = 'Anchor';
const LINK_PATH_COLUMN = 'Link Path';
const LINK_ORIGIN_COLUMN = 'Link Origin';
const LINK_MAPPING_STATUS_COLUMN = 'Link mapping status';
const CTA_CONTENT_TYPE_ID = 'ctaItem';
const CTA_INTERNAL_LINK_FIELD_ID = 'link';
const CTA_USE_EXTERNAL_LINK_FIELD_ID = 'useExternalLink';
const CTA_EXTERNAL_URL_FIELD_IDS = new Set(['externalUrl', 'fallbackUrl']);
const STRING_URL_FIELD_IDS_BY_CONTENT_TYPE = new Map<string, Set<string>>([
  [CTA_CONTENT_TYPE_ID, CTA_EXTERNAL_URL_FIELD_IDS],
  ['videoItem', new Set(['embeddedVideo'])]
]);

type LinkFieldKind = 'rich-text' | 'string-url' | 'entry-link';
type RowAction =
  | 'skipped-empty-row'
  | 'skipped-missing-source'
  | 'skipped-missing-destination'
  | 'skipped-missing-replacement'
  | 'source-page-not-found'
  | 'source-page-ambiguous'
  | 'replacement-page-not-found'
  | 'replacement-page-ambiguous'
  | 'internal-link-recorded'
  | 'unsupported-fixable-field'
  | 'link-not-found'
  | 'would-update-internal-and-publish'
  | 'would-update-internal-draft'
  | 'updated-internal-and-published'
  | 'updated-internal-draft'
  | 'update-failed';

interface CommandConfig {
  allowNonSandbox: boolean;
  dryRun: boolean;
  environmentId: string;
  inputPath: string;
  limit?: number;
  locale?: string;
  pageSize: number;
  publish: boolean;
  publishIncludeDepth: number;
  publishIntervalMs: number;
  referenceIncludeDepth: number;
  requestThrottle: number;
  startRow: number;
}

interface CsvTable {
  rows: string[][];
}

interface SelectedCsvRow {
  csvLineNumber: number;
  dataRowNumber: number;
  row: string[];
  selectionIndex: number;
}

interface ColumnIndices {
  anchor: number;
  destination: number;
  linkMappingStatus: number;
  linkOrigin: number;
  linkPath: number;
  replacementLink: number;
  source: number;
}

interface LinkFieldDefinition {
  fieldId: string;
  kind: LinkFieldKind;
}

interface PageMatch {
  contentType: string;
  entryId: string;
  internalName: string;
  locale?: string;
  slug: string;
}

interface PageIndex {
  entriesById: Map<string, any>;
  entriesScanned: number;
  matchesBySlug: Map<string, PageMatch[]>;
}

interface PageGraph {
  entriesById: Map<string, any>;
  rootPageId: string;
}

interface LinkMatch {
  contentType: string;
  count: number;
  entryId: string;
  entryName?: string;
  fieldId: string;
  kind: LinkFieldKind;
  locale?: string;
  targetEntryId?: string;
  targetFieldId?: string;
}

interface RowPlan {
  action: RowAction;
  anchor?: string;
  contentfulSourcePage?: PageMatch;
  csvLineNumber: number;
  dataRowNumber: number;
  destination: string;
  destinationSlug?: string;
  errors: string[];
  externalMatches: LinkMatch[];
  internalMatches: LinkMatch[];
  linkMappingStatus?: string;
  linkOrigin?: string;
  linkPath?: string;
  occurrenceCount: number;
  replacementLink: string;
  replacementSlug?: string;
  replacementTarget?: PageMatch;
  selectionIndex: number;
  source: string;
  sourcePageMatches: PageMatch[];
  sourceSlug?: string;
  totalSelectedRows: number;
  warnings: string[];
}

interface PublishGroup {
  changedEntryIds: string[];
  key: string;
  plans: RowPlan[];
  sourcePageId: string;
}

interface AmendmentReport {
  environmentId: string;
  generatedAt: string;
  input: {
    inputPath: string;
    limit?: number;
    locale?: string;
    publish: boolean;
    publishIncludeDepth: number;
    publishIntervalMs: number;
    referenceIncludeDepth: number;
    requestThrottle: number;
    startRow: number;
  };
  mode: 'dry-run' | 'apply';
  rows: RowPlan[];
  spaceId?: string;
  summary: ReportSummary;
}

interface ReportSummary {
  ambiguousReplacementPages: number;
  ambiguousSourcePages: number;
  entriesScannedForPageLookup: number;
  errors: number;
  internalLinksRecorded: number;
  linkNotFoundRows: number;
  missingReplacementPages: number;
  missingSourcePages: number;
  rowsSelected: number;
  rowsUpdated: number;
  rowsWouldUpdate: number;
  unsupportedFixableRows: number;
  warnings: number;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'amend-404-links');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);

  logger.info(commandConfig.dryRun ? 'Preparing 404 link amendment dry run' : 'Preparing 404 link amendment apply run', {
    environmentId: commandConfig.environmentId,
    inputPath: commandConfig.inputPath,
    limit: commandConfig.limit,
    locale: commandConfig.locale ?? 'all',
    publish: commandConfig.publish,
    referenceIncludeDepth: commandConfig.referenceIncludeDepth,
    requestThrottle: commandConfig.requestThrottle,
    startRow: commandConfig.startRow
  });

  const csv = await readFile(commandConfig.inputPath, 'utf8');
  const table = parseCsvTable(csv);
  if (table.rows.length === 0) {
    throw new Error(`CSV file is empty: ${commandConfig.inputPath}`);
  }

  const header = table.rows[0];
  if (!header) {
    throw new Error(`CSV file has no header row: ${commandConfig.inputPath}`);
  }

  const columns = resolveColumnIndices(header);
  const selectedRows = selectRows(table, commandConfig);
  if (selectedRows.length === 0) {
    throw new Error(
      `No data rows matched --start-row ${commandConfig.startRow}` +
      `${commandConfig.limit ? ` --limit ${commandConfig.limit}` : ''}.`
    );
  }

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  }, {
    throttle: commandConfig.requestThrottle
  });

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  logger.info('Building page slug index', {
    contentTypes: PAGE_CONTENT_TYPE_IDS,
    pageSize: commandConfig.pageSize
  });
  const pageIndex = await buildPageIndex(context, commandConfig, logger);
  const fieldDefinitions = await discoverLinkFieldDefinitions(context);
  const plans = await buildPlans(context, commandConfig, selectedRows, columns, pageIndex, fieldDefinitions, logger);
  markDryRunActions(plans, commandConfig);

  if (!commandConfig.dryRun) {
    await applyChanges(context, commandConfig, plans, logger);

    if (commandConfig.publish) {
      const publishGroups = buildPublishGroups(plans);
      await publishChangedPages(context, commandConfig, publishGroups, logger);
    }
  }

  const report = buildReport(projectConfig, commandConfig, plans, pageIndex);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);
  logger.info(commandConfig.dryRun ? '404 link amendment dry run finished' : '404 link amendment apply run finished', {
    markdownReport: reportPaths.markdownPath,
    jsonReport: reportPaths.jsonPath,
    ...report.summary
  });
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
    locale: stringFlag(flags, 'locale'),
    pageSize: parsePositiveIntegerFlag(flags, ['page-size']) ?? DEFAULT_PAGE_SIZE,
    publish: !flags['no-publish'],
    publishIncludeDepth: parseIntegerInRangeFlag(flags, ['publish-include-depth', 'include-depth'], 1, 10) ?? DEFAULT_PUBLISH_INCLUDE_DEPTH,
    publishIntervalMs: parseNonNegativeIntegerFlag(flags, ['publish-interval-ms', 'publish-delay-ms']) ?? DEFAULT_PUBLISH_INTERVAL_MS,
    referenceIncludeDepth: parseIntegerInRangeFlag(flags, ['reference-include-depth', 'reference-depth'], 1, 10) ?? DEFAULT_REFERENCE_INCLUDE_DEPTH,
    requestThrottle: parseIntegerInRangeFlag(flags, ['throttle', 'request-throttle'], 1, 30) ?? DEFAULT_REQUEST_THROTTLE,
    startRow: row ?? parsePositiveIntegerFlag(flags, ['start-row', 'start', 'from-row']) ?? 1
  };
}

function resolveColumnIndices(header: string[]): ColumnIndices {
  return {
    anchor: findColumnIndex(header, ANCHOR_COLUMN),
    destination: requireColumn(header, DESTINATION_COLUMN),
    linkMappingStatus: findColumnIndex(header, LINK_MAPPING_STATUS_COLUMN),
    linkOrigin: findColumnIndex(header, LINK_ORIGIN_COLUMN),
    linkPath: findColumnIndex(header, LINK_PATH_COLUMN),
    replacementLink: requireColumn(header, REPLACEMENT_LINK_COLUMN),
    source: requireColumn(header, SOURCE_COLUMN)
  };
}

function selectRows(table: CsvTable, commandConfig: CommandConfig): SelectedCsvRow[] {
  const dataRows = table.rows.slice(1);
  const startIndex = commandConfig.startRow - 1;
  const endIndex = commandConfig.limit === undefined
    ? dataRows.length
    : startIndex + commandConfig.limit;
  return dataRows.slice(startIndex, endIndex).map((row, index) => ({
    csvLineNumber: commandConfig.startRow + index + 1,
    dataRowNumber: commandConfig.startRow + index,
    row,
    selectionIndex: index + 1
  }));
}

async function buildPageIndex(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  logger: Logger
): Promise<PageIndex> {
  const entriesById = new Map<string, any>();
  const matchesBySlug = new Map<string, PageMatch[]>();
  let entriesScanned = 0;

  for (const contentType of PAGE_CONTENT_TYPE_IDS) {
    const entries = await fetchEntries(context, { content_type: contentType }, commandConfig.pageSize);
    entriesScanned += entries.length;
    logger.info('Scanned pages for source/replacement lookup', {
      contentType,
      entries: entries.length
    });

    for (const entry of entries) {
      const entryId = stringValue(entry?.sys?.id);
      if (!entryId) {
        continue;
      }
      entriesById.set(entryId, entry);
      const internalName = firstLocalizedStringValue(entry, 'internalName') ?? '';
      const seen = new Set<string>();
      for (const fieldValue of getFieldValues(entry, 'slug')) {
        const slug = normalizeSlugForLookup(stringifyStringFieldValue(fieldValue.value));
        const key = `${fieldValue.locale ?? ''}:${slug}`;
        if (!slug || seen.has(key)) {
          continue;
        }
        seen.add(key);
        const matches = matchesBySlug.get(slug) ?? [];
        matches.push({
          contentType,
          entryId,
          internalName,
          locale: fieldValue.locale,
          slug
        });
        matchesBySlug.set(slug, matches);
      }
    }
  }

  return {
    entriesById,
    entriesScanned,
    matchesBySlug
  };
}

async function discoverLinkFieldDefinitions(
  context: ContentfulContext
): Promise<Map<string, LinkFieldDefinition[]>> {
  const result = await context.environment.getContentTypes();
  const definitionsByContentType = new Map<string, LinkFieldDefinition[]>();

  for (const contentType of (result?.items ?? []) as any[]) {
    const contentTypeId = stringValue(contentType?.sys?.id);
    if (!contentTypeId) {
      continue;
    }

    const definitions: LinkFieldDefinition[] = [];
    for (const field of (contentType?.fields ?? []) as any[]) {
      const fieldId = stringValue(field?.id);
      if (!fieldId) {
        continue;
      }

      if (field?.type === 'RichText') {
        definitions.push({ fieldId, kind: 'rich-text' });
      } else if (stringFieldCanHoldUrl(contentTypeId, field)) {
        definitions.push({ fieldId, kind: 'string-url' });
      } else if (fieldIsEntryLink(field)) {
        definitions.push({ fieldId, kind: 'entry-link' });
      }
    }
    definitionsByContentType.set(contentTypeId, definitions);
  }

  return definitionsByContentType;
}

async function buildPlans(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  selectedRows: SelectedCsvRow[],
  columns: ColumnIndices,
  pageIndex: PageIndex,
  fieldDefinitions: Map<string, LinkFieldDefinition[]>,
  logger: Logger
): Promise<RowPlan[]> {
  const plans: RowPlan[] = [];
  const graphCache = new Map<string, Promise<PageGraph>>();
  const totalSelectedRows = selectedRows.length;

  for (const selectedRow of selectedRows) {
    ensureRowLength(selectedRow.row, maxColumnIndex(columns) + 1);
    const source = normalizeCellValue(selectedRow.row[columns.source] ?? '');
    const destination = normalizeCellValue(selectedRow.row[columns.destination] ?? '');
    const replacementLink = normalizeCellValue(selectedRow.row[columns.replacementLink] ?? '');
    const basePlan: RowPlan = {
      action: 'skipped-empty-row',
      anchor: optionalCellValue(selectedRow.row, columns.anchor),
      csvLineNumber: selectedRow.csvLineNumber,
      dataRowNumber: selectedRow.dataRowNumber,
      destination,
      errors: [],
      externalMatches: [],
      internalMatches: [],
      linkMappingStatus: optionalCellValue(selectedRow.row, columns.linkMappingStatus),
      linkOrigin: optionalCellValue(selectedRow.row, columns.linkOrigin),
      linkPath: optionalCellValue(selectedRow.row, columns.linkPath),
      occurrenceCount: 0,
      replacementLink,
      selectionIndex: selectedRow.selectionIndex,
      source,
      sourcePageMatches: [],
      totalSelectedRows,
      warnings: []
    };

    logger.info(`row ${selectedRow.selectionIndex}/${totalSelectedRows} resolving page`, {
      dataRow: selectedRow.dataRowNumber,
      source: source || 'missing',
      destination: destination || 'missing'
    });

    if (selectedRow.row.every((value) => normalizeCellValue(value) === '')) {
      basePlan.warnings.push('Row is empty.');
      plans.push(basePlan);
      continue;
    }
    if (!source) {
      basePlan.action = 'skipped-missing-source';
      basePlan.errors.push(`Missing ${SOURCE_COLUMN}.`);
      plans.push(basePlan);
      continue;
    }
    if (!destination) {
      basePlan.action = 'skipped-missing-destination';
      basePlan.errors.push(`Missing ${DESTINATION_COLUMN}.`);
      plans.push(basePlan);
      continue;
    }
    if (!replacementLink) {
      basePlan.action = 'skipped-missing-replacement';
      basePlan.errors.push(`Missing ${REPLACEMENT_LINK_COLUMN}.`);
      plans.push(basePlan);
      continue;
    }

    const sourceSlug = slugFromUrl(source);
    basePlan.sourceSlug = sourceSlug;
    const sourceMatches = sourceSlug ? pageIndex.matchesBySlug.get(sourceSlug) ?? [] : [];
    basePlan.sourcePageMatches = sourceMatches;
    if (sourceMatches.length === 0) {
      basePlan.action = 'source-page-not-found';
      basePlan.errors.push(`No Contentful page matched source slug ${sourceSlug || 'n/a'}.`);
      plans.push(basePlan);
      continue;
    }
    const sourcePage = selectUniquePageMatch(sourceMatches);
    if (!sourcePage) {
      basePlan.action = 'source-page-ambiguous';
      basePlan.errors.push(`Multiple Contentful pages matched source slug ${sourceSlug || 'n/a'}.`);
      plans.push(basePlan);
      continue;
    }
    basePlan.contentfulSourcePage = sourcePage;

    const replacementSlug = slugFromUrl(replacementLink);
    basePlan.replacementSlug = replacementSlug;
    const replacementMatches = replacementSlug ? pageIndex.matchesBySlug.get(replacementSlug) ?? [] : [];
    if (replacementMatches.length === 0) {
      basePlan.action = 'replacement-page-not-found';
      basePlan.errors.push(`No Contentful page matched replacement slug ${replacementSlug || 'n/a'}.`);
      plans.push(basePlan);
      continue;
    }
    const replacementTarget = selectUniquePageMatch(replacementMatches);
    if (!replacementTarget) {
      basePlan.action = 'replacement-page-ambiguous';
      basePlan.errors.push(`Multiple Contentful pages matched replacement slug ${replacementSlug || 'n/a'}.`);
      plans.push(basePlan);
      continue;
    }
    basePlan.replacementTarget = replacementTarget;

    const destinationSlug = slugFromUrl(destination);
    basePlan.destinationSlug = destinationSlug;
    const graph = await cachedPageGraph(context, graphCache, sourcePage.entryId, commandConfig.referenceIncludeDepth);
    logger.info(`row ${selectedRow.selectionIndex}/${totalSelectedRows} searching page references`, {
      dataRow: selectedRow.dataRowNumber,
      sourcePageId: sourcePage.entryId,
      entries: graph.entriesById.size
    });
    const scanResult = scanPageGraphForDestination(graph, destination, pageIndex, fieldDefinitions, commandConfig.locale);
    basePlan.externalMatches = scanResult.externalMatches;
    basePlan.internalMatches = scanResult.internalMatches;
    basePlan.occurrenceCount = [...scanResult.externalMatches, ...scanResult.internalMatches]
      .reduce((sum, match) => sum + match.count, 0);

    if (scanResult.externalMatches.length > 0) {
      const unsupported = scanResult.externalMatches.filter((match) => !isFixableExternalMatch(match));
      if (unsupported.length > 0 && unsupported.length === scanResult.externalMatches.length) {
        basePlan.action = 'unsupported-fixable-field';
        basePlan.errors.push(
          `Destination was found only in unsupported URL fields: ${unsupported.map(formatLinkMatchLocation).join(', ')}.`
        );
      } else {
        basePlan.action = 'link-not-found';
      }
      plans.push(basePlan);
      continue;
    }

    if (scanResult.internalMatches.length > 0) {
      basePlan.action = 'internal-link-recorded';
      basePlan.warnings.push('Destination is already represented by an internal Contentful link; no amendment planned.');
      plans.push(basePlan);
      continue;
    }

    basePlan.action = 'link-not-found';
    basePlan.errors.push(`Destination ${destination} was not found in the Contentful page graph for ${source}.`);
    plans.push(basePlan);
  }

  return plans;
}

function scanPageGraphForDestination(
  graph: PageGraph,
  destination: string,
  pageIndex: PageIndex,
  fieldDefinitions: Map<string, LinkFieldDefinition[]>,
  locale?: string
): { externalMatches: LinkMatch[]; internalMatches: LinkMatch[] } {
  const externalMatches: LinkMatch[] = [];
  const internalMatches: LinkMatch[] = [];

  for (const entry of graph.entriesById.values()) {
    const entryId = stringValue(entry?.sys?.id);
    const contentType = getEntryContentType(entry);
    if (!entryId || !contentType) {
      continue;
    }

    const definitions = fieldDefinitions.get(contentType) ?? [];
    for (const definition of definitions) {
      const fieldValue = entry?.fields?.[definition.fieldId];
      if (fieldValue === undefined) {
        continue;
      }

      if (definition.kind === 'rich-text') {
        for (const item of getLocalizedValuesFromField(fieldValue, locale)) {
          const externalCount = countRichTextHyperlinkUri(item.value, destination);
          if (externalCount > 0) {
            externalMatches.push({
              contentType,
              count: externalCount,
              entryId,
              entryName: firstLocalizedStringValue(entry, 'internalName'),
              fieldId: definition.fieldId,
              kind: 'rich-text',
              locale: item.locale
            });
          }

          const internalTargets = collectRichTextEntryHyperlinkTargets(item.value);
          for (const targetEntryId of internalTargets) {
            if (!pageTargetMatchesDestination(targetEntryId, destination, pageIndex)) {
              continue;
            }
            internalMatches.push({
              contentType,
              count: 1,
              entryId,
              entryName: firstLocalizedStringValue(entry, 'internalName'),
              fieldId: definition.fieldId,
              kind: 'entry-link',
              locale: item.locale,
              targetEntryId
            });
          }
        }
      } else if (definition.kind === 'string-url') {
        for (const item of getLocalizedValuesFromField(fieldValue, locale)) {
          const count = countStringUrlValue(item.value, destination);
          if (count > 0) {
            externalMatches.push({
              contentType,
              count,
              entryId,
              entryName: firstLocalizedStringValue(entry, 'internalName'),
              fieldId: definition.fieldId,
              kind: 'string-url',
              locale: item.locale,
              targetFieldId: contentType === CTA_CONTENT_TYPE_ID && CTA_EXTERNAL_URL_FIELD_IDS.has(definition.fieldId)
                ? CTA_INTERNAL_LINK_FIELD_ID
                : undefined
            });
          }
        }
      } else {
        for (const item of getLocalizedValuesFromField(fieldValue, locale)) {
          const targetEntryIds = collectEntryLinkFieldTargets(item.value);
          for (const targetEntryId of targetEntryIds) {
            if (!pageTargetMatchesDestination(targetEntryId, destination, pageIndex)) {
              continue;
            }
            internalMatches.push({
              contentType,
              count: 1,
              entryId,
              entryName: firstLocalizedStringValue(entry, 'internalName'),
              fieldId: definition.fieldId,
              kind: 'entry-link',
              locale: item.locale,
              targetEntryId
            });
          }
        }
      }
    }
  }

  return { externalMatches, internalMatches };
}

function markDryRunActions(plans: RowPlan[], commandConfig: CommandConfig): void {
  for (const plan of plans) {
    if (!isPlanReadyForUpdate(plan)) {
      continue;
    }
    plan.action = commandConfig.publish ? 'would-update-internal-and-publish' : 'would-update-internal-draft';
  }
}

async function applyChanges(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  plans: RowPlan[],
  logger: Logger
): Promise<void> {
  const readyPlans = plans.filter(isPlanReadyForUpdate);
  const plansByEntryId = new Map<string, RowPlan[]>();
  const entriesById = new Map<string, any>();

  for (const plan of readyPlans) {
    for (const match of plan.externalMatches.filter(isFixableExternalMatch)) {
      const plansForEntry = plansByEntryId.get(match.entryId) ?? [];
      if (!plansForEntry.includes(plan)) {
        plansForEntry.push(plan);
      }
      plansByEntryId.set(match.entryId, plansForEntry);
    }
  }

  for (const entryId of plansByEntryId.keys()) {
    const entry = await context.environment.getEntry(entryId);
    entriesById.set(entryId, entry);
  }

  for (const [entryId, entryPlans] of plansByEntryId) {
    const entry = entriesById.get(entryId);
    if (!entry) {
      continue;
    }

    logger.info('Updating entry for 404 link amendments', {
      entryId,
      rows: entryPlans.map((plan) => plan.dataRowNumber)
    });

    try {
      let changed = false;
      for (const plan of entryPlans) {
        if (!plan.replacementTarget) {
          continue;
        }

        for (const match of plan.externalMatches.filter((candidate) =>
          candidate.entryId === entryId && isFixableExternalMatch(candidate)
        )) {
          if (match.kind === 'rich-text') {
            const result = replaceRichTextHyperlinkField(
              entry,
              match.fieldId,
              plan.destination,
              plan.replacementTarget.entryId,
              commandConfig.locale
            );
            changed = result || changed;
          } else if (match.kind === 'string-url' && match.targetFieldId) {
            const result = replaceCtaStringUrlWithInternalReference(
              entry,
              match.fieldId,
              match.targetFieldId,
              plan.destination,
              plan.replacementTarget.entryId,
              commandConfig.locale
            );
            changed = result || changed;
          }
        }
      }

      if (!changed) {
        for (const plan of entryPlans) {
          plan.action = 'link-not-found';
          plan.errors.push(`Destination was not found when applying changes to entry ${entryId}.`);
        }
        continue;
      }

      await entry.update();
      for (const plan of entryPlans) {
        plan.action = 'updated-internal-draft';
      }
    } catch (error) {
      const message = errorMessage(error);
      logger.error('Failed to update entry for 404 link amendments', {
        entryId,
        error: message
      });
      for (const plan of entryPlans) {
        plan.action = 'update-failed';
        plan.errors.push(message);
      }
    }
  }
}

function buildPublishGroups(plans: RowPlan[]): PublishGroup[] {
  const groupsBySourcePageId = new Map<string, PublishGroup>();
  for (const plan of plans) {
    if (plan.action !== 'updated-internal-draft' || !plan.contentfulSourcePage) {
      continue;
    }

    const sourcePageId = plan.contentfulSourcePage.entryId;
    const group = groupsBySourcePageId.get(sourcePageId) ?? {
      changedEntryIds: [],
      key: `page:${sourcePageId}`,
      plans: [],
      sourcePageId
    };
    for (const match of plan.externalMatches.filter(isFixableExternalMatch)) {
      if (!group.changedEntryIds.includes(match.entryId)) {
        group.changedEntryIds.push(match.entryId);
      }
    }
    group.plans.push(plan);
    groupsBySourcePageId.set(sourcePageId, group);
  }

  return [...groupsBySourcePageId.values()].sort((left, right) => left.key.localeCompare(right.key));
}

async function publishChangedPages(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  publishGroups: PublishGroup[],
  logger: Logger
): Promise<void> {
  let lastPublishStartedAt = 0;

  for (const [index, group] of publishGroups.entries()) {
    const waitMs = index === 0
      ? 0
      : Math.max(0, commandConfig.publishIntervalMs - (Date.now() - lastPublishStartedAt));
    if (waitMs > 0) {
      logger.info('Waiting before next publish group', {
        groupIndex: index + 1,
        groupTotal: publishGroups.length,
        waitMs
      });
      await delay(waitMs);
    }

    lastPublishStartedAt = Date.now();
    logger.info('Publishing amended source page with references', {
      changedEntries: group.changedEntryIds.length,
      groupIndex: index + 1,
      groupTotal: publishGroups.length,
      sourcePageId: group.sourcePageId
    });

    try {
      const entriesById = await collectPublishGroupEntries(context, group, commandConfig.publishIncludeDepth);
      const candidates = await buildPublishCandidates(context, entriesById, group);
      const publishedCount = candidates.length > 0
        ? await publishBulkActionWithFreshVersions(context, group, candidates, logger)
        : 0;
      for (const plan of group.plans) {
        if (publishedCount > 0) {
          plan.action = 'updated-internal-and-published';
        }
      }
    } catch (error) {
      const message = errorMessage(error);
      logger.error('Failed to publish amended source page', {
        error: message,
        sourcePageId: group.sourcePageId
      });
      for (const plan of group.plans) {
        plan.errors.push(`Publish failed: ${message}`);
      }
    }
  }
}

async function cachedPageGraph(
  context: ContentfulContext,
  cache: Map<string, Promise<PageGraph>>,
  sourcePageId: string,
  includeDepth: number
): Promise<PageGraph> {
  const existing = cache.get(sourcePageId);
  if (existing) {
    return existing;
  }

  const promise = fetchPageGraph(context, sourcePageId, includeDepth);
  cache.set(sourcePageId, promise);
  return promise;
}

async function fetchPageGraph(
  context: ContentfulContext,
  sourcePageId: string,
  includeDepth: number
): Promise<PageGraph> {
  const entriesById = new Map<string, any>();
  const sourcePage = await context.environment.getEntry(sourcePageId);
  entriesById.set(sourcePageId, sourcePage);
  const references = await fetchEntryReferencesWithDepthFallback(context, sourcePageId, includeDepth);
  for (const entry of extractEntriesFromReferenceResponse(references)) {
    const entryId = stringValue(entry?.sys?.id);
    if (entryId) {
      entriesById.set(entryId, entry);
    }
  }

  return {
    entriesById,
    rootPageId: sourcePageId
  };
}

async function fetchEntryReferencesWithDepthFallback(
  context: ContentfulContext,
  entryId: string,
  includeDepth: number
): Promise<unknown> {
  for (let depth = includeDepth; depth >= 1; depth -= 1) {
    try {
      return await fetchEntryReferences(context, entryId, depth);
    } catch (error) {
      if (depth === 1 || !isTooManyLinksError(error)) {
        throw error;
      }
    }
  }

  return undefined;
}

async function collectPublishGroupEntries(
  context: ContentfulContext,
  group: PublishGroup,
  includeDepth: number
): Promise<Map<string, any>> {
  const entriesById = new Map<string, any>();
  const graph = await fetchPageGraph(context, group.sourcePageId, includeDepth);
  for (const [entryId, entry] of graph.entriesById) {
    entriesById.set(entryId, entry);
  }

  const changedEntries = await fetchEntriesByIds(context, group.changedEntryIds);
  for (const [entryId, entry] of changedEntries) {
    entriesById.set(entryId, entry);
  }

  return entriesById;
}

async function buildPublishCandidates(
  context: ContentfulContext,
  entriesById: Map<string, any>,
  group: PublishGroup
): Promise<any[]> {
  const candidateIds = [...entriesById.values()]
    .filter((entry) => !isArchived(entry) && !isPublishedAndClean(entry))
    .map((entry) => stringValue(entry?.sys?.id))
    .filter(isPresent);
  const latestEntries = await fetchEntriesByIds(context, candidateIds);
  return sortPublishCandidates(
    [...latestEntries.values()].filter((entry) => !isArchived(entry) && !isPublishedAndClean(entry)),
    group
  );
}

async function publishBulkActionWithFreshVersions(
  context: ContentfulContext,
  group: PublishGroup,
  candidates: any[],
  logger: Logger
): Promise<number> {
  let publishCandidates = candidates;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const bulkAction = await context.environment.createPublishBulkAction({
        entities: {
          sys: { type: 'Array' },
          items: publishCandidates.map(toBulkActionEntryLink)
        }
      });
      const completed = typeof bulkAction?.waitProcessing === 'function'
        ? await bulkAction.waitProcessing()
        : bulkAction;
      const status = stringValue(completed?.sys?.status);
      if (status && status !== 'succeeded') {
        throw new Error(`Bulk publish finished with status ${status}.`);
      }
      return publishCandidates.length;
    } catch (error) {
      if (attempt >= 2 || !isVersionMismatchError(error)) {
        throw error;
      }
      logger.warn('Bulk publish hit a version mismatch; refreshing candidate versions and retrying once', {
        entryIds: publishCandidates.map((entry) => stringValue(entry?.sys?.id)).filter(isPresent),
        sourcePageId: group.sourcePageId
      });
      const refreshedEntries = await fetchEntriesByIds(
        context,
        publishCandidates.map((entry) => stringValue(entry?.sys?.id)).filter(isPresent)
      );
      publishCandidates = sortPublishCandidates(
        [...refreshedEntries.values()].filter((entry) => !isArchived(entry) && !isPublishedAndClean(entry)),
        group
      );
    }
  }

  return 0;
}

function sortPublishCandidates(candidates: any[], group: PublishGroup): any[] {
  return candidates.sort((left, right) => {
    const leftIsSourcePage = stringValue(left?.sys?.id) === group.sourcePageId ? 1 : 0;
    const rightIsSourcePage = stringValue(right?.sys?.id) === group.sourcePageId ? 1 : 0;
    return leftIsSourcePage - rightIsSourcePage || stringValue(left?.sys?.id).localeCompare(stringValue(right?.sys?.id));
  });
}

function replaceRichTextHyperlinkField(
  entry: any,
  fieldId: string,
  destination: string,
  replacementEntryId: string,
  locale?: string
): boolean {
  const rawFieldValue = entry?.fields?.[fieldId];
  const localizedValues = getLocalizedValuesFromField(rawFieldValue, locale);
  const isLocalized = isLocalizedFieldMap(rawFieldValue);
  const nextFieldValue = isLocalized ? { ...rawFieldValue } : rawFieldValue;
  let changed = false;
  let nextSingleValue = rawFieldValue;

  for (const fieldValue of localizedValues) {
    const nextValue = cloneJsonValue(fieldValue.value);
    const count = replaceRichTextHyperlinkUrisInPlace(nextValue, destination, replacementEntryId);
    if (count === 0) {
      continue;
    }
    changed = true;
    if (isLocalizedFieldMap(nextFieldValue) && fieldValue.locale) {
      nextFieldValue[fieldValue.locale] = nextValue;
    } else {
      nextSingleValue = nextValue;
    }
  }

  if (changed) {
    entry.fields[fieldId] = isLocalized ? nextFieldValue : nextSingleValue;
  }
  return changed;
}

function replaceCtaStringUrlWithInternalReference(
  entry: any,
  sourceFieldId: string,
  targetFieldId: string,
  destination: string,
  replacementEntryId: string,
  locale?: string
): boolean {
  const rawSourceFieldValue = entry?.fields?.[sourceFieldId];
  const localizedValues = getLocalizedValuesFromField(rawSourceFieldValue, locale);
  const isLocalized = isLocalizedFieldMap(rawSourceFieldValue);
  const nextSourceFieldValue = isLocalized ? { ...rawSourceFieldValue } : rawSourceFieldValue;
  let changed = false;
  let nextSingleSourceValue = rawSourceFieldValue;

  for (const fieldValue of localizedValues) {
    const count = countStringUrlValue(fieldValue.value, destination);
    if (count === 0) {
      continue;
    }
    changed = true;
    setLocalizedEntryFieldValue(entry, targetFieldId, toEntryLink(replacementEntryId), fieldValue.locale);
    setLocalizedEntryFieldValue(entry, CTA_USE_EXTERNAL_LINK_FIELD_ID, false, fieldValue.locale);
    const cleared = clearStringUrlValue(fieldValue.value, destination);
    if (isLocalizedFieldMap(nextSourceFieldValue) && fieldValue.locale) {
      if (cleared.value === undefined) {
        delete nextSourceFieldValue[fieldValue.locale];
      } else {
        nextSourceFieldValue[fieldValue.locale] = cleared.value;
      }
    } else {
      nextSingleSourceValue = cleared.value;
    }
  }

  if (changed) {
    const nextValue = isLocalized ? nextSourceFieldValue : nextSingleSourceValue;
    if (nextValue === undefined) {
      delete entry.fields[sourceFieldId];
    } else {
      entry.fields[sourceFieldId] = nextValue;
    }
  }
  return changed;
}

function replaceRichTextHyperlinkUrisInPlace(value: unknown, destination: string, replacementEntryId: string): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + replaceRichTextHyperlinkUrisInPlace(item, destination, replacementEntryId), 0);
  }

  if (!isRecord(value)) {
    return 0;
  }

  let count = 0;
  const data = isRecord(value.data) ? value.data : undefined;
  const uri = optionalStringValue(data?.uri);
  if (value.nodeType === 'hyperlink' && uri && urlValuesMatch(uri, destination)) {
    value.nodeType = 'entry-hyperlink';
    value.data = {
      target: toEntryLink(replacementEntryId)
    };
    count += 1;
  }

  for (const item of Object.values(value)) {
    count += replaceRichTextHyperlinkUrisInPlace(item, destination, replacementEntryId);
  }
  return count;
}

function countRichTextHyperlinkUri(value: unknown, destination: string): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countRichTextHyperlinkUri(item, destination), 0);
  }
  if (!isRecord(value)) {
    return 0;
  }

  const uri = optionalStringValue((value.data as Record<string, unknown> | undefined)?.uri);
  const ownCount = value.nodeType === 'hyperlink' && uri && urlValuesMatch(uri, destination) ? 1 : 0;
  return ownCount + Object.values(value).reduce<number>(
    (sum, item) => sum + countRichTextHyperlinkUri(item, destination),
    0
  );
}

function collectRichTextEntryHyperlinkTargets(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRichTextEntryHyperlinkTargets(item));
  }
  if (!isRecord(value)) {
    return [];
  }

  const targets: string[] = [];
  const targetId = stringValue((value.data as Record<string, any> | undefined)?.target?.sys?.id);
  if (value.nodeType === 'entry-hyperlink' && targetId) {
    targets.push(targetId);
  }
  for (const item of Object.values(value)) {
    targets.push(...collectRichTextEntryHyperlinkTargets(item));
  }
  return targets;
}

function collectEntryLinkFieldTargets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectEntryLinkFieldTargets(item));
  }
  const entryId = stringValue((value as Record<string, any> | undefined)?.sys?.id);
  const linkType = stringValue((value as Record<string, any> | undefined)?.sys?.linkType);
  return linkType === 'Entry' && entryId ? [entryId] : [];
}

function countStringUrlValue(value: unknown, destination: string): number {
  if (typeof value === 'string') {
    return urlValuesMatch(value, destination) ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countStringUrlValue(item, destination), 0);
  }
  return 0;
}

function clearStringUrlValue(value: unknown, destination: string): { changed: boolean; value: unknown } {
  if (typeof value === 'string') {
    return urlValuesMatch(value, destination)
      ? { changed: true, value: undefined }
      : { changed: false, value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.filter((item) => {
      const shouldRemove = typeof item === 'string' && urlValuesMatch(item, destination);
      changed = changed || shouldRemove;
      return !shouldRemove;
    });
    return { changed, value: nextValue };
  }
  return { changed: false, value };
}

function setLocalizedEntryFieldValue(entry: any, fieldId: string, value: unknown, locale?: string): void {
  const rawFieldValue = entry?.fields?.[fieldId];
  if (locale) {
    entry.fields[fieldId] = isLocalizedFieldMap(rawFieldValue)
      ? { ...rawFieldValue, [locale]: value }
      : { [locale]: value };
    return;
  }
  entry.fields[fieldId] = value;
}

function isFixableExternalMatch(match: LinkMatch): boolean {
  return match.kind === 'rich-text' || (match.kind === 'string-url' && Boolean(match.targetFieldId));
}

function pageTargetMatchesDestination(targetEntryId: string, destination: string, pageIndex: PageIndex): boolean {
  const targetEntry = pageIndex.entriesById.get(targetEntryId);
  if (!targetEntry) {
    return false;
  }
  for (const fieldValue of getFieldValues(targetEntry, 'slug')) {
    const slug = stringifyStringFieldValue(fieldValue.value);
    if (slug && urlComparisonKeys(destination).has(normalizeSlugForLookup(slug))) {
      return true;
    }
  }
  return false;
}

function stringFieldCanHoldUrl(contentTypeId: string, field: any): boolean {
  const fieldId = stringValue(field?.id);
  return Boolean(STRING_URL_FIELD_IDS_BY_CONTENT_TYPE.get(contentTypeId)?.has(fieldId)) &&
    (field?.type === 'Symbol' || field?.type === 'Text');
}

function fieldIsEntryLink(field: any): boolean {
  if (field?.type === 'Link' && field?.linkType === 'Entry') {
    return true;
  }
  return field?.type === 'Array' && field?.items?.type === 'Link' && field?.items?.linkType === 'Entry';
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

async function fetchEntriesByIds(context: ContentfulContext, entryIds: string[]): Promise<Map<string, any>> {
  const entriesById = new Map<string, any>();
  const uniqueIds = [...new Set(entryIds)].filter(Boolean);

  for (const batch of chunk(uniqueIds, 100)) {
    const response = await context.environment.getEntries({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    for (const item of response?.items ?? []) {
      const entryId = stringValue(item?.sys?.id);
      if (entryId) {
        entriesById.set(entryId, item);
      }
    }
  }

  return entriesById;
}

async function fetchEntryReferences(
  context: ContentfulContext,
  entryId: string,
  includeDepth: number
): Promise<unknown> {
  if (typeof context.environment.getEntryReferences === 'function') {
    return context.environment.getEntryReferences(entryId, { include: includeDepth });
  }
  const entry = await context.environment.getEntry(entryId);
  if (typeof entry?.references === 'function') {
    return entry.references({ include: includeDepth });
  }
  return undefined;
}

function extractEntriesFromReferenceResponse(value: unknown): any[] {
  if (!isRecord(value)) {
    return [];
  }
  const entries: any[] = [];
  const directItems = Array.isArray(value.items) ? value.items : [];
  entries.push(...directItems.filter(isEntryResource));
  const includes = isRecord(value.includes) ? value.includes : {};
  for (const includeValue of Object.values(includes)) {
    if (Array.isArray(includeValue)) {
      entries.push(...includeValue.filter(isEntryResource));
    }
  }
  return entries;
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  plans: RowPlan[],
  pageIndex: PageIndex
): AmendmentReport {
  return {
    environmentId: commandConfig.environmentId,
    generatedAt: new Date().toISOString(),
    input: {
      inputPath: commandConfig.inputPath,
      limit: commandConfig.limit,
      locale: commandConfig.locale,
      publish: commandConfig.publish,
      publishIncludeDepth: commandConfig.publishIncludeDepth,
      publishIntervalMs: commandConfig.publishIntervalMs,
      referenceIncludeDepth: commandConfig.referenceIncludeDepth,
      requestThrottle: commandConfig.requestThrottle,
      startRow: commandConfig.startRow
    },
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    rows: plans,
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    summary: summarize(plans, pageIndex)
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: AmendmentReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `amend-404-links-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${commandConfig.environmentId}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );
  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: AmendmentReport): string {
  const lines: string[] = [];
  lines.push('# 404 Link Amendment Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- CSV: ${report.input.inputPath}`);
  lines.push(`- Selection: data row ${report.input.startRow}${report.input.limit ? `, limit ${report.input.limit}` : ' to end'}`);
  lines.push(`- Locale: ${report.input.locale ?? 'all locales'}`);
  lines.push(`- Publish after update: ${report.input.publish ? 'yes' : 'no'}`);
  lines.push(`- Request throttle: ${report.input.requestThrottle} requests/second`);
  lines.push(`- Reference include depth: ${report.input.referenceIncludeDepth}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Rows selected | ${report.summary.rowsSelected} |`);
  lines.push(`| Rows that would update | ${report.summary.rowsWouldUpdate} |`);
  lines.push(`| Rows updated | ${report.summary.rowsUpdated} |`);
  lines.push(`| Internal links recorded | ${report.summary.internalLinksRecorded} |`);
  lines.push(`| Link not found rows | ${report.summary.linkNotFoundRows} |`);
  lines.push(`| Missing source pages | ${report.summary.missingSourcePages} |`);
  lines.push(`| Ambiguous source pages | ${report.summary.ambiguousSourcePages} |`);
  lines.push(`| Missing replacement pages | ${report.summary.missingReplacementPages} |`);
  lines.push(`| Ambiguous replacement pages | ${report.summary.ambiguousReplacementPages} |`);
  lines.push(`| Unsupported fixable rows | ${report.summary.unsupportedFixableRows} |`);
  lines.push(`| Pages scanned for lookup | ${report.summary.entriesScannedForPageLookup} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');
  lines.push('## Row Details');
  lines.push('');
  for (const row of report.rows) {
    lines.push(`### Row ${row.dataRowNumber} (CSV line ${row.csvLineNumber})`);
    lines.push('');
    lines.push(`- Action: ${row.action}`);
    lines.push(`- Source: ${row.source || 'n/a'}`);
    lines.push(`- Source slug: ${row.sourceSlug ?? 'n/a'}`);
    if (row.contentfulSourcePage) {
      lines.push(`- Contentful source page: ${formatPageMatch(row.contentfulSourcePage)}`);
    }
    lines.push(`- Destination: ${row.destination || 'n/a'}`);
    lines.push(`- Destination slug: ${row.destinationSlug ?? 'n/a'}`);
    lines.push(`- Replacement link: ${row.replacementLink || 'n/a'}`);
    lines.push(`- Replacement slug: ${row.replacementSlug ?? 'n/a'}`);
    if (row.replacementTarget) {
      lines.push(`- Replacement target: ${formatPageMatch(row.replacementTarget)}`);
    }
    if (row.anchor) {
      lines.push(`- Anchor: ${row.anchor}`);
    }
    if (row.linkPath) {
      lines.push(`- Link path: ${row.linkPath}`);
    }
    if (row.linkOrigin) {
      lines.push(`- Link origin: ${row.linkOrigin}`);
    }
    if (row.linkMappingStatus) {
      lines.push(`- Link mapping status: ${row.linkMappingStatus}`);
    }
    lines.push(`- Occurrences found: ${row.occurrenceCount}`);
    if (row.externalMatches.length > 0) {
      lines.push('- Fixable URL matches:');
      for (const match of row.externalMatches) {
        lines.push(`  - ${formatLinkMatch(match)}`);
      }
    }
    if (row.internalMatches.length > 0) {
      lines.push('- Internal link matches recorded:');
      for (const match of row.internalMatches) {
        lines.push(`  - ${formatLinkMatch(match)}`);
      }
    }
    for (const warning of row.warnings) {
      lines.push(`- Warning: ${warning}`);
    }
    for (const error of row.errors) {
      lines.push(`- Error: ${error}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function summarize(plans: RowPlan[], pageIndex: PageIndex): ReportSummary {
  return {
    ambiguousReplacementPages: plans.filter((plan) => plan.action === 'replacement-page-ambiguous').length,
    ambiguousSourcePages: plans.filter((plan) => plan.action === 'source-page-ambiguous').length,
    entriesScannedForPageLookup: pageIndex.entriesScanned,
    errors: plans.reduce((sum, plan) => sum + plan.errors.length, 0),
    internalLinksRecorded: plans.filter((plan) => plan.action === 'internal-link-recorded').length,
    linkNotFoundRows: plans.filter((plan) => plan.action === 'link-not-found').length,
    missingReplacementPages: plans.filter((plan) => plan.action === 'replacement-page-not-found').length,
    missingSourcePages: plans.filter((plan) => plan.action === 'source-page-not-found').length,
    rowsSelected: plans.length,
    rowsUpdated: plans.filter((plan) => plan.action === 'updated-internal-and-published' || plan.action === 'updated-internal-draft').length,
    rowsWouldUpdate: plans.filter((plan) => plan.action === 'would-update-internal-and-publish' || plan.action === 'would-update-internal-draft').length,
    unsupportedFixableRows: plans.filter((plan) => plan.action === 'unsupported-fixable-field').length,
    warnings: plans.reduce((sum, plan) => sum + plan.warnings.length, 0)
  };
}

function isPlanReadyForUpdate(plan: RowPlan): boolean {
  return (
    plan.externalMatches.some(isFixableExternalMatch) &&
    Boolean(plan.contentfulSourcePage?.entryId && plan.replacementTarget?.entryId) &&
    plan.errors.length === 0 &&
    plan.action !== 'unsupported-fixable-field'
  );
}

function selectUniquePageMatch(matches: PageMatch[]): PageMatch | undefined {
  const byEntryId = new Map<string, PageMatch>();
  for (const match of matches) {
    if (!byEntryId.has(match.entryId)) {
      byEntryId.set(match.entryId, match);
    }
  }
  const unique = [...byEntryId.values()];
  return unique.length === 1 ? unique[0] : undefined;
}

function urlValuesMatch(left: string, right: string): boolean {
  const leftKeys = urlComparisonKeys(left);
  for (const key of urlComparisonKeys(right)) {
    if (leftKeys.has(key)) {
      return true;
    }
  }
  return false;
}

function urlComparisonKeys(value: string): Set<string> {
  const trimmed = value.trim();
  const pathOnly = pathFromUrl(trimmed);
  const withoutQuery = pathOnly.split(/[?#]/, 1)[0] ?? '';
  const decoded = safeDecodeURIComponent(withoutQuery);
  const keys = new Set<string>();
  for (const candidate of [trimmed, pathOnly, withoutQuery, decoded]) {
    const normalized = candidate.trim().replace(/^\/+|\/+$/g, '');
    if (normalized) {
      keys.add(normalized);
      keys.add(normalized.toLowerCase());
    }
  }
  const slug = normalizeSlugForLookup(withoutQuery);
  if (slug) {
    keys.add(slug);
    keys.add(slug.toLowerCase());
  }
  return keys;
}

function slugFromUrl(value: string): string {
  return normalizeSlugForLookup(value);
}

function normalizeSlugForLookup(value: string): string {
  const pathOnly = pathFromUrl(value).split(/[?#]/, 1)[0] ?? '';
  const decoded = safeDecodeURIComponent(pathOnly);
  const segments = decoded.split('/').filter(Boolean);
  while (segments[0] && isLocaleSegment(segments[0])) {
    segments.shift();
  }
  return segments.join('/').replace(/^\/+|\/+$/g, '').trim();
}

function pathFromUrl(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).pathname + new URL(trimmed).search + new URL(trimmed).hash;
  } catch {
    return trimmed.replace(/^https?:\/\/[^/]+/i, '');
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isLocaleSegment(value: string): boolean {
  return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(value.trim());
}

function getLocalizedValuesFromField(fieldValue: unknown, locale?: string): Array<{ locale?: string; value: unknown }> {
  if (fieldValue === undefined) {
    return [];
  }
  if (!isLocalizedFieldMap(fieldValue)) {
    return [{ value: fieldValue }];
  }
  if (locale) {
    return Object.prototype.hasOwnProperty.call(fieldValue, locale)
      ? [{ locale, value: fieldValue[locale] }]
      : [];
  }
  return Object.entries(fieldValue).map(([fieldLocale, value]) => ({ locale: fieldLocale, value }));
}

function getFieldValues(entry: any, fieldId: string): Array<{ locale?: string; value: unknown }> {
  const rawValue = entry?.fields?.[fieldId];
  if (rawValue === undefined) {
    return [];
  }
  if (!isLocalizedFieldMap(rawValue)) {
    return [{ value: rawValue }];
  }
  return Object.entries(rawValue).map(([locale, value]) => ({ locale, value }));
}

function isLocalizedFieldMap(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'sys') &&
    !Object.prototype.hasOwnProperty.call(value, 'nodeType')
  );
}

function firstLocalizedStringValue(entry: any, fieldId: string): string | undefined {
  return getFieldValues(entry, fieldId)
    .map((fieldValue) => stringifyStringFieldValue(fieldValue.value))
    .find((value) => value.length > 0);
}

function stringifyStringFieldValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatPageMatch(match: PageMatch): string {
  return `${match.contentType}:${match.entryId} (${match.slug}${match.locale ? `, ${match.locale}` : ''})${match.internalName ? ` - ${match.internalName}` : ''}`;
}

function formatLinkMatch(match: LinkMatch): string {
  const parts = [
    `${match.contentType}:${match.entryId}.${match.fieldId}`,
    match.kind,
    match.locale ? `locale ${match.locale}` : undefined,
    `count ${match.count}`,
    match.targetFieldId ? `target field ${match.targetFieldId}` : undefined,
    match.targetEntryId ? `target ${match.targetEntryId}` : undefined,
    match.entryName
  ].filter(isPresent);
  return parts.join(' | ');
}

function formatLinkMatchLocation(match: LinkMatch): string {
  return `${match.contentType}:${match.entryId}.${match.fieldId}`;
}

function toEntryLink(entryId: string): { sys: { type: 'Link'; linkType: 'Entry'; id: string } } {
  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: entryId
    }
  };
}

function toBulkActionEntryLink(entry: any): { sys: { type: 'Link'; linkType: 'Entry'; id: string; version: number } } {
  const entryId = stringValue(entry?.sys?.id);
  const version = Number(entry?.sys?.version);
  if (!entryId || !Number.isInteger(version) || version < 1) {
    throw new Error(`Cannot publish entry ${entryId || 'unknown'}; Contentful did not return a valid version.`);
  }
  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: entryId,
      version
    }
  };
}

function getEntryContentType(entry: any): string {
  return stringValue(entry?.sys?.contentType?.sys?.id);
}

function isEntryResource(value: unknown): boolean {
  return isRecord(value) && stringValue(value.sys?.type) === 'Entry' && isRecord(value.fields);
}

function isArchived(entry: any): boolean {
  return typeof entry?.isArchived === 'function'
    ? entry.isArchived()
    : Boolean(entry?.sys?.archivedVersion);
}

function isPublished(entry: any): boolean {
  return typeof entry?.isPublished === 'function'
    ? entry.isPublished()
    : Boolean(entry?.sys?.publishedVersion);
}

function isPublishedAndClean(entry: any): boolean {
  return isPublished(entry) && !isUpdated(entry);
}

function isUpdated(entry: any): boolean {
  return typeof entry?.isUpdated === 'function'
    ? entry.isUpdated()
    : Boolean(entry?.sys?.publishedVersion && entry?.sys?.version > entry.sys.publishedVersion + 1);
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

function isTooManyLinksError(error: unknown): boolean {
  const record = isRecord(error) ? error : {};
  const messages = [
    record.message,
    isRecord(record.details) ? record.details.message : undefined,
    isRecord(record.response) && isRecord(record.response.data) ? record.response.data.message : undefined
  ];
  return messages.some(
    (message) => typeof message === 'string' && /Too many links/i.test(message)
  );
}

function parseCsvTable(content: string): CsvTable {
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
    } else if (character === ',') {
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
    throw new Error('CSV has an unterminated quoted field.');
  }
  if (field.length > 0 || row.length > 0 || (content.length > 0 && !content.endsWith('\n') && !content.endsWith('\r'))) {
    row.push(field);
    rows.push(row);
  }
  return { rows };
}

function requireColumn(header: string[], columnName: string): number {
  const index = findColumnIndex(header, columnName);
  if (index < 0) {
    throw new Error(`Unable to find required CSV column: ${columnName}`);
  }
  return index;
}

function findColumnIndex(header: string[], columnName: string): number {
  const normalizedColumnName = normalizeColumnName(columnName);
  return header.findIndex((candidate) => normalizeColumnName(candidate) === normalizedColumnName);
}

function normalizeColumnName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCellValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function optionalCellValue(row: string[], index: number): string | undefined {
  if (index < 0) {
    return undefined;
  }
  const value = normalizeCellValue(row[index] ?? '');
  return value || undefined;
}

function ensureRowLength(row: string[], length: number): void {
  while (row.length < length) {
    row.push('');
  }
}

function maxColumnIndex(columns: ColumnIndices): number {
  return Math.max(
    columns.anchor,
    columns.destination,
    columns.linkMappingStatus,
    columns.linkOrigin,
    columns.linkPath,
    columns.replacementLink,
    columns.source
  );
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

function parseIntegerInRangeFlag(flags: CliFlags, names: string[], min: number, max: number): number | undefined {
  for (const name of names) {
    const value = flags[name];
    if (value === undefined || value === true) {
      continue;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
  }
  return undefined;
}

function hasAnyFlag(flags: CliFlags, names: string[]): boolean {
  return names.some((name) => flags[name] !== undefined);
}

function stringFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function isPresent<T>(value: T | undefined | null | ''): value is T {
  return value !== undefined && value !== null && value !== '';
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
