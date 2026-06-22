import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import { createContentfulSpaceContext } from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import { runCommand } from '../lib/shell.js';

function defaultSandboxId(): string {
  return `sandbox-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'create-sandbox');
  const config = await loadProjectConfig();
  const required = requireEnv(config.env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);
  const sandboxId = String(flags.name ?? defaultSandboxId());
  const sourceEnvironment = String(flags.source ?? config.env.CONTENTFUL_ENVIRONMENT_ID ?? 'master');

  if (
    !config.conventions.sandboxes.allowedPrefixes.some((prefix) => sandboxId.startsWith(prefix))
  ) {
    throw new Error(
      `Sandbox ID ${sandboxId} does not match the configured allowed prefixes: ${config.conventions.sandboxes.allowedPrefixes.join(
        ', '
      )}`
    );
  }

  const cliResult = await runCommand(
    config.env.CONTENTFUL_CLI_BIN ?? config.conventions.cli.bin,
    [
      'space',
      'environment',
      'create',
      '--space-id',
      required.CONTENTFUL_SPACE_ID,
      '--environment-id',
      sandboxId,
      '--name',
      sandboxId,
      '--source',
      sourceEnvironment,
      '--management-token',
      required.CONTENTFUL_MANAGEMENT_TOKEN
    ],
    { cwd: config.paths.root }
  ).catch((error) => ({
    exitCode: 1,
    stdout: '',
    stderr: error instanceof Error ? error.message : String(error)
  }));

  let mode: 'cli' | 'sdk-fallback' = 'cli';
  let success = cliResult.exitCode === 0;
  let stderr = cliResult.stderr.trim();

  if (!success) {
    logger.warn('CLI sandbox creation failed, falling back to SDK', { stderr });
    const context = await createContentfulSpaceContext(config.env);
    await context.space.createEnvironmentWithId(sandboxId, { name: sandboxId }, sourceEnvironment);
    success = true;
    mode = 'sdk-fallback';
    stderr = '';
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sandboxId,
    sourceEnvironment,
    mode,
    success,
    stderr
  };

  await writeJsonArtifact(config.paths.buildReportsDir, `sandbox-${sandboxId}.json`, report);
  await writeTextArtifact(
    config.paths.buildReportsDir,
    `sandbox-${sandboxId}.md`,
    `# Sandbox Creation\n\n- Sandbox ID: ${sandboxId}\n- Source environment: ${sourceEnvironment}\n- Mode: ${mode}\n- Success: ${success ? 'yes' : 'no'}\n${stderr ? `- Notes: ${stderr}\n` : ''}`
  );

  logger.info('Sandbox creation finished', { sandboxId, mode });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
