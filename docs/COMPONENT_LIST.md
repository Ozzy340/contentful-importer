# Component List

This document is generated from the local Contentful UAT discovery snapshot and lists every content type currently available in the exported model.

Source of truth:

- [model-snapshot-uat.json](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.json)
- [model-snapshot-uat.md](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.md)

## Summary

- Snapshot generated: 2026-05-06T15:28:41.324Z
- Space: `yymku90gll7g`
- Environment: `uat`
- Environment name: `uat`
- Locales: `de-DE`, `en`, `en-CA`, `en-GB`, `en-US`, `es`, `fr-BE`, `fr-CA`, `fr-CH`, `fr-FR`, `it-IT`, `ja-JP`, `nl-BE`, `nl-NL`
- Total content types in export: `61`
- Current importer page target: `contentPage`
- Current mapped target content types: `accordionBlock`, `accordionItem`, `cardItem`, `contentPage`, `ctaItem`, `featureCardBlock`, `featureCardItem`, `fiftyFiftyBlock`, `fiftyFiftyItem`, `heroBlock`, `imageWithFocalPoint`, `listBlock`, `listItem`, `logoBlock`, `logoItem`, `notificationBlock`, `productCard`, `productCardBlock`, `promoBlock`, `richTextBlock`, `stackedCarouselCardBlock`, `statisticItem`, `statisticsBlock`, `tableBlock`, `testimonialItem`, `testimonialsBlock`

## Category Index

### Page Templates

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `contentPage` | Content Page | 23 | `internalName`, `slug`, `heading`, `excludeFromSearch` | `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | yes |
| `homePage` | Home Page | 23 | `internalName`, `slug`, `heading`, `heroContentArea`, `excludeFromSearch` | `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.homePageLink`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | no |
| `listingPage` | Listing Page | 34 | `internalName`, `slug`, `heading`, `searchPlaceholder`, `noResultsText`, `layoutLabel`, `pageSize`, `excludeFromSearch` | `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.parentListingPage`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | no |
| `notFoundPage` | 404 Page | 11 | `internalName`, `slug`, `heading` | `contentPage.canonicalUrl`, `homePage.canonicalUrl`, `listingPage.canonicalUrl`, `notFoundPage.canonicalUrl`, `resourcePage.canonicalUrl`, `searchPage.canonicalUrl` | no |
| `resourcePage` | Resource Page | 40 | `internalName`, `slug`, `heading`, `pageLayout`, `excludeFromSearch` | `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.manualPages`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | no |
| `searchPage` | Search Page | 28 | `internalName`, `slug`, `heading`, `searchPlaceholder`, `noResultsText`, `pageSize`, `excludeFromSearch` | `aiSearchBlock.callToAction`, `aiSearchBlock.searchResultsPage`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `siteSettings.searchPage`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | no |

### Placeable Body Blocks

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `accordionBlock` | Accordion Block | 5 | `internalName` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `aiSearchBlock` | AI Search Block | 10 | `internalName`, `heading`, `searchFieldPlaceholder` | `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `embedBlock` | Embed Block | 11 | `internalName`, `platform` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `featureCardBlock` | Feature Card Block | 13 | `internalName`, `image`, `featureItems`, `blockLayout` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `fiftyFiftyBlock` | 50/50 Block | 3 | `internalName`, `fiftyFiftyContainer`, `firstItemPosition` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `formContainer` | Form Container | 10 | `internalName`, `heading`, `headingStyle`, `subHeading`, `disclaimerText`, `formSuccessMessage`, `form`, `formStyle` | `contentPage.bodyContentArea`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `gatedContentBlock` | Gated Content Block | 5 | `internalName`, `ungatedContent` | `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `heroBlock` | Hero Block | 13 | `internalName`, `heroStyle`, `media` | `contentPage.heroContentArea`, `homePage.heroContentArea`, `listingPage.heroContentArea`, `resourcePage.resourceHero` | yes |
| `insightsResourcesBlock` | Insights & Resources Block | 9 | `internalName`, `heading`, `headingStyle`, `contentType` | `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `listBlock` | List Block | 4 | `internalName`, `style`, `listContent` | `contentPage.bodyContentArea`, `fiftyFiftyItem.listBlock`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `logoBlock` | Logo Block | 8 | `internalName`, `logoItems` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `notificationBlock` | Notification Block | 4 | `internalName`, `notificationHeading` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `officeListingBlock` | Office Listing Block | 4 | `internalName` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |
| `productCardBlock` | Product Card Block | 7 | `internalName`, `heading`, `headingStyle`, `productCards` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `promoBlock` | Promo Block | 11 | `internalName`, `heading`, `headingStyle`, `style`, `textColour` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.promoBlock`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `richTextBlock` | Rich Text Block | 2 | `internalName`, `content` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.resourceContent`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `stackedCarouselCardBlock` | Stacked/Carousel Card Block | 9 | `internalName`, `cards` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `statisticsBlock` | Statistics Block | 7 | `internalName`, `style` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `tableBlock` | Table Block | 8 | `internalName` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `tabSectionBlock` | Tab Section Block | 5 | `internalName` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea` | no |
| `testimonialsBlock` | Testimonials Block | 4 | `internalName`, `headingStyle`, `testimonials` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | yes |
| `videoBlock` | Video Block | 4 | `internalName`, `video` | `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content` | no |

### Nested And Reusable Items

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `accordionItem` | Accordion Item | 3 | `internalName`, `itemHeading`, `itemContent` | `accordionBlock.accordionItems` | yes |
| `cardItem` | Card Item | 5 | `internalName`, `heading` | `stackedCarouselCardBlock.cards` | yes |
| `ctaItem` | CTA Item | 9 | `internalName`, `linkText`, `customiseStyle` | `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `logoItem.logoLink`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `productCardBlock.callToAction`, `promoBlock.callToAction`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.footerUtilityLinks`, `siteSettings.headerCta`, `siteSettings.notificationLink`, `siteSettings.utilityHeaderLinks`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction` | yes |
| `factItem` | Fact Item | 3 | `internalName`, `heading`, `fact` | `statisticsBlock.facts` | no |
| `featureCardItem` | Feature Card Item | 4 | `internalName`, `heading` | `featureCardBlock.featureItems` | yes |
| `fiftyFiftyItem` | 50/50 Item | 13 | `internalName`, `heading`, `contentTypeDisplay`, `theme` | `fiftyFiftyBlock.fiftyFiftyContainer` | yes |
| `form` | Form | 9 | `internalName`, `formType`, `formId`, `fields`, `ctaText`, `utmHtmlName`, `pageUrlHtmlName`, `googleAnalyticsHtmlName` | `formContainer.form` | no |
| `formField` | Form Field | 14 | `internalName`, `fieldType`, `htmlName` | `form.fields` | no |
| `languageOption` | Language Option | 7 | `internalName`, `displayName` | `siteSettings.languageOptions` | no |
| `listItem` | List Item | 2 | `internalName`, `itemContent` | `listBlock.listContent` | yes |
| `logoItem` | Logo Item | 3 | `internalName` | `logoBlock.logoItems` | yes |
| `menuContainer` | Menu Container | 7 | `internalName`, `headerLabel`, `style` | `siteSettings.megaMenu` | no |
| `notFoundGroup` | 404 Group | 5 | none | `siteSettings.notFoundGroup` | no |
| `officeDataBlock` | Office Data Block | 6 | `internalName`, `officeName` | `officeContainerBlock.offices` | no |
| `productCard` | Product Card | 5 | `internalName`, `heading`, `image`, `link` | `productCardBlock.productCards` | yes |
| `profileDataBlock` | Profile Data Block | 6 | `internalName`, `fullName`, `jobTitle` | `resourcePage.author` | no |
| `scoringProfile` | Scoring Profile | 3 | `internalName` | `siteSettings.scoringProfile` | no |
| `statisticItem` | Statistic Item | 6 | `internalName`, `supportingTextColour`, `statisticStyle` | `statisticsBlock.statistics` | yes |
| `submenuCardItem` | Submenu Card Item | 10 | `internalName`, `heading` | `menuContainer.submenuItems` | no |
| `submenuLinksItem` | Submenu Links Item | 3 | `internalName`, `heading` | `menuContainer.submenuItems` | no |
| `tabItem` | Tab Item | 4 | `internalName`, `tabHeading`, `tabDefaultIcon` | `tabSectionBlock.tabs` | no |
| `testimonialItem` | Testimonial Item | 8 | `internalName`, `tagline`, `quote` | `testimonialsBlock.testimonials` | yes |
| `videoItem` | Video Item | 6 | `internalName`, `videoType` | `videoBlock.video` | no |

