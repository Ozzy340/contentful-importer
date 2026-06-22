#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const INPUT_XLSX = path.join(ROOT_DIR, 'source/new link mapping/bad_link_formatting.xlsx');
const OUTPUT_DIR = path.join(ROOT_DIR, 'source/new link mapping');
const CACHE_DIR = path.join(ROOT_DIR, 'build/link-mapping');
const SEARCH_INDEX_CACHE = path.join(CACHE_DIR, 'new-site-search-index.json');
const LEGACY_METADATA_CACHE = path.join(CACHE_DIR, 'legacy-page-metadata.json');
const DECISIONS_OUTPUT = path.join(CACHE_DIR, 'bad-link-replacement-decisions.json');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'bad_link_formatting_with_replacements.csv');
const OUTPUT_XLSX = path.join(OUTPUT_DIR, 'bad_link_formatting_with_replacements.xlsx');

const LEGACY_HOST = 'https://www.quadient.com';
const NEW_HOST = 'https://prd.quadient.mmt.digital';
const SEARCH_ENDPOINT = `${NEW_HOST}/api/search`;
const LOCALE = 'en-US';

const EXTRA_COLUMNS = [
  'Link context summary',
  'Replacement link',
  'Replacement reasoning'
];

const args = new Set(process.argv.slice(2));
const refresh = args.has('--refresh');
const offline = args.has('--offline');

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'all',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'back',
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
  'should',
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
  {
    slug: 'blog',
    pageType: 'ListingPageViewModel',
    title: 'Learn: Blog / Newsletter',
    description: 'Quadient articles, thought leadership, and blog content.'
  },
  {
    slug: 'news',
    pageType: 'ListingPageViewModel',
    title: 'Press / News',
    description: 'Quadient company news and press releases.'
  },
  {
    slug: 'resources',
    pageType: 'ListingPageViewModel',
    title: 'Resources',
    description: 'Quadient resource library.'
  },
  {
    slug: 'ebooks-papers',
    pageType: 'ListingPageViewModel',
    title: 'eBooks & Papers',
    description: 'Quadient guides, reports, papers, and downloadable resources.'
  },
  {
    slug: 'case-studies',
    pageType: 'ListingPageViewModel',
    title: 'Case Studies',
    description: 'Quadient customer stories and case studies.'
  },
  {
    slug: 'webinars-events',
    pageType: 'ListingPageViewModel',
    title: 'Webinar & Events',
    description: 'Quadient webinars, events, and on-demand sessions.'
  },
  {
    slug: 'calculators',
    pageType: 'ListingPageViewModel',
    title: 'Calculators',
    description: 'Quadient calculators and ROI tools.'
  },
  {
    slug: 'ar-automation',
    pageType: 'ContentPageViewModel',
    title: 'Accounts Receivable Automation',
    description: 'Quadient accounts receivable automation solution overview.'
  },
  {
    slug: 'ap-automation',
    pageType: 'ContentPageViewModel',
    title: 'Accounts Payable Automation',
    description: 'Quadient accounts payable automation solution overview.'
  },
  {
    slug: 'automate-finance-operations',
    pageType: 'ContentPageViewModel',
    title: 'Automate Finance Operations',
    description: 'Quadient finance automation solutions.'
  },
  {
    slug: 'customer-communications',
    pageType: 'ContentPageViewModel',
    title: 'Customer Communications Management',
    description: 'Quadient customer communications management solution overview.'
  },
  {
    slug: 'elevate-customer-communications',
    pageType: 'ContentPageViewModel',
    title: 'Elevate Customer Communications',
    description: 'Quadient customer communications and experience solutions.'
  },
  {
    slug: 'mail-shipping-automation',
    pageType: 'ContentPageViewModel',
    title: 'Mailing and Shipping Automation',
    description: 'Quadient mailing and shipping automation solutions.'
  },
  {
    slug: 'finance',
    pageType: 'ContentPageViewModel',
    title: 'Finance',
    description: 'Quadient solutions for financial services and finance teams.'
  }
];

