import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  basenameWithoutExt,
  padIndex,
  renderTemplate,
  resolvePath,
  slugify,
  toContentfulResourceId,
  toContentfulTagId
} from './ids.js';
import { createRichTextDocument } from './normalizer.js';
import type {
  BlockReferenceAssemblyConfig,
  CanonicalBlock,
  CanonicalDocument,
  ComponentFieldConfig,
  ComponentMapConfig,
  ComponentMappingConfig,
  ComponentReferenceAssemblyConfig,
  ConventionsConfig,
  DocumentFieldConfig,
  FieldMappingConfig,
  InlineAssetMappingConfig,
  MappedDocumentPlan,
  NestedEntryMappingConfig,
  NestedEntryReferenceFieldConfig,
  PlannedAsset,
  PlannedEntry
} from './types.js';

interface EntryNodeResult {
  rootEntry: PlannedEntry;
  entries: PlannedEntry[];
  assets: PlannedAsset[];
}

interface MappingContext {
  block?: CanonicalBlock;
  item?: unknown;
  document: CanonicalDocument;
  parentId: string;
  entryId: string;
  componentKey: string;
  collectionKey?: string;
  index: string;
  linkedAsset?: string;
  nestedEntryIdsByCollection?: Map<string, string[]>;
  fieldId?: string;
}

interface EntryNodeParams {
  mapping: ComponentMappingConfig | NestedEntryMappingConfig;
  mappingKey: string;
  block: CanonicalBlock;
  document: CanonicalDocument;
  conventions: ConventionsConfig;
  parentId: string;
  index: string;
  item?: unknown;
  collectionKey?: string;
}

export function mapCanonicalDocument(
  document: CanonicalDocument,
  conventions: ConventionsConfig,
  componentMap: ComponentMapConfig
): MappedDocumentPlan {
  const topLevelEntriesInOrder: Array<{
    block: CanonicalBlock;
    componentKey: string;
    entry: PlannedEntry;
    blockIndex: number;
  }> = [];
  const childEntries: PlannedEntry[] = [];
  const assets: PlannedAsset[] = [];

  document.blocks.forEach((block, blockIndex) => {
    const componentKey = getComponentKey(block);
    const componentConfig = componentMap.components[componentKey];

    if (!componentConfig) {
      throw new Error(
        `Unknown component mapping for "${componentKey}" in document ${document.sourceId}`
      );
    }

    const index = padIndex(blockIndex + 1, conventions.naming.childIndexPadding);
    const node = buildEntryNode({
      mapping: componentConfig,
      mappingKey: componentKey,
      block,
      document,
      conventions,
      parentId: document.target.entryId,
      index
    });

    topLevelEntriesInOrder.push({
      block,
      componentKey,
      entry: node.rootEntry,
      blockIndex
    });
    childEntries.push(...node.entries);
    assets.push(...node.assets);
  });

  const parentFields: Record<string, Record<string, unknown>> = {};
  for (const [fieldId, mapping] of Object.entries(componentMap.document.fields)) {
    if (isBlockReferenceAssembly(mapping)) {
      const includeKinds = new Set(mapping.includeKinds ?? ['richText', 'component', 'asset']);
      const includeComponents = mapping.includeComponents
        ? new Set(mapping.includeComponents)
        : undefined;
      const excludeComponents = mapping.excludeComponents
        ? new Set(mapping.excludeComponents)
        : undefined;

      const links = topLevelEntriesInOrder
        .filter(({ block, componentKey }) => {
          if (!includeKinds.has(block.kind)) {
            return false;
          }
          if (includeComponents && !includeComponents.has(componentKey)) {
            return false;
          }
          if (excludeComponents?.has(componentKey)) {
            return false;
          }
          return true;
        })
        .map(({ entry }) => toEntryLink(entry.entryId));

      parentFields[fieldId] = { [document.locale]: links };
      continue;
    }

    if (isComponentReferenceAssembly(mapping)) {
      const matched = topLevelEntriesInOrder.find(
        ({ componentKey }) => componentKey === mapping.component
      );

      if (matched) {
        parentFields[fieldId] = { [document.locale]: toEntryLink(matched.entry.entryId) };
      }
      continue;
    }

    const value = resolveMappedValue(mapping, {
      document,
      parentId: document.target.entryId,
      entryId: document.target.entryId,
      componentKey: 'document',
      index: padIndex(0, conventions.naming.childIndexPadding),
      fieldId
    });

    if (value !== undefined) {
      parentFields[fieldId] = { [document.locale]: value };
    }
  }

  const parentEntry: PlannedEntry = {
    entryId: document.target.entryId,
    contentType: componentMap.document.targetContentType,
    locale: document.locale,
    role: 'parent',
    fields: parentFields,
    metadata: {
      tags: document.metadata.tags.map((sourceTag) => ({
        sys: { type: 'Link', linkType: 'Tag', id: toContentfulTagId(sourceTag) }
      })),
      concepts: conventions.taxonomy.attachConcepts
        ? document.metadata.taxonomyConceptIds.map((conceptId) => ({
            sys: { type: 'Link', linkType: 'TaxonomyConcept', id: conceptId }
          }))
        : []
    },
    linkedEntryIds: childEntries.map((entry) => entry.entryId),
    linkedAssetIds: assets.map((asset) => asset.assetId)
  };

  return {
    sourceId: document.sourceId,
    sourcePath: document.sourcePath,
    locale: document.locale,
    parentEntry,
    childEntries,
    assets
  };
}

