import { getTags, type ContentfulContext } from './contentful-client.js';

export interface ContentfulSearchExportOptions {
  locale?: string;
  pageSize?: number;
}

export interface ContentfulSearchExportSummary {
  scannedEntries: number;
  matchedEntries: number;
}

export interface ContentfulSearchExportResult {
  columns: string[];
  rows: ContentfulSearchExportRow[];
  summary: ContentfulSearchExportSummary;
}

export interface ContentfulSearchDefinition {
  id: string;
  title: string;
  description: string;
  columns: string[];
  run: (
    context: ContentfulContext,
    options: ContentfulSearchExportOptions
  ) => Promise<ContentfulSearchExportResult>;
}

export type ContentfulSearchExportRow = Record<string, string>;

interface LocalizedFieldValue {
  locale?: string;
  value: unknown;
}

interface ContentTypeReferenceField {
  fieldId: string;
  allowedContentTypes: Set<string>;
}

interface ContentTypeReferenceIndex {
  displayFields: Map<string, string | undefined>;
  traversableFields: Map<string, Set<string>>;
}

interface FormPlacement {
  entryId: string;
  name: string;
}

interface ReverseReferenceIndex {
  entriesById: Map<string, any>;
  contentTypeByEntryId: Map<string, string>;
  parentIdsByChildId: Map<string, Set<string>>;
}

interface LinkFieldDefinition {
  contentTypeId: string;
  contentTypeName: string;
  fieldId: string;
  fieldName: string;
  kind: 'rich-text' | 'string';
}

interface EnLinkMatch {
  entry: any;
  field: LinkFieldDefinition;
  link: string;
}

const CORE_PAGE_CONTENT_TYPE_IDS = [
  'contentPage',
  'resourcePage',
  'homePage',
  'listingPage',
  'searchPage'
];

const FORM_ENTITY_CONTENT_TYPE_IDS = ['form'];
const RICH_TEXT_BLOCK_CONTENT_TYPE_ID = 'richTextBlock';
const RICH_TEXT_BLOCK_CONTENT_TYPE_IDS = [RICH_TEXT_BLOCK_CONTENT_TYPE_ID];
const RICH_TEXT_BLOCK_FIELD_ID = 'content';
const EXCLUDED_LINK_FIELD_CONTENT_TYPE_IDS = new Set([
  'embedBlock',
  'formField',
  'languageOption',
  'socialItem'
]);
const STRING_LINK_FIELD_IDS_BY_CONTENT_TYPE = new Map<string, Set<string>>([
  ['ctaItem', new Set(['externalUrl', 'fallbackUrl'])],
  ['videoItem', new Set(['embeddedVideo'])]
]);

const RESOURCE_PAGES_WITH_FORM_ID_COLUMNS = [
  'entryId',
  'entityType',
  'internalName',
  'slug',
  'formId',
  'formIdLocales'
];

const RESOURCE_PAGES_WITH_FORM_ID: ContentfulSearchDefinition = {
  id: 'resource-pages-with-form-id',
  title: 'Resource pages with Form ID',
  description: 'Finds resourcePage entries where formId is populated.',
  columns: RESOURCE_PAGES_WITH_FORM_ID_COLUMNS,
  run: runResourcePagesWithFormIdSearch
};

const CORE_PAGES_WITH_FORMS_BASE_COLUMNS = [
  'entryId',
  'entityType',
  'contentfulUrl',
  'slug',
  'formEntityNames'
];

const CORE_PAGES_WITH_FORMS: ContentfulSearchDefinition = {
  id: 'core-pages-with-forms',
  title: 'Core pages with forms',
  description:
    'Finds contentPage, resourcePage, homePage, listingPage, and searchPage entries with child component relationships that ultimately link to form entries.',
  columns: CORE_PAGES_WITH_FORMS_BASE_COLUMNS,
  run: runCorePagesWithFormsSearch
};

const RICH_TEXT_BLOCKS_WITH_EN_LINKS_COLUMNS = [
  'Rich Text Entity ID',
  'Rich Text Contentful Link',
  'Rich Text Entity Name',
  'Parent Page Entity ID',
  'Parent Page Type',
  'Parent Page Contentful Link',
  'Parent Page Name',
  'Parent page slug',
  'full /en/ link'
];

const RICH_TEXT_BLOCKS_WITH_EN_LINKS: ContentfulSearchDefinition = {
  id: 'rich-text-blocks-with-en-links',
  title: 'Rich text blocks with /en/ links',
  description:
    'Finds richTextBlock entries whose rich text content contains hyperlinks with /en/ paths, then reports the core parent pages that reference them.',
  columns: RICH_TEXT_BLOCKS_WITH_EN_LINKS_COLUMNS,
  run: runRichTextBlocksWithEnLinksSearch
};

const LINK_FIELDS_WITH_EN_LINKS_COLUMNS = [
  'Entity ID',
  'Entity Contentful Link',
  'Entity Name',
  'Content Type',
  'Field',
  'Parent Page Entity ID',
  'Parent Page Type',
  'Parent Page Contentful Link',
  'Parent Page Name',
  'Parent page slug',
  'full /en/ link'
];