const MANUAL_REPLACEMENT_SLUGS = new Map([
  ['/en/resources/personalization-heart-customer-experience', 'learn/customer-communications/customer-experience-management'],
  ['/en/resources/top-10-documents-every-smb-should-automate-now', 'learn/document-automation/what-is-document-automation'],
  ['/en/resources/quadients-digital-now-program-kickstarts-digital-transformation-service-providers', 'learn/customer-communications/digital-transformation'],
  ['/en/resources/beanworks-centralized-ap-solution-empowers-homepoint-staff', 'case-studies'],
  ['/en/ar-automation/how-cloud-technology-giving-finance-leaders-competitive-advantage', 'learn/accounts-receivable/ar-automation-benefits'],
  ['/en/resources/b2b-payment-trends-today-impacting-cash-flow-success-tomorrow', 'blog/5-payment-strategies-optimizing-cash-flow'],
  ['/en/resources/hybrid-communication-benefits-and-challenges', 'learn/customer-communications/choosing-customer-communication-channels'],
  ['/en/news/making-tax-digital-now-law-are-you-paperless-ready', 'learn/invoicing/benefits-of-invoicing-software'],
  ['/en/resources/revolutionizing-ap-efficiency-in-construction-super-mixs-journey-with-quadient-ap', 'ap-automation'],
  ['/en/resources/stay-ahead-marketing-curve-dynamic-communications', 'blog/multichannel-communications-how-it-works'],
  ['/en/mammoth-carbon-case-study', 'case-studies'],
  ['/en/resources/outbound-communications-maturity-model-creating-roadmap-transform-your-customer-0', 'learn/customer-communications/ccm-strategy-guide'],
  ['/en/resources/quadient-blueprint-e-invoicing-best-practices', 'learn/invoicing/benefits-of-invoicing-software'],
  ['/en/resources/new-integrated-billing-system-ping-bank', 'learn/customer-communications/enhancing-financial-services-ccm'],
  ['/en/resources/data-citizens-government%E2%80%99s-digital-journey', 'learn/customer-communications/ccm-for-public-sector-and-government'],
  ['/en/blog/nft-protected-software-assets-how-five-cs-see-it', 'blog'],
  ['/en/how-we-help/archive-retrieval/qar', 'learn/digital-archiving/benefits-of-digital-archiving'],
  ['/en/resources/fatigue-science-won-over-beanworks-brilliantly-simple-ap-solution', 'case-studies'],
  ['/en/resources/how-to-reduce-credit-risk-with-pain-free-payments', 'learn/accounts-receivable/credit-risk-analysis-accounts-receivable'],
  ['/en/resources/13-secrets-cx-success', 'learn/customer-communications/customer-experience-management'],
  ['/en/resources/mail-processing-automation', 'blog/why-there-growing-need-high-integrity-mail-processing'],
  ['/en/resources/energy-customer-interactions-and-communication-channel-preferences', 'ebooks-papers/understanding-communication-preferences'],
  ['/en/resources/cxictionary', 'learn/customer-communications/customer-experience-management'],
  ['/en/news/quadient-streamlines-access-archived-documents-and-data-introduction-quadient-archive', 'learn/digital-archiving/benefits-of-digital-archiving'],
  ['/en/resources/platform-consolidation-made-easy-inspirexpress', 'webinars-events/achieving-solid-communication-foundation-quadient-inspirexpress'],
  ['/en/blog/what-can-we-learn-these-notorious-financial-scams', 'blog/fraud-prevention-accounts-payable-key-insights'],
  ['/en/resources/gateway-property-management-welcomes-cost-and-time-savings-beanworks', 'case-studies'],
  ['/en/resources/exceeding-patients-healthcare-needs', 'learn/customer-communications/ccm-for-healthcare-payers'],
  ['/en/resources/quadient-livestream-equipment-demo-centers-video', 'ebooks-papers'],
  ['/en/resources/best-practices-finance-leaders-improve-data-driven-decision-making-0', 'blog/data-driven-decision-making-accounts-receivable'],
  ['/en/smart-technology-webinar-on-demand', 'webinars-events'],
  ['/en/resources/quadients-suite-solutions-increase-trois-moulins-habitat-productivity-and-save-costs-0', 'case-studies'],
  ['/en/resources/quadient-connects-2024-prepare-critical-communications-confidence-benefits-document', 'webinars-events/ccm-to-intelligent-experiences-webinar']
]);

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const { headers, rows } = readWorkbook(INPUT_XLSX);
  const rowObjects = rows.map((row) => rowToObject(headers, row));
  const uniqueLinks = unique(rowObjects.map((row) => row['full /en/ link']).filter(Boolean));

  console.log(`Read ${rowObjects.length} rows and ${uniqueLinks.length} unique broken links.`);

  const [searchIndex, legacyMetadata] = await Promise.all([
    getSearchIndex(),
    getLegacyMetadata(uniqueLinks)
  ]);

  const candidates = buildCandidates(searchIndex);
  console.log(`Loaded ${candidates.length} new-site candidates.`);

  const rowsByLink = groupRowsByLink(rowObjects);
  const decisions = new Map();

  for (const link of uniqueLinks) {
    const decision = decideReplacement(link, rowsByLink.get(link) ?? [], legacyMetadata[link], candidates);
    decisions.set(link, decision);
  }

  const enrichedRows = rowObjects.map((row) => {
    const link = row['full /en/ link'];
    const decision = decisions.get(link);

    return {
      ...row,
      'Link context summary': summarizeContext(row, decision),
      'Replacement link': decision?.url ?? '',
      'Replacement reasoning': decision?.reasoning ?? ''
    };
  });

  const outputHeaders = [...headers, ...EXTRA_COLUMNS];

  await fs.writeFile(OUTPUT_CSV, renderCsv(outputHeaders, enrichedRows), 'utf8');
  await writeWorkbook(OUTPUT_XLSX, outputHeaders, enrichedRows);
  await fs.writeFile(
    DECISIONS_OUTPUT,
    JSON.stringify([...decisions.entries()].map(([link, decision]) => ({ link, ...decision })), null, 2),
    'utf8'
  );

  printSummary([...decisions.values()]);
  console.log(`CSV written: ${OUTPUT_CSV}`);
  console.log(`XLSX written: ${OUTPUT_XLSX}`);
  console.log(`Decision details written: ${DECISIONS_OUTPUT}`);
}

