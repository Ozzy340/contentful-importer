# Contentful Component Field Reference

This document is generated from the local Contentful UAT model snapshot. It lists every content type, every field, the shape of values expected by Contentful, and any known allowed values or link targets.

Source of truth:

- [model-snapshot-uat.json](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.json)
- [component-map.yml](/Users/jamesatkins/Documents/JS/contentful-importer/config/component-map.yml)

## Snapshot

- Generated: 2026-05-06T15:28:41.324Z
- Space: `yymku90gll7g`
- Environment: `uat`
- Locales: `de-DE`, `en`, `en-CA`, `en-GB`, `en-US`, `es`, `fr-BE`, `fr-CA`, `fr-CH`, `fr-FR`, `it-IT`, `ja-JP`, `nl-BE`, `nl-NL`
- Content types: `61`

## How To Read This

- **Settable** says whether the field can normally be populated. Disabled or omitted fields are shown as not settable.
- **Input kind** describes the editorial/control shape: text input, dropdown, rich text, boolean, component link, asset link, object, or list.
- **Expected value** describes what the uploader or Contentful Management API should send.
- **Allowed values / constraints** includes dropdown options, rich text restrictions, size limits, unique fields, regex rules, and allowed linked content types.
- Fields marked required must be present for Contentful validation unless the content model supplies an implicit default elsewhere.

## Component Index

| Content Type ID | Name | Fields | Required | Importer mapped |
| --- | --- | ---: | --- | --- |
| `accordionBlock` | Accordion Block | 5 | `internalName` | yes |
| `accordionItem` | Accordion Item | 3 | `internalName`, `itemHeading`, `itemContent` | yes |
| `aiSearchBlock` | AI Search Block | 10 | `internalName`, `heading`, `searchFieldPlaceholder` | no |
| `cardItem` | Card Item | 5 | `internalName`, `heading` | yes |
| `contentPage` | Content Page | 23 | `internalName`, `slug`, `heading`, `excludeFromSearch` | yes |
| `ctaItem` | CTA Item | 9 | `internalName`, `linkText`, `customiseStyle` | yes |
| `embedBlock` | Embed Block | 11 | `internalName`, `platform` | no |
| `factItem` | Fact Item | 3 | `internalName`, `heading`, `fact` | no |
| `featureCardBlock` | Feature Card Block | 13 | `internalName`, `image`, `featureItems`, `blockLayout` | yes |
| `featureCardItem` | Feature Card Item | 4 | `internalName`, `heading` | yes |
| `fiftyFiftyBlock` | 50/50 Block | 3 | `internalName`, `fiftyFiftyContainer`, `firstItemPosition` | yes |
| `fiftyFiftyItem` | 50/50 Item | 13 | `internalName`, `heading`, `contentTypeDisplay`, `theme` | yes |
| `footerItem` | Footer Item | 3 | `internalName`, `heading`, `links` | no |
| `form` | Form | 9 | `internalName`, `formType`, `formId`, `fields`, `ctaText`, `utmHtmlName`, `pageUrlHtmlName`, `googleAnalyticsHtmlName` | no |
| `formContainer` | Form Container | 10 | `internalName`, `heading`, `headingStyle`, `subHeading`, `disclaimerText`, `formSuccessMessage`, `form`, `formStyle` | no |
| `formField` | Form Field | 14 | `internalName`, `fieldType`, `htmlName` | no |
| `gatedContentBlock` | Gated Content Block | 5 | `internalName`, `ungatedContent` | no |
| `heroBlock` | Hero Block | 13 | `internalName`, `heroStyle`, `media` | yes |
| `homePage` | Home Page | 23 | `internalName`, `slug`, `heading`, `heroContentArea`, `excludeFromSearch` | no |
| `imageWithFocalPoint` | Image with Focal Point | 5 | `title`, `image`, `focus` | yes |
| `insightsResourcesBlock` | Insights & Resources Block | 9 | `internalName`, `heading`, `headingStyle`, `contentType` | no |
| `languageOption` | Language Option | 7 | `internalName`, `displayName` | no |
| `listBlock` | List Block | 4 | `internalName`, `style`, `listContent` | yes |
| `listingPage` | Listing Page | 34 | `internalName`, `slug`, `heading`, `searchPlaceholder`, `noResultsText`, `layoutLabel`, `pageSize`, `excludeFromSearch` | no |
| `listItem` | List Item | 2 | `internalName`, `itemContent` | yes |
| `logoBlock` | Logo Block | 8 | `internalName`, `logoItems` | yes |
| `logoItem` | Logo Item | 3 | `internalName` | yes |
| `mediaItem` | Media Item | 4 | `internalName`, `asset` | no |
| `menuContainer` | Menu Container | 7 | `internalName`, `headerLabel`, `style` | no |
| `notFoundGroup` | 404 Group | 5 | none | no |
| `notFoundPage` | 404 Page | 11 | `internalName`, `slug`, `heading` | no |
| `notificationBlock` | Notification Block | 4 | `internalName`, `notificationHeading` | yes |
| `officeContainerBlock` | Office Container Block | 3 | `internalName`, `heading` | no |
| `officeDataBlock` | Office Data Block | 6 | `internalName`, `officeName` | no |
| `officeListingBlock` | Office Listing Block | 4 | `internalName` | no |
| `productCard` | Product Card | 5 | `internalName`, `heading`, `image`, `link` | yes |
| `productCardBlock` | Product Card Block | 7 | `internalName`, `heading`, `headingStyle`, `productCards` | yes |
| `profileDataBlock` | Profile Data Block | 6 | `internalName`, `fullName`, `jobTitle` | no |
| `promoBlock` | Promo Block | 11 | `internalName`, `heading`, `headingStyle`, `style`, `textColour` | yes |
| `resourceHero` | Resource Hero | 3 | `internalName`, `backgroundImage` | no |
| `resourceItem` | Resource Item | 8 | `internalName` | no |
| `resourcePage` | Resource Page | 40 | `internalName`, `slug`, `heading`, `pageLayout`, `excludeFromSearch` | no |
| `resourceSet` | Resource Set | 2 | `internalName` | no |
| `richTextBlock` | Rich Text Block | 2 | `internalName`, `content` | yes |
| `scoringProfile` | Scoring Profile | 3 | `internalName` | no |
| `searchPage` | Search Page | 28 | `internalName`, `slug`, `heading`, `searchPlaceholder`, `noResultsText`, `pageSize`, `excludeFromSearch` | no |
| `siteSettings` | Site Settings | 30 | `internalName`, `siteName`, `siteLogo`, `homePageLink`, `utilityHeaderLinks`, `searchPage`, `searchScreenReaderLabel`, `searchPlaceholder`, `footerLogo`, `copyrightText`, `searchButtonScreenReaderToggleOpen`, `searchButtonScreenReaderToggleClose`, `scoringProfile`, `references` | no |
| `socialItem` | Social Item | 3 | `internalName`, `platform`, `platformURL` | no |
| `stackedCarouselCardBlock` | Stacked/Carousel Card Block | 9 | `internalName`, `cards` | yes |
| `statisticItem` | Statistic Item | 6 | `internalName`, `supportingTextColour`, `statisticStyle` | yes |
| `statisticsBlock` | Statistics Block | 7 | `internalName`, `style` | yes |
| `submenuCardItem` | Submenu Card Item | 10 | `internalName`, `heading` | no |
| `submenuLinksItem` | Submenu Links Item | 3 | `internalName`, `heading` | no |
| `tabItem` | Tab Item | 4 | `internalName`, `tabHeading`, `tabDefaultIcon` | no |
| `tableBlock` | Table Block | 8 | `internalName` | yes |
| `tabSectionBlock` | Tab Section Block | 5 | `internalName` | no |
| `taxonomyBlock` | Taxonomy Block | 1 | `internalName` | no |
| `testimonialItem` | Testimonial Item | 8 | `internalName`, `tagline`, `quote` | yes |
| `testimonialsBlock` | Testimonials Block | 4 | `internalName`, `headingStyle`, `testimonials` | yes |
| `videoBlock` | Video Block | 4 | `internalName`, `video` | no |
| `videoItem` | Video Item | 6 | `internalName`, `videoType` | no |