### Media And Hero Support

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `imageWithFocalPoint` | Image with Focal Point | 5 | `title`, `image`, `focus` | `cardItem.icon`, `contentPage.ogImage`, `contentPage.teaserImage`, `featureCardBlock.image`, `fiftyFiftyItem.image`, `fiftyFiftyItem.mobileImage`, `formContainer.image`, `heroBlock.media`, `heroBlock.mobileMedia`, `homePage.ogImage`, `homePage.teaserImage`, `listingPage.ogImage`, `listingPage.teaserImage`, `logoItem.colouredHoverLogo`, `officeDataBlock.image`, `productCard.image`, `profileDataBlock.image`, `promoBlock.backgroundImage`, `promoBlock.icon`, `resourceHero.backgroundImage`, `resourceHero.icon`, `resourcePage.ogImage`, `resourcePage.resourceContent`, `resourcePage.teaserImage`, `searchPage.ogImage`, `searchPage.teaserImage`, `siteSettings.footerLogo`, `siteSettings.notificationIcon`, `siteSettings.siteLogo`, `statisticItem.icon`, `submenuCardItem.featuredCardImage`, `submenuCardItem.image`, `tabItem.tabDefaultIcon`, `testimonialItem.companyLogo`, `testimonialItem.image` | yes |
| `mediaItem` | Media Item | 4 | `internalName`, `asset` | none | no |
| `resourceHero` | Resource Hero | 3 | `internalName`, `backgroundImage` | `resourcePage.resourceHero` | no |

### Global And System Content

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `footerItem` | Footer Item | 3 | `internalName`, `heading`, `links` | `siteSettings.footerColumns` | no |
| `resourceItem` | Resource Item | 8 | `internalName` | `resourceSet.references` | no |
| `resourceSet` | Resource Set | 2 | `internalName` | `siteSettings.references` | no |
| `siteSettings` | Site Settings | 30 | `internalName`, `siteName`, `siteLogo`, `homePageLink`, `utilityHeaderLinks`, `searchPage`, `searchScreenReaderLabel`, `searchPlaceholder`, `footerLogo`, `copyrightText`, `searchButtonScreenReaderToggleOpen`, `searchButtonScreenReaderToggleClose`, `scoringProfile`, `references` | none | no |
| `socialItem` | Social Item | 3 | `internalName`, `platform`, `platformURL` | `profileDataBlock.socialPlatforms`, `siteSettings.socialLinks` | no |

### Other Content Types

| ID | Name | Fields | Required fields | Referenced by | Importer mapped |
| --- | --- | ---: | --- | --- | --- |
| `officeContainerBlock` | Office Container Block | 3 | `internalName`, `heading` | `officeListingBlock.officeContainers` | no |
| `taxonomyBlock` | Taxonomy Block | 1 | `internalName` | none | no |

## Importer Mapping Coverage

The current importer mapping references these target content types in `config/component-map.yml`:

- `accordionBlock` (Accordion Block)
- `accordionItem` (Accordion Item)
- `cardItem` (Card Item)
- `contentPage` (Content Page)
- `ctaItem` (CTA Item)
- `featureCardBlock` (Feature Card Block)
- `featureCardItem` (Feature Card Item)
- `fiftyFiftyBlock` (50/50 Block)
- `fiftyFiftyItem` (50/50 Item)
- `heroBlock` (Hero Block)
- `imageWithFocalPoint` (Image with Focal Point)
- `listBlock` (List Block)
- `listItem` (List Item)
- `logoBlock` (Logo Block)
- `logoItem` (Logo Item)
- `notificationBlock` (Notification Block)
- `productCard` (Product Card)
- `productCardBlock` (Product Card Block)
- `promoBlock` (Promo Block)
- `richTextBlock` (Rich Text Block)
- `stackedCarouselCardBlock` (Stacked/Carousel Card Block)
- `statisticItem` (Statistic Item)
- `statisticsBlock` (Statistics Block)
- `tableBlock` (Table Block)
- `testimonialItem` (Testimonial Item)
- `testimonialsBlock` (Testimonials Block)

## Full Content Type Details

### accordionBlock

