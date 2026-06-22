import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

import { toContentfulResourceId } from './ids.js';
import { canonicalDocumentSchema } from './normalizer.js';
import type {
  CanonicalDocument,
  ComponentMapConfig,
  ContentTypeFieldSnapshot,
  ContentTypeSnapshot,
  ConventionsConfig,
  DiscoverySnapshot,
  MappedDocumentPlan,
  ParsedDocument,
  PlannedEntry,
  TaxonomyMapConfig,
  TaxonomySnapshot,
  ValidationIssue
} from './types.js';

const TAXONOMY_TOKEN_SCHEME_IDS: Record<string, string> = {
  'industry': 'industries',
  'knowledge-hub-topic': 'knowledgeHubTopics',
  'product-family': 'productFamilies',
  'resource-type': 'resourceType',
  'role': 'roles',
  'topic': 'topics'
};

const CONTENTFUL_RESOURCE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

const COMPONENT_MARKER_ALIASES: Record<string, string> = {
  heroBlock: 'HeroStandard',
  accordionBlock: 'FaqBlock',
  productCardBlock: 'ProductCardBlock',
  statisticsBlock: 'StatsBlock',
  notificationBlock: 'NotificationBlock',
  testimonialsBlock: 'Testimonials'
};

const TOP_LEVEL_FIELD_ALIASES: Array<{
  alias: string;
  preferred: string;
  shouldWarn?: (value: unknown) => boolean;
}> = [
  { alias: 'Heading', preferred: 'heading' },
  { alias: 'eyebrowText', preferred: 'eyebrow' },
  { alias: 'subtitle', preferred: 'description' },
  { alias: 'productCards', preferred: 'cards' },
  { alias: 'accordionItems', preferred: 'items' },
  { alias: 'tableContent', preferred: 'table' },
  { alias: 'notificationHeading', preferred: 'heading' },
  { alias: 'notificationDescription', preferred: 'body' },
  { alias: 'callToActions', preferred: 'callsToAction' },
  { alias: 'callToAction', preferred: 'callsToAction', shouldWarn: Array.isArray }
];

const CTA_FIELD_ALIASES: Record<string, string> = {
  linkText: 'text',
  externalUrl: 'url',
  openUrlInNewTab: 'openInNewTab'
};

const ACCORDION_ITEM_FIELD_ALIASES: Record<string, string> = {
  itemHeading: 'heading',
  itemContent: 'body',
  question: 'heading',
  answer: 'body'
};

export function validateMarkdownSourceFormat(documents: ParsedDocument[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const document of documents) {
    for (const [blockIndex, block] of document.blocks.entries()) {
      if (block.type !== 'component') {
        continue;
      }

      const sourceComponent = block.sourceComponent ?? block.component;
      const sourceProps = block.sourceProps ?? block.props;
      const blockPath = `block[${blockIndex + 1}].${sourceComponent}`;

      const preferredComponent = COMPONENT_MARKER_ALIASES[sourceComponent];
      if (preferredComponent) {
        issues.push({
          severity: 'warning',
          code: 'markdown.aliasComponent',
          documentId: document.sourceId,
          path: blockPath,
          message: `Component marker ${sourceComponent} is accepted as an alias, but ${preferredComponent} is the preferred markdown marker.`
        });
      }

      issues.push(...validateTopLevelAliases(sourceProps, blockPath, document.sourceId));
      issues.push(...validateNestedSourceAliases(sourceProps, blockPath, document.sourceId));
    }
  }

  return issues;
}

function validateTopLevelAliases(
  props: Record<string, unknown>,
  path: string,
  documentId: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const alias of TOP_LEVEL_FIELD_ALIASES) {
    if (!(alias.alias in props)) {
      continue;
    }

    const value = props[alias.alias];
    if (alias.shouldWarn && !alias.shouldWarn(value)) {
      continue;
    }

    issues.push({
      severity: 'warning',
      code: 'markdown.aliasField',
      documentId,
      path: `${path}.${alias.alias}`,
      message: `Markdown field ${path}.${alias.alias} is accepted as an alias, but ${alias.preferred} is the preferred markdown field.`
    });
  }

  return issues;
}