## Full Field Reference

### accordionBlock

- Name: Accordion Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `Heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `h2`, `h3` |
| `firstItemOpen` | First Item Open | no | no | yes | Boolean | `true` or `false` | none |
| `accordionItems` | Accordion Items | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `accordionItem` |

### accordionItem

- Name: Accordion Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `accordionBlock.accordionItems`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `itemHeading` | Item Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `itemContent` | Item Content | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `heading-2`, `heading-3`, `heading-4`, `heading-5`, `heading-6`, `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`, `table`, `blockquote`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","imageWithFocalPoint","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |

### aiSearchBlock

- Name: AI Search Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `subtitle` | Subtitle | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchFieldPlaceholder` | Search Field Placeholder | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchExamplesLabel` | Search Examples Label | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchExamples` | Search Examples | no | yes | yes | List | Array of Symbol | none |
| `searchResultsPage` | Search Results Page | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `searchPage` |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### cardItem

- Name: Card Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `stackedCarouselCardBlock.cards`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `icon` | Icon | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `link` | Link | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### contentPage

- Name: Content Page
- Display field: `internalName`
- Importer mapped target: yes
- Description: A flexible page template that accepts all available content blocks, allowing editors to build custom layouts by combining multiple components.
- Allowed taxonomy schemes: `roles`, `topics`, `industries`, `productFamilies`
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `parent` | Page Parent | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescriptionRichText` | Hero Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `heroBlock` |
| `bodyContentArea` | Body Content Area | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchImportance` | Search Importance | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | yes | yes | yes | Boolean | `true` or `false` | none |
| `teaserTitle` | Teaser Title | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserDescription` | Teaser Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserImage` | Teaser Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `ogDescription` | OG Description | no | yes | yes | Long text | Long string | none |
| `ogImage` | OG Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | no | yes | yes | Boolean | `true` or `false` | none |

### ctaItem

- Name: CTA Item
- Display field: `internalName`
- Importer mapped target: yes
- Description: Reusable link component for calls-to-action with configurable styling, supporting both internal pages and external URLs.
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `logoItem.logoLink`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `productCardBlock.callToAction`, `promoBlock.callToAction`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.footerUtilityLinks`, `siteSettings.headerCta`, `siteSettings.notificationLink`, `siteSettings.utilityHeaderLinks`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `link` | Link | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `linkText` | Link Text | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `customiseStyle` | Customise Style | yes | yes | yes | Boolean | `true` or `false` | none |
| `style` | Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Primary Gray Solid`, `Primary Gray Outline`, `Primary Orange Solid`, `Secondary White Solid`, `Link Orange`, `Link Orange Left Arrow`, `Link Orange Right Arrow` |
| `openUrlInNewTab` | Open URL in new tab | no | no | yes | Boolean | `true` or `false` | none |
| `useExternalLink` | Use External Link | no | no | yes | Boolean | `true` or `false` | none |
| `externalUrl` | External URL | no | yes | yes | Short text | String, normally <= 255 characters | Regexp: `^((ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?\|mailto:\w[\w.-]*@([\w-]+\.)+[\w-]+\|tel:\+[0-9\-]*)$` |
| `fallbackUrl` | Fallback Url | no | yes | yes | Short text | String, normally <= 255 characters | none |