- Name: Accordion Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `Heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `h2`, `h3` |
| `firstItemOpen` | First Item Open | Boolean | no | no | none |
| `accordionItems` | Accordion Items | Array<Link<Entry>> | no | yes | Allows: `accordionItem` |

### accordionItem

- Name: Accordion Item
- Display field: `internalName`
- Referenced by: `accordionBlock.accordionItems`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `itemHeading` | Item Heading | Symbol | yes | yes | none |
| `itemContent` | Item Content | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `heading-2`, `heading-3`, `heading-4`, `heading-5`, `heading-6`, `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`, `table`, `blockquote`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","imageWithFocalPoint","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |

### aiSearchBlock

- Name: AI Search Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `subtitle` | Subtitle | Symbol | no | yes | none |
| `description` | Description | Symbol | no | yes | none |
| `searchFieldPlaceholder` | Search Field Placeholder | Symbol | yes | yes | none |
| `searchExamplesLabel` | Search Examples Label | Symbol | no | yes | none |
| `searchExamples` | Search Examples | Array<Symbol> | no | yes | none |
| `searchResultsPage` | Search Results Page | Link<Entry> | no | yes | Allows: `searchPage` |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### cardItem

- Name: Card Item
- Display field: `internalName`
- Referenced by: `stackedCarouselCardBlock.cards`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `icon` | Icon | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `description` | Description | Symbol | no | yes | none |
| `link` | Link | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### contentPage

- Name: Content Page
- Display field: `internalName`
- Description: A flexible page template that accepts all available content blocks, allowing editors to build custom layouts by combining multiple components.
- Allowed taxonomy schemes: `roles`, `topics`, `industries`, `productFamilies`
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `parent` | Page Parent | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | Symbol | no | yes | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `heroDescriptionRichText` | Hero Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | Link<Entry> | no | yes | Allows: `heroBlock` |
| `bodyContentArea` | Body Content Area | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchImportance` | Search Importance | Symbol | no | no | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | Boolean | yes | yes | none |
| `teaserTitle` | Teaser Title | Symbol | no | no | none |
| `teaserDescription` | Teaser Description | Symbol | no | no | none |
| `teaserImage` | Teaser Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | Symbol | no | yes | none |
| `ogDescription` | OG Description | Text | no | yes | none |
| `ogImage` | OG Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | Boolean | no | yes | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | Boolean | no | yes | none |

### ctaItem

- Name: CTA Item
- Display field: `internalName`
- Description: Reusable link component for calls-to-action with configurable styling, supporting both internal pages and external URLs.
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `logoItem.logoLink`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `productCardBlock.callToAction`, `promoBlock.callToAction`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.footerUtilityLinks`, `siteSettings.headerCta`, `siteSettings.notificationLink`, `siteSettings.utilityHeaderLinks`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `link` | Link | Link<Entry> | no | yes | Allows: `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `linkText` | Link Text | Symbol | yes | yes | none |
| `customiseStyle` | Customise Style | Boolean | yes | yes | none |
| `style` | Style | Symbol | no | yes | Allowed values: `Primary Gray Solid`, `Primary Gray Outline`, `Primary Orange Solid`, `Secondary White Solid`, `Link Orange`, `Link Orange Left Arrow`, `Link Orange Right Arrow` |
| `openUrlInNewTab` | Open URL in new tab | Boolean | no | no | none |
| `useExternalLink` | Use External Link | Boolean | no | no | none |
| `externalUrl` | External URL | Symbol | no | yes | Regexp: `^((ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?\|mailto:\w[\w.-]*@([\w-]+\.)+[\w-]+\|tel:\+[0-9\-]*)$` |
| `fallbackUrl` | Fallback Url | Symbol | no | yes | none |

### embedBlock

- Name: Embed Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `platform` | Platform | Symbol | yes | no | Allowed values: `Outgrow`, `Storylane`, `Gartner Peer Insights`, `Formstack`, `Survey Monkey` |
| `embedId` | Embed ID | Symbol | no | no | none |
| `embedUrl` | Embed URL | Symbol | no | no | none |
| `aspectRatio` | Aspect Ratio | Symbol | no | no | none |
| `widgetId` | Widget ID | Symbol | no | no | none |
| `widgetSize` | Widget Size | Symbol | no | no | Allowed values: `Large`, `Small` |
| `widgetTheme` | Widget Theme | Symbol | no | no | Allowed values: `Light`, `Dark` |
| `showReviewButton` | Show Review Button | Boolean | no | no | none |
| `formScriptUrl` | Form Script URL | Symbol | no | no | none |
| `scriptUrl` | Script URL | Symbol | no | no | none |

### factItem

- Name: Fact Item
- Display field: `internalName`
- Referenced by: `statisticsBlock.facts`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `fact` | Fact | Symbol | yes | yes | none |

### featureCardBlock

- Name: Feature Card Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `description` | Description | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `upperCallToAction` | Upper Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `image` | Image | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `lowerCallToAction` | Lower Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `displayBackgroundGraphic` | Display Background Graphic | Boolean | no | yes | none |
| `featureItems` | Feature Items | Array<Link<Entry>> | yes | yes | Allows: `featureCardItem`<br>Size: {"max":4} |
| `blockLayout` | Block Layout | Symbol | yes | yes | Allowed values: `Cards left image right`, `Cards right image left` |
| `displayAccordion` | Display Cards in an Accordion | Boolean | no | yes | none |
| `accordionFirstItemOpen` | Accordion First Item Open | Boolean | no | yes | none |

### featureCardItem

- Name: Feature Card Item
- Display field: `internalName`
- Referenced by: `featureCardBlock.featureItems`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `description` | Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `link` | Link | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### fiftyFiftyBlock

- Name: 50/50 Block
- Display field: `internalName`
- Description: Container block that holds one or more 50/50 Items and controls the starting layout direction, with subsequent items automatically alternating.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `fiftyFiftyContainer` | 50/50 Container | Array<Link<Entry>> | yes | no | Allows: `fiftyFiftyItem` |
| `firstItemPosition` | First Item Position | Symbol | yes | no | Allowed values: `Content Left, Text Right`, `Content Right, Text Left` |

### fiftyFiftyItem

