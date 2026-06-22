import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  createTag,
  getTags,
  updateTag
} from '../lib/contentful-client.js';
import type { ContentfulContext, ContentfulTagResource } from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  buildGroupedTagDefinition,
  parseContentfulTagVisibility
} from '../lib/tag-service.js';
import type { GroupedTagDefinition } from '../lib/tag-service.js';
import { toContentfulResourceId } from '../lib/ids.js';
import type {
  CliFlags,
  ContentfulTagVisibility,
  LoadedProjectConfig,
  RuntimeEnv
} from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'tag documents', 'Form_Tag_Data.csv');
const DEFAULT_CONTENT_TYPE = 'resourcePage';
const DEFAULT_ENTRY_ID_COLUMN = 'contentful-entryId';
const DEFAULT_INTERNAL_NAME_COLUMN = 'contentful-internalName';
const DEFAULT_FORM_URL_COLUMN = 'Form URL';
const CONTENTFUL_BATCH_SIZE = 100;

type TransformKind = 'single' | 'solution' | 'journey-stage';
type RowAction =
  | 'skipped-missing-entry-id'
  | 'missing-entry'
  | 'wrong-content-type'
  | 'no-tags'
  | 'no-change'
  | 'would-update-entry'
  | 'updated-entry';
type TagAction =
  | 'would-create'
  | 'created'
  | 'existing'
  | 'would-update-name'
  | 'updated-name'
  | 'name-conflict';

interface CommandConfig {
  allowNonSandbox: boolean;
  contentType: string;
  dryRun: boolean;
  entryIdColumn: string;
  environmentId: string;
  inputPath: string;
  rowNumber?: number;
  selectedEntryId?: string;
  separator: string;
  updateExistingName: boolean;
  visibility: ContentfulTagVisibility;
}

interface CsvTable {
  rows: string[][];
}

interface ColumnMapping {
  column: string;
  group: string;
  transform: TransformKind;
}

interface PlanIssue {
  severity: 'error' | 'warning';
  message: string;
  rowNumber?: number;
  entryId?: string;
  tagId?: string;
}

interface TagValueSource {
  column: string;
  rawValue: string;
  rowNumber: number;
}

interface PlannedTag {
  definition: PlainGroupedTagDefinition;
  sources: TagValueSource[];
}

interface TagCatalogItem extends PlannedTag {
  action: TagAction;
  existing?: ContentfulTagResource;
  warnings: string[];
}

interface PlannedEntryTag extends PlannedTag {
  alreadyPresent?: boolean;
}

interface EntryRowPlan {
  action: RowAction;
  contentType?: string;
  entryId?: string;
  errors: string[];
  existingTagIds: string[];
  formUrl?: string;
  internalName?: string;
  rowNumber: number;
  tags: PlannedEntryTag[];
  tagsAlreadyPresent: PlannedEntryTag[];
  tagsToAdd: PlannedEntryTag[];
  warnings: string[];
}

interface PlainGroupedTagDefinition {
  group: string;
  id: string;
  name: string;
  tag: string;
  visibility: ContentfulTagVisibility;
}

interface FormTagReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  spaceId?: string;
  environmentId: string;
  input: {
    contentType: string;
    entryIdColumn: string;
    inputPath: string;
    selector?: string;
    separator: string;
    updateExistingName: boolean;
    visibility: ContentfulTagVisibility;
  };
  summary: ReportSummary;
  tags: TagCatalogItem[];
  entries: EntryRowPlan[];
  issues: PlanIssue[];
}

interface ReportSummary {
  createdTags: number;
  errors: number;
  existingTags: number;
  missingEntryIdRows: number;
  nameConflictTags: number;
  noChangeEntries: number;
  rowCount: number;
  rowsWithEntryId: number;
  tagsToCreate: number;
  tagsToUpdateName: number;
  uniqueTags: number;
  updatedEntries: number;
  warnings: number;
  wouldCreateTags: number;
  wouldUpdateEntries: number;
  wouldUpdateTagNames: number;
}