function validateNestedSourceAliases(
  value: unknown,
  path: string,
  documentId: string
): ValidationIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      validateNestedSourceAliases(item, `${path}[${index}]`, documentId)
    );
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const objectValue = value as Record<string, unknown>;

  for (const [alias, preferred] of Object.entries(CTA_FIELD_ALIASES)) {
    if (alias in objectValue) {
      issues.push({
        severity: 'warning',
        code: 'markdown.aliasField',
        documentId,
        path: `${path}.${alias}`,
        message: `Markdown field ${path}.${alias} is accepted as an alias, but ${preferred} is the preferred markdown field.`
      });
    }
  }

  for (const [alias, preferred] of Object.entries(ACCORDION_ITEM_FIELD_ALIASES)) {
    if (alias in objectValue) {
      issues.push({
        severity: 'warning',
        code: 'markdown.aliasField',
        documentId,
        path: `${path}.${alias}`,
        message: `Markdown field ${path}.${alias} is accepted as an alias, but ${preferred} is the preferred markdown field.`
      });
    }
  }

  for (const [key, nestedValue] of Object.entries(objectValue)) {
    issues.push(...validateNestedSourceAliases(nestedValue, `${path}.${key}`, documentId));
  }

  return issues;
}

export function validateCanonicalDocuments(
  documents: CanonicalDocument[],
  componentMap: ComponentMapConfig,
  taxonomyMap: TaxonomyMapConfig,
  conventions: ConventionsConfig,
  discovery?: DiscoverySnapshot
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locales = new Set(discovery?.locales.map((locale) => locale.code) ?? []);
  const contentTypes = new Map(discovery?.contentTypes.map((item) => [item.id, item]) ?? []);

  for (const document of documents) {
    const parsed = canonicalDocumentSchema.safeParse(document);
    if (!parsed.success) {
      issues.push({
        severity: 'error',
        code: 'canonical.invalid',
        documentId: document.sourceId,
        message: parsed.error.message
      });
    }

    if (locales.size > 0 && !locales.has(document.locale)) {
      issues.push({
        severity: 'error',
        code: 'locale.unknown',
        documentId: document.sourceId,
        message: `Locale ${document.locale} does not exist in the target environment`
      });
    }

    const unmappedTaxonomyTokens = document.metadata.sourceTaxonomyTokens.filter(
      (token) => !taxonomyMap.concepts[token]
    );

    if ((conventions.taxonomy.requireMappings || conventions.taxonomy.attachConcepts) && unmappedTaxonomyTokens.length > 0) {
      for (const token of unmappedTaxonomyTokens) {
        issues.push({
          severity: 'error',
          code: 'taxonomy.unmappedToken',
          documentId: document.sourceId,
          path: token,
          message: `Taxonomy token ${token} is not mapped in taxonomy-map.yml`
        });
      }
    }

    if (conventions.taxonomy.attachConcepts && document.metadata.taxonomyConceptIds.length > 0) {
      const targetContentType = contentTypes.get(document.target.contentType);
      if (targetContentType && (targetContentType.metadataTaxonomySchemeIds?.length ?? 0) === 0) {
        issues.push({
          severity: 'error',
          code: 'taxonomy.unsupportedContentType',
          documentId: document.sourceId,
          path: document.target.contentType,
          message: `Content type ${document.target.contentType} does not expose taxonomy metadata in the live model`
        });
      }

      const supportedSchemeIds = targetContentType?.metadataTaxonomySchemeIds ?? [];
      if (supportedSchemeIds.length > 0) {
        for (const token of document.metadata.sourceTaxonomyTokens) {
          const schemeId = taxonomySchemeIdForToken(token);
          if (schemeId && !supportedSchemeIds.includes(schemeId)) {
            issues.push({
              severity: 'error',
              code: 'taxonomy.unsupportedScheme',
              documentId: document.sourceId,
              path: token,
              message: `Taxonomy token ${token} belongs to scheme ${schemeId}, but content type ${document.target.contentType} only allows ${supportedSchemeIds.join(', ')}`
            });
          }
        }
      }
    }

    for (const [blockIndex, block] of document.blocks.entries()) {
      if (block.kind === 'component' && !componentMap.components[block.component]) {
        issues.push({
          severity: 'error',
          code: 'component.unknown',
          documentId: document.sourceId,
          message: `No component mapping found for ${block.component}`
        });
      }

      if (block.kind === 'component') {
        const componentMapping = componentMap.components[block.component];
        if (componentMapping) {
          issues.push(
            ...validateUnusedMarkdownFields(
              block.props,
              componentMapping,
              `block[${blockIndex + 1}].${block.component}`,
              document.sourceId,
              'block.props'
            )
          );
        }
      }

      if (block.kind === 'asset') {
        issues.push(...[]);
      }
    }
  }

  return issues;
}

