import path from 'node:path';

import { mapCanonicalDocument } from './mapper.js';
import { canonicalFileNameFor, normalizeParsedDocument } from './normalizer.js';
import { collectSourceDocumentPaths, parseSourceDocument } from './parser.js';
import { writeJsonArtifact } from './reporter.js';
import {
  hasErrors,
  validateAssetFiles,
  validateCanonicalDocuments,
  validateMarkdownSourceFormat,
  validateMappedPlans,
  validateMappingAgainstDiscovery,
  validatePlannedAssetFiles
} from './validator.js';
import type {
  CanonicalDocument,
  DiscoverySnapshot,
  LoadedProjectConfig,
  MappedDocumentPlan,
  ValidationIssue
} from './types.js';

export interface BuildArtifactsResult {
  sourcePaths: string[];
  canonicalDocuments: CanonicalDocument[];
  mappedPlans: MappedDocumentPlan[];
  issues: ValidationIssue[];
}

export async function buildArtifacts(
  sourcePath: string,
  config: LoadedProjectConfig,
  discovery?: DiscoverySnapshot
): Promise<BuildArtifactsResult> {
  const sourcePaths = await collectSourceDocumentPaths(path.resolve(sourcePath));
  const parsedDocuments = await Promise.all(sourcePaths.map((filePath) => parseSourceDocument(filePath)));
  const canonicalDocuments = parsedDocuments.map((document) =>
    normalizeParsedDocument(document, config.conventions, config.componentMap, config.taxonomyMap)
  );

  for (const document of canonicalDocuments) {
    await writeJsonArtifact(
      config.paths.buildNormalizedDir,
      canonicalFileNameFor(document),
      document
    );
  }

  const issues: ValidationIssue[] = [
    ...validateMarkdownSourceFormat(parsedDocuments),
    ...validateCanonicalDocuments(
      canonicalDocuments,
      config.componentMap,
      config.taxonomyMap,
      config.conventions,
      discovery
    ),
    ...(await validateAssetFiles(canonicalDocuments))
  ];

  const mappableDocuments = canonicalDocuments.filter((document) =>
    canMapDocument(document, config.componentMap)
  );
  const mappedPlans = mappableDocuments.map((document) =>
    mapCanonicalDocument(document, config.conventions, config.componentMap)
  );

  if (discovery) {
    issues.push(...validateMappingAgainstDiscovery(config.componentMap, discovery));
    issues.push(...validateMappedPlans(mappedPlans, discovery, config.conventions));
  }

  issues.push(...(await validatePlannedAssetFiles(mappedPlans)));

  return {
    sourcePaths,
    canonicalDocuments,
    mappedPlans,
    issues
  };
}

function canMapDocument(document: CanonicalDocument, componentMap: LoadedProjectConfig['componentMap']): boolean {
  return document.blocks.every((block) => {
    if (block.kind === 'richText') {
      return Boolean(componentMap.components.richText);
    }

    if (block.kind === 'asset') {
      return Boolean(componentMap.components.asset);
    }

    return Boolean(componentMap.components[block.component]);
  });
}

export function summarizeIssuesMarkdown(issues: ValidationIssue[]): string {
  const lines: string[] = [];
  lines.push('# Validation Report');
  lines.push('');
  if (issues.length === 0) {
    lines.push('No validation issues were found.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  lines.push(`- Errors: ${errors.length}`);
  lines.push(`- Warnings: ${warnings.length}`);
  lines.push('');
  lines.push('| Severity | Code | Document | Path | Message |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const issue of issues) {
    lines.push(
      `| ${issue.severity} | ${issue.code} | ${issue.documentId ?? ''} | ${issue.path ?? ''} | ${issue.message.replace(/\|/g, '\\|')} |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function ensureNoErrors(issues: ValidationIssue[]): void {
  if (hasErrors(issues)) {
    throw new Error('Validation failed. Review the generated report before continuing.');
  }
}
