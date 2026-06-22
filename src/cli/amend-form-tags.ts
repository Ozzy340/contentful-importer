import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  createTag,
  getTags
} from '../lib/contentful-client.js';
import type { ContentfulContext, ContentfulTagResource } from '../lib/contentful-client.js';
import { toContentfulResourceId } from '../lib/ids.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { buildGroupedTagDefinition } from '../lib/tag-service.js';
import type { GroupedTagDefinition } from '../lib/tag-service.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'tag documents', 'Form_Tag_Data_output_only.csv');
const ENTRY_ID_COLUMN = 'entryId';
const ENTITY_TYPE_COLUMN = 'entityType';
const CONTENTFUL_URL_COLUMN = 'contentfulUrl';
const SLUG_COLUMN = 'slug';
const FORM_ENTITY_NAMES_COLUMN = 'formEntityNames';
const EXCLUDED_TAG_GROUPS = new Set(['Form Type']);
const CONTENTFUL_BATCH_SIZE = 100;

type RowAction =
  | 'skipped-missing-entry-id'
  | 'missing-entry'
  | 'wrong-content-type'
  | 'no-change'
  | 'would-update-entry'
  | 'updated-entry';

type TagAction =
  | 'existing'
  | 'would-create'
  | 'created'
  | 'missing-tag'
  | 'id-conflict';

type GroupChangeAction = 'add' | 'remove' | 'replace';

interface CommandConfig {
  allowNonSandbox: boolean;
  createMissingTags: boolean;
  dryRun: boolean;
  environmentId: string;
  inputPath: string;
  rowNumber?: number;
  selectedEntryId?: string;
  separator: string;
}

interface CsvTable {
  rows: string[][];
}

interface ColumnIndices {
  contentfulUrl: number;
  entryId: number;
  entityType: number;
  formEntityNames: number;
  slug: number;
  tagColumns: TagColumn[];
}

interface TagColumn {
  group: string;
  index: number;
}

interface PlanIssue {
  severity: 'error' | 'warning';
  message: string;
  csvRowNumber?: number;
  entryId?: string;
  tagId?: string;
}

interface TagValueSource {
  column: string;
  csvRowNumber: number;
  rawValue: string;
}

interface PlainGroupedTagDefinition {
  group: string;
  id: string;
  name: string;
  tag: string;
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

interface ExistingManagedTag {
  group: string;
  id: string;
  name: string;
  tag: string;
}

interface GroupChange {
  action: GroupChangeAction;
  after: string[];
  before: string[];
  group: string;
}

interface EntryRowPlan {
  action: RowAction;
  contentfulUrl?: string;
  csvRowNumber: number;
  dataRowNumber: number;
  desiredTags: PlannedTag[];
  entityType?: string;
  entryId?: string;
  errors: string[];
  existingContentType?: string;
  existingManagedTags: ExistingManagedTag[];
  existingTagIds: string[];
  formEntityNames?: string;
  groupChanges: GroupChange[];
  slug?: string;
  tagsAlreadyPresent: PlannedTag[];
  tagsToAdd: PlannedTag[];
  tagsToRemove: ExistingManagedTag[];
  warnings: string[];
}

interface FormTagAmendmentReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  spaceId?: string;
  environmentId: string;
  input: {
    createMissingTags: boolean;
    excludedTagGroups: string[];
    inputPath: string;
    managedTagGroups: string[];
    selector?: string;
    separator: string;
  };
  summary: ReportSummary;
  tags: TagCatalogItem[];
  entries: EntryRowPlan[];
  issues: PlanIssue[];
}