function validateUnusedMarkdownFields(
  value: unknown,
  mapping: ComponentMapConfig['components'][string] | NonNullable<ComponentMapConfig['components'][string]['nestedEntries']>[string],
  path: string,
  documentId: string,
  rootName: 'block.props' | 'item'
): ValidationIssue[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const objectValue = value as Record<string, unknown>;
  const consumedKeys = collectConsumedMarkdownKeys(mapping, rootName);

  for (const key of Object.keys(objectValue)) {
    if (!consumedKeys.has(key)) {
      issues.push({
        severity: 'warning',
        code: 'markdown.unusedField',
        documentId,
        path: `${path}.${key}`,
        message: `Markdown field ${path}.${key} is not read by the importer mapping. Check the field spelling or add it to component-map.yml.`
      });
    }
  }

  for (const nestedMapping of Object.values(mapping.nestedEntries ?? {})) {
    for (const { key, value: nestedValue } of resolveMarkdownSourceValues(nestedMapping.source, objectValue, rootName)) {
      for (const [index, item] of normalizeToArray(nestedValue).entries()) {
        issues.push(
          ...validateUnusedMarkdownFields(
            item,
            nestedMapping,
            `${path}.${key}[${index}]`,
            documentId,
            'item'
          )
        );
      }
    }
  }

  return issues;
}

function collectConsumedMarkdownKeys(
  mapping: ComponentMapConfig['components'][string] | NonNullable<ComponentMapConfig['components'][string]['nestedEntries']>[string],
  rootName: 'block.props' | 'item'
): Set<string> {
  const consumed = new Set<string>();

  for (const [fieldId, fieldMapping] of Object.entries(mapping.fields)) {
    if ('strategy' in fieldMapping) {
      continue;
    }

    const sourceKeys = markdownKeysFromSource(fieldMapping.source, rootName);
    if (sourceKeys.length > 0) {
      for (const key of sourceKeys) {
        consumed.add(key);
      }
    } else {
      consumed.add(fieldId);
    }
  }

  for (const nestedMapping of Object.values(mapping.nestedEntries ?? {})) {
    for (const key of markdownKeysFromSource(nestedMapping.source, rootName)) {
      consumed.add(key);
    }
  }

  if (mapping.asset) {
    for (const source of [
      mapping.asset.source,
      mapping.asset.altSource,
      mapping.asset.titleSource,
      mapping.asset.descriptionSource
    ]) {
      for (const key of markdownKeysFromSource(source, rootName)) {
        consumed.add(key);
      }
    }
  }

  return consumed;
}

function markdownKeysFromSource(
  source: string | string[] | undefined,
  rootName: 'block.props' | 'item'
): string[] {
  if (!source) {
    return [];
  }

  if (Array.isArray(source)) {
    return source.flatMap((item) => markdownKeysFromSource(item, rootName));
  }

  const prefix = `${rootName}.`;
  if (!source.startsWith(prefix)) {
    return [];
  }

  const key = source.slice(prefix.length).split('.')[0];
  return key ? [key] : [];
}

function resolveMarkdownSourceValues(
  source: string,
  value: Record<string, unknown>,
  rootName: 'block.props' | 'item'
): Array<{ key: string; value: unknown }> {
  return markdownKeysFromSource(source, rootName).map((key) => ({
    key,
    value: value[key]
  }));
}

function normalizeToArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function taxonomySchemeIdForToken(token: string): string | undefined {
  const [prefix] = token.split(':', 1);
  if (!prefix) {
    return undefined;
  }

  return TAXONOMY_TOKEN_SCHEME_IDS[prefix];
}

export async function validateAssetFiles(documents: CanonicalDocument[]): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const document of documents) {
    for (const block of document.blocks) {
      if (block.kind !== 'asset') {
        continue;
      }

      try {
        await access(block.absolutePath, fsConstants.R_OK);
      } catch {
        issues.push({
          severity: 'error',
          code: 'asset.missing',
          documentId: document.sourceId,
          path: block.absolutePath,
          message: `Referenced asset does not exist: ${block.absolutePath}`
        });
      }
    }
  }

  return issues;
}

