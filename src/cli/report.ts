import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { Logger } from '../lib/logger.js';
import { writeTextArtifact } from '../lib/reporter.js';
import { findLatestRunState } from '../lib/state-store.js';

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'report');
  const config = await loadProjectConfig();
  const latest = await findLatestRunState(config.paths.buildStateDir);

  if (!latest) {
    throw new Error('No state files were found in build/state');
  }

  const report = [
    '# Latest Run Summary',
    '',
    `- Run ID: ${latest.runId}`,
    `- Mode: ${latest.mode}`,
    `- Environment: ${latest.environmentId ?? 'n/a'}`,
    `- Started: ${latest.startedAt}`,
    `- Finished: ${latest.finishedAt ?? 'n/a'}`,
    `- Completed documents: ${latest.summary.completed}`,
    `- Failed documents: ${latest.summary.failed}`,
    `- Skipped documents: ${latest.summary.skipped}`,
    `- Created entries: ${latest.summary.createdEntries}`,
    `- Updated entries: ${latest.summary.updatedEntries}`,
    `- Created assets: ${latest.summary.createdAssets}`,
    `- Updated assets: ${latest.summary.updatedAssets}`,
    `- Published entries: ${latest.summary.publishedEntries}`,
    `- Published assets: ${latest.summary.publishedAssets}`,
    '',
    '## Documents',
    '',
    '| Source ID | Status | Reason |',
    '| --- | --- | --- |',
    ...Object.values(latest.documents).map(
      (document) =>
        `| ${document.sourceId} | ${document.status} | ${(document.reason ?? '').replace(/\|/g, '\\|')} |`
    ),
    ''
  ].join('\n');

  const reportPath = await writeTextArtifact(
    config.paths.buildReportsDir,
    'latest-run-summary.md',
    `${report}\n`
  );

  if (flags.state && typeof flags.state === 'string') {
    const customStateContent = await readFile(path.resolve(flags.state), 'utf8');
    logger.info('Loaded requested state file', {
      bytes: customStateContent.length
    });
  }

  logger.info('Wrote latest run summary', { reportPath });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