function buildEntryNode(params: EntryNodeParams): EntryNodeResult {
  const entryId = toContentfulResourceId(
    renderTemplate(
      params.mapping.entryIdPattern ?? params.conventions.naming.childEntryIdPattern,
      buildTemplateVariables(
        params.document,
        params.parentId,
        params.mappingKey,
        params.index,
        params.item,
        params.collectionKey
      )
    )
  );

  const assetPlan = buildInlineAssetPlan(
    params.mapping.asset,
    params.document,
    params.conventions,
    entryId,
    params.mappingKey,
    params.index,
    params.item,
    params.collectionKey
  );

  const nestedEntryIdsByCollection = new Map<string, string[]>();
  const nestedEntries: PlannedEntry[] = [];
  const nestedAssets: PlannedAsset[] = assetPlan ? [assetPlan] : [];

  for (const [collectionKey, nestedMapping] of Object.entries(params.mapping.nestedEntries ?? {})) {
    const items = normalizeToArray(
      resolveMappingSourceValue(nestedMapping.source, {
        block: params.block,
        item: params.item,
        document: params.document,
        parentId: params.parentId,
        entryId,
        componentKey: params.mappingKey,
        collectionKey: params.collectionKey,
        index: params.index
      })
    );

    const ids: string[] = [];
    items.forEach((item, itemIndex) => {
      const nestedIndex = padIndex(itemIndex + 1, params.conventions.naming.childIndexPadding);
      const nestedNode = buildEntryNode({
        mapping: nestedMapping,
        mappingKey: collectionKey,
        block: params.block,
        document: params.document,
        conventions: params.conventions,
        parentId: entryId,
        index: nestedIndex,
        item,
        collectionKey
      });

      ids.push(nestedNode.rootEntry.entryId);
      nestedEntries.push(...nestedNode.entries);
      nestedAssets.push(...nestedNode.assets);
    });

    nestedEntryIdsByCollection.set(collectionKey, ids);
  }

  const fields: Record<string, Record<string, unknown>> = {};
  const linkedAssetIds: string[] = assetPlan ? [assetPlan.assetId] : [];
  const linkedEntryIds: string[] = [];

  for (const [fieldId, mapping] of Object.entries(params.mapping.fields)) {
    let value: unknown;

    if (isNestedEntryReferenceField(mapping)) {
      const ids = nestedEntryIdsByCollection.get(mapping.collection) ?? [];
      value =
        mapping.strategy === 'nestedEntryLink'
          ? ids[0]
            ? toEntryLink(ids[0])
            : undefined
          : ids.map((id) => toEntryLink(id));
    } else {
      value = resolveMappedValue(mapping, {
        block: params.block,
        item: params.item,
        document: params.document,
        parentId: params.parentId,
        entryId,
        componentKey: params.mappingKey,
        collectionKey: params.collectionKey,
        index: params.index,
        linkedAsset: assetPlan?.assetId,
        nestedEntryIdsByCollection,
        fieldId
      });
    }

    if (value !== undefined) {
      fields[fieldId] = { [params.document.locale]: value };
      linkedAssetIds.push(...extractAssetIds(value));
      linkedEntryIds.push(...extractEntryIds(value));
    }
  }

  const rootEntry: PlannedEntry = {
    entryId,
    contentType: params.mapping.targetContentType,
    locale: params.document.locale,
    role: 'child',
    componentKey: params.mappingKey,
    fields,
    metadata: { tags: [], concepts: [] },
    linkedEntryIds: [...new Set([...linkedEntryIds, ...nestedEntries.map((entry) => entry.entryId)])],
    linkedAssetIds: [...new Set(linkedAssetIds)]
  };

  return {
    rootEntry,
    entries: [...nestedEntries, rootEntry],
    assets: nestedAssets
  };
}

