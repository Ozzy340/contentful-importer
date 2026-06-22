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
import type {
  CliFlags,
  LoadedProjectConfig,
  RuntimeEnv
} from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'amendments', 'en_links_with_redirect_matches.csv');
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_REQUEST_THROTTLE = 25;
const DEFAULT_PUBLISH_INTERVAL_MS = 5000;
const DEFAULT_PUBLISH_INCLUDE_DEPTH = 2;
const RICH_TEXT_CONTENT_TYPE_ID = 'richTextBlock';
const RICH_TEXT_FIELD_ID = 'content';
const ENTRY_ID_COLUMNS = ['Rich Text Entity ID', 'Entity ID'];
const ENTITY_NAME_COLUMNS = ['Rich Text Entity Name', 'Entity Name'];
const ENTITY_LINK_COLUMNS = ['Rich Text Contentful Link', 'Entity Contentful Link'];
const CONTENT_TYPE_COLUMN = 'Content Type';
const FIELD_COLUMN = 'Field';
const OLD_LINK_COLUMN = 'full /en/ link';
const QUADIENT_LINK_COLUMN = 'quadient.com';
const MAIL_QUADIENT_LINK_COLUMN = 'mail.quadient.com';
const REPLACEMENT_LINK_COLUMN = 'Replacement link';
const CTA_INTERNAL_LINK_FIELD_ID = 'link';
const CTA_EXTERNAL_URL_FIELD_IDS = new Set(['externalUrl', 'fallbackUrl']);
const OPTIONAL_REPORT_COLUMNS = {
  parentPageId: 'Parent Page Entity ID',
  parentPageType: 'Parent Page Type',
  parentPageName: 'Parent Page Name',
  parentPageSlug: 'Parent page slug'
};

const PAGE_CONTENT_TYPE_IDS = [
  'listingPage',
  'searchPage',
  'resourcePage',
  'homePage',
  'contentPage'
];

type RowAction =
  | 'skipped-empty-row'
  | 'skipped-missing-entry-id'
  | 'skipped-missing-link'
  | 'skipped-https-link'
  | 'skipped-no-replacement'
  | 'skipped-internal-page-found'
  | 'internal-replacement-target-not-found'
  | 'ambiguous-internal-page-match'
  | 'unsupported-internal-field'
  | 'missing-entry'
  | 'wrong-content-type'
  | 'archived-entry'
  | 'replacement-conflict'
  | 'link-not-found'
  | 'would-update-and-publish'
  | 'would-update-draft'
  | 'would-update-internal-and-publish'
  | 'would-update-internal-draft'
  | 'updated-and-published'
  | 'updated-draft'
  | 'updated-internal-and-published'
  | 'updated-internal-draft'
  | 'update-failed';

type LinkFieldKind = 'rich-text' | 'string' | 'unsupported';
type ReplacementSource = 'quadient.com' | 'mail.quadient.com' | 'Replacement link';

type ReplacementCandidate =
  | { kind: 'external-url'; link: string; source: Extract<ReplacementSource, 'quadient.com' | 'mail.quadient.com'> }
  | { kind: 'internal-link'; link: string; source: Extract<ReplacementSource, 'Replacement link'> };

interface CommandConfig {
  allowNonSandbox: boolean;
  dryRun: boolean;
  environmentId: string;
  fixInternal: boolean;
  inputPath: string;
  limit?: number;
  locale?: string;
  pageSize: number;
  publish: boolean;
  publishIncludeDepth: number;
  publishIntervalMs: number;
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
  entryId: number;
  entityName: number;
  entityLink: number;
  contentType: number;
  fieldId: number;
  oldLink: number;
  quadientLink: number;
  mailQuadientLink: number;
  replacementLink: number;
  parentPageId: number;
  parentPageType: number;
  parentPageName: number;
  parentPageSlug: number;
}

interface InternalPageMatch {
  contentType: string;
  entryId: string;
  internalName: string;
  locale?: string;
  slug: string;
}

interface SlugIndex {
  entriesScanned: number;
  matchesBySlug: Map<string, InternalPageMatch[]>;
}

interface LinkOccurrence {
  count: number;
  locale?: string;
}

interface RowPlan {
  action: RowAction;
  afterLink: string;
  beforeLink: string;
  contentType?: string;
  contentfulUrl?: string;
  csvLineNumber: number;
  dataRowNumber: number;
  entryId?: string;
  entryStatus?: string;
  expectedContentType?: string;
  fieldId: string;
  fieldKind?: LinkFieldKind;
  errors: string[];
  internalPageMatches: InternalPageMatch[];
  internalSlug?: string;
  internalTarget?: InternalPageMatch;
  occurrenceCount: number;
  occurrences: LinkOccurrence[];
  parentPageId?: string;
  parentPageName?: string;
  parentPageSlug?: string;
  parentPageType?: string;
  publishGroupKey?: string;
  publishStatus?: 'pending' | 'succeeded' | 'failed' | 'not-needed';
  replacementLink?: string;
  replacementKind?: 'external-url' | 'internal-entry';
  replacementSource?: ReplacementSource;
  targetFieldId?: string;
  entityName?: string;
  selectionIndex: number;
  totalSelectedRows: number;
  updateKey?: string;
  warnings: string[];
}

interface ChangeGroup {
  entryId: string;
  fieldId: string;
  targetFieldId?: string;
  internalTarget?: InternalPageMatch;
  kind: 'external-url' | 'internal-entry';
  newLink: string;
  oldLink: string;
  plans: RowPlan[];
}

interface PublishGroup {
  changedEntryIds: string[];
  key: string;
  parentPageId?: string;
  parentPageName?: string;
  plans: RowPlan[];
}

interface AmendmentReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  spaceId?: string;
  environmentId: string;
  input: {
    fixInternal: boolean;
    inputPath: string;
    limit?: number;
    locale?: string;
    publish: boolean;
    publishIncludeDepth: number;
    publishIntervalMs: number;
    requestThrottle: number;
    startRow: number;
  };
  summary: ReportSummary;
  rows: RowPlan[];
}

interface ReportSummary {
  ambiguousInternalPageRows: number;
  archivedEntries: number;
  entriesScannedForSlugCheck: number;
  errors: number;
  httpsRowsSkipped: number;
  internalLinksFixed: number;
  internalReplacementTargetNotFoundRows: number;
  internalLinksWouldFix: number;
  internalPageRowsSkipped: number;
  linkNotFoundRows: number;
  missingEntries: number;
  noReplacementRows: number;
  publishGroups: number;
  publishGroupsFailed: number;
  publishGroupsNotNeeded: number;
  publishGroupsSucceeded: number;
  replacementConflictRows: number;
  rowsSelected: number;
  rowsWithReplacement: number;
  rowsWouldUpdate: number;
  rowsUpdated: number;
  unsupportedInternalFieldRows: number;
  uniqueEntriesChanged: number;
  uniqueEntriesToChange: number;
  warnings: number;
  wrongContentTypeRows: number;
}

interface LocalizedFieldValue {
  locale?: string;
  value: unknown;
}

