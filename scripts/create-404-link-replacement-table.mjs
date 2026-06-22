#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import contentfulManagement from 'contentful-management';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = process.cwd();
const INPUT_XLSX = path.join(ROOT_DIR, 'source/404issues/404-links.xlsx');
const OUTPUT_DIR = path.join(ROOT_DIR, 'source/404issues');
const CACHE_DIR = path.join(ROOT_DIR, 'build/link-mapping');
const OUTPUT_CSV = path.join(OUTPUT_DIR, '404-links-with-replacements.csv');
const OUTPUT_XLSX = path.join(OUTPUT_DIR, '404-links-with-replacements.xlsx');
const DECISIONS_OUTPUT = path.join(CACHE_DIR, '404-link-replacement-decisions.json');
const SEARCH_INDEX_CACHE = path.join(CACHE_DIR, 'new-site-search-index.json');
const LEGACY_METADATA_CACHE = path.join(CACHE_DIR, '404-legacy-page-metadata.json');

const NEW_HOST = 'https://prd.quadient.mmt.digital';
const SEARCH_ENDPOINT = `${NEW_HOST}/api/search`;
const DEFAULT_LEGACY_HOST = 'https://www.quadient.com';
const LOCALE = 'en-US';
const PAGE_SIZE = 500;
const PAGE_CONTENT_TYPE_IDS = ['contentPage', 'resourcePage', 'homePage', 'listingPage', 'searchPage'];

const args = new Set(process.argv.slice(2));
const refresh = args.has('--refresh');
const offline = args.has('--offline');
const refreshContentful = args.has('--refresh-contentful') || refresh;

const EXTRA_COLUMNS = [
  'Link mapping status',
  'Internal contentful match',
  'Link context summary',
  'Replacement link',
  'Replacement reasoning'
];

const LOCALE_SEGMENTS = new Set([
  'en',
  'en-us',
  'en-ca',
  'fr-ca',
  'en-gb',
  'en-int',
  'fr',
  'de',
  'it',
  'es',
  'pt',
  'ja',
  'no-no'
]);

const OUTPUT_LOCALE_BY_SEGMENT = new Map([
  ['en-ca', 'en-ca'],
  ['fr-ca', 'fr-ca'],
  ['en-gb', 'en-gb'],
  ['en-int', 'en-int'],
  ['en-us', 'en-us'],
  ['en', 'en-us']
]);

const CONTENTFUL_LOCALE_BY_SEGMENT = new Map([
  ['en-us', 'en-US'],
  ['en', 'en-US'],
  ['en-ca', 'en-CA'],
  ['fr-ca', 'fr-CA'],
  ['en-gb', 'en-GB'],
  ['en-int', 'en']
]);

const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'all',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'best',
  'better',
  'by',
  'can',
  'com',
  'do',
  'does',
  'for',
  'from',
  'get',
  'guide',
  'has',
  'have',
  'help',
  'helps',
  'here',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'learn',
  'more',
  'new',
  'now',
  'of',
  'on',
  'or',
  'our',
  'page',
  'quadient',
  're',
  's',
  'site',
  'the',
  'their',
  'this',
  'to',
  'top',
  'us',
  'use',
  'using',
  'ways',
  'we',
  'webinar',
  'what',
  'when',
  'where',
  'why',
  'will',
  'with',
  'you',
  'your'
]);