function buildInlineAssetPlan(
  assetMapping: InlineAssetMappingConfig | undefined,
  document: CanonicalDocument,
  conventions: ConventionsConfig,
  parentId: string,
  componentKey: string,
  index: string,
  item: unknown,
  collectionKey?: string
): PlannedAsset | undefined {
  if (!assetMapping) {
    return undefined;
  }

  const sourceValue = resolveMappingSourceValue(assetMapping.source, {
    item,
    document,
    parentId,
    entryId: parentId,
    componentKey,
    collectionKey,
    index
  });

  if (typeof sourceValue !== 'string' || sourceValue.trim() === '') {
    return undefined;
  }

  const relativePath = sourceValue.trim();
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(path.dirname(document.sourcePath), relativePath);
  const sharedPlaceholder = conventions.assets.sharedPlaceholder;
  if (shouldUseSharedPlaceholder(sharedPlaceholder, absolutePath)) {
    const placeholderPath = path.isAbsolute(sharedPlaceholder.sourcePath)
      ? sharedPlaceholder.sourcePath
      : path.resolve(process.cwd(), sharedPlaceholder.sourcePath);

    return {
      assetId: toContentfulResourceId(sharedPlaceholder.assetId),
      absolutePath: placeholderPath,
      relativePath: sharedPlaceholder.sourcePath,
      contentType: inferMimeTypeFromPath(sharedPlaceholder.sourcePath),
      locale: document.locale,
      title: sharedPlaceholder.title ?? conventions.assets.titleFallback,
      description: sharedPlaceholder.description,
      fileName: path.basename(sharedPlaceholder.sourcePath)
    };
  }

  const templateVariables = {
    ...buildTemplateVariables(document, parentId, componentKey, index, item, collectionKey),
    basename: basenameWithoutExt(relativePath)
  };

  const altValue = assetMapping.altSource
    ? resolveMappingSourceValue(assetMapping.altSource, {
        item,
        document,
        parentId,
        entryId: parentId,
        componentKey,
        collectionKey,
        index
      })
    : undefined;
  const titleValue = assetMapping.titleSource
    ? resolveMappingSourceValue(assetMapping.titleSource, {
        item,
        document,
        parentId,
        entryId: parentId,
        componentKey,
        collectionKey,
        index
      })
    : undefined;
  const descriptionValue = assetMapping.descriptionSource
    ? resolveMappingSourceValue(assetMapping.descriptionSource, {
        item,
        document,
        parentId,
        entryId: parentId,
        componentKey,
        collectionKey,
        index
      })
    : undefined;

  const altText = typeof altValue === 'string' ? altValue : undefined;
  const titleText =
    typeof titleValue === 'string' && titleValue.trim() !== ''
      ? titleValue
      : altText ?? conventions.assets.titleFallback;

  return {
    assetId: toContentfulResourceId(
      renderTemplate(
        assetMapping.assetIdPattern ?? conventions.naming.assetIdPattern,
        templateVariables
      )
    ),
    absolutePath,
    relativePath,
    contentType: inferMimeTypeFromPath(relativePath),
    locale: document.locale,
    title: titleText,
    description: typeof descriptionValue === 'string' ? descriptionValue : altText,
    fileName: path.basename(relativePath)
  };
}

function shouldUseSharedPlaceholder(
  sharedPlaceholder: ConventionsConfig['assets']['sharedPlaceholder'],
  sourceAssetPath: string
): sharedPlaceholder is NonNullable<ConventionsConfig['assets']['sharedPlaceholder']> {
  if (!sharedPlaceholder?.enabled) {
    return false;
  }

  const mode = sharedPlaceholder.mode ?? 'all';
  return mode === 'all' || !existsSync(sourceAssetPath);
}

function getComponentKey(block: CanonicalBlock): string {
  if (block.kind === 'richText') {
    return 'richText';
  }

  if (block.kind === 'asset') {
    return 'asset';
  }

  return block.component;
}

function resolveMappedValue(
  mapping: FieldMappingConfig,
  context: MappingContext
): unknown {
  if (mapping.source === 'linkedAsset') {
    return context.linkedAsset ? toAssetLink(context.linkedAsset) : undefined;
  }

  const sourceValue = mapping.source
    ? resolveMappingSourceValue(mapping.source, context)
    : resolveSameNamedSourceValue(context);
  let value: unknown;

  if (
    sourceValue !== undefined &&
    sourceValue !== null &&
    sourceValue !== '' &&
    (mapping.prefix !== undefined || mapping.suffix !== undefined)
  ) {
    value = `${mapping.prefix ?? ''}${String(sourceValue)}${mapping.suffix ?? ''}`;
  } else if (mapping.template) {
    value = renderTemplate(
      mapping.template,
      {
        ...buildTemplateVariables(
          context.document,
          context.parentId,
          context.componentKey,
          context.index,
          context.item,
          context.collectionKey,
          context.entryId
        ),
        value: sourceValue
      }
    );
  } else if (mapping.source) {
    value = sourceValue;
  }

  if ((value === undefined || value === null) && 'default' in mapping) {
    value = mapping.default;
  }

  return applyTransform(value, mapping.transform);
}

