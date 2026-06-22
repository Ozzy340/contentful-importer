import path from 'node:path';
import { z } from 'zod';

import { renderTemplate, slugify, toContentfulResourceId } from './ids.js';
import type {
  CanonicalBlock,
  CanonicalDocument,
  ComponentMapConfig,
  ConventionsConfig,
  ContentfulEntryLink,
  ContentfulRichTextNode,
  ContentfulRichTextDocument,
  ParsedDocument,
  TaxonomyMapConfig
} from './types.js';

const richTextNodeSchema = z.object({
  nodeType: z.string(),
  data: z.record(z.string(), z.unknown()),
  content: z.array(z.any()).optional(),
  value: z.string().optional(),
  marks: z.array(z.record(z.string(), z.unknown())).optional()
});

const entryLinkSchema = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Entry'),
    id: z.string().min(1)
  })
});

export const canonicalDocumentSchema: z.ZodType<CanonicalDocument> = z.object({
  sourceId: z.string().min(1),
  sourcePath: z.string().min(1),
  locale: z.string().min(1),
  target: z.object({
    contentType: z.string().min(1),
    entryId: z.string().min(1)
  }),
  metadata: z.object({
    title: z.string().min(1),
    internalName: z.string().optional(),
    heading: z.string().min(1),
    slug: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    finalizedUrl: z.string().optional(),
    parent: entryLinkSchema.optional(),
    tags: z.array(z.string()),
    taxonomyConceptIds: z.array(z.string()),
    sourceTaxonomyTokens: z.array(z.string())
  }),
  blocks: z.array(
    z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('richText'),
        body: z.object({
          nodeType: z.literal('document'),
          data: z.record(z.string(), z.unknown()),
          content: z.array(richTextNodeSchema)
        })
      }),
      z.object({
        kind: z.literal('component'),
        component: z.string().min(1),
        props: z.record(z.string(), z.unknown())
      }),
      z.object({
        kind: z.literal('asset'),
        path: z.string().min(1),
        absolutePath: z.string().min(1),
        alt: z.string().optional()
      })
    ])
  )
});

export function normalizeParsedDocument(
  parsed: ParsedDocument,
  conventions: ConventionsConfig,
  componentMap: ComponentMapConfig,
  taxonomyMap: TaxonomyMapConfig
): CanonicalDocument {
  const slug = slugify(parsed.slug ?? parsed.title);
  const locale = parsed.locale ?? conventions.defaults.locale;
  const targetContentType = componentMap.document.targetContentType;
  const entryId = toContentfulResourceId(
    renderTemplate(
      componentMap.document.entryIdPattern ?? conventions.naming.parentEntryIdPattern,
      {
        contentType: targetContentType,
        slug,
        sourceId: parsed.sourceId,
        title: parsed.title
      }
    )
  );

  const canonical: CanonicalDocument = {
    sourceId: parsed.sourceId,
    sourcePath: parsed.sourcePath,
    locale,
    target: {
      contentType: targetContentType,
      entryId
    },
    metadata: {
      title: parsed.title,
      internalName: parsed.internalName,
      heading: parsed.heading ?? parsed.title,
      slug,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      finalizedUrl: parsed.finalizedUrl,
      parent: parsed.parent ?? defaultParentLink(conventions),
      tags: dedupe(parsed.tags),
      taxonomyConceptIds: dedupe(
        parsed.taxonomyTokens.flatMap((token) => {
          const mapped = taxonomyMap.concepts[token]?.conceptId;
          return mapped ? [mapped] : [];
        })
      ),
      sourceTaxonomyTokens: dedupe(parsed.taxonomyTokens)
    },
    blocks: parsed.blocks.map((block) => normalizeBlock(block))
  };

  return canonicalDocumentSchema.parse(canonical);
}

function defaultParentLink(conventions: ConventionsConfig): ContentfulEntryLink | undefined {
  const defaultParent = conventions.defaults.defaultParent;
  if (!defaultParent?.enabled) {
    return undefined;
  }

  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: defaultParent.entryId
    }
  };
}

function normalizeBlock(block: ParsedDocument['blocks'][number]): CanonicalBlock {
  if (block.type === 'text') {
    return {
      kind: 'richText',
      body: createRichTextDocument(block.text)
    };
  }

  if (block.type === 'component') {
    return {
      kind: 'component',
      component: block.component,
      props: block.props
    };
  }

  return {
    kind: 'asset',
    path: block.path,
    absolutePath: block.absolutePath,
    alt: block.alt
  };
}

export function canonicalFileNameFor(document: CanonicalDocument): string {
  const basename = path.basename(document.sourcePath, path.extname(document.sourcePath));
  return `${basename}.canonical.json`;
}

export function createRichTextDocument(text: string): ContentfulRichTextDocument {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    nodeType: 'document',
    data: {},
    content: blocks.map((block) => parseMarkdownTable(block) ?? createParagraphNode(block))
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function createParagraphNode(text: string): ContentfulRichTextNode {
  return {
    nodeType: 'paragraph',
    data: {},
    content: [
      {
        nodeType: 'text',
        value: text.replace(/\n/g, ' ').trim(),
        marks: [],
        data: {}
      }
    ]
  };
}

function parseMarkdownTable(block: string): ContentfulRichTextNode | undefined {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || !lines.every((line) => line.includes('|'))) {
    return undefined;
  }

  const separatorIndex = lines.findIndex((line) => isMarkdownTableSeparator(line));
  if (separatorIndex !== 1) {
    return undefined;
  }

  const rows = [lines[0]!, ...lines.slice(separatorIndex + 1)]
    .map((line) => splitMarkdownTableRow(line))
    .filter((row) => row.length > 0);

  if (rows.length < 2) {
    return undefined;
  }

  return {
    nodeType: 'table',
    data: {},
    content: rows.map((row, rowIndex) => ({
      nodeType: 'table-row',
      data: {},
      content: row.map((cell) => ({
        nodeType: rowIndex === 0 ? 'table-header-cell' : 'table-cell',
        data: {},
        content: [createParagraphNode(cell)]
      }))
    }))
  };
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