const MANUAL_FALLBACKS = [
  ['blog', 'Learn: Blog / Newsletter', 'Quadient articles, thought leadership, and blog content.'],
  ['news', 'Press / News', 'Quadient company news and press releases.'],
  ['resources', 'Resources', 'Quadient resource library.'],
  ['ebooks-papers', 'eBooks & Papers', 'Quadient guides, reports, papers, and downloadable resources.'],
  ['case-studies', 'Case Studies', 'Quadient customer stories and case studies.'],
  ['webinars-events', 'Webinar & Events', 'Quadient webinars, events, and on-demand sessions.'],
  ['calculators', 'Calculators', 'Quadient calculators and ROI tools.'],
  ['ar-automation', 'Accounts Receivable Automation', 'Quadient accounts receivable automation solution overview.'],
  ['ap-automation', 'Accounts Payable Automation', 'Quadient accounts payable automation solution overview.'],
  ['automate-finance-operations', 'Automate Finance Operations', 'Quadient finance automation solutions.'],
  ['customer-communications', 'Customer Communications Management', 'Quadient customer communications management solution overview.'],
  ['elevate-customer-communications', 'Elevate Customer Communications', 'Quadient customer communications and experience solutions.'],
  ['mail-shipping-automation', 'Mailing and Shipping Automation', 'Quadient mailing and shipping automation solutions.'],
  ['finance', 'Finance', 'Quadient solutions for financial services and finance teams.'],
  ['privacy-compliance', 'Privacy compliance', 'Quadient privacy and compliance information.'],
  ['privacy-terms', 'Privacy and Cookies', 'Quadient privacy and cookie terms.']
].map(([slug, title, description]) => ({ slug, title, description, pageType: 'ManualFallback' }));

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const { headers, rows } = readWorkbook(INPUT_XLSX);
  const rowObjects = rows.map((row) => rowToObject(headers, row));
  const uniqueDestinations = unique(rowObjects.map((row) => row.Destination).filter(Boolean));

  console.log(`Read ${rowObjects.length} rows and ${uniqueDestinations.length} unique 404 destinations.`);

  const [searchIndex, slugIndex] = await Promise.all([getSearchIndex(), getContentfulSlugIndex()]);
  const candidates = buildCandidates(searchIndex);
  const rowsByDestination = groupRowsBy(rowObjects, 'Destination');
  const analyses = new Map(uniqueDestinations.map((destination) => [destination, analyzeDestination(destination)]));
  const internalDecisions = new Map();
  const nonInternalDestinations = [];

  for (const destination of uniqueDestinations) {
    const analysis = analyses.get(destination);
    const internalMatches = findInternalMatches(analysis, slugIndex.matchesBySlug);

    if (internalMatches.length > 0) {
      internalDecisions.set(destination, buildInternalDecision(destination, rowsByDestination.get(destination) ?? [], analysis, internalMatches));
    } else {
      nonInternalDestinations.push(destination);
    }
  }

  console.log(
    `Internal Contentful check: ${internalDecisions.size} destinations already have a matching Contentful page; ${nonInternalDestinations.length} need replacement matching.`
  );

  const legacyMetadata = await getLegacyMetadata(
    nonInternalDestinations.map((destination) => analyses.get(destination).legacyUrl).filter(Boolean)
  );

  const decisions = new Map(internalDecisions);
  for (const destination of nonInternalDestinations) {
    const analysis = analyses.get(destination);
    const rowsForDestination = rowsByDestination.get(destination) ?? [];
    decisions.set(
      destination,
      decideReplacement(destination, rowsForDestination, analysis, legacyMetadata[analysis.legacyUrl], candidates)
    );
  }

  const enrichedRows = rowObjects.map((row) => {
    const decision = decisions.get(row.Destination);
    return {
      ...row,
      'Link mapping status': decision?.status ?? '',
      'Internal contentful match': decision?.internalMatchSummary ?? '',
      'Link context summary': summarizeContext(row, decision),
      'Replacement link': decision?.replacementLink ?? '',
      'Replacement reasoning': decision?.reasoning ?? ''
    };
  });

  const outputHeaders = [...headers, ...EXTRA_COLUMNS];

  await fs.writeFile(OUTPUT_CSV, renderCsv(outputHeaders, enrichedRows), 'utf8');
  await writeWorkbook(OUTPUT_XLSX, outputHeaders, enrichedRows);
  await fs.writeFile(
    DECISIONS_OUTPUT,
    JSON.stringify([...decisions.entries()].map(([destination, decision]) => ({ destination, ...decision })), null, 2),
    'utf8'
  );

  printSummary([...decisions.values()], slugIndex.entriesScanned);
  console.log(`CSV written: ${OUTPUT_CSV}`);
  console.log(`XLSX written: ${OUTPUT_XLSX}`);
  console.log(`Decision details written: ${DECISIONS_OUTPUT}`);
}

function buildInternalDecision(destination, rows, analysis, internalMatches) {
  const target = selectInternalMatch(internalMatches, analysis);
  const outputLocale = analysis.outputLocale ?? 'en-us';
  const replacementLink = `${NEW_HOST}/${outputLocale}/${target.slug}`;
  const internalMatchSummary = internalMatches
    .slice(0, 4)
    .map((match) =>
      `${match.contentType}:${match.entryId} slug=${match.slug}${match.locale ? ` locale=${match.locale}` : ''}${match.internalName ? ` name="${match.internalName}"` : ''}`
    )
    .join('; ');

  return {
    status: 'page in contentful',
    replacementLink,
    internalMatchSummary,
    confidence: 'high',
    score: 100,
    originalTitle: titleFromSlug(analysis.bestSlug ?? analysis.destinationSlug),
    topic: inferTopic(`${analysis.destinationSlug} ${summarizeRowsForScoring(rows)}`),
    resourceKind: inferResourceKind(analysis),
    reasoning:
      `Destination normalizes to "${target.slug}", which exists as a ${target.contentType} entry in Contentful. Use the normalized internal URL instead of the 404 URL.`,
    signals: ['contentful slug match'],
    matchedSlug: target.slug,
    candidateSlugs: analysis.candidateSlugs,
    legacyUrl: analysis.legacyUrl
  };
}

function decideReplacement(destination, rows, analysis, legacy, candidates) {
  const sourceContext = summarizeRowsForScoring(rows);
  const anchorContext = unique(rows.map((row) => cleanText(row.Anchor)).filter(Boolean)).slice(0, 8).join(' ');
  const targetTitle = cleanPageTitle(legacy?.title) || cleanText(anchorContext) || titleFromSlug(analysis.bestSlug ?? analysis.destinationSlug);
  const targetDescription = cleanText(legacy?.description || legacy?.h1);
  const targetText = [
    targetTitle,
    targetDescription,
    analysis.destinationSlug,
    analysis.candidateSlugs.join(' '),
    sourceContext,
    anchorContext
  ].join(' ');
  const target = {
    destination,
    analysis,
    title: targetTitle,
    description: targetDescription,
    allText: targetText,
    titleTokens: tokens(targetTitle),
    descriptionTokens: tokens(targetDescription),
    slugTokens: tokens(analysis.destinationSlug),
    contextTokens: tokens(`${sourceContext} ${anchorContext}`),
    topic: inferTopic(targetText),
    resourceKind: inferResourceKind(analysis, targetText)
  };

  const scored = candidates
    .map((candidate) => scoreCandidate(target, candidate))
    .sort((left, right) => right.score - left.score);
  let best = scored[0];

  if (!best || best.score < 6 || (best.score < 18 && !hasSpecificSignal(best) && specificOverlapCount(target, best.candidate) < 2)) {
    const fallback = fallbackCandidate(target, candidates);
    if (fallback) {
      best = {
        candidate: fallback,
        score: Math.max(best?.score ?? 0, 12),
        signals: ['fallback by topic/resource type']
      };
    }
  }

  const second = scored.find((item) => item.candidate.slug !== best?.candidate.slug);
  const confidence = classifyConfidence(best?.score ?? 0, second?.score ?? 0);

  return {
    status: 'replacement suggested',
    replacementLink: best?.candidate.url ?? '',
    internalMatchSummary: '',
    confidence,
    score: round(best?.score ?? 0),
    originalTitle: targetTitle,
    topic: target.topic,
    resourceKind: target.resourceKind,
    reasoning: buildReasoning(target, best, confidence),
    signals: best?.signals ?? [],
    secondBest: second
      ? { slug: second.candidate.slug, title: second.candidate.title, score: round(second.score) }
      : null,
    candidateSlugs: analysis.candidateSlugs,
    legacyUrl: analysis.legacyUrl
  };
}

