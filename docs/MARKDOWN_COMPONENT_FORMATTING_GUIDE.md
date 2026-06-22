# Markdown Component Formatting Guide

Use this guide when generating source `.md` files for new `contentPage` imports.

This document is intentionally strict. It documents the current markdown source shape that `config/component-map.yml` reads, and it cross-checks that shape against the generated Contentful model docs:

- [CONTENTFUL_COMPONENT_FIELD_REFERENCE.md](CONTENTFUL_COMPONENT_FIELD_REFERENCE.md)
- [COMPONENT_LIST.md](COMPONENT_LIST.md)
- [config/component-map.yml](../config/component-map.yml)

Do not invent source properties from Contentful field names unless this guide says the importer reads them. A field can exist in Contentful and still be unavailable from markdown until it is mapped in `component-map.yml`.

## Core Rules

1. Use only the component markers listed in this guide for new page generation.
2. Use only the markdown properties listed for that marker.
3. Treat YAML inside `:::component ... :::` blocks as case-sensitive.
4. Treat dropdown values as exact strings. Capitalization matters.
5. Do not rely on parser compatibility names when generating new pages.
6. Run `npm run dry-run -- --source <file-or-folder>` before upload.

The page heading belongs on the parent `contentPage` frontmatter as `heading`. `HeroStandard` does not read a `heading` property, and `heroBlock` has no `heading` field in the Contentful model.

## Page Shape

Every uploadable page is one markdown file with YAML frontmatter followed by component blocks.

```markdown
---
sourceId: stable-page-id
internalName: Internal Page Name
title: Internal Page Name
heading: Page H1
slug: page-slug
locale: en-US
contentType: contentPage
metaTitle: Page Title | Quadient
metaDescription: Short search description for the page.
taxonomy:
  - topic:customer-communications
---

:::component HeroStandard
eyebrow: "Optional hero eyebrow"
description: "Optional hero subtitle."
image:
  path: "../assets/example/hero.svg"
  title: "Hero image title"
  alt: "Hero image alt text"
:::

Plain markdown between components becomes a `richTextBlock`.
```

## Frontmatter

| Frontmatter key | Current behavior |
| --- | --- |
| `sourceId` | Stable source identifier used in generated entry IDs. Supply this for every generated page. |
| `internalName` | Optional source for `contentPage.internalName`; the importer uses the value as-is. |
| `title` | Internal title and template source. Supply this even when `internalName` is present. |
| `heading` | Required page H1 source for `contentPage.heading`. This is the page heading, including hero H1 text. |
| `slug` | Source for `contentPage.slug`; supply the final path slug without a leading slash. |
| `locale` | Optional locale. Defaults from `conventions.yml` when omitted. |
| `contentType` | Parsed for metadata, but the current mapper always targets `contentPage`. Keep it as `contentPage` for clarity. |
| `parent` | Optional Contentful entry link for `contentPage.parent`. Use when the target model requires a parent page. |
| `metaTitle` | Optional source for `contentPage.metaTitle`. |
| `metaDescription` | Optional source for `contentPage.metaDescription`. |
| `tags` | Optional source tags. They must already exist unless tag creation is enabled. |
| `taxonomy` | Optional taxonomy tokens. They must exist in `taxonomy-map.yml` when taxonomy mapping is required. |
| `finalizedUrl` | Parsed as metadata only. It is not mapped to a Contentful field by the current component map. |

Current Contentful-required `contentPage` fields are satisfied as follows:

| Contentful field | How it is satisfied |
| --- | --- |
| `internalName` | From `internalName`, then `title`, then the map template. |
| `parent` | From frontmatter `parent` when the target Contentful model requires a parent page. |
| `slug` | From frontmatter `slug`, normalized by the importer. |
| `heading` | From frontmatter `heading`. |
| `excludeFromSearch` | Defaulted to `false` by `component-map.yml`; frontmatter does not currently control it. |

Contentful page fields such as `heroDescriptionRichText`, `searchImportance`, and `showInXmlSiteMap` exist in the model, but they are not mapped from current markdown frontmatter.

When a whole batch should share the same parent, run `dry-run` or `upload` with `--default-parent-entry-id <entry-id>`. That fills only documents where frontmatter `parent` is absent.

## Component Blocks