### embedBlock

- Name: Embed Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `platform` | Platform | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Outgrow`, `Storylane`, `Gartner Peer Insights`, `Formstack`, `Survey Monkey` |
| `embedId` | Embed ID | no | no | yes | Short text | String, normally <= 255 characters | none |
| `embedUrl` | Embed URL | no | no | yes | Short text | String, normally <= 255 characters | none |
| `aspectRatio` | Aspect Ratio | no | no | yes | Short text | String, normally <= 255 characters | none |
| `widgetId` | Widget ID | no | no | yes | Short text | String, normally <= 255 characters | none |
| `widgetSize` | Widget Size | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Large`, `Small` |
| `widgetTheme` | Widget Theme | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Light`, `Dark` |
| `showReviewButton` | Show Review Button | no | no | yes | Boolean | `true` or `false` | none |
| `formScriptUrl` | Form Script URL | no | no | yes | Short text | String, normally <= 255 characters | none |
| `scriptUrl` | Script URL | no | no | yes | Short text | String, normally <= 255 characters | none |

### factItem

- Name: Fact Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `statisticsBlock.facts`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `fact` | Fact | yes | yes | yes | Short text | String, normally <= 255 characters | none |

### featureCardBlock

- Name: Feature Card Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `upperCallToAction` | Upper Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `image` | Image | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `lowerCallToAction` | Lower Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `displayBackgroundGraphic` | Display Background Graphic | no | yes | yes | Boolean | `true` or `false` | none |
| `featureItems` | Feature Items | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `featureCardItem`<br>Size: max 4 |
| `blockLayout` | Block Layout | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Cards left image right`, `Cards right image left` |
| `displayAccordion` | Display Cards in an Accordion | no | yes | yes | Boolean | `true` or `false` | none |
| `accordionFirstItemOpen` | Accordion First Item Open | no | yes | yes | Boolean | `true` or `false` | none |

### featureCardItem

- Name: Feature Card Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `featureCardBlock.featureItems`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `description` | Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `link` | Link | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### fiftyFiftyBlock

- Name: 50/50 Block
- Display field: `internalName`
- Importer mapped target: yes
- Description: Container block that holds one or more 50/50 Items and controls the starting layout direction, with subsequent items automatically alternating.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `fiftyFiftyContainer` | 50/50 Container | yes | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `fiftyFiftyItem` |
| `firstItemPosition` | First Item Position | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Content Left, Text Right`, `Content Right, Text Left` |

### fiftyFiftyItem

- Name: 50/50 Item
- Display field: `internalName`
- Importer mapped target: yes
- Description: An individual split-layout item containing a media area and a text area
- Referenced by: `fiftyFiftyBlock.fiftyFiftyContainer`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `description` | Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `callToActions` | Call To Actions | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: max 2 |
| `contentTypeDisplay` | Content Type Display | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Image`, `Tick List`, `Video` |
| `image` | Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `mobileImage` | Mobile Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `video` | Video | no | yes | yes | Asset link | Contentful Asset link | Asset mimetype groups: `video` |
| `bynderVideo` | Bynder Video | no | no | yes | Structured object | JSON object | none |
| `listBlock` | List Block | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `listBlock` |
| `theme` | Theme | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Light Grey`, `Graphite`, `White` |

### footerItem

- Name: Footer Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `siteSettings.footerColumns`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `links` | Links | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### form

- Name: Form
- Display field: `internalName`
- Importer mapped target: no
- Description: A reusable Eloqua form definition. Composed of Form Field entries and configured for a specific form type.
- Referenced by: `formContainer.form`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `formType` | Form Type | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Contact`, `Hand Raiser`, `Webinar Registration`, `Event Registration`, `Gated Content` |
| `formId` | Eloqua Form ID | yes | yes | yes | Number | Whole number | none |
| `fields` | Fields | yes | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `formField` |
| `ctaText` | CTA Text | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `utmHtmlName` | UTM Html Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `pageUrlHtmlName` | Page URL Html Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `googleAnalyticsHtmlName` | Google Analytics Html Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `localeHtmlName` | Locale Html Name | no | yes | yes | Short text | String, normally <= 255 characters | none |

### formContainer

- Name: Form Container
- Display field: `internalName`
- Importer mapped target: no
- Description: A page-level block that embeds a reusable Form within a page content area.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `subHeading` | Sub Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `disclaimerText` | Disclaimer Text | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `formSuccessMessage` | Form Success Message | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `form` | Form | yes | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `form` |
| `formStyle` | Form Style | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Orange Inline Layout`, `Two-Column Grey Form` |
| `image` | Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |

### formField

- Name: Form Field
- Display field: `internalName`
- Importer mapped target: no
- Description: A reusable form field definition for use within Eloqua-integrated forms.
- Referenced by: `form.fields`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `fieldType` | Field Type | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Text`, `Long Text`, `Email`, `Dropdown`, `Checkbox`, `Hidden` |
| `htmlName` | HTML Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `placeholder` | Label/Placeholder | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `options` | Options | no | yes | yes | List | Array of Symbol | none |
| `isRequired` | Is Required | no | no | yes | Boolean | `true` or `false` | none |
| `isRequiredValidationMessage` | Is Required Validation Message | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `isEmailAddress` | Is Email Address | no | no | yes | Boolean | `true` or `false` | none |
| `isEmailAddressValidationMessage` | Is Email Address Validation Message | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `regularExpressionValidation` | Regular Expression Validation | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `regularExpressionValidationMessage` | Regular Expression Validation Message | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `hiddenFieldFromTags` | Hidden Field From Tags | no | no | yes | Boolean | `true` or `false` | none |
| `hiddenFieldTagGroup` | Hidden Field Tag Group | no | no | yes | Short text | String, normally <= 255 characters | none |
| `hiddenFieldValue` | Hidden Field Value | no | yes | yes | Short text | String, normally <= 255 characters | none |

