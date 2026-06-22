import { getAssetIfExists, getEntryIfExists } from './contentful-client.js';
import type { ContentfulContext } from './contentful-client.js';

export async function publishAssets(
  context: ContentfulContext,
  assetIds: string[],
  chunkSize = 10
): Promise<number> {
  let published = 0;
  for (const chunk of chunkArray(assetIds, chunkSize)) {
    for (const assetId of chunk) {
      const asset = await getAssetIfExists(context, assetId);
      if (!asset) {
        continue;
      }

      if (typeof asset.isPublished === 'function' && asset.isPublished() && typeof asset.isUpdated === 'function' && !asset.isUpdated()) {
        continue;
      }

      await asset.publish();
      published += 1;
    }
  }

  return published;
}

export async function publishEntries(
  context: ContentfulContext,
  entryIds: string[],
  chunkSize = 10
): Promise<number> {
  let published = 0;
  for (const chunk of chunkArray(entryIds, chunkSize)) {
    for (const entryId of chunk) {
      const entry = await getEntryIfExists(context, entryId);
      if (!entry) {
        continue;
      }

      if (typeof entry.isPublished === 'function' && entry.isPublished() && typeof entry.isUpdated === 'function' && !entry.isUpdated()) {
        continue;
      }

      await entry.publish();
      published += 1;
    }
  }

  return published;
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}