interface ReportSummary {
  changedGroups: number;
  createdTags: number;
  entriesAlreadyCorrect: number;
  entriesUpdated: number;
  entriesWouldUpdate: number;
  errors: number;
  existingTags: number;
  idConflictTags: number;
  missingEntries: number;
  missingEntryIdRows: number;
  missingTags: number;
  rowsSelected: number;
  tagAdds: number;
  tagRemovals: number;
  tagsWouldCreate: number;
  uniqueDesiredTags: number;
  warnings: number;
  wrongContentTypeRows: number;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'amend-form-tags');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(
    flags,
    projectConfig.env,
    projectConfig.conventions.tags.namespaceSeparator
  );

  logger.info(commandConfig.dryRun ? 'Preparing form tag amendment dry run' : 'Preparing form tag amendment apply run', {
    createMissingTags: commandConfig.createMissingTags,
    environmentId: commandConfig.environmentId,
    inputPath: commandConfig.inputPath,
    selector: renderSelector(commandConfig)
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
  const { entries, issues, tagCatalog } = buildPlan(table, columns, commandConfig);

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

  logger.info('Checking Contentful tags and page entries', {
    managedTagGroups: columns.tagColumns.map((column) => column.group),
    plannedEntries: entries.filter((entry) => entry.entryId).length,
    uniqueDesiredTags: tagCatalog.length
  });

  const existingTags = await inspectTags(context, tagCatalog, entries, commandConfig, issues);
  const entriesById = await inspectEntries(context, entries, columns, existingTags, issues);

  if (hasErrors(issues)) {
    const report = buildReport(projectConfig, commandConfig, columns, entries, tagCatalog, issues);
    const reportPaths = await writeReports(projectConfig, commandConfig, report);
    logger.error('Form tag amendment has blocking errors; no Contentful writes were made', {
      errors: report.summary.errors,
      markdownReport: reportPaths.markdownPath
    });
    process.exitCode = 1;
    return;
  }

  if (!commandConfig.dryRun) {
    logger.info('Creating missing tags before entry amendments', {
      tagsToCreate: tagCatalog.filter((tag) => tag.action === 'would-create').length
    });
    await applyTagChanges(context, tagCatalog);

    logger.info('Applying entry tag amendments', {
      entriesToUpdate: entries.filter((entry) => entry.action === 'would-update-entry').length
    });
    await applyEntryChanges(entries, entriesById);
  }

  const report = buildReport(projectConfig, commandConfig, columns, entries, tagCatalog, issues);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  for (const issue of issues.filter((item) => item.severity === 'warning')) {
    logger.warn(issue.message, {
      csvRowNumber: issue.csvRowNumber,
      entryId: issue.entryId,
      tagId: issue.tagId
    });
  }

  logger.info(commandConfig.dryRun ? 'Form tag amendment dry run finished' : 'Form tag amendment apply run finished', {
    jsonReport: reportPaths.jsonPath,
    markdownReport: reportPaths.markdownPath,
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

  const rowNumber = parsePositiveIntegerFlag(flags, ['row', 'csv-row']);
  const selectedEntryId = stringFlag(flags, 'entry-id');
  if (rowNumber !== undefined && selectedEntryId) {
    throw new Error('Use either --row <csv-row-number> or --entry-id <entry-id>, not both.');
  }
  if (rowNumber !== undefined && rowNumber < 2) {
    throw new Error('CSV row numbers include the header row, so --row must be 2 or greater.');
  }

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    createMissingTags: !flags['no-create-tags'],
    dryRun: !flags.yes,
    environmentId,
    inputPath: path.resolve(stringFlag(flags, 'input') ?? stringFlag(flags, 'source') ?? DEFAULT_INPUT_PATH),
    rowNumber,
    selectedEntryId,
    separator: stringFlag(flags, 'separator') ?? defaultSeparator
  };
}

function resolveColumnIndices(header: string[]): ColumnIndices {
  const formEntityNames = requireColumn(header, FORM_ENTITY_NAMES_COLUMN);
  const tagColumns = header
    .map((column, index) => ({ group: normalizeCellValue(column), index }))
    .filter((column) => column.index > formEntityNames)
    .filter((column) => column.group && !EXCLUDED_TAG_GROUPS.has(column.group));

  if (tagColumns.length === 0) {
    throw new Error(`No tag group columns were found after ${FORM_ENTITY_NAMES_COLUMN}.`);
  }

  return {
    contentfulUrl: findColumnIndex(header, CONTENTFUL_URL_COLUMN),
    entryId: requireColumn(header, ENTRY_ID_COLUMN),
    entityType: findColumnIndex(header, ENTITY_TYPE_COLUMN),
    formEntityNames,
    slug: findColumnIndex(header, SLUG_COLUMN),
    tagColumns
  };
}

function buildPlan(
  table: CsvTable,
  columns: ColumnIndices,
  commandConfig: CommandConfig
): { entries: EntryRowPlan[]; issues: PlanIssue[]; tagCatalog: TagCatalogItem[] } {
  const issues: PlanIssue[] = [];
  const tagDefinitions = new Map<string, PlannedTag>();
  const sourceDefinitionById = new Map<string, PlainGroupedTagDefinition>();
  const entries: EntryRowPlan[] = [];

  for (let rowIndex = 1; rowIndex < table.rows.length; rowIndex += 1) {
    const row = table.rows[rowIndex];
    if (!row || row.every((value) => normalizeCellValue(value) === '')) {
      continue;
    }

    ensureRowLength(row, maxColumnIndex(columns) + 1);
    const csvRowNumber = rowIndex + 1;
    const dataRowNumber = rowIndex;
    const entryId = normalizeCellValue(row[columns.entryId] ?? '');
    if (!shouldIncludeRow(csvRowNumber, entryId, commandConfig)) {
      continue;
    }

    const entryTagsById = new Map<string, PlannedTag>();
    const rowIssues: PlanIssue[] = [];

    for (const column of columns.tagColumns) {
      const rawValue = row[column.index] ?? '';
      const values = parseTagCellValues(rawValue);

      for (const value of values) {
        const definition = toPlainDefinition(
          buildGroupedTagDefinition({
            group: column.group,
            tag: value,
            separator: commandConfig.separator,
            visibility: 'public'
          })
        );
        const source: TagValueSource = {
          column: column.group,
          csvRowNumber,
          rawValue: normalizeCellValue(rawValue)
        };
        const existingSourceDefinition = sourceDefinitionById.get(definition.id);

        if (existingSourceDefinition && existingSourceDefinition.name !== definition.name) {
          rowIssues.push({
            severity: 'error',
            csvRowNumber,
            tagId: definition.id,
            message:
              `Generated tag ID ${definition.id} maps to both "${existingSourceDefinition.name}" ` +
              `and "${definition.name}". Adjust the CSV value to avoid a Contentful tag ID collision.`
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
      const message = `CSV row ${csvRowNumber} has no ${ENTRY_ID_COLUMN}; skipping.`;
      issues.push({ severity: 'warning', csvRowNumber, message });
      warnings.push(message);
    }

    entries.push({
      action: entryId ? 'no-change' : 'skipped-missing-entry-id',
      contentfulUrl: optionalCellValue(row, columns.contentfulUrl),
      csvRowNumber,
      dataRowNumber,
      desiredTags: [...entryTagsById.values()],
      entityType: optionalCellValue(row, columns.entityType),
      entryId: entryId || undefined,
      errors,
      existingManagedTags: [],
      existingTagIds: [],
      formEntityNames: optionalCellValue(row, columns.formEntityNames),
      groupChanges: [],
      slug: optionalCellValue(row, columns.slug),
      tagsAlreadyPresent: [],
      tagsToAdd: [],
      tagsToRemove: [],
      warnings
    });
  }

  addDuplicateEntryIssues(entries, issues);

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

  return { entries, issues, tagCatalog };
}

async function inspectTags(
  context: ContentfulContext,
  tagCatalog: TagCatalogItem[],
  entries: EntryRowPlan[],
  commandConfig: CommandConfig,
  issues: PlanIssue[]
): Promise<Map<string, ContentfulTagResource>> {
  const existingTagList = await getTags(context);
  const existingTagsById = new Map(existingTagList.map((tag) => [tag.id, tag]));
  const existingTagsByName = new Map(existingTagList.map((tag) => [tag.name, tag]));

  for (const tag of tagCatalog) {
    const generatedId = tag.definition.id;
    const existingByName = existingTagsByName.get(tag.definition.name);
    if (existingByName) {
      tag.existing = existingByName;
      tag.action = 'existing';
      if (existingByName.id !== generatedId) {
        rewritePlannedTagId(entries, generatedId, existingByName.id);
        tag.definition.id = existingByName.id;
        const message =
          `Existing tag name "${tag.definition.name}" uses ID ${existingByName.id}; ` +
          `using that instead of generated ID ${generatedId}.`;
        tag.warnings.push(message);
        issues.push({
          severity: 'warning',
          tagId: existingByName.id,
          message
        });
      }
      if (existingByName.visibility && existingByName.visibility !== 'public') {
        const message = `Existing tag ${existingByName.id} is ${existingByName.visibility}; it will be reused unchanged.`;
        tag.warnings.push(message);
        issues.push({
          severity: 'warning',
          tagId: existingByName.id,
          message
        });
      }
      continue;
    }

    const existingById = existingTagsById.get(generatedId);
    if (existingById) {
      tag.existing = existingById;
      tag.action = 'id-conflict';
      const message =
        `Generated tag ID ${generatedId} already exists as "${existingById.name}", ` +
        `but this run needs "${tag.definition.name}".`;
      tag.warnings.push(message);
      issues.push({
        severity: 'error',
        tagId: generatedId,
        message
      });
      continue;
    }

    if (!commandConfig.createMissingTags) {
      tag.action = 'missing-tag';
      const message =
        `Tag "${tag.definition.name}" does not exist in Contentful and --no-create-tags was supplied.`;
      issues.push({
        severity: 'error',
        tagId: tag.definition.id,
        message
      });
    }
  }

  return existingTagsById;
}

async function inspectEntries(
  context: ContentfulContext,
  entries: EntryRowPlan[],
  columns: ColumnIndices,
  existingTagsById: Map<string, ContentfulTagResource>,
  issues: PlanIssue[]
): Promise<Map<string, any>> {
  const entryIds = [...new Set(entries.map((entry) => entry.entryId).filter(isPresent))];
  const entriesById = await fetchEntriesById(context, entryIds);
  const managedGroups = columns.tagColumns.map((column) => column.group);

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
        csvRowNumber: entry.csvRowNumber,
        entryId: entry.entryId,
        message
      });
      continue;
    }

    entry.existingContentType = getEntryContentType(contentfulEntry);
    if (entry.entityType && entry.existingContentType !== entry.entityType) {
      entry.action = 'wrong-content-type';
      const message =
        `Entry ${entry.entryId} is content type ${entry.existingContentType ?? 'unknown'}, ` +
        `not CSV entityType ${entry.entityType}.`;
      entry.errors.push(message);
      issues.push({
        severity: 'error',
        csvRowNumber: entry.csvRowNumber,
        entryId: entry.entryId,
        message
      });
      continue;
    }

    entry.existingTagIds = getEntryTagIds(contentfulEntry);
    entry.existingManagedTags = entry.existingTagIds
      .map((tagId) => toExistingManagedTag(existingTagsById.get(tagId), managedGroups))
      .filter(isPresent);

    const existingTagIds = new Set(entry.existingTagIds);
    const desiredTagIds = new Set(entry.desiredTags.map((tag) => tag.definition.id));
    entry.tagsAlreadyPresent = entry.desiredTags.filter((tag) => existingTagIds.has(tag.definition.id));
    entry.tagsToAdd = entry.desiredTags.filter((tag) => !existingTagIds.has(tag.definition.id));
    entry.tagsToRemove = entry.existingManagedTags.filter((tag) => !desiredTagIds.has(tag.id));
    entry.groupChanges = buildGroupChanges(managedGroups, entry.existingManagedTags, entry.desiredTags);

    entry.action = entry.tagsToAdd.length > 0 || entry.tagsToRemove.length > 0
      ? 'would-update-entry'
      : 'no-change';
  }

  return entriesById;
}

async function applyTagChanges(
  context: ContentfulContext,
  tagCatalog: TagCatalogItem[]
): Promise<void> {
  for (const tag of tagCatalog) {
    if (tag.action !== 'would-create') {
      continue;
    }

    const result = await createTag(context, tag.definition.id, tag.definition.name, 'public');
    tag.action = result === 'created' ? 'created' : 'existing';
  }
}

async function applyEntryChanges(
  entries: EntryRowPlan[],
  entriesById: Map<string, any>
): Promise<void> {
  for (const entry of entries) {
    if (!entry.entryId || entry.action !== 'would-update-entry') {
      continue;
    }

    const contentfulEntry = entriesById.get(entry.entryId);
    if (!contentfulEntry) {
      continue;
    }

    const removeTagIds = new Set(entry.tagsToRemove.map((tag) => tag.id));
    const addTagIds = entry.tagsToAdd.map((tag) => tag.definition.id);
    const currentMetadata = isRecord(contentfulEntry.metadata) ? contentfulEntry.metadata : {};
    const currentTags: unknown[] = Array.isArray(currentMetadata.tags) ? currentMetadata.tags : [];
    const nextTags = currentTags.filter((tag) => {
      const tagId = getMetadataTagId(tag);
      return !tagId || !removeTagIds.has(tagId);
    });
    const nextTagIds = new Set(getMetadataTagIds(nextTags));

    for (const tagId of addTagIds) {
      if (nextTagIds.has(tagId)) {
        continue;
      }

      nextTags.push(toTagLink(tagId));
      nextTagIds.add(tagId);
    }

    contentfulEntry.metadata = {
      ...currentMetadata,
      tags: nextTags
    };
    await contentfulEntry.update();
    entry.action = 'updated-entry';
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
  columns: ColumnIndices,
  entries: EntryRowPlan[],
  tags: TagCatalogItem[],
  issues: PlanIssue[]
): FormTagAmendmentReport {
  return {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      createMissingTags: commandConfig.createMissingTags,
      excludedTagGroups: [...EXCLUDED_TAG_GROUPS],
      inputPath: commandConfig.inputPath,
      managedTagGroups: columns.tagColumns.map((column) => column.group),
      selector: renderSelector(commandConfig),
      separator: commandConfig.separator
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
  report: FormTagAmendmentReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `form-tags-amendment-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${commandConfig.environmentId}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: FormTagAmendmentReport): string {
  const lines: string[] = [];
  lines.push('# Form Tag Amendment Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- CSV: ${report.input.inputPath}`);
  lines.push(`- Selection: ${report.input.selector ?? 'all rows'}`);
  lines.push(`- Tag name convention: Group${report.input.separator} Tag`);
  lines.push(`- Create missing tags: ${report.input.createMissingTags ? 'yes' : 'no'}`);
  lines.push(`- Managed tag groups: ${report.input.managedTagGroups.join(', ')}`);
  lines.push(`- Excluded tag groups: ${report.input.excludedTagGroups.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Rows selected | ${report.summary.rowsSelected} |`);
  lines.push(`| Rows missing entry ID | ${report.summary.missingEntryIdRows} |`);
  lines.push(`| Missing entries | ${report.summary.missingEntries} |`);
  lines.push(`| Wrong content type rows | ${report.summary.wrongContentTypeRows} |`);
  lines.push(`| Unique desired tags | ${report.summary.uniqueDesiredTags} |`);
  lines.push(`| Existing tags reused | ${report.summary.existingTags} |`);
  lines.push(`| Tags that would be created | ${report.summary.tagsWouldCreate} |`);
  lines.push(`| Tags created | ${report.summary.createdTags} |`);
  lines.push(`| Missing tags blocked | ${report.summary.missingTags} |`);
  lines.push(`| Tag ID conflicts | ${report.summary.idConflictTags} |`);
  lines.push(`| Entries already correct | ${report.summary.entriesAlreadyCorrect} |`);
  lines.push(`| Entries that would be updated | ${report.summary.entriesWouldUpdate} |`);
  lines.push(`| Entries updated | ${report.summary.entriesUpdated} |`);
  lines.push(`| Tag additions | ${report.summary.tagAdds} |`);
  lines.push(`| Tag removals | ${report.summary.tagRemovals} |`);
  lines.push(`| Changed groups | ${report.summary.changedGroups} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const issue of report.issues) {
      const context = [
        issue.csvRowNumber ? `CSV row ${issue.csvRowNumber}` : undefined,
        issue.entryId ? `entry ${issue.entryId}` : undefined,
        issue.tagId ? `tag ${issue.tagId}` : undefined
      ].filter(Boolean).join(', ');
      lines.push(`- ${issue.severity.toUpperCase()}: ${context ? `${context}: ` : ''}${issue.message}`);
    }
    lines.push('');
  }

  lines.push('## Desired Tag Catalog');
  lines.push('');
  lines.push('| Group | Tag value | Contentful name | Tag ID | Action | Source rows |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const tag of report.tags) {
    lines.push(
      [
        markdownTableCell(tag.definition.group),
        markdownTableCell(tag.definition.tag),
        markdownTableCell(tag.definition.name),
        markdownTableCell(tag.definition.id),
        markdownTableCell(tag.action),
        markdownTableCell(unique(tag.sources.map((source) => String(source.csvRowNumber))).join(', '))
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    );
  }
  lines.push('');

  lines.push('## Entry Details');
  lines.push('');
  for (const entry of report.entries) {
    lines.push(`### CSV Row ${entry.csvRowNumber}${entry.entryId ? ` - ${entry.entryId}` : ''}`);
    lines.push('');
    lines.push(`- Action: ${entry.action}`);
    if (entry.entityType) {
      lines.push(`- CSV entityType: ${entry.entityType}`);
    }
    if (entry.existingContentType) {
      lines.push(`- Contentful content type: ${entry.existingContentType}`);
    }
    if (entry.slug) {
      lines.push(`- Slug: ${entry.slug}`);
    }
    if (entry.formEntityNames) {
      lines.push(`- Form entity names: ${entry.formEntityNames}`);
    }
    if (entry.contentfulUrl) {
      lines.push(`- Contentful URL: ${entry.contentfulUrl}`);
    }
    lines.push(`- Existing Contentful tag IDs: ${entry.existingTagIds.join(', ') || 'none'}`);
    lines.push('');
    lines.push('Existing managed tags:');
    if (entry.existingManagedTags.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.existingManagedTags) {
        lines.push(`- ${tag.name} (${tag.id})`);
      }
    }
    lines.push('');
    lines.push('Desired tags from CSV:');
    if (entry.desiredTags.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.desiredTags) {
        lines.push(renderPlannedTagLine(tag));
      }
    }
    lines.push('');
    lines.push('Group changes:');
    if (entry.groupChanges.length === 0) {
      lines.push('- none');
    } else {
      for (const change of entry.groupChanges) {
        lines.push(
          `- ${change.group}: ${change.before.join(', ') || 'none'} -> ` +
          `${change.after.join(', ') || 'none'} (${change.action})`
        );
      }
    }
    lines.push('');
    lines.push('Tags to add:');
    if (entry.tagsToAdd.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.tagsToAdd) {
        lines.push(renderPlannedTagLine(tag));
      }
    }
    lines.push('');
    lines.push('Tags to remove:');
    if (entry.tagsToRemove.length === 0) {
      lines.push('- none');
    } else {
      for (const tag of entry.tagsToRemove) {
        lines.push(`- ${tag.name} (${tag.id})`);
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

  if (report.mode === 'dry-run') {
    lines.push('No Contentful writes were made. Re-run with `--yes` after reviewing this report.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderPlannedTagLine(tag: PlannedTag): string {
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
    changedGroups: entries.reduce((total, entry) => total + entry.groupChanges.length, 0),
    createdTags: tags.filter((tag) => tag.action === 'created').length,
    entriesAlreadyCorrect: entries.filter((entry) => entry.action === 'no-change').length,
    entriesUpdated: entries.filter((entry) => entry.action === 'updated-entry').length,
    entriesWouldUpdate: entries.filter((entry) => entry.action === 'would-update-entry').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    existingTags: tags.filter((tag) => tag.action === 'existing').length,
    idConflictTags: tags.filter((tag) => tag.action === 'id-conflict').length,
    missingEntries: entries.filter((entry) => entry.action === 'missing-entry').length,
    missingEntryIdRows: entries.filter((entry) => !entry.entryId).length,
    missingTags: tags.filter((tag) => tag.action === 'missing-tag').length,
    rowsSelected: entries.length,
    tagAdds: entries.reduce((total, entry) => total + entry.tagsToAdd.length, 0),
    tagRemovals: entries.reduce((total, entry) => total + entry.tagsToRemove.length, 0),
    tagsWouldCreate: tags.filter((tag) => tag.action === 'would-create').length,
    uniqueDesiredTags: tags.length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    wrongContentTypeRows: entries.filter((entry) => entry.action === 'wrong-content-type').length
  };
}

function buildGroupChanges(
  managedGroups: string[],
  existingManagedTags: ExistingManagedTag[],
  desiredTags: PlannedTag[]
): GroupChange[] {
  const changes: GroupChange[] = [];

  for (const group of managedGroups) {
    const before = unique(
      existingManagedTags
        .filter((tag) => tag.group === group)
        .map((tag) => tag.tag)
    ).sort((left, right) => left.localeCompare(right));
    const after = unique(
      desiredTags
        .filter((tag) => tag.definition.group === group)
        .map((tag) => tag.definition.tag)
    ).sort((left, right) => left.localeCompare(right));

    if (stringArraysEqual(before, after)) {
      continue;
    }

    changes.push({
      action: before.length === 0 ? 'add' : after.length === 0 ? 'remove' : 'replace',
      after,
      before,
      group
    });
  }

  return changes;
}

function toExistingManagedTag(
  tag: ContentfulTagResource | undefined,
  managedGroups: string[]
): ExistingManagedTag | undefined {
  if (!tag) {
    return undefined;
  }

  for (const group of managedGroups) {
    const prefix = `${group}:`;
    if (!tag.name.startsWith(prefix)) {
      continue;
    }

    return {
      group,
      id: tag.id,
      name: tag.name,
      tag: tag.name.slice(prefix.length).trim()
    };
  }

  return undefined;
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

function parseTagCellValues(value: string): string[] {
  const normalized = normalizeCellValue(value);
  if (!normalized) {
    return [];
  }

  return unique(
    normalized
      .split('|')
      .map((item) => normalizeCellValue(item))
      .filter(Boolean)
  );
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
    tag: String(definition.tag)
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
    .map(getMetadataTagId)
    .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim().length > 0);
}

function getMetadataTagId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sys = value.sys;
  if (!isRecord(sys) || typeof sys.id !== 'string') {
    return undefined;
  }

  return sys.id;
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

function addDuplicateEntryIssues(entries: EntryRowPlan[], issues: PlanIssue[]): void {
  const firstRowByEntryId = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.entryId) {
      continue;
    }

    const firstRow = firstRowByEntryId.get(entry.entryId);
    if (firstRow !== undefined) {
      const message =
        `Entry ${entry.entryId} appears in both CSV row ${firstRow} and CSV row ${entry.csvRowNumber}; ` +
        'the amendment script requires one desired tag state per entry.';
      entry.errors.push(message);
      issues.push({
        severity: 'error',
        csvRowNumber: entry.csvRowNumber,
        entryId: entry.entryId,
        message
      });
      continue;
    }

    firstRowByEntryId.set(entry.entryId, entry.csvRowNumber);
  }
}

function rewritePlannedTagId(entries: EntryRowPlan[], fromId: string, toId: string): void {
  for (const entry of entries) {
    for (const tag of entry.desiredTags) {
      if (tag.definition.id === fromId) {
        tag.definition.id = toId;
      }
    }
  }
}

function maxColumnIndex(columns: ColumnIndices): number {
  return Math.max(
    columns.contentfulUrl,
    columns.entryId,
    columns.entityType,
    columns.formEntityNames,
    columns.slug,
    ...columns.tagColumns.map((column) => column.index)
  );
}

function shouldIncludeRow(csvRowNumber: number, entryId: string, commandConfig: CommandConfig): boolean {
  if (commandConfig.rowNumber !== undefined) {
    return csvRowNumber === commandConfig.rowNumber;
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

function hasErrors(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
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

function stringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => right[index] === value);
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