- Name: 50/50 Item
- Display field: `internalName`
- Description: An individual split-layout item containing a media area and a text area
- Referenced by: `fiftyFiftyBlock.fiftyFiftyContainer`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `description` | Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `callToActions` | Call To Actions | Array<Link<Entry>> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: {"max":2} |
| `contentTypeDisplay` | Content Type Display | Symbol | yes | yes | Allowed values: `Image`, `Tick List`, `Video` |
| `image` | Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `mobileImage` | Mobile Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `video` | Video | Link<Asset> | no | yes | `{"linkMimetypeGroup":["video"],"message":"Only videos are allowed"}` |
| `bynderVideo` | Bynder Video | Object | no | no | none |
| `listBlock` | List Block | Link<Entry> | no | yes | Allows: `listBlock` |
| `theme` | Theme | Symbol | yes | no | Allowed values: `Light Grey`, `Graphite`, `White` |

### footerItem

- Name: Footer Item
- Display field: `internalName`
- Referenced by: `siteSettings.footerColumns`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `links` | Links | Array<Link<Entry>> | yes | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### form

- Name: Form
- Display field: `internalName`
- Description: A reusable Eloqua form definition. Composed of Form Field entries and configured for a specific form type.
- Referenced by: `formContainer.form`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `formType` | Form Type | Symbol | yes | no | Allowed values: `Contact`, `Hand Raiser`, `Webinar Registration`, `Event Registration`, `Gated Content` |
| `formId` | Eloqua Form ID | Integer | yes | yes | none |
| `fields` | Fields | Array<Link<Entry>> | yes | no | Allows: `formField` |
| `ctaText` | CTA Text | Symbol | yes | yes | none |
| `utmHtmlName` | UTM Html Name | Symbol | yes | yes | none |
| `pageUrlHtmlName` | Page URL Html Name | Symbol | yes | yes | none |
| `googleAnalyticsHtmlName` | Google Analytics Html Name | Symbol | yes | yes | none |
| `localeHtmlName` | Locale Html Name | Symbol | no | yes | none |

### formContainer

- Name: Form Container
- Display field: `internalName`
- Description: A page-level block that embeds a reusable Form within a page content area.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | yes | yes | Allowed values: `H2`, `H3` |
| `subHeading` | Sub Heading | Symbol | yes | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `disclaimerText` | Disclaimer Text | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `formSuccessMessage` | Form Success Message | Symbol | yes | yes | none |
| `form` | Form | Link<Entry> | yes | no | Allows: `form` |
| `formStyle` | Form Style | Symbol | yes | no | Allowed values: `Orange Inline Layout`, `Two-Column Grey Form` |
| `image` | Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |

### formField

- Name: Form Field
- Display field: `internalName`
- Description: A reusable form field definition for use within Eloqua-integrated forms.
- Referenced by: `form.fields`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `fieldType` | Field Type | Symbol | yes | no | Allowed values: `Text`, `Long Text`, `Email`, `Dropdown`, `Checkbox`, `Hidden` |
| `htmlName` | HTML Name | Symbol | yes | no | none |
| `placeholder` | Label/Placeholder | Symbol | no | yes | none |
| `options` | Options | Array<Symbol> | no | yes | none |
| `isRequired` | Is Required | Boolean | no | no | none |
| `isRequiredValidationMessage` | Is Required Validation Message | Symbol | no | yes | none |
| `isEmailAddress` | Is Email Address | Boolean | no | no | none |
| `isEmailAddressValidationMessage` | Is Email Address Validation Message | Symbol | no | yes | none |
| `regularExpressionValidation` | Regular Expression Validation | Symbol | no | yes | none |
| `regularExpressionValidationMessage` | Regular Expression Validation Message | Symbol | no | yes | none |
| `hiddenFieldFromTags` | Hidden Field From Tags | Boolean | no | no | none |
| `hiddenFieldTagGroup` | Hidden Field Tag Group | Symbol | no | no | none |
| `hiddenFieldValue` | Hidden Field Value | Symbol | no | yes | none |

### gatedContentBlock

- Name: Gated Content Block
- Display field: `internalName`
- Description: Gates content behind a form submission. Visitors see ungated content and the form on page load; gated content is revealed after a successful submission.
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `ungatedContent` | Ungated Content | Array<Link<Entry>> | yes | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `tabSectionBlock`, `formContainer` |
| `gatedContent` | Gated Content | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `tabSectionBlock` |
| `hideFirstGatedContentBlockAfterFirstView` | Hide First Gated Content Block After First View | Boolean | no | yes | none |
| `redirectSubmissionPage` | Redirect Submission Page | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### heroBlock

- Name: Hero Block
- Display field: `internalName`
- Description: A prominent full-width banner block featuring H1, images, and call-to-actions to capture attention at the top of pages.
- Referenced by: `contentPage.heroContentArea`, `homePage.heroContentArea`, `listingPage.heroContentArea`, `resourcePage.resourceHero`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heroStyle` | Hero Style | Symbol | yes | yes | Allowed values: `Standard`, `Impact` |
| `headingFontStyle` | Heading Font Style | Symbol | no | yes | Allowed values: `Standout`, `Regular` |
| `subtitle` | Subtitle | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `callToActions` | Call To Actions | Array<Link<Entry>> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: {"max":2} |
| `lowerSubtext` | Lower Subtext | Symbol | no | yes | none |
| `media` | Media | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `mobileMedia` | Mobile Media | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `desktopImageSize` | Desktop Image Size | Symbol | no | yes | Allowed values: `Standard`, `Large` |
| `hideImageAccent` | Hide Image Accent | Boolean | no | yes | none |
| `theme` | Theme | Symbol | no | yes | Allowed values: `Grey`, `White` |
| `applyGradient` | Apply Gradient | Boolean | no | no | none |

### homePage

- Name: Home Page
- Display field: `internalName`
- Description: The main landing page template featuring hero content and customisable content blocks to introduce the brand and guide visitors to key areas of the site.
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.homePageLink`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `parent` | Page Parent | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | Symbol | no | yes | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `heroDescriptionRichText` | Hero Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | Link<Entry> | yes | yes | Allows: `heroBlock` |
| `bodyContentArea` | Body Content Area | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `excludeFromSearch` | Exclude from search | Boolean | yes | yes | none |
| `teaserTitle` | Teaser Title | Symbol | no | no | none |
| `teaserDescription` | Teaser Description | Symbol | no | no | none |
| `teaserImage` | Teaser Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `robotsTxtContent` | Robots.txt Content | Text | no | no | none |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | Symbol | no | yes | none |
| `ogDescription` | OG Description | Text | no | yes | none |
| `ogImage` | OG Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | Boolean | no | yes | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | Boolean | no | yes | none |

### imageWithFocalPoint

