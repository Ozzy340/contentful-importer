import type { CliFlags, ConventionsConfig, LoadedProjectConfig } from './types.js';

export interface ImportOptionsSummary {
  defaultParentEntryId?: string;
  placeholderAsset?: {
    enabled: boolean;
    mode?: 'all' | 'missing-only';
    assetId?: string;
    sourcePath?: string;
  };
}

export function applyImportFlagOverrides(
  config: LoadedProjectConfig,
  flags: CliFlags
): LoadedProjectConfig {
  const conventions = cloneConventions(config.conventions);
  applyDefaultParentFlags(conventions, flags);
  applyPlaceholderAssetFlags(conventions, flags);

  return {
    ...config,
    conventions
  };
}

export function summarizeImportOptions(conventions: ConventionsConfig): ImportOptionsSummary {
  const defaultParent = conventions.defaults.defaultParent;
  const placeholderAsset = conventions.assets.sharedPlaceholder;

  return {
    defaultParentEntryId: defaultParent?.enabled ? defaultParent.entryId : undefined,
    placeholderAsset: placeholderAsset?.enabled
      ? {
          enabled: true,
          mode: placeholderAsset.mode,
          assetId: placeholderAsset.assetId,
          sourcePath: placeholderAsset.sourcePath
        }
      : undefined
  };
}

function applyDefaultParentFlags(conventions: ConventionsConfig, flags: CliFlags): void {
  if (isEnabled(flags['disable-default-parent'])) {
    conventions.defaults.defaultParent = conventions.defaults.defaultParent
      ? { ...conventions.defaults.defaultParent, enabled: false }
      : undefined;
    return;
  }

  const defaultParentEntryId =
    stringFlag(flags['default-parent-entry-id']) ?? stringFlag(flags['default-parent-id']);
  if (!defaultParentEntryId) {
    return;
  }

  conventions.defaults.defaultParent = {
    enabled: true,
    entryId: defaultParentEntryId
  };
}

function applyPlaceholderAssetFlags(conventions: ConventionsConfig, flags: CliFlags): void {
  if (isEnabled(flags['disable-placeholder-asset'])) {
    conventions.assets.sharedPlaceholder = conventions.assets.sharedPlaceholder
      ? { ...conventions.assets.sharedPlaceholder, enabled: false }
      : undefined;
    return;
  }

  const placeholderRequested =
    isEnabled(flags['use-placeholder-asset']) ||
    isEnabled(flags['use-placeholder-assets']) ||
    isEnabled(flags['placeholder-for-all-assets']) ||
    Boolean(flags['placeholder-asset-id']) ||
    Boolean(flags['placeholder-asset-path']) ||
    Boolean(flags['placeholder-asset-mode']);

  if (!placeholderRequested) {
    return;
  }

  const existing = conventions.assets.sharedPlaceholder;
  const assetId = stringFlag(flags['placeholder-asset-id']) ?? existing?.assetId;
  const sourcePath = stringFlag(flags['placeholder-asset-path']) ?? existing?.sourcePath;

  if (!assetId || !sourcePath) {
    throw new Error(
      'Placeholder asset flags require an asset ID and source path. Configure assets.sharedPlaceholder or pass --placeholder-asset-id and --placeholder-asset-path.'
    );
  }

  conventions.assets.sharedPlaceholder = {
    enabled: true,
    mode: resolvePlaceholderMode(flags),
    assetId,
    sourcePath,
    title: stringFlag(flags['placeholder-asset-title']) ?? existing?.title,
    description: stringFlag(flags['placeholder-asset-description']) ?? existing?.description
  };
}

function resolvePlaceholderMode(flags: CliFlags): 'all' | 'missing-only' {
  if (isEnabled(flags['placeholder-for-all-assets'])) {
    return 'all';
  }

  const mode = stringFlag(flags['placeholder-asset-mode']);
  if (mode === 'all' || mode === 'missing-only') {
    return mode;
  }

  if (mode) {
    throw new Error('Invalid --placeholder-asset-mode. Use "missing-only" or "all".');
  }

  return 'missing-only';
}

function cloneConventions(conventions: ConventionsConfig): ConventionsConfig {
  return {
    ...conventions,
    defaults: {
      ...conventions.defaults,
      defaultParent: conventions.defaults.defaultParent
        ? { ...conventions.defaults.defaultParent }
        : undefined
    },
    naming: { ...conventions.naming },
    sandboxes: {
      ...conventions.sandboxes,
      allowedPrefixes: [...conventions.sandboxes.allowedPrefixes]
    },
    tags: { ...conventions.tags },
    taxonomy: { ...conventions.taxonomy },
    assets: {
      ...conventions.assets,
      sharedPlaceholder: conventions.assets.sharedPlaceholder
        ? { ...conventions.assets.sharedPlaceholder }
        : undefined
    },
    cli: { ...conventions.cli }
  };
}

function stringFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function isEnabled(value: string | boolean | undefined): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
