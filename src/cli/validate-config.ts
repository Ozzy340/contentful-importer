import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { createContentfulContext } from '../lib/contentful-client.js';
import { pullDiscoverySnapshot } from '../lib/contentful-discovery.js';
import { pullTaxonomySnapshot, renderTaxonomyMarkdown } from '../lib/contentful-taxonomy.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { summarizeIssuesMarkdown } from '../lib/pipeline.js';
import {
  validateEnvironmentSafety,
  validateMappingAgainstDiscovery,
  validateTaxonomyMapAgainstSnapshot
} from '../lib/validator.js';

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'validate-config');
  const config = await loadProjectConfig();
  const issues = [
    ...validateEnvironmentSafety(
      config.env.CONTENTFUL_ENVIRONMENT_ID,
      config.conventions,
      Boolean(flags['allow-non-sandbox'])
    )
  ];

  if (!flags.offline && config.env.CONTENTFUL_MANAGEMENT_TOKEN && config.env.CONTENTFUL_SPACE_ID && config.env.CONTENTFUL_ENVIRONMENT_ID) {
    const context = await createContentfulContext(config.env);
    const discovery = await pullDiscoverySnapshot(context);
    issues.push(...validateMappingAgainstDiscovery(config.componentMap, discovery));
  } else {
    issues.push({
      severity: 'warning',
      code: 'validate.offline',
      message: 'Live model validation was skipped because --offline was used or Contentful environment variables are incomplete'
    });
  }

  if (!flags.offline && config.env.CONTENTFUL_MANAGEMENT_TOKEN && config.env.CONTENTFUL_ORG_ID) {
    const snapshot = await pullTaxonomySnapshot(config.env);
    const baseName = `taxonomy-snapshot-${snapshot.organizationId}`;
    await writeJsonArtifact(config.paths.exportsDir, `${baseName}.json`, snapshot);
    await writeTextArtifact(
      config.paths.exportsDir,
      `${baseName}.md`,
      renderTaxonomyMarkdown(snapshot)
    );
    issues.push(...validateTaxonomyMapAgainstSnapshot(config.taxonomyMap, snapshot));
  } else {
    issues.push({
      severity: 'warning',
      code: 'validate.taxonomySkipped',
      message: 'Live taxonomy validation was skipped because --offline was used or CONTENTFUL_ORG_ID is missing'
    });
  }

  await writeJsonArtifact(config.paths.buildReportsDir, 'config-validation-report.json', {
    generatedAt: new Date().toISOString(),
    issues
  });
  await writeTextArtifact(
    config.paths.buildReportsDir,
    'config-validation-report.md',
    summarizeIssuesMarkdown(issues)
  );

  logger.info('Config validation finished', {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length
  });

  if (issues.some((issue) => issue.severity === 'error')) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