- Name: Image with Focal Point
- Display field: `title`
- Referenced by: `cardItem.icon`, `contentPage.ogImage`, `contentPage.teaserImage`, `featureCardBlock.image`, `fiftyFiftyItem.image`, `fiftyFiftyItem.mobileImage`, `formContainer.image`, `heroBlock.media`, `heroBlock.mobileMedia`, `homePage.ogImage`, `homePage.teaserImage`, `listingPage.ogImage`, `listingPage.teaserImage`, `logoItem.colouredHoverLogo`, `officeDataBlock.image`, `productCard.image`, `profileDataBlock.image`, `promoBlock.backgroundImage`, `promoBlock.icon`, `resourceHero.backgroundImage`, `resourceHero.icon`, `resourcePage.ogImage`, `resourcePage.resourceContent`, `resourcePage.teaserImage`, `searchPage.ogImage`, `searchPage.teaserImage`, `siteSettings.footerLogo`, `siteSettings.notificationIcon`, `siteSettings.siteLogo`, `statisticItem.icon`, `submenuCardItem.featuredCardImage`, `submenuCardItem.image`, `tabItem.tabDefaultIcon`, `testimonialItem.companyLogo`, `testimonialItem.image`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `title` | Title | Symbol | yes | no | none |
| `image` | Image | Link<Asset> | yes | no | none |
| `altText` | Alt Text | Symbol | no | yes | none |
| `focus` | Focus | Symbol | yes | yes | Allowed values: `Center`, `Top`, `Right`, `Left`, `Bottom`, `Top Right`, `Top Left`, `Bottom Right`, `Bottom Left`, `Face`, `Faces`, `Focal Point` |
| `focalPoint` | Focal point | Object | no | no | none |

### insightsResourcesBlock

- Name: Insights & Resources Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | yes | yes | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `contentType` | Content Type | Symbol | yes | yes | Allowed values: `Taxonomy`, `Parent Page`, `Manual Pages` |
| `parentListingPage` | Parent Listing Page | Link<Entry> | no | yes | Allows: `listingPage` |
| `manualPages` | Manual Pages | Array<Link<Entry>> | no | yes | Allows: `resourcePage`<br>Size: {"max":4} |
| `taxonomy` | Taxonomy | Object | no | yes | none |

### languageOption

- Name: Language Option
- Display field: `internalName`
- Description: Represents a single language/locale entry in the site language selector.
- Referenced by: `siteSettings.languageOptions`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `displayName` | Display Name | Symbol | yes | yes | none |
| `cultureCode` | Culture Code | Symbol | no | no | none |
| `isoCountryCode` | ISO Country Code | Symbol | no | no | none |
| `isExternal` | Is External | Boolean | no | no | none |
| `externalHomepageUrl` | External Homepage URL | Symbol | no | no | Regexp: `^(https?:\/\/\|\/)` |
| `flag` | Flag | Link<Asset> | no | no | none |

### listBlock

- Name: List Block
- Display field: `internalName`
- Description: A component that allows the ticket list styles bullet points. This can be added within the Rich Text Block and other content blocks to display the styled list.
- Referenced by: `contentPage.bodyContentArea`, `fiftyFiftyItem.listBlock`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `style` | Style | Symbol | yes | no | Allowed values: `Tick`, `Bulleted`, `Numbered`, `Unordered` |
| `heading` | Heading | Symbol | no | yes | none |
| `listContent` | List Content | Array<Link<Entry>> | yes | no | Allows: `listItem` |

### listingPage

- Name: Listing Page
- Display field: `internalName`
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.parentListingPage`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `parent` | Page Parent | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | Symbol | no | yes | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `heroDescriptionRichText` | Hero Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | Link<Entry> | no | yes | Allows: `heroBlock` |
| `bodyContentArea` | Body Content Area | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchHeading` | Search Heading | Symbol | no | yes | none |
| `searchHeadingStyle` | Search Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `searchDescription` | Search Description | Symbol | no | yes | none |
| `searchPlaceholder` | Search Placeholder | Symbol | yes | yes | none |
| `noResultsText` | No Results Text | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `defaultGridLayout` | Default grid layout | Symbol | no | yes | Allowed values: `Card Grid`, `Stacked` |
| `layoutLabel` | Layout label | Symbol | yes | yes | none |
| `taxonomyFilter` | Taxonomy Filter | Object | no | no | none |
| `pageSize` | Page Size | Integer | yes | yes | none |
| `searchImportance` | Search Importance | Symbol | no | no | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | Boolean | yes | yes | none |
| `resourceTypeFilter` | Resource Type Filter | Object | no | yes | none |
| `mandatoryFilterCategory` | Mandatory Filter Category | Object | no | yes | none |
| `teaserTitle` | Teaser Title | Symbol | no | no | none |
| `teaserDescription` | Teaser Description | Symbol | no | no | none |
| `teaserImage` | Teaser Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | Symbol | no | yes | none |
| `ogDescription` | OG Description | Text | no | yes | none |
| `ogImage` | OG Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | Boolean | no | yes | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | Boolean | no | yes | none |

### listItem

- Name: List Item
- Display field: `internalName`
- Description: Minimal rich text for display in List Block
- Referenced by: `listBlock.listContent`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `itemContent` | Item Content | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |

### logoBlock

- Name: Logo Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `subtext` | Subtext | Symbol | no | yes | none |
| `logoItems` | Logo Items | Array<Link<Entry>> | yes | yes | Allows: `logoItem`<br>Size: {"max":20} |
| `backgroundColour` | Background Colour | Symbol | no | yes | Allowed values: `Grey`, `White` |
| `pauseTickerAnimation` | Pause Ticker Animation | Boolean | no | yes | none |

### logoItem

- Name: Logo Item
- Display field: `internalName`
- Referenced by: `logoBlock.logoItems`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `colouredHoverLogo` | Coloured Hover Logo | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `logoLink` | Logo Link | Link<Entry> | no | no | Allows: `ctaItem` |

### mediaItem

- Name: Media Item
- Display field: `internalName`
- Description: Reusable media component with asset and metadata for images, videos, and other media files.
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `name` | Name | Symbol | no | no | none |
| `altText` | Alt Text | Symbol | no | yes | none |
| `asset` | Asset | Link<Asset> | yes | yes | none |

### menuContainer

