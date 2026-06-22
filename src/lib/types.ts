export type Primitive = string | number | boolean | null;

export interface ContentfulEntryLink {
  sys: {
    type: 'Link';
    linkType: 'Entry';
    id: string;
  };
}

export interface RuntimeEnv {
  CONTENTFUL_MANAGEMENT_TOKEN?: string;
  CONTENTFUL_SPACE_ID?: string;
  CONTENTFUL_ENVIRONMENT_ID?: string;
  CONTENTFUL_SOURCE_SPACE_ID?: string;
  CONTENTFUL_SOURCE_ENVIRONMENT_ID?: string;
  CONTENTFUL_TARGET_SPACE_ID?: string;
  CONTENTFUL_TARGET_ENVIRONMENT_ID?: string;
  CONTENTFUL_ORG_ID?: string;
  CONTENTFUL_HOST?: string;
  CONTENTFUL_HOST_UPLOAD?: string;
  CONTENTFUL_USE_CLI_EXPORT?: string;
  CONTENTFUL_CLI_BIN?: string;
  CONTENTFUL_ALLOW_NON_SANDBOX?: string;
  SMARTRECRUITERS_BASE_URL?: string;
  SMARTRECRUITERS_COMPANY_ID?: string;
  SMARTRECRUITERS_TOKEN?: string;
  SMARTRECRUITERS_TARGET_ENVIRONMENT_ID?: string;
  SMARTRECRUITERS_TEMPLATE_ENTRY_ID?: string;
  SMARTRECRUITERS_TEMPLATE_ENVIRONMENT_ID?: string;
  SMARTRECRUITERS_JOB_SLUG_PREFIX?: string;
  SMARTRECRUITERS_MANAGED_ENTRY_PREFIX?: string;
  SMARTRECRUITERS_PARENT_ENTRY_ID?: string;
  SMARTRECRUITERS_HERO_IMAGE_ENTRY_ID?: string;
  SMARTRECRUITERS_UAT_PARENT_ENTRY_ID?: string;
  SMARTRECRUITERS_UAT_IMAGE_ENTRY_ID?: string;
  SMARTRECRUITERS_MASTER_PARENT_ENTRY_ID?: string;
  SMARTRECRUITERS_MASTER_IMAGE_ENTRY_ID?: string;
}

export interface ConventionsConfig {
  defaults: {
    locale: string;
    documentContentType: string;
    defaultParent?: {
      enabled: boolean;
      entryId: string;
    };
  };
  naming: {
    parentEntryIdPattern: string;
    childEntryIdPattern: string;
    assetIdPattern: string;
    slugStyle: 'kebab';
    childIndexPadding: number;
  };
  sandboxes: {
    requireExplicitNonSandbox: boolean;
    allowedPrefixes: string[];
  };
  tags: {
    createIfMissing: boolean;
    namespaceSeparator: string;
  };
  taxonomy: {
    attachConcepts: boolean;
    requireMappings: boolean;
  };
  assets: {
    titleFallback: string;
    sharedPlaceholder?: {
      enabled: boolean;
      mode?: 'all' | 'missing-only';
      assetId: string;
      sourcePath: string;
      title?: string;
      description?: string;
    };
  };
  cli: {
    bin: string;
    exportConfigFile: string;
    exportFile: string;
    enableModelExport: boolean;
    enableTaxonomyExport: boolean;
    taxonomyExportCommand?: string;
  };
}

export interface FieldMappingConfig {
  source?: string | string[];
  template?: string;
  prefix?: string;
  suffix?: string;
  default?: unknown;
  transform?:
    | 'slug'
    | 'trim'
    | 'string'
    | 'number'
    | 'boolean'
    | 'stringArray'
    | 'richText';
  required?: boolean;
}

export interface BlockReferenceAssemblyConfig {
  strategy: 'blockReferences';
  includeKinds?: Array<'richText' | 'component' | 'asset'>;
  includeComponents?: string[];
  excludeComponents?: string[];
}

export interface ComponentReferenceAssemblyConfig {
  strategy: 'componentReference';
  component: string;
}

export interface NestedEntryReferenceFieldConfig {
  strategy: 'nestedEntryLink' | 'nestedEntryLinks';
  collection: string;
}