const LINK_FIELDS_WITH_EN_LINKS: ContentfulSearchDefinition = {
  id: 'link-fields-with-en-links',
  title: 'Link fields with /en/ links',
  description:
    'Finds supported rich text hyperlink fields and external URL fields containing /en/ links, then reports the core parent pages that reference them where available.',
  columns: LINK_FIELDS_WITH_EN_LINKS_COLUMNS,
  run: runLinkFieldsWithEnLinksSearch
};

const SEARCH_DEFINITIONS = [
  RESOURCE_PAGES_WITH_FORM_ID,
  CORE_PAGES_WITH_FORMS,
  RICH_TEXT_BLOCKS_WITH_EN_LINKS,
  LINK_FIELDS_WITH_EN_LINKS
];

export function listSearchDefinitions(): ContentfulSearchDefinition[] {
  return [...SEARCH_DEFINITIONS];
}

export function getSearchDefinition(id: string): ContentfulSearchDefinition | undefined {
  return SEARCH_DEFINITIONS.find((definition) => definition.id === id);
}

export function renderCsv(columns: string[], rows: ContentfulSearchExportRow[]): string {
  const lines = [
    columns.map(escapeCsvValue).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column] ?? '')).join(','))
  ];

  return `${lines.join('\n')}\n`;
}

async function runResourcePagesWithFormIdSearch(
  context: ContentfulContext,
  options: ContentfulSearchExportOptions
): Promise<ContentfulSearchExportResult> {
  const entries = await fetchEntries(context, {
    content_type: 'resourcePage'
  }, options.pageSize);

  const rows = entries
    .filter((entry) => fieldHasPopulatedValue(entry, 'formId', options.locale))
    .map((entry) => {
      const formIdValues = getFieldValues(entry, 'formId', options.locale).filter((item) =>
        hasPopulatedValue(item.value)
      );

      return {
        entryId: stringValue(entry?.sys?.id),
        entityType: contentTypeId(entry),
        internalName: formatFieldValue(entry, 'internalName'),
        slug: formatFieldValue(entry, 'slug', options.locale),
        formId: formatFieldValue(entry, 'formId', options.locale),
        formIdLocales: formIdValues.map((item) => item.locale ?? 'default').join('; ')
      };
    })
    .sort(compareRows);

  return {
    columns: RESOURCE_PAGES_WITH_FORM_ID_COLUMNS,
    rows,
    summary: {
      scannedEntries: entries.length,
      matchedEntries: rows.length
    }
  };
}

async function runCorePagesWithFormsSearch(
  context: ContentfulContext,
  options: ContentfulSearchExportOptions
): Promise<ContentfulSearchExportResult> {
  const [contentTypesResult, tags, pagesByType] = await Promise.all([
    context.environment.getContentTypes(),
    getTags(context),
    Promise.all(
      CORE_PAGE_CONTENT_TYPE_IDS.map((contentTypeId) =>
        fetchEntries(context, { content_type: contentTypeId }, options.pageSize)
      )
    )
  ]);

  const contentTypes = (contentTypesResult?.items ?? []) as any[];
  const referenceIndex = buildContentTypeReferenceIndex(
    contentTypes,
    FORM_ENTITY_CONTENT_TYPE_IDS
  );
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const pages = pagesByType.flat();
  const entryCache = new Map<string, any | undefined>();

  for (const page of pages) {
    const entryId = stringValue(page?.sys?.id);
    if (entryId) {
      entryCache.set(entryId, page);
    }
  }

  const rows: ContentfulSearchExportRow[] = [];
  const tagGroupColumns = new Set<string>();

  for (const page of pages) {
    const formPlacements = await findFormPlacements(
      context,
      page,
      referenceIndex,
      entryCache,
      options.locale
    );

    if (formPlacements.length === 0) {
      continue;
    }

    const entryId = stringValue(page?.sys?.id);
    const groupedTags = formatEntryGroupedTagValues(page, tagNameById);
    const row: ContentfulSearchExportRow = {
      entryId,
      entityType: contentTypeId(page),
      contentfulUrl: contentfulEntryUrl(context, entryId),
      slug: formatFieldValue(page, 'slug', options.locale),
      formEntityNames: formPlacements.map((form) => form.name).join('|')
    };

    for (const [tagGroup, tagValues] of groupedTags) {
      tagGroupColumns.add(tagGroup);
      row[tagGroup] = tagValues.join('|');
    }

    rows.push(row);
  }

  return {
    columns: [
      ...CORE_PAGES_WITH_FORMS_BASE_COLUMNS,
      ...[...tagGroupColumns].sort((left, right) => left.localeCompare(right))
    ],
    rows: rows.sort(compareRows),
    summary: {
      scannedEntries: pages.length,
      matchedEntries: rows.length
    }
  };
}

