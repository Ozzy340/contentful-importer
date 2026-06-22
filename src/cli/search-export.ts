import path from 'node:path';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import { createContentfulContext } from '../lib/contentful-client.js';
import {
  getSearchDefinition,
  listSearchDefinitions,
  renderCsv
} from '../lib/contentful-search-export.js';
import { Logger } from '../lib/logger.js';
import { writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

interface SearchExportCommandConfig {
  environmentId: string;
  queryId: string;
  locale?: string;
  outputPath?: string;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));

  if (flags['list-queries'] || flags.list) {
    printSearchDefinitions();
    return;
  }

  const logger = new Logger(Boolean(flags.verbose), 'search-export');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);
  const definition = getSearchDefinition(commandConfig.queryId);

  if (!definition) {
    throw new Error(
      `Unknown search query "${commandConfig.queryId}". Use --list-queries to see supported queries.`
    );
  }

  logger.info('Running Contentful search export', {
    query: definition.id,
    environmentId: commandConfig.environmentId,
    locale: commandConfig.locale ?? 'all'
  });

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });
  const result = await definition.run(context, {
    locale: commandConfig.locale
  });
  const csv = renderCsv(result.columns, result.rows);
  const outputPath = await writeCsv(projectConfig, commandConfig, csv);

  logger.info('Contentful search export written', {
    outputPath,
    scannedEntries: result.summary.scannedEntries,
    matchedEntries: result.summary.matchedEntries
  });
}

function resolveCommandConfig(flags: CliFlags, env: RuntimeEnv): SearchExportCommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);

  const environmentId =
    stringFlag(flags, 'env') ??
    stringFlag(flags, 'environment') ??
    env.CONTENTFUL_ENVIRONMENT_ID;
  const queryId =
    stringFlag(flags, 'query') ??
    stringFlag(flags, 'criteria') ??
    stringFlag(flags, 'search');
  const locale = stringFlag(flags, 'locale');
  const outputPath = stringFlag(flags, 'output') ?? stringFlag(flags, 'out');

  const missing = [
    ['environment', environmentId],
    ['query', queryId]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing search export configuration: ${missing.map(([name]) => name).join(', ')}. ` +
      'Use --env <environment> and --query <query-id>. Run with --list-queries to see query IDs.'
    );
  }

  return {
    environmentId: environmentId!,
    queryId: queryId!,
    locale,
    outputPath
  };
}

async function writeCsv(
  projectConfig: LoadedProjectConfig,
  commandConfig: SearchExportCommandConfig,
  csv: string
): Promise<string> {
  if (commandConfig.outputPath) {
    const resolvedOutputPath = path.resolve(commandConfig.outputPath);
    return writeTextArtifact(
      path.dirname(resolvedOutputPath),
      path.basename(resolvedOutputPath),
      csv
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${commandConfig.queryId}-${commandConfig.environmentId}-${timestamp}.csv`;
  return writeTextArtifact(projectConfig.paths.exportsDir, fileName, csv);
}

function printSearchDefinitions(): void {
  const lines = [
    'Available Contentful search export queries:',
    '',
    ...listSearchDefinitions().map(
      (definition) => `- ${definition.id}: ${definition.description}`
    )
  ];

  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function stringFlag(flags: CliFlags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
