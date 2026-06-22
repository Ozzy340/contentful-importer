import {
  createTag,
  getTagIfExists,
  updateTag
} from './contentful-client.js';
import type { ContentfulContext, ContentfulTagResource } from './contentful-client.js';
import { toContentfulTagId } from './ids.js';
import type { ContentfulTagId } from './ids.js';
import type { ContentfulTagVisibility } from './types.js';

declare const tagGroupNameBrand: unique symbol;
declare const tagValueBrand: unique symbol;

export type TagGroupName = string & {
  readonly [tagGroupNameBrand]: 'TagGroupName';
};

export type TagValue = string & {
  readonly [tagValueBrand]: 'TagValue';
};

export interface GroupedTagDefinition {
  id: ContentfulTagId;
  name: string;
  group: TagGroupName;
  tag: TagValue;
  visibility: ContentfulTagVisibility;
}

export type GroupedTagUpsertAction =
  | 'would-create'
  | 'created'
  | 'existing'
  | 'would-update-name'
  | 'updated-name'
  | 'name-conflict';

export interface GroupedTagUpsertResult {
  definition: GroupedTagDefinition;
  action: GroupedTagUpsertAction;
  existing?: ContentfulTagResource;
  updated?: ContentfulTagResource;
  warnings: string[];
}

export interface GroupedTagInput {
  group: string;
  tag: string;
  separator: string;
  visibility?: ContentfulTagVisibility;
}

export interface GroupedTagUpsertOptions {
  dryRun: boolean;
  updateExistingName: boolean;
}

export const DEFAULT_CONTENTFUL_TAG_VISIBILITY: ContentfulTagVisibility = 'public';

export function buildGroupedTagDefinition(input: GroupedTagInput): GroupedTagDefinition {
  const group = toTagGroupName(input.group);
  const tag = toTagValue(input.tag);
  const separator = normalizeSeparator(input.separator);
  const name = `${group}${separator} ${tag}`;

  return {
    id: toContentfulTagId(`${group}${separator}${tag}`),
    name,
    group,
    tag,
    visibility: input.visibility ?? DEFAULT_CONTENTFUL_TAG_VISIBILITY
  };
}

export function parseContentfulTagVisibility(
  value: unknown,
  fallback: ContentfulTagVisibility = DEFAULT_CONTENTFUL_TAG_VISIBILITY
): ContentfulTagVisibility {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (value === 'private' || value === 'public') {
    return value;
  }

  throw new Error('Tag visibility must be either "private" or "public".');
}

export async function upsertGroupedTag(
  context: ContentfulContext,
  input: GroupedTagInput,
  options: GroupedTagUpsertOptions
): Promise<GroupedTagUpsertResult> {
  const definition = buildGroupedTagDefinition(input);
  const warnings: string[] = [];
  const existing = await getTagIfExists(context, definition.id);

  if (!existing) {
    if (options.dryRun) {
      return { definition, action: 'would-create', warnings };
    }

    const createResult = await createTag(
      context,
      definition.id,
      definition.name,
      definition.visibility
    );

    if (createResult === 'existing') {
      const refreshed = await getTagIfExists(context, definition.id);
      return { definition, action: 'existing', existing: refreshed, warnings };
    }

    return { definition, action: 'created', warnings };
  }

  if (existing.visibility && existing.visibility !== definition.visibility) {
    warnings.push(
      `Existing tag visibility is ${existing.visibility}; requested ${definition.visibility}. Visibility was left unchanged.`
    );
  }

  if (existing.name === definition.name) {
    return { definition, action: 'existing', existing, warnings };
  }

  if (!options.updateExistingName) {
    warnings.push(
      `Tag ID ${definition.id} already exists with name "${existing.name}". Re-run with --update-existing-name to rename it to "${definition.name}".`
    );
    return { definition, action: 'name-conflict', existing, warnings };
  }

  if (options.dryRun) {
    return { definition, action: 'would-update-name', existing, warnings };
  }

  if (typeof existing.version !== 'number') {
    throw new Error(`Cannot update tag ${definition.id}; Contentful did not return its version.`);
  }

  const updated = await updateTag(context, definition.id, {
    name: definition.name,
    version: existing.version
  });

  return { definition, action: 'updated-name', existing, updated, warnings };
}

function toTagGroupName(value: string): TagGroupName {
  return requireNonEmpty(value, 'tag group') as TagGroupName;
}

function toTagValue(value: string): TagValue {
  return requireNonEmpty(value, 'tag') as TagValue;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Missing ${label}.`);
  }

  return trimmed;
}

function normalizeSeparator(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Tag group separator cannot be empty.');
  }

  return trimmed;
}