async function runRichTextBlocksWithEnLinksSearch(
  context: ContentfulContext,
  options: ContentfulSearchExportOptions
): Promise<ContentfulSearchExportResult> {
  const contentTypesResult = await context.environment.getContentTypes();
  const contentTypes = (contentTypesResult?.items ?? []) as any[];
  const referenceIndex = buildContentTypeReferenceIndex(
    contentTypes,
    RICH_TEXT_BLOCK_CONTENT_TYPE_IDS
  );
  const componentContentTypeIds = [...referenceIndex.traversableFields.keys()].filter(
    (contentTypeId) =>
      !CORE_PAGE_CONTENT_TYPE_IDS.includes(contentTypeId) &&
      contentTypeId !== RICH_TEXT_BLOCK_CONTENT_TYPE_ID
  );

  const [pagesByType, richTextBlocks] = await Promise.all([
    Promise.all(
      CORE_PAGE_CONTENT_TYPE_IDS.map((contentTypeId) =>
        fetchEntries(context, { content_type: contentTypeId }, options.pageSize)
      )
    ),
    fetchEntries(context, { content_type: RICH_TEXT_BLOCK_CONTENT_TYPE_ID }, options.pageSize)
  ]);

  const pages = pagesByType.flat();
  const enLinksByRichTextEntryId = new Map<string, string[]>();

  for (const richTextBlock of richTextBlocks) {
    const entryId = stringValue(richTextBlock?.sys?.id);
    const links = extractRichTextEnLinks(richTextBlock, options.locale);
    if (entryId && links.length > 0) {
      enLinksByRichTextEntryId.set(entryId, links);
    }
  }

  if (enLinksByRichTextEntryId.size === 0) {
    return {
      columns: RICH_TEXT_BLOCKS_WITH_EN_LINKS_COLUMNS,
      rows: [],
      summary: {
        scannedEntries: richTextBlocks.length,
        matchedEntries: 0
      }
    };
  }

  const componentsByType = await Promise.all(
    componentContentTypeIds.map((contentTypeId) =>
      fetchEntries(context, { content_type: contentTypeId }, options.pageSize)
    )
  );
  const reverseReferenceIndex = buildReverseReferenceIndex(
    [...pages, ...componentsByType.flat(), ...richTextBlocks],
    referenceIndex.traversableFields,
    options.locale
  );
  const rows: ContentfulSearchExportRow[] = [];

  for (const [richTextEntryId, links] of enLinksByRichTextEntryId) {
    const richTextEntry = reverseReferenceIndex.entriesById.get(richTextEntryId);
    if (!richTextEntry) {
      continue;
    }

    const parentPages = findParentPagesForEntry(richTextEntryId, reverseReferenceIndex);
    for (const parentPage of parentPages) {
      const parentPageEntryId = stringValue(parentPage?.sys?.id);
      for (const link of links) {
        rows.push({
          'Rich Text Entity ID': richTextEntryId,
          'Rich Text Contentful Link': contentfulEntryUrl(context, richTextEntryId),
          'Rich Text Entity Name': formatFieldValue(richTextEntry, 'internalName'),
          'Parent Page Entity ID': parentPageEntryId,
          'Parent Page Type': contentTypeId(parentPage),
          'Parent Page Contentful Link': contentfulEntryUrl(context, parentPageEntryId),
          'Parent Page Name': formatFieldValue(parentPage, 'internalName'),
          'Parent page slug': formatFieldValue(parentPage, 'slug', options.locale),
          'full /en/ link': link
        });
      }
    }
  }

  return {
    columns: RICH_TEXT_BLOCKS_WITH_EN_LINKS_COLUMNS,
    rows: rows.sort(compareRichTextEnLinkRows),
    summary: {
      scannedEntries: richTextBlocks.length,
      matchedEntries: rows.length
    }
  };
}

