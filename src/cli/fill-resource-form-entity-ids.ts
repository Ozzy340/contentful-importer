import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { createContentfulContext, type ContentfulContext } from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import type { CliFlags, RuntimeEnv } from '../lib/types.js';

const DEFAULT_INPUT_PATH = path.join('source', 'search files', 'resource_form_urls.csv');
const DEFAULT_CONTENT_TYPES = ['resourcePage', 'contentPage'];
const DEFAULT_ENTITY_ID_COLUMN = 'Contentful Entity ID';
const DEFAULT_SLUG_COLUMNS = ['Slug in platform', 'Slug', 'Total Slug'];
const DEFAULT_PAGE_SIZE = 500;
const MAX_SAMPLE_WARNINGS = 10;

interface CommandConfig {
  contentTypes: string[];
  dryRun: boolean;
  entityIdColumn: string;
  environmentId: string;
  inputPath: string;
  locale: string;
  outputPath: string;
  overwrite: boolean;
  slugColumn?: string;
}

interface CsvTable {
  hasFinalLineEnding: boolean;
  lineEnding: string;
  rows: string[][];
}

interface SlugMatch {
  contentType: string;
  entryId: string;
  internalName: string;
  slug: string;
}

interface UpdateSummary {
  alreadyPopulatedRows: number;
  ambiguousRows: number;
  contentfulEntriesScanned: number;
  matchedRows: number;
  totalRows: number;
  unmatchedRows: number;
  updatedRows: number;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env, projectConfig.conventions.defaults.locale);
  const logger = new Logger(Boolean(flags.verbose), 'resource-form-ids');

  logger.info('Reading source CSV', {
    inputPath: commandConfig.inputPath,
    environmentId: commandConfig.environmentId,
    locale: commandConfig.locale,
    contentTypes: commandConfig.contentTypes
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

  const entityIdColumnIndex = ensureColumn(header, commandConfig.entityIdColumn);
  const slugColumnIndex = resolveSlugColumnIndex(header, commandConfig.slugColumn);

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });
  const index = await buildSlugMatchIndex(context, commandConfig, logger);
  const updateResult = updateRows(table, {
    commandConfig,
    entityIdColumnIndex,
    index,
    logger,
    slugColumnIndex
  });

  const renderedCsv = renderCsvTable(table);
  if (commandConfig.dryRun) {
    logger.info('Dry run complete; CSV was not written', { ...updateResult.summary });
  } else {
    await writeFile(commandConfig.outputPath, renderedCsv, 'utf8');
    logger.info('CSV updated', {
      outputPath: commandConfig.outputPath,
      ...updateResult.summary
    });
  }
}

function resolveCommandConfig(
  flags: CliFlags,
  env: RuntimeEnv,
  defaultLocale: string
): CommandConfig {
  const inputPath = path.resolve(stringFlag(flags, 'input') ?? stringFlag(flags, 'source') ?? DEFAULT_INPUT_PATH);
  const outputPath = path.resolve(stringFlag(flags, 'output') ?? stringFlag(flags, 'out') ?? inputPath);
  const environmentId =
    stringFlag(flags, 'env') ??
    stringFlag(flags, 'environment') ??
    env.CONTENTFUL_ENVIRONMENT_ID ??
    'master';
  const locale = stringFlag(flags, 'locale') ?? defaultLocale;
  const contentTypes = parseListFlag(flags, 'content-types') ?? DEFAULT_CONTENT_TYPES;
  const entityIdColumn = stringFlag(flags, 'entity-id-column') ?? DEFAULT_ENTITY_ID_COLUMN;
  const slugColumn = stringFlag(flags, 'slug-column');

  return {
    contentTypes,
    dryRun: Boolean(flags['dry-run']),
    entityIdColumn,
    environmentId,
    inputPath,
    locale,
    outputPath,
    overwrite: Boolean(flags.overwrite),
    slugColumn
  };
}