const FORM_TAG_MAPPINGS: ColumnMapping[] = [
  { column: 'Solution', group: 'Solution', transform: 'solution' },
  { column: 'form-reference Product', group: 'Product Interest', transform: 'single' },
  { column: 'form-reference Journey Stage', group: 'Journey Stage', transform: 'journey-stage' },
  { column: 'Campaign Name', group: 'Campaign Name', transform: 'single' },
  { column: '[BW] Lead Source', group: 'Lead Source', transform: 'single' },
  { column: '[BW]CampaignID', group: 'BW Campaign ID', transform: 'single' },
  { column: '[BW]MemberStatus', group: 'Campaign Member Status', transform: 'single' },
  { column: '[CXM]CampaignID', group: 'CXM Campaign ID', transform: 'single' },
  { column: '[CXM]MemberStatus', group: 'Campaign Member Status', transform: 'single' },
  { column: '[GLOBAL]CampaignID', group: 'Global Campaign ID', transform: 'single' },
  { column: '[GLOBAL]MemberStatus', group: 'Campaign Member Status', transform: 'single' },
  { column: '[MONET] Product Interest - IDA', group: 'Product Interest', transform: 'single' },
  { column: '[MONET]MemberStatus', group: 'Campaign Member Status', transform: 'single' },
  { column: '[US] Other Lead Source', group: 'Lead Source Other', transform: 'single' },
  { column: '[US] Product Interest - Mail', group: 'Product Interest', transform: 'single' },
  { column: '[US]CampaignID', group: 'US Campaign ID', transform: 'single' },
  { column: 'US]Form Name - US Routing', group: 'Form Name', transform: 'single' },
  { column: '[US]MemberStatus', group: 'Campaign Member Status', transform: 'single' }
];

const SOLUTION_VALUE_MAP: Record<string, string> = {
  AP: 'Accounts Payable',
  AR: 'Accounts Receivable',
  CXM: 'Customer Communications',
  IDA: 'Intelligent Document Automation',
  MRS: 'Mailing and Shipping'
};

const VALID_JOURNEY_STAGES = new Set([
  'Awareness',
  'Comparison',
  'Consideration',
  'Conversion'
]);

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'form-tags');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(
    flags,
    projectConfig.env,
    projectConfig.conventions.tags.namespaceSeparator
  );

  logger.info(commandConfig.dryRun ? 'Preparing form tag dry run' : 'Preparing form tag upload', {
    inputPath: commandConfig.inputPath,
    environmentId: commandConfig.environmentId,
    contentType: commandConfig.contentType,
    selector: renderSelector(commandConfig)
  });

  const csv = await readFile(commandConfig.inputPath, 'utf8');
  const table = parseCsvTable(csv);
  if (table.rows.length === 0) {
    throw new Error(`CSV file is empty: ${commandConfig.inputPath}`);
  }

  const { entries, tagCatalog, issues } = buildPlan(table, commandConfig);
  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  logger.info('Checking Contentful tags and entries', {
    plannedEntries: entries.filter((entry) => entry.entryId).length,
    uniqueTags: tagCatalog.length
  });

  await inspectTags(context, tagCatalog, entries, commandConfig, issues);
  const entriesById = await inspectEntries(context, entries, commandConfig, issues);

  if (hasErrors(issues)) {
    const report = buildReport(projectConfig, commandConfig, entries, tagCatalog, issues);
    const reportPaths = await writeReports(projectConfig, commandConfig, report);
    logger.error('Form tag run has blocking errors; no Contentful writes were made', {
      errors: report.summary.errors,
      report: reportPaths.markdownPath
    });
    process.exitCode = 1;
    return;
  }

  if (!commandConfig.dryRun) {
    logger.info('Creating or updating tags', {
      tagsToCreate: tagCatalog.filter((tag) => tag.action === 'would-create').length,
      tagNamesToUpdate: tagCatalog.filter((tag) => tag.action === 'would-update-name').length
    });
    await applyTagChanges(context, tagCatalog);

    logger.info('Adding tags to entries', {
      entriesToUpdate: countEntriesToUpdate(entries)
    });
    await applyEntryChanges(entries, entriesById);
  }

  const report = buildReport(projectConfig, commandConfig, entries, tagCatalog, issues);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  for (const issue of issues.filter((item) => item.severity === 'warning')) {
    logger.warn(issue.message, {
      rowNumber: issue.rowNumber,
      entryId: issue.entryId,
      tagId: issue.tagId
    });
  }

  logger.info(commandConfig.dryRun ? 'Form tag dry run finished' : 'Form tag upload finished', {
    report: reportPaths.markdownPath,
    ...report.summary
  });
}