export async function validatePlannedAssetFiles(plans: MappedDocumentPlan[]): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const plan of plans) {
    for (const asset of plan.assets) {
      try {
        await access(asset.absolutePath, fsConstants.R_OK);
      } catch {
        issues.push({
          severity: 'error',
          code: 'asset.missing',
          documentId: plan.sourceId,
          path: asset.absolutePath,
          message: `Referenced asset does not exist: ${asset.absolutePath}`
        });
      }
    }
  }

  return issues;
}

export function validateEnvironmentSafety(
  environmentId: string | undefined,
  conventions: ConventionsConfig,
  allowNonSandbox: boolean
): ValidationIssue[] {
  if (!environmentId) {
    return [];
  }

  const allowed = conventions.sandboxes.allowedPrefixes.some((prefix) =>
    environmentId.startsWith(prefix)
  );

  if (!allowed && conventions.sandboxes.requireExplicitNonSandbox && !allowNonSandbox) {
    return [
      {
        severity: 'error',
        code: 'environment.unsafe',
        message: `Environment ${environmentId} does not match allowed sandbox prefixes (${conventions.sandboxes.allowedPrefixes.join(
          ', '
        )})`
      }
    ];
  }

  if (!allowed) {
    return [
      {
        severity: 'warning',
        code: 'environment.nonSandbox',
        message: `Environment ${environmentId} is outside the recommended sandbox prefixes`
      }
    ];
  }

  return [];
}

export function validateMappingAgainstDiscovery(
  componentMap: ComponentMapConfig,
  discovery: DiscoverySnapshot
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const contentTypes = new Map(discovery.contentTypes.map((item) => [item.id, item]));
  const documentType = contentTypes.get(componentMap.document.targetContentType);

  if (!documentType) {
    issues.push({
      severity: 'error',
      code: 'mapping.documentContentTypeMissing',
      message: `Document content type ${componentMap.document.targetContentType} does not exist`
    });
  }

  if (documentType) {
    issues.push(...validateFieldMappings(documentType, componentMap.document.fields, 'document'));
  }

  for (const [componentKey, component] of Object.entries(componentMap.components)) {
    issues.push(...validateComponentMapping(componentKey, component, contentTypes));
  }

  return issues;
}

export function validateTaxonomyMapAgainstSnapshot(
  taxonomyMap: TaxonomyMapConfig,
  snapshot: TaxonomySnapshot
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const conceptIds = new Set(snapshot.concepts.map((concept) => concept.id));

  for (const [token, mapping] of Object.entries(taxonomyMap.concepts)) {
    if (!conceptIds.has(mapping.conceptId)) {
      issues.push({
        severity: 'error',
        code: 'taxonomy.conceptMissing',
        path: token,
        message: `Mapped concept ID ${mapping.conceptId} does not exist in taxonomy snapshot for organization ${snapshot.organizationId}`
      });
    }
  }

  return issues;
}

