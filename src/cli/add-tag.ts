import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext
} from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import {
  buildGroupedTagDefinition,
  parseContentfulTagVisibility,
  upsertGroupedTag
} from '../lib/tag-service.js';
import type { GroupedTagUpsertResult } from '../lib/tag-service.js';
import type { CliFlags, ContentfulTagVisibility, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

interface AddTagCommandConfig {
  environmentId: string;
  group: string;
  tag: string;
  separator: string;
  visibility: ContentfulTagVisibility;
  dryRun: boolean;
  allowNonSandbox: boolean;
  updateExistingName: boolean;
}

interface TagUpdateReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  spaceId?: string;
  environmentId: string;
  input: {
    group: string;
    tag: string;
    separator: string;
    visibility: ContentfulTagVisibility;
    updateExistingName: boolean;
  };
  result: GroupedTagUpsertResult;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'add-tag');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env, projectConfig.conventions.tags.namespaceSeparator);
  const definition = buildGroupedTagDefinition(commandConfig);

  logger.info(commandConfig.dryRun ? 'Previewing grouped tag update' : 'Applying grouped tag update', {
    environmentId: commandConfig.environmentId,
    group: commandConfig.group,
    tag: commandConfig.tag,
    tagId: definition.id,
    name: definition.name,
    visibility: commandConfig.visibility,
    dryRun: commandConfig.dryRun
  });

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  const result = await upsertGroupedTag(context, commandConfig, {
    dryRun: commandConfig.dryRun,
    updateExistingName: commandConfig.updateExistingName
  });
  const reportPaths = await writeTagReports(projectConfig, commandConfig, result);

  for (const warning of result.warnings) {
    logger.warn(warning);
  }

  logger.info('Grouped tag update finished', {
    action: result.action,
    tagId: result.definition.id,
    name: result.definition.name,
    report: reportPaths.markdownPath
  });

  if (result.action === 'name-conflict') {
    process.exitCode = 1;
  }
}

function resolveCommandConfig(
  flags: CliFlags,
  env: RuntimeEnv,
  defaultSeparator: string
): AddTagCommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);

  const environmentId = stringFlag(flags, 'env')
    ?? stringFlag(flags, 'environment')
    ?? env.CONTENTFUL_ENVIRONMENT_ID;
  const group = stringFlag(flags, 'group') ?? stringFlag(flags, 'tag-group');
  const tag = stringFlag(flags, 'tag') ?? stringFlag(flags, 'name');
  const separator = stringFlag(flags, 'separator') ?? defaultSeparator;

  const missing = [
    ['environment', environmentId],
    ['tag group', group],
    ['tag', tag]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing grouped tag configuration: ${missing.map(([name]) => name).join(', ')}. ` +
      'Use --env <environment>, --group "<tag group>", and --tag "<tag>".'
    );
  }

  const visibility = parseContentfulTagVisibility(flags.visibility, 'public');
  if (visibility !== 'public') {
    throw new Error('Tags must be public. Remove --visibility private or use --visibility public.');
  }

  return {
    environmentId: environmentId!,
    group: group!,
    tag: tag!,
    separator,
    visibility,
    dryRun: !flags.yes,
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    updateExistingName: Boolean(flags['update-existing-name'])
  };
}

async function writeTagReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: AddTagCommandConfig,
  result: GroupedTagUpsertResult
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `tag-update-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const report: TagUpdateReport = {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      group: commandConfig.group,
      tag: commandConfig.tag,
      separator: commandConfig.separator,
      visibility: commandConfig.visibility,
      updateExistingName: commandConfig.updateExistingName
    },
    result
  };

  const jsonPath = await writeJsonArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.json`,
    report
  );
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderTagReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderTagReport(report: TagUpdateReport): string {
  const lines: string[] = [];
  lines.push('# Tag Update');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- Group: ${report.input.group}`);
  lines.push(`- Tag: ${report.input.tag}`);
  lines.push(`- Generated tag ID: ${report.result.definition.id}`);
  lines.push(`- Contentful name: ${report.result.definition.name}`);
  lines.push(`- Requested visibility: ${report.input.visibility}`);
  lines.push(`- Action: ${report.result.action}`);
  if (report.result.existing) {
    lines.push(`- Existing name: ${report.result.existing.name}`);
    lines.push(`- Existing visibility: ${report.result.existing.visibility ?? 'unknown'}`);
  }
  if (report.result.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of report.result.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
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