### gatedContentBlock

- Name: Gated Content Block
- Display field: `internalName`
- Importer mapped target: no
- Description: Gates content behind a form submission. Visitors see ungated content and the form on page load; gated content is revealed after a successful submission.
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `ungatedContent` | Ungated Content | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `tabSectionBlock`, `formContainer` |
| `gatedContent` | Gated Content | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `tabSectionBlock` |
| `hideFirstGatedContentBlockAfterFirstView` | Hide First Gated Content Block After First View | no | yes | yes | Boolean | `true` or `false` | none |
| `redirectSubmissionPage` | Redirect Submission Page | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### heroBlock

- Name: Hero Block
- Display field: `internalName`
- Importer mapped target: yes
- Description: A prominent full-width banner block featuring H1, images, and call-to-actions to capture attention at the top of pages.
- Referenced by: `contentPage.heroContentArea`, `homePage.heroContentArea`, `listingPage.heroContentArea`, `resourcePage.resourceHero`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heroStyle` | Hero Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Standard`, `Impact` |
| `headingFontStyle` | Heading Font Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Standout`, `Regular` |
| `subtitle` | Subtitle | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToActions` | Call To Actions | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: max 2 |
| `lowerSubtext` | Lower Subtext | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `media` | Media | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `mobileMedia` | Mobile Media | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `desktopImageSize` | Desktop Image Size | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Standard`, `Large` |
| `hideImageAccent` | Hide Image Accent | no | yes | yes | Boolean | `true` or `false` | none |
| `theme` | Theme | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Grey`, `White` |
| `applyGradient` | Apply Gradient | no | no | yes | Boolean | `true` or `false` | none |

### homePage

- Name: Home Page
- Display field: `internalName`
- Importer mapped target: no
- Description: The main landing page template featuring hero content and customisable content blocks to introduce the brand and guide visitors to key areas of the site.
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.homePageLink`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `parent` | Page Parent | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescriptionRichText` | Hero Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `heroBlock` |
| `bodyContentArea` | Body Content Area | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `excludeFromSearch` | Exclude from search | yes | yes | yes | Boolean | `true` or `false` | none |
| `teaserTitle` | Teaser Title | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserDescription` | Teaser Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserImage` | Teaser Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `robotsTxtContent` | Robots.txt Content | no | no | yes | Long text | Long string | none |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `ogDescription` | OG Description | no | yes | yes | Long text | Long string | none |
| `ogImage` | OG Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | no | yes | yes | Boolean | `true` or `false` | none |

### imageWithFocalPoint

- Name: Image with Focal Point
- Display field: `title`
- Importer mapped target: yes
- Referenced by: `cardItem.icon`, `contentPage.ogImage`, `contentPage.teaserImage`, `featureCardBlock.image`, `fiftyFiftyItem.image`, `fiftyFiftyItem.mobileImage`, `formContainer.image`, `heroBlock.media`, `heroBlock.mobileMedia`, `homePage.ogImage`, `homePage.teaserImage`, `listingPage.ogImage`, `listingPage.teaserImage`, `logoItem.colouredHoverLogo`, `officeDataBlock.image`, `productCard.image`, `profileDataBlock.image`, `promoBlock.backgroundImage`, `promoBlock.icon`, `resourceHero.backgroundImage`, `resourceHero.icon`, `resourcePage.ogImage`, `resourcePage.resourceContent`, `resourcePage.teaserImage`, `searchPage.ogImage`, `searchPage.teaserImage`, `siteSettings.footerLogo`, `siteSettings.notificationIcon`, `siteSettings.siteLogo`, `statisticItem.icon`, `submenuCardItem.featuredCardImage`, `submenuCardItem.image`, `tabItem.tabDefaultIcon`, `testimonialItem.companyLogo`, `testimonialItem.image`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `title` | Title | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `image` | Image | yes | no | yes | Asset link | Contentful Asset link | none |
| `altText` | Alt Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `focus` | Focus | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Center`, `Top`, `Right`, `Left`, `Bottom`, `Top Right`, `Top Left`, `Bottom Right`, `Bottom Left`, `Face`, `Faces`, `Focal Point` |
| `focalPoint` | Focal point | no | no | yes | Structured object | JSON object | none |

### insightsResourcesBlock

- Name: Insights & Resources Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `contentType` | Content Type | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Taxonomy`, `Parent Page`, `Manual Pages` |
| `parentListingPage` | Parent Listing Page | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `listingPage` |
| `manualPages` | Manual Pages | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `resourcePage`<br>Size: max 4 |
| `taxonomy` | Taxonomy | no | yes | yes | Structured object | JSON object | none |

### languageOption

- Name: Language Option
- Display field: `internalName`
- Importer mapped target: no
- Description: Represents a single language/locale entry in the site language selector.
- Referenced by: `siteSettings.languageOptions`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `displayName` | Display Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `cultureCode` | Culture Code | no | no | yes | Short text | String, normally <= 255 characters | none |
| `isoCountryCode` | ISO Country Code | no | no | yes | Short text | String, normally <= 255 characters | none |
| `isExternal` | Is External | no | no | yes | Boolean | `true` or `false` | none |
| `externalHomepageUrl` | External Homepage URL | no | no | yes | Short text | String, normally <= 255 characters | Regexp: `^(https?:\/\/\|\/)` |
| `flag` | Flag | no | no | yes | Asset link | Contentful Asset link | none |