export interface InlineAssetMappingConfig {
  source: string;
  altSource?: string;
  titleSource?: string;
  descriptionSource?: string;
  assetIdPattern?: string;
}

export type ComponentFieldConfig = FieldMappingConfig | NestedEntryReferenceFieldConfig;

export interface NestedEntryMappingConfig {
  source: string;
  targetContentType: string;
  entryIdPattern?: string;
  asset?: InlineAssetMappingConfig;
  fields: Record<string, ComponentFieldConfig>;
  nestedEntries?: Record<string, NestedEntryMappingConfig>;
}

export type DocumentFieldConfig =
  | FieldMappingConfig
  | BlockReferenceAssemblyConfig
  | ComponentReferenceAssemblyConfig;

export interface DocumentMappingConfig {
  targetContentType: string;
  entryIdPattern?: string;
  fields: Record<string, DocumentFieldConfig>;
}

export interface ComponentMappingConfig {
  targetContentType: string;
  entryIdPattern?: string;
  asset?: InlineAssetMappingConfig;
  fields: Record<string, ComponentFieldConfig>;
  nestedEntries?: Record<string, NestedEntryMappingConfig>;
}

export interface ComponentMapConfig {
  document: DocumentMappingConfig;
  components: Record<string, ComponentMappingConfig>;
}

export interface TaxonomyMapConfig {
  concepts: Record<
    string,
    {
      conceptId: string;
      description?: string;
    }
  >;
}

export interface TaxonomySchemeSnapshot {
  id: string;
  prefLabel: string;
  definition?: string;
  topConceptIds: string[];
  conceptIds: string[];
  totalConcepts: number;
}

export interface TaxonomyConceptSnapshot {
  id: string;
  prefLabel: string;
  altLabels: string[];
  definition?: string;
  notations: string[];
  broaderIds: string[];
  relatedIds: string[];
  schemeIds: string[];
}

export interface TaxonomySnapshot {
  generatedAt: string;
  organizationId: string;
  schemes: TaxonomySchemeSnapshot[];
  concepts: TaxonomyConceptSnapshot[];
}

export interface LocaleSnapshot {
  code: string;
  name: string;
  default: boolean;
}

export type ContentfulTagVisibility = 'private' | 'public';

export interface TagSnapshot {
  id: string;
  name: string;
  visibility?: ContentfulTagVisibility;
}

export interface ContentTypeFieldSnapshot {
  id: string;
  name: string;
  type: string;
  required: boolean;
  localized: boolean;
  disabled?: boolean;
  omitted?: boolean;
  linkType?: string;
  validations: unknown[];
  items?: {
    type?: string;
    linkType?: string;
    validations?: unknown[];
  };
}

export interface ContentTypeSnapshot {
  id: string;
  name: string;
  displayField?: string;
  description?: string;
  metadataTaxonomySchemeIds?: string[];
  fields: ContentTypeFieldSnapshot[];
}

export interface DiscoverySnapshot {
  generatedAt: string;
  spaceId: string;
  environmentId: string;
  environmentName?: string;
  contentTypes: ContentTypeSnapshot[];
  locales: LocaleSnapshot[];
  tags: TagSnapshot[];
  environments: Array<{
    id: string;
    name?: string;
    status?: string;
  }>;
}

export type ParsedBlock =
  | {
      type: 'text';
      order: number;
      text: string;
    }
  | {
      type: 'component';
      order: number;
      component: string;
      props: Record<string, unknown>;
      sourceComponent?: string;
      sourceProps?: Record<string, unknown>;
    }
  | {
      type: 'asset';
      order: number;
      path: string;
      absolutePath: string;
      alt?: string;
    };

export interface ParsedDocument {
  sourcePath: string;
  sourceId: string;
  internalName?: string;
  title: string;
  heading?: string;
  slug?: string;
  locale?: string;
  contentType?: string;
  metaTitle?: string;
  metaDescription?: string;
  finalizedUrl?: string;
  parent?: ContentfulEntryLink;
  tags: string[];
  taxonomyTokens: string[];
  blocks: ParsedBlock[];
}