async function buildSlugMatchIndex(
  context: ContentfulContext,
  commandConfig: CommandConfig,
  logger: Logger
): Promise<{ entriesScanned: number; matchesBySlug: Map<string, SlugMatch[]> }> {
  const matchesBySlug = new Map<string, SlugMatch[]>();
  let entriesScanned = 0;

  for (const contentType of commandConfig.contentTypes) {
    const entries = await fetchEntries(context, contentType);
    entriesScanned += entries.length;
    logger.info('Scanned Contentful entries', {
      contentType,
      entries: entries.length
    });

    for (const entry of entries) {
      const entryId = stringValue(entry?.sys?.id);
      if (!entryId) {
        continue;
      }

      const slugValues = getLocalizedStringValues(entry, 'slug', commandConfig.locale);
      const seenSlugs = new Set<string>();

      for (const slug of slugValues) {
        const normalizedSlug = normalizeSlugForLookup(slug, commandConfig.locale);
        if (!normalizedSlug || seenSlugs.has(normalizedSlug)) {
          continue;
        }

        seenSlugs.add(normalizedSlug);
        const match: SlugMatch = {
          contentType,
          entryId,
          internalName: getFirstLocalizedStringValue(entry, 'internalName') ?? '',
          slug: normalizedSlug
        };
        const existing = matchesBySlug.get(normalizedSlug) ?? [];
        existing.push(match);
        matchesBySlug.set(normalizedSlug, existing);
      }
    }
  }

  return {
    entriesScanned,
    matchesBySlug
  };
}

async function fetchEntries(context: ContentfulContext, contentType: string): Promise<any[]> {
  const entries: any[] = [];
  let skip = 0;
  let total = 0;

  do {
    const response = await context.environment.getEntries({
      content_type: contentType,
      limit: DEFAULT_PAGE_SIZE,
      skip
    });
    const items = (response?.items ?? []) as any[];
    entries.push(...items);
    total = Number(response?.total ?? 0);
    skip += DEFAULT_PAGE_SIZE;
  } while (skip < total);

  return entries;
}

function updateRows(
  table: CsvTable,
  input: {
    commandConfig: CommandConfig;
    entityIdColumnIndex: number;
    index: { entriesScanned: number; matchesBySlug: Map<string, SlugMatch[]> };
    logger: Logger;
    slugColumnIndex: number;
  }
): { summary: UpdateSummary } {
  const summary: UpdateSummary = {
    alreadyPopulatedRows: 0,
    ambiguousRows: 0,
    contentfulEntriesScanned: input.index.entriesScanned,
    matchedRows: 0,
    totalRows: Math.max(0, table.rows.length - 1),
    unmatchedRows: 0,
    updatedRows: 0
  };
  let unmatchedWarnings = 0;
  let ambiguousWarnings = 0;

  for (const row of table.rows.slice(1)) {
    ensureRowLength(row, table.rows[0]?.length ?? 0);

    const rawSlug = row[input.slugColumnIndex] ?? '';
    const slug = normalizeSlugForLookup(rawSlug, input.commandConfig.locale);
    const currentEntityId = (row[input.entityIdColumnIndex] ?? '').trim();

    if (!slug) {
      summary.unmatchedRows += 1;
      continue;
    }

    const matches = input.index.matchesBySlug.get(slug) ?? [];
    const selectedMatch = selectMatch(matches, currentEntityId, input.commandConfig.contentTypes);

    if (!selectedMatch && matches.length > 1) {
      summary.ambiguousRows += 1;
      if (ambiguousWarnings < MAX_SAMPLE_WARNINGS) {
        input.logger.warn('Ambiguous slug match; leaving entity ID unchanged', {
          slug,
          matches: matches.map((match) => `${match.contentType}:${match.entryId}`)
        });
        ambiguousWarnings += 1;
      }
      continue;
    }

    if (!selectedMatch) {
      summary.unmatchedRows += 1;
      if (unmatchedWarnings < MAX_SAMPLE_WARNINGS) {
        input.logger.warn('No Contentful entry found for slug', { slug });
        unmatchedWarnings += 1;
      }
      continue;
    }

    summary.matchedRows += 1;
    if (currentEntityId && !input.commandConfig.overwrite) {
      summary.alreadyPopulatedRows += 1;
      continue;
    }

    if (currentEntityId === selectedMatch.entryId) {
      summary.alreadyPopulatedRows += 1;
      continue;
    }

    row[input.entityIdColumnIndex] = selectedMatch.entryId;
    summary.updatedRows += 1;
  }

  return { summary };
}

