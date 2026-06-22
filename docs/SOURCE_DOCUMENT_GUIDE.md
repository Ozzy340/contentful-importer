# Source Document Guide

## Phase-1 Format

Phase 1 uses a structured markdown format that mirrors the expected Word-style source shape. This keeps the system easy to test while leaving room for a richer `.docx` parser later.

When a directory is supplied to parse, dry-run, upload, publish, or reporting commands, only `.md` and `.markdown` files are treated as import documents. Raw `.txt` mockups can live beside generated markdown files for reference, but they are not imported from directory sources.

For the current UAT mapping, the phase-1 target is `contentPage`. The recommended authoring contract for content teams is documented in:

- [Content Team Draft Guide](CONTENT_TEAM_DRAFT_GUIDE.md)
- [Content Page Draft Template](CONTENT_PAGE_DRAFT_TEMPLATE.md)
- [Markdown Component Formatting Guide](MARKDOWN_COMPONENT_FORMATTING_GUIDE.md)
- [Contentful Component Field Reference](CONTENTFUL_COMPONENT_FIELD_REFERENCE.md)

## Metadata

Each document starts with YAML frontmatter.

Example:

```yaml
---
sourceId: about-us
title: About Us
heading: About Us
slug: about-us
locale: en-US
contentType: contentPage
finalizedUrl: https://www.quadient.com/en-us/about-us
metaTitle: About Us | Quadient
metaDescription: Short search description for the page.
tags:
  - website:marketing
taxonomy:
  - topic:company
---
```

Supported metadata:

- `sourceId`
- `title`
- `heading`
- `slug`
- `locale`
- `contentType`
- `finalizedUrl`
- `metaTitle`
- `metaDescription`
- `tags`
- `taxonomy`

## Free Text Blocks

Plain paragraphs outside component blocks are normalised into canonical `richText` blocks.

Separate paragraphs with blank lines.

## Pseudo-Component Markers

Use the block form:

```text
:::component HeroStandard
eyebrow: Careers
description: Introductory hero copy
image:
  path: ../assets/example/hero.svg
  alt: Example hero image
  title: Example hero image
:::
```

The block body is parsed as YAML.

Recommended source markers for new `contentPage` imports:

| Source marker | Contentful content type |
| --- | --- |
| `HeroStandard` | `heroBlock` |
| `PromoBlock` | `promoBlock` |
| `ActionBlock` | `promoBlock` |
| `StatsBlock` | `statisticsBlock` |
| `FiftyFiftyBlock` | `fiftyFiftyBlock` |
| `FiftyFiftyText` | `fiftyFiftyBlock` |
| `ProductCardBlock` | `productCardBlock` |
| `FeatureCardBlock` | `featureCardBlock` |
| `stackedCarouselCardBlock` | `stackedCarouselCardBlock` |
| `TableBlock` | `tableBlock` |
| `ListBlock` | `listBlock` |
| `Testimonial` | `testimonialsBlock` |
| `LogoWall` | `logoBlock` |
| `FaqBlock` | `accordionBlock` |
| `NotificationBlock` | `notificationBlock` |

Legacy aliases may still exist in `component-map.yml` for old drafts, but new generated markdown should use the recommended markers above.

## Asset References

Use markdown image syntax:

```markdown
![Alt text](../../source/assets/about-flow.svg)
```

The parser keeps:

- relative path
- resolved absolute path
- alt text

Standalone markdown image blocks are still intentionally out of scope for `contentPage.bodyContentArea`. Image assets should be supplied inside supported component YAML, for example hero media or logo wall items.

## Ordering

Block order is preserved through parsing, canonical normalisation, mapping, and parent reference assembly.

## Known Phase-1 Limitations

- no native `.docx` parser yet
- no inline component syntax yet
- rich text conversion is paragraph-oriented, not full markdown-to-Contentful rich text
- no automatic conversion from arbitrary Word layout patterns into structured component YAML yet
- standalone body images are not supported for `contentPage` imports in phase 1
- arbitrary table extraction from `.docx` is not automatic yet; generated markdown should use `TableBlock`
- no embedded asset metadata beyond the values explicitly supplied in component YAML

These limitations are deliberate for phase 1 so the importer can be tested safely in a real sandbox without overbuilding the parser.