export function validateMappedPlans(
  plans: MappedDocumentPlan[],
  discovery: DiscoverySnapshot,
  conventions: ConventionsConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entryIds = new Set<string>();
  const assetIds = new Set<string>();
  const entryContentTypes = new Map<string, string>();
  const contentTypes = new Map(discovery.contentTypes.map((item) => [item.id, item]));
  const existingTags = new Set(discovery.tags.map((tag) => tag.id));
  const sharedPlaceholderAssetId = conventions.assets.sharedPlaceholder?.enabled
    ? toContentfulResourceId(conventions.assets.sharedPlaceholder.assetId)
    : undefined;

  for (const plan of plans) {
    for (const asset of plan.assets) {
      if (!isValidContentfulResourceId(asset.assetId)) {
        issues.push({
          severity: 'error',
          code: 'asset.invalidId',
          documentId: plan.sourceId,
          path: asset.assetId,
          message: `Generated asset ID ${asset.assetId} is not a valid Contentful resource ID`
        });
      }

      if (assetIds.has(asset.assetId) && asset.assetId !== sharedPlaceholderAssetId) {
        issues.push({
          severity: 'error',
          code: 'asset.duplicateId',
          documentId: plan.sourceId,
          message: `Duplicate asset ID generated: ${asset.assetId}`
        });
      }
      assetIds.add(asset.assetId);
    }

    for (const entry of [...plan.childEntries, plan.parentEntry]) {
      if (!isValidContentfulResourceId(entry.entryId)) {
        issues.push({
          severity: 'error',
          code: 'entry.invalidId',
          documentId: plan.sourceId,
          path: entry.entryId,
          message: `Generated entry ID ${entry.entryId} is not a valid Contentful resource ID`
        });
      }

      if (entryIds.has(entry.entryId)) {
        issues.push({
          severity: 'error',
          code: 'entry.duplicateId',
          documentId: plan.sourceId,
          message: `Duplicate entry ID generated: ${entry.entryId}`
        });
      }
      entryIds.add(entry.entryId);
      entryContentTypes.set(entry.entryId, entry.contentType);
    }
  }

  for (const plan of plans) {
    if (!conventions.tags.createIfMissing) {
      for (const tag of plan.parentEntry.metadata.tags) {
        if (!existingTags.has(tag.sys.id)) {
          issues.push({
            severity: 'error',
            code: 'tag.missing',
            documentId: plan.sourceId,
            path: `${plan.parentEntry.entryId}.metadata.tags`,
            message: `Tag ${tag.sys.id} does not exist in the target environment`
          });
        }
      }
    }

    for (const entry of [...plan.childEntries, plan.parentEntry]) {
      const contentType = contentTypes.get(entry.contentType);
      if (!contentType) {
        issues.push({
          severity: 'error',
          code: 'entry.contentTypeMissing',
          documentId: plan.sourceId,
          message: `Mapped entry ${entry.entryId} targets missing content type ${entry.contentType}`
        });
        continue;
      }

      issues.push(...validateEntryAgainstContentType(entry, contentType, entryContentTypes, plan.sourceId));
    }
  }

  return issues;
}