- Name: Menu Container
- Display field: `internalName`
- Referenced by: `siteSettings.megaMenu`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `headerLabel` | Header Label | Symbol | yes | yes | none |
| `headerLink` | Header Link | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `style` | Style | Symbol | yes | yes | Allowed values: `Links`, `Submenu` |
| `displayBackgroundGraphic` | Display Background Graphic | Boolean | no | yes | none |
| `links` | Links | Array<Link<Entry>> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: {"max":12} |
| `submenuItems` | Submenu Items | Array<Link<Entry>> | no | yes | Allows: `submenuCardItem`, `submenuLinksItem`<br>Size: {"max":7} |

### notFoundGroup

- Name: 404 Group
- Display field: `internalName`
- Referenced by: `siteSettings.notFoundGroup`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | no | no | none |
| `heading` | 404 Heading | Symbol | no | yes | none |
| `heroDescription` | 404 Hero Description | Symbol | no | yes | none |
| `eyebrowText` | 404 Eyebrow Text | Symbol | no | yes | none |
| `callToAction` | 404 Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### notFoundPage

- Name: 404 Page
- Display field: `internalName`
- Referenced by: `contentPage.canonicalUrl`, `homePage.canonicalUrl`, `listingPage.canonicalUrl`, `notFoundPage.canonicalUrl`, `resourcePage.canonicalUrl`, `searchPage.canonicalUrl`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `heroDescriptionRichText` | Hero Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |

### notificationBlock

- Name: Notification Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `notificationHeading` | Notification Heading | Symbol | yes | yes | none |
| `notificationDescription` | Notification Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### officeContainerBlock

- Name: Office Container Block
- Display field: `internalName`
- Referenced by: `officeListingBlock.officeContainers`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `offices` | Offices | Array<Link<Entry>> | no | yes | Allows: `officeDataBlock` |

### officeDataBlock

- Name: Office Data Block
- Display field: `internalName`
- Referenced by: `officeContainerBlock.offices`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `officeName` | Office Name | Symbol | yes | yes | none |
| `address` | Address | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `telephoneNumber` | Telephone Number | Symbol | no | yes | none |
| `image` | Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `highlightText` | Highlight Text | Symbol | no | yes | none |

### officeListingBlock

- Name: Office Listing Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `h2`, `h3` |
| `officeContainers` | Office Containers | Array<Link<Entry>> | no | yes | Allows: `officeContainerBlock` |

### productCard

- Name: Product Card
- Display field: `internalName`
- Description: Card component featuring a product or service with image, text content, and optional link.
- Referenced by: `productCardBlock.productCards`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `image` | Image | Link<Entry> | yes | no | Allows: `imageWithFocalPoint` |
| `description` | Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `link` | Link | Link<Entry> | yes | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### productCardBlock

- Name: Product Card Block
- Display field: `internalName`
- Description: Showcases products or services in a card-based carousel layout with images, descriptions, and links to detailed information.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | yes | yes | Allowed values: `H2`, `H3` |
| `description` | Description | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem` |
| `productCards` | Product Cards | Array<Link<Entry>> | yes | yes | Allows: `productCard`<br>Size: {"min":4,"max":10} |

### profileDataBlock

- Name: Profile Data Block
- Display field: `internalName`
- Referenced by: `resourcePage.author`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `fullName` | Full Name | Symbol | yes | yes | none |
| `jobTitle` | Job Title | Symbol | yes | yes | none |
| `biography` | Biography | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `image` | Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `socialPlatforms` | Social Platforms | Array<Link<Entry>> | no | yes | Allows: `socialItem` |

### promoBlock

- Name: Promo Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.promoBlock`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `headingStyle` | Heading Style | Symbol | yes | yes | Allowed values: `h2`, `h3` |
| `statementText` | Statement Text | Symbol | no | yes | none |
| `description` | Description | Symbol | no | yes | none |
| `callToAction` | Call to Action | Link<Entry> | no | yes | Allows: `ctaItem` |
| `backgroundImage` | Background Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `icon` | Icon | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `hideCornerAccent` | Hide Corner Accent | Boolean | no | yes | none |
| `style` | Style | Symbol | yes | yes | Allowed values: `Grey`, `White`, `Background Image` |
| `textColour` | Text Colour | Symbol | yes | yes | Allowed values: `Grey`, `White` |

### resourceHero

- Name: Resource Hero
- Display field: `internalName`
- Referenced by: `resourcePage.resourceHero`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `backgroundImage` | Background Image | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `icon` | Icon | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |

### resourceItem

- Name: Resource Item
- Display field: `internalName`
- Description: Stores system resources and configuration data including microcopy, references, and settings. Use naming convention: region.name (e.g., login.password).
- Referenced by: `resourceSet.references`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `label` | Label | Symbol | no | no | none |
| `helpText` | Help Text | Text | no | no | none |
| `fieldType` | Type | Symbol | no | no | Allowed values: `True/False`, `Text`, `Reference` |
| `flag` | Flag | Boolean | no | yes | none |
| `Text` | Text | Text | no | yes | none |
| `references` | References | Array<Link<Entry>> | no | yes | none |
| `history` | History | Object | no | no | none |

### resourcePage

- Name: Resource Page
- Display field: `internalName`
- Allowed taxonomy schemes: `partners`, `subprocessors`, `partnerCountries`, `partnerRegion`, `knowledgeHubTopics`, `productFamilies`, `roles`, `topics`, `industries`, `resourceType`
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.manualPages`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `heroDescriptionRichText` | Hero Description | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `resourceHero` | Resource Hero | Link<Entry> | no | yes | Allows: `resourceHero`, `heroBlock` |
| `hideFallbackHero` | Hide Fallback Hero | Boolean | no | no | none |
| `parent` | Page Parent | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | Symbol | no | yes | none |
| `pageLayout` | Page Layout | Symbol | yes | yes | Allowed values: `Two Column`, `One Column` |
| `hideSidebarNavigation` | Hide Sidebar Navigation | Boolean | no | yes | none |
| `secondaryHeading` | Secondary Heading | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `introduction` | Introduction | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `hideSocialShare` | Hide Social Share | Boolean | no | yes | none |
| `resourceSummary` | Resource Summary | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `resourceContent` | Resource Content | Array<Link<Entry>> | no | yes | Allows: `richTextBlock`, `imageWithFocalPoint` |
| `promoBlock` | Promo Block | Link<Entry> | no | yes | Allows: `promoBlock` |
| `author` | Author | Link<Entry> | no | yes | Allows: `profileDataBlock` |
| `publishedDate` | Published Date | Date | no | yes | none |
| `readTime` | Read Time | Integer | no | yes | none |
| `hideRelatedContent` | Hide Related Content | Boolean | no | yes | none |
| `fullWidthContentArea` | Full Width Content Area | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchImportance` | Search Importance | Symbol | no | no | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | Boolean | yes | yes | none |
| `formId` | Form ID | Symbol | no | yes | none |
| `relatedFieldGated` | Related Field Gated | Symbol | no | yes | none |
| `teaserTitle` | Teaser Title | Symbol | no | no | none |
| `teaserDescription` | Teaser Description | Symbol | no | no | none |
| `teaserImage` | Teaser Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | Symbol | no | yes | none |
| `ogDescription` | OG Description | Text | no | yes | none |
| `ogImage` | OG Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `relatedFile` | Related File | Symbol | no | yes | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | Boolean | no | yes | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | Boolean | no | yes | none |

