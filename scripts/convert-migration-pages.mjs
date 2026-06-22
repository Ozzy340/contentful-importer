import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const sourceDir = path.join(root, 'source/migration pages');
const outputDir = path.join(root, 'source/docs/uat-migration');
const taxonomyMap = yaml.load(await readFile(path.join(root, 'config/taxonomy-map.yml'), 'utf8'));
const validTaxonomyTokens = new Set(Object.keys(taxonomyMap.concepts ?? {}));

const fallbackHeroImage = {
  path: '../../assets/uat-placeholder.svg',
  alt: 'UAT placeholder image for migrated Quadient content.',
  title: '[UAT Content] UAT placeholder image',
  description: 'Placeholder visual used for UAT migration imports.'
};

const moduleAliases = [
  ['HeroStandard', /hero|blog header/i],
  ['FaqBlock', /faq|accordion/i],
  ['Testimonial', /testimonial|quote|analyst/i],
  ['StatsBlock', /stats|statistics|facts/i],
  ['CtaForm', /cta|action block|mega|footer|final/i],
  ['NotificationBlock', /announcement|notification|banner/i],
  ['InsightsResources', /insights|resources|resource grid|product card listing|product family card|related products|standard cards?/i],
  ['SolutionCardCarousel', /solutions toggle|solution card|stacked card|cards grid|use cases|capabilities|industry cards/i],
  ['UspListing', /usp|value proposition|key features|timeline|comparison|table|how product helps|browse|filter|siderail|navigation/i],
  ['MissionFraming', /mission|big idea|50-50|editorial|intro|proof|trust|challenge|overview|purpose|different|video|tl block|case study/i]
];

const sectionHeaderPatterns = [
  /<hero/i,
  /<faq/i,
  /<cta footer/i,
  /<final cta/i,
  /<resources module/i,
  /<resource grid/i,
  /<reputation/i,
  /<business challenges/i,
  /<how quadient/i,
  /<solutions overview/i,
  /<why quadient/i,
  /<customer proof/i,
  /<vision/i,
  /<industry/i,
  /<proof/i,
  /<intro/i,
  /<impact/i,
  /<quadient solutions/i,
  /<tl block/i,
  /<capabilities/i,
  /<integrations/i,
  /<case study/i,
  /<value proposition/i,
  /<video block/i,
  /<how product helps/i,
  /<upsell/i,
  /<comparison/i,
  /<key features/i,
  /<specifications/i,
  /<related products/i,
  /<guided search/i,
  /<filter/i,
  /<industry quick/i,
  /<optional: featured/i,
  /<cross-linking/i
];

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function shortHash(value) {
  let hash = 5381;
  for (const char of String(value)) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).slice(0, 6).padStart(6, '0');
}

function sourceIdFor(fileBase) {
  const base = slugify(fileBase).slice(0, 20).replace(/-+$/, '');
  return `m-${base}-${shortHash(fileBase)}`;
}

