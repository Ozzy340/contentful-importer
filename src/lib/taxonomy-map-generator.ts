import { readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

import { slugify } from './ids.js';
import type { TaxonomyMapConfig, TaxonomySnapshot } from './types.js';

export interface GenerateTaxonomyMapOptions {
  allowedSchemeIds?: string[];
  existingMap?: TaxonomyMapConfig;
}

export interface GeneratedTaxonomyMap {
  map: TaxonomyMapConfig;
  summary: {
    schemeIds: string[];
    conceptCount: number;
    preservedTokenCount: number;
    generatedTokenCount: number;
  };
}

export async function loadTaxonomySnapshot(filePath: string): Promise<TaxonomySnapshot> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as TaxonomySnapshot;
}

export async function loadRawContentModelExport(filePath: string): Promise<any> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export function inferAllowedSchemeIdsFromContentModel(
  contentModelExport: any,
  contentTypeId: string
): string[] {
  const contentTypes = Array.isArray(contentModelExport?.contentTypes)
    ? contentModelExport.contentTypes
    : [];

  const contentType = contentTypes.find((item: any) => item?.sys?.id === contentTypeId);
  const schemeIds: string[] = (contentType?.metadata?.taxonomy ?? [])
    .map((item: any) => item?.sys?.id)
    .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);

  return [...new Set(schemeIds)];
}

export function renderTaxonomyMapYaml(map: TaxonomyMapConfig): string {
  return yaml.dump(map, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

export function generateTaxonomyMapFromSnapshot(
  snapshot: TaxonomySnapshot,
  options: GenerateTaxonomyMapOptions = {}
): GeneratedTaxonomyMap {
  const schemeIds = options.allowedSchemeIds?.length
    ? options.allowedSchemeIds
    : snapshot.schemes.map((scheme) => scheme.id);

  const allowedSchemeSet = new Set(schemeIds);
  const conceptsById = new Map(snapshot.concepts.map((concept) => [concept.id, concept]));
  const schemesById = new Map(snapshot.schemes.map((scheme) => [scheme.id, scheme]));

  const reservedTokens = new Map<string, { conceptId: string; schemeId: string }>();
  const preferredTokensByPair = new Map<string, string>();
  let preservedTokenCount = 0;

  for (const [token, mapping] of Object.entries(options.existingMap?.concepts ?? {})) {
    const concept = conceptsById.get(mapping.conceptId);
    if (!concept) {
      continue;
    }

    const matchingSchemeId = concept.schemeIds.find((schemeId) => allowedSchemeSet.has(schemeId));
    if (!matchingSchemeId) {
      continue;
    }

    const pairKey = `${matchingSchemeId}::${concept.id}`;
    if (!preferredTokensByPair.has(pairKey) && !reservedTokens.has(token)) {
      preferredTokensByPair.set(pairKey, token);
      reservedTokens.set(token, { conceptId: concept.id, schemeId: matchingSchemeId });
      preservedTokenCount += 1;
    }
  }

  const generatedConcepts: TaxonomyMapConfig['concepts'] = {};
  let generatedTokenCount = 0;

  for (const schemeId of schemeIds) {
    const scheme = schemesById.get(schemeId);
    if (!scheme) {
      continue;
    }

    const conceptIdsInScheme = snapshot.concepts
      .filter((concept) => concept.schemeIds.includes(schemeId))
      .map((concept) => concept.id)
      .sort((left, right) => {
        const a = conceptsById.get(left)?.prefLabel ?? left;
        const b = conceptsById.get(right)?.prefLabel ?? right;
        return a.localeCompare(b);
      });

    for (const conceptId of conceptIdsInScheme) {
      const concept = conceptsById.get(conceptId);
      if (!concept) {
        continue;
      }

      const pairKey = `${schemeId}::${concept.id}`;
      const preferredToken = preferredTokensByPair.get(pairKey);
      const token =
        preferredToken ??
        reserveNextAvailableToken(
          generatedConcepts,
          reservedTokens,
          createBaseToken(scheme.id, concept.prefLabel || concept.id, concept.id),
          concept.id,
          scheme.id
        );

      if (!preferredToken) {
        generatedTokenCount += 1;
      }

      generatedConcepts[token] = {
        conceptId: concept.id,
        description: buildDescription(scheme.prefLabel, concept.prefLabel, concept.notations)
      };
    }
  }

  return {
    map: { concepts: generatedConcepts },
    summary: {
      schemeIds,
      conceptCount: Object.keys(generatedConcepts).length,
      preservedTokenCount,
      generatedTokenCount
    }
  };
}

function createBaseToken(schemeId: string, prefLabel: string, conceptId: string): string {
  const schemeToken = toSchemeTokenPrefix(schemeId);
  const labelToken = slugify(prefLabel);
  const conceptToken = slugify(humanizeIdentifier(conceptId));
  const suffix = labelToken || conceptToken || slugify(conceptId) || 'concept';
  return `${schemeToken}:${suffix}`;
}

function toSchemeTokenPrefix(schemeId: string): string {
  const humanized = humanizeIdentifier(schemeId);
  return singularizeSlug(slugify(humanized));
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function singularizeSlug(value: string): string {
  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('sses')) {
    return value.slice(0, -2);
  }

  if (value.endsWith('ses')) {
    return value.slice(0, -2);
  }

  if (value.endsWith('s') && !value.endsWith('ss')) {
    return value.slice(0, -1);
  }

  return value;
}

function reserveNextAvailableToken(
  concepts: TaxonomyMapConfig['concepts'],
  reservedTokens: Map<string, { conceptId: string; schemeId: string }>,
  baseToken: string,
  conceptId: string,
  schemeId: string
): string {
  const conceptToken = slugify(humanizeIdentifier(conceptId)) || slugify(conceptId) || 'concept';
  let candidate = baseToken;
  let attempt = 1;

  while (concepts[candidate] || reservedTokens.has(candidate)) {
    candidate = `${baseToken}--${attempt === 1 ? conceptToken : `${conceptToken}-${attempt}`}`;
    attempt += 1;
  }

  reservedTokens.set(candidate, { conceptId, schemeId });
  return candidate;
}

function buildDescription(schemeLabel: string, conceptLabel: string, notations: string[]): string {
  const notationSuffix = notations.length > 0 ? ` (${notations.join(', ')})` : '';
  return `${schemeLabel}: ${conceptLabel}${notationSuffix}`;
}