function resolveCommandConfig(
  flags: CliFlags,
  env: RuntimeEnv,
  defaultSeparator: string
): CommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);

  const environmentId =
    stringFlag(flags, 'env') ??
    stringFlag(flags, 'environment') ??
    env.CONTENTFUL_ENVIRONMENT_ID;

  if (!environmentId) {
    throw new Error('Missing Contentful environment. Use --env <environment>.');
  }

  const rowNumber = parsePositiveIntegerFlag(flags, ['row', 'row-number', 'csv-row']);
  const selectedEntryId = stringFlag(flags, 'entry-id');
  if (rowNumber !== undefined && selectedEntryId) {
    throw new Error('Use either --row <csv-row-number> or --entry-id <entry-id>, not both.');
  }
  if (rowNumber !== undefined && rowNumber < 2) {
    throw new Error('CSV row numbers include the header row, so --row must be 2 or greater.');
  }

  const visibility = parseContentfulTagVisibility(flags.visibility, 'public');
  if (visibility !== 'public') {
    throw new Error('Tags must be public. Remove --visibility private or use --visibility public.');
  }

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    contentType: stringFlag(flags, 'content-type') ?? DEFAULT_CONTENT_TYPE,
    dryRun: !flags.yes,
    entryIdColumn: stringFlag(flags, 'entry-id-column') ?? DEFAULT_ENTRY_ID_COLUMN,
    environmentId,
    inputPath: path.resolve(stringFlag(flags, 'input') ?? stringFlag(flags, 'source') ?? DEFAULT_INPUT_PATH),
    rowNumber,
    selectedEntryId,
    separator: stringFlag(flags, 'separator') ?? defaultSeparator,
    updateExistingName: Boolean(flags['update-existing-name']),
    visibility
  };
}