async function runLinkFieldsWithEnLinksSearch(
  context: ContentfulContext,
  options: ContentfulSearchExportOptions
): Promise<ContentfulSearchExportResult> {
  const contentTypesResult = await context.environment.getContentTypes();
  const contentTypes = (contentTypesResult?.items ?? []) as any[];
  const linkFields = discoverLinkFieldDefinitions(contentTypes);
  const linkFieldsByContentType = groupLinkFieldsByContentType(linkFields);
  const contentTypeIds = [...linkFieldsByContentType.keys()];

  const entriesByContentType = await fetchEntriesForContentTypes(
    context,
    contentTypeIds,
    options.pageSize
  );
  const linkFieldEntries = entriesByContentType.flat();
  const matches = collectEnLinkMatches(linkFieldEntries, linkFieldsByContentType, options.locale);

  if (matches.length === 0) {
    return {
      columns: LINK_FIELDS_WITH_EN_LINKS_COLUMNS,
      rows: [],
      summary: {
        scannedEntries: linkFieldEntries.length,
        matchedEntries: 0
      }
    };
  }

  const nonPageTargetContentTypeIds = contentTypeIds.filter(
    (contentTypeId) => !CORE_PAGE_CONTENT_TYPE_IDS.includes(contentTypeId)
  );
  const referenceIndex = buildContentTypeReferenceIndex(contentTypes, nonPageTargetContentTypeIds);
  const componentContentTypeIds = [...referenceIndex.traversableFields.keys()].filter(
    (contentTypeId) =>
      !CORE_PAGE_CONTENT_TYPE_IDS.includes(contentTypeId) &&
      !contentTypeIds.includes(contentTypeId)
  );
  const [pagesByType, componentsByType] = await Promise.all([
    fetchEntriesForContentTypes(context, CORE_PAGE_CONTENT_TYPE_IDS, options.pageSize),
    fetchEntriesForContentTypes(context, componentContentTypeIds, options.pageSize)
  ]);
  const pages = pagesByType.flat();
  const reverseReferenceIndex = buildReverseReferenceIndex(
    [...pages, ...componentsByType.flat(), ...linkFieldEntries],
    referenceIndex.traversableFields,
    options.locale
  );
  const rows: ContentfulSearchExportRow[] = [];

  for (const match of matches) {
    const entryId = stringValue(match.entry?.sys?.id);
    const parentPages = CORE_PAGE_CONTENT_TYPE_IDS.includes(match.field.contentTypeId)
      ? [match.entry]
      : findParentPagesForEntry(entryId, reverseReferenceIndex);
    const rowParentPages = parentPages.length > 0 ? parentPages : [undefined];

    for (const parentPage of rowParentPages) {
      const parentPageEntryId = stringValue(parentPage?.sys?.id);
      rows.push({
        'Entity ID': entryId,
        'Entity Contentful Link': contentfulEntryUrl(context, entryId),
        'Entity Name': formatEntryDisplayName(
          match.entry,
          referenceIndex.displayFields,
          options.locale
        ),
        'Content Type': match.field.contentTypeId,
        'Field': match.field.fieldId,
        'Parent Page Entity ID': parentPageEntryId,
        'Parent Page Type': parentPage ? contentTypeId(parentPage) : '',
        'Parent Page Contentful Link': contentfulEntryUrl(context, parentPageEntryId),
        'Parent Page Name': parentPage
          ? formatFieldValue(parentPage, 'internalName', options.locale)
          : '',
        'Parent page slug': parentPage ? formatFieldValue(parentPage, 'slug', options.locale) : '',
        'full /en/ link': match.link
      });
    }
  }

  return {
    columns: LINK_FIELDS_WITH_EN_LINKS_COLUMNS,
    rows: rows.sort(compareLinkFieldRows),
    summary: {
      scannedEntries: linkFieldEntries.length,
      matchedEntries: rows.length
    }
  };
}

function discoverLinkFieldDefinitions(contentTypes: any[]): LinkFieldDefinition[] {
  const fields: LinkFieldDefinition[] = [];

  for (const contentType of contentTypes) {
    const contentTypeId = contentTypeDefinitionId(contentType);
    if (!contentTypeId || EXCLUDED_LINK_FIELD_CONTENT_TYPE_IDS.has(contentTypeId)) {
      continue;
    }

    const contentTypeName = stringValue(contentType?.name) || contentTypeId;

    for (const field of (contentType?.fields ?? []) as any[]) {
      const fieldId = stringValue(field?.id);
      if (!fieldId) {
        continue;
      }

      if (richTextFieldAllowsHyperlinks(field)) {
        fields.push({
          contentTypeId,
          contentTypeName,
          fieldId,
          fieldName: stringValue(field?.name) || fieldId,
          kind: 'rich-text'
        });
        continue;
      }

      if (stringFieldCanHoldExternalLinks(contentTypeId, field)) {
        fields.push({
          contentTypeId,
          contentTypeName,
          fieldId,
          fieldName: stringValue(field?.name) || fieldId,
          kind: 'string'
        });
      }
    }
  }

  return fields.sort(
    (left, right) =>
      left.contentTypeId.localeCompare(right.contentTypeId) ||
      left.fieldId.localeCompare(right.fieldId)
  );
}

function groupLinkFieldsByContentType(
  linkFields: LinkFieldDefinition[]
): Map<string, LinkFieldDefinition[]> {
  const fieldsByContentType = new Map<string, LinkFieldDefinition[]>();

  for (const field of linkFields) {
    const fields = fieldsByContentType.get(field.contentTypeId) ?? [];
    fields.push(field);
    fieldsByContentType.set(field.contentTypeId, fields);
  }

  return fieldsByContentType;
}

function collectEnLinkMatches(
  entries: any[],
  linkFieldsByContentType: Map<string, LinkFieldDefinition[]>,
  locale?: string
): EnLinkMatch[] {
  const matches: EnLinkMatch[] = [];

  for (const entry of entries) {
    const fields = linkFieldsByContentType.get(contentTypeId(entry)) ?? [];

    for (const field of fields) {
      const links =
        field.kind === 'rich-text'
          ? extractRichTextFieldEnLinks(entry, field.fieldId, locale)
          : extractStringFieldEnLinks(entry, field.fieldId, locale);

      for (const link of links) {
        matches.push({
          entry,
          field,
          link
        });
      }
    }
  }

  return matches;
}

function richTextFieldAllowsHyperlinks(field: any): boolean {
  if (field?.type !== 'RichText') {
    return false;
  }

  const enabledNodeTypes = ((field?.validations ?? []) as any[]).flatMap((validation) =>
    Array.isArray(validation?.enabledNodeTypes) ? validation.enabledNodeTypes : []
  );

  return enabledNodeTypes.length === 0 || enabledNodeTypes.includes('hyperlink');
}

