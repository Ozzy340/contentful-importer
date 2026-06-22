import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectConfig, parseCliFlags } from '../lib/config.js';
import { buildArtifacts } from '../lib/pipeline.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { DocumentRunState, RunState } from '../lib/types.js';

interface UploadedDocumentRecord {
  document: DocumentRunState;
  environmentId?: string;
  runId: string;
}

interface CreatedPageReportItem {
  sourceId: string;
  title: string;
  slug?: string;
  sourcePath: string;
  entryId: string;
  contentfulUrl: string;
  uploadRunId?: string;
  uploadedAt?: string;
  status: 'created' | 'not-found-in-upload-state';
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const config = await loadProjectConfig();
  const source = String(flags.source ?? config.paths.sourceDocsDir);
  const spaceId = config.env.CONTENTFUL_SPACE_ID;

  if (!spaceId) {
    throw new Error('CONTENTFUL_SPACE_ID is required to generate Contentful entry URLs.');
  }

  const artifacts = await buildArtifacts(source, config);
  const uploadedDocuments = await collectLatestUploadedDocuments(config.paths.buildStateDir);
  const items: CreatedPageReportItem[] = artifacts.mappedPlans
    .map((plan) => {
      const document = artifacts.canonicalDocuments.find((item) => item.sourceId === plan.sourceId);
      const uploaded = uploadedDocuments.get(plan.sourceId);
      const environmentId = uploaded?.environmentId ?? config.env.CONTENTFUL_ENVIRONMENT_ID ?? 'master';

      return {
        sourceId: plan.sourceId,
        title: document?.metadata.title ?? plan.sourceId,
        slug: document?.metadata.slug,
        sourcePath: plan.sourcePath,
        entryId: plan.parentEntry.entryId,
        contentfulUrl: contentfulEntryUrl(spaceId, environmentId, plan.parentEntry.entryId),
        uploadRunId: uploaded?.runId,
        uploadedAt: uploaded?.document.finishedAt,
        status: uploaded ? 'created' as const : 'not-found-in-upload-state' as const
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    spaceId,
    environmentId: config.env.CONTENTFUL_ENVIRONMENT_ID,
    totalPages: items.length,
    createdPages: items.filter((item) => item.status === 'created').length,
    missingFromUploadState: items.filter((item) => item.status !== 'created').length,
    pages: items
  };

  const jsonPath = await writeJsonArtifact(config.paths.buildReportsDir, 'created-pages-report.json', report);
  const markdownPath = await writeTextArtifact(
    config.paths.buildReportsDir,
    'created-pages-report.md',
    renderMarkdownReport(report)
  );

  // eslint-disable-next-line no-console
  console.log(`Created pages report written to ${markdownPath} and ${jsonPath}`);
}

async function collectLatestUploadedDocuments(stateDirectoryPath: string): Promise<Map<string, UploadedDocumentRecord>> {
  const files = (await readdir(stateDirectoryPath))
    .filter((fileName) => fileName.startsWith('upload-') && fileName.endsWith('.json'))
    .sort();
  const records = new Map<string, UploadedDocumentRecord>();

  for (const fileName of files) {
    const payload = await readFile(path.join(stateDirectoryPath, fileName), 'utf8');
    const state = JSON.parse(payload) as RunState;
    for (const document of Object.values(state.documents)) {
      if (document.status !== 'completed') {
        continue;
      }

      records.set(document.sourceId, {
        document,
        environmentId: state.environmentId,
        runId: state.runId
      });
    }
  }

  return records;
}

function contentfulEntryUrl(spaceId: string, environmentId: string, entryId: string): string {
  return `https://app.contentful.com/spaces/${encodeURIComponent(spaceId)}/environments/${encodeURIComponent(environmentId)}/entries/${encodeURIComponent(entryId)}`;
}

function renderMarkdownReport(report: {
  generatedAt: string;
  source: string;
  spaceId: string;
  environmentId?: string;
  totalPages: number;
  createdPages: number;
  missingFromUploadState: number;
  pages: CreatedPageReportItem[];
}): string {
  const lines = [
    '# Created Pages Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Source: ${report.source}`,
    `- Space: ${report.spaceId}`,
    `- Environment: ${report.environmentId ?? 'mixed/unknown'}`,
    `- Pages: ${report.createdPages}/${report.totalPages} found in upload state`,
    `- Missing from upload state: ${report.missingFromUploadState}`,
    '',
    '| Title | Slug | Source ID | Contentful entry | Upload run |',
    '| --- | --- | --- | --- | --- |'
  ];

  for (const page of report.pages) {
    lines.push(
      `| ${escapeTableCell(page.title)} | ${escapeTableCell(page.slug ?? '')} | ${escapeTableCell(page.sourceId)} | [${escapeTableCell(page.entryId)}](${page.contentfulUrl}) | ${escapeTableCell(page.uploadRunId ?? page.status)} |`
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