### listBlock

- Name: List Block
- Display field: `internalName`
- Importer mapped target: yes
- Description: A component that allows the ticket list styles bullet points. This can be added within the Rich Text Block and other content blocks to display the styled list.
- Referenced by: `contentPage.bodyContentArea`, `fiftyFiftyItem.listBlock`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `style` | Style | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Tick`, `Bulleted`, `Numbered`, `Unordered` |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `listContent` | List Content | yes | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `listItem` |

### listingPage

- Name: Listing Page
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.parentListingPage`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `parent` | Page Parent | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescriptionRichText` | Hero Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `heroContentArea` | Hero Content Area | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `heroBlock` |
| `bodyContentArea` | Body Content Area | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchHeading` | Search Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchHeadingStyle` | Search Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `searchDescription` | Search Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchPlaceholder` | Search Placeholder | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `noResultsText` | No Results Text | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `defaultGridLayout` | Default grid layout | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Card Grid`, `Stacked` |
| `layoutLabel` | Layout label | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `taxonomyFilter` | Taxonomy Filter | no | no | yes | Structured object | JSON object | none |
| `pageSize` | Page Size | yes | yes | yes | Number | Whole number | none |
| `searchImportance` | Search Importance | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | yes | yes | yes | Boolean | `true` or `false` | none |
| `resourceTypeFilter` | Resource Type Filter | no | yes | yes | Structured object | JSON object | none |
| `mandatoryFilterCategory` | Mandatory Filter Category | no | yes | yes | Structured object | JSON object | none |
| `teaserTitle` | Teaser Title | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserDescription` | Teaser Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserImage` | Teaser Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `ogDescription` | OG Description | no | yes | yes | Long text | Long string | none |
| `ogImage` | OG Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | no | yes | yes | Boolean | `true` or `false` | none |

### listItem

- Name: List Item
- Display field: `internalName`
- Importer mapped target: yes
- Description: Minimal rich text for display in List Block
- Referenced by: `listBlock.listContent`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `itemContent` | Item Content | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |

### logoBlock

- Name: Logo Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `subtext` | Subtext | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `logoItems` | Logo Items | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `logoItem`<br>Size: max 20 |
| `backgroundColour` | Background Colour | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Grey`, `White` |
| `pauseTickerAnimation` | Pause Ticker Animation | no | yes | yes | Boolean | `true` or `false` | none |

### logoItem

- Name: Logo Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `logoBlock.logoItems`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `colouredHoverLogo` | Coloured Hover Logo | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `logoLink` | Logo Link | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem` |

### mediaItem

- Name: Media Item
- Display field: `internalName`
- Importer mapped target: no
- Description: Reusable media component with asset and metadata for images, videos, and other media files.

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `name` | Name | no | no | yes | Short text | String, normally <= 255 characters | none |
| `altText` | Alt Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `asset` | Asset | yes | yes | yes | Asset link | Contentful Asset link | none |

### menuContainer

- Name: Menu Container
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `siteSettings.megaMenu`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `headerLabel` | Header Label | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headerLink` | Header Link | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `style` | Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Links`, `Submenu` |
| `displayBackgroundGraphic` | Display Background Graphic | no | yes | yes | Boolean | `true` or `false` | none |
| `links` | Links | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: max 12 |
| `submenuItems` | Submenu Items | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `submenuCardItem`, `submenuLinksItem`<br>Size: max 7 |

### notFoundGroup

- Name: 404 Group
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `siteSettings.notFoundGroup`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | no | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | 404 Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescription` | 404 Hero Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | 404 Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | 404 Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### notFoundPage

- Name: 404 Page
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.canonicalUrl`, `homePage.canonicalUrl`, `listingPage.canonicalUrl`, `notFoundPage.canonicalUrl`, `resourcePage.canonicalUrl`, `searchPage.canonicalUrl`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescriptionRichText` | Hero Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |

### notificationBlock

- Name: Notification Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `notificationHeading` | Notification Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `notificationDescription` | Notification Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### officeContainerBlock

- Name: Office Container Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `officeListingBlock.officeContainers`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `offices` | Offices | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `officeDataBlock` |

### officeDataBlock

- Name: Office Data Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `officeContainerBlock.offices`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `officeName` | Office Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `address` | Address | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `telephoneNumber` | Telephone Number | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `image` | Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `highlightText` | Highlight Text | no | yes | yes | Short text | String, normally <= 255 characters | none |

### officeListingBlock

- Name: Office Listing Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `h2`, `h3` |
| `officeContainers` | Office Containers | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `officeContainerBlock` |

### productCard

- Name: Product Card
- Display field: `internalName`
- Importer mapped target: yes
- Description: Card component featuring a product or service with image, text content, and optional link.
- Referenced by: `productCardBlock.productCards`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `image` | Image | yes | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `description` | Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `link` | Link | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |

### productCardBlock

- Name: Product Card Block
- Display field: `internalName`
- Importer mapped target: yes
- Description: Showcases products or services in a card-based carousel layout with images, descriptions, and links to detailed information.
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem` |
| `productCards` | Product Cards | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCard`<br>Size: min 4, max 10 |

### profileDataBlock

- Name: Profile Data Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `resourcePage.author`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `fullName` | Full Name | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `jobTitle` | Job Title | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `biography` | Biography | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `image` | Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `socialPlatforms` | Social Platforms | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `socialItem` |