interface ReplacementResult {
  changed: boolean;
  countsByOldLink: Map<string, Map<string, number>>;
  nextFieldValue: unknown;
  total: number;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'amend-en-links');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);

  logger.info(commandConfig.dryRun ? 'Preparing en link amendment dry run' : 'Preparing en link amendment apply run', {
    environmentId: commandConfig.environmentId,
    fixInternal: commandConfig.fixInternal,
    inputPath: commandConfig.inputPath,
    limit: commandConfig.limit,
    locale: commandConfig.locale ?? 'all',
    publishIncludeDepth: commandConfig.publishIncludeDepth,
    publishIntervalMs: commandConfig.publishIntervalMs,
    publish: commandConfig.publish,
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

  logger.info('Building internal page slug index before planning changes', {
    contentTypes: PAGE_CONTENT_TYPE_IDS,
    pageSize: commandConfig.pageSize
  });
  const slugIndex = await buildSlugIndex(context, commandConfig, logger);

  const plans = buildInitialPlans(selectedRows, columns, slugIndex, commandConfig, logger);
  resolveReplacementConflicts(plans);

  const entriesById = await inspectEntries(context, commandConfig, plans, logger);
  resolveReplacementConflicts(plans);
  markDryRunActions(plans, commandConfig);

  if (!commandConfig.dryRun) {
    if (plans.some((plan) => plan.replacementKind === 'internal-entry' && isPlanReadyForUpdate(plan))) {
      await assertInternalEntryHyperlinksSupported(context, plans);
    }

    const updateGroups = buildChangeGroups(plans);
    await applyChanges(context, commandConfig, updateGroups, entriesById, logger);

    if (commandConfig.publish) {
      const publishGroups = buildPublishGroups(plans);
      await publishChangedPages(context, commandConfig, publishGroups, logger);
    }
  }

  const report = buildReport(projectConfig, commandConfig, plans, slugIndex);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  logger.info(commandConfig.dryRun ? 'En link amendment dry run finished' : 'En link amendment apply run finished', {
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

  const startRow = row ?? parsePositiveIntegerFlag(flags, ['start-row', 'start', 'from-row']) ?? 1;
  const limit = row !== undefined ? 1 : parsePositiveIntegerFlag(flags, ['limit', 'rows']);
  const pageSize = parsePositiveIntegerFlag(flags, ['page-size']) ?? DEFAULT_PAGE_SIZE;
  const requestThrottle = parseIntegerInRangeFlag(flags, ['throttle', 'request-throttle'], 1, 30) ?? DEFAULT_REQUEST_THROTTLE;
  const publishIntervalMs =
    parseNonNegativeIntegerFlag(flags, ['publish-interval-ms', 'publish-delay-ms']) ??
    DEFAULT_PUBLISH_INTERVAL_MS;
  const publishIncludeDepth =
    parseIntegerInRangeFlag(flags, ['publish-include-depth', 'include-depth'], 1, 10) ??
    DEFAULT_PUBLISH_INCLUDE_DEPTH;

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    dryRun: !flags.yes,
    environmentId,
    fixInternal: Boolean(flags['fix-internal']),
    inputPath: path.resolve(stringFlag(flags, 'input') ?? stringFlag(flags, 'source') ?? DEFAULT_INPUT_PATH),
    limit,
    locale: stringFlag(flags, 'locale'),
    pageSize,
    publish: !flags['no-publish'],
    publishIncludeDepth,
    publishIntervalMs,
    requestThrottle,
    startRow
  };
}

function resolveColumnIndices(header: string[]): ColumnIndices {
  const columns = {
    entryId: requireAnyColumn(header, ENTRY_ID_COLUMNS),
    entityName: findAnyColumnIndex(header, ENTITY_NAME_COLUMNS),
    entityLink: findAnyColumnIndex(header, ENTITY_LINK_COLUMNS),
    contentType: findColumnIndex(header, CONTENT_TYPE_COLUMN),
    fieldId: findColumnIndex(header, FIELD_COLUMN),
    oldLink: requireColumn(header, OLD_LINK_COLUMN),
    quadientLink: findColumnIndex(header, QUADIENT_LINK_COLUMN),
    mailQuadientLink: findColumnIndex(header, MAIL_QUADIENT_LINK_COLUMN),
    replacementLink: findColumnIndex(header, REPLACEMENT_LINK_COLUMN),
    parentPageId: findColumnIndex(header, OPTIONAL_REPORT_COLUMNS.parentPageId),
    parentPageType: findColumnIndex(header, OPTIONAL_REPORT_COLUMNS.parentPageType),
    parentPageName: findColumnIndex(header, OPTIONAL_REPORT_COLUMNS.parentPageName),
    parentPageSlug: findColumnIndex(header, OPTIONAL_REPORT_COLUMNS.parentPageSlug)
  };

  if (columns.quadientLink < 0 && columns.mailQuadientLink < 0 && columns.replacementLink < 0) {
    throw new Error(
      `Unable to find a replacement CSV column: expected ${REPLACEMENT_LINK_COLUMN}, ${QUADIENT_LINK_COLUMN}, or ${MAIL_QUADIENT_LINK_COLUMN}.`
    );
  }

  return columns;
}

function selectRows(table: CsvTable, commandConfig: CommandConfig): SelectedCsvRow[] {
  const dataRows = table.rows.slice(1);
  const startIndex = commandConfig.startRow - 1;
  const endIndex = commandConfig.limit === undefined
    ? dataRows.length
    : startIndex + commandConfig.limit;
  const selected = dataRows.slice(startIndex, endIndex);

  return selected.map((row, index) => ({
    csvLineNumber: commandConfig.startRow + index + 1,
    dataRowNumber: commandConfig.startRow + index,
    row,
    selectionIndex: index + 1
  }));
}

async function buildSlugIndex(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  logger: Logger
): Promise<SlugIndex> {
  const matchesBySlug = new Map<string, InternalPageMatch[]>();
  let entriesScanned = 0;

  for (const contentType of PAGE_CONTENT_TYPE_IDS) {
    const entries = await fetchEntries(
      context,
      { content_type: contentType },
      commandConfig.pageSize
    );
    entriesScanned += entries.length;
    logger.info('Scanned pages for internal slug check', {
      contentType,
      entries: entries.length
    });

    for (const entry of entries) {
      const entryId = stringValue(entry?.sys?.id);
      if (!entryId) {
        continue;
      }

      const internalName = firstLocalizedStringValue(entry, 'internalName') ?? '';
      const seenSlugs = new Set<string>();
      for (const fieldValue of getFieldValues(entry, 'slug')) {
        const slug = normalizeSlugForLookup(stringifyStringFieldValue(fieldValue.value));
        if (!slug || seenSlugs.has(`${fieldValue.locale ?? ''}:${slug}`)) {
          continue;
        }

        seenSlugs.add(`${fieldValue.locale ?? ''}:${slug}`);
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
    entriesScanned,
    matchesBySlug
  };
}

function buildInitialPlans(
  selectedRows: SelectedCsvRow[],
  columns: ColumnIndices,
  slugIndex: SlugIndex,
  commandConfig: CommandConfig,
  logger: Logger
): RowPlan[] {
  const plans: RowPlan[] = [];
  const totalSelectedRows = selectedRows.length;

  for (const selectedRow of selectedRows) {
    ensureRowLength(selectedRow.row, maxColumnIndex(columns) + 1);
    const entryId = normalizeCellValue(selectedRow.row[columns.entryId] ?? '');
    const beforeLink = normalizeCellValue(selectedRow.row[columns.oldLink] ?? '');
    const fieldId = optionalCellValue(selectedRow.row, columns.fieldId) ?? RICH_TEXT_FIELD_ID;
    const expectedContentType =
      optionalCellValue(selectedRow.row, columns.contentType) ??
      (columns.contentType < 0 ? RICH_TEXT_CONTENT_TYPE_ID : undefined);
    const replacement = pickReplacement(selectedRow.row, columns);
    const basePlan: RowPlan = {
      action: 'skipped-empty-row',
      afterLink: beforeLink || 'unchanged',
      beforeLink,
      contentfulUrl: optionalCellValue(selectedRow.row, columns.entityLink),
      csvLineNumber: selectedRow.csvLineNumber,
      dataRowNumber: selectedRow.dataRowNumber,
      entryId: entryId || undefined,
      expectedContentType,
      fieldId,
      errors: [],
      internalPageMatches: [],
      occurrenceCount: 0,
      occurrences: [],
      parentPageId: optionalCellValue(selectedRow.row, columns.parentPageId),
      parentPageName: optionalCellValue(selectedRow.row, columns.parentPageName),
      parentPageSlug: optionalCellValue(selectedRow.row, columns.parentPageSlug),
      parentPageType: optionalCellValue(selectedRow.row, columns.parentPageType),
      replacementLink: replacement?.link,
      replacementSource: replacement?.source,
      entityName: optionalCellValue(selectedRow.row, columns.entityName),
      selectionIndex: selectedRow.selectionIndex,
      totalSelectedRows,
      warnings: []
    };

    logger.info(`row ${selectedRow.selectionIndex}/${totalSelectedRows} checking slug`, {
      dataRow: selectedRow.dataRowNumber,
      entryId: entryId || 'missing',
      fieldId,
      link: beforeLink || 'missing'
    });

    if (selectedRow.row.every((value) => normalizeCellValue(value) === '')) {
      basePlan.action = 'skipped-empty-row';
      basePlan.warnings.push('Row is empty.');
      plans.push(basePlan);
      continue;
    }

    if (!entryId) {
      basePlan.action = 'skipped-missing-entry-id';
      basePlan.errors.push(`Missing one of ${ENTRY_ID_COLUMNS.join(', ')}.`);
      plans.push(basePlan);
      continue;
    }

    if (!beforeLink) {
      basePlan.action = 'skipped-missing-link';
      basePlan.errors.push(`Missing ${OLD_LINK_COLUMN}.`);
      plans.push(basePlan);
      continue;
    }

    if (beforeLink.toLowerCase().includes('https://')) {
      basePlan.action = 'skipped-https-link';
      basePlan.afterLink = beforeLink;
      basePlan.warnings.push(`${OLD_LINK_COLUMN} contains https://; row ignored by rule.`);
      plans.push(basePlan);
      continue;
    }

    if (replacement?.kind === 'internal-link') {
      const replacementSlug = slugFromEnLink(replacement.link);
      basePlan.internalSlug = replacementSlug;
      if (!replacementSlug) {
        basePlan.action = 'internal-replacement-target-not-found';
        basePlan.afterLink = beforeLink;
        basePlan.warnings.push(`No slug could be derived from ${REPLACEMENT_LINK_COLUMN}.`);
        plans.push(basePlan);
        continue;
      }

      const internalMatches = slugIndex.matchesBySlug.get(replacementSlug) ?? [];
      basePlan.internalPageMatches = internalMatches;
      if (internalMatches.length === 0) {
        basePlan.action = 'internal-replacement-target-not-found';
        basePlan.afterLink = beforeLink;
        basePlan.warnings.push(`No Contentful page matched replacement slug ${replacementSlug}.`);
        plans.push(basePlan);
        continue;
      }

      const internalTarget = selectInternalTarget(internalMatches);
      if (!internalTarget) {
        basePlan.action = 'ambiguous-internal-page-match';
        basePlan.afterLink = beforeLink;
        basePlan.warnings.push(
          `Multiple Contentful entries match replacement slug ${replacementSlug}; leaving link unchanged.`
        );
        plans.push(basePlan);
        continue;
      }

      basePlan.action = 'link-not-found';
      basePlan.afterLink = formatInternalLinkTarget(internalTarget);
      basePlan.internalTarget = internalTarget;
      basePlan.replacementKind = 'internal-entry';
      basePlan.updateKey = updateKey(entryId, fieldId, beforeLink);
      plans.push(basePlan);
      continue;
    }

    const internalSlug = slugFromEnLink(beforeLink);
    basePlan.internalSlug = internalSlug;
    if (internalSlug) {
      const internalMatches = slugIndex.matchesBySlug.get(internalSlug) ?? [];
      basePlan.internalPageMatches = internalMatches;
      if (internalMatches.length > 0) {
        if (commandConfig.fixInternal) {
          const internalTarget = selectInternalTarget(internalMatches);
          if (!internalTarget) {
            basePlan.action = 'ambiguous-internal-page-match';
            basePlan.afterLink = beforeLink;
            basePlan.warnings.push(
              `Multiple Contentful entries match slug ${internalSlug}; leaving link unchanged.`
            );
            plans.push(basePlan);
            continue;
          }

          basePlan.action = 'link-not-found';
          basePlan.afterLink = formatInternalLinkTarget(internalTarget);
          basePlan.internalTarget = internalTarget;
          basePlan.replacementKind = 'internal-entry';
          basePlan.updateKey = updateKey(entryId, fieldId, beforeLink);
          plans.push(basePlan);
          continue;
        }

        basePlan.action = 'skipped-internal-page-found';
        basePlan.afterLink = beforeLink;
        basePlan.warnings.push('internal page found');
        plans.push(basePlan);
        continue;
      }
    } else {
      basePlan.warnings.push('No slug could be derived after removing /en/ for the internal page check.');
    }

    if (!replacement) {
      basePlan.action = 'skipped-no-replacement';
      basePlan.afterLink = beforeLink;
      basePlan.warnings.push(
        `${REPLACEMENT_LINK_COLUMN}, ${QUADIENT_LINK_COLUMN}, and ${MAIL_QUADIENT_LINK_COLUMN} are blank.`
      );
      plans.push(basePlan);
      continue;
    }

    basePlan.action = 'link-not-found';
    basePlan.afterLink = replacement.link;
    basePlan.replacementKind = 'external-url';
    basePlan.updateKey = updateKey(entryId, fieldId, beforeLink);
    plans.push(basePlan);
  }

  return plans;
}

function resolveReplacementConflicts(plans: RowPlan[]): void {
  const plansByUpdateKey = new Map<string, RowPlan[]>();

  for (const plan of plans) {
    if (!plan.updateKey || !plan.replacementKind) {
      continue;
    }

    const matches = plansByUpdateKey.get(plan.updateKey) ?? [];
    matches.push(plan);
    plansByUpdateKey.set(plan.updateKey, matches);
  }

  for (const matches of plansByUpdateKey.values()) {
    const replacements = new Set(matches.map(replacementIdentity).filter(isPresent));
    if (replacements.size <= 1) {
      continue;
    }

    for (const plan of matches) {
      plan.action = 'replacement-conflict';
      plan.errors.push(
        `Rows for entry ${plan.entryId ?? 'unknown'}, field ${plan.fieldId}, and link ${plan.beforeLink} have conflicting replacement values.`
      );
    }
  }
}

async function inspectEntries(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  plans: RowPlan[],
  logger: Logger
): Promise<Map<string, any>> {
  const inspectablePlans = plans.filter((plan) =>
    Boolean(plan.updateKey && plan.entryId && plan.replacementKind && plan.action !== 'replacement-conflict')
  );
  const entryIds = [...new Set(inspectablePlans.map((plan) => plan.entryId).filter(isPresent))];
  const entriesById = await fetchEntriesByIds(context, entryIds);

  for (const plan of inspectablePlans) {
    logger.info(`row ${plan.selectionIndex}/${plan.totalSelectedRows} searching`, {
      dataRow: plan.dataRowNumber,
      entryId: plan.entryId,
      fieldId: plan.fieldId,
      link: plan.beforeLink
    });

    const entry = plan.entryId ? entriesById.get(plan.entryId) : undefined;
    if (!entry) {
      plan.action = 'missing-entry';
      plan.errors.push(`Entry ${plan.entryId ?? 'unknown'} was not found in Contentful.`);
      continue;
    }

    plan.contentType = getEntryContentType(entry);
    plan.entryStatus = getEntryStatus(entry);
    if (plan.expectedContentType && plan.contentType !== plan.expectedContentType) {
      plan.action = 'wrong-content-type';
      plan.errors.push(
        `Entry ${plan.entryId ?? 'unknown'} is content type ${plan.contentType || 'unknown'}, not ${plan.expectedContentType}.`
      );
      continue;
    }

    if (isArchived(entry)) {
      plan.action = 'archived-entry';
      plan.errors.push(`Entry ${plan.entryId ?? 'unknown'} is archived.`);
      continue;
    }

    const fieldInspection = inspectLinkField(entry, plan.fieldId, plan.beforeLink, commandConfig.locale);
    plan.fieldKind = fieldInspection.kind;
    plan.occurrences = fieldInspection.occurrences;
    plan.occurrenceCount = fieldInspection.occurrences.reduce((sum, occurrence) => sum + occurrence.count, 0);

    if (plan.occurrenceCount === 0) {
      plan.action = 'link-not-found';
      plan.errors.push(`Link ${plan.beforeLink} was not found in ${plan.fieldId}.`);
      continue;
    }

    if (plan.replacementKind === 'internal-entry' && fieldInspection.kind !== 'rich-text') {
      const targetFieldId = internalReferenceTargetFieldId(plan);
      if (targetFieldId) {
        plan.targetFieldId = targetFieldId;
        plan.warnings.push(
          `Internal page found; ${plan.fieldId} is a ${formatFieldKind(fieldInspection.kind)} field, so ${targetFieldId} will be set to the internal entry reference.`
        );
        continue;
      }

      if (plan.replacementLink && plan.replacementSource !== 'Replacement link') {
        plan.replacementKind = 'external-url';
        plan.afterLink = plan.replacementLink;
        plan.warnings.push(
          `Internal page found, but ${plan.fieldId} is a ${formatFieldKind(fieldInspection.kind)} field and cannot be converted to an entry hyperlink; using the external replacement instead.`
        );
      } else {
        plan.action = 'unsupported-internal-field';
        plan.afterLink = plan.beforeLink;
        plan.replacementKind = undefined;
        plan.updateKey = undefined;
        plan.warnings.push(
          `Internal page found, but ${plan.fieldId} is a ${formatFieldKind(fieldInspection.kind)} field and cannot be converted to an entry hyperlink.`
        );
      }
    }
  }

  return entriesById;
}

function markDryRunActions(plans: RowPlan[], commandConfig: CommandConfig): void {
  for (const plan of plans) {
    if (!isPlanReadyForUpdate(plan)) {
      continue;
    }

    if (plan.replacementKind === 'internal-entry') {
      plan.action = commandConfig.publish ? 'would-update-internal-and-publish' : 'would-update-internal-draft';
      continue;
    }

    plan.action = commandConfig.publish ? 'would-update-and-publish' : 'would-update-draft';
  }
}

function buildChangeGroups(plans: RowPlan[]): ChangeGroup[] {
  const groupByKey = new Map<string, ChangeGroup>();

  for (const plan of plans) {
    if (!isPlanReadyForUpdate(plan) || !plan.entryId || !plan.replacementKind) {
      continue;
    }

    const key = updateKey(plan.entryId, plan.fieldId, plan.beforeLink);
    const existing = groupByKey.get(key);
    if (existing) {
      existing.plans.push(plan);
      continue;
    }

    groupByKey.set(key, {
      entryId: plan.entryId,
      fieldId: plan.fieldId,
      targetFieldId: plan.targetFieldId,
      internalTarget: plan.internalTarget,
      kind: plan.replacementKind,
      newLink: plan.replacementKind === 'internal-entry'
        ? formatInternalLinkTarget(plan.internalTarget)
        : plan.replacementLink ?? '',
      oldLink: plan.beforeLink,
      plans: [plan]
    });
  }

  return [...groupByKey.values()];
}

function groupByFieldId(groups: ChangeGroup[]): Map<string, ChangeGroup[]> {
  const groupsByFieldId = new Map<string, ChangeGroup[]>();

  for (const group of groups) {
    const fieldGroups = groupsByFieldId.get(group.fieldId) ?? [];
    fieldGroups.push(group);
    groupsByFieldId.set(group.fieldId, fieldGroups);
  }

  return groupsByFieldId;
}

async function applyChanges(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  changeGroups: ChangeGroup[],
  entriesById: Map<string, any>,
  logger: Logger
): Promise<void> {
  const groupsByEntryId = new Map<string, ChangeGroup[]>();

  for (const group of changeGroups) {
    const groups = groupsByEntryId.get(group.entryId) ?? [];
    groups.push(group);
    groupsByEntryId.set(group.entryId, groups);
  }

  for (const [entryId, groups] of groupsByEntryId) {
    const plansForEntry = groups.flatMap((group) => group.plans);
    const firstPlan = plansForEntry
      .slice()
      .sort((left, right) => left.selectionIndex - right.selectionIndex)[0];
    const entry = entriesById.get(entryId);

    if (!firstPlan || !entry) {
      continue;
    }

    logger.info(`row ${firstPlan.selectionIndex}/${firstPlan.totalSelectedRows} updating`, {
      dataRows: plansForEntry.map((plan) => plan.dataRowNumber),
      entryId,
      fields: [...new Set(groups.map((group) => group.fieldId))],
      links: groups.length
    });

    try {
      const replacementResultsByField = new Map<string, ReplacementResult>();
      let changed = false;

      for (const [fieldId, fieldGroups] of groupByFieldId(groups)) {
        const referenceGroups = fieldGroups.filter((group) => Boolean(group.targetFieldId));
        const directGroups = fieldGroups.filter((group) => !group.targetFieldId);

        if (referenceGroups.length > 0) {
          const replacementResult = replaceInternalReferenceLinks(
            entry,
            fieldId,
            referenceGroups,
            commandConfig.locale
          );
          replacementResultsByField.set(fieldId, replacementResult);
          changed = replacementResult.changed || changed;
        }

        if (directGroups.length > 0) {
          const replacements = new Map(directGroups.map((group) => [group.oldLink, group]));
          const replacementResult = replaceFieldLinks(entry, fieldId, replacements, commandConfig.locale);
          replacementResultsByField.set(fieldId, mergeReplacementResults(
            replacementResultsByField.get(fieldId),
            replacementResult
          ));
          if (!replacementResult.changed) {
            continue;
          }

          entry.fields[fieldId] = replacementResult.nextFieldValue;
          changed = true;
        }
      }

      if (!changed) {
        for (const plan of plansForEntry) {
          plan.action = 'link-not-found';
          plan.errors.push(`Link ${plan.beforeLink} was not found when applying changes.`);
        }
        continue;
      }

      const updated = await entry.update();

      entriesById.set(entryId, updated);

      for (const group of groups) {
        const replacementResult = replacementResultsByField.get(group.fieldId);
        const countsByLocale = replacementResult?.countsByOldLink.get(group.oldLink);
        const occurrences = countsByLocale
          ? [...countsByLocale.entries()].map(([locale, count]) => ({
            locale: locale || undefined,
            count
          }))
          : [];
        for (const plan of group.plans) {
          plan.occurrences = occurrences;
          plan.occurrenceCount = occurrences.reduce((sum, occurrence) => sum + occurrence.count, 0);
          if (group.kind === 'internal-entry') {
            plan.action = 'updated-internal-draft';
          } else {
            plan.action = 'updated-draft';
          }
        }
      }
    } catch (error) {
      for (const plan of plansForEntry) {
        plan.action = 'update-failed';
        plan.errors.push(errorMessage(error));
      }
      logger.error('Failed to update entry', {
        entryId,
        error: errorMessage(error)
      });
    }
  }
}

function buildPublishGroups(plans: RowPlan[]): PublishGroup[] {
  const groupsByKey = new Map<string, PublishGroup>();

  for (const plan of plans) {
    if (!plan.entryId || !(plan.action === 'updated-draft' || plan.action === 'updated-internal-draft')) {
      continue;
    }

    const key = plan.parentPageId ? `page:${plan.parentPageId}` : `entry:${plan.entryId}`;
    const group = groupsByKey.get(key) ?? {
      changedEntryIds: [],
      key,
      parentPageId: plan.parentPageId,
      parentPageName: plan.parentPageName,
      plans: []
    };

    if (!group.changedEntryIds.includes(plan.entryId)) {
      group.changedEntryIds.push(plan.entryId);
    }
    group.plans.push(plan);
    plan.publishGroupKey = key;
    plan.publishStatus = 'pending';
    groupsByKey.set(key, group);
  }

  return [...groupsByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
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
    logger.info('Publishing page with references', {
      changedEntries: group.changedEntryIds.length,
      groupIndex: index + 1,
      groupTotal: publishGroups.length,
      parentPageId: group.parentPageId ?? 'none',
      parentPageName: group.parentPageName ?? '',
      publishIncludeDepth: commandConfig.publishIncludeDepth
    });

    try {
      const entriesById = await collectPublishGroupEntries(context, group, commandConfig.publishIncludeDepth);
      const candidates = await buildPublishCandidates(context, entriesById, group);
      const publishedCount = candidates.length > 0
        ? await publishBulkActionWithFreshVersions(context, group, candidates, logger)
        : 0;

      for (const plan of group.plans) {
        plan.publishStatus = publishedCount > 0 ? 'succeeded' : 'not-needed';
        if (plan.action === 'updated-internal-draft') {
          plan.action = 'updated-internal-and-published';
        } else if (plan.action === 'updated-draft') {
          plan.action = 'updated-and-published';
        }
      }
    } catch (error) {
      const message = errorMessage(error);
      logger.error('Failed to publish page group', {
        error: message,
        parentPageId: group.parentPageId,
        groupKey: group.key
      });
      for (const plan of group.plans) {
        plan.publishStatus = 'failed';
        plan.errors.push(`Publish failed: ${message}`);
      }
    }
  }
}

async function collectPublishGroupEntries(
  context: ContentfulContext,
  group: PublishGroup,
  includeDepth: number
): Promise<Map<string, any>> {
  const entriesById = new Map<string, any>();

  if (group.parentPageId) {
    const parentEntries = await fetchEntriesByIds(context, [group.parentPageId]);
    const parentEntry = parentEntries.get(group.parentPageId);
    if (!parentEntry) {
      throw new Error(`Parent page ${group.parentPageId} was not found for publish group.`);
    }
    entriesById.set(group.parentPageId, parentEntry);

    const references = await fetchEntryReferences(context, group.parentPageId, includeDepth);
    for (const entry of extractEntriesFromReferenceResponse(references)) {
      const entryId = stringValue(entry?.sys?.id);
      if (entryId) {
        entriesById.set(entryId, entry);
      }
    }
  }

  if (group.changedEntryIds.length > 0) {
    const changedEntries = await fetchEntriesByIds(context, group.changedEntryIds);
    for (const [entryId, entry] of changedEntries) {
      entriesById.set(entryId, entry);
    }
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

  if (candidateIds.length === 0) {
    return [];
  }

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
        entryIds: publishCandidates.map((entry) => stringValue(entry?.sys?.id)).filter(Boolean),
        parentPageId: group.parentPageId,
        groupKey: group.key
      });

      const refreshedEntries = await fetchEntriesByIds(
        context,
        publishCandidates.map((entry) => stringValue(entry?.sys?.id)).filter(isPresent)
      );
      publishCandidates = sortPublishCandidates(
        [...refreshedEntries.values()].filter((entry) => !isArchived(entry) && !isPublishedAndClean(entry)),
        group
      );

      if (publishCandidates.length === 0) {
        return 0;
      }
    }
  }

  return 0;
}

function sortPublishCandidates(candidates: any[], group: PublishGroup): any[] {
  return candidates.sort((left, right) => {
    const leftIsParent = stringValue(left?.sys?.id) === group.parentPageId ? 1 : 0;
    const rightIsParent = stringValue(right?.sys?.id) === group.parentPageId ? 1 : 0;
    return leftIsParent - rightIsParent || stringValue(left?.sys?.id).localeCompare(stringValue(right?.sys?.id));
  });
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

function inspectLinkField(
  entry: any,
  fieldId: string,
  oldLink: string,
  locale?: string
): { kind: LinkFieldKind; occurrences: LinkOccurrence[] } {
  const rawFieldValue = entry?.fields?.[fieldId];
  const localizedValues = getLocalizedValuesFromField(rawFieldValue, locale);
  let kind: LinkFieldKind = 'unsupported';
  const occurrences: LinkOccurrence[] = [];

  for (const item of localizedValues) {
    const valueKind = detectLinkFieldKind(item.value);
    kind = combineFieldKinds(kind, valueKind);
    const count = valueKind === 'rich-text'
      ? countHyperlinkUri(item.value, oldLink)
      : countStringLinkValue(item.value, oldLink);
    if (count > 0) {
      occurrences.push({
        locale: item.locale,
        count
      });
    }
  }

  return { kind, occurrences };
}

function replaceFieldLinks(
  entry: any,
  fieldId: string,
  replacements: Map<string, ChangeGroup>,
  locale?: string
): ReplacementResult {
  const rawFieldValue = entry?.fields?.[fieldId];
  const localizedValues = getLocalizedValuesFromField(rawFieldValue, locale);
  const isLocalized = isLocalizedFieldMap(rawFieldValue);
  const nextFieldValue = isLocalized ? { ...rawFieldValue } : rawFieldValue;
  const countsByOldLink = new Map<string, Map<string, number>>();
  let total = 0;
  let nextSingleValue = rawFieldValue;

  for (const fieldValue of localizedValues) {
    const nextValue = replaceSingleLinkFieldValue(fieldValue.value, replacements);
    const counts = new Map<string, number>();
    countReplacementChanges(fieldValue.value, replacements, counts);
    const localeTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
    if (localeTotal === 0) {
      continue;
    }

    total += localeTotal;
    const localeKey = fieldValue.locale ?? '';
    for (const [oldLink, count] of counts) {
      const existing = countsByOldLink.get(oldLink) ?? new Map<string, number>();
      existing.set(localeKey, (existing.get(localeKey) ?? 0) + count);
      countsByOldLink.set(oldLink, existing);
    }

    if (isLocalizedFieldMap(nextFieldValue) && fieldValue.locale) {
      nextFieldValue[fieldValue.locale] = nextValue;
    } else {
      nextSingleValue = nextValue;
    }
  }

  return {
    changed: total > 0,
    countsByOldLink,
    nextFieldValue: isLocalized ? nextFieldValue : nextSingleValue,
    total
  };
}

function replaceInternalReferenceLinks(
  entry: any,
  sourceFieldId: string,
  groups: ChangeGroup[],
  locale?: string
): ReplacementResult {
  const rawSourceFieldValue = entry?.fields?.[sourceFieldId];
  const localizedValues = getLocalizedValuesFromField(rawSourceFieldValue, locale);
  const isLocalized = isLocalizedFieldMap(rawSourceFieldValue);
  const nextSourceFieldValue = isLocalized ? { ...rawSourceFieldValue } : rawSourceFieldValue;
  const countsByOldLink = new Map<string, Map<string, number>>();
  let nextSingleSourceValue = rawSourceFieldValue;
  let total = 0;

  for (const fieldValue of localizedValues) {
    for (const group of groups) {
      if (group.kind !== 'internal-entry' || !group.internalTarget?.entryId || !group.targetFieldId) {
        continue;
      }

      const count = countStringLinkValue(fieldValue.value, group.oldLink);
      if (count === 0) {
        continue;
      }

      total += count;
      const localeKey = fieldValue.locale ?? '';
      const countsByLocale = countsByOldLink.get(group.oldLink) ?? new Map<string, number>();
      countsByLocale.set(localeKey, (countsByLocale.get(localeKey) ?? 0) + count);
      countsByOldLink.set(group.oldLink, countsByLocale);

      setLocalizedEntryFieldValue(
        entry,
        group.targetFieldId,
        toEntryLink(group.internalTarget.entryId),
        fieldValue.locale
      );
      setLocalizedEntryFieldValue(entry, 'useExternalLink', false, fieldValue.locale);

      const cleared = clearStringLinkValue(fieldValue.value, group.oldLink);
      if (!cleared.changed) {
        continue;
      }

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
  }

  if (total > 0) {
    const nextFieldValue = isLocalized ? nextSourceFieldValue : nextSingleSourceValue;
    if (nextFieldValue === undefined) {
      delete entry.fields[sourceFieldId];
    } else {
      entry.fields[sourceFieldId] = nextFieldValue;
    }
  }

  return {
    changed: total > 0,
    countsByOldLink,
    nextFieldValue: isLocalized ? nextSourceFieldValue : nextSingleSourceValue,
    total
  };
}

function setLocalizedEntryFieldValue(
  entry: any,
  fieldId: string,
  value: unknown,
  locale?: string
): void {
  const rawFieldValue = entry?.fields?.[fieldId];
  if (locale) {
    entry.fields[fieldId] = isLocalizedFieldMap(rawFieldValue)
      ? { ...rawFieldValue, [locale]: value }
      : { [locale]: value };
    return;
  }

  entry.fields[fieldId] = value;
}

function clearStringLinkValue(value: unknown, oldLink: string): { changed: boolean; value: unknown } {
  if (typeof value === 'string') {
    return value.trim() === oldLink
      ? { changed: true, value: undefined }
      : { changed: false, value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.filter((item) => {
      const shouldRemove = typeof item === 'string' && item.trim() === oldLink;
      changed = changed || shouldRemove;
      return !shouldRemove;
    });
    return {
      changed,
      value: nextValue
    };
  }

  return { changed: false, value };
}

function mergeReplacementResults(
  existing: ReplacementResult | undefined,
  next: ReplacementResult
): ReplacementResult {
  if (!existing) {
    return next;
  }

  const countsByOldLink = new Map(existing.countsByOldLink);
  for (const [oldLink, nextCountsByLocale] of next.countsByOldLink) {
    const countsByLocale = countsByOldLink.get(oldLink) ?? new Map<string, number>();
    for (const [locale, count] of nextCountsByLocale) {
      countsByLocale.set(locale, (countsByLocale.get(locale) ?? 0) + count);
    }
    countsByOldLink.set(oldLink, countsByLocale);
  }

  return {
    changed: existing.changed || next.changed,
    countsByOldLink,
    nextFieldValue: next.nextFieldValue,
    total: existing.total + next.total
  };
}

function detectLinkFieldKind(value: unknown): LinkFieldKind {
  if (isRichTextDocument(value)) {
    return 'rich-text';
  }

  if (typeof value === 'string' || Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return 'string';
  }

  return 'unsupported';
}

function combineFieldKinds(current: LinkFieldKind, next: LinkFieldKind): LinkFieldKind {
  if (current === 'rich-text' || next === 'rich-text') {
    return 'rich-text';
  }

  if (current === 'string' || next === 'string') {
    return 'string';
  }

  return 'unsupported';
}

function isRichTextDocument(value: unknown): boolean {
  return isRecord(value) && value.nodeType === 'document';
}

function countStringLinkValue(value: unknown, targetLink: string): number {
  if (typeof value === 'string') {
    return value.trim() === targetLink ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countStringLinkValue(item, targetLink), 0);
  }

  return 0;
}

function replaceSingleLinkFieldValue(
  value: unknown,
  replacements: Map<string, ChangeGroup>
): unknown {
  if (isRichTextDocument(value)) {
    const nextValue = cloneJsonValue(value);
    replaceHyperlinkUrisInPlace(nextValue, replacements, new Map());
    return nextValue;
  }

  if (typeof value === 'string') {
    const replacement = replacements.get(value.trim());
    return replacement?.kind === 'external-url' ? replacement.newLink : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceSingleLinkFieldValue(item, replacements));
  }

  return value;
}

function countReplacementChanges(
  value: unknown,
  replacements: Map<string, ChangeGroup>,
  counts: Map<string, number>
): void {
  if (isRichTextDocument(value)) {
    replaceHyperlinkUrisInPlace(cloneJsonValue(value), replacements, counts);
    return;
  }

  if (typeof value === 'string') {
    const oldLink = value.trim();
    const replacement = replacements.get(oldLink);
    if (replacement?.kind === 'external-url') {
      counts.set(oldLink, (counts.get(oldLink) ?? 0) + 1);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      countReplacementChanges(item, replacements, counts);
    }
  }
}

function formatFieldKind(kind: LinkFieldKind): string {
  switch (kind) {
    case 'rich-text':
      return 'rich text';
    case 'string':
      return 'URL string';
    default:
      return 'unsupported';
  }
}

function internalReferenceTargetFieldId(plan: RowPlan): string | undefined {
  return plan.contentType === 'ctaItem' && CTA_EXTERNAL_URL_FIELD_IDS.has(plan.fieldId)
    ? CTA_INTERNAL_LINK_FIELD_ID
    : undefined;
}

function countHyperlinkUri(value: unknown, targetUri: string): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countHyperlinkUri(item, targetUri), 0);
  }

  if (typeof value !== 'object') {
    return 0;
  }

  const record = value as Record<string, unknown>;
  const uri = optionalStringValue((record.data as Record<string, unknown> | undefined)?.uri);
  const ownCount = record.nodeType === 'hyperlink' && uri === targetUri ? 1 : 0;
  return ownCount + Object.values(record).reduce<number>(
    (sum, item) => sum + countHyperlinkUri(item, targetUri),
    0
  );
}

