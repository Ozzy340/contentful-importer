import { basename, dirname, join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  generateTaxonomyMapFromSnapshot,
  inferAllowedSchemeIdsFromContentModel,
  loadRawContentModelExport,
  loadTaxonomySnapshot,
  renderTaxonomyMapYaml
} from '../lib/taxonomy-map-generator.js';

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'sync-taxonomy-map');
  const config = await loadProjectConfig();

  const snapshotPath = resolve(
    String(
      flags.snapshot ??
        (await resolveDefaultSnapshotPath(config.paths.exportsDir, config.env.CONTENTFUL_ORG_ID))
    )
  );

  const targetContentType = String(
    flags['target-content-type'] ?? config.componentMap.document.targetContentType
  );
  const contentModelPath = resolve(
    String(flags.model ?? config.conventions.cli.exportFile)
  );

  const inferredSchemeIds = flags['all-schemes']
    ? undefined
    : parseCsv(flags.schemes) ??
      inferAllowedSchemeIdsFromContentModel(
        await loadRawContentModelExport(contentModelPath),
        targetContentType
      );

  const allowedSchemeIds =
    inferredSchemeIds && inferredSchemeIds.length > 0 ? inferredSchemeIds : undefined;

  const snapshot = await loadTaxonomySnapshot(snapshotPath);
  const generated = generateTaxonomyMapFromSnapshot(snapshot, {
    allowedSchemeIds,
    existingMap: config.taxonomyMap
  });

  const yamlContent = renderTaxonomyMapYaml(generated.map);
  const writeToConfig = Boolean(flags.write);
  const outputPath = writeToConfig
    ? resolve(config.paths.configDir, 'taxonomy-map.yml')
    : resolve(config.paths.buildReportsDir, 'taxonomy-map.generated.yml');

  await writeTextArtifact(dirname(outputPath), basename(outputPath), yamlContent);

  const report = {
    generatedAt: new Date().toISOString(),
    snapshotPath,
    outputPath,
    wroteConfig: writeToConfig,
    targetContentType,
    allowedSchemeIds: generated.summary.schemeIds,
    conceptCount: generated.summary.conceptCount,
    preservedTokenCount: generated.summary.preservedTokenCount,
    generatedTokenCount: generated.summary.generatedTokenCount
  };

  await writeJsonArtifact(config.paths.buildReportsDir, 'taxonomy-map-sync-report.json', report);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'taxonomy-map-sync-report.md',
    `# Taxonomy Map Sync Report

- Snapshot: ${snapshotPath}
- Output: ${outputPath}
- Wrote config: ${writeToConfig ? 'yes' : 'no'}
- Target content type: ${targetContentType}
- Allowed schemes: ${generated.summary.schemeIds.join(', ') || 'all'}
- Concepts written: ${generated.summary.conceptCount}
- Preserved existing tokens: ${generated.summary.preservedTokenCount}
- Generated new tokens: ${generated.summary.generatedTokenCount}
`
  );

  logger.info('Taxonomy map generated', report);
}

async function resolveDefaultSnapshotPath(exportsDir: string, organizationId?: string): Promise<string> {
  if (organizationId) {
    return join(exportsDir, `taxonomy-snapshot-${organizationId}.json`);
  }

  const files = (await readdir(exportsDir))
    .filter((file) => /^taxonomy-snapshot-.*\.json$/.test(file))
    .sort();

  const latest = files.at(-1);
  if (!latest) {
    throw new Error('No taxonomy snapshot was found in exports/. Run npm run pull:taxonomy first.');
  }

  return join(exportsDir, latest);
}

function parseCsv(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
