# Mapping Guide

## Current Model Snapshot

The local mapping has been checked against the refreshed UAT Contentful model snapshot:

- Snapshot file: [model-snapshot-uat.json](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.json)
- Snapshot generated: `2026-05-06T15:28:41.324Z`
- Environment: `uat`
- Content types discovered: `61`
- Config validation: `0` errors, `0` warnings

Regenerate the model-derived docs after every model refresh:

```bash
npm run pull:model -- --skip-cli
npm run docs:components
npm run docs:component-fields
npm run validate:config
```

## Canonical To Contentful Mapping

The importer maps each canonical document into:

- one parent `contentPage` entry
- one optional hero entry linked through `heroContentArea`
- zero or more body block entries linked through `bodyContentArea`
- nested child entries such as `ctaItem`, `cardItem`, `statisticItem`, `testimonialItem`, `accordionItem`, `logoItem`, and `imageWithFocalPoint`
- zero or more uploaded assets

This keeps the source document readable while still matching the existing Contentful model.

## Parent Entry Construction

The current parent mapping is:

```yaml
document:
  targetContentType: contentPage
  entryIdPattern: "cp--{{sourceId}}"
  fields:
    internalName:
      template: "[UAT Content] {{metadata.title}}"
    heading:
      source: metadata.title
      required: true
    slug:
      source: metadata.slug
      transform: slug
      required: true
    heroContentArea:
      strategy: componentReference
      component: HeroStandard
    excludeFromSearch:
      default: false
    bodyContentArea:
      strategy: blockReferences
      includeKinds:
        - richText
        - component
      excludeComponents:
        - HeroStandard
```

That means:

- the page `heading` comes from frontmatter `title`
- the page `slug` comes from frontmatter `slug`
- the first `HeroStandard` block is linked to `heroContentArea`
- `excludeFromSearch` defaults to `false`
- every other mapped component and plain rich text block is assembled into `bodyContentArea` in source order

## Importer Mapped Meaning

In [COMPONENT_LIST.md](/Users/jamesatkins/Documents/JS/contentful-importer/docs/COMPONENT_LIST.md), `Importer mapped` means the current YAML mapping can generate that Contentful content type as a direct block, parent page, or nested entry.

That column is about generated Contentful target types, not markdown source markers:

- `yes` means `config/component-map.yml` references that content type through `targetContentType`.
- `no` means the content type exists in the UAT model, but this importer config does not currently create it.
- A `yes` type may be nested only. For example, `ctaItem` and `imageWithFocalPoint` are generated inside other components rather than authored as standalone markdown markers.
- A `no` type may still be allowed in Contentful page regions. It just needs a new source marker and mapping before the importer can create it.

## Deterministic IDs

Examples:

```text
cp--source-doc-id
cp--source-doc-id--hb--001
cp--source-doc-id--hcta--001
cp--source-doc-id--fi--003
asset--source-doc-id--hm--001
```

This makes reruns idempotent and lets the importer update existing entries instead of creating duplicates.

## Nested Entry Strategy

Several components create nested entries before the top-level block entry is written.

Examples:

- `HeroStandard` -> `heroBlock` + nested `ctaItem[]` + nested `imageWithFocalPoint` + Asset
- `PromoBlock` -> `promoBlock`
- `ActionBlock` -> `promoBlock` + nested `ctaItem`
- `StatsBlock` -> `statisticsBlock` + nested `statisticItem[]`
- `ProductCardBlock` -> `productCardBlock` + nested `productCard[]` + nested `imageWithFocalPoint[]` + nested `ctaItem[]` + Assets
- `FeatureCardBlock` -> `featureCardBlock` + nested `featureCardItem[]` + nested `imageWithFocalPoint` + optional nested `ctaItem[]` + Asset
- `Testimonial` -> `testimonialsBlock` + nested `testimonialItem[]`
- `FiftyFiftyBlock` -> `fiftyFiftyBlock` + nested `fiftyFiftyItem[]` + nested `ctaItem[]`
- `LogoWall` -> `logoBlock` + nested `logoItem[]` + nested `imageWithFocalPoint[]` + Assets
- `stackedCarouselCardBlock` -> `stackedCarouselCardBlock` + nested `cardItem[]`
- `TableBlock` -> `tableBlock` with table rich text
- `ListBlock` -> `listBlock` + nested `listItem[]`
- `FaqBlock` -> `accordionBlock` + nested `accordionItem[]`

