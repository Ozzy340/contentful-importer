# Architecture

## Overview

The importer is organised into five layers:

1. Discovery
2. Normalisation
3. Mapping
4. Upload
5. Validation and publish

The intent is to make every stage inspectable. Operators can stop after any step, review the output, adjust configuration, and rerun safely.

## Discovery Layer

Core files:

- `src/lib/contentful-client.ts`
- `src/lib/contentful-discovery.ts`
- `src/cli/pull-model.ts`

Responsibilities:

- Connect to Contentful using the official management SDK.
- Pull content types, fields, validations, locales, tags, and environments.
- Write a machine-readable discovery snapshot to `exports/`.
- Write a human-readable markdown summary of the live model.
- Attempt a CLI model export for parity with manual migration workflows.

## Normalisation Layer

Core files:

- `src/lib/parser.ts`
- `src/lib/normalizer.ts`
- `src/cli/parse-docs.ts`

Responsibilities:

- Read source documents from markdown or text files.
- Parse frontmatter metadata such as title, slug, locale, tags, and taxonomy markers.
- Parse text blocks, pseudo-component blocks, and asset references while preserving order.
- Convert all source documents into a canonical JSON format.
- Write one canonical JSON file per source document to `build/normalized/`.

Phase 1 deliberately uses a structured markdown parser instead of a `.docx` parser. This keeps the import pipeline testable while preserving a clean parser boundary for a future `.docx` adapter.

## Mapping Layer

Core files:

- `src/lib/mapper.ts`
- `config/component-map.example.yml`
- `config/conventions.example.yml`
- `config/taxonomy-map.example.yml`

Responsibilities:

- Convert canonical blocks into planned Contentful child entries and parent entries.
- Resolve config-driven field mappings instead of hardcoding content type knowledge in code.
- Apply deterministic ID templates for parent entries, child entries, and assets.
- Convert tags and taxonomy concept IDs into Contentful metadata links.
- Support ordered reference composition through a parent field such as `body`.

## Upload Layer

Core files:

- `src/lib/asset-service.ts`
- `src/lib/entry-service.ts`
- `src/cli/dry-run.ts`
- `src/cli/upload.ts`

Responsibilities:

- Decide whether each deterministic ID maps to a create or update.
- Create missing tags if configured.
- Upload or update assets before entries that reference them.
- Create or update child entries before parent entries.
- Write run-state files and reports for each import attempt.

Uploads are draft-first. Phase 1 does not delete content.

## Validation And Publish Layer

Core files:

- `src/lib/validator.ts`
- `src/lib/publish-service.ts`
- `src/cli/validate-config.ts`
- `src/cli/publish.ts`

Responsibilities:

- Validate the canonical documents locally.
- Validate mappings against the live Contentful model.
- Validate required fields, enum constraints, and reference constraints where possible.
- Block publish when validation errors are present.
- Publish assets and child entries before parent entries.

## Data Flow

```text
source docs/assets
  -> parser
  -> canonical JSON
  -> mapping plan
  -> validation report
  -> dry-run report
  -> draft upload
  -> sandbox review
  -> explicit publish
```

## Idempotency Strategy

- Parent IDs derive from content type plus slug.
- Child IDs derive from parent ID plus component key plus ordered index.
- Asset IDs derive from document slug plus asset basename.
- Rerunning the same import updates those same IDs instead of creating duplicates.

## Sandbox-First Enforcement

- `config/conventions.example.yml` declares allowed sandbox prefixes.
- Upload and publish commands block non-sandbox environments unless explicitly overridden.
- Publish requires an explicit confirmation flag.
