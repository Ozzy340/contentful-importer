# Design To Contentful Component Mapping

This is a working reference from the supplied comparison table. It maps component names used in design or copy decks to the Contentful content model names and notes whether the current importer can generate the type.

Source file: `/Users/jamesatkins/Downloads/content model mapping - Sheet1.csv`

| Design name | Contentful model name | Importer status | Notes |
| --- | --- | --- | --- |
| Navigation | Mega Menu | Not mapped | Global navigation/site settings pattern. |
| Utility Navigation | Utility Header | Not mapped | Global navigation/site settings pattern. |
| Footer | Footer | Not mapped | Global footer/site settings pattern. |
| Pop-Up | TBC | Not mapped | Awaiting model decision. |
| Country Selector Pop-Up | Language Selector | Not mapped | Header/footer platform behavior. |
| Hero Impact | `heroBlock` | Covered via `HeroStandard` | Use `HeroStandard` unless an Impact-specific alias is needed. |
| Hero Tagline | `heroBlock` | Covered via `HeroStandard` | Use `HeroStandard` unless a Tagline-specific alias is needed. |
| Hero Standard | `heroBlock` | Mapped | `HeroStandard`. |
| 50-50 Block | `fiftyFiftyBlock` / `fiftyFiftyItem` | Mapped | `FiftyFiftyBlock`. The CSV says `fiftyfiftyContainer`, which is the field on `fiftyFiftyBlock`, not the content type. |
| 50-50 Text | `fiftyFiftyBlock` / `fiftyFiftyItem` | Mapped | `FiftyFiftyText`. |
| Stacked Card Block | `featureCardBlock` | Mapped | Use `FeatureCardBlock`. |
| Timeline Block | `stackedCarouselCardBlock` | Mapped | Use `stackedCarouselCardBlock` with `layout: "Carousel"`. |
| CTA Form | `formContainer` | Not mapped | Requires nested `form` and `formField` handling. |
| Logo Wall | `logoBlock` | Mapped | `LogoWall`. |
| Testimonial | `testimonialsBlock` | Mapped | `Testimonial` / `Testimonials`. |
| Comparison Table | `tableBlock` | Mapped | Use `TableBlock`. |
| FAQs List | `accordionBlock` | Mapped | `FaqBlock`. CSV typo says `accordianBlock`; Contentful type is `accordionBlock`. |
| Full Video Block | `videoBlock` | Not mapped | Requires nested `videoItem`. |
| Editorial Content Block | Customer Stories Carousel | Not mapped | Still in development per supplied mapping. |
| Big Idea Panel | `promoBlock` | Mapped | Use `PromoBlock` or `ActionBlock` depending on copy shape. |
| Action Block | `promoBlock` | Mapped | `ActionBlock`. |
| Stats Block | `statisticsBlock` | Mapped | `StatsBlock`. |
| Mission Framing | `fiftyFiftyBlock` / `fiftyFiftyItem` or `promoBlock` | Mapped | Use `FiftyFiftyBlock`/`FiftyFiftyText` for split-layout copy, or `PromoBlock`/`ActionBlock` for panel copy. |
| AI Block | AI Search Block | Not mapped | Still in development per supplied mapping. |
| Standard Card | `stackedCarouselCardBlock` | Mapped | Use `stackedCarouselCardBlock`. |
| Promo Banner | `notificationBlock` | Mapped | Use `NotificationBlock`. |
| Solution Card | `stackedCarouselCardBlock` | Mapped | Use `stackedCarouselCardBlock`. |
| Solution Card Carousel | `stackedCarouselCardBlock` | Mapped | Use `stackedCarouselCardBlock` with `layout: "Carousel"`. |
| Solution Card Stacked | `stackedCarouselCardBlock` | Mapped | Use `stackedCarouselCardBlock` with `layout: "Stacked 2 per row"` or `layout: "Stacked 3 per row"`. |
| Mega CTA | `promoBlock` | Mapped | Use `ActionBlock` for one CTA. |
| Product Family Card | `productCardBlock` / `productCard` | Mapped | Use `ProductCardBlock`. |
| Product Card Listing | `productCardBlock` | Mapped | Use `ProductCardBlock`. |
| Insights Card | `productCardBlock` / `productCard` | Mapped | Use `ProductCardBlock` when cards need images; use `stackedCarouselCardBlock` for text/link cards. |
| Insights & Resources | `productCardBlock` or `stackedCarouselCardBlock` | Mapped | Use `ProductCardBlock` when cards need images; use `stackedCarouselCardBlock` for manual text/link cards. |
| Solutions Toggle | `tabSectionBlock` | Not mapped | Good Phase 2 candidate. |
| At a Glance | `statisticsBlock` | Mapped | `StatsBlock`. |
| Announcement Banner | Global Notification | Not mapped | Site settings/global notification pattern. |
| Blog Header | `resourceHero` | Not mapped | Resource-page-specific hero. |
| Siderail Navigation | Sidebar Navigation | Not mapped | Still in development per supplied mapping. |
| Summary Card | `resourceSummary` | Not a content type | `resourceSummary` is a field on `resourcePage`, not a standalone content type. |
| Author Details | `profileDataBlock` | Not mapped | Resource-page author pattern. |
| Quote/Analyst | Quote Panel Block | Excluded | Excluded from MVP per supplied mapping. |
| USP listing | `productCardBlock` | Mapped | Use `ProductCardBlock`; use `ListBlock` only when the copy is an actual tick/bullet list. |