Component blocks use this exact wrapper:

```markdown
:::component ComponentMarker
field: value
nestedObject:
  field: value
items:
  - field: value
:::
```

The first `HeroStandard` component is linked to `contentPage.heroContentArea`. `HeroStandard` blocks are excluded from `contentPage.bodyContentArea`; all other component blocks and plain markdown rich text are added to the body in source order.

## Shared Value Shapes

### CTA Objects

Use this shape wherever a component field says it accepts a CTA object:

```yaml
callToAction:
  text: "Explore solutions"
  url: "https://www.quadient.com/solutions"
  style: "Primary Orange Solid"
  openInNewTab: false
```

For CTA lists, use the property name required by the component, such as `callsToAction` at hero and CTA-section level, or `callToActions` inside fifty-fifty items.

Portable CTA fields read by mapped CTA objects:

| Markdown field | Contentful field | Required |
| --- | --- | --- |
| `text` | `ctaItem.linkText` | yes |
| `url` | `ctaItem.externalUrl` | no, but supply it for external links |
| `style` | `ctaItem.style` | no |
| `openInNewTab` | `ctaItem.openUrlInNewTab` | no |

Some CTA mappings also read `internalName`, and `HeroStandard` CTAs also read `customiseStyle` and `useExternalLink`. Do not use those fields elsewhere unless the component reference below lists them.

Allowed CTA `style` values:

- `Primary Gray Solid`
- `Primary Gray Outline`
- `Primary Orange Solid`
- `Secondary White Solid`
- `Link Orange`
- `Link Orange Left Arrow`
- `Link Orange Right Arrow`

### Image Objects

Use this shape wherever a component says it accepts an image object:

```yaml
image:
  path: "../assets/example/image.svg"
  title: "Image title"
  alt: "Image alt text"
  description: "Optional asset description"
```

| Markdown field | Contentful target | Required |
| --- | --- | --- |
| `path` | linked Contentful Asset, then `imageWithFocalPoint.image` | yes |
| `title` | Asset title and `imageWithFocalPoint.title` | yes |
| `alt` | `imageWithFocalPoint.altText` | no, but strongly recommended |
| `description` | Asset description metadata | no |

`imageWithFocalPoint.focus` is currently defaulted to `Center`. Markdown does not currently map focus or focal point coordinates.

### Rich Text Source

Fields marked as rich text can be written as strings or YAML blocks:

```yaml
description: >
  First paragraph.

  Second paragraph with a link URL written as plain text if needed.
```

Current rich text conversion is conservative. It preserves paragraph blocks and simple markdown tables; it does not parse full markdown syntax into rich Contentful nodes.

### Tables

Use `TableBlock.table` for table content:

```yaml
table: |
  | Step | Detail |
  | --- | --- |
  | Explore | Review the role. |
  | Apply | Submit your application. |
```

## Component Reference

The tables below list the markdown fields the current importer reads. Required fields include fields required by Contentful validation when the map does not provide a default or template.

### HeroStandard

Maps to `heroBlock`.

Required:

- `image.path`
- `image.title`

Optional source fields:

- `internalName`
- `heroStyle`: `Standard` or `Impact`; default `Standard`
- `headingFontStyle`: `Standout` or `Regular`; default `Regular`
- `eyebrow` -> `heroBlock.eyebrowText`
- `description` -> `heroBlock.subtitle`
- `lowerSubtext`
- `callsToAction`: maximum 2 CTA objects
- `desktopImageSize`: `Standard` or `Large`; default `Large`
- `hideImageAccent`: boolean; default `false`
- `theme`: `Grey` or `White`; default `White`
- `applyGradient`: boolean; default `false`

Valid source shape:

```markdown
:::component HeroStandard
eyebrow: "Careers"
description: "Know what to prepare and what to expect before you apply."
lowerSubtext: "Explore current openings"
heroStyle: "Standard"
headingFontStyle: "Regular"
desktopImageSize: "Large"
theme: "White"
image:
  path: "../assets/careers/hero.svg"
  title: "Careers hero image"
  alt: "People collaborating at work."
callsToAction:
  - text: "Browse roles"
    url: "https://www.quadient.com/en-us/careers/job-hub"
    style: "Primary Orange Solid"
:::
```

