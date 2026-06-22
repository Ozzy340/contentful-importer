import path from 'node:path';

import { loadProjectConfig, requireEnv } from '../lib/config.js';
import { createContentfulContext } from '../lib/contentful-client.js';
import { pullDiscoverySnapshot, renderDiscoveryMarkdown } from '../lib/contentful-discovery.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { runCommand } from '../lib/shell.js';

async function main(): Promise<void> {
  const logger = new Logger(process.argv.includes('--verbose'), 'pull-model');
  const config = await loadProjectConfig();
  const context = await createContentfulContext(config.env);
  const snapshot = await pullDiscoverySnapshot(context);

  const baseName = `model-snapshot-${context.environmentId}`;
  const jsonPath = await writeJsonArtifact(config.paths.exportsDir, `${baseName}.json`, snapshot);
  const markdownPath = await writeTextArtifact(
    config.paths.exportsDir,
    `${baseName}.md`,
    renderDiscoveryMarkdown(snapshot)
  );

  logger.info('Wrote live discovery snapshot', { jsonPath, markdownPath });

  const useCli = config.conventions.cli.enableModelExport && config.env.CONTENTFUL_USE_CLI_EXPORT !== 'false';
  if (!useCli || process.argv.includes('--skip-cli')) {
    return;
  }

  const required = requireEnv(config.env, [
    'CONTENTFUL_MANAGEMENT_TOKEN',
    'CONTENTFUL_SPACE_ID',
    'CONTENTFUL_ENVIRONMENT_ID'
  ]);

  const exportConfigPath = path.resolve(config.conventions.cli.exportConfigFile);
  await writeJsonArtifact(
    path.dirname(exportConfigPath),
    path.basename(exportConfigPath),
    {
      spaceId: required.CONTENTFUL_SPACE_ID,
      managementToken: required.CONTENTFUL_MANAGEMENT_TOKEN,
      environmentId: required.CONTENTFUL_ENVIRONMENT_ID,
      contentFile: path.resolve(config.conventions.cli.exportFile),
      skipContent: true,
      skipRoles: true,
      skipWebhooks: true,
      downloadAssets: false
    }
  );

  const result = await runCommand(
    config.env.CONTENTFUL_CLI_BIN ?? config.conventions.cli.bin,
    ['space', 'export', '--config', exportConfigPath],
    { cwd: config.paths.root }
  );

  if (result.exitCode !== 0) {
    logger.warn('CLI model export did not complete successfully', {
      exitCode: result.exitCode,
      stderr: result.stderr.trim()
    });
    return;
  }

  logger.info('CLI model export completed', {
    exportConfigPath,
    exportFile: path.resolve(config.conventions.cli.exportFile)
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
