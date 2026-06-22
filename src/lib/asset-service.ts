import { readFile } from 'node:fs/promises';

import { getAssetIfExists, getExistingAssetIds } from './contentful-client.js';
import type { AssetIntent, PlannedAsset } from './types.js';
import type { ContentfulContext } from './contentful-client.js';

export async function inspectAssetIntent(
  context: ContentfulContext,
  asset: PlannedAsset
): Promise<AssetIntent> {
  const existing = await getAssetIfExists(context, asset.assetId);
  return {
    assetId: asset.assetId,
    action: existing ? 'update' : 'create'
  };
}

export async function inspectAssetIntents(
  context: ContentfulContext,
  assets: PlannedAsset[],
  batchSize?: number
): Promise<AssetIntent[]> {
  const existingIds = await getExistingAssetIds(
    context,
    assets.map((asset) => asset.assetId),
    batchSize
  );

  return assets.map((asset) => ({
    assetId: asset.assetId,
    action: existingIds.has(asset.assetId) ? 'update' : 'create'
  }));
}

export async function upsertAsset(
  context: ContentfulContext,
  asset: PlannedAsset,
  dryRun: boolean,
  knownAction?: AssetIntent['action']
): Promise<AssetIntent> {
  const existing = knownAction === 'create' ? undefined : await getAssetIfExists(context, asset.assetId);
  const action = knownAction === 'create' ? 'create' : existing ? 'update' : 'create';
  const intent: AssetIntent = {
    assetId: asset.assetId,
    action
  };

  if (dryRun) {
    return intent;
  }

  const upload = await context.environment.createUpload({
    file: await readFile(asset.absolutePath)
  });

  const payload = {
    fields: {
      title: {
        [asset.locale]: asset.title
      },
      description: asset.description
        ? {
            [asset.locale]: asset.description
          }
        : undefined,
      file: {
        [asset.locale]: {
          contentType: asset.contentType,
          fileName: asset.fileName,
          uploadFrom: {
            sys: {
              type: 'Link',
              linkType: 'Upload',
              id: upload.sys.id
            }
          }
        }
      }
    }
  };

  if (existing) {
    existing.fields = payload.fields;
    const updated = await existing.update();
    await updated.processForAllLocales();
    return intent;
  }

  const created = await context.environment.createAssetWithId(asset.assetId, payload);
  await created.processForAllLocales();
  return intent;
}