Do not add `heading` to `HeroStandard`; use frontmatter `heading` for the page H1.

### PromoBlock

Maps to `promoBlock`.

Required:

- `heading`

Optional source fields:

- `internalName`
- `statementText` -> `promoBlock.statementText`
- `description`

Defaults supplied by the map:

- `headingStyle`: `h2`
- `style`: `White`
- `textColour`: `Grey`
- `hideCornerAccent`: `false`

Valid source shape:

```markdown
:::component PromoBlock
statementText: "Business communications"
heading: "Your trusted partner in business communications"
description: "Quadient helps organizations communicate clearly and reliably."
:::
```

`PromoBlock` does not read `eyebrow`, `style`, `textColour`, or `hideCornerAccent` from markdown in the current map.

### ActionBlock

Maps to `promoBlock` with a nested `ctaItem`.

Required:

- `heading`
- `callToAction.text` when `callToAction` is present

Optional source fields:

- `internalName`
- `statementText`
- `description`
- `callToAction`

Valid source shape:

```markdown
:::component ActionBlock
statementText: "Next step"
heading: "See how Quadient helps your business run better"
description: "Explore solutions that make communications easier to manage."
callToAction:
  text: "Explore solutions"
  url: "https://www.quadient.com/solutions"
  style: "Primary Orange Solid"
:::
```

### MissionFraming, BigIdeaPanel, PromoCard, timelineBlock

These configured markers all create `promoBlock` entries.

| Marker | Required source fields | Optional source fields | Notes |
| --- | --- | --- | --- |
| `MissionFraming` | `heading` | `eyebrow`, `description`, `callToAction` | `eyebrow` maps to `statementText`. |
| `BigIdeaPanel` | `heading` | `eyebrow`, `description` | `eyebrow` maps to `statementText`. |
| `PromoCard` | `title` | `summary` | `title` maps to `promoBlock.heading`; `summary` maps to `description`. |
| `timelineBlock` | `heading` | `eyebrow`, `description` | Configured as a `promoBlock` fallback. Use only when that fallback is intentional. |

### NotificationBlock And CallToActionBanner

Both map to `notificationBlock`.

| Marker | Required source fields | Optional source fields | Target mapping |
| --- | --- | --- | --- |
| `NotificationBlock` | `heading` | `body` | `heading` -> `notificationHeading`; `body` -> rich text `notificationDescription`. |
| `CallToActionBanner` | `headline` | `body` | `headline` -> `notificationHeading`; `body` -> rich text `notificationDescription`. |

`notificationBlock.callToAction` exists in Contentful, but the current markdown map does not populate it.

### StatsBlock

Maps to `statisticsBlock` with nested `statisticItem` entries.

Required source fields:

- none beyond the generated internal names and defaults, but provide `statistics` for visible statistics

Optional source fields:

- `eyebrow`
- `heading`
- `statistics[].text`
- `statistics[].supportingText`

Defaults supplied by the map:

- `statisticsBlock.headingStyle`: `h2`
- `statisticsBlock.style`: `Statistics`
- `statisticItem.supportingTextColour`: `Grey`
- `statisticItem.statisticStyle`: `Text`

Valid source shape:

```markdown
:::component StatsBlock
eyebrow: "Impact"
heading: "Results customers can measure"
statistics:
  - text: "95%"
    supportingText: "Customer satisfaction"
  - text: "2x"
    supportingText: "Faster processing"
:::
```

`statisticsBlock.facts` exists in Contentful, but this marker does not map facts.

### FiftyFiftyBlock And FiftyFiftyText

Both map to `fiftyFiftyBlock` with nested `fiftyFiftyItem` entries.

Required:

- `firstItemPosition`: `Content Left, Text Right` or `Content Right, Text Left`
- `items[].heading`
- `items[].contentTypeDisplay`: `Image`, `Tick List`, or `Video`
- `items[].theme`: `Light Grey`, `Graphite`, or `White`

Optional source fields:

- `items[].eyebrow`
- `items[].description`
- `items[].callToActions`: maximum 2 CTA objects

Valid source shape:

```markdown
:::component FiftyFiftyBlock
firstItemPosition: "Content Left, Text Right"
items:
  - eyebrow: "Our focus"
    heading: "Simplifying business communications"
    description: "Help teams communicate clearly across every channel."
    contentTypeDisplay: "Image"
    theme: "White"
    callToActions:
      - text: "Explore solutions"
        url: "https://www.quadient.com/solutions"
        style: "Link Orange Right Arrow"
:::
```

Current markdown does not map `fiftyFiftyItem.image`, `mobileImage`, `video`, `bynderVideo`, or `listBlock`. Do not add those nested structures until the component map supports them.

### stackedCarouselCardBlock

Maps to `stackedCarouselCardBlock` with nested `cardItem` entries.

Required:

- `cards`: minimum 2, maximum 12
- `cards[].heading`
- `callToAction.text` when `callToAction` is present
- `cards[].link.text` when a card link is present

Optional source fields:

- `internalName`
- `eyebrow`
- `heading`
- `description`
- `callToAction`
- `layout`: `Stacked 3 per row`, `Stacked 2 per row`, or `Carousel`; default `Carousel`
- `backgroundColour`: `White` or `Light Grey`; default `White`
- `cards[].internalName`
- `cards[].description`
- `cards[].link`

Valid source shape:

```markdown
:::component stackedCarouselCardBlock
eyebrow: "Process"
heading: "What to expect"
description: "A simple view of the steps from application to offer."
layout: "Carousel"
backgroundColour: "Light Grey"
cards:
  - heading: "Explore roles"
    description: "Browse opportunities that match your experience."
  - heading: "Submit application"
    description: "Apply through Job Hub carefully and securely."
:::
```

### UspListing, SolutionCardCarousel, SolutionCardStacked, InsightsResources

These markers also map to `stackedCarouselCardBlock` with nested `cardItem` entries.

| Marker | Required source fields | Optional source fields | Defaults and limits |
| --- | --- | --- | --- |
| `UspListing` | `cards`, `cards[].heading` | `eyebrow`, `heading`, `description`, `layout`, `cards[].description`, `cards[].link` | `layout` defaults to `Carousel`; cards min 2, max 12. |
| `SolutionCardCarousel` | `cards`, `cards[].heading` | `eyebrow`, `heading`, `description`, `cards[].description`, `cards[].link` | `layout` fixed to `Carousel`; cards min 2, max 12. |
| `SolutionCardStacked` | `cards`, `cards[].heading` | `eyebrow`, `heading`, `description`, `cards[].description`, `cards[].link` | `layout` fixed to `Stacked 2 per row`; cards min 2, max 12. |
| `InsightsResources` | `cards`, `cards[].heading` | `eyebrow`, `heading`, `description`, `callToAction`, `cards[].description`, `cards[].link` | `layout` fixed to `Stacked 2 per row`; cards min 2, max 12. |

### CtaForm And CtaSection

Both map to `stackedCarouselCardBlock`. Their `cards` field must be populated with `cardItem` entries, and each card can carry a nested `link` that maps to `ctaItem`.

Required:

- `cards`: minimum 2 for the target `cards` field
- `cards[].heading`

Optional source fields:

- `heading`
- `description`
- `cards[].description`
- `cards[].link.text`
- `cards[].link.url`
- `cards[].link.style`
- `cards[].link.openInNewTab`

Valid source shape:

```markdown
:::component CtaSection
heading: "Keep exploring"
description: "Choose the next useful path."
cards:
  - heading: "Browse roles"
    link:
      text: "Browse roles"
      url: "https://www.quadient.com/en-us/careers/job-hub"
      style: "Primary Orange Solid"
  - heading: "Life at Quadient"
    link:
      text: "Life at Quadient"
      url: "https://www.quadient.com/en-us/careers/life-at-quadient"
      style: "Link Orange Right Arrow"
:::
```

### ProductCardBlock

Maps to `productCardBlock` with nested `productCard` entries.

Required:

- `heading`
- `cards`: minimum 4, maximum 10
- `cards[].heading`
- `cards[].image.path`
- `cards[].image.title`
- `callToAction.text` when `callToAction` is present
- `cards[].link.text`

Optional source fields:

- `internalName`
- `eyebrow`
- `description`
- `callToAction`
- `cards[].internalName`
- `cards[].description`
- `cards[].image.alt`
- `cards[].image.description`
- `cards[].link.url`
- `cards[].link.style`
- `cards[].link.openInNewTab`

