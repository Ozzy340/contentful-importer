import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import dotenv from 'dotenv';
import yaml from 'js-yaml';
import { z } from 'zod';

import type {
  CliFlags,
  ComponentMapConfig,
  ComponentFieldConfig,
  ConventionsConfig,
  LoadedProjectConfig,
  NestedEntryMappingConfig,
  ProjectPaths,
  RuntimeEnv,
  TaxonomyMapConfig
} from './types.js';

const conventionsSchema: z.ZodType<ConventionsConfig> = z.object({
  defaults: z.object({
    locale: z.string().min(1),
    documentContentType: z.string().min(1),
    defaultParent: z
      .object({
        enabled: z.boolean(),
        entryId: z.string().min(1)
      })
      .optional()
  }),
  naming: z.object({
    parentEntryIdPattern: z.string().min(1),
    childEntryIdPattern: z.string().min(1),
    assetIdPattern: z.string().min(1),
    slugStyle: z.literal('kebab'),
    childIndexPadding: z.number().int().positive()
  }),
  sandboxes: z.object({
    requireExplicitNonSandbox: z.boolean(),
    allowedPrefixes: z.array(z.string().min(1)).min(1)
  }),
  tags: z.object({
    createIfMissing: z.boolean(),
    namespaceSeparator: z.string().min(1)
  }),
  taxonomy: z.object({
    attachConcepts: z.boolean(),
    requireMappings: z.boolean()
  }),
  assets: z.object({
    titleFallback: z.string().min(1),
    sharedPlaceholder: z
      .object({
        enabled: z.boolean(),
        mode: z.enum(['all', 'missing-only']).optional(),
        assetId: z.string().min(1),
        sourcePath: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional()
      })
      .optional()
  }),
  cli: z.object({
    bin: z.string().min(1),
    exportConfigFile: z.string().min(1),
    exportFile: z.string().min(1),
    enableModelExport: z.boolean(),
    enableTaxonomyExport: z.boolean(),
    taxonomyExportCommand: z.string().optional()
  })
});

const fieldMappingSchema = z.object({
  source: z.union([z.string(), z.array(z.string().min(1)).min(1)]).optional(),
  template: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  default: z.unknown().optional(),
  transform: z
    .enum(['slug', 'trim', 'string', 'number', 'boolean', 'stringArray', 'richText'])
    .optional(),
  required: z.boolean().optional()
}).strict();

const blockReferenceSchema = z.object({
  strategy: z.literal('blockReferences'),
  includeKinds: z.array(z.enum(['richText', 'component', 'asset'])).optional(),
  includeComponents: z.array(z.string().min(1)).optional(),
  excludeComponents: z.array(z.string().min(1)).optional()
}).strict();

const componentReferenceSchema = z.object({
  strategy: z.literal('componentReference'),
  component: z.string().min(1)
}).strict();

const nestedEntryReferenceFieldSchema = z.object({
  strategy: z.enum(['nestedEntryLink', 'nestedEntryLinks']),
  collection: z.string().min(1)
}).strict();

const inlineAssetSchema = z.object({
  source: z.string().min(1),
  altSource: z.string().optional(),
  titleSource: z.string().optional(),
  descriptionSource: z.string().optional(),
  assetIdPattern: z.string().optional()
}).strict();

const documentFieldSchema = z.union([
  blockReferenceSchema,
  componentReferenceSchema,
  fieldMappingSchema
]);

const componentFieldSchema: z.ZodType<ComponentFieldConfig> = z.union([
  nestedEntryReferenceFieldSchema,
  fieldMappingSchema
]);

const nestedEntrySchema: z.ZodType<NestedEntryMappingConfig> = z.lazy(() =>
  z.object({
    source: z.string().min(1),
    targetContentType: z.string().min(1),
    entryIdPattern: z.string().optional(),
    asset: inlineAssetSchema.optional(),
    fields: z.record(z.string(), componentFieldSchema),
    nestedEntries: z.record(z.string(), nestedEntrySchema).optional()
  })
);

const componentMapSchema: z.ZodType<ComponentMapConfig> = z.object({
  document: z.object({
    targetContentType: z.string().min(1),
    entryIdPattern: z.string().optional(),
    fields: z.record(z.string(), documentFieldSchema)
  }),
  components: z.record(
    z.string(),
    z.object({
      targetContentType: z.string().min(1),
      entryIdPattern: z.string().optional(),
      asset: inlineAssetSchema.optional(),
      fields: z.record(z.string(), componentFieldSchema),
      nestedEntries: z.record(z.string(), nestedEntrySchema).optional()
    })
  )
});

const taxonomyMapSchema: z.ZodType<TaxonomyMapConfig> = z.object({
  concepts: z.record(
    z.string(),
    z.object({
      conceptId: z.string().min(1),
      description: z.string().optional()
    })
  )
});

export function parseCliFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) {
      continue;
    }

    const rawKey = token.slice(2);
    const equalsIndex = rawKey.indexOf('=');
    if (equalsIndex >= 0) {
      const key = rawKey.slice(0, equalsIndex);
      const value = rawKey.slice(equalsIndex + 1);
      flags[key] = value || true;
      continue;
    }

    const key = rawKey;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

export function loadEnv(): RuntimeEnv {
  dotenv.config();
  return process.env as RuntimeEnv;
}

export function resolveProjectPaths(root = process.cwd()): ProjectPaths {
  return {
    root,
    configDir: path.join(root, 'config'),
    exportsDir: path.join(root, 'exports'),
    sourceDocsDir: path.join(root, 'source', 'docs'),
    sourceAssetsDir: path.join(root, 'source', 'assets'),
    buildNormalizedDir: path.join(root, 'build', 'normalized'),
    buildReportsDir: path.join(root, 'build', 'reports'),
    buildStateDir: path.join(root, 'build', 'state')
  };
}

export async function loadYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf8');
  const parsed = yaml.load(content);
  return schema.parse(parsed);
}

export async function loadProjectConfig(root = process.cwd()): Promise<LoadedProjectConfig> {
  const env = loadEnv();
  const paths = resolveProjectPaths(root);
  const conventions = await loadYamlFile(
    resolveConfigPath(paths.configDir, 'conventions'),
    conventionsSchema
  );
  const componentMap = await loadYamlFile(
    resolveConfigPath(paths.configDir, 'component-map'),
    componentMapSchema
  );
  const taxonomyMap = await loadYamlFile(
    resolveConfigPath(paths.configDir, 'taxonomy-map'),
    taxonomyMapSchema
  );

  return {
    env,
    paths,
    conventions,
    componentMap,
    taxonomyMap
  };
}

function resolveConfigPath(configDir: string, baseName: string): string {
  const preferred = path.join(configDir, `${baseName}.yml`);
  if (existsSync(preferred)) {
    return preferred;
  }

  return path.join(configDir, `${baseName}.example.yml`);
}

export function requireEnv<K extends keyof RuntimeEnv>(
  env: RuntimeEnv,
  keys: K[]
): { [P in K]-?: string } {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return Object.fromEntries(keys.map((key) => [key, env[key] as string])) as {
    [P in K]-?: string;
  };
}