function analyzeDestination(destination) {
  const url = new URL(destination);
  const allSegments = splitPath(url.pathname);
  const stagingLocale = LOCALE_SEGMENTS.has(allSegments[0]) ? allSegments[0] : '';
  const outputLocale = OUTPUT_LOCALE_BY_SEGMENT.get(stagingLocale) ?? 'en-us';
  let segments = [...allSegments];

  if (isStagingHost(url.hostname) && LOCALE_SEGMENTS.has(segments[0])) {
    segments = segments.slice(1);
  }

  let embeddedHost = '';
  if (segments[0] && isDomainSegment(segments[0])) {
    embeddedHost = segments[0].replace(/^www\./, '');
    segments = segments.slice(1);
  }

  const embeddedLocale = LOCALE_SEGMENTS.has(segments[0]) ? segments[0] : '';
  const slugBaseSegments = trimLeadingLocales(segments);
  const candidateSlugs = buildCandidateSlugs(segments);
  const destinationSlug = candidateSlugs[0] ?? slugBaseSegments.join('/');
  const bestSlug = candidateSlugs.find((slug) => slug.split('/').length > 1) ?? candidateSlugs[0] ?? '';
  const legacyLocale = embeddedLocale || (stagingLocale === 'fr-ca' ? 'fr-ca' : stagingLocale === 'en-ca' ? 'en-ca' : 'en');
  const legacyHost = embeddedHost === 'mail.quadient.com' ? 'https://mail.quadient.com' : DEFAULT_LEGACY_HOST;
  const legacyPathSegments =
    embeddedHost && LOCALE_SEGMENTS.has(embeddedLocale)
      ? [embeddedLocale, ...trimLeadingLocales(segments)]
      : [legacyLocale, ...trimLeadingLocales(segments)];
  const legacyUrl = `${legacyHost}/${legacyPathSegments.filter(Boolean).join('/')}`;

  return {
    url,
    stagingLocale,
    outputLocale,
    embeddedHost,
    embeddedLocale,
    segments,
    candidateSlugs,
    destinationSlug,
    bestSlug,
    legacyUrl
  };
}

function buildCandidateSlugs(segments) {
  const candidates = [];
  const cleaned = trimLeadingLocales(removeLeadingDomain(segments));
  if (cleaned.length > 0) {
    candidates.push(cleaned.join('/'));
  }

  for (let index = 0; index < segments.length; index += 1) {
    const suffix = trimLeadingLocales(removeLeadingDomain(segments.slice(index)));
    if (suffix.length > 0) {
      candidates.push(suffix.join('/'));
      candidates.push(...collapseRepeatedPrefixes(suffix));
    }
  }

  return unique(
    candidates
      .map(normalizeSlugPath)
      .filter((slug) => slug && !isDomainSegment(slug.split('/')[0]) && !LOCALE_SEGMENTS.has(slug))
  );
}

function collapseRepeatedPrefixes(segments) {
  const collapsed = [];
  for (let size = 1; size <= Math.floor(segments.length / 2); size += 1) {
    const first = segments.slice(0, size).join('/');
    const second = segments.slice(size, size * 2).join('/');
    if (first === second) {
      collapsed.push(segments.slice(size).join('/'));
    }
  }
  return collapsed;
}

