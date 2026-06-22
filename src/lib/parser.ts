import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import yaml from 'js-yaml';
import { z } from 'zod';

import type { ParsedBlock, ParsedDocument } from './types.js';

const entryLinkSchema = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Entry'),
    id: z.string().min(1)
  })
});

const frontmatterSchema = z.object({
  sourceId: z.string().optional(),
  internalName: z.string().optional(),
  title: z.string().optional(),
  heading: z.string().optional(),
  slug: z.string().optional(),
  locale: z.string().optional(),
  contentType: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  finalizedUrl: z.string().optional(),
  parent: entryLinkSchema.optional(),
  tags: z.array(z.string()).optional(),
  taxonomy: z.array(z.string()).optional()
});

const SOURCE_DOCUMENT_EXTENSIONS = new Set(['.md', '.markdown']);

export async function collectSourceDocumentPaths(inputPath: string): Promise<string[]> {
  const resolved = path.resolve(inputPath);
  const details = await stat(resolved);

  if (details.isFile()) {
    return [resolved];
  }

  const paths = await walkDirectory(resolved);
  return paths
    .filter((filePath) => SOURCE_DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort();
}

async function walkDirectory(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const nextPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return walkDirectory(nextPath);
      }

      return [nextPath];
    })
  );

  return nested.flat();
}

export async function parseSourceDocument(filePath: string): Promise<ParsedDocument> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = matter(raw);
  const frontmatter = frontmatterSchema.parse(parsed.data);
  const blocks = parseBodyBlocks(parsed.content, filePath);
  const sourceId =
    frontmatter.sourceId ??
    frontmatter.slug ??
    frontmatter.title?.toLowerCase().replace(/\s+/g, '-') ??
    path.basename(filePath, path.extname(filePath));

  return {
    sourcePath: filePath,
    sourceId,
    internalName: frontmatter.internalName,
    title: frontmatter.title ?? sourceId,
    heading: frontmatter.heading,
    slug: frontmatter.slug,
    locale: frontmatter.locale,
    contentType: frontmatter.contentType,
    metaTitle: frontmatter.metaTitle,
    metaDescription: frontmatter.metaDescription,
    finalizedUrl: frontmatter.finalizedUrl,
    parent: frontmatter.parent,
    tags: frontmatter.tags ?? [],
    taxonomyTokens: frontmatter.taxonomy ?? [],
    blocks
  };
}

function parseBodyBlocks(content: string, filePath: string): ParsedBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let textBuffer: string[] = [];
  let order = 0;

  const flushText = (): void => {
    const text = textBuffer.join('\n').trim();
    textBuffer = [];
    if (!text) {
      return;
    }

    blocks.push({
      type: 'text',
      order: order += 1,
      text
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const componentMatch = line.match(/^:::component\s+([A-Za-z0-9_-]+)\s*$/);
    const assetMatch = line.match(/^!\[(.*?)\]\((.*?)\)\s*$/);

    if (componentMatch) {
      flushText();
      const component = componentMatch[1]!;
      const yamlLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index] !== ':::') {
        yamlLines.push(lines[index] ?? '');
        index += 1;
      }

      const props = (yaml.load(yamlLines.join('\n')) as Record<string, unknown> | undefined) ?? {};
      const normalized = normalizeComponentBlock(component, props);
      blocks.push({
        type: 'component',
        order: order += 1,
        component: normalized.component,
        props: normalized.props,
        sourceComponent: component,
        sourceProps: props
      });
      continue;
    }

    if (assetMatch) {
      flushText();
      const relativePath = assetMatch[2]!;
      blocks.push({
        type: 'asset',
        order: order += 1,
        path: relativePath,
        absolutePath: path.resolve(path.dirname(filePath), relativePath),
        alt: assetMatch[1] || undefined
      });
      continue;
    }

    textBuffer.push(line);
  }

  flushText();
  return blocks;
}

function normalizeComponentBlock(
  component: string,
  props: Record<string, unknown>
): { component: string; props: Record<string, unknown> } {
  const normalizedProps = normalizeProps(props);

  if (component === 'heroBlock') {
    return { component: 'HeroStandard', props: normalizedProps };
  }

  if (component === 'accordionBlock') {
    return { component: 'FaqBlock', props: normalizedProps };
  }

  if (component === 'productCardBlock') {
    return { component: 'ProductCardBlock', props: normalizedProps };
  }

  if (component === 'statisticsBlock') {
    return { component: 'StatsBlock', props: normalizedProps };
  }

  if (component === 'notificationBlock') {
    return { component: 'NotificationBlock', props: normalizedProps };
  }

  if (component === 'testimonialsBlock') {
    return { component: 'Testimonials', props: normalizedProps };
  }

  if (component === 'promoBlock') {
    return {
      component: normalizedProps.callToAction ? 'ActionBlock' : 'PromoBlock',
      props: normalizedProps
    };
  }

  return { component, props: normalizedProps };
}

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...props };

  copyAlias(normalized, 'heading', ['Heading']);
  copyAlias(normalized, 'eyebrow', ['eyebrowText']);
  copyAlias(normalized, 'description', ['subtitle']);
  copyAlias(normalized, 'cards', ['productCards']);
  copyAlias(normalized, 'items', ['accordionItems']);
  copyAlias(normalized, 'table', ['tableContent']);
  copyAlias(normalized, 'heading', ['notificationHeading']);
  copyAlias(normalized, 'body', ['notificationDescription']);
  if (normalized.callsToAction === undefined && Array.isArray(normalized.callToAction)) {
    normalized.callsToAction = normalized.callToAction;
    delete normalized.callToAction;
  }
  copyAlias(normalized, 'callsToAction', ['callToActions']);

  if (Array.isArray(normalized.callsToAction)) {
    normalized.callsToAction = normalized.callsToAction.map((item) => normalizeCtaLike(item));
  }

  if (normalized.callToAction) {
    normalized.callToAction = normalizeCtaLike(normalized.callToAction);
  }

  if (Array.isArray(normalized.cards)) {
    normalized.cards = normalized.cards.map((item) => normalizeCardLike(item));
  }

  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map((item) => normalizeAccordionItemLike(item));
  }

  return normalized;
}

function normalizeCardLike(item: unknown): unknown {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const normalized: Record<string, unknown> = { ...(item as Record<string, unknown>) };
  if (normalized.link) {
    normalized.link = normalizeCtaLike(normalized.link);
  }
  return normalized;
}

function normalizeAccordionItemLike(item: unknown): unknown {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const normalized: Record<string, unknown> = { ...(item as Record<string, unknown>) };
  copyAlias(normalized, 'heading', ['itemHeading']);
  copyAlias(normalized, 'body', ['itemContent']);
  copyAlias(normalized, 'heading', ['question']);
  copyAlias(normalized, 'body', ['answer']);
  return normalized;
}

function normalizeCtaLike(item: unknown): unknown {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const normalized: Record<string, unknown> = { ...(item as Record<string, unknown>) };
  copyAlias(normalized, 'text', ['linkText']);
  copyAlias(normalized, 'url', ['externalUrl']);
  copyAlias(normalized, 'openInNewTab', ['openUrlInNewTab']);
  return normalized;
}

function copyAlias(
  target: Record<string, unknown>,
  canonicalKey: string,
  aliasKeys: string[]
): void {
  if (target[canonicalKey] !== undefined) {
    return;
  }

  for (const aliasKey of aliasKeys) {
    if (target[aliasKey] !== undefined) {
      target[canonicalKey] = target[aliasKey];
      delete target[aliasKey];
      return;
    }
  }
}