function selectMatch(
  matches: SlugMatch[],
  currentEntityId: string,
  contentTypePriority: string[]
): SlugMatch | undefined {
  const uniqueMatches = dedupeMatches(matches);
  if (uniqueMatches.length === 0) {
    return undefined;
  }

  if (currentEntityId) {
    const currentMatch = uniqueMatches.find((match) => match.entryId === currentEntityId);
    if (currentMatch) {
      return currentMatch;
    }
  }

  if (uniqueMatches.length === 1) {
    return uniqueMatches[0];
  }

  for (const contentType of contentTypePriority) {
    const matchesForType = uniqueMatches.filter((match) => match.contentType === contentType);
    if (matchesForType.length === 1) {
      return matchesForType[0];
    }
  }

  return undefined;
}

function dedupeMatches(matches: SlugMatch[]): SlugMatch[] {
  const seen = new Set<string>();
  const deduped: SlugMatch[] = [];

  for (const match of matches) {
    if (seen.has(match.entryId)) {
      continue;
    }
    seen.add(match.entryId);
    deduped.push(match);
  }

  return deduped;
}

function parseCsvTable(content: string): CsvTable {
  const rows: string[][] = [];
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const hasFinalLineEnding = content.endsWith('\n') || content.endsWith('\r');
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

  return { hasFinalLineEnding, lineEnding, rows };
}

function renderCsvTable(table: CsvTable): string {
  const content = table.rows.map((row) => row.map(escapeCsvValue).join(',')).join(table.lineEnding);
  return table.hasFinalLineEnding ? `${content}${table.lineEnding}` : content;
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function resolveSlugColumnIndex(header: string[], requestedColumn?: string): number {
  const columnName = requestedColumn ?? DEFAULT_SLUG_COLUMNS.find((name) => findColumnIndex(header, name) >= 0);

  if (!columnName) {
    throw new Error(
      `Unable to find a slug column. Expected one of: ${DEFAULT_SLUG_COLUMNS.join(', ')}.`
    );
  }

  const index = findColumnIndex(header, columnName);
  if (index < 0) {
    throw new Error(`Unable to find requested slug column: ${columnName}`);
  }

  return index;
}

function ensureColumn(header: string[], columnName: string): number {
  const existingIndex = findColumnIndex(header, columnName);
  if (existingIndex >= 0) {
    return existingIndex;
  }

  header.push(columnName);
  return header.length - 1;
}

function findColumnIndex(header: string[], columnName: string): number {
  const normalizedColumnName = normalizeColumnName(columnName);
  return header.findIndex((candidate) => normalizeColumnName(candidate) === normalizedColumnName);
}

function normalizeColumnName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ensureRowLength(row: string[], length: number): void {
  while (row.length < length) {
    row.push('');
  }
}

function getLocalizedStringValues(entry: any, fieldId: string, locale: string): string[] {
  const rawValue = entry?.fields?.[fieldId];
  if (typeof rawValue === 'string') {
    return [rawValue];
  }

  if (!isLocalizedFieldMap(rawValue)) {
    return [];
  }

  const localeValue = rawValue[locale];
  if (typeof localeValue === 'string') {
    return [localeValue];
  }

  return Object.values(rawValue).filter((value): value is string => typeof value === 'string');
}

function getFirstLocalizedStringValue(entry: any, fieldId: string): string | undefined {
  const rawValue = entry?.fields?.[fieldId];
  if (typeof rawValue === 'string') {
    return rawValue.trim() || undefined;
  }

  if (!isLocalizedFieldMap(rawValue)) {
    return undefined;
  }

  return Object.values(rawValue)
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim();
}

function isLocalizedFieldMap(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'sys')
  );
}

function normalizeSlugForLookup(value: string, locale: string): string {
  const withoutOrigin = value.trim().replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split(/[?#]/, 1)[0] ?? '';
  const segments = withoutQuery.split('/').filter(Boolean);
  const localeSegment = locale.toLowerCase().replace('_', '-');

  if (segments[0]?.toLowerCase() === localeSegment) {
    segments.shift();
  }

  return segments.join('/').trim();
}

function parseListFlag(flags: CliFlags, key: string): string[] | undefined {
  const value = stringFlag(flags, key);
  if (!value) {
    return undefined;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function stringFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