function buildPlan(
  table: CsvTable,
  commandConfig: CommandConfig
): { entries: EntryRowPlan[]; tagCatalog: TagCatalogItem[]; issues: PlanIssue[] } {
  const header = table.rows[0];
  if (!header) {
    throw new Error('CSV file has no header row.');
  }

  const issues: PlanIssue[] = [];
  const columnIndices = new Map<string, number>();
  const requiredColumns = [
    commandConfig.entryIdColumn,
    ...FORM_TAG_MAPPINGS.map((mapping) => mapping.column)
  ];

  for (const columnName of requiredColumns) {
    columnIndices.set(columnName, requireColumn(header, columnName));
  }

  const internalNameColumnIndex = findColumnIndex(header, DEFAULT_INTERNAL_NAME_COLUMN);
  const formUrlColumnIndex = findColumnIndex(header, DEFAULT_FORM_URL_COLUMN);
  const entryIdColumnIndex = columnIndices.get(commandConfig.entryIdColumn);
  if (entryIdColumnIndex === undefined) {
    throw new Error(`Unable to find entry ID column: ${commandConfig.entryIdColumn}`);
  }

  const entries: EntryRowPlan[] = [];
  const tagDefinitions = new Map<string, PlannedTag>();
  const sourceDefinitionById = new Map<string, PlainGroupedTagDefinition>();

  for (let rowIndex = 1; rowIndex < table.rows.length; rowIndex += 1) {
    const row = table.rows[rowIndex];
    if (!row || row.every((value) => normalizeCellValue(value) === '')) {
      continue;
    }

    ensureRowLength(row, header.length);
    const rowNumber = rowIndex + 1;
    const entryId = normalizeCellValue(row[entryIdColumnIndex] ?? '');
    if (!shouldIncludeRow(rowNumber, entryId, commandConfig)) {
      continue;
    }

    const rowIssues: PlanIssue[] = [];
    const entryTagsById = new Map<string, PlannedEntryTag>();

    for (const mapping of FORM_TAG_MAPPINGS) {
      const columnIndex = columnIndices.get(mapping.column);
      if (columnIndex === undefined) {
        continue;
      }

      const rawValue = row[columnIndex] ?? '';
      const transformedValues = transformCellValue(rawValue, mapping, rowNumber, rowIssues);

      for (const value of transformedValues) {
        const definition = toPlainDefinition(
          buildGroupedTagDefinition({
            group: mapping.group,
            tag: value,
            separator: commandConfig.separator,
            visibility: commandConfig.visibility
          })
        );
        const source: TagValueSource = {
          column: mapping.column,
          rawValue: normalizeCellValue(rawValue),
          rowNumber
        };
        const existingSourceDefinition = sourceDefinitionById.get(definition.id);

        if (existingSourceDefinition && existingSourceDefinition.name !== definition.name) {
          rowIssues.push({
            severity: 'error',
            rowNumber,
            tagId: definition.id,
            message:
              `Generated tag ID ${definition.id} maps to both "${existingSourceDefinition.name}" ` +
              `and "${definition.name}". Adjust the CSV value or mapping to avoid a Contentful tag ID collision.`
          });
        } else {
          sourceDefinitionById.set(definition.id, definition);
        }

        const existingEntryTag = entryTagsById.get(definition.id);
        if (existingEntryTag) {
          existingEntryTag.sources.push(source);
        } else {
          entryTagsById.set(definition.id, {
            definition,
            sources: [source]
          });
        }

        const existingCatalogTag = tagDefinitions.get(definition.id);
        if (existingCatalogTag) {
          existingCatalogTag.sources.push(source);
        } else {
          tagDefinitions.set(definition.id, {
            definition,
            sources: [source]
          });
        }
      }
    }

    issues.push(...rowIssues);
    const warnings = rowIssues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => issue.message);
    const errors = rowIssues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message);

    if (!entryId) {
      const message = `Row ${rowNumber} has no ${commandConfig.entryIdColumn}; skipping.`;
      issues.push({ severity: 'warning', rowNumber, message });
      warnings.push(message);
    }

    entries.push({
      action: entryId ? 'no-tags' : 'skipped-missing-entry-id',
      entryId: entryId || undefined,
      errors,
      existingTagIds: [],
      formUrl: optionalCellValue(row, formUrlColumnIndex),
      internalName: optionalCellValue(row, internalNameColumnIndex),
      rowNumber,
      tags: [...entryTagsById.values()],
      tagsAlreadyPresent: [],
      tagsToAdd: [],
      warnings
    });
  }

  const tagCatalog: TagCatalogItem[] = [...tagDefinitions.values()]
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name))
    .map((tag) => ({
      ...tag,
      action: 'would-create',
      warnings: []
    }));

  if (entries.length === 0) {
    issues.push({
      severity: 'error',
      message: `No CSV rows matched selector ${renderSelector(commandConfig) ?? 'all rows'}.`
    });
  }

  return { entries, tagCatalog, issues };
}

async function inspectTags(
  context: ContentfulContext,
  tagCatalog: TagCatalogItem[],
  entries: EntryRowPlan[],
  commandConfig: CommandConfig,
  issues: PlanIssue[]
): Promise<void> {
  const existingTagList = await getTags(context);
  const existingTags = new Map(existingTagList.map((tag) => [tag.id, tag]));
  const existingTagsByName = new Map(existingTagList.map((tag) => [tag.name, tag]));

  for (const tag of tagCatalog) {
    const generatedId = tag.definition.id;
    let existing = existingTags.get(generatedId);
    if (!existing) {
      existing = existingTagsByName.get(tag.definition.name);
      if (!existing) {
        tag.action = 'would-create';
        continue;
      }

      rewritePlannedTagId(entries, generatedId, existing.id);
      tag.definition.id = existing.id;
      const message =
        `Existing tag name "${tag.definition.name}" uses ID ${existing.id}; ` +
        `using that instead of generated ID ${generatedId}.`;
      tag.warnings.push(message);
      issues.push({
        severity: 'warning',
        tagId: existing.id,
        message
      });
    }

    tag.existing = existing;

    if (existing.visibility && existing.visibility !== tag.definition.visibility) {
      const message =
        `Existing tag ${tag.definition.id} visibility is ${existing.visibility}; ` +
        `requested ${tag.definition.visibility}. Visibility will be left unchanged.`;
      tag.warnings.push(message);
      issues.push({
        severity: 'warning',
        tagId: tag.definition.id,
        message
      });
    }

    if (existing.name === tag.definition.name) {
      tag.action = 'existing';
      continue;
    }

    if (commandConfig.updateExistingName) {
      tag.action = 'would-update-name';
      continue;
    }

    tag.action = 'name-conflict';
    const message =
      `Tag ID ${tag.definition.id} already exists as "${existing.name}", ` +
      `but this run needs "${tag.definition.name}". Re-run with --update-existing-name to rename it.`;
    tag.warnings.push(message);
    issues.push({
      severity: 'error',
      tagId: tag.definition.id,
      message
    });
  }
}