function stripFootnotes(value) {
  return String(value)
    .replace(/\uFEFF/g, '')
    .replace(/:contentReference\[[^\]]+\]\{[^}]+\}/g, '')
    .replace(/\[[a-z0-9]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInlineNotes(value) {
  return stripFootnotes(value)
    .replace(/\s+Note:\s+.*$/i, '')
    .trim();
}

function shorten(value, max = 240) {
  const text = stripFootnotes(value).replace(/^Directional:\s*/i, '');
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}.`;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function cleanLine(line) {
  return String(line)
    .replace(/\uFEFF/g, '')
    .replace(/^\s*[*•·-]\s*/, '')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '');
}

function moduleNameFromLine(line) {
  const cleaned = cleanLine(line);
  const explicit = cleaned.match(/(?:Contentful module|Module):\s*<?([^>\n]+)>?/i);
  if (explicit) {
    return stripFootnotes(explicit[1]).replace(/\s*\(.+?\)\s*$/, '');
  }
  if (sectionHeaderPatterns.some((pattern) => pattern.test(cleaned))) {
    const header = cleaned.match(/<([^>]+)>/);
    return header ? stripFootnotes(header[1]) : stripFootnotes(cleaned);
  }
  return undefined;
}

function targetComponentFor(moduleName) {
  for (const [component, pattern] of moduleAliases) {
    if (pattern.test(moduleName)) {
      return component;
    }
  }
  return 'PromoBlock';
}

function splitModules(raw) {
  const lines = raw.split(/\r?\n/);
  const modules = [];
  let current = null;
  let beforeModules = [];

  for (const line of lines) {
    const moduleName = moduleNameFromLine(line);
    if (moduleName) {
      if (current) {
        modules.push(current);
      }
      current = { moduleName, lines: [line] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      beforeModules.push(line);
    }
  }

  if (current) {
    modules.push(current);
  }

  return { beforeModules: beforeModules.join('\n'), modules };
}

function pushField(target, key, value) {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const text = stripInlineNotes(value);
  if (!normalizedKey || !text) {
    return;
  }
  if (!target[normalizedKey]) {
    target[normalizedKey] = [];
  }
  target[normalizedKey].push(text);
}

function parseFields(lines) {
  const fields = {};
  const cards = [];
  let currentKey = null;
  let currentTarget = fields;

  for (const sourceLine of lines) {
    const line = cleanLine(sourceLine);
    if (!line || /^_+$/.test(line) || /^\[[a-z0-9]+\]/i.test(line) || /^note:/i.test(line)) {
      currentKey = null;
      continue;
    }

    const matches = [...line.matchAll(/<([^>]+)>/g)];
    if (matches.length === 0) {
      if (currentKey) {
        pushField(currentTarget, currentKey, line);
      } else if (cards.length > 0) {
        cards[cards.length - 1].raw.push(stripFootnotes(line));
      }
      continue;
    }

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const tag = stripFootnotes(match[1]);
      const start = match.index + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : line.length;
      const value = line.slice(start, end).trim();
      const normalizedTag = tag.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

      if (normalizedTag === 'card') {
        cards.push({ fields: {}, raw: [] });
        currentTarget = cards[cards.length - 1].fields;
        currentKey = null;
        if (value) {
          cards[cards.length - 1].raw.push(stripFootnotes(value));
        }
        continue;
      }

      if (normalizedTag === 'accordion' || normalizedTag === 'table' || normalizedTag === 'cards') {
        currentKey = null;
        continue;
      }

      currentKey = tag;
      pushField(currentTarget, tag, value);
    }
  }

  return { fields, cards };
}

function first(fields, keys, fallback = '') {
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const values = fields[normalizedKey]?.filter(Boolean);
    if (values?.length) {
      return values[0];
    }
  }
  return fallback;
}

function all(fields, keys) {
  return keys.flatMap((key) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return fields[normalizedKey] ?? [];
  });
}

function normalizeUrl(value, pageSlug) {
  const raw = stripInlineNotes(value).replace(/`/g, '');
  if (!raw || /^\[.+\]$/.test(raw) || /embedded|same-page|destination|tbc|tbd/i.test(raw)) {
    return `https://www.quadient.com/en-us/${pageSlug}`;
  }

  const urlMatch = raw.match(/(?:https?:\/\/|mailto:|tel:|www\.|quadient\.com\/|\/|#)[^\s,;)]*/i);
  const candidate = urlMatch?.[0] ?? raw;

  if (/^(https?|mailto:|tel:)/i.test(candidate) && !/\s/.test(candidate)) {
    return candidate;
  }
  if (/^www\./i.test(candidate) || /^quadient\.com/i.test(candidate)) {
    return `https://${candidate}`;
  }
  if (/^\//.test(candidate)) {
    return `https://www.quadient.com${candidate}`;
  }
  if (/^#/.test(candidate)) {
    return `https://www.quadient.com/en-us/${pageSlug}${candidate}`;
  }
  return `https://www.quadient.com/en-us/${pageSlug}`;
}

function ctasFromFields(fields, pageSlug, max = 2) {
  const labels = [
    ...all(fields, ['primary cta']),
    ...all(fields, ['secondary cta']),
    ...all(fields, ['cta', 'tertiary cta'])
  ];
  const urls = all(fields, ['links to', 'destination', 'url']);
  const unique = [];

  labels.forEach((label, index) => {
    const text = shorten(label, 64);
    if (!text || unique.some((item) => item.text === text)) {
      return;
    }
    unique.push({
      text,
      url: normalizeUrl(urls[index] ?? urls[0] ?? '', pageSlug),
      style: index === 0 ? 'Primary Orange Solid' : 'Primary Gray Outline'
    });
  });

  return unique.slice(0, max);
}

function cardsFromParsed(parsed, pageSlug, fallbackHeading) {
  const explicitCards = parsed.cards.map((card, index) => cardFromFields(card.fields, card.raw, pageSlug, `${fallbackHeading} ${index + 1}`));
  if (explicitCards.length > 0) {
    return explicitCards;
  }

  const headings = all(parsed.fields, ['content heading', 'h3', 'impact point', 'question', 'row', 'button', 'link']);
  const descriptions = all(parsed.fields, ['content copy', 'description', 'content subheading', 'short description', 'bullet']);
  const ctaLabels = all(parsed.fields, ['cta']);
  const urls = all(parsed.fields, ['links to', 'destination']);

  const cards = headings.map((heading, index) => ({
    heading: shorten(heading, 110),
    description: shorten(descriptions[index] ?? descriptions[0] ?? heading, 230),
    link: ctaLabels[index] || urls[index]
      ? {
          text: shorten(ctaLabels[index] ?? 'Learn more', 64),
          url: normalizeUrl(urls[index] ?? '', pageSlug),
          style: 'Link Orange Right Arrow'
        }
      : undefined
  }));

  if (cards.length > 0) {
    return cards;
  }

  const bullets = all(parsed.fields, ['bullet']);
  return bullets.map((bullet, index) => ({
    heading: shorten(bullet, 90),
    description: shorten(bullet, 230)
  }));
}

function cardFromFields(fields, raw, pageSlug, fallbackHeading) {
  const heading = first(fields, ['heading', 'h3', 'content heading', 'eyebrow'], raw[0] ?? fallbackHeading);
  const description = first(fields, ['description', 'content copy', 'content subheading', 'subheading'], raw.slice(1).join(' '));
  const cta = first(fields, ['cta', 'primary cta', 'secondary cta'], '');
  const url = first(fields, ['links to', 'destination', 'url'], '');
  return {
    heading: shorten(heading || fallbackHeading, 110),
    description: shorten(description || heading || fallbackHeading, 230),
    link: cta || url
      ? {
          text: shorten(cta || 'Learn more', 64),
          url: normalizeUrl(url, pageSlug),
          style: 'Link Orange Right Arrow'
        }
      : undefined
  };
}

function ensureMinimumCards(cards, fallbackHeading) {
  const output = cards.filter((card) => card.heading).slice(0, 12);
  while (output.length < 2) {
    output.push({
      heading: output.length === 0 ? fallbackHeading : `${fallbackHeading} next step`,
      description: 'Details to be confirmed during final UAT content QA.'
    });
  }
  return output;
}

function buildHero(parsed, title, pageSlug) {
  const callsToAction = ctasFromFields(parsed.fields, pageSlug, 2);
  if (callsToAction.length === 0) {
    callsToAction.push({
      text: 'Learn more',
      url: `https://www.quadient.com/en-us/${pageSlug}`,
      style: 'Primary Orange Solid'
    });
  }
  return {
    component: 'HeroStandard',
    props: {
      eyebrow: shorten(first(parsed.fields, ['eyebrow'], 'Quadient'), 80),
      description: shorten(first(parsed.fields, ['description', 'subheading', 'h2 graphically styled', 'content copy'], title), 240),
      lowerSubtext: shorten(first(parsed.fields, ['cta microcopy'], 'UAT migration draft generated from the source outline.'), 180),
      image: fallbackHeroImage,
      callsToAction
    }
  };
}

function buildFaq(parsed) {
  let questions = all(parsed.fields, ['question']);
  const suggested = all(parsed.fields, ['content copy']).join(' ');
  if (questions.length === 0 && /faq/i.test(suggested)) {
    questions = suggested
      .split('?')
      .map((item) => item.replace(/^.*?:/, '').trim())
      .filter(Boolean)
      .map((item) => `${item}?`);
  }
  const answers = all(parsed.fields, ['answer', 'content copy', 'description', 'body']);
  const items = questions.slice(0, 8).map((question, index) => ({
    heading: shorten(question.replace(/\?+$/, ''), 120),
    body: answers[index] && !answers[index].includes(question)
      ? answers[index]
      : 'Answer to be confirmed during final UAT content QA.'
  }));
  return {
    component: 'FaqBlock',
    props: {
      heading: shorten(first(parsed.fields, ['heading', 'h2'], 'Frequently asked questions'), 120),
      items
    }
  };
}

function buildStats(parsed) {
  const candidates = [...all(parsed.fields, ['statistic', 'text']), ...all(parsed.fields, ['bullet'])];
  const statistics = candidates.slice(0, 9).map((item) => {
    const match = item.match(/^([^,.;:-]+)[,.;:-]\s*(.+)$/);
    return {
      text: shorten(match?.[1] ?? item, 80),
      supportingText: shorten(match?.[2] ?? 'Supporting detail to be confirmed.', 120)
    };
  });
  return {
    component: 'StatsBlock',
    props: {
      eyebrow: shorten(first(parsed.fields, ['eyebrow'], 'At a glance'), 80),
      heading: shorten(first(parsed.fields, ['heading', 'h2'], 'Key facts'), 120),
      statistics
    }
  };
}

function buildTestimonial(parsed) {
  const quote = first(parsed.fields, ['quote', 'large quote', 'testimonial'], 'Customer proof to be confirmed during final UAT content QA.');
  const attribution = first(parsed.fields, ['attribution', 'name title organization'], '');
  return {
    component: 'Testimonial',
    props: {
      heading: shorten(first(parsed.fields, ['heading', 'h2'], 'Trusted by customers'), 120),
      testimonials: [
        {
          tagline: shorten(first(parsed.fields, ['eyebrow'], 'Customer proof'), 80),
          quote: stripFootnotes(quote),
          sourceName: shorten(attribution || 'Quadient customer', 80),
          sourceJobTitle: 'Source details to be confirmed'
        }
      ]
    }
  };
}

function buildCta(parsed, pageSlug) {
  const callsToAction = ctasFromFields(parsed.fields, pageSlug, 4);
  while (callsToAction.length < 2) {
    callsToAction.push({
      text: callsToAction.length === 0 ? 'Contact us' : 'Learn more',
      url: callsToAction.length === 0 ? 'https://www.quadient.com/en-us/contact-us' : `https://www.quadient.com/en-us/${pageSlug}`,
      style: callsToAction.length === 0 ? 'Primary Orange Solid' : 'Primary Gray Outline'
    });
  }
  return {
    component: 'CtaForm',
    props: {
      heading: shorten(first(parsed.fields, ['heading', 'h2'], 'Ready to take the next step?'), 120),
      description: shorten(first(parsed.fields, ['description', 'content copy', 'subheading'], 'Choose the most relevant next step for this page.'), 230),
      callsToAction
    }
  };
}

function buildNotification(parsed) {
  return {
    component: 'NotificationBlock',
    props: {
      heading: shorten(first(parsed.fields, ['heading', 'h2'], 'Important information'), 120),
      body: first(parsed.fields, ['subheading', 'description', 'content copy'], 'Details to be confirmed during final UAT content QA.')
    }
  };
}

function buildPromo(parsed, pageSlug, moduleName) {
  const ctas = ctasFromFields(parsed.fields, pageSlug, 1);
  return {
    component: 'MissionFraming',
    props: {
      eyebrow: shorten(first(parsed.fields, ['eyebrow'], moduleName), 80),
      heading: shorten(first(parsed.fields, ['heading', 'h2', 'h3'], moduleName), 120),
      description: shorten(first(parsed.fields, ['description', 'subheading', 'content copy'], 'Details to be confirmed during final UAT content QA.'), 230),
      callToAction: ctas[0] ? { ...ctas[0], style: 'Link Orange Right Arrow' } : undefined
    }
  };
}

function buildCardsComponent(component, parsed, pageSlug, moduleName) {
  const heading = shorten(first(parsed.fields, ['heading', 'h2'], moduleName), 120);
  const cards = ensureMinimumCards(cardsFromParsed(parsed, pageSlug, heading), heading);
  const common = {
    eyebrow: shorten(first(parsed.fields, ['eyebrow'], ''), 80),
    heading,
    description: shorten(first(parsed.fields, ['description', 'subheading', 'content copy'], ''), 230),
    cards
  };
  if (component === 'InsightsResources') {
    const ctas = ctasFromFields(parsed.fields, pageSlug, 1);
    return {
      component,
      props: {
        ...common,
        callToAction: ctas[0] ? { ...ctas[0], style: 'Link Orange Right Arrow' } : undefined
      }
    };
  }
  return { component, props: common };
}

function buildComponent(module, title, pageSlug) {
  const parsed = parseFields(module.lines);
  const component = targetComponentFor(module.moduleName);
  if (component === 'HeroStandard') {
    return buildHero(parsed, title, pageSlug);
  }
  if (component === 'FaqBlock') {
    return buildFaq(parsed);
  }
  if (component === 'StatsBlock') {
    return buildStats(parsed);
  }
  if (component === 'Testimonial') {
    return buildTestimonial(parsed);
  }
  if (component === 'CtaForm') {
    return buildCta(parsed, pageSlug);
  }
  if (component === 'NotificationBlock') {
    return buildNotification(parsed);
  }
  if (component === 'UspListing' || component === 'SolutionCardCarousel' || component === 'InsightsResources') {
    return buildCardsComponent(component, parsed, pageSlug, module.moduleName);
  }
  return buildPromo(parsed, pageSlug, module.moduleName);
}

function extractFutureSlug(raw, fallback) {
  const match = raw.match(/Future URL:\s*([^\n;]+)/i);
  if (!match) {
    return slugify(fallback);
  }
  let url = stripFootnotes(match[1]).replace(/^https?:\/\//, '');
  url = url.replace(/^www\./, '');
  url = url.replace(/^quadient\.com\/?/i, '');
  url = url.replace(/^en-us\/?/i, '');
  url = url.replace(/^en\/?/i, '');
  url = url.split(/[?#]/)[0].replace(/\/$/, '');
  return slugify(url || fallback);
}

function extractTitle(raw, fileBase, modules) {
  const pageLine = raw.match(/^\s*Page:\s*(.+)$/im);
  const seoTitle = raw.match(/^\s*Page title:\s*(.+)$/im);
  const heroModule = modules.find((module) => targetComponentFor(module.moduleName) === 'HeroStandard');
  if (heroModule) {
    const parsed = parseFields(heroModule.lines);
    const heroHeading = first(parsed.fields, ['heading', 'h1'], '');
    if (heroHeading) {
      return shorten(heroHeading.replace(/\s+\|\s+Quadient$/i, ''), 120);
    }
  }
  if (pageLine) {
    return shorten(pageLine[1].replace(/\s+\|\s+Quadient$/i, ''), 120);
  }
  if (seoTitle) {
    return shorten(seoTitle[1].replace(/\s+\|\s+Quadient.*$/i, ''), 120);
  }
  const firstMeaningful = raw
    .split(/\r?\n/)
    .map(stripFootnotes)
    .find((line) => line && !/^sitemap$/i.test(line));
  return shorten(firstMeaningful || fileBase, 120);
}

function taxonomyFor(text) {
  const lower = text.toLowerCase();
  const tokens = [];
  const add = (token) => {
    if (validTaxonomyTokens.has(token) && !tokens.includes(token)) {
      tokens.push(token);
    }
  };

  if (/folder inserter|ds-|im-|mail|postage|shipping/.test(lower)) {
    add('product-family:mail-shipping-automation');
    add('topic:mailing-postage');
    add('role:mailing');
  }
  if (/customer communication|ccm|customer experience/.test(lower)) {
    add('product-family:customer-communications-management');
    add('topic:customer-communications');
    add('role:customer-experience');
  }
  if (/parcel|locker/.test(lower)) {
    add('product-family:parcel-shipping-tracking');
    add('topic:shipping-tracking');
    add('role:shipping');
  }
  if (/career|job|employee|candidate|apply|talent/.test(lower)) {
    add('topic:corporate-culture');
    add('role:human-resources');
  }
  if (/finance|financial|investor|shareholder|stock|capital|analyst|bank|cash|invoice|accounts payable|accounts receivable|payment/.test(lower)) {
    add('industry:financial-services');
    add('role:finance');
    add('topic:business-insights');
  }
  if (/insurance/.test(lower)) add('industry:insurance');
  if (/utilities/.test(lower)) add('industry:utilities');
  if (/public sector|government/.test(lower)) add('industry:public-sector-government');
  if (/healthcare/.test(lower)) add('industry:healthcare');
  if (/retail/.test(lower)) add('industry:retail');
  if (/partner|affiliate|reseller/.test(lower)) {
    add('role:marketing');
  }
  if (/terms|legal|privacy|compliance|security|trust/.test(lower)) {
    add('topic:risk-and-compliance');
    add('role:legal-compliance');
  }
  if (tokens.length === 0) {
    add('topic:digital-transformation');
    add('role:operations');
  }

  return tokens.slice(0, 5);
}

function frontmatter({ sourceId, title, slug, taxonomy }) {
  return [
    '---',
    `sourceId: ${yamlString(sourceId)}`,
    `title: ${yamlString(title)}`,
    `slug: ${yamlString(slug)}`,
    'locale: en-US',
    'contentType: contentPage',
    'taxonomy:',
    ...taxonomy.map((token) => `  - ${token}`),
    '---',
    ''
  ].join('\n');
}

function renderScalar(key, value, indent = '') {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return [`${indent}${key}: ${yamlString(value)}`];
}

function renderCtaArray(key, items, indent = '') {
  if (!items?.length) {
    return [];
  }
  const lines = [`${indent}${key}:`];
  for (const item of items) {
    lines.push(`${indent}  - text: ${yamlString(item.text)}`);
    lines.push(`${indent}    url: ${yamlString(item.url)}`);
    lines.push(`${indent}    style: ${yamlString(item.style)}`);
  }
  return lines;
}

function renderComponent(block) {
  const props = block.props;
  const lines = [`:::component ${block.component}`];
  if (block.component === 'HeroStandard') {
    lines.push(...renderScalar('eyebrow', props.eyebrow));
    lines.push(...renderScalar('description', props.description));
    lines.push(...renderScalar('lowerSubtext', props.lowerSubtext));
    lines.push('image:');
    lines.push(`  path: ${yamlString(props.image.path)}`);
    lines.push(`  alt: ${yamlString(props.image.alt)}`);
    lines.push(`  title: ${yamlString(props.image.title)}`);
    lines.push(`  description: ${yamlString(props.image.description)}`);
    lines.push(...renderCtaArray('callsToAction', props.callsToAction));
  } else if (block.component === 'FaqBlock') {
    lines.push(...renderScalar('heading', props.heading));
    lines.push('items:');
    for (const item of props.items.length ? props.items : [{ heading: 'Question to be confirmed', body: 'Answer to be confirmed during final UAT content QA.' }]) {
      lines.push(`  - heading: ${yamlString(item.heading)}`);
      lines.push(`    body: ${yamlString(item.body)}`);
    }
  } else if (block.component === 'StatsBlock') {
    lines.push(...renderScalar('eyebrow', props.eyebrow));
    lines.push(...renderScalar('heading', props.heading));
    lines.push('statistics:');
    for (const item of props.statistics.length ? props.statistics : [{ text: 'TBC', supportingText: 'Statistic to be confirmed during final UAT content QA.' }]) {
      lines.push(`  - text: ${yamlString(item.text)}`);
      lines.push(`    supportingText: ${yamlString(item.supportingText)}`);
    }
  } else if (block.component === 'Testimonial') {
    lines.push(...renderScalar('heading', props.heading));
    lines.push('testimonials:');
    for (const item of props.testimonials) {
      lines.push(`  - tagline: ${yamlString(item.tagline)}`);
      lines.push(`    quote: ${yamlString(item.quote)}`);
      lines.push(`    sourceName: ${yamlString(item.sourceName)}`);
      lines.push(`    sourceJobTitle: ${yamlString(item.sourceJobTitle)}`);
    }
  } else if (block.component === 'CtaForm') {
    lines.push(...renderScalar('heading', props.heading));
    lines.push(...renderScalar('description', props.description));
    lines.push(...renderCtaArray('callsToAction', props.callsToAction));
  } else if (block.component === 'NotificationBlock') {
    lines.push(...renderScalar('heading', props.heading));
    lines.push(...renderScalar('body', props.body));
  } else if (block.component === 'MissionFraming') {
    lines.push(...renderScalar('eyebrow', props.eyebrow));
    lines.push(...renderScalar('heading', props.heading));
    lines.push(...renderScalar('description', props.description));
    if (props.callToAction) {
      lines.push('callToAction:');
      lines.push(`  text: ${yamlString(props.callToAction.text)}`);
      lines.push(`  url: ${yamlString(props.callToAction.url)}`);
      lines.push(`  style: ${yamlString(props.callToAction.style)}`);
    }
  } else {
    lines.push(...renderScalar('eyebrow', props.eyebrow));
    lines.push(...renderScalar('heading', props.heading));
    lines.push(...renderScalar('description', props.description));
    if (props.callToAction) {
      lines.push('callToAction:');
      lines.push(`  text: ${yamlString(props.callToAction.text)}`);
      lines.push(`  url: ${yamlString(props.callToAction.url)}`);
      lines.push(`  style: ${yamlString(props.callToAction.style)}`);
    }
    lines.push('cards:');
    for (const card of props.cards) {
      lines.push(`  - heading: ${yamlString(card.heading)}`);
      lines.push(`    description: ${yamlString(card.description)}`);
      if (card.link) {
        lines.push('    link:');
        lines.push(`      text: ${yamlString(card.link.text)}`);
        lines.push(`      url: ${yamlString(card.link.url)}`);
        lines.push(`      style: ${yamlString(card.link.style)}`);
      }
    }
  }
  lines.push(':::', '');
  return lines.join('\n');
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((file) => file.endsWith('.txt')).sort();
  const seenSlugs = new Set();

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const raw = await readFile(sourcePath, 'utf8');
    const fileBase = path.basename(file, '.txt');
    const { modules } = splitModules(raw);
    const title = extractTitle(raw, fileBase, modules);
    let slug = extractFutureSlug(raw, title);
    if (seenSlugs.has(slug)) {
      slug = slugify(fileBase);
    }
    seenSlugs.add(slug);
    const sourceId = sourceIdFor(fileBase);
    const taxonomy = taxonomyFor(`${fileBase}\n${raw}`);

    const blocks = modules.map((module) => buildComponent(module, title, slug));
    if (!blocks.some((block) => block.component === 'HeroStandard')) {
      const metaDescription = raw.match(/Meta description:\s*(.+)$/im)?.[1] ?? title;
      blocks.unshift(buildHero({ fields: { description: [metaDescription] }, cards: [] }, title, slug));
    }

    const content = [
      frontmatter({ sourceId, title, slug, taxonomy }),
      ...blocks.map(renderComponent)
    ].join('\n');

    await writeFile(path.join(outputDir, `${slugify(fileBase)}.md`), content, 'utf8');
  }

  console.log(`Generated ${files.length} markdown documents in ${path.relative(root, outputDir)}`);
}

await main();