## Supported Source Marker To Model Mapping

| Source marker | Contentful content type | Notes |
| --- | --- | --- |
| `HeroStandard` | `heroBlock` | Linked to `heroContentArea` |
| `StatsBlock` | `statisticsBlock` | Uses nested `statisticItem[]` |
| `ProductCardBlock` | `productCardBlock` | Use for Product Family Card and USP listing copy |
| `FeatureCardBlock` | `featureCardBlock` | Use for Stacked Card Block copy |
| `Testimonial` | `testimonialsBlock` | Single/testimonial-source variant; uses nested `testimonialItem[]` |
| `Testimonials` | `testimonialsBlock` | Multi-testimonial alias; uses nested `testimonialItem[]` |
| `FiftyFiftyBlock` | `fiftyFiftyBlock` | Uses nested `fiftyFiftyItem[]` and item CTAs |
| `FiftyFiftyText` | `fiftyFiftyBlock` | Text-focused alias using the same Contentful block type |
| `stackedCarouselCardBlock` | `stackedCarouselCardBlock` | Uses nested `cardItem[]`; set `layout` to stacked or carousel |
| `LogoWall` | `logoBlock` | Uses nested `logoItem[]` and image wrappers |
| `TableBlock` | `tableBlock` | Use for tables; markdown table syntax is converted to table rich text |
| `ListBlock` | `listBlock` | Use for tick, bullet, numbered, or unordered lists |
| `FaqBlock` | `accordionBlock` | Uses nested `accordionItem[]` |
| `RichText` | `richTextBlock` | Structured rich text marker |
| `PromoBlock` | `promoBlock` | Simple editorial/promo support |
| `ActionBlock` | `promoBlock` | Promo-style block with nested CTA |
| `NotificationBlock` | `notificationBlock` | Notification/promo banner |
| plain paragraphs | `richTextBlock` | Rich text body content |

## Fresh UAT Blocks Not Yet Mapped

The refreshed UAT model includes some placeable body blocks that are not generated by the importer yet:

| Contentful content type | Current status | Why it is not mapped yet |
| --- | --- | --- |
| `aiSearchBlock` | Not mapped | Needs a source marker and required search placeholder/search page decisions. |
| `insightsResourcesBlock` | Not mapped | Native dynamic block uses taxonomy, parent listing page, or manual `resourcePage` links. Use `ProductCardBlock` or `stackedCarouselCardBlock` for manually authored card sections. |
| `formContainer` | Not mapped | Requires nested `form` and `formField` handling. Use `ActionBlock` for a simple CTA panel. |
| `tabSectionBlock`, `videoBlock`, `embedBlock` | Not mapped | These need explicit source syntax and field mappings before upload. |

## Ordered References

`bodyContentArea` is assembled in the same order as the source draft. This matters because Contentful page rendering depends on array order for block layout.

The hero is excluded from the body array so it can be attached to `heroContentArea` separately.

## Asset Mapping

Hero and logo images are handled through nested `imageWithFocalPoint` entries:

```yaml
image:
  path: ../assets/life-at-quadient/hero-collage.svg
  alt: Placeholder hero image
  title: Life at Quadient hero collage
```

The importer then:

1. creates or updates the Asset
2. creates or updates the `imageWithFocalPoint` entry
3. links that wrapper entry to the consuming block

## FAQ Mapping Example

Source:

```text
:::component FaqBlock
heading: Frequently asked questions
items:
  - heading: What is it like to work at Quadient
    body: Working at Quadient should feel purposeful and collaborative.
:::
```

Mapping result:

- top-level block -> `accordionBlock`
- nested items -> `accordionItem`
- `accordionItem.itemHeading <- item.heading`
- `accordionItem.itemContent <- item.body`, transformed into Contentful rich text

## Working Example

Use [life-at-quadient.md](/Users/jamesatkins/Documents/JS/contentful-importer/source/docs/migrationV7/life-at-quadient.md) as the current full example of a multi-block `contentPage` draft that exercises the expanded mapping.