export type CanonicalBlock =
  | {
      kind: 'richText';
      body: ContentfulRichTextDocument;
    }
  | {
      kind: 'component';
      component: string;
      props: Record<string, unknown>;
    }
  | {
      kind: 'asset';
      path: string;
      absolutePath: string;
      alt?: string;
    };

export interface CanonicalDocument {
  sourceId: string;
  sourcePath: string;
  locale: string;
  target: {
    contentType: string;
    entryId: string;
  };
  metadata: {
    title: string;
    internalName?: string;
    heading: string;
    slug?: string;
    metaTitle?: string;
    metaDescription?: string;
    finalizedUrl?: string;
    parent?: ContentfulEntryLink;
    tags: string[];
    taxonomyConceptIds: string[];
    sourceTaxonomyTokens: string[];
  };
  blocks: CanonicalBlock[];
}

export interface ContentfulRichTextNode {
  nodeType: string;
  data: Record<string, unknown>;
  content?: ContentfulRichTextNode[];
  value?: string;
  marks?: Array<Record<string, unknown>>;
}

export interface ContentfulRichTextDocument {
  nodeType: 'document';
  data: Record<string, unknown>;
  content: ContentfulRichTextNode[];
}

export interface PlannedAsset {
  assetId: string;
  absolutePath: string;
  relativePath: string;
  contentType: string;
  locale: string;
  title: string;
  description?: string;
  fileName: string;
}

export interface PlannedEntry {
  entryId: string;
  contentType: string;
  locale: string;
  role: 'parent' | 'child';
  componentKey?: string;
  fields: Record<string, Record<string, unknown>>;
  metadata: {
    tags: Array<{ sys: { type: 'Link'; linkType: 'Tag'; id: string } }>;
    concepts: Array<{ sys: { type: 'Link'; linkType: 'TaxonomyConcept'; id: string } }>;
  };
  linkedEntryIds: string[];
  linkedAssetIds: string[];
}

export interface MappedDocumentPlan {
  sourceId: string;
  sourcePath: string;
  locale: string;
  parentEntry: PlannedEntry;
  childEntries: PlannedEntry[];
  assets: PlannedAsset[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  documentId?: string;
  path?: string;
  details?: unknown;
}

export interface ValidationReport {
  generatedAt: string;
  issues: ValidationIssue[];
}

export interface RunSummary {
  completed: number;
  failed: number;
  skipped: number;
  createdEntries: number;
  updatedEntries: number;
  createdAssets: number;
  updatedAssets: number;
  publishedEntries: number;
  publishedAssets: number;
  deletedEntries: number;
  deletedAssets: number;
}

export interface DocumentRunState {
  sourceId: string;
  sourcePath: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  reason?: string;
  startedAt?: string;
  finishedAt?: string;
  entryIds: string[];
  assetIds: string[];
}

export interface RunState {
  runId: string;
  mode: 'parse' | 'dry-run' | 'upload' | 'publish' | 'delete';
  environmentId?: string;
  startedAt: string;
  finishedAt?: string;
  summary: RunSummary;
  documents: Record<string, DocumentRunState>;
}

export interface CliFlags {
  [key: string]: string | boolean | undefined;
}

export interface ProjectPaths {
  root: string;
  configDir: string;
  exportsDir: string;
  sourceDocsDir: string;
  sourceAssetsDir: string;
  buildNormalizedDir: string;
  buildReportsDir: string;
  buildStateDir: string;
}

export interface LoadedProjectConfig {
  env: RuntimeEnv;
  paths: ProjectPaths;
  conventions: ConventionsConfig;
  componentMap: ComponentMapConfig;
  taxonomyMap: TaxonomyMapConfig;
}

export interface OperationIntent {
  entryId: string;
  contentType: string;
  role: 'parent' | 'child';
  action: 'create' | 'update';
}

export interface AssetIntent {
  assetId: string;
  action: 'create' | 'update';
}

export interface DryRunSummary {
  generatedAt: string;
  environmentId?: string;
  documentCount: number;
  operations: {
    entries: OperationIntent[];
    assets: AssetIntent[];
  };
  validation: ValidationIssue[];
}
