import { getAssetIfExists, getEntryIfExists } from './contentful-client.js';
import type { ContentfulContext } from './contentful-client.js';

export interface DeleteResult {
  id: string;
  action: 'deleted' | 'missing' | 'would-delete';
}

export async function deleteEntries(
  context: ContentfulContext,
  entryIds: string[],
  options: { dryRun: boolean; chunkSize?: number }
): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  const uniqueIds = [...new Set(entryIds)].filter(Boolean);

  for (const chunk of chunkArray(uniqueIds, options.chunkSize ?? 10)) {
    for (const entryId of chunk) {
      if (options.dryRun) {
        results.push({ id: entryId, action: 'would-delete' });
        continue;
      }

      const entry = await getEntryIfExists(context, entryId);
      if (!entry) {
        results.push({ id: entryId, action: 'missing' });
        continue;
      }

      if (typeof entry.isPublished === 'function' && entry.isPublished()) {
        await entry.unpublish();
      }

      await entry.delete();
      results.push({ id: entryId, action: 'deleted' });
    }
  }

  return results;
}

export async function deleteAssets(
  context: ContentfulContext,
  assetIds: string[],
  options: { dryRun: boolean; chunkSize?: number }
): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  const uniqueIds = [...new Set(assetIds)].filter(Boolean);

  for (const chunk of chunkArray(uniqueIds, options.chunkSize ?? 10)) {
    for (const assetId of chunk) {
      if (options.dryRun) {
        results.push({ id: assetId, action: 'would-delete' });
        continue;
      }

      const asset = await getAssetIfExists(context, assetId);
      if (!asset) {
        results.push({ id: assetId, action: 'missing' });
        continue;
      }

      if (typeof asset.isPublished === 'function' && asset.isPublished()) {
        await asset.unpublish();
      }

      await asset.delete();
      results.push({ id: assetId, action: 'deleted' });
    }
  }

  return results;
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}
