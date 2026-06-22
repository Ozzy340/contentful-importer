import { loadProjectConfig } from '../lib/config.js';
import { pullTaxonomySnapshot, renderTaxonomyMarkdown } from '../lib/contentful-taxonomy.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';

async function main(): Promise<void> {
  const logger = new Logger(process.argv.includes('--verbose'), 'pull-taxonomy');
  const config = await loadProjectConfig();
  const snapshot = await pullTaxonomySnapshot(config.env);
  const baseName = `taxonomy-snapshot-${snapshot.organizationId}`;

  const jsonPath = await writeJsonArtifact(config.paths.exportsDir, `${baseName}.json`, snapshot);
  const markdownPath = await writeTextArtifact(
    config.paths.exportsDir,
    `${baseName}.md`,
    renderTaxonomyMarkdown(snapshot)
  );

  logger.info('Wrote taxonomy snapshot', {
    jsonPath,
    markdownPath,
    schemes: snapshot.schemes.length,
    concepts: snapshot.concepts.length
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