async function inspectEntries(
  context: ContentfulContext,
  entries: EntryRowPlan[],
  commandConfig: CommandConfig,
  issues: PlanIssue[]
): Promise<Map<string, any>> {
  const entryIds = [...new Set(entries.map((entry) => entry.entryId).filter(isPresent))];
  const entriesById = await fetchEntriesById(context, entryIds);

  for (const entry of entries) {
    if (!entry.entryId) {
      continue;
    }

    const contentfulEntry = entriesById.get(entry.entryId);
    if (!contentfulEntry) {
      entry.action = 'missing-entry';
      const message = `Entry ${entry.entryId} was not found in Contentful.`;
      entry.errors.push(message);
      issues.push({
        severity: 'error',
        rowNumber: entry.rowNumber,
        entryId: entry.entryId,
        message
      });
      continue;
    }

    entry.contentType = getEntryContentType(contentfulEntry);
    if (entry.contentType !== commandConfig.contentType) {
      entry.action = 'wrong-content-type';
      const message =
        `Entry ${entry.entryId} is content type ${entry.contentType ?? 'unknown'}, ` +
        `not ${commandConfig.contentType}.`;
      entry.errors.push(message);
      issues.push({
        severity: 'error',
        rowNumber: entry.rowNumber,
        entryId: entry.entryId,
        message
      });
      continue;
    }

    entry.existingTagIds = getEntryTagIds(contentfulEntry);
    const existingTagIds = new Set(entry.existingTagIds);
    entry.tagsAlreadyPresent = entry.tags
      .filter((tag) => existingTagIds.has(tag.definition.id))
      .map((tag) => ({ ...tag, alreadyPresent: true }));
    entry.tagsToAdd = entry.tags.filter((tag) => !existingTagIds.has(tag.definition.id));

    if (entry.tags.length === 0) {
      entry.action = 'no-tags';
      const message = `Row ${entry.rowNumber} did not produce any tags for entry ${entry.entryId}.`;
      entry.warnings.push(message);
      issues.push({
        severity: 'warning',
        rowNumber: entry.rowNumber,
        entryId: entry.entryId,
        message
      });
    } else if (entry.tagsToAdd.length === 0) {
      entry.action = 'no-change';
    } else {
      entry.action = commandConfig.dryRun ? 'would-update-entry' : 'would-update-entry';
    }
  }

  return entriesById;
}

async function applyTagChanges(
  context: ContentfulContext,
  tagCatalog: TagCatalogItem[]
): Promise<void> {
  for (const tag of tagCatalog) {
    if (tag.action === 'would-create') {
      const result = await createTag(
        context,
        tag.definition.id,
        tag.definition.name,
        tag.definition.visibility
      );
      tag.action = result === 'created' ? 'created' : 'existing';
      continue;
    }

    if (tag.action === 'would-update-name') {
      if (typeof tag.existing?.version !== 'number') {
        throw new Error(`Cannot update tag ${tag.definition.id}; Contentful did not return its version.`);
      }

      tag.existing = await updateTag(context, tag.definition.id, {
        name: tag.definition.name,
        version: tag.existing.version
      });
      tag.action = 'updated-name';
    }
  }
}