function stringFieldCanHoldExternalLinks(contentTypeId: string, field: any): boolean {
  const fieldIds = STRING_LINK_FIELD_IDS_BY_CONTENT_TYPE.get(contentTypeId);
  return (
    Boolean(fieldIds?.has(stringValue(field?.id))) &&
    (field?.type === 'Symbol' || field?.type === 'Text')
  );
}

function extractRichTextFieldEnLinks(entry: any, fieldId: string, locale?: string): string[] {
  const links = getFieldValues(entry, fieldId, locale).flatMap((fieldValue) =>
    extractEnHyperlinkUris(fieldValue.value)
  );

  return [...new Set(links)].sort((left, right) => left.localeCompare(right));
}

function extractStringFieldEnLinks(entry: any, fieldId: string, locale?: string): string[] {
  const links = getFieldValues(entry, fieldId, locale).flatMap((fieldValue) =>
    extractEnLinksFromStringValue(fieldValue.value)
  );

  return [...new Set(links)].sort((left, right) => left.localeCompare(right));
}

function extractEnLinksFromStringValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEnLinksFromStringValue(item));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  return trimmed && containsEnPathSegment(trimmed) ? [trimmed] : [];
}

async function fetchEntries(
  context: ContentfulContext,
  query: Record<string, string>,
  pageSize = 500
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

async function fetchEntriesForContentTypes(
  context: ContentfulContext,
  contentTypeIds: string[],
  pageSize = 500,
  concurrency = 3
): Promise<any[][]> {
  const uniqueContentTypeIds = [...new Set(contentTypeIds)].filter(
    (contentTypeId) => contentTypeId.length > 0
  );
  const results: any[][] = new Array(uniqueContentTypeIds.length).fill(undefined);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < uniqueContentTypeIds.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const contentTypeId = uniqueContentTypeIds[currentIndex];
      if (!contentTypeId) {
        continue;
      }
      results[currentIndex] = await fetchEntries(
        context,
        { content_type: contentTypeId },
        pageSize
      );
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, uniqueContentTypeIds.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

function isResponseSizeTooBigError(error: unknown): boolean {
  const record = typeof error === 'object' && error !== null ? (error as any) : {};
  const messages = [
    record.message,
    record.details?.message,
    record.response?.data?.message
  ];

  return messages.some(
    (message) => typeof message === 'string' && message.includes('Response size too big')
  );
}

async function fetchEntriesByIds(context: ContentfulContext, entryIds: string[]): Promise<any[]> {
  const entries: any[] = [];
  const uniqueIds = [...new Set(entryIds)].filter((entryId) => entryId.length > 0);

  for (const batch of chunk(uniqueIds, 100)) {
    const response = await context.environment.getEntries({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    entries.push(...((response?.items ?? []) as any[]));
  }

  return entries;
}

async function hydrateEntryCache(
  context: ContentfulContext,
  entryIds: string[],
  entryCache: Map<string, any | undefined>
): Promise<void> {
  const missingIds = [...new Set(entryIds)].filter((entryId) => !entryCache.has(entryId));

  if (missingIds.length === 0) {
    return;
  }

  const entries = await fetchEntriesByIds(context, missingIds);
  const foundIds = new Set<string>();

  for (const entry of entries) {
    const entryId = stringValue(entry?.sys?.id);
    if (entryId) {
      entryCache.set(entryId, entry);
      foundIds.add(entryId);
    }
  }

  for (const entryId of missingIds) {
    if (!foundIds.has(entryId)) {
      entryCache.set(entryId, undefined);
    }
  }
}

function buildReverseReferenceIndex(
  entries: any[],
  traversableFields: Map<string, Set<string>>,
  locale?: string
): ReverseReferenceIndex {
  const entriesById = new Map<string, any>();
  const contentTypeByEntryId = new Map<string, string>();
  const parentIdsByChildId = new Map<string, Set<string>>();

  for (const entry of entries) {
    const entryId = stringValue(entry?.sys?.id);
    if (!entryId) {
      continue;
    }

    entriesById.set(entryId, entry);
    contentTypeByEntryId.set(entryId, contentTypeId(entry));
  }

  for (const entry of entriesById.values()) {
    const parentEntryId = stringValue(entry?.sys?.id);
    if (!parentEntryId) {
      continue;
    }

    for (const childEntryId of extractTraversableEntryLinkIds(entry, traversableFields, locale)) {
      const childContentTypeId = contentTypeByEntryId.get(childEntryId);
      if (!childContentTypeId || CORE_PAGE_CONTENT_TYPE_IDS.includes(childContentTypeId)) {
        continue;
      }

      getOrCreateSet(parentIdsByChildId, childEntryId).add(parentEntryId);
    }
  }

  return {
    entriesById,
    contentTypeByEntryId,
    parentIdsByChildId
  };
}

function findParentPagesForEntry(
  entryId: string,
  reverseReferenceIndex: ReverseReferenceIndex
): any[] {
  const parentPagesById = new Map<string, any>();
  const visitedIds = new Set<string>([entryId]);
  let pendingIds = [...(reverseReferenceIndex.parentIdsByChildId.get(entryId) ?? [])];

  while (pendingIds.length > 0) {
    const currentIds = [...new Set(pendingIds)].filter((currentId) => !visitedIds.has(currentId));
    pendingIds = [];

    for (const currentId of currentIds) {
      visitedIds.add(currentId);

      const entry = reverseReferenceIndex.entriesById.get(currentId);
      if (!entry) {
        continue;
      }

      if (CORE_PAGE_CONTENT_TYPE_IDS.includes(contentTypeId(entry))) {
        parentPagesById.set(currentId, entry);
        continue;
      }

      pendingIds.push(...(reverseReferenceIndex.parentIdsByChildId.get(currentId) ?? []));
    }
  }

  return [...parentPagesById.values()].sort((left, right) =>
    stringValue(left?.sys?.id).localeCompare(stringValue(right?.sys?.id))
  );
}

async function findFormPlacements(
  context: ContentfulContext,
  rootEntry: any,
  referenceIndex: ContentTypeReferenceIndex,
  entryCache: Map<string, any | undefined>,
  locale?: string
): Promise<FormPlacement[]> {
  const forms = await findTargetEntries(
    context,
    rootEntry,
    FORM_ENTITY_CONTENT_TYPE_IDS,
    referenceIndex,
    entryCache,
    locale
  );
  const formsById = new Map<string, FormPlacement>();

  for (const form of forms) {
    const entryId = stringValue(form?.sys?.id);
    if (!entryId) {
      continue;
    }

    formsById.set(entryId, {
      entryId,
      name: formatEntryDisplayName(form, referenceIndex.displayFields, locale)
    });
  }

  return [...formsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.entryId.localeCompare(right.entryId)
  );
}

async function findTargetEntries(
  context: ContentfulContext,
  rootEntry: any,
  targetContentTypeIds: string[],
  referenceIndex: ContentTypeReferenceIndex,
  entryCache: Map<string, any | undefined>,
  locale?: string
): Promise<any[]> {
  const rootEntryId = stringValue(rootEntry?.sys?.id);
  const targetContentTypes = new Set(targetContentTypeIds);
  const corePageTypeIds = new Set(CORE_PAGE_CONTENT_TYPE_IDS);
  const visitedIds = new Set<string>(rootEntryId ? [rootEntryId] : []);
  const entriesById = new Map<string, any>();
  let pendingIds = extractTraversableEntryLinkIds(
    rootEntry,
    referenceIndex.traversableFields,
    locale
  );

  while (pendingIds.length > 0) {
    const currentIds = [...new Set(pendingIds)].filter((entryId) => !visitedIds.has(entryId));
    pendingIds = [];

    if (currentIds.length === 0) {
      continue;
    }

    await hydrateEntryCache(context, currentIds, entryCache);

    for (const entryId of currentIds) {
      visitedIds.add(entryId);
      const entry = entryCache.get(entryId);
      if (!entry) {
        continue;
      }

      const entryContentTypeId = contentTypeId(entry);
      if (targetContentTypes.has(entryContentTypeId)) {
        entriesById.set(entryId, entry);
        continue;
      }

      if (corePageTypeIds.has(entryContentTypeId)) {
        continue;
      }

      pendingIds.push(
        ...extractTraversableEntryLinkIds(entry, referenceIndex.traversableFields, locale)
      );
    }
  }

  return [...entriesById.values()].sort((left, right) =>
    stringValue(left?.sys?.id).localeCompare(stringValue(right?.sys?.id))
  );
}

function buildContentTypeReferenceIndex(
  contentTypes: any[],
  targetContentTypeIds: string[]
): ContentTypeReferenceIndex {
  const displayFields = new Map<string, string | undefined>();
  const referenceFieldsByContentType = new Map<string, ContentTypeReferenceField[]>();

  for (const contentType of contentTypes) {
    const contentTypeId = contentTypeDefinitionId(contentType);
    if (!contentTypeId) {
      continue;
    }

    displayFields.set(contentTypeId, optionalStringValue(contentType?.displayField));
    referenceFieldsByContentType.set(
      contentTypeId,
      ((contentType?.fields ?? []) as any[])
        .filter(isEntryReferenceField)
        .map((field) => ({
          fieldId: stringValue(field?.id),
          allowedContentTypes: extractAllowedContentTypeIds(field)
        }))
        .filter((field) => field.fieldId.length > 0)
    );
  }

  return {
    displayFields,
    traversableFields: buildTraversableFieldMap(referenceFieldsByContentType, targetContentTypeIds)
  };
}

function buildTraversableFieldMap(
  referenceFieldsByContentType: Map<string, ContentTypeReferenceField[]>,
  targetContentTypeIds: string[]
): Map<string, Set<string>> {
  const traversableFields = new Map<string, Set<string>>();
  const reachableNonPageTypes = new Set(targetContentTypeIds);
  const corePageTypeIds = new Set(CORE_PAGE_CONTENT_TYPE_IDS);
  let changed = true;

  while (changed) {
    changed = false;

    for (const [contentTypeId, referenceFields] of referenceFieldsByContentType) {
      for (const field of referenceFields) {
        if (!intersects(field.allowedContentTypes, reachableNonPageTypes)) {
          continue;
        }

        const fieldsForContentType = getOrCreateSet(traversableFields, contentTypeId);
        if (!fieldsForContentType.has(field.fieldId)) {
          fieldsForContentType.add(field.fieldId);
          changed = true;
        }

        if (!corePageTypeIds.has(contentTypeId) && !reachableNonPageTypes.has(contentTypeId)) {
          reachableNonPageTypes.add(contentTypeId);
          changed = true;
        }
      }
    }
  }

  return traversableFields;
}

function extractTraversableEntryLinkIds(
  entry: any,
  traversableFields: Map<string, Set<string>>,
  locale?: string
): string[] {
  const fields = traversableFields.get(contentTypeId(entry));
  if (!fields) {
    return [];
  }

  const entryIds: string[] = [];

  for (const fieldId of fields) {
    for (const fieldValue of getFieldValues(entry, fieldId, locale)) {
      entryIds.push(...extractEntryLinkIds(fieldValue.value));
    }
  }

  return [...new Set(entryIds)];
}

function extractRichTextEnLinks(entry: any, locale?: string): string[] {
  return extractRichTextFieldEnLinks(entry, RICH_TEXT_BLOCK_FIELD_ID, locale);
}

function extractEnHyperlinkUris(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEnHyperlinkUris(item));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const links: string[] = [];
  const uri = optionalStringValue((record.data as Record<string, unknown> | undefined)?.uri);

  if (record.nodeType === 'hyperlink' && uri && containsEnPathSegment(uri)) {
    links.push(uri);
  }

  links.push(...Object.values(record).flatMap((item) => extractEnHyperlinkUris(item)));

  return links;
}

function containsEnPathSegment(uri: string): boolean {
  return /\/en(?:\/|$|[?#])/.test(uri);
}

function extractEntryLinkIds(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEntryLinkIds(item));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const linkedEntryId = entryLinkId(record) ?? entryResourceId(record);
  if (linkedEntryId) {
    return [linkedEntryId];
  }

  return Object.values(record).flatMap((item) => extractEntryLinkIds(item));
}

function isEntryReferenceField(field: any): boolean {
  if (field?.type === 'Link') {
    return field?.linkType === 'Entry';
  }

  if (field?.type === 'Array') {
    return field?.items?.type === 'Link' && field?.items?.linkType === 'Entry';
  }

  return field?.type === 'RichText';
}

function extractAllowedContentTypeIds(field: any): Set<string> {
  const ids = new Set<string>();
  collectAllowedContentTypeIds(field?.validations, ids);
  collectAllowedContentTypeIds(field?.items?.validations, ids);
  return ids;
}

function collectAllowedContentTypeIds(value: unknown, ids: Set<string>): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAllowedContentTypeIds(item, ids);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const linkContentType = record.linkContentType;

  if (Array.isArray(linkContentType)) {
    for (const item of linkContentType) {
      if (typeof item === 'string' && item.trim() !== '') {
        ids.add(item.trim());
      }
    }
  }

  for (const item of Object.values(record)) {
    collectAllowedContentTypeIds(item, ids);
  }
}

function fieldHasPopulatedValue(entry: any, fieldId: string, locale?: string): boolean {
  return getFieldValues(entry, fieldId, locale).some((item) => hasPopulatedValue(item.value));
}

function formatFieldValue(entry: any, fieldId: string, locale?: string): string {
  const values = getFieldValues(entry, fieldId, locale).filter((item) =>
    hasPopulatedValue(item.value)
  );

  if (values.length === 0) {
    return '';
  }

  if (locale || values.length === 1) {
    return stringifyFieldValue(values[0]?.value);
  }

  return values
    .map((item) => `${item.locale ?? 'default'}=${stringifyFieldValue(item.value)}`)
    .join('; ');
}

function getFieldValues(entry: any, fieldId: string, locale?: string): LocalizedFieldValue[] {
  const rawValue = entry?.fields?.[fieldId];
  if (!isLocalizedFieldMap(rawValue)) {
    return rawValue === undefined ? [] : [{ value: rawValue }];
  }

  if (locale) {
    return Object.prototype.hasOwnProperty.call(rawValue, locale)
      ? [{ locale, value: rawValue[locale] }]
      : [];
  }

  return Object.entries(rawValue).map(([fieldLocale, value]) => ({
    locale: fieldLocale,
    value
  }));
}

function isLocalizedFieldMap(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'sys')
  );
}

function hasPopulatedValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
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

  return JSON.stringify(value);
}

