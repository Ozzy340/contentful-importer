import contentfulManagement from 'contentful-management';

import { requireEnv } from './config.js';
import type { RuntimeEnv, TaxonomyConceptSnapshot, TaxonomySchemeSnapshot, TaxonomySnapshot } from './types.js';

type CursorPage<T> = {
  items?: T[];
  pages?: {
    next?: string;
  };
};

export async function pullTaxonomySnapshot(env: RuntimeEnv): Promise<TaxonomySnapshot> {
  const required = requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_ORG_ID']);
  const client = contentfulManagement.createClient(
    {
      accessToken: required.CONTENTFUL_MANAGEMENT_TOKEN,
      host: env.CONTENTFUL_HOST,
      hostUpload: env.CONTENTFUL_HOST_UPLOAD
    },
    { type: 'plain' }
  );

  const schemesRaw = await fetchCursorCollection<any>((query) =>
    client.conceptScheme.getMany({
      organizationId: required.CONTENTFUL_ORG_ID,
      query
    })
  );

  const conceptsRaw = await fetchCursorCollection<any>((query) =>
    client.concept.getMany({
      organizationId: required.CONTENTFUL_ORG_ID,
      query
    })
  );

  const conceptToSchemeIds = new Map<string, Set<string>>();
  for (const scheme of schemesRaw) {
    const schemeId = String(scheme?.sys?.id ?? '');
    if (!schemeId) {
      continue;
    }

    for (const conceptId of extractLinkIds(scheme?.concepts)) {
      if (!conceptToSchemeIds.has(conceptId)) {
        conceptToSchemeIds.set(conceptId, new Set());
      }
      conceptToSchemeIds.get(conceptId)!.add(schemeId);
    }
  }

  const schemes: TaxonomySchemeSnapshot[] = schemesRaw
    .map((scheme) => ({
      id: String(scheme?.sys?.id ?? ''),
      prefLabel: pickLocalizedString(scheme?.prefLabel) ?? '',
      definition: pickLocalizedString(scheme?.definition),
      topConceptIds: extractLinkIds(scheme?.topConcepts),
      conceptIds: extractLinkIds(scheme?.concepts),
      totalConcepts: Number(scheme?.totalConcepts ?? extractLinkIds(scheme?.concepts).length)
    }))
    .filter((scheme) => scheme.id && scheme.prefLabel);

  const concepts: TaxonomyConceptSnapshot[] = conceptsRaw
    .map((concept) => {
      const conceptId = String(concept?.sys?.id ?? '');
      return {
        id: conceptId,
        prefLabel: pickLocalizedString(concept?.prefLabel) ?? '',
        altLabels: pickLocalizedStringArray(concept?.altLabels),
        definition: pickLocalizedString(concept?.definition),
        notations: Array.isArray(concept?.notations)
          ? concept.notations.filter((value: unknown): value is string => typeof value === 'string')
          : [],
        broaderIds: extractLinkIds(concept?.broader),
        relatedIds: extractLinkIds(concept?.related),
        schemeIds: [...(conceptToSchemeIds.get(conceptId) ?? new Set())]
      };
    })
    .filter((concept) => concept.id && concept.prefLabel);

  return {
    generatedAt: new Date().toISOString(),
    organizationId: required.CONTENTFUL_ORG_ID,
    schemes,
    concepts
  };
}

export function renderTaxonomyMarkdown(snapshot: TaxonomySnapshot): string {
  const lines: string[] = [];
  lines.push('# Taxonomy Snapshot');
  lines.push('');
  lines.push(`- Generated at: ${snapshot.generatedAt}`);
  lines.push(`- Organization ID: ${snapshot.organizationId}`);
  lines.push(`- Schemes: ${snapshot.schemes.length}`);
  lines.push(`- Concepts: ${snapshot.concepts.length}`);
  lines.push('');
  lines.push('## Schemes');
  lines.push('');
  lines.push('| Scheme ID | Label | Concepts | Top Concepts |');
  lines.push('| --- | --- | ---: | --- |');

  for (const scheme of snapshot.schemes) {
    lines.push(
      `| ${scheme.id} | ${escapePipe(scheme.prefLabel)} | ${scheme.totalConcepts} | ${scheme.topConceptIds.join(', ')} |`
    );
  }

  lines.push('');
  lines.push('## Concepts');
  lines.push('');
  lines.push('| Concept ID | Label | Scheme IDs | Alt Labels |');
  lines.push('| --- | --- | --- | --- |');

  for (const concept of snapshot.concepts) {
    lines.push(
      `| ${concept.id} | ${escapePipe(concept.prefLabel)} | ${concept.schemeIds.join(', ')} | ${escapePipe(concept.altLabels.join(', '))} |`
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function fetchCursorCollection<T>(
  fetchPage: (query: { limit: number } | { pageUrl: string }) => Promise<CursorPage<T>>
): Promise<T[]> {
  const items: T[] = [];
  let page = await fetchPage({ limit: 100 });

  items.push(...(page.items ?? []));

  while (page.pages?.next) {
    page = await fetchPage({ pageUrl: page.pages.next });
    items.push(...(page.items ?? []));
  }

  return items;
}

function extractLinkIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return undefined;
      }

      const candidate = item as { sys?: { id?: unknown } };
      return typeof candidate.sys?.id === 'string' ? candidate.sys.id : undefined;
    })
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function pickLocalizedString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  for (const localizedValue of Object.values(value as Record<string, unknown>)) {
    if (typeof localizedValue === 'string' && localizedValue.trim()) {
      return localizedValue.trim();
    }
  }

  return undefined;
}

function pickLocalizedStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  for (const localizedValue of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(localizedValue)) {
      return localizedValue.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  }

  return [];
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|');
}