### promoBlock

- Name: Promo Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.promoBlock`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `h2`, `h3` |
| `statementText` | Statement Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | Call to Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem` |
| `backgroundImage` | Background Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `icon` | Icon | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `hideCornerAccent` | Hide Corner Accent | no | yes | yes | Boolean | `true` or `false` | none |
| `style` | Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Grey`, `White`, `Background Image` |
| `textColour` | Text Colour | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Grey`, `White` |

### resourceHero

- Name: Resource Hero
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `resourcePage.resourceHero`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `backgroundImage` | Background Image | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `icon` | Icon | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |

### resourceItem

- Name: Resource Item
- Display field: `internalName`
- Importer mapped target: no
- Description: Stores system resources and configuration data including microcopy, references, and settings. Use naming convention: region.name (e.g., login.password).
- Referenced by: `resourceSet.references`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `label` | Label | no | no | yes | Short text | String, normally <= 255 characters | none |
| `helpText` | Help Text | no | no | yes | Long text | Long string | none |
| `fieldType` | Type | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `True/False`, `Text`, `Reference` |
| `flag` | Flag | no | yes | yes | Boolean | `true` or `false` | none |
| `Text` | Text | no | yes | yes | Long text | Long string | none |
| `references` | References | no | yes | yes | Component/page link list | Array of Contentful Entry links | none |
| `history` | History | no | no | yes | Structured object | JSON object | none |

### resourcePage

- Name: Resource Page
- Display field: `internalName`
- Importer mapped target: no
- Allowed taxonomy schemes: `partners`, `subprocessors`, `partnerCountries`, `partnerRegion`, `knowledgeHubTopics`, `productFamilies`, `roles`, `topics`, `industries`, `resourceType`
- Referenced by: `aiSearchBlock.callToAction`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `insightsResourcesBlock.manualPages`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `siteSettings.notificationLink`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heroDescriptionRichText` | Hero Description | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `resourceHero` | Resource Hero | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `resourceHero`, `heroBlock` |
| `hideFallbackHero` | Hide Fallback Hero | no | no | yes | Boolean | `true` or `false` | none |
| `parent` | Page Parent | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `pageLayout` | Page Layout | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Two Column`, `One Column` |
| `hideSidebarNavigation` | Hide Sidebar Navigation | no | yes | yes | Boolean | `true` or `false` | none |
| `secondaryHeading` | Secondary Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `introduction` | Introduction | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `hideSocialShare` | Hide Social Share | no | yes | yes | Boolean | `true` or `false` | none |
| `resourceSummary` | Resource Summary | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `resourceContent` | Resource Content | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `richTextBlock`, `imageWithFocalPoint` |
| `promoBlock` | Promo Block | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `promoBlock` |
| `author` | Author | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `profileDataBlock` |
| `publishedDate` | Published Date | no | yes | yes | Date/time | ISO date/time string | none |
| `readTime` | Read Time | no | yes | yes | Number | Whole number | none |
| `hideRelatedContent` | Hide Related Content | no | yes | yes | Boolean | `true` or `false` | none |
| `fullWidthContentArea` | Full Width Content Area | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchImportance` | Search Importance | no | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Critical`, `High`, `Medium`, `Low` |
| `excludeFromSearch` | Exclude from search | yes | yes | yes | Boolean | `true` or `false` | none |
| `formId` | Form ID | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `relatedFieldGated` | Related Field Gated | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `teaserTitle` | Teaser Title | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserDescription` | Teaser Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserImage` | Teaser Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `ogDescription` | OG Description | no | yes | yes | Long text | Long string | none |
| `ogImage` | OG Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `relatedFile` | Related File | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | no | yes | yes | Boolean | `true` or `false` | none |

### resourceSet

- Name: Resource Set
- Display field: `internalName`
- Importer mapped target: no
- Description: A centralised collection of reusable text strings and labels (such as search placeholders, button text, and common UI elements) that can be referenced across the site for consistent messaging and easier localisation.
- Referenced by: `siteSettings.references`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | Unique |
| `references` | References | no | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `resourceItem` |

### richTextBlock

- Name: Rich Text Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `resourcePage.resourceContent`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `content` | Content | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `heading-2`, `heading-3`, `heading-4`, `heading-5`, `heading-6`, `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`, `table`, `blockquote`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","imageWithFocalPoint","homePage","contentPage","resourcePage","listingPage","searchPage","taxonomyBlock"]}]}` |

### scoringProfile

