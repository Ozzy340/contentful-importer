import type { ContentfulContext } from './contentful-client.js';
import type {
  ContentTypeFieldSnapshot,
  ContentTypeSnapshot,
  DiscoverySnapshot,
  LocaleSnapshot
} from './types.js';

import { getTags } from './contentful-client.js';

export async function pullDiscoverySnapshot(
  context: ContentfulContext
): Promise<DiscoverySnapshot> {
  const [contentTypesResult, localesResult, environmentsResult, tags] = await Promise.all([
    context.environment.getContentTypes(),
    context.environment.getLocales(),
    context.space.getEnvironments(),
    getTags(context)
  ]);

  const contentTypes = ((contentTypesResult?.items ?? []) as any[]).map(mapContentType);
  const locales = ((localesResult?.items ?? []) as any[]).map(mapLocale);
  const environments = ((environmentsResult?.items ?? []) as any[]).map((environment) => ({
    id: environment.sys?.id ?? '',
    name: environment.name,
    status: environment.sys?.status?.sys?.id ?? environment.sys?.status ?? undefined
  }));

  return {
    generatedAt: new Date().toISOString(),
    spaceId: context.spaceId,
    environmentId: context.environmentId,
    environmentName: context.environment.name,
    contentTypes,
    locales,
    tags,
    environments
  };
}

export function renderDiscoveryMarkdown(snapshot: DiscoverySnapshot): string {
  const lines: string[] = [];
  lines.push('# Contentful Discovery Snapshot');
  lines.push('');
  lines.push(`- Generated at: ${snapshot.generatedAt}`);
  lines.push(`- Space ID: ${snapshot.spaceId}`);
  lines.push(`- Environment ID: ${snapshot.environmentId}`);
  lines.push(`- Environment name: ${snapshot.environmentName ?? 'n/a'}`);
  lines.push(`- Locales: ${snapshot.locales.map((locale) => locale.code).join(', ') || 'none'}`);
  lines.push(`- Tags: ${snapshot.tags.map((tag) => tag.id).join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Content Types');
  lines.push('');

  for (const contentType of snapshot.contentTypes) {
    lines.push(`### ${contentType.id}`);
    lines.push('');
    lines.push(`- Name: ${contentType.name}`);
    lines.push(`- Display field: ${contentType.displayField ?? 'n/a'}`);
    lines.push('');
    lines.push('| Field | Type | Required | Localized | Validations |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const field of contentType.fields) {
      lines.push(
        `| ${field.id} | ${field.type} | ${field.required ? 'yes' : 'no'} | ${field.localized ? 'yes' : 'no'} | ${renderValidationSummary(
          field
        )} |`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function mapContentType(contentType: any): ContentTypeSnapshot {
  return {
    id: contentType.sys?.id ?? '',
    name: contentType.name ?? '',
    displayField: contentType.displayField,
    description: contentType.description,
    metadataTaxonomySchemeIds: (contentType.metadata?.taxonomy ?? [])
      .map((item: any) => item?.sys?.id)
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0),
    fields: (contentType.fields ?? []).map(mapField)
  };
}

function mapField(field: any): ContentTypeFieldSnapshot {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    required: Boolean(field.required),
    localized: Boolean(field.localized),
    disabled: field.disabled,
    omitted: field.omitted,
    linkType: field.linkType,
    validations: field.validations ?? [],
    items: field.items
      ? {
          type: field.items.type,
          linkType: field.items.linkType,
          validations: field.items.validations ?? []
        }
      : undefined
  };
}

function mapLocale(locale: any): LocaleSnapshot {
  return {
    code: locale.code,
    name: locale.name,
    default: Boolean(locale.default)
  };
}

function renderValidationSummary(field: ContentTypeFieldSnapshot): string {
  const values = [...field.validations, ...(field.items?.validations ?? [])];
  if (values.length === 0) {
    return 'none';
  }

  return values
    .map((item) => JSON.stringify(item))
    .join('<br>');
}