function findInternalMatches(analysis, matchesBySlug) {
  const matches = [];
  const seen = new Set();
  for (const candidateSlug of analysis.candidateSlugs) {
    const slugMatches = matchesBySlug.get(normalizeSlugForLookup(candidateSlug)) ?? [];
    for (const match of slugMatches) {
      const key = `${match.entryId}:${match.locale ?? ''}:${match.slug}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ ...match, matchedCandidateSlug: candidateSlug });
      }
    }
  }
  return matches;
}

function selectInternalMatch(matches, analysis) {
  const desiredContentfulLocale = CONTENTFUL_LOCALE_BY_SEGMENT.get(analysis.outputLocale);
  const exactLocale = matches.find((match) => match.locale === desiredContentfulLocale);
  if (exactLocale) return exactLocale;
  const enUs = matches.find((match) => match.locale === 'en-US');
  if (enUs) return enUs;
  return matches[0];
}

async function getContentfulSlugIndex() {
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID ?? 'master';
  const cachePath = path.join(CACHE_DIR, `contentful-page-slug-index-${environmentId}.json`);
  if (!refreshContentful) {
    const cached = await readJsonIfExists(cachePath);
    if (cached?.matches?.length) {
      return hydrateSlugIndex(cached);
    }
  }

  if (offline) {
    throw new Error(`Missing Contentful slug cache: ${cachePath}`);
  }

  const token = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  if (!token || !spaceId) {
    throw new Error('CONTENTFUL_MANAGEMENT_TOKEN and CONTENTFUL_SPACE_ID are required for the internal page check.');
  }

  const client = contentfulManagement.createClient({
    accessToken: token,
    host: process.env.CONTENTFUL_HOST,
    hostUpload: process.env.CONTENTFUL_HOST_UPLOAD,
    throttle: 'auto'
  });
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const matches = [];
  let entriesScanned = 0;

  for (const contentType of PAGE_CONTENT_TYPE_IDS) {
    const entries = await fetchEntries(environment, { content_type: contentType }, PAGE_SIZE);
    entriesScanned += entries.length;
    console.log(`Scanned ${entries.length} ${contentType} entries for Contentful slug check.`);

    for (const entry of entries) {
      const entryId = entry?.sys?.id ?? '';
      const internalName = firstLocalizedStringValue(entry, 'internalName') ?? '';
      for (const { locale, value } of getFieldValues(entry, 'slug')) {
        const slug = normalizeSlugForLookup(stringifyFieldValue(value));
        if (!entryId || !slug) continue;
        matches.push({ slug, contentType, entryId, internalName, locale });
      }
    }
  }

  const payload = { generatedAt: new Date().toISOString(), environmentId, entriesScanned, matches };
  await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8');
  return hydrateSlugIndex(payload);
}

function hydrateSlugIndex(payload) {
  const matchesBySlug = new Map();
  for (const match of payload.matches ?? []) {
    const matches = matchesBySlug.get(match.slug) ?? [];
    matches.push(match);
    matchesBySlug.set(match.slug, matches);
  }
  return {
    entriesScanned: payload.entriesScanned ?? 0,
    matchesBySlug
  };
}

async function fetchEntries(environment, query, pageSize) {
  const entries = [];
  let skip = 0;
  let total = 0;
  do {
    const response = await environment.getEntries({ ...query, limit: pageSize, skip });
    entries.push(...(response.items ?? []));
    total = response.total ?? entries.length;
    skip += pageSize;
  } while (skip < total);
  return entries;
}

async function getSearchIndex() {
  if (!refresh) {
    const cached = await readJsonIfExists(SEARCH_INDEX_CACHE);
    if (cached?.items?.length) return cached.items;
  }
  if (offline) throw new Error(`Missing search index cache: ${SEARCH_INDEX_CACHE}`);

  const response = await fetch(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term: '', page: 1, take: 2500, categories: [], locale: LOCALE })
  });
  if (!response.ok) {
    throw new Error(`Search index fetch failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  await fs.writeFile(SEARCH_INDEX_CACHE, JSON.stringify(payload, null, 2), 'utf8');
  return payload.items ?? [];
}

async function getLegacyMetadata(legacyUrls) {
  const uniqueUrls = unique(legacyUrls);
  const cache = (!refresh && (await readJsonIfExists(LEGACY_METADATA_CACHE))) || {};
  const missing = uniqueUrls.filter((url) => !cache[url]);

  if (offline && missing.length > 0) {
    throw new Error(`Missing ${missing.length} legacy metadata records in ${LEGACY_METADATA_CACHE}`);
  }

  if (missing.length > 0) {
    console.log(`Fetching ${missing.length} legacy/source page metadata records...`);
    const fetched = await mapLimit(missing, 8, async (url, index) => {
      if ((index + 1) % 100 === 0) {
        console.log(`Fetched ${index + 1}/${missing.length} metadata records...`);
      }
      return [url, await fetchPageMetadata(url)];
    });
    for (const [url, metadata] of fetched) {
      cache[url] = metadata;
    }
    await fs.writeFile(LEGACY_METADATA_CACHE, JSON.stringify(cache, null, 2), 'utf8');
  }

  return cache;
}

async function fetchPageMetadata(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'contentful-importer-404-link-mapping/1.0' }
    });
    const contentType = response.headers.get('content-type') ?? '';
    const text = contentType.includes('text/html') ? await response.text() : '';
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      title: cleanPageTitle(extractFirstTagText(text, 'title')),
      description: cleanText(extractMeta(text, 'description') || extractMeta(text, 'og:description')),
      h1: cleanText(extractFirstTagText(text, 'h1')),
      canonical: extractCanonical(text)
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      title: '',
      description: '',
      h1: '',
      canonical: '',
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidates(searchItems) {
  const bySlug = new Map();
  for (const item of [...searchItems, ...MANUAL_FALLBACKS]) {
    const slug = normalizeCandidateSlug(item.slug);
    if (!slug || bySlug.has(slug)) continue;
    const categories = Array.isArray(item.categories) ? item.categories : [];
    const candidate = {
      slug,
      url: `${NEW_HOST}/en-us/${slug}`,
      title: cleanText(item.title),
      description: cleanText(item.description),
      pageType: item.pageType ?? '',
      categories,
      categoryNames: categories.map((category) => category.name).filter(Boolean),
      resourceTypes: categories
        .filter((category) => category.schemeId === 'resourceType')
        .map((category) => normalizeToken(category.name)),
      categoryIds: new Set(categories.map((category) => normalizeToken(category.id))),
      pathType: slug.split('/')[0],
      lastSlug: slug.split('/').at(-1) ?? slug
    };
    candidate.titleTokens = tokens(candidate.title);
    candidate.descriptionTokens = tokens(candidate.description);
    candidate.slugTokens = tokens(candidate.slug);
    candidate.categoryTokens = tokens(candidate.categoryNames.join(' '));
    candidate.allTokens = new Set([
      ...candidate.titleTokens,
      ...candidate.descriptionTokens,
      ...candidate.slugTokens,
      ...candidate.categoryTokens
    ]);
    candidate.titleTokenSet = new Set(candidate.titleTokens);
    candidate.slugTokenSet = new Set(candidate.slugTokens);
    bySlug.set(slug, candidate);
  }
  return [...bySlug.values()];
}