function replaceHyperlinkUrisInPlace(
  value: unknown,
  replacements: Map<string, ChangeGroup>,
  counts: Map<string, number>
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      replaceHyperlinkUrisInPlace(item, replacements, counts);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const data = isRecord(record.data) ? record.data : undefined;
  const uri = optionalStringValue(data?.uri);
  if (record.nodeType === 'hyperlink' && data && uri) {
    const replacement = replacements.get(uri);
    if (replacement) {
      if (replacement.kind === 'internal-entry') {
        record.nodeType = 'entry-hyperlink';
        record.data = {
          target: toEntryLink(replacement.internalTarget?.entryId ?? replacement.newLink)
        };
      } else {
        data.uri = replacement.newLink;
      }
      counts.set(uri, (counts.get(uri) ?? 0) + 1);
    }
  }

  for (const item of Object.values(record)) {
    replaceHyperlinkUrisInPlace(item, replacements, counts);
  }
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

    for (const item of response?.items ?? []) {
      const entryId = stringValue(item?.sys?.id);
      if (entryId) {
        entriesById.set(entryId, item);
      }
    }
  }

  return entriesById;
}

async function assertInternalEntryHyperlinksSupported(
  context: ContentfulContext,
  plans: RowPlan[]
): Promise<void> {
  const fieldKeys = new Set(
    plans
      .filter((plan) => plan.replacementKind === 'internal-entry' && isPlanReadyForUpdate(plan))
      .map((plan) => `${plan.contentType ?? plan.expectedContentType ?? ''}\u0000${plan.fieldId}`)
      .filter((key) => !key.startsWith('\u0000'))
  );

  for (const fieldKey of fieldKeys) {
    const [contentTypeId, fieldId] = fieldKey.split('\u0000');
    if (!contentTypeId || !fieldId) {
      continue;
    }

    const contentType = await context.environment.getContentType(contentTypeId);
    const field = ((contentType?.fields ?? []) as any[]).find((item) => item?.id === fieldId);
    const enabledNodeTypesValidation = ((field?.validations ?? []) as any[]).find((validation) =>
      Array.isArray(validation?.enabledNodeTypes)
    );
    const enabledNodeTypes = enabledNodeTypesValidation?.enabledNodeTypes;

    if (Array.isArray(enabledNodeTypes) && !enabledNodeTypes.includes('entry-hyperlink')) {
      throw new Error(
        `${contentTypeId}.${fieldId} does not currently allow entry-hyperlink nodes. ` +
        'Enable internal entry hyperlinks in the Contentful model before running --fix-internal with --yes.'
      );
    }
  }
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  plans: RowPlan[],
  slugIndex: SlugIndex
): AmendmentReport {
  return {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      fixInternal: commandConfig.fixInternal,
      inputPath: commandConfig.inputPath,
      limit: commandConfig.limit,
      locale: commandConfig.locale,
      publish: commandConfig.publish,
      publishIncludeDepth: commandConfig.publishIncludeDepth,
      publishIntervalMs: commandConfig.publishIntervalMs,
      requestThrottle: commandConfig.requestThrottle,
      startRow: commandConfig.startRow
    },
    summary: summarize(plans, slugIndex),
    rows: plans
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: AmendmentReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `amend-en-links-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${commandConfig.environmentId}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
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
  lines.push('# EN Link Amendment Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- CSV: ${report.input.inputPath}`);
  lines.push(`- Selection: data row ${report.input.startRow}${report.input.limit ? `, limit ${report.input.limit}` : ' to end'}`);
  lines.push(`- Locale: ${report.input.locale ?? 'all locales'}`);
  lines.push(`- Fix internal links: ${report.input.fixInternal ? 'yes' : 'no'}`);
  lines.push(`- Publish after update: ${report.input.publish ? 'yes' : 'no'}`);
  lines.push(`- Request throttle: ${report.input.requestThrottle} requests/second`);
  lines.push(`- Publish interval: ${report.input.publishIntervalMs} ms`);
  lines.push(`- Publish reference include depth: ${report.input.publishIncludeDepth}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Rows selected | ${report.summary.rowsSelected} |`);
  lines.push(`| Rows with replacement candidates | ${report.summary.rowsWithReplacement} |`);
  lines.push(`| Rows that would update | ${report.summary.rowsWouldUpdate} |`);
  lines.push(`| Rows updated | ${report.summary.rowsUpdated} |`);
  lines.push(`| Internal links that would be fixed | ${report.summary.internalLinksWouldFix} |`);
  lines.push(`| Internal links fixed | ${report.summary.internalLinksFixed} |`);
  lines.push(`| Internal replacement targets not found | ${report.summary.internalReplacementTargetNotFoundRows} |`);
  lines.push(`| Unique entries to change | ${report.summary.uniqueEntriesToChange} |`);
  lines.push(`| Unique entries changed | ${report.summary.uniqueEntriesChanged} |`);
  lines.push(`| Internal page rows skipped | ${report.summary.internalPageRowsSkipped} |`);
  lines.push(`| Ambiguous internal page rows | ${report.summary.ambiguousInternalPageRows} |`);
  lines.push(`| Unsupported internal field rows | ${report.summary.unsupportedInternalFieldRows} |`);
  lines.push(`| HTTPS rows skipped | ${report.summary.httpsRowsSkipped} |`);
  lines.push(`| No replacement rows | ${report.summary.noReplacementRows} |`);
  lines.push(`| Link not found rows | ${report.summary.linkNotFoundRows} |`);
  lines.push(`| Missing entries | ${report.summary.missingEntries} |`);
  lines.push(`| Wrong content type rows | ${report.summary.wrongContentTypeRows} |`);
  lines.push(`| Archived entries | ${report.summary.archivedEntries} |`);
  lines.push(`| Publish groups | ${report.summary.publishGroups} |`);
  lines.push(`| Publish groups succeeded | ${report.summary.publishGroupsSucceeded} |`);
  lines.push(`| Publish groups not needed | ${report.summary.publishGroupsNotNeeded} |`);
  lines.push(`| Publish groups failed | ${report.summary.publishGroupsFailed} |`);
  lines.push(`| Replacement conflict rows | ${report.summary.replacementConflictRows} |`);
  lines.push(`| Pages scanned for slug check | ${report.summary.entriesScannedForSlugCheck} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  lines.push('## Row Details');
  lines.push('');
  for (const row of report.rows) {
    lines.push(`### Row ${row.dataRowNumber} (CSV line ${row.csvLineNumber})${row.entryId ? ` - ${row.entryId}` : ''}`);
    lines.push('');
    lines.push(`- Action: ${row.action}`);
    if (row.entityName) {
      lines.push(`- Entity name: ${row.entityName}`);
    }
    lines.push(`- Field: ${row.fieldId}`);
    if (row.targetFieldId) {
      lines.push(`- Internal reference target field: ${row.targetFieldId}`);
    }
    if (row.contentType) {
      lines.push(`- Content type: ${row.contentType}`);
    } else if (row.expectedContentType) {
      lines.push(`- Expected content type: ${row.expectedContentType}`);
    }
    if (row.fieldKind) {
      lines.push(`- Field kind: ${formatFieldKind(row.fieldKind)}`);
    }
    if (row.entryStatus) {
      lines.push(`- Entry status before run: ${row.entryStatus}`);
    }
    if (row.parentPageId || row.parentPageName || row.parentPageType || row.parentPageSlug) {
      lines.push(`- Parent page: ${formatParentPage(row)}`);
    }
    lines.push(`- Link before change: ${row.beforeLink || 'n/a'}`);
    lines.push(`- Link after change: ${row.afterLink || row.beforeLink || 'unchanged'}`);
    if (row.replacementSource) {
      lines.push(`- Replacement source: ${row.replacementSource}`);
    }
    if (row.internalTarget) {
      lines.push(`- Internal link target: ${formatInternalLinkTarget(row.internalTarget)}`);
    }
    if (row.publishStatus) {
      lines.push(`- Publish status: ${row.publishStatus}`);
    }
    lines.push(`- Internal slug checked: ${row.internalSlug ?? 'n/a'}`);
    if (row.internalPageMatches.length > 0) {
      lines.push('- Internal page found:');
      for (const match of row.internalPageMatches) {
        lines.push(
          `  - ${match.contentType}:${match.entryId} (${match.slug}${match.locale ? `, ${match.locale}` : ''})${match.internalName ? ` - ${match.internalName}` : ''}`
        );
      }
    }
    lines.push(`- Link occurrences: ${formatOccurrences(row.occurrences)}`);
    if (row.warnings.length > 0) {
      for (const warning of row.warnings) {
        lines.push(`- Warning: ${warning}`);
      }
    }
    if (row.errors.length > 0) {
      for (const error of row.errors) {
        lines.push(`- Error: ${error}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function summarize(plans: RowPlan[], slugIndex: SlugIndex): ReportSummary {
  const uniqueEntriesToChange = new Set(
    plans
      .filter(isWouldUpdateAction)
      .map((plan) => plan.entryId)
      .filter(isPresent)
  );
  const uniqueEntriesChanged = new Set(
    plans
      .filter(isUpdatedAction)
      .map((plan) => plan.entryId)
      .filter(isPresent)
  );
  const publishGroupStatuses = summarizePublishGroupStatuses(plans);

  return {
    ambiguousInternalPageRows: plans.filter((plan) => plan.action === 'ambiguous-internal-page-match').length,
    archivedEntries: plans.filter((plan) => plan.action === 'archived-entry').length,
    entriesScannedForSlugCheck: slugIndex.entriesScanned,
    errors: plans.reduce((sum, plan) => sum + plan.errors.length, 0),
    httpsRowsSkipped: plans.filter((plan) => plan.action === 'skipped-https-link').length,
    internalLinksFixed: plans.filter((plan) => plan.action === 'updated-internal-and-published' || plan.action === 'updated-internal-draft').length,
    internalReplacementTargetNotFoundRows: plans.filter((plan) => plan.action === 'internal-replacement-target-not-found').length,
    internalLinksWouldFix: plans.filter((plan) => plan.action === 'would-update-internal-and-publish' || plan.action === 'would-update-internal-draft').length,
    internalPageRowsSkipped: plans.filter((plan) => plan.action === 'skipped-internal-page-found').length,
    linkNotFoundRows: plans.filter((plan) => plan.action === 'link-not-found').length,
    missingEntries: plans.filter((plan) => plan.action === 'missing-entry').length,
    noReplacementRows: plans.filter((plan) => plan.action === 'skipped-no-replacement').length,
    publishGroups: publishGroupStatuses.total,
    publishGroupsFailed: publishGroupStatuses.failed,
    publishGroupsNotNeeded: publishGroupStatuses.notNeeded,
    publishGroupsSucceeded: publishGroupStatuses.succeeded,
    replacementConflictRows: plans.filter((plan) => plan.action === 'replacement-conflict').length,
    rowsSelected: plans.length,
    rowsWithReplacement: plans.filter((plan) => Boolean(plan.replacementKind || plan.replacementLink)).length,
    rowsWouldUpdate: plans.filter(isWouldUpdateAction).length,
    rowsUpdated: plans.filter(isUpdatedAction).length,
    unsupportedInternalFieldRows: plans.filter((plan) => plan.action === 'unsupported-internal-field').length,
    uniqueEntriesChanged: uniqueEntriesChanged.size,
    uniqueEntriesToChange: uniqueEntriesToChange.size,
    warnings: plans.reduce((sum, plan) => sum + plan.warnings.length, 0),
    wrongContentTypeRows: plans.filter((plan) => plan.action === 'wrong-content-type').length
  };
}

function pickReplacement(
  row: string[],
  columns: Pick<ColumnIndices, 'quadientLink' | 'mailQuadientLink' | 'replacementLink'>
): ReplacementCandidate | undefined {
  const replacementLink = optionalCellValue(row, columns.replacementLink);
  if (replacementLink) {
    return {
      kind: 'internal-link',
      link: replacementLink,
      source: 'Replacement link'
    };
  }

  const quadientLink = optionalCellValue(row, columns.quadientLink);
  if (quadientLink) {
    return {
      kind: 'external-url',
      link: quadientLink,
      source: 'quadient.com'
    };
  }

  const mailQuadientLink = optionalCellValue(row, columns.mailQuadientLink);
  if (mailQuadientLink) {
    return {
      kind: 'external-url',
      link: mailQuadientLink,
      source: 'mail.quadient.com'
    };
  }

  return undefined;
}

function selectInternalTarget(matches: InternalPageMatch[]): InternalPageMatch | undefined {
  const matchesByEntryId = new Map<string, InternalPageMatch>();
  for (const match of matches) {
    if (!matchesByEntryId.has(match.entryId)) {
      matchesByEntryId.set(match.entryId, match);
    }
  }

  const uniqueMatches = [...matchesByEntryId.values()];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : undefined;
}

function summarizePublishGroupStatuses(plans: RowPlan[]): {
  failed: number;
  notNeeded: number;
  succeeded: number;
  total: number;
} {
  const statusesByGroup = new Map<string, RowPlan['publishStatus']>();

  for (const plan of plans) {
    if (!plan.publishGroupKey || !plan.publishStatus) {
      continue;
    }

    const existing = statusesByGroup.get(plan.publishGroupKey);
    if (existing === 'failed') {
      continue;
    }

    if (plan.publishStatus === 'failed' || !existing) {
      statusesByGroup.set(plan.publishGroupKey, plan.publishStatus);
    }
  }

  const statuses = [...statusesByGroup.values()];
  return {
    failed: statuses.filter((status) => status === 'failed').length,
    notNeeded: statuses.filter((status) => status === 'not-needed').length,
    succeeded: statuses.filter((status) => status === 'succeeded').length,
    total: statuses.length
  };
}

function replacementIdentity(plan: RowPlan): string | undefined {
  if (plan.replacementKind === 'internal-entry') {
    return plan.internalTarget?.entryId ? `entry:${plan.internalTarget.entryId}` : undefined;
  }

  if (plan.replacementKind === 'external-url') {
    return plan.replacementLink ? `url:${plan.replacementLink}` : undefined;
  }

  return undefined;
}

function formatInternalLinkTarget(target: InternalPageMatch | undefined): string {
  if (!target) {
    return 'Contentful entry link: n/a';
  }

  return `Contentful entry link: ${target.contentType}:${target.entryId} (${target.slug})`;
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

function isPlanReadyForUpdate(plan: RowPlan): boolean {
  return (
    Boolean(plan.entryId && plan.replacementKind && plan.updateKey) &&
    (plan.replacementKind !== 'external-url' || Boolean(plan.replacementLink)) &&
    (plan.replacementKind !== 'internal-entry' || Boolean(plan.internalTarget?.entryId)) &&
    plan.action !== 'replacement-conflict' &&
    plan.action !== 'ambiguous-internal-page-match' &&
    plan.action !== 'unsupported-internal-field' &&
    plan.action !== 'missing-entry' &&
    plan.action !== 'wrong-content-type' &&
    plan.action !== 'archived-entry' &&
    plan.occurrenceCount > 0 &&
    plan.errors.length === 0
  );
}

function isWouldUpdateAction(plan: RowPlan): boolean {
  return (
    plan.action === 'would-update-and-publish' ||
    plan.action === 'would-update-draft' ||
    plan.action === 'would-update-internal-and-publish' ||
    plan.action === 'would-update-internal-draft'
  );
}

function isUpdatedAction(plan: RowPlan): boolean {
  return (
    plan.action === 'updated-and-published' ||
    plan.action === 'updated-draft' ||
    plan.action === 'updated-internal-and-published' ||
    plan.action === 'updated-internal-draft'
  );
}

function isEntryResource(value: unknown): boolean {
  return isRecord(value) && stringValue(value.sys?.type) === 'Entry' && isRecord(value.fields);
}

function getLocalizedValuesFromField(fieldValue: unknown, locale?: string): LocalizedFieldValue[] {
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

  return Object.entries(fieldValue).map(([fieldLocale, value]) => ({
    locale: fieldLocale,
    value
  }));
}

function getFieldValues(entry: any, fieldId: string): LocalizedFieldValue[] {
  const rawValue = entry?.fields?.[fieldId];
  if (rawValue === undefined) {
    return [];
  }

  if (!isLocalizedFieldMap(rawValue)) {
    return [{ value: rawValue }];
  }

  return Object.entries(rawValue).map(([locale, value]) => ({
    locale,
    value
  }));
}

function isLocalizedFieldMap(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'sys') &&
    !Object.prototype.hasOwnProperty.call(value, 'nodeType')
  );
}

function slugFromEnLink(value: string): string {
  const pathOnly = value.trim().replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/, 1)[0] ?? '';
  const segments = pathOnly.split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'en') {
    segments.shift();
  }

  return normalizeSlugForLookup(segments.join('/'));
}

function normalizeSlugForLookup(value: string): string {
  const withoutOrigin = value.trim().replace(/^https?:\/\/[^/]+/i, '');
  const pathOnly = withoutOrigin.split(/[?#]/, 1)[0] ?? '';
  const segments = pathOnly.split('/').filter(Boolean);
  if (segments[0] && isLocaleSegment(segments[0])) {
    segments.shift();
  }

  return segments.join('/').replace(/^\/+|\/+$/g, '').trim();
}

function isLocaleSegment(value: string): boolean {
  return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(value.trim());
}

function firstLocalizedStringValue(entry: any, fieldId: string): string | undefined {
  return getFieldValues(entry, fieldId)
    .map((fieldValue) => stringifyStringFieldValue(fieldValue.value))
    .find((value) => value.length > 0);
}

function stringifyStringFieldValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function requireAnyColumn(header: string[], columnNames: string[]): number {
  const index = findAnyColumnIndex(header, columnNames);
  if (index < 0) {
    throw new Error(`Unable to find required CSV column: one of ${columnNames.join(', ')}`);
  }

  return index;
}

function findAnyColumnIndex(header: string[], columnNames: string[]): number {
  for (const columnName of columnNames) {
    const index = findColumnIndex(header, columnName);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
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
    columns.entryId,
    columns.entityName,
    columns.entityLink,
    columns.contentType,
    columns.fieldId,
    columns.oldLink,
    columns.quadientLink,
    columns.mailQuadientLink,
    columns.replacementLink,
    columns.parentPageId,
    columns.parentPageType,
    columns.parentPageName,
    columns.parentPageSlug
  );
}

function formatParentPage(row: RowPlan): string {
  const parts = [
    row.parentPageType,
    row.parentPageId,
    row.parentPageName,
    row.parentPageSlug ? `slug ${row.parentPageSlug}` : undefined
  ].filter(isPresent);

  return parts.join(' | ') || 'n/a';
}

function formatOccurrences(occurrences: LinkOccurrence[]): string {
  if (occurrences.length === 0) {
    return '0';
  }

  return occurrences
    .map((occurrence) => `${occurrence.locale ?? 'default'}=${occurrence.count}`)
    .join(', ');
}

function updateKey(entryId: string, fieldId: string, oldLink: string): string {
  return `${entryId}\u0000${fieldId}\u0000${oldLink}`;
}

function getEntryContentType(entry: any): string {
  return stringValue(entry?.sys?.contentType?.sys?.id);
}

function getEntryStatus(entry: any): string {
  if (isArchived(entry)) {
    return 'archived';
  }

  if (isPublished(entry) && isUpdated(entry)) {
    return 'published with unpublished changes';
  }

  if (isPublished(entry)) {
    return 'published';
  }

  if (typeof entry?.isDraft === 'function' && entry.isDraft()) {
    return 'draft';
  }

  return 'unpublished';
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
  min: number,
  max: number
): number | undefined {
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