async function applyEntryChanges(
  entries: EntryRowPlan[],
  entriesById: Map<string, any>
): Promise<void> {
  const updatePlansByEntryId = new Map<string, EntryRowPlan[]>();

  for (const entry of entries) {
    if (!entry.entryId || entry.errors.length > 0 || entry.tagsToAdd.length === 0) {
      continue;
    }

    const existingPlans = updatePlansByEntryId.get(entry.entryId) ?? [];
    existingPlans.push(entry);
    updatePlansByEntryId.set(entry.entryId, existingPlans);
  }

  for (const [entryId, plans] of updatePlansByEntryId) {
    const contentfulEntry = entriesById.get(entryId);
    if (!contentfulEntry) {
      continue;
    }

    const currentMetadata = isRecord(contentfulEntry.metadata) ? contentfulEntry.metadata : {};
    const currentTags = Array.isArray(currentMetadata.tags) ? currentMetadata.tags : [];
    const currentTagIds = new Set(getMetadataTagIds(currentTags));
    const nextTags = [...currentTags];

    for (const tag of dedupePlannedTags(plans.flatMap((plan) => plan.tagsToAdd))) {
      if (currentTagIds.has(tag.definition.id)) {
        continue;
      }

      nextTags.push(toTagLink(tag.definition.id));
      currentTagIds.add(tag.definition.id);
    }

    contentfulEntry.metadata = {
      ...currentMetadata,
      tags: nextTags
    };
    await contentfulEntry.update();

    for (const plan of plans) {
      plan.action = 'updated-entry';
    }
  }
}