function resolveSameNamedSourceValue(context: MappingContext): unknown {
  if (!context.fieldId) {
    return undefined;
  }

  if (context.item && typeof context.item === 'object' && context.fieldId in (context.item as Record<string, unknown>)) {
    return (context.item as Record<string, unknown>)[context.fieldId];
  }

  if (context.block?.kind === 'component' && context.fieldId in context.block.props) {
    return context.block.props[context.fieldId];
  }

  return undefined;
}

function resolveMappingSourceValue(source: string | string[], context: MappingContext): unknown {
  if (Array.isArray(source)) {
    for (const candidate of source) {
      const value = resolveMappingSourceValue(candidate, context);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    return undefined;
  }

  return resolvePath(
    {
      block: context.block,
      item: context.item,
      document: context.document,
      metadata: context.document.metadata,
      target: context.document.target,
      sourceId: context.document.sourceId
    },
    source
  );
}

function applyTransform(
  value: unknown,
  transform: FieldMappingConfig['transform']
): unknown {
  if (value === undefined || value === null || !transform) {
    return value;
  }

  switch (transform) {
    case 'slug':
      return slugify(String(value));
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'stringArray':
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    case 'richText':
      if (
        value &&
        typeof value === 'object' &&
        'nodeType' in (value as Record<string, unknown>) &&
        (value as { nodeType?: unknown }).nodeType === 'document'
      ) {
        return value;
      }
      if (Array.isArray(value)) {
        return createRichTextDocument(value.map((item) => String(item)).join('\n\n'));
      }
      return createRichTextDocument(String(value));
    default:
      return value;
  }
}

function buildTemplateVariables(
  document: CanonicalDocument,
  parentId: string,
  componentKey: string,
  index: string,
  item?: unknown,
  collectionKey?: string,
  entryId?: string
): Record<string, unknown> {
  return {
    sourceId: document.sourceId,
    parentId,
    entryId,
    component: componentKey,
    componentSlug: slugify(componentKey),
    collection: collectionKey,
    collectionSlug: collectionKey ? slugify(collectionKey) : undefined,
    contentType: document.target.contentType,
    documentTitle: document.metadata.title,
    documentSlug: document.metadata.slug,
    index,
    item,
    metadata: document.metadata,
    target: document.target
  };
}

function isBlockReferenceAssembly(
  value: DocumentFieldConfig
): value is BlockReferenceAssemblyConfig {
  return 'strategy' in value && value.strategy === 'blockReferences';
}

function isComponentReferenceAssembly(
  value: DocumentFieldConfig
): value is ComponentReferenceAssemblyConfig {
  return 'strategy' in value && value.strategy === 'componentReference';
}

function isNestedEntryReferenceField(
  value: ComponentFieldConfig
): value is NestedEntryReferenceFieldConfig {
  return (
    'strategy' in value &&
    (value.strategy === 'nestedEntryLink' || value.strategy === 'nestedEntryLinks')
  );
}

function toEntryLink(entryId: string) {
  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: entryId
    }
  };
}

function toAssetLink(assetId: string) {
  return {
    sys: {
      type: 'Link',
      linkType: 'Asset',
      id: assetId
    }
  };
}

function extractAssetIds(value: unknown): string[] {
  if (isLinkObject(value, 'Asset')) {
    return [value.sys.id];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractAssetIds(item));
  }

  return [];
}

function extractEntryIds(value: unknown): string[] {
  if (isLinkObject(value, 'Entry')) {
    return [value.sys.id];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEntryIds(item));
  }

  return [];
}

function isLinkObject(
  value: unknown,
  linkType: 'Entry' | 'Asset'
): value is { sys: { id: string; type: string; linkType: string } } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'sys' in value &&
      (value as { sys?: { type?: string; linkType?: string; id?: string } }).sys?.type === 'Link' &&
      (value as { sys?: { linkType?: string } }).sys?.linkType === linkType &&
      typeof (value as { sys?: { id?: string } }).sys?.id === 'string'
  );
}

function normalizeToArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function inferMimeTypeFromPath(assetPath: string): string {
  const extension = path.extname(assetPath).toLowerCase();
  switch (extension) {
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