function readWorkbook(filePath) {
  const sharedStrings = readSharedStrings(filePath);
  const sheetXml = execFileSync('unzip', ['-p', filePath, 'xl/worksheets/sheet1.xml'], {
    encoding: 'utf8'
  });
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
  return {
    headers,
    rows: rows.slice(1).map((row) => padRow(row, headers.length))
  };
}

function readSharedStrings(filePath) {
  let xml = '';
  try {
    xml = execFileSync('unzip', ['-p', filePath, 'xl/sharedStrings.xml'], { encoding: 'utf8' });
  } catch {
    return [];
  }

  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    xmlDecode([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(''))
  );
}

function readCellValue(body, type, sharedStrings) {
  const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];

  if (type === 's') {
    return sharedStrings[Number(raw)] ?? '';
  }

  if (type === 'inlineStr') {
    const inline = body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '';
    return xmlDecode([...inline.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(''));
  }

  return raw ? xmlDecode(raw) : '';
}

function columnIndex(cellRef) {
  let index = 0;
  for (const char of cellRef.match(/[A-Z]+/)?.[0] ?? 'A') {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
}

function rowToObject(headers, row) {
  const item = {};
  headers.forEach((header, index) => {
    item[header] = row[index] ?? '';
  });
  return item;
}

function padRow(row, length) {
  return Array.from({ length }, (_, index) => row[index] ?? '');
}

async function getSearchIndex() {
  if (!refresh) {
    const cached = await readJsonIfExists(SEARCH_INDEX_CACHE);
    if (cached?.items?.length) {
      return cached.items;
    }
  }

  if (offline) {
    throw new Error(`Missing search index cache: ${SEARCH_INDEX_CACHE}`);
  }

  const response = await fetch(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      term: '',
      page: 1,
      take: 2500,
      categories: [],
      locale: LOCALE
    })
  });

  if (!response.ok) {
    throw new Error(`Search index fetch failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.items)) {
    throw new Error('Search index payload did not contain an items array.');
  }

  await fs.writeFile(SEARCH_INDEX_CACHE, JSON.stringify(payload, null, 2), 'utf8');
  return payload.items;
}

async function getLegacyMetadata(links) {
  const cache = (!refresh && (await readJsonIfExists(LEGACY_METADATA_CACHE))) || {};
  const missing = links.filter((link) => !cache[link]);

  if (offline && missing.length > 0) {
    throw new Error(`Missing ${missing.length} legacy metadata records in ${LEGACY_METADATA_CACHE}`);
  }

  if (missing.length > 0) {
    console.log(`Fetching ${missing.length} legacy page metadata records...`);
    const fetched = await mapLimit(missing, 8, async (link, index) => {
      if ((index + 1) % 50 === 0) {
        console.log(`Fetched ${index + 1}/${missing.length} legacy metadata records...`);
      }
      return [link, await fetchLegacyMetadata(link)];
    });

    for (const [link, metadata] of fetched) {
      cache[link] = metadata;
    }

    await fs.writeFile(LEGACY_METADATA_CACHE, JSON.stringify(cache, null, 2), 'utf8');
  }

  return cache;
}

async function fetchLegacyMetadata(link) {
  const url = new URL(link, LEGACY_HOST).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'contentful-importer-link-mapping/1.0'
      }
    });
    const contentType = response.headers.get('content-type') ?? '';
    const text = contentType.includes('text/html') ? await response.text() : '';

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      title: cleanPageTitle(extractTitle(text)),
      description: cleanText(extractMeta(text, 'description') || extractMeta(text, 'og:description')),
      h1: cleanText(extractFirstTagText(text, 'h1')),
      canonical: extractCanonical(text)
    };
  } catch (error) {
    return {
      url,
      finalUrl: '',
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
    if (!slug || bySlug.has(slug)) {
      continue;
    }

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

function decideReplacement(link, sourceRows, legacy, candidates) {
  const original = parseOriginalLink(link);
  const sourceContext = summarizeRowsForScoring(sourceRows);
  const targetTitle = cleanPageTitle(legacy?.title) || titleFromSlug(original.tail);
  const targetDescription = cleanText(legacy?.description || legacy?.h1);
  const targetText = [
    targetTitle,
    targetDescription,
    original.pathWithoutLocale,
    sourceContext
  ].join(' ');
  const target = {
    link,
    original,
    legacy,
    sourceContext,
    title: targetTitle,
    description: targetDescription,
    allText: targetText,
    titleTokens: tokens(targetTitle),
    descriptionTokens: tokens(targetDescription),
    slugTokens: tokens(original.pathWithoutLocale),
    contextTokens: tokens(sourceContext),
    topic: inferTopic(`${targetText} ${original.pathWithoutLocale}`),
    resourceKind: inferResourceKind(original, targetText)
  };

  const manualSlug = MANUAL_REPLACEMENT_SLUGS.get(link);
  const manualCandidate = manualSlug
    ? candidates.find((candidate) => candidate.slug === manualSlug)
    : undefined;

  if (manualCandidate) {
    const best = {
      candidate: manualCandidate,
      score: 45,
      signals: ['clearer topical replacement than automated match']
    };

    return {
      url: manualCandidate.url,
      slug: manualCandidate.slug,
      title: manualCandidate.title,
      score: best.score,
      secondBest: null,
      confidence: 'high',
      originalTitle: targetTitle,
      originalStatus: legacy?.status ?? 0,
      resourceKind: target.resourceKind,
      topic: target.topic,
      signals: best.signals,
      reasoning: buildReasoning(target, best, 'high')
    };
  }

  const scored = candidates
    .map((candidate) => scoreCandidate(target, candidate))
    .sort((left, right) => right.score - left.score);
  let best = scored[0];

  if (!best || best.score < 6) {
    const fallback = fallbackCandidate(target, candidates);
    if (fallback) {
      best = {
        candidate: fallback,
        score: Math.max(best?.score ?? 0, 5),
        signals: ['fallback by topic/resource type']
      };
    }
  }

  if (best && best.score < 18 && !hasSpecificSignal(best) && specificOverlapCount(target, best.candidate) < 2) {
    const fallback = fallbackCandidate(target, candidates);
    if (fallback && fallback.slug !== best.candidate.slug) {
      best = {
        candidate: fallback,
        score: Math.max(best.score, 12),
        signals: ['fallback by topic/resource type']
      };
    }
  }

  const second = scored.find((item) => item.candidate.slug !== best?.candidate.slug);
  const confidence = classifyConfidence(best?.score ?? 0, second?.score ?? 0);

  return {
    url: best?.candidate.url ?? '',
    slug: best?.candidate.slug ?? '',
    title: best?.candidate.title ?? '',
    score: round(best?.score ?? 0),
    secondBest: second
      ? {
          slug: second.candidate.slug,
          title: second.candidate.title,
          score: round(second.score)
        }
      : null,
    confidence,
    originalTitle: targetTitle,
    originalStatus: legacy?.status ?? 0,
    resourceKind: target.resourceKind,
    topic: target.topic,
    signals: best?.signals ?? [],
    reasoning: buildReasoning(target, best, confidence)
  };
}

function scoreCandidate(target, candidate) {
  let score = 0;
  const signals = [];
  const oldTailNorm = normalizeSlug(target.original.tail);
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

  if (titleCoverage >= 0.55) {
    signals.push('strong title/topic token overlap');
  } else if (slugCoverage >= 0.5) {
    signals.push('strong URL token overlap');
  }

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

  if (candidate.slug.split('/').length === 1 && oldTailNorm !== normalizeSlug(candidate.slug)) {
    score -= 2.5;
  }

  if (/^(careers\/jobs|sub-processor|test-|preferences|preference-center|privacy|terms|digital-terms)/.test(candidate.slug)) {
    score -= 16;
  }

  if (candidate.categoryIds.has('partner') && !target.original.pathWithoutLocale.includes('partner')) {
    score -= 10;
  }

  return {
    candidate,
    score,
    signals: unique(signals).slice(0, 5)
  };
}

function scorePathPreference(target, candidate) {
  const type = target.original.type;
  const kind = target.resourceKind;
  const candidateResourceTypes = new Set(candidate.resourceTypes);

  if (type === 'blog') {
    if (candidate.pathType === 'blog') {
      return { score: 8, signal: 'keeps blog/article destination type' };
    }
    if (candidate.pathType === 'learn') {
      return { score: 2, signal: 'maps blog topic to knowledge hub article' };
    }
  }

  if (type === 'news') {
    if (candidate.pathType === 'blog' || candidate.pathType === 'news') {
      return { score: 8, signal: 'maps legacy news to new news/article area' };
    }
  }

  if (type === 'resources') {
    if (kind === 'webinar' && (candidate.pathType.includes('webinar') || candidateResourceTypes.has('webinar'))) {
      return { score: 12, signal: 'matches webinar resource type' };
    }
    if (kind === 'case-study' && (candidate.pathType === 'case-studies' || candidateResourceTypes.has('case-study'))) {
      return { score: 12, signal: 'matches case study resource type' };
    }
    if (kind === 'calculator' && candidate.pathType === 'calculators') {
      return { score: 12, signal: 'matches calculator resource type' };
    }
    if (kind === 'video' && (candidateResourceTypes.has('video') || candidate.title.toLowerCase().includes('video'))) {
      return { score: 10, signal: 'matches video resource type' };
    }
    if (
      ['ebook-paper', 'analyst-report', 'brochure', 'infographic'].includes(kind) &&
      (candidate.pathType === 'ebooks-papers' ||
        candidateResourceTypes.has('ebook') ||
        candidateResourceTypes.has('white-paper') ||
        candidateResourceTypes.has('analyst-report') ||
        candidateResourceTypes.has('brochure') ||
        candidateResourceTypes.has('infographic'))
    ) {
      return { score: 9, signal: 'matches downloadable resource type' };
    }
  }

  return { score: 0, signal: '' };
}

function scoreTopicPreference(target, candidate) {
  const categoryText = normalizePhrase(candidate.categoryNames.join(' '));
  const slug = candidate.slug;

  if (target.topic === 'accounts receivable') {
    if (
      slug.startsWith('learn/accounts-receivable') ||
      slug === 'ar-automation' ||
      categoryText.includes('accounts receivable') ||
      categoryText.includes('receivable automation')
    ) {
      return { score: 9, signal: 'matches accounts receivable topic' };
    }
  }

  if (target.topic === 'accounts payable') {
    if (
      slug.startsWith('learn/accounts-payable') ||
      slug === 'ap-automation' ||
      categoryText.includes('accounts payable') ||
      categoryText.includes('payable automation')
    ) {
      return { score: 9, signal: 'matches accounts payable topic' };
    }
  }

  if (target.topic === 'customer communications') {
    if (
      slug.startsWith('learn/customer-communications') ||
      slug === 'customer-communications' ||
      slug === 'elevate-customer-communications' ||
      categoryText.includes('customer communications') ||
      categoryText.includes('customer experience')
    ) {
      return { score: 8, signal: 'matches customer communications topic' };
    }
  }

  if (target.topic === 'mail and shipping') {
    if (
      slug === 'mail-shipping-automation' ||
      slug.startsWith('learn/postage') ||
      slug.startsWith('learn/business-mailing') ||
      slug.includes('postage') ||
      slug.includes('folder-inserters') ||
      categoryText.includes('mail') ||
      categoryText.includes('shipping') ||
      categoryText.includes('postage')
    ) {
      return { score: 8, signal: 'matches mail and shipping topic' };
    }
  }

  if (target.topic === 'finance') {
    if (slug === 'finance' || categoryText.includes('financial services') || categoryText.includes('finance')) {
      return { score: 5, signal: 'matches finance context' };
    }
  }

  return { score: 0, signal: '' };
}

function fallbackCandidate(target, candidates) {
  const slug = fallbackSlug(target);
  return candidates.find((candidate) => candidate.slug === slug) ?? candidates.find((candidate) => candidate.slug === 'resources');
}

function fallbackSlug(target) {
  if (target.original.type === 'blog') return 'blog';
  if (target.original.type === 'news') return 'news';
  if (target.original.type === 'resources') {
    if (target.resourceKind === 'webinar') return 'webinars-events';
    if (target.resourceKind === 'case-study') return 'case-studies';
    if (target.resourceKind === 'calculator') return 'calculators';
    if (['ebook-paper', 'analyst-report', 'brochure', 'infographic', 'video'].includes(target.resourceKind)) {
      return 'ebooks-papers';
    }
    return 'resources';
  }
  if (target.topic === 'accounts receivable') return 'ar-automation';
  if (target.topic === 'accounts payable') return 'ap-automation';
  if (target.topic === 'customer communications') return 'customer-communications';
  if (target.topic === 'mail and shipping') return 'mail-shipping-automation';
  if (target.topic === 'finance') return 'finance';
  return 'resources';
}

function buildReasoning(target, best, confidence) {
  if (!best?.candidate) {
    return 'No suitable new-site replacement could be identified.';
  }

  const candidate = best.candidate;
  const originalTitle = target.title || titleFromSlug(target.original.tail);
  const overlaps = topOverlap(
    [...target.titleTokens, ...target.slugTokens],
    candidate.allTokens
  );
  const overlapText = overlaps.length > 0 ? ` Shared topic terms include ${overlaps.join(', ')}.` : '';
  const resourceText = target.resourceKind !== 'general' ? ` It also matches the ${target.resourceKind.replace('-', ' ')} intent.` : '';
  const topicText = target.topic !== 'general' ? ` It stays within the ${target.topic} area.` : '';
  const signalText = best.signals.length > 0 ? ` Signals: ${best.signals.join('; ')}.` : '';
  const confidenceText = confidence === 'low' ? ' This is a best-fit replacement because a one-to-one migrated page was not evident.' : '';

  return `Original target is "${originalTitle}". "${candidate.title}" is the closest new-site match.${overlapText}${topicText}${resourceText}${signalText}${confidenceText}`.replace(
    /\s+/g,
    ' '
  ).trim();
}

function hasSpecificSignal(scoredCandidate) {
  return scoredCandidate.signals.some((signal) =>
    /same|contained|strong title|strong URL|old slug|new terminal/i.test(signal)
  );
}

function specificOverlapCount(target, candidate) {
  return topOverlap([...target.titleTokens, ...target.slugTokens], candidate.allTokens).length;
}

function summarizeContext(row, decision) {
  const parentName = cleanText(row['Parent Page Name']);
  const parentSlug = cleanText(row['Parent page slug']);
  const parentType = cleanText(row['Parent Page Type']);
  const entityName = cleanText(row['Entity Name'] || row['Rich Text Entity Name']);
  const contentType = cleanText(row['Content Type'] || parentType);
  const field = cleanText(row.Field);
  const originalTitle = cleanText(decision?.originalTitle);
  const parts = [];

  if (parentName) {
    parts.push(`Referenced from "${parentName}"`);
    if (parentType) {
      parts.push(`(${parentType})`);
    }
    if (parentSlug) {
      parts.push(`at slug "${parentSlug}"`);
    }
  } else if (entityName) {
    parts.push(`Referenced from entity "${entityName}"`);
  } else {
    parts.push('Referenced from a migrated Contentful entry');
  }

  if (contentType || field) {
    parts.push(`via ${[contentType, field].filter(Boolean).join(' / ')}`);
  }

  if (entityName && parentName && entityName !== parentName) {
    parts.push(`on "${entityName}"`);
  }

  if (originalTitle) {
    parts.push(`targeting "${originalTitle}"`);
  }

  return `${parts.join(' ')}.`;
}

function summarizeRowsForScoring(rows) {
  const names = [];
  for (const row of rows) {
    names.push(row['Parent Page Name'], row['Parent page slug'], row['Entity Name']);
  }
  return unique(names.filter(Boolean).map(cleanText)).slice(0, 12).join(' ');
}

function groupRowsByLink(rows) {
  const map = new Map();
  for (const row of rows) {
    const link = row['full /en/ link'];
    if (!map.has(link)) {
      map.set(link, []);
    }
    map.get(link).push(row);
  }
  return map;
}

function inferTopic(text) {
  const normalized = normalizePhrase(text);
  if (/\b(ap|payable|payables|invoice approval|invoice processing|purchase order|vendor|expense|payment automation)\b/.test(normalized)) {
    return 'accounts payable';
  }
  if (/\b(ar|receivable|receivables|collections|dso|cash application|cash flow|credit management)\b/.test(normalized)) {
    return 'accounts receivable';
  }
  if (/\b(ccm|cxm|customer communication|customer communications|customer experience|inspire|iforms|omnichannel|digital journey|journey mapping)\b/.test(normalized)) {
    return 'customer communications';
  }
  if (/\b(postage|mailing|mailroom|shipping|usps|fedex|ups|folder inserter|inserter|parcel|imi|mail automation)\b/.test(normalized)) {
    return 'mail and shipping';
  }
  if (/\b(finance|financial services|banking|insurance)\b/.test(normalized)) {
    return 'finance';
  }
  return 'general';
}

function inferResourceKind(original, text) {
  const normalized = normalizePhrase(`${original.pathWithoutLocale} ${text}`);
  if (/\b(webinar|replay|on demand|on-demand|event|connects)\b/.test(normalized)) return 'webinar';
  if (/\b(case study|customer story|story|success story)\b/.test(normalized)) return 'case-study';
  if (/\b(calculator|roi)\b/.test(normalized)) return 'calculator';
  if (/\b(video)\b/.test(normalized)) return 'video';
  if (/\b(analyst|spark matrix|market report|leaderboard|report)\b/.test(normalized)) return 'analyst-report';
  if (/\b(brochure)\b/.test(normalized)) return 'brochure';
  if (/\b(infographic)\b/.test(normalized)) return 'infographic';
  if (/\b(ebook|e-book|guide|white paper|whitepaper|paper|checklist|template|survey)\b/.test(normalized)) return 'ebook-paper';
  if (original.type === 'blog') return 'blog';
  if (original.type === 'news') return 'news';
  return 'general';
}

function parseOriginalLink(link) {
  const url = new URL(link, LEGACY_HOST);
  const decodedPath = safeDecode(url.pathname).replace(/\/+$/, '');
  const parts = decodedPath.split('/').filter(Boolean);
  const localeIndex = parts[0] === 'en' ? 1 : 0;
  const pathParts = parts.slice(localeIndex);
  const pathWithoutLocale = pathParts.join('/');
  const type = pathParts[0] ?? '';
  const tail = pathParts.at(-1) ?? pathWithoutLocale;

  return {
    url,
    decodedPath,
    pathParts,
    pathWithoutLocale,
    type,
    tail
  };
}

function titleFromSlug(slug) {
  return safeDecode(slug)
    .replace(/[-_/]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function weightedCoverage(tokensToMatch, candidateSets) {
  const uniqueTokens = unique(tokensToMatch).filter(Boolean);
  if (uniqueTokens.length === 0) {
    return 0;
  }

  let matched = 0;
  for (const token of uniqueTokens) {
    if (candidateSets[0]?.has(token)) {
      matched += 1;
    } else if (candidateSets[1]?.has(token)) {
      matched += 0.85;
    } else if (candidateSets[2]?.has(token)) {
      matched += 0.45;
    }
  }
  return matched / uniqueTokens.length;
}

function coverage(tokensToMatch, candidateSet) {
  const uniqueTokens = unique(tokensToMatch).filter(Boolean);
  if (uniqueTokens.length === 0) {
    return 0;
  }
  return uniqueTokens.filter((token) => candidateSet.has(token)).length / uniqueTokens.length;
}

function topOverlap(tokensToMatch, candidateSet) {
  return unique(tokensToMatch)
    .filter((token) => candidateSet.has(token) && token.length > 2)
    .slice(0, 5);
}

function tokens(value) {
  const normalized = normalizePhrase(value);
  const rawTokens = normalized.split(' ').filter(Boolean);
  const expanded = [];

  for (const token of rawTokens) {
    if (STOP_WORDS.has(token)) {
      continue;
    }
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

  if (token.endsWith('ing') && token.length > 6) {
    variants.push(token.slice(0, -3));
  }
  if (token.endsWith('ies') && token.length > 5) {
    variants.push(`${token.slice(0, -3)}y`);
  }
  if (token.endsWith('es') && token.length > 5) {
    variants.push(token.slice(0, -2));
  }
  if (token.endsWith('s') && token.length > 4) {
    variants.push(token.slice(0, -1));
  }

  return unique(variants);
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

function normalizeCandidateSlug(slug) {
  if (!slug) return '';
  return safeDecode(String(slug))
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?en-us\/?/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function cleanPageTitle(value) {
  const cleaned = cleanText(value)
    .replace(/\s*\|\s*Quadient.*$/i, '')
    .replace(/\s*-\s*Quadient.*$/i, '')
    .trim();

  return /^(404 not found|404|not found|welcome)$/i.test(cleaned) ? '' : cleaned;
}

function cleanText(value) {
  return htmlDecode(String(value ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u00a0\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function extractTitle(html) {
  return extractFirstTagText(html, 'title');
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

function classifyConfidence(score, secondScore) {
  if (score >= 35 || score - secondScore >= 15) return 'high';
  if (score >= 18 || score - secondScore >= 7) return 'medium';
  return 'low';
}

function printSummary(decisions) {
  const confidenceCounts = countBy(decisions, (decision) => decision.confidence);
  const fallbackCount = decisions.filter((decision) => decision.signals.includes('fallback by topic/resource type')).length;
  const low = decisions
    .filter((decision) => decision.confidence === 'low')
    .sort((left, right) => left.score - right.score)
    .slice(0, 20);

  console.log('Decision summary:', confidenceCounts, `fallbacks=${fallbackCount}`);
  if (low.length > 0) {
    console.log('Lowest-confidence examples:');
    for (const decision of low) {
      console.log(`- ${decision.originalTitle} -> ${decision.url} (${decision.score})`);
    }
  }
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
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName(colIndex)}${rowNumber}`;
          const stringValue = String(value ?? '');
          return `<c r="${ref}" t="inlineStr"><is><t${stringValue.match(/^\s|\s$/) ? ' xml:space="preserve"' : ''}>${xmlEscape(stringValue)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  const lastCell = `${columnName(rows[0].length - 1)}${rows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`;
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

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="bad link replacements" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function corePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>contentful-importer</dc:creator>
  <cp:lastModifiedBy>contentful-importer</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>contentful-importer</Application>
</Properties>`;
}

function renderCsv(headers, rows) {
  return `${[
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? '')).join(','))
  ].join('\n')}\n`;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
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
  return [...new Set(items)];
}

function round(value) {
  return Math.round(value * 100) / 100;
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
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