function contentTypeId(entry: any): string {
  return stringValue(entry?.sys?.contentType?.sys?.id) || stringValue(entry?.sys?.type);
}

function contentTypeDefinitionId(contentType: any): string {
  return stringValue(contentType?.sys?.id) || stringValue(contentType?.id);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function entryLinkId(value: Record<string, unknown>): string | undefined {
  const sys = value.sys as Record<string, unknown> | undefined;
  if (sys?.type === 'Link' && sys.linkType === 'Entry') {
    return optionalStringValue(sys.id);
  }

  return undefined;
}

function entryResourceId(value: Record<string, unknown>): string | undefined {
  const sys = value.sys as Record<string, unknown> | undefined;
  if (sys?.type === 'Entry') {
    return optionalStringValue(sys.id);
  }

  return undefined;
}

function formatEntryDisplayName(
  entry: any,
  displayFields: Map<string, string | undefined>,
  locale?: string
): string {
  const displayField = displayFields.get(contentTypeId(entry)) ?? 'internalName';

  return (
    formatFieldValue(entry, displayField, locale) ||
    formatFieldValue(entry, 'internalName', locale) ||
    stringValue(entry?.sys?.id)
  );
}

function formatEntryGroupedTagValues(
  entry: any,
  tagNameById: Map<string, string>
): Map<string, string[]> {
  const tagValuesByGroup = new Map<string, Set<string>>();

  for (const tagId of getEntryTagIds(entry)) {
    const parsedTag = parseGroupedTagName(tagNameById.get(tagId) ?? tagId);
    if (!parsedTag) {
      continue;
    }

    getOrCreateSet(tagValuesByGroup, parsedTag.group).add(parsedTag.value);
  }

  return new Map(
    [...tagValuesByGroup.entries()].map(([tagGroup, tagValues]) => [
      tagGroup,
      [...tagValues].sort((left, right) => left.localeCompare(right))
    ])
  );
}

function parseGroupedTagName(tagName: string): { group: string; value: string } | undefined {
  const trimmedTagName = tagName.trim();
  if (!trimmedTagName) {
    return undefined;
  }

  const separatorIndex = trimmedTagName.indexOf(':');
  if (separatorIndex === -1) {
    return {
      group: 'Ungrouped Tags',
      value: trimmedTagName
    };
  }

  const group = trimmedTagName.slice(0, separatorIndex).trim();
  const value = trimmedTagName.slice(separatorIndex + 1).trim();

  if (!group || !value) {
    return undefined;
  }

  return { group, value };
}

function getEntryTagIds(entry: any): string[] {
  const tags = entry?.metadata?.tags;
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => stringValue(tag?.sys?.id))
    .filter((tagId) => tagId.length > 0);
}