### resourceSet

- Name: Resource Set
- Display field: `internalName`
- Description: A centralised collection of reusable text strings and labels (such as search placeholders, button text, and common UI elements) that can be referenced across the site for consistent messaging and easier localisation.
- Referenced by: `siteSettings.references`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Unique |
| `references` | References | Array<Link<Entry>> | no | no | Allows: `resourceItem` |

### richTextBlock

- Name: Rich Text Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.resourceContent`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `content` | Content | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `heading-2`, `heading-3`, `heading-4`, `heading-5`, `heading-6`, `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`, `table`, `blockquote`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","imageWithFocalPoint","homePage","contentPage","resourcePage","listingPage","searchPage","taxonomyBlock"]}]}` |

### scoringProfile

- Name: Scoring Profile
- Display field: `internalName`
- Description: Block used for boosting categories on AI Search
- Referenced by: `siteSettings.scoringProfile`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Allowed values: `Scoring Profile`<br>Unique |
| `informationCategories` | Information Categories | Object | no | no | none |
| `commercialCategories` | Commercial Categories | Object | no | no | none |

### searchPage

- Name: Search Page
- Display field: `internalName`
- Referenced by: `aiSearchBlock.callToAction`, `aiSearchBlock.searchResultsPage`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `siteSettings.searchPage`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `parent` | Page Parent | Link<Entry> | no | no | Allows: `searchPage`, `homePage`, `contentPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | Symbol | no | yes | none |
| `slug` | Slug | Symbol | yes | yes | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `bodyContentArea` | Body Content Area | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchPlaceholder` | Search Placeholder | Symbol | yes | yes | none |
| `noResultsText` | No Results Text | RichText | yes | yes | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `pageSize` | Page Size | Integer | yes | yes | none |
| `aiOverviewHeading` | AI Overview Heading | Symbol | no | yes | none |
| `aiOverviewQueryPrefix` | AI Overview Query Prefix | Symbol | no | yes | none |
| `sourcesLabel` | Sources Label | Symbol | no | yes | none |
| `disableAiOverview` | Disable AI Overview | Boolean | no | yes | none |
| `excludeFromSearch` | Exclude from search | Boolean | yes | yes | none |
| `taxonomyFilter` | Taxonomy Filter | Object | no | no | none |
| `teaserTitle` | Teaser Title | Symbol | no | no | none |
| `teaserDescription` | Teaser Description | Symbol | no | no | none |
| `teaserImage` | Teaser Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | Array<Symbol> | no | yes | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | Symbol | no | yes | none |
| `metaDescription` | Meta Description | Text | no | yes | none |
| `canonicalUrl` | Canonical URL | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | Symbol | no | yes | none |
| `ogDescription` | OG Description | Text | no | yes | none |
| `ogImage` | OG Image | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | Boolean | no | yes | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | Boolean | no | yes | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | Boolean | no | yes | none |

### siteSettings

- Name: Site Settings
- Display field: `internalName`
- Description: A container for all global settings used throughout the site
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Allowed values: `Site Settings`<br>Unique |
| `siteName` | Site Name | Symbol | yes | no | none |
| `siteLogo` | Site Logo | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `homePageLink` | Home Page Link | Link<Entry> | yes | yes | Allows: `homePage` |
| `utilityHeaderLinks` | Utility Header Links | Array<Link<Entry>> | yes | no | Allows: `ctaItem`<br>Size: {"max":5} |
| `headerCta` | Header CTA | Link<Entry> | no | yes | Allows: `ctaItem` |
| `megaMenu` | Mega Menu | Array<Link<Entry>> | no | yes | Allows: `menuContainer`<br>Size: {"max":5} |
| `searchPage` | Search Page | Link<Entry> | yes | yes | Allows: `searchPage` |
| `searchScreenReaderLabel` | Search Screen Reader Label | Symbol | yes | yes | none |
| `searchPlaceholder` | Search Placeholder | Symbol | yes | yes | none |
| `footerLogo` | Footer Logo | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `footerContent` | Footer Content | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `footerColumns` | Footer Columns | Array<Link<Entry>> | no | yes | Allows: `footerItem`<br>Size: {"max":5} |
| `footerUtilityLinks` | Footer Utility Links | Array<Link<Entry>> | no | yes | Allows: `ctaItem` |
| `phoneNumberPrefixLabel` | Phone Number Prefix Label | Symbol | no | no | none |
| `phoneNumber` | Phone Number | Symbol | no | yes | none |
| `copyrightText` | Copyright Text | Symbol | yes | yes | none |
| `socialLinks` | Social Links | Array<Link<Entry>> | no | yes | Allows: `socialItem` |
| `searchButtonScreenReaderToggleOpen` | Search Button Screen Reader Toggle Open | Symbol | yes | yes | none |
| `searchButtonScreenReaderToggleClose` | Search Button Screen Reader Toggle Close | Symbol | yes | yes | none |
| `notificationHeading` | Notification Heading | Symbol | no | yes | none |
| `notificationDescription` | Notification Description | Symbol | no | yes | none |
| `notificationLink` | Notification Link | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `notificationIcon` | Notification Icon | Link<Entry> | no | yes | Allows: `imageWithFocalPoint` |
| `displayGlobalNotification` | Display Global Notification | Boolean | no | yes | none |
| `scoringProfile` | Scoring Profile | Link<Entry> | yes | no | Allows: `scoringProfile` |
| `aiSearchEnabled` | AI Search Enabled | Boolean | no | no | none |
| `notFoundGroup` | 404 Group | Link<Entry> | no | no | Allows: `notFoundGroup` |
| `languageOptions` | Language Options | Array<Link<Entry>> | no | no | Allows: `languageOption` |
| `references` | Site Settings | Array<Link<Entry>> | yes | no | Allows: `resourceSet` |

