import contentfulManagement from 'contentful-management';

import { requireEnv } from './config.js';
import type { ContentfulTagVisibility, ConventionsConfig, RuntimeEnv } from './types.js';

export interface ContentfulContext {
  client: any;
  space: any;
  environment: any;
  environmentId: string;
  spaceId: string;
}

export interface ContentfulSpaceContext {
  client: any;
  space: any;
  spaceId: string;
}

export interface ContentfulClientOptions {
  throttle?: number | 'auto' | `${number}%`;
}

export interface ContentfulTagResource {
  id: string;
  name: string;
  visibility?: ContentfulTagVisibility;
  version?: number;
}

export async function createContentfulSpaceContext(
  env: RuntimeEnv,
  options: ContentfulClientOptions = {}
): Promise<ContentfulSpaceContext> {
  const required = requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);
  const client = contentfulManagement.createClient({
    accessToken: required.CONTENTFUL_MANAGEMENT_TOKEN,
    host: env.CONTENTFUL_HOST,
    hostUpload: env.CONTENTFUL_HOST_UPLOAD,
    throttle: options.throttle
  });
  const space = await client.getSpace(required.CONTENTFUL_SPACE_ID);

  return {
    client,
    space,
    spaceId: required.CONTENTFUL_SPACE_ID
  };
}

export async function createContentfulContext(
  env: RuntimeEnv,
  options: ContentfulClientOptions = {}
): Promise<ContentfulContext> {
  const required = requireEnv(env, ['CONTENTFUL_ENVIRONMENT_ID']);
  const base = await createContentfulSpaceContext(env, options);
  const environment = await base.space.getEnvironment(required.CONTENTFUL_ENVIRONMENT_ID);

  return {
    client: base.client,
    space: base.space,
    environment,
    environmentId: required.CONTENTFUL_ENVIRONMENT_ID,
    spaceId: base.spaceId
  };
}

export function assertSafeEnvironment(
  environmentId: string,
  conventions: ConventionsConfig,
  allowNonSandbox: boolean
): void {
  const allowed = conventions.sandboxes.allowedPrefixes.some((prefix) =>
    environmentId.startsWith(prefix)
  );

  if (!allowed && conventions.sandboxes.requireExplicitNonSandbox && !allowNonSandbox) {
    throw new Error(
      `Environment ${environmentId} is not a sandbox-like environment. Re-run with --allow-non-sandbox only after review.`
    );
  }
}