function contentfulEntryUrl(context: ContentfulContext, entryId: string): string {
  if (!entryId) {
    return '';
  }

  return `https://app.contentful.com/spaces/${encodeURIComponent(
    context.spaceId
  )}/environments/${encodeURIComponent(context.environmentId)}/entries/${encodeURIComponent(
    entryId
  )}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getOrCreateSet(map: Map<string, Set<string>>, key: string): Set<string> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  map.set(key, created);
  return created;
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const item of left) {
    if (right.has(item)) {
      return true;
    }
  }

  return false;
}

function compareRows(left: ContentfulSearchExportRow, right: ContentfulSearchExportRow): number {
  return (
    rowValue(left, 'internalName').localeCompare(rowValue(right, 'internalName')) ||
    rowValue(left, 'entityType').localeCompare(rowValue(right, 'entityType')) ||
    rowValue(left, 'slug').localeCompare(rowValue(right, 'slug')) ||
    rowValue(left, 'entryId').localeCompare(rowValue(right, 'entryId'))
  );
}

function compareRichTextEnLinkRows(
  left: ContentfulSearchExportRow,
  right: ContentfulSearchExportRow
): number {
  return (
    rowValue(left, 'Parent Page Name').localeCompare(rowValue(right, 'Parent Page Name')) ||
    rowValue(left, 'Parent page slug').localeCompare(rowValue(right, 'Parent page slug')) ||
    rowValue(left, 'Parent Page Type').localeCompare(rowValue(right, 'Parent Page Type')) ||
    rowValue(left, 'Rich Text Entity Name').localeCompare(rowValue(right, 'Rich Text Entity Name')) ||
    rowValue(left, 'full /en/ link').localeCompare(rowValue(right, 'full /en/ link')) ||
    rowValue(left, 'Rich Text Entity ID').localeCompare(rowValue(right, 'Rich Text Entity ID')) ||
    rowValue(left, 'Parent Page Entity ID').localeCompare(rowValue(right, 'Parent Page Entity ID'))
  );
}

function compareLinkFieldRows(
  left: ContentfulSearchExportRow,
  right: ContentfulSearchExportRow
): number {
  return (
    rowValue(left, 'Parent Page Name').localeCompare(rowValue(right, 'Parent Page Name')) ||
    rowValue(left, 'Parent page slug').localeCompare(rowValue(right, 'Parent page slug')) ||
    rowValue(left, 'Parent Page Type').localeCompare(rowValue(right, 'Parent Page Type')) ||
    rowValue(left, 'Content Type').localeCompare(rowValue(right, 'Content Type')) ||
    rowValue(left, 'Field').localeCompare(rowValue(right, 'Field')) ||
    rowValue(left, 'Entity Name').localeCompare(rowValue(right, 'Entity Name')) ||
    rowValue(left, 'full /en/ link').localeCompare(rowValue(right, 'full /en/ link')) ||
    rowValue(left, 'Entity ID').localeCompare(rowValue(right, 'Entity ID')) ||
    rowValue(left, 'Parent Page Entity ID').localeCompare(rowValue(right, 'Parent Page Entity ID'))
  );
}

function rowValue(row: ContentfulSearchExportRow, column: string): string {
  return row[column] ?? '';
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}
