# Configuration Guide

The importer is intentionally config-driven. The YAML files in `config/` are the main extension surface for a new project.

This repository now includes both:

- checked-in working config files for the current UAT `contentPage` target
- example files that mirror the same structure

## `conventions.yml`

Purpose:

- define defaults
- define deterministic ID patterns
- define sandbox rules
- define tag conventions
- define CLI defaults

Important keys:

- `defaults.locale`
- `defaults.documentContentType`
- `defaults.defaultParent`
- `naming.parentEntryIdPattern`
- `naming.childEntryIdPattern`
- `naming.assetIdPattern`
- `sandboxes.allowedPrefixes`
- `sandboxes.requireExplicitNonSandbox`
- `tags.createIfMissing`
- `taxonomy.attachConcepts`
- `taxonomy.requireMappings`
- `assets.sharedPlaceholder`

Tag handling note:

- source tags can remain in namespaced authoring form such as `website:test`
- the importer normalizes those values into Contentful-safe tag IDs such as `website-test`
- `tags.createIfMissing: false` is now the safe default
- when `tags.createIfMissing` is `false`, dry-run and upload fail if a referenced tag does not already exist in the target environment

Taxonomy handling note:

- `taxonomy.attachConcepts: false` is the current safe default until you have approved real concept IDs
- `taxonomy.requireMappings: true` means every source taxonomy token must be present in `taxonomy-map.yml`
- source taxonomy tokens are still preserved in canonical JSON for review
- only enable taxonomy attachment once you have verified the real Contentful taxonomy concept IDs for the target space
- the importer never creates taxonomy concepts during upload; it only attaches mapped existing concept IDs

Default parent note:

- set `defaults.defaultParent.enabled: true` and `entryId` when every document without frontmatter `parent` should link to the same existing page
- per run, prefer `--default-parent-entry-id <entry-id>` for migration batches where the default is temporary
- explicit frontmatter `parent` always wins over the configured or flagged default

Placeholder asset note:

- `assets.sharedPlaceholder` defines the reusable asset ID and local file used by placeholder mode
- `--use-placeholder-asset` enables it for missing local asset files during `dry-run` and `upload`
- pass `--placeholder-for-all-assets` or `--placeholder-asset-mode all` when every mapped asset should reuse the placeholder, even if the original file exists
- `--placeholder-asset-id` and `--placeholder-asset-path` can override the configured placeholder for a single run

Example:

```yaml
defaults:
  defaultParent:
    enabled: false
    entryId: contentPage--default-parent

naming:
  parentEntryIdPattern: "{{contentType}}--{{slug}}"
  childEntryIdPattern: "{{parentId}}--{{componentSlug}}--{{index}}"
  assetIdPattern: "asset--{{documentSlug}}--{{basename}}"

assets:
  sharedPlaceholder:
    enabled: false
    mode: missing-only
    assetId: asset--import-placeholder
    sourcePath: source/assets/uat-placeholder.svg
```

## `component-map.yml`

Purpose:

- define the target document content type
- define top-level field mappings
- define per-component target content types
- define child entry field mappings

Special component keys used by the mapper:

- `richText`
- `asset`

Each field mapping can use:

- `source`
- `template`
- `default`
- `transform`
- `required`

Top-level fields can also use:

- `strategy: blockReferences`

The current working map targets the real UAT content model:

- parent entry: `contentPage`
- rich text child: `richTextBlock`
- promo child: `promoBlock`
- notification child: `notificationBlock`

Example:

```yaml
document:
  targetContentType: contentPage
  fields:
    heading:
      source: metadata.title
    bodyContentArea:
      strategy: blockReferences
```

## `taxonomy-map.yml`

Purpose:

- convert source taxonomy tokens into Contentful taxonomy concept IDs
- act as an approved allow-list for taxonomy attachments

Example:

```yaml
concepts:
  topic:company:
    conceptId: real-contentful-concept-id
```

Recommended workflow:

1. Run `npm run pull:taxonomy`.
2. Run `npm run sync:taxonomy-map -- --write`.
3. Review the generated `taxonomy-map.yml` and adjust any desired token aliases.
4. Keep source drafts using friendly tokens such as `topic:accounts-payable`.
5. Run `npm run validate:config`.
6. Set `taxonomy.attachConcepts: true` only after the map is complete.

Notes about generated tokens:

- the generator uses the real scheme membership from the taxonomy snapshot
- it scopes to the schemes allowed by the current target content type unless you override that
- token prefixes are derived from scheme IDs, for example `topics` -> `topic`, `industries` -> `industry`
- token suffixes are derived from concept labels, with concept IDs used as a collision fallback

## Runtime Import Flags

The same migration convenience flags are available on `dry-run` and `upload`:

```bash
npm run dry-run -- --source source/docs --default-parent-entry-id <entry-id> --use-placeholder-asset
npm run upload -- --source source/docs --default-parent-entry-id <entry-id> --use-placeholder-asset
```

- `--default-parent-entry-id <entry-id>` fills missing `contentPage.parent` values.
- `--use-placeholder-asset` reuses the configured placeholder for missing local asset files.
- `--placeholder-asset-id <asset-id>` and `--placeholder-asset-path <path>` override the configured placeholder.
- `--placeholder-for-all-assets` makes all mapped assets use the placeholder for that run.

## Current Phase-1 Constraints

The current `contentPage` mapping now supports structured hero, CTA, statistics, carousel, testimonial, logo, and FAQ blocks through nested entry generation.

The main remaining constraints are:

- standalone markdown image body blocks are still out of scope
- arbitrary `.docx` layout parsing is still out of scope
- richer rich text conversion is still intentionally conservative
- unsupported component markers still fail fast by design

## Adding A New Component

1. Add the pseudo-component marker to your source document format.
2. Add a new component entry in `component-map.example.yml`.
3. Point it at the correct target content type.
4. Define field mappings from `block.props.*`.
5. Run `npm run validate:config`.
6. Run `npm run parse -- --source ...`.
7. Run `npm run dry-run -- --source ...`.

## Field Source Expressions

Supported sources include:

- `metadata.title`
- `metadata.slug`
- `metadata.tags`
- `block.props.headline`
- `block.body`
- `block.alt`
- `linkedAsset`

## Templates

Templates interpolate values using `{{token}}` syntax.

Common variables:

- `{{parentId}}`
- `{{componentSlug}}`
- `{{index}}`
- `{{metadata.title}}`
- `{{target.entryId}}`

## Validation Expectations

The live config validator checks that:

- target content types exist
- mapped fields exist
- required fields can be satisfied
- reference constraints are compatible where the model exposes them
- mapped taxonomy concept IDs exist in the live organization taxonomy when `CONTENTFUL_ORG_ID` is configured

If you rename fields or content types in Contentful, rerun `pull:model` and `validate:config` before uploading.