- Name: Scoring Profile
- Display field: `internalName`
- Importer mapped target: no
- Description: Block used for boosting categories on AI Search
- Referenced by: `siteSettings.scoringProfile`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Scoring Profile`<br>Unique |
| `informationCategories` | Information Categories | no | no | yes | Structured object | JSON object | none |
| `commercialCategories` | Commercial Categories | no | no | yes | Structured object | JSON object | none |

### searchPage

- Name: Search Page
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `aiSearchBlock.callToAction`, `aiSearchBlock.searchResultsPage`, `cardItem.link`, `contentPage.canonicalUrl`, `contentPage.parent`, `ctaItem.link`, `featureCardBlock.lowerCallToAction`, `featureCardBlock.upperCallToAction`, `featureCardItem.link`, `fiftyFiftyItem.callToActions`, `footerItem.links`, `gatedContentBlock.redirectSubmissionPage`, `heroBlock.callToActions`, `homePage.canonicalUrl`, `homePage.parent`, `insightsResourcesBlock.callToAction`, `listingPage.canonicalUrl`, `listingPage.parent`, `menuContainer.headerLink`, `menuContainer.links`, `notFoundGroup.callToAction`, `notFoundPage.callToAction`, `notFoundPage.canonicalUrl`, `notificationBlock.callToAction`, `productCard.link`, `resourcePage.canonicalUrl`, `resourcePage.parent`, `searchPage.canonicalUrl`, `searchPage.parent`, `siteSettings.notificationLink`, `siteSettings.searchPage`, `stackedCarouselCardBlock.callToAction`, `stackedCarouselCardBlock.cards`, `submenuCardItem.callToAction`, `submenuCardItem.featuredCardLink`, `submenuLinksItem.links`, `tableBlock.callToAction`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `parent` | Page Parent | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `searchPage`, `homePage`, `contentPage` |
| `breadcrumbOverrideText` | Breadcrumb Override Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `slug` | Slug | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `bodyContentArea` | Body Content Area | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock`, `tabSectionBlock` |
| `searchPlaceholder` | Search Placeholder | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `noResultsText` | No Results Text | yes | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`, `superscript`, `subscript`<br>Rich text nodes: `ordered-list`, `unordered-list`, `embedded-entry-block`, `hyperlink`<br>Node restrictions: `{"embedded-entry-block":[{"linkContentType":["ctaItem","listBlock","homePage","contentPage","resourcePage","listingPage","searchPage"]}]}` |
| `pageSize` | Page Size | yes | yes | yes | Number | Whole number | none |
| `aiOverviewHeading` | AI Overview Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `aiOverviewQueryPrefix` | AI Overview Query Prefix | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `sourcesLabel` | Sources Label | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `disableAiOverview` | Disable AI Overview | no | yes | yes | Boolean | `true` or `false` | none |
| `excludeFromSearch` | Exclude from search | yes | yes | yes | Boolean | `true` or `false` | none |
| `taxonomyFilter` | Taxonomy Filter | no | no | yes | Structured object | JSON object | none |
| `teaserTitle` | Teaser Title | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserDescription` | Teaser Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `teaserImage` | Teaser Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `metaRobots` | Meta Robots | no | yes | yes | Multi-select dropdown | Array of selected dropdown values | Allowed values: `No Follow`, `No Index`, `No Translate`, `No Archive`, `No Snippet`, `No Image Index` |
| `metaTitle` | Meta Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `metaDescription` | Meta Description | no | yes | yes | Long text | Long string | none |
| `canonicalUrl` | Canonical URL | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `notFoundPage` |
| `ogTitle` | OG Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `ogDescription` | OG Description | no | yes | yes | Long text | Long string | none |
| `ogImage` | OG Image | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `showInXmlSiteMap` | Show in XML sitemap | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromPage` | Hide Global Notification From Page | no | yes | yes | Boolean | `true` or `false` | none |
| `hideGlobalNotificationFromChildren` | Hide Global Notification From Children | no | yes | yes | Boolean | `true` or `false` | none |

### siteSettings

- Name: Site Settings
- Display field: `internalName`
- Importer mapped target: no
- Description: A container for all global settings used throughout the site

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Site Settings`<br>Unique |
| `siteName` | Site Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `siteLogo` | Site Logo | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `homePageLink` | Home Page Link | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `homePage` |
| `utilityHeaderLinks` | Utility Header Links | yes | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`<br>Size: max 5 |
| `headerCta` | Header CTA | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem` |
| `megaMenu` | Mega Menu | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `menuContainer`<br>Size: max 5 |
| `searchPage` | Search Page | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `searchPage` |
| `searchScreenReaderLabel` | Search Screen Reader Label | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchPlaceholder` | Search Placeholder | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `footerLogo` | Footer Logo | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `footerContent` | Footer Content | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink` |
| `footerColumns` | Footer Columns | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `footerItem`<br>Size: max 5 |
| `footerUtilityLinks` | Footer Utility Links | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem` |
| `phoneNumberPrefixLabel` | Phone Number Prefix Label | no | no | yes | Short text | String, normally <= 255 characters | none |
| `phoneNumber` | Phone Number | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `copyrightText` | Copyright Text | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `socialLinks` | Social Links | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `socialItem` |
| `searchButtonScreenReaderToggleOpen` | Search Button Screen Reader Toggle Open | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `searchButtonScreenReaderToggleClose` | Search Button Screen Reader Toggle Close | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `notificationHeading` | Notification Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `notificationDescription` | Notification Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `notificationLink` | Notification Link | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `notificationIcon` | Notification Icon | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `displayGlobalNotification` | Display Global Notification | no | yes | yes | Boolean | `true` or `false` | none |
| `scoringProfile` | Scoring Profile | yes | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `scoringProfile` |
| `aiSearchEnabled` | AI Search Enabled | no | no | yes | Boolean | `true` or `false` | none |
| `notFoundGroup` | 404 Group | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `notFoundGroup` |
| `languageOptions` | Language Options | no | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `languageOption` |
| `references` | Site Settings | yes | no | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `resourceSet` |

### socialItem

- Name: Social Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `profileDataBlock.socialPlatforms`, `siteSettings.socialLinks`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `platform` | Platform | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `LinkedIn`, `X`, `Facebook`, `Instagram`, `YouTube` |
| `platformURL` | Platform URL | yes | yes | yes | Short text | String, normally <= 255 characters | Regexp: `^(ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?$` |

### stackedCarouselCardBlock

- Name: Stacked/Carousel Card Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `cards` | Cards | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`, `cardItem`<br>Size: min 2, max 12 |
| `layout` | Layout | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Stacked 3 per row`, `Stacked 2 per row`, `Carousel` |
| `backgroundColour` | Background Colour | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `White`, `Light Grey` |

### statisticItem

- Name: Statistic Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `statisticsBlock.statistics`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `supportingText` | Supporting Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `supportingTextColour` | Supporting Text Colour | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Grey`, `Orange` |
| `statisticStyle` | Statistic Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Text`, `Icon` |
| `icon` | Icon | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `text` | Text | no | yes | yes | Short text | String, normally <= 255 characters | none |

### statisticsBlock

- Name: Statistics Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `h2`, `h3` |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `style` | Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Statistics`, `Facts` |
| `statistics` | Statistics | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `statisticItem`<br>Size: max 9 |
| `facts` | Facts | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `factItem`<br>Size: max 4 |

### submenuCardItem

- Name: Submenu Card Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `menuContainer.submenuItems`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `description` | Description | no | yes | yes | Long text | Long string | none |
| `image` | Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `featuredCardImage` | Featured Card Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `featuredCardHeading` | Featured Card Heading | no | no | yes | Short text | String, normally <= 255 characters | none |
| `featuredCardDescription` | Featured Card Description | no | no | yes | Short text | String, normally <= 255 characters | none |
| `featuredCardLink` | Featured Card Link | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `hideFeaturedCardImageAccent` | Hide Featured Card Image Accent | no | yes | yes | Boolean | `true` or `false` | none |

### submenuLinksItem

- Name: Submenu Links Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `menuContainer.submenuItems`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `links` | Links | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage`<br>Size: max 10 |

### tabItem

- Name: Tab Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `tabSectionBlock.tabs`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `tabHeading` | Tab Heading | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `tabDefaultIcon` | Tab Default Icon | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `content` | Content | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `productCardBlock`, `richTextBlock`, `fiftyFiftyBlock`, `accordionBlock`, `promoBlock`, `testimonialsBlock`, `logoBlock`, `listBlock`, `stackedCarouselCardBlock`, `notificationBlock`, `tableBlock`, `featureCardBlock`, `statisticsBlock`, `officeListingBlock`, `embedBlock`, `videoBlock`, `timelineBlock`, `aiSearchBlock`, `formContainer`, `gatedContentBlock`, `insightsResourcesBlock` |

### tableBlock

- Name: Table Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `eyebrowText` | Eyebrow Text | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `tableContent` | Table Content | no | yes | yes | Rich text | Contentful Rich Text document | Rich text marks: `bold`, `italic`, `underline`<br>Rich text nodes: `hyperlink`, `table` |
| `callToAction` | Call To Action | no | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `ctaItem`, `homePage`, `contentPage`, `resourcePage`, `listingPage`, `searchPage` |
| `backgroundColour` | Background Colour | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `White`, `Light Grey` |

### tabSectionBlock

- Name: Tab Section Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `description` | Description | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `tabs` | Tabs | no | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `tabItem`<br>Size: max 4 |

### taxonomyBlock

- Name: Taxonomy Block
- Display field: `internalName`
- Importer mapped target: no
- Description: An empty content type used in rich text to add taxonomy, used for subprocesses and partner pages

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `Taxonomy Block`<br>Unique |

### testimonialItem

- Name: Testimonial Item
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `testimonialsBlock.testimonials`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `tagline` | Tagline | yes | yes | yes | Short text | String, normally <= 255 characters | none |
| `quote` | Quote | yes | yes | yes | Long text | Long string | none |
| `companyLogo` | Company Logo | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `sourceName` | Source Name | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `sourceJobTitle` | Source Job Title | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `image` | Image | no | no | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `imageWithFocalPoint` |
| `hideImageAccent` | Hide Image Accent | no | yes | yes | Boolean | `true` or `false` | none |

### testimonialsBlock

- Name: Testimonials Block
- Display field: `internalName`
- Importer mapped target: yes
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `testimonials` | Testimonials | yes | yes | yes | Component/page link list | Array of Contentful Entry links to allowed targets | Allows links to: `testimonialItem`<br>Size: min 1, max 10 |

### videoBlock

- Name: Video Block
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `contentPage.bodyContentArea`, `gatedContentBlock.gatedContent`, `gatedContentBlock.ungatedContent`, `homePage.bodyContentArea`, `listingPage.bodyContentArea`, `resourcePage.fullWidthContentArea`, `searchPage.bodyContentArea`, `tabItem.content`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `heading` | Heading | no | yes | yes | Short text | String, normally <= 255 characters | none |
| `headingStyle` | Heading Style | no | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `H2`, `H3` |
| `video` | Video | yes | yes | yes | Component/page link | Contentful Entry link to an allowed target | Allows links to: `videoItem` |

### videoItem

- Name: Video Item
- Display field: `internalName`
- Importer mapped target: no
- Referenced by: `videoBlock.video`

| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `internalName` | Internal Name | yes | no | yes | Short text | String, normally <= 255 characters | none |
| `videoType` | Video Type | yes | yes | yes | Dropdown / fixed choice | One of the allowed values | Allowed values: `CMS Video`, `Bynder Video`, `Embedded Video` |
| `cmsVideo` | CMS Video | no | yes | yes | Asset link | Contentful Asset link | Asset mimetype groups: `video` |
| `bynderVideo` | Bynder Video | no | yes | yes | Structured object | JSON object | none |
| `embeddedVideo` | Embedded Video | no | yes | yes | Short text | String, normally <= 255 characters | Regexp: `^(ftp\|http\|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/\|\/([\w#!:.?+=&%@!\-/]))?$` |
| `caption` | Caption | no | yes | yes | Short text | String, normally <= 255 characters | none |