function scoreCandidate(target, candidate) {
  let score = 0;
  const signals = [];
  const oldTailNorm = normalizeSlug(target.analysis.bestSlug?.split('/').at(-1) ?? '');
  const candidateTailNorm = normalizeSlug(candidate.lastSlug);
  const targetTitleNorm = normalizePhrase(target.title);
  const candidateTitleNorm = normalizePhrase(candidate.title);

  if (oldTailNorm && oldTailNorm === candidateTailNorm && oldTailNorm.length > 3) {
    score += 35;
    signals.push('same terminal slug');
  } else if (oldTailNorm.length > 10 && normalizeSlug(candidate.slug).includes(oldTailNorm)) {
    score += 20;
    signals.push('old slug contained in new URL');
  } else if (candidateTailNorm.length > 10 && oldTailNorm.includes(candidateTailNorm)) {
    score += 12;
    signals.push('new terminal slug contained in old slug');
  }

  if (targetTitleNorm && candidateTitleNorm) {
    if (targetTitleNorm === candidateTitleNorm) {
      score += 30;
      signals.push('same page title');
    } else if (targetTitleNorm.length > 12 && candidateTitleNorm.includes(targetTitleNorm)) {
      score += 16;
      signals.push('old title contained in new title');
    } else if (candidateTitleNorm.length > 12 && targetTitleNorm.includes(candidateTitleNorm)) {
      score += 12;
      signals.push('new title contained in old title');
    }
  }

  const titleCoverage = weightedCoverage(target.titleTokens, [
    candidate.titleTokenSet,
    candidate.slugTokenSet,
    candidate.allTokens
  ]);
  const slugCoverage = weightedCoverage(target.slugTokens, [
    candidate.slugTokenSet,
    candidate.titleTokenSet,
    candidate.allTokens
  ]);
  const descriptionCoverage = coverage(target.descriptionTokens, candidate.allTokens);
  const contextCoverage = coverage(target.contextTokens, candidate.allTokens);

  score += 13 * titleCoverage;
  score += 8 * slugCoverage;
  score += 3 * descriptionCoverage;
  score += 2 * contextCoverage;

  if (titleCoverage >= 0.55) signals.push('strong title/topic token overlap');
  else if (slugCoverage >= 0.5) signals.push('strong URL token overlap');

  const pathScore = scorePathPreference(target, candidate);
  if (pathScore.score !== 0) {
    score += pathScore.score;
    signals.push(pathScore.signal);
  }
  const topicScore = scoreTopicPreference(target, candidate);
  if (topicScore.score !== 0) {
    score += topicScore.score;
    signals.push(topicScore.signal);
  }

  if (candidate.slug.split('/').length === 1 && oldTailNorm !== normalizeSlug(candidate.slug)) score -= 2.5;
  if (/^(careers\/jobs|sub-processor|test-|preferences|preference-center|terms|digital-terms)/.test(candidate.slug)) score -= 16;
  if (candidate.categoryIds.has('partner') && !target.analysis.destinationSlug.includes('partner')) score -= 10;

  return { candidate, score, signals: unique(signals).slice(0, 5) };
}

function scorePathPreference(target, candidate) {
  const type = target.analysis.bestSlug?.split('/')[0] ?? '';
  const kind = target.resourceKind;
  const candidateResourceTypes = new Set(candidate.resourceTypes);
  if (type === 'blog' && candidate.pathType === 'blog') return { score: 8, signal: 'keeps blog/article destination type' };
  if (type === 'news' && (candidate.pathType === 'blog' || candidate.pathType === 'news')) {
    return { score: 8, signal: 'maps legacy news to new news/article area' };
  }
  if (type === 'resources') {
    if (kind === 'webinar' && (candidate.pathType.includes('webinar') || candidateResourceTypes.has('webinar'))) return { score: 12, signal: 'matches webinar resource type' };
    if (kind === 'case-study' && (candidate.pathType === 'case-studies' || candidateResourceTypes.has('case-study'))) return { score: 12, signal: 'matches case study resource type' };
    if (kind === 'calculator' && candidate.pathType === 'calculators') return { score: 12, signal: 'matches calculator resource type' };
    if (kind === 'video' && (candidateResourceTypes.has('video') || candidate.title.toLowerCase().includes('video'))) return { score: 10, signal: 'matches video resource type' };
    if (
      ['ebook-paper', 'analyst-report', 'brochure', 'infographic'].includes(kind) &&
      (candidate.pathType === 'ebooks-papers' ||
        candidateResourceTypes.has('ebook') ||
        candidateResourceTypes.has('white-paper') ||
        candidateResourceTypes.has('analyst-report') ||
        candidateResourceTypes.has('brochure') ||
        candidateResourceTypes.has('infographic'))
    ) return { score: 9, signal: 'matches downloadable resource type' };
  }
  return { score: 0, signal: '' };
}