function isValidContentfulResourceId(id: string): boolean {
  return CONTENTFUL_RESOURCE_ID_PATTERN.test(id);
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function validateFieldMappings(
  contentType: ContentTypeSnapshot,
  fields: Record<string, unknown>,
  scope: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fieldIds = new Set(contentType.fields.map((field) => field.id));

  for (const fieldId of Object.keys(fields)) {
    if (!fieldIds.has(fieldId)) {
      issues.push({
        severity: 'error',
        code: 'mapping.fieldMissing',
        path: `${scope}.${fieldId}`,
        message: `Field ${fieldId} does not exist on content type ${contentType.id}`
      });
    }
  }

  return issues;
}

function validateComponentMapping(
  scope: string,
  component: ComponentMapConfig['components'][string] | NonNullable<ComponentMapConfig['components'][string]['nestedEntries']>[string],
  contentTypes: Map<string, ContentTypeSnapshot>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const contentType = contentTypes.get(component.targetContentType);

  if (!contentType) {
    issues.push({
      severity: 'error',
      code: 'mapping.componentContentTypeMissing',
      path: scope,
      message: `Component ${scope} targets missing content type ${component.targetContentType}`
    });
    return issues;
  }

  issues.push(...validateFieldMappings(contentType, component.fields, scope));

  for (const [nestedKey, nestedComponent] of Object.entries(component.nestedEntries ?? {})) {
    issues.push(...validateComponentMapping(`${scope}.${nestedKey}`, nestedComponent, contentTypes));
  }

  return issues;
}

function validateEntryAgainstContentType(
  entry: PlannedEntry,
  contentType: ContentTypeSnapshot,
  entryContentTypes: Map<string, string>,
  documentId: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fieldMap = new Map(contentType.fields.map((field) => [field.id, field]));

  for (const field of contentType.fields) {
    const value = entry.fields[field.id]?.[entry.locale];
    if (field.required && value === undefined) {
      issues.push({
        severity: 'error',
        code: 'field.requiredMissing',
        documentId,
        path: `${entry.entryId}.${field.id}`,
        message: `Required field ${field.id} is missing on entry ${entry.entryId}`
      });
    }
  }

  for (const [fieldId, localizedValues] of Object.entries(entry.fields)) {
    const field = fieldMap.get(fieldId);
    if (!field) {
      issues.push({
        severity: 'error',
        code: 'field.notOnModel',
        documentId,
        path: `${entry.entryId}.${fieldId}`,
        message: `Field ${fieldId} is not present on content type ${entry.contentType}`
      });
      continue;
    }

    const value = localizedValues[entry.locale];
    issues.push(...validateFieldValue(entry.entryId, documentId, field, value, entryContentTypes));
  }

  return issues;
}

function validateFieldValue(
  entryId: string,
  documentId: string,
  field: ContentTypeFieldSnapshot,
  value: unknown,
  entryContentTypes: Map<string, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enumValidation = field.validations.find((validation) => {
    return Boolean(validation && typeof validation === 'object' && 'in' in (validation as Record<string, unknown>));
  }) as { in?: unknown[] } | undefined;

  if (enumValidation?.in && typeof value === 'string' && !enumValidation.in.includes(value)) {
    issues.push({
      severity: 'error',
      code: 'field.invalidEnum',
      documentId,
      path: `${entryId}.${field.id}`,
      message: `Value "${value}" is not permitted for ${field.id}`
    });
  }

  if (field.type === 'Symbol' && typeof value === 'string' && value.length > 255) {
    issues.push({
      severity: 'error',
      code: 'field.symbolTooLong',
      documentId,
      path: `${entryId}.${field.id}`,
      message: `Symbol field ${field.id} is ${value.length} characters; Contentful allows at most 255`
    });
  }

  const regexpValidation = field.validations.find((validation) => {
    return Boolean(
      validation &&
        typeof validation === 'object' &&
        'regexp' in (validation as Record<string, unknown>)
    );
  }) as { regexp?: { pattern?: unknown; flags?: unknown }; message?: unknown } | undefined;

  if (regexpValidation?.regexp?.pattern && typeof value === 'string' && value.trim() !== '') {
    const pattern = regexpValidation.regexp.pattern;
    const flags = regexpValidation.regexp.flags;
    if (typeof pattern === 'string') {
      const regexp = new RegExp(pattern, typeof flags === 'string' ? flags : undefined);
      if (!regexp.test(value)) {
        issues.push({
          severity: 'error',
          code: 'field.regexpMismatch',
          documentId,
          path: `${entryId}.${field.id}`,
          message:
            typeof regexpValidation.message === 'string'
              ? `Value for ${field.id} ${regexpValidation.message}`
              : `Value for ${field.id} does not match required format`
        });
      }
    }
  }

  if (field.type === 'Link' && field.linkType === 'Entry' && isLinkObject(value)) {
    const linkedType = entryContentTypes.get(value.sys.id);
    const allowed = extractLinkContentTypes(field.validations);
    if (allowed.length > 0 && linkedType && !allowed.includes(linkedType)) {
      issues.push({
        severity: 'error',
        code: 'field.linkConstraint',
        documentId,
        path: `${entryId}.${field.id}`,
        message: `Entry link ${value.sys.id} violates linkContentType validation for ${field.id}`
      });
    }
  }

  if (field.type === 'Array' && Array.isArray(value) && field.items?.linkType === 'Entry') {
    const allowed = extractLinkContentTypes(field.items.validations ?? []);
    for (const item of value) {
      if (!isLinkObject(item)) {
        continue;
      }
      const linkedType = entryContentTypes.get(item.sys.id);
      if (allowed.length > 0 && linkedType && !allowed.includes(linkedType)) {
        issues.push({
          severity: 'error',
          code: 'field.arrayLinkConstraint',
          documentId,
          path: `${entryId}.${field.id}`,
          message: `Entry link ${item.sys.id} violates array linkContentType validation for ${field.id}`
        });
      }
    }
  }

  return issues;
}

function extractLinkContentTypes(validations: unknown[]): string[] {
  const results: string[] = [];
  for (const validation of validations) {
    if (
      validation &&
      typeof validation === 'object' &&
      'linkContentType' in (validation as Record<string, unknown>) &&
      Array.isArray((validation as { linkContentType?: unknown }).linkContentType)
    ) {
      results.push(
        ...((validation as { linkContentType: unknown[] }).linkContentType.filter(
          (item): item is string => typeof item === 'string'
        ))
      );
    }
  }

  return results;
}

function isLinkObject(
  value: unknown
): value is { sys: { id: string; type: string; linkType: string } } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'sys' in value &&
      typeof (value as { sys?: { id?: string } }).sys?.id === 'string'
  );
}
