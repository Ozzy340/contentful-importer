# Content Page Draft Template

Copy this template when preparing a new `contentPage` draft for import. The component markers are importer aliases, but every alias below maps to a real Contentful content type listed in the field reference.

```markdown
---
sourceId: replace-with-stable-source-id
title: Replace With Internal Page Name
heading: Replace With Page Heading
slug: replace-with-page-slug
locale: en-US
contentType: contentPage
finalizedUrl: https://www.quadient.com/en-us/replace-with-final-url
metaTitle: Replace with meta title
metaDescription: Replace with meta description
taxonomy:
  - topic:replace-me
---

:::component HeroStandard
eyebrow: Replace with hero eyebrow
description: Replace with hero description
lowerSubtext: Optional hero supporting copy
image:
  path: ../assets/replace-me/hero.svg
  alt: Replace with hero alt text
  title: Replace with hero image title
callsToAction:
  - text: Primary CTA label
    url: https://example.com/primary
    style: Primary Orange Solid
:::

:::component PromoBlock
eyebrow: Replace with eyebrow
heading: Replace with section heading
description: Replace with promo copy
:::

:::component StatsBlock
eyebrow: Replace with eyebrow
heading: Replace with heading
statistics:
  - text: 91.8%
    supportingText: Replace with supporting text
  - text: 95%
    supportingText: Replace with supporting text
:::

:::component ProductCardBlock
eyebrow: Replace with eyebrow
heading: Replace with product card block heading
description: Replace with description
cards:
  - heading: Replace with card heading
    description: Replace with card description
    image:
      path: ../assets/replace-me/card-1.svg
      alt: Replace with card image alt text
      title: Replace with card image title
    link:
      text: Replace with link label
      url: https://example.com/card-1
      style: Link Orange Right Arrow
  - heading: Replace with card heading
    description: Replace with card description
    image:
      path: ../assets/replace-me/card-2.svg
      alt: Replace with card image alt text
      title: Replace with card image title
    link:
      text: Replace with link label
      url: https://example.com/card-2
      style: Link Orange Right Arrow
  - heading: Replace with card heading
    description: Replace with card description
    image:
      path: ../assets/replace-me/card-3.svg
      alt: Replace with card image alt text
      title: Replace with card image title
    link:
      text: Replace with link label
      url: https://example.com/card-3
      style: Link Orange Right Arrow
  - heading: Replace with card heading
    description: Replace with card description
    image:
      path: ../assets/replace-me/card-4.svg
      alt: Replace with card image alt text
      title: Replace with card image title
    link:
      text: Replace with link label
      url: https://example.com/card-4
      style: Link Orange Right Arrow
:::

:::component FeatureCardBlock
eyebrow: Replace with eyebrow
heading: Replace with feature card block heading
description: Replace with description
blockLayout: Cards left image right
image:
  path: ../assets/replace-me/feature.svg
  alt: Replace with feature image alt text
  title: Replace with feature image title
cards:
  - heading: Replace with feature heading
    description: Replace with feature description
  - heading: Replace with feature heading
    description: Replace with feature description
:::

:::component stackedCarouselCardBlock
eyebrow: Replace with eyebrow
heading: Replace with heading
description: Replace with description
layout: Carousel
cards:
  - heading: Replace with card heading
    description: Replace with card description
  - heading: Replace with card heading
    description: Replace with card description
:::

:::component TableBlock
eyebrow: Replace with eyebrow
heading: Replace with table heading
description: Replace with table description
table: |
  | Column one | Column two |
  | --- | --- |
  | Row one | Row one value |
  | Row two | Row two value |
:::

:::component ListBlock
heading: Replace with list heading
style: Tick
items:
  - content: Replace with list item
  - content: Replace with list item
:::

:::component Testimonial
heading: Replace with heading
testimonials:
  - tagline: Replace with tagline
    quote: Replace with quote
    sourceName: Replace with source name
    sourceJobTitle: Replace with source role
:::

:::component LogoWall
eyebrow: Replace with eyebrow
heading: Replace with heading
description: Replace with description
logos:
  - image:
      path: ../assets/replace-me/logo-1.svg
      alt: Replace with logo alt text
      title: Replace with logo title
  - image:
      path: ../assets/replace-me/logo-2.svg
      alt: Replace with logo alt text
      title: Replace with logo title
:::

:::component FaqBlock
heading: Frequently asked questions
items:
  - heading: Replace with FAQ question
    body: Replace with FAQ answer
  - heading: Replace with FAQ question
    body: Replace with FAQ answer
:::

:::component ActionBlock
heading: Replace with CTA section heading
description: Replace with CTA section description
callToAction:
  text: Replace with CTA label
  url: https://example.com/cta
  style: Primary Orange Solid
:::
```

## Notes For Authors

- `title` is the internal name source; `heading` is the page heading.
- Use only mapped taxonomy tokens.
- Use only tags that already exist in Contentful.
- Keep all image paths valid relative to the draft file.
- Use one `HeroStandard` block at the top of the page.
- Use `TableBlock` for tables, not a rich text paragraph.
- Use `ListBlock` with `style: Tick` when tick-list bullets are required.