function scoreTopicPreference(target, candidate) {
  const categoryText = normalizePhrase(candidate.categoryNames.join(' '));
  const slug = candidate.slug;
  if (target.topic === 'accounts payable' && (slug.startsWith('learn/accounts-payable') || slug === 'ap-automation' || categoryText.includes('accounts payable'))) return { score: 9, signal: 'matches accounts payable topic' };
  if (target.topic === 'accounts receivable' && (slug.startsWith('learn/accounts-receivable') || slug === 'ar-automation' || categoryText.includes('accounts receivable'))) return { score: 9, signal: 'matches accounts receivable topic' };
  if (target.topic === 'customer communications' && (slug.startsWith('learn/customer-communications') || slug === 'customer-communications' || slug === 'elevate-customer-communications' || categoryText.includes('customer communications') || categoryText.includes('customer experience'))) return { score: 8, signal: 'matches customer communications topic' };
  if (target.topic === 'mail and shipping' && (slug === 'mail-shipping-automation' || slug.includes('postage') || slug.includes('folder-inserters') || categoryText.includes('mail') || categoryText.includes('shipping') || categoryText.includes('postage'))) return { score: 8, signal: 'matches mail and shipping topic' };
  if (target.topic === 'finance' && (slug === 'finance' || categoryText.includes('financial services') || categoryText.includes('finance'))) return { score: 5, signal: 'matches finance context' };
  return { score: 0, signal: '' };
}

function fallbackCandidate(target, candidates) {
  const slug = fallbackSlug(target);
  return candidates.find((candidate) => candidate.slug === slug) ?? candidates.find((candidate) => candidate.slug === 'resources');
}

function fallbackSlug(target) {
  const type = target.analysis.bestSlug?.split('/')[0] ?? '';
  if (type === 'blog') return 'blog';
  if (type === 'news') return 'news';
  if (type === 'resources') {
    if (target.resourceKind === 'webinar') return 'webinars-events';
    if (target.resourceKind === 'case-study') return 'case-studies';
    if (target.resourceKind === 'calculator') return 'calculators';
    if (['ebook-paper', 'analyst-report', 'brochure', 'infographic', 'video'].includes(target.resourceKind)) return 'ebooks-papers';
    return 'resources';
  }
  if (target.topic === 'accounts payable') return 'ap-automation';
  if (target.topic === 'accounts receivable') return 'ar-automation';
  if (target.topic === 'customer communications') return 'customer-communications';
  if (target.topic === 'mail and shipping') return 'mail-shipping-automation';
  if (target.topic === 'finance') return 'finance';
  return 'resources';
}

function buildReasoning(target, best, confidence) {
  if (!best?.candidate) return 'No suitable new-site replacement could be identified.';
  const overlaps = topOverlap([...target.titleTokens, ...target.slugTokens], best.candidate.allTokens);
  const overlapText = overlaps.length > 0 ? ` Shared topic terms include ${overlaps.join(', ')}.` : '';
  const topicText = target.topic !== 'general' ? ` It stays within the ${target.topic} area.` : '';
  const resourceText = target.resourceKind !== 'general' ? ` It also matches the ${target.resourceKind.replace('-', ' ')} intent.` : '';
  const signalText = best.signals.length > 0 ? ` Signals: ${best.signals.join('; ')}.` : '';
  const confidenceText = confidence === 'low' ? ' This is a best-fit replacement because a one-to-one migrated page was not evident.' : '';
  return `Original 404 destination appears to target "${target.title}". "${best.candidate.title}" is the closest new-site match.${overlapText}${topicText}${resourceText}${signalText}${confidenceText}`.replace(/\s+/g, ' ').trim();
}

function summarizeContext(row, decision) {
  const source = cleanText(row.Source);
  const anchor = cleanText(row.Anchor);
  const destination = cleanText(row.Destination);
  const linkPath = cleanText(row['Link Path']);
  const pieces = [];
  if (source) pieces.push(`Found on ${source}`);
  if (anchor) pieces.push(`with anchor "${anchor}"`);
  if (destination) pieces.push(`pointing to ${destination}`);
  if (linkPath) pieces.push(`at ${linkPath}`);
  if (decision?.originalTitle) pieces.push(`targeting "${decision.originalTitle}"`);
  return `${pieces.join(' ')}.`;
}

function summarizeRowsForScoring(rows) {
  const values = [];
  for (const row of rows) values.push(row.Source, row.Anchor, row['Link Path'], row['Link Position']);
  return unique(values.filter(Boolean).map(cleanText)).slice(0, 20).join(' ');
}

function inferTopic(text) {
  const normalized = normalizePhrase(text);
  if (/\b(ap|payable|payables|invoice approval|invoice processing|purchase order|vendor|expense|payment automation)\b/.test(normalized)) return 'accounts payable';
  if (/\b(ar|receivable|receivables|collections|dso|cash application|cash flow|credit management)\b/.test(normalized)) return 'accounts receivable';
  if (/\b(ccm|cxm|customer communication|customer communications|customer experience|inspire|iforms|omnichannel|digital journey|journey mapping)\b/.test(normalized)) return 'customer communications';
  if (/\b(postage|mailing|mailroom|shipping|usps|fedex|ups|folder inserter|inserter|parcel|imi|mail automation)\b/.test(normalized)) return 'mail and shipping';
  if (/\b(finance|financial services|banking|insurance)\b/.test(normalized)) return 'finance';
  return 'general';
}