async function fetchEntriesById(
  context: ContentfulContext,
  entryIds: string[]
): Promise<Map<string, any>> {
  const entriesById = new Map<string, any>();

  for (const batch of chunk(entryIds, CONTENTFUL_BATCH_SIZE)) {
    const response = await context.environment.getEntries({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });

    for (const item of response?.items ?? []) {
      const id = item?.sys?.id;
      if (typeof id === 'string') {
        entriesById.set(id, item);
      }
    }
  }

  return entriesById;
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  entries: EntryRowPlan[],
  tags: TagCatalogItem[],
  issues: PlanIssue[]
): FormTagReport {
  return {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      contentType: commandConfig.contentType,
      entryIdColumn: commandConfig.entryIdColumn,
      inputPath: commandConfig.inputPath,
      selector: renderSelector(commandConfig),
      separator: commandConfig.separator,
      updateExistingName: commandConfig.updateExistingName,
      visibility: commandConfig.visibility
    },
    summary: summarize(entries, tags, issues),
    tags,
    entries,
    issues
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: FormTagReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `form-tags-${commandConfig.dryRun ? 'dry-run' : 'upload'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: FormTagReport): string {
  const lines: string[] = [];
  lines.push('# Form Tag Upload Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- CSV: ${report.input.inputPath}`);
  lines.push(`- Target content type: ${report.input.contentType}`);
  lines.push(`- Entry ID column: ${report.input.entryIdColumn}`);
  lines.push(`- Selection: ${report.input.selector ?? 'all rows'}`);
  lines.push(`- Tag name convention: Group${report.input.separator} Tag`);
  lines.push(`- Requested tag visibility for new tags: ${report.input.visibility}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| CSV rows | ${report.summary.rowCount} |`);
  lines.push(`| Rows with entry ID | ${report.summary.rowsWithEntryId} |`);
  lines.push(`| Rows missing entry ID | ${report.summary.missingEntryIdRows} |`);
  lines.push(`| Unique tags in CSV mapping | ${report.summary.uniqueTags} |`);
  lines.push(`| Tags that would be created | ${report.summary.wouldCreateTags} |`);
  lines.push(`| Tags created | ${report.summary.createdTags} |`);
  lines.push(`| Existing tags reused | ${report.summary.existingTags} |`);
  lines.push(`| Tag names that would be updated | ${report.summary.wouldUpdateTagNames} |`);
  lines.push(`| Tag names updated | ${report.summary.tagsToUpdateName} |`);
  lines.push(`| Tag name conflicts | ${report.summary.nameConflictTags} |`);
  lines.push(`| Entries that would be updated | ${report.summary.wouldUpdateEntries} |`);
  lines.push(`| Entries updated | ${report.summary.updatedEntries} |`);
  lines.push(`| Entries already complete | ${report.summary.noChangeEntries} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const issue of report.issues) {
      const context = [
        issue.rowNumber ? `row ${issue.rowNumber}` : undefined,
        issue.entryId ? `entry ${issue.entryId}` : undefined,
        issue.tagId ? `tag ${issue.tagId}` : undefined
      ].filter(Boolean).join(', ');
      lines.push(`- ${issue.severity.toUpperCase()}: ${context ? `${context}: ` : ''}${issue.message}`);
    }
    lines.push('');
  }

  lines.push('## Tags');
  lines.push('');
  lines.push('| Group | Tag value | Contentful name | Tag ID | Action | Source columns |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const tag of report.tags) {
    lines.push(
      [
        markdownTableCell(tag.definition.group),
        markdownTableCell(tag.definition.tag),
        markdownTableCell(tag.definition.name),
        markdownTableCell(tag.definition.id),
        markdownTableCell(tag.action),
        markdownTableCell(unique(tag.sources.map((source) => source.column)).join(', '))
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    );
  }
  lines.push('');

  lines.push('## Entry Details');
  lines.push('');
  for (const entry of report.entries) {
    lines.push(`### Row ${entry.rowNumber}${entry.entryId ? ` - ${entry.entryId}` : ''}`);
    lines.push('');
    lines.push(`- Action: ${entry.action}`);
    if (entry.contentType) {
      lines.push(`- Content type: ${entry.contentType}`);
    }
    if (entry.internalName) {
      lines.push(`- Contentful internal name: ${entry.internalName}`);
    }
    if (entry.formUrl) {
      lines.push(`- Form URL: ${entry.formUrl}`);
    }
    lines.push(`- Existing Contentful tag IDs: ${entry.existingTagIds.join(', ') || 'none'}`);
    lines.push('');
    lines.push('Tags from CSV mapping:');
    if (entry.tags.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.tags) {
        lines.push(renderEntryTagLine(tag));
      }
    }
    lines.push('');
    lines.push('Tags to add:');
    if (entry.tagsToAdd.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.tagsToAdd) {
        lines.push(renderEntryTagLine(tag));
      }
    }
    if (entry.tagsAlreadyPresent.length > 0) {
      lines.push('');
      lines.push('Tags already present:');
      for (const tag of entry.tagsAlreadyPresent) {
        lines.push(renderEntryTagLine(tag));
      }
    }
    if (entry.warnings.length > 0 || entry.errors.length > 0) {
      lines.push('');
      for (const warning of entry.warnings) {
        lines.push(`- Warning: ${warning}`);
      }
      for (const error of entry.errors) {
        lines.push(`- Error: ${error}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderEntryTagLine(tag: PlannedEntryTag): string {
  const sources = tag.sources
    .map((source) => `${source.column}="${source.rawValue}"`)
    .join('; ');
  return `- ${tag.definition.name} (${tag.definition.id}) from ${sources}`;
}

function summarize(
  entries: EntryRowPlan[],
  tags: TagCatalogItem[],
  issues: PlanIssue[]
): ReportSummary {
  return {
    createdTags: tags.filter((tag) => tag.action === 'created').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    existingTags: tags.filter((tag) => tag.action === 'existing').length,
    missingEntryIdRows: entries.filter((entry) => !entry.entryId).length,
    nameConflictTags: tags.filter((tag) => tag.action === 'name-conflict').length,
    noChangeEntries: entries.filter((entry) => entry.action === 'no-change').length,
    rowCount: entries.length,
    rowsWithEntryId: entries.filter((entry) => entry.entryId).length,
    tagsToCreate: tags.filter((tag) => tag.action === 'would-create' || tag.action === 'created').length,
    tagsToUpdateName: tags.filter((tag) => tag.action === 'updated-name').length,
    uniqueTags: tags.length,
    updatedEntries: entries.filter((entry) => entry.action === 'updated-entry').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    wouldCreateTags: tags.filter((tag) => tag.action === 'would-create').length,
    wouldUpdateEntries: entries.filter((entry) => entry.action === 'would-update-entry').length,
    wouldUpdateTagNames: tags.filter((tag) => tag.action === 'would-update-name').length
  };
}

function transformCellValue(
  rawValue: string,
  mapping: ColumnMapping,
  rowNumber: number,
  issues: PlanIssue[]
): string[] {
  const normalized = normalizeCellValue(rawValue);
  if (!normalized) {
    return [];
  }

  if (mapping.transform === 'solution') {
    const solution = SOLUTION_VALUE_MAP[normalized.toUpperCase()];
    if (!solution) {
      issues.push({
        severity: 'error',
        rowNumber,
        message: `Invalid Solution value "${normalized}". Expected one of: ${Object.keys(SOLUTION_VALUE_MAP).join(', ')}.`
      });
      return [];
    }

    return [solution];
  }

  if (mapping.transform === 'journey-stage') {
    const values = dedupeStrings(
      normalized
        .split('|')
        .map((value) => normalizeCellValue(value))
        .filter(Boolean)
    );

    for (const value of values) {
      if (!VALID_JOURNEY_STAGES.has(value)) {
        issues.push({
          severity: 'error',
          rowNumber,
          message:
            `Invalid Journey Stage value "${value}". Expected one of: ` +
            `${[...VALID_JOURNEY_STAGES].join(', ')}.`
        });
      }
    }

    return values.filter((value) => VALID_JOURNEY_STAGES.has(value));
  }

  return [normalized];
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

function ensureRowLength(row: string[], length: number): void {
  while (row.length < length) {
    row.push('');
  }
}

function optionalCellValue(row: string[], index: number): string | undefined {
  if (index < 0) {
    return undefined;
  }

  const value = normalizeCellValue(row[index] ?? '');
  return value || undefined;
}

function toPlainDefinition(definition: GroupedTagDefinition): PlainGroupedTagDefinition {
  return {
    group: String(definition.group),
    id: toContentfulResourceId(String(definition.id), 64),
    name: definition.name,
    tag: String(definition.tag),
    visibility: definition.visibility
  };
}

function getEntryContentType(entry: any): string | undefined {
  return typeof entry?.sys?.contentType?.sys?.id === 'string'
    ? entry.sys.contentType.sys.id
    : undefined;
}

function getEntryTagIds(entry: any): string[] {
  return getMetadataTagIds(entry?.metadata?.tags);
}

function getMetadataTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => tag?.sys?.id)
    .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim().length > 0);
}

function toTagLink(tagId: string): { sys: { type: 'Link'; linkType: 'Tag'; id: string } } {
  return {
    sys: {
      type: 'Link',
      linkType: 'Tag',
      id: tagId
    }
  };
}

function dedupePlannedTags(tags: PlannedEntryTag[]): PlannedEntryTag[] {
  const seen = new Set<string>();
  const deduped: PlannedEntryTag[] = [];

  for (const tag of tags) {
    if (seen.has(tag.definition.id)) {
      continue;
    }

    seen.add(tag.definition.id);
    deduped.push(tag);
  }

  return deduped;
}

function dedupeStrings(values: string[]): string[] {
  return unique(values);
}

function unique<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const deduped: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hasErrors(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function shouldIncludeRow(rowNumber: number, entryId: string, commandConfig: CommandConfig): boolean {
  if (commandConfig.rowNumber !== undefined) {
    return rowNumber === commandConfig.rowNumber;
  }

  if (commandConfig.selectedEntryId) {
    return entryId === commandConfig.selectedEntryId;
  }

  return true;
}

function renderSelector(commandConfig: CommandConfig): string | undefined {
  if (commandConfig.rowNumber !== undefined) {
    return `CSV row ${commandConfig.rowNumber}`;
  }

  if (commandConfig.selectedEntryId) {
    return `entry ${commandConfig.selectedEntryId}`;
  }

  return undefined;
}

function rewritePlannedTagId(entries: EntryRowPlan[], fromId: string, toId: string): void {
  for (const entry of entries) {
    for (const tag of entry.tags) {
      if (tag.definition.id === fromId) {
        tag.definition.id = toId;
      }
    }
  }
}

function countEntriesToUpdate(entries: EntryRowPlan[]): number {
  return new Set(
    entries
      .filter((entry) => entry.entryId && entry.errors.length === 0 && entry.tagsToAdd.length > 0)
      .map((entry) => entry.entryId)
  ).size;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function parsePositiveIntegerFlag(flags: CliFlags, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = flags[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`--${key} requires a positive integer value.`);
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`--${key} must be a positive integer.`);
    }

    return parsed;
  }

  return undefined;
}

function stringFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