### socialItem

- Name: Social Item
- Display field: `internalName`
- Referenced by: `profileDataBlock.socialPlatforms`, `siteSettings.socialLinks`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `platform` | Platform | Symbol | yes | yes | Allowed values: `LinkedIn`, `X`, `Facebook`, `Instagram`, `YouTube` |
| `platformURL` | Platform URL | Symbol | yes | yes | Regexp: `^(ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?$` |

### stackedCarouselCardBlock

- Name: Stacked/Carousel Card Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `description` | Description | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `cards` | Cards | Array<Link<Entry>> | yes | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `cardItem`<br>Size: {"max":12,"min":2} |
| `layout` | Layout | Symbol | no | yes | Allowed values: `Stacked 3 per row`, `Stacked 2 per row`, `Carousel` |
| `backgroundColour` | Background Colour | Symbol | no | yes | Allowed values: `White`, `Light Grey` |

### statisticItem

- Name: Statistic Item
- Display field: `internalName`
- Referenced by: `statisticsBlock.statistics`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `supportingText` | Supporting Text | Symbol | no | yes | none |
| `supportingTextColour` | Supporting Text Colour | Symbol | yes | yes | Allowed values: `Grey`, `Orange` |
| `statisticStyle` | Statistic Style | Symbol | yes | yes | Allowed values: `Text`, `Icon` |
| `icon` | Icon | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `text` | Text | Symbol | no | yes | none |

### statisticsBlock

- Name: Statistics Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `h2`, `h3` |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `style` | Style | Symbol | yes | yes | Allowed values: `Statistics`, `Facts` |
| `statistics` | Statistics | Array<Link<Entry>> | no | yes | Allows: `statisticItem`<br>Size: {"max":9} |
| `facts` | Facts | Array<Link<Entry>> | no | yes | Allows: `factItem`<br>Size: {"max":4} |

### submenuCardItem

- Name: Submenu Card Item
- Display field: `internalName`
- Referenced by: `menuContainer.submenuItems`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `description` | Description | Text | no | yes | none |
| `image` | Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `featuredCardImage` | Featured Card Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `featuredCardHeading` | Featured Card Heading | Symbol | no | no | none |
| `featuredCardDescription` | Featured Card Description | Symbol | no | no | none |
| `featuredCardLink` | Featured Card Link | Link<Entry> | no | no | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `hideFeaturedCardImageAccent` | Hide Featured Card Image Accent | Boolean | no | yes | none |

### submenuLinksItem

- Name: Submenu Links Item
- Display field: `internalName`
- Referenced by: `menuContainer.submenuItems`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | yes | yes | none |
| `links` | Links | Array<Link<Entry>> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: {"max":10} |

### tabItem

- Name: Tab Item
- Display field: `internalName`
- Referenced by: `tabSectionBlock.tabs`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `tabHeading` | Tab Heading | Symbol | yes | yes | none |
| `tabDefaultIcon` | Tab Default Icon | Link<Entry> | yes | yes | Allows: `imageWithFocalPoint` |
| `content` | Content | Array<Link<Entry>> | no | yes | Allows: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock` |

### tableBlock

- Name: Table Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `description` | Description | Symbol | no | yes | none |
| `eyebrowText` | Eyebrow Text | Symbol | no | yes | none |
| `tableContent` | Table Content | RichText | no | yes | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink`, `table` |
| `callToAction` | Call To Action | Link<Entry> | no | yes | Allows: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `backgroundColour` | Background Colour | Symbol | no | yes | Allowed values: `White`, `Light Grey` |

### tabSectionBlock

- Name: Tab Section Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `description` | Description | Symbol | no | yes | none |
| `tabs` | Tabs | Array<Link<Entry>> | no | yes | Allows: `tabItem`<br>Size: {"max":4} |

### taxonomyBlock

- Name: Taxonomy Block
- Display field: `internalName`
- Description: An empty content type used in rich text to add taxonomy, used for subprocesses and partner pages
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | Allowed values: `Taxonomy Block`<br>Unique |

### testimonialItem

- Name: Testimonial Item
- Display field: `internalName`
- Referenced by: `testimonialsBlock.testimonials`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `tagline` | Tagline | Symbol | yes | yes | none |
| `quote` | Quote | Text | yes | yes | none |
| `companyLogo` | Company Logo | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `sourceName` | Source Name | Symbol | no | yes | none |
| `sourceJobTitle` | Source Job Title | Symbol | no | yes | none |
| `image` | Image | Link<Entry> | no | no | Allows: `imageWithFocalPoint` |
| `hideImageAccent` | Hide Image Accent | Boolean | no | yes | none |

### testimonialsBlock

- Name: Testimonials Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: yes

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | yes | yes | Allowed values: `H2`, `H3` |
| `testimonials` | Testimonials | Array<Link<Entry>> | yes | yes | Allows: `testimonialItem`<br>Size: {"min":1,"max":10} |

### videoBlock

- Name: Video Block
- Display field: `internalName`
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `heading` | Heading | Symbol | no | yes | none |
| `headingStyle` | Heading Style | Symbol | no | yes | Allowed values: `H2`, `H3` |
| `video` | Video | Link<Entry> | yes | yes | Allows: `videoItem` |

### videoItem

- Name: Video Item
- Display field: `internalName`
- Referenced by: `videoBlock.video`
- Importer mapped target: no

| Field ID | Name | Type | Required | Localized | Links / Validations |
| --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | Symbol | yes | no | none |
| `videoType` | Video Type | Symbol | yes | yes | Allowed values: `CMS Video`, `Bynder Video`, `Embedded Video` |
| `cmsVideo` | CMS Video | Link<Asset> | no | yes | `{"linkMimetypeGroup":["video"]}` |
| `bynderVideo` | Bynder Video | Object | no | yes | none |
| `embeddedVideo` | Embedded Video | Symbol | no | yes | Regexp: `^(ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?$` |
| `caption` | Caption | Symbol | no | yes | none |

## Notes

- Page templates are top-level entries and are not usually nested inside body content.
- Placeable body blocks are content types allowed in page body regions such as `bodyContentArea` or `fullWidthContentArea`.
- Nested and reusable items are usually referenced by parent blocks rather than authored as standalone pages.
- Importer mapped target means the current YAML mapping can generate that Contentful content type directly or as a nested entry.