function inferResourceKind(analysis, text = '') {
  const normalized = normalizePhrase(`${analysis?.destinationSlug ?? ''} ${text}`);
  if (/\b(webinar|replay|on demand|on-demand|event|connects)\b/.test(normalized)) return 'webinar';
  if (/\b(case study|customer story|story|success story)\b/.test(normalized)) return 'case-study';
  if (/\b(calculator|roi)\b/.test(normalized)) return 'calculator';
  if (/\b(video)\b/.test(normalized)) return 'video';
  if (/\b(analyst|spark matrix|market report|leaderboard|report)\b/.test(normalized)) return 'analyst-report';
  if (/\b(brochure)\b/.test(normalized)) return 'brochure';
  if (/\b(infographic)\b/.test(normalized)) return 'infographic';
  if (/\b(ebook|e-book|guide|white paper|whitepaper|paper|checklist|template|survey)\b/.test(normalized)) return 'ebook-paper';
  return 'general';
}

function hasSpecificSignal(scoredCandidate) {
  return scoredCandidate.signals.some((signal) => /same|contained|strong title|strong URL|old slug|new terminal/i.test(signal));
}

function specificOverlapCount(target, candidate) {
  return topOverlap([...target.titleTokens, ...target.slugTokens], candidate.allTokens).length;
}

function classifyConfidence(score, secondScore) {
  if (score >= 35 || score - secondScore >= 15) return 'high';
  if (score >= 18 || score - secondScore >= 7) return 'medium';
  return 'low';
}

function printSummary(decisions, entriesScanned) {
  const statusCounts = countBy(decisions, (decision) => decision.status);
  const confidenceCounts = countBy(decisions, (decision) => decision.confidence);
  const blank = decisions.filter((decision) => !decision.replacementLink).length;
  console.log('Decision summary:', { statusCounts, confidenceCounts, blankReplacementLinks: blank, contentfulEntriesScanned: entriesScanned });
  const low = decisions.filter((decision) => decision.confidence === 'low').sort((a, b) => a.score - b.score).slice(0, 20);
  if (low.length > 0) {
    console.log('Lowest-confidence replacement examples:');
    for (const decision of low) console.log(`- ${decision.originalTitle} -> ${decision.replacementLink} (${decision.score})`);
  }
}

function weightedCoverage(tokensToMatch, candidateSets) {
  const uniqueTokens = unique(tokensToMatch).filter(Boolean);
  if (uniqueTokens.length === 0) return 0;
  let matched = 0;
  for (const token of uniqueTokens) {
    if (candidateSets[0]?.has(token)) matched += 1;
    else if (candidateSets[1]?.has(token)) matched += 0.85;
    else if (candidateSets[2]?.has(token)) matched += 0.45;
  }
  return matched / uniqueTokens.length;
}

function coverage(tokensToMatch, candidateSet) {
  const uniqueTokens = unique(tokensToMatch).filter(Boolean);
  if (uniqueTokens.length === 0) return 0;
  return uniqueTokens.filter((token) => candidateSet.has(token)).length / uniqueTokens.length;
}

function topOverlap(tokensToMatch, candidateSet) {
  return unique(tokensToMatch).filter((token) => candidateSet.has(token) && token.length > 2).slice(0, 5);
}

function tokens(value) {
  const rawTokens = normalizePhrase(value).split(' ').filter(Boolean);
  const expanded = [];
  for (const token of rawTokens) {
    if (STOP_WORDS.has(token)) continue;
    expanded.push(...expandToken(token));
    if (token === 'ar') expanded.push('accounts', 'receivable');
    if (token === 'ap') expanded.push('accounts', 'payable');
    if (token === 'ccm') expanded.push('customer', 'communications', 'management');
    if (token === 'cxm') expanded.push('customer', 'experience', 'management');
    if (token === 'ai') expanded.push('artificial', 'intelligence');
    if (token === 'dso') expanded.push('days', 'sales', 'outstanding');
    if (token === 'uspsr') expanded.push('usps');
  }
  return expanded.filter((token) => token.length > 2 || ['ap', 'ar', 'ai', 'ix', 'ds'].includes(token));
}

function expandToken(token) {
  const variants = [token];
  const synonymMap = {
    archiving: ['archive'],
    archive: ['archiving'],
    retrieval: ['retrieve', 'archive', 'document'],
    documents: ['document'],
    communications: ['communication'],
    customers: ['customer'],
    invoices: ['invoice'],
    invoicing: ['invoice'],
    payments: ['payment'],
    processes: ['process'],
    printers: ['printer'],
    providers: ['provider'],
    discounts: ['discount'],
    strategies: ['strategy'],
    businesses: ['business'],
    collections: ['collection'],
    suppliers: ['supplier'],
    managers: ['manager']
  };
  variants.push(...(synonymMap[token] ?? []));
  if (token.endsWith('ing') && token.length > 6) variants.push(token.slice(0, -3));
  if (token.endsWith('ies') && token.length > 5) variants.push(`${token.slice(0, -3)}y`);
  if (token.endsWith('es') && token.length > 5) variants.push(token.slice(0, -2));
  if (token.endsWith('s') && token.length > 4) variants.push(token.slice(0, -1));
  return unique(variants);
}

function readWorkbook(filePath) {
  const sharedStrings = readSharedStrings(filePath);
  const sheetXml = execFileSync('unzip', ['-p', filePath, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' });
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/r="([^"]+)"/)?.[1] ?? 'A1';
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      row[columnIndex(ref)] = readCellValue(body, type, sharedStrings);
    }
    rows.push(row.map((value) => value ?? ''));
  }
  const headers = rows[0] ?? [];
  return { headers, rows: rows.slice(1).map((row) => padRow(row, headers.length)) };
}

function readSharedStrings(filePath) {
  try {
    const xml = execFileSync('unzip', ['-p', filePath, 'xl/sharedStrings.xml'], { encoding: 'utf8' });
    return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
      xmlDecode([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(''))
    );
  } catch {
    return [];
  }
}

