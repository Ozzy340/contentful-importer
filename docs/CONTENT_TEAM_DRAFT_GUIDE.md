# Content Team Draft Guide

## Purpose

This guide defines the current authoring pattern for `contentPage` imports into Contentful UAT.

For field-by-field formatting rules, use [Markdown Component Formatting Guide](MARKDOWN_COMPONENT_FORMATTING_GUIDE.md) together with [Contentful Component Field Reference](CONTENTFUL_COMPONENT_FIELD_REFERENCE.md).

Each draft should be structured so the importer can:

- parse it reliably
- map it to the real `contentPage` model
- validate it before upload
- rerun safely with deterministic IDs

## Current Target Shape

Each draft file maps to one `contentPage` entry.

The importer currently populates:

- `contentPage.internalName`
- `contentPage.heading`
- `contentPage.slug`
- `contentPage.heroContentArea`
- `contentPage.bodyContentArea`
- `contentPage.excludeFromSearch`
- page-level taxonomy metadata when enabled

## Required Frontmatter

Each draft must start with YAML frontmatter:

```yaml
---
sourceId: life-at-quadient
title: Life at Quadient
heading: Life at Quadient
slug: life-at-quadient
locale: en-US
contentType: contentPage
taxonomy:
  - topic:corporate-culture
  - role:human-resources
---
```

Use these rules:

- `sourceId`: stable identifier for the source draft
- `title`: internal name source
- `heading`: page heading; when omitted, it falls back to `title`
- `slug`: URL-safe slug
- `locale`: use an enabled locale such as `en-US`
- `contentType`: set to `contentPage`
- `tags`: optional, but only use tags that already exist in Contentful
- `taxonomy`: only use approved tokens that exist in `config/taxonomy-map.yml`

## Component Marker Format

Component markers use this structure:

```text
:::component ComponentName
key: value
anotherKey:
  - nested: value
:::
```

The block body is YAML. Nested arrays and objects are supported.

Component names cannot contain spaces. Use only the approved markers below for new drafts. The marker is the source markdown name; the target is the real Contentful content type in [CONTENTFUL_COMPONENT_FIELD_REFERENCE.md](CONTENTFUL_COMPONENT_FIELD_REFERENCE.md).

| Markdown marker | Contentful target | Use for |
| --- | --- | --- |
| `HeroStandard` | `heroBlock` | Page hero content |
| `PromoBlock` | `promoBlock` | Simple editorial or reassurance panels without CTA |
| `ActionBlock` | `promoBlock` | CTA panels with one CTA |
| `StatsBlock` | `statisticsBlock` | Statistics or facts |
| `FiftyFiftyBlock` | `fiftyFiftyBlock` | 50/50 layouts |
| `ProductCardBlock` | `productCardBlock` | Product family cards and USP listing cards |
| `FeatureCardBlock` | `featureCardBlock` | Stacked card blocks |
| `stackedCarouselCardBlock` | `stackedCarouselCardBlock` | Stacked or carousel card blocks; set `layout` to `Stacked 2 per row`, `Stacked 3 per row`, or `Carousel` |
| `TableBlock` | `tableBlock` | Tables |
| `ListBlock` | `listBlock` | Bulleted, numbered, unordered, or tick lists |
| `Testimonial` | `testimonialsBlock` | Testimonials |
| `LogoWall` | `logoBlock` | Logo groups |
| `FaqBlock` | `accordionBlock` | FAQs |
| `NotificationBlock` | `notificationBlock` | Notification or promo banners |

## Supported Blocks

### Plain paragraphs

Normal paragraphs become `richTextBlock` entries.

### HeroStandard

Use this once at the top of the page. It maps to `heroBlock` and is attached through `heroContentArea`.

```text
:::component HeroStandard
eyebrow: Careers
description: Introductory hero copy
lowerSubtext: Optional supporting note
image:
  path: ../assets/example/hero.svg
  alt: Placeholder hero image
  title: Hero image
callsToAction:
  - text: Search jobs
    url: https://example.com/jobs
    style: Primary Orange Solid
  - text: Meet our people
    url: https://example.com/stories
    style: Primary Gray Outline
:::
```

### PromoBlock

Use for a highlighted message without a CTA.

### ActionBlock

Use for a highlighted message with one CTA.

### StatsBlock

Use for a statistics strip. Each item needs `text` and can include `supportingText`.

### ProductCardBlock

Use for Product Family Card and USP listing copy. Each card needs `heading`, `description`, `image`, and `link`. The Contentful model requires at least four cards.

### FeatureCardBlock

Use for Stacked Card Block copy. Include a block-level `image` and up to four `cards`.

### Testimonial

Use for one or more employee quotes. Each testimonial needs:

- `tagline`
- `quote`

### stackedCarouselCardBlock

Use for stacked or carousel card blocks. Set `layout` to `Stacked 2 per row` for two cards, `Stacked 3 per row` for three cards, and `Carousel` for four or more cards. Also use this for Timeline Block, Standard Card, Solution Card Carousel, and SolutionsCardCarousel copy.

### LogoWall

Use for approved partner or certification logos. Each logo item should provide an image object:

```yaml
- image:
    path: ../assets/example/logo.svg
    alt: Example logo
    title: Example logo
```

### TableBlock

Use for any table from a copy deck. Put the markdown table under the `table` property so it becomes a `tableBlock`.

### ListBlock

Use for standalone lists. Set `style` to `Tick`, `Bulleted`, `Numbered`, or `Unordered`.

### FaqBlock

Use for question-and-answer content. Each item needs:

- `heading`
- `body`

## Supported CTA Styles

Where a CTA `style` is provided, use values that match the live model:

- `Primary Gray Solid`
- `Primary Gray Outline`
- `Primary Orange Solid`
- `Secondary White Solid`
- `Link Orange`
- `Link Orange Left Arrow`
- `Link Orange Right Arrow`

## Authoring Rules

- One file per page.
- Keep component names exact.
- Use valid URLs for CTA links.
- Keep image paths relative to the draft file.
- Do not invent new tags or taxonomy tokens.
- Do not assume the importer will create tags, taxonomy, or linked destination pages.
- Use plain paragraph copy between component blocks when you want standard rich text.

## Handoff Checklist

- frontmatter is complete
- slug is final
- component names match the approved list
- required CTA text and URLs are present
- required asset files exist locally
- tags already exist in Contentful if used
- taxonomy tokens are approved and mapped

## Working Example

Use [CONTENT_PAGE_DRAFT_TEMPLATE.md](/Users/jamesatkins/Documents/JS/contentful-importer/docs/CONTENT_PAGE_DRAFT_TEMPLATE.md) as the current full-structure example for a `contentPage` import.