export async function getEntryIfExists(context: ContentfulContext, entryId: string): Promise<any | undefined> {
  try {
    return await context.environment.getEntry(entryId);
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function getExistingEntryIds(
  context: ContentfulContext,
  entryIds: string[],
  batchSize = 100
): Promise<Set<string>> {
  const existing = new Set<string>();
  const uniqueIds = [...new Set(entryIds)].filter(Boolean);

  for (const batch of chunk(uniqueIds, batchSize)) {
    const response = await context.environment.getEntries({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    for (const item of response.items ?? []) {
      const id = item?.sys?.id;
      if (typeof id === 'string') {
        existing.add(id);
      }
    }
  }

  return existing;
}

export async function getAssetIfExists(context: ContentfulContext, assetId: string): Promise<any | undefined> {
  try {
    return await context.environment.getAsset(assetId);
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function getExistingAssetIds(
  context: ContentfulContext,
  assetIds: string[],
  batchSize = 100
): Promise<Set<string>> {
  const existing = new Set<string>();
  const uniqueIds = [...new Set(assetIds)].filter(Boolean);

  for (const batch of chunk(uniqueIds, batchSize)) {
    const response = await context.environment.getAssets({
      'sys.id[in]': batch.join(','),
      limit: batch.length
    });
    for (const item of response.items ?? []) {
      const id = item?.sys?.id;
      if (typeof id === 'string') {
        existing.add(id);
      }
    }
  }

  return existing;
}

export async function getTags(context: ContentfulContext): Promise<ContentfulTagResource[]> {
  const results: ContentfulTagResource[] = [];
  const limit = 100;
  let skip = 0;
  let total = 0;

  do {
    const response = await context.client.rawRequest({
      method: 'GET',
      url: `/spaces/${context.spaceId}/environments/${context.environmentId}/tags`,
      params: {
        limit,
        skip
      }
    });

    const payload = unwrapRawResponse(response) as RawContentfulTagCollection;
    const items = (payload.items ?? []) as RawContentfulTag[];

    results.push(
      ...items
        .map(mapContentfulTag)
        .filter((item): item is ContentfulTagResource => Boolean(item))
    );

    total = Number(payload.total ?? 0);
    skip += limit;
  } while (skip < total);

  return results;
}

export async function getTagIfExists(
  context: ContentfulContext,
  tagId: string
): Promise<ContentfulTagResource | undefined> {
  try {
    const response = await context.client.rawRequest({
      method: 'GET',
      url: `/spaces/${context.spaceId}/environments/${context.environmentId}/tags/${tagId}`
    });

    return mapContentfulTag(unwrapRawResponse(response) as RawContentfulTag);
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function createTag(
  context: ContentfulContext,
  tagId: string,
  name: string,
  visibility: ContentfulTagVisibility = 'public'
): Promise<'created' | 'existing'> {
  try {
    await context.client.rawRequest({
      method: 'PUT',
      url: `/spaces/${context.spaceId}/environments/${context.environmentId}/tags/${tagId}`,
      data: { name, sys: { visibility } },
      headers: {
        'X-Contentful-Tag-Visibility': visibility
      }
    });
    return 'created';
  } catch (error) {
    if (isVersionMismatchError(error)) {
      return 'existing';
    }

    throw error;
  }
}

export async function updateTag(
  context: ContentfulContext,
  tagId: string,
  input: { name: string; version: number }
): Promise<ContentfulTagResource> {
  const response = await context.client.rawRequest({
    method: 'PUT',
    url: `/spaces/${context.spaceId}/environments/${context.environmentId}/tags/${tagId}`,
    data: { name: input.name },
    headers: {
      'X-Contentful-Version': input.version
    }
  });

  const tag = mapContentfulTag(unwrapRawResponse(response) as RawContentfulTag);
  if (!tag) {
    throw new Error(`Contentful returned an invalid tag payload for ${tagId}`);
  }

  return tag;
}

export async function deleteTag(
  context: ContentfulContext,
  tagId: string,
  version: number
): Promise<void> {
  await context.client.rawRequest({
    method: 'DELETE',
    url: `/spaces/${context.spaceId}/environments/${context.environmentId}/tags/${tagId}`,
    headers: {
      'X-Contentful-Version': version
    }
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

interface RawContentfulTag {
  sys?: {
    id?: string;
    version?: number;
    visibility?: string;
  };
  name?: string;
  visibility?: string;
}

interface RawContentfulTagCollection {
  items?: RawContentfulTag[];
  total?: number;
}

function unwrapRawResponse(response: unknown): unknown {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (response as { data?: unknown }).data !== undefined
  ) {
    return (response as { data?: unknown }).data;
  }

  return response;
}

function mapContentfulTag(item: RawContentfulTag | undefined): ContentfulTagResource | undefined {
  if (!item?.sys?.id || !item.name) {
    return undefined;
  }

  return {
    id: item.sys.id,
    name: item.name,
    visibility: parseTagVisibility(item.sys.visibility ?? item.visibility),
    version: typeof item.sys.version === 'number' ? item.sys.version : undefined
  };
}

function parseTagVisibility(value: string | undefined): ContentfulTagVisibility | undefined {
  if (value === 'private' || value === 'public') {
    return value;
  }

  return undefined;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number | string;
    name?: string;
    message?: string;
    sys?: { id?: string };
    response?: {
      status?: number | string;
      data?: {
        sys?: { id?: string };
        message?: string;
      };
    };
  };

  const directStatus = normalizeStatusCode(candidate.status);
  const responseStatus = normalizeStatusCode(candidate.response?.status);

  if (directStatus === 404 || responseStatus === 404) {
    return true;
  }

  if (candidate.name === 'NotFound' || candidate.sys?.id === 'NotFound') {
    return true;
  }

  if (candidate.response?.data?.sys?.id === 'NotFound') {
    return true;
  }

  const messages = [
    candidate.message,
    candidate.response?.data?.message
  ].filter((value): value is string => typeof value === 'string');

  return messages.some((message) =>
    /resource could not be found|not found/i.test(message)
  );
}

function isVersionMismatchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number | string;
    name?: string;
    message?: string;
    sys?: { id?: string };
    response?: {
      status?: number | string;
      data?: {
        sys?: { id?: string };
        message?: string;
      };
    };
  };

  const directStatus = normalizeStatusCode(candidate.status);
  const responseStatus = normalizeStatusCode(candidate.response?.status);

  if (directStatus === 409 || responseStatus === 409) {
    return true;
  }

  if (candidate.name === 'VersionMismatch' || candidate.sys?.id === 'VersionMismatch') {
    return true;
  }

  if (candidate.response?.data?.sys?.id === 'VersionMismatch') {
    return true;
  }

  const messages = [
    candidate.message,
    candidate.response?.data?.message
  ].filter((value): value is string => typeof value === 'string');

  return messages.some((message) => /version mismatch/i.test(message));
}

function normalizeStatusCode(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}