function readCellValue(body, type, sharedStrings) {
  const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'inlineStr') {
    const inline = body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '';
    return xmlDecode([...inline.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(''));
  }
  return raw ? xmlDecode(raw) : '';
}

function rowToObject(headers, row) {
  const item = {};
  headers.forEach((header, index) => { item[header] = row[index] ?? ''; });
  return item;
}

function padRow(row, length) {
  return Array.from({ length }, (_, index) => row[index] ?? '');
}

function columnIndex(cellRef) {
  let index = 0;
  for (const char of cellRef.match(/[A-Z]+/)?.[0] ?? 'A') index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

async function writeWorkbook(filePath, headers, rows) {
  const tempDir = path.join(CACHE_DIR, `.xlsx-${createHash('sha1').update(String(Date.now())).digest('hex').slice(0, 10)}`);
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(path.join(tempDir, '_rels'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'xl/worksheets'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'xl/_rels'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'docProps'), { recursive: true });
  const rowArrays = rows.map((row) => headers.map((header) => row[header] ?? ''));
  await fs.writeFile(path.join(tempDir, '[Content_Types].xml'), contentTypesXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, '_rels/.rels'), relsXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, 'xl/workbook.xml'), workbookXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, 'xl/_rels/workbook.xml.rels'), workbookRelsXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, 'xl/styles.xml'), stylesXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, 'xl/worksheets/sheet1.xml'), sheetXml([headers, ...rowArrays]), 'utf8');
  await fs.writeFile(path.join(tempDir, 'docProps/core.xml'), corePropsXml(), 'utf8');
  await fs.writeFile(path.join(tempDir, 'docProps/app.xml'), appPropsXml(), 'utf8');
  await fs.rm(filePath, { force: true });
  execFileSync('zip', ['-qr', filePath, '.'], { cwd: tempDir });
  await fs.rm(tempDir, { recursive: true, force: true });
}

function sheetXml(rows) {
  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowNumber}`;
      const stringValue = String(value ?? '');
      return `<c r="${ref}" t="inlineStr"><is><t${stringValue.match(/^\s|\s$/) ? ' xml:space="preserve"' : ''}>${xmlEscape(stringValue)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');
  const lastCell = `${columnName(rows[0].length - 1)}${rows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function renderCsv(headers, rows) {
  return `${[headers.map(csvEscape).join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? '')).join(','))].join('\n')}\n`;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="404 link replacements" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function corePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>contentful-importer</dc:creator><cp:lastModifiedBy>contentful-importer</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>contentful-importer</Application></Properties>`;
}

function splitPath(pathname) {
  return safeDecode(pathname).split('/').filter(Boolean).map((segment) => segment.trim()).filter(Boolean);
}

function trimLeadingLocales(segments) {
  let result = [...segments];
  while (LOCALE_SEGMENTS.has(result[0])) result = result.slice(1);
  return result;
}

function removeLeadingDomain(segments) {
  let result = [...segments];
  while (result[0] && isDomainSegment(result[0])) result = result.slice(1);
  return result;
}

function normalizeSlugPath(value) {
  return safeDecode(String(value ?? '')).replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+$/, '').replace(/\s+/g, '-');
}

function normalizeCandidateSlug(slug) {
  return normalizeSlugPath(slug).replace(/^en-us\/?/i, '');
}

function normalizeSlugForLookup(value) {
  return normalizeSlugPath(value).toLowerCase();
}

function isStagingHost(hostname) {
  return hostname === 'prd.quadient.mmt.digital' || hostname === 'prd.web.quadient.com';
}

function isDomainSegment(segment) {
  return /(^|\.)quadient\.com$/i.test(segment) || /^mail\.quadient\.com$/i.test(segment);
}

function titleFromSlug(slug) {
  return safeDecode(slug ?? '').replace(/[-_/]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
}

function groupRowsBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function getFieldValues(entry, fieldId) {
  const localizedValues = entry?.fields?.[fieldId];
  if (!localizedValues || typeof localizedValues !== 'object') return [];
  return Object.entries(localizedValues).map(([locale, value]) => ({ locale, value }));
}

function firstLocalizedStringValue(entry, fieldId) {
  for (const { value } of getFieldValues(entry, fieldId)) {
    const stringValue = stringifyFieldValue(value);
    if (stringValue) return stringValue;
  }
  return undefined;
}

function stringifyFieldValue(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeToken(value) {
  return normalizePhrase(value).replace(/\s+/g, '-');
}

function normalizePhrase(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function normalizeSlug(value) {
  return normalizePhrase(value).replace(/\s+/g, '-').replace(/^-|-$/g, '');
}

function cleanPageTitle(value) {
  const cleaned = cleanText(value).replace(/\s*\|\s*Quadient.*$/i, '').replace(/\s*-\s*Quadient.*$/i, '').trim();
  return /^(404 not found|404|not found|welcome)$/i.test(cleaned) ? '' : cleaned;
}

function cleanText(value) {
  return htmlDecode(String(value ?? '')).replace(/<[^>]+>/g, ' ').replace(/[\u00a0\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractMeta(html, name) {
  if (!html) return '';
  const escaped = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return htmlDecode(match[1]);
  }
  return '';
}

function extractCanonical(html) {
  if (!html) return '';
  return htmlDecode(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? '');
}

function extractFirstTagText(html, tagName) {
  if (!html) return '';
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  return htmlDecode(html.match(pattern)?.[1] ?? '').replace(/<[^>]+>/g, ' ');
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== ''))];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function htmlDecode(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function xmlDecode(value) {
  return htmlDecode(value);
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