Valid source shape:

```markdown
:::component ProductCardBlock
eyebrow: "Prepare"
heading: "What to do before you apply"
description: "A few simple steps can help you apply with confidence."
cards:
  - heading: "Tailor your CV"
    description: "Highlight the experience and skills that match the role."
    image:
      path: "../assets/careers/tailor-cv.svg"
      title: "Tailor your CV card image"
      alt: "A person reviewing a CV."
    link:
      text: "Browse roles"
      url: "https://www.quadient.com/en-us/careers/job-hub"
      style: "Link Orange Right Arrow"
  - heading: "Check the role details"
    image:
      path: "../assets/careers/check-role.svg"
      title: "Check role details card image"
    link:
      text: "View roles"
      url: "https://www.quadient.com/en-us/careers/job-hub"
  - heading: "Prepare examples"
    image:
      path: "../assets/careers/examples.svg"
      title: "Prepare examples card image"
    link:
      text: "Interview tips"
      url: "https://www.quadient.com/en-us/careers/before-you-apply"
  - heading: "Get to know Quadient"
    image:
      path: "../assets/careers/culture.svg"
      title: "Culture card image"
    link:
      text: "Explore culture"
      url: "https://www.quadient.com/en-us/careers/life-at-quadient"
:::
```

`productCardBlock.headingStyle` is required in Contentful and defaulted to `H2` by the current map. Markdown does not currently override it.

### FeatureCardBlock

Maps to `featureCardBlock` with nested `featureCardItem` entries.

Required:

- `image.path`
- `image.title`
- `cards`
- `cards[].heading`
- `upperCallToAction.text` when `upperCallToAction` is present
- `lowerCallToAction.text` when `lowerCallToAction` is present
- `cards[].link.text` when a card link is present

Optional source fields:

- `heading`
- `headingStyle`: `H2` or `H3`; default `H2`
- `description`
- `eyebrow`
- `upperCallToAction`
- `lowerCallToAction`
- `displayBackgroundGraphic`: boolean
- `blockLayout`: `Cards left image right` or `Cards right image left`; default `Cards left image right`
- `displayAccordion`: boolean
- `accordionFirstItemOpen`: boolean
- `cards[].description`
- `cards[].link`

Limits:

- `featureItems` maximum 4 cards.

Valid source shape:

```markdown
:::component FeatureCardBlock
eyebrow: "Benefits"
heading: "Ways to prepare"
description: "Use this for a feature card block."
headingStyle: "H2"
blockLayout: "Cards left image right"
image:
  path: "../assets/careers/feature.svg"
  title: "Preparation feature image"
  alt: "A team planning next steps."
cards:
  - heading: "Review the role"
    description: "Check responsibilities, requirements, location, and working model."
  - heading: "Prepare examples"
    description: "Bring examples of collaboration, ownership, and results."
:::
```

### ListBlock

Maps to `listBlock` with nested `listItem` entries.

Required:

- `items`
- `items[].content`

Optional source fields:

- `heading`
- `style`: `Tick`, `Bulleted`, `Numbered`, or `Unordered`; default `Tick`

Valid source shape:

```markdown
:::component ListBlock
heading: "Before you apply"
style: "Tick"
items:
  - content: "Review the role requirements."
  - content: "Prepare relevant examples."
:::
```

### TableBlock

Maps to `tableBlock`.

Required:

- `callToAction.text` when `callToAction` is present

Optional source fields:

- `eyebrow`
- `heading`
- `headingStyle`: `H2` or `H3`; default `H2`
- `description`
- `table`
- `callToAction`
- `backgroundColour`: `White` or `Light Grey`; default `White`

Valid source shape:

```markdown
:::component TableBlock
eyebrow: "Details"
heading: "Application steps"
description: "Key steps and what to prepare."
backgroundColour: "White"
table: |
  | Step | What to prepare |
  | --- | --- |
  | Explore roles | Tailor your CV to the role. |
  | Interview | Prepare examples of impact. |
:::
```

### Testimonial And Testimonials

Both map to `testimonialsBlock` with nested `testimonialItem` entries.

Required:

- `testimonials`: minimum 1, maximum 10
- `testimonials[].tagline`
- `testimonials[].quote`

Optional source fields:

- `heading`
- `testimonials[].sourceName`
- `testimonials[].sourceJobTitle`

Valid source shape:

```markdown
:::component Testimonials
heading: "What our people say"
testimonials:
  - tagline: "A supportive place to grow"
    quote: "I have been able to build skills while working with teams around the world."
    sourceName: "Alex Smith"
    sourceJobTitle: "Customer Success Manager"
:::
```

`testimonialItem.companyLogo`, `testimonialItem.image`, and testimonial image accents are not source-mapped by current markdown.

### LogoWall

Maps to `logoBlock` with nested `logoItem` entries.

Required:

- `logos` for a useful logo wall
- `logos[].image.path` and `logos[].image.title` when a logo image is supplied
- `logos[].link.text` when a logo link is supplied

Optional source fields:

- `eyebrow`
- `heading`
- `description` -> `logoBlock.subtext`
- `logos[].image.alt`
- `logos[].image.description`
- `logos[].link`

Limits:

- `logoItems` maximum 20.

Valid source shape:

```markdown
:::component LogoWall
eyebrow: "Customers"
heading: "Trusted by leading organizations"
description: "A selection of organizations using Quadient."
logos:
  - image:
      path: "../assets/logos/example-1.svg"
      title: "Example company logo"
      alt: "Example company"
    link:
      text: "Visit example"
      url: "https://www.example.com"
      style: "Link Orange Right Arrow"
  - image:
      path: "../assets/logos/example-2.svg"
      title: "Second example company logo"
      alt: "Second example company"
:::
```

### FaqBlock

Maps to `accordionBlock` with nested `accordionItem` entries.

Required:

- `items`
- `items[].heading`
- `items[].body`

Optional source fields:

- `internalName`
- `heading` -> Contentful field `accordionBlock.Heading`
- `items[].internalName`

Defaults supplied by the map:

- `headingStyle`: `h2`
- `firstItemOpen`: `false`

Valid source shape:

```markdown
:::component FaqBlock
heading: "Frequently asked questions"
items:
  - heading: "How long does the hiring process take?"
    body: "Timing varies by role, team, and location."
  - heading: "What interview stages should I expect?"
    body: "Most journeys include application review, an intro conversation, and a hiring manager interview."
:::
```

`firstItemOpen` exists in Contentful, but current markdown does not override the configured default.

### RichText And Plain Markdown

Plain markdown outside component blocks maps to `richTextBlock.content`.

Use explicit `RichText` only when you need a component wrapper:

```markdown
:::component RichText
content: >
  This copy becomes a `richTextBlock`.

  Keep formatting simple.
:::
```

Required:

- `content`

## Current Non-Mapped Fields To Avoid In New Source

These fields either exist in Contentful or are accepted by parser compatibility code, but they are not part of the strict new-page source shape:

- `HeroStandard.heading`: no such mapped source field and no `heroBlock.heading` target field.
- Raw target markers such as `heroBlock`, `promoBlock`, `accordionBlock`, and `productCardBlock` for new generation. Use the mapped component markers in this guide.
- `PromoBlock.eyebrow`, `PromoBlock.style`, `PromoBlock.textColour`, and `PromoBlock.hideCornerAccent`.
- `ActionBlock.style`, `ActionBlock.textColour`, and `ActionBlock.hideCornerAccent`.
- `ProductCardBlock.headingStyle`.
- `stackedCarouselCardBlock.headingStyle`.
- `StatsBlock.style` for Facts mode.
- `FaqBlock.firstItemOpen` and `FaqBlock.headingStyle`.
- `NotificationBlock.callToAction`.
- `FiftyFiftyBlock.items[].image`, `mobileImage`, `video`, `bynderVideo`, and `listBlock`.
- `image.focus` or `image.focalPoint`.
- Frontmatter `heroDescriptionRichText`, `searchImportance`, `excludeFromSearch`, and `showInXmlSiteMap`.

Add or change `component-map.yml` before using any of those fields in generated source.

## Validation Workflow

For generated page files, run:

```bash
npm run parse -- --source <file-or-folder>
npm run dry-run -- --source <file-or-folder>
```

For mapping or code changes, also run:

```bash
npm run typecheck
npm run validate:config
```

`dry-run` is the best upload-shape check because it validates generated entries against the current Contentful UAT model.
