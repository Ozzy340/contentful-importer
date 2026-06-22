# Content Import

`content-import` is a production-minded, phase-1-safe Contentful bulk importer for structured content that originates in Word-style documents with embedded pseudo-code component markers.

The importer does not use `contentful space import` as the main content upload path. Instead it:

1. Discovers the live Contentful model and environment metadata.
2. Parses source documents into a canonical JSON format.
3. Maps pseudo-components to existing Contentful content types and fields through YAML configuration.
4. Upserts entries and assets through the official Contentful Content Management API using deterministic IDs.
5. Produces reports and state files so operators can review each stage before publishing.

The Contentful CLI remains part of the workflow for model export, migrations, environment management, and optional taxonomy import or export.

## System Overview

- Primary write path: Contentful Management API via `contentful-management`
- CLI-assisted operations: model export, migrations, sandbox creation, optional taxonomy export or import
- Phase-1 parser: structured markdown that mirrors Word-style source documents
- Safety defaults: sandbox-first, draft-first, dry-run available, publish disabled unless explicitly requested
- Rerun strategy: deterministic entry IDs and asset IDs so repeated imports update instead of duplicate

## Repo Structure

```text
config/                  YAML config for conventions, component mappings, taxonomy mappings
exports/                 CLI and SDK model snapshot output
source/docs/             Operator-managed source documents
source/assets/           Operator-managed source assets
build/normalized/        Canonical JSON generated from source docs
build/reports/           Validation, dry-run, upload, and publish reports
build/state/             Run state files for traceability and reruns
docs/                    Architecture and operating documentation
src/cli/                 Entry-point commands
src/lib/                 Core importer modules
src/fixtures/            Sample documents and canonical examples
```

The repository root is the project root. The original requested `/content-import` wrapper directory was collapsed into the repo root so the package can be cloned and run directly.

## Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in the required Contentful values.
4. Review and adapt:
   - `config/conventions.yml`
   - `config/component-map.yml`
   - `config/taxonomy-map.yml`
   - use the `*.example.yml` files as reference copies
5. Point the importer at a sandbox environment before any write or publish operation.

## Quick Start

Run the fixture-based parse flow first. This does not require Contentful credentials.

```bash
npm run typecheck
npm run parse -- --source src/fixtures
npm run validate:config -- --offline
npm run report
```

Once a sandbox environment is configured:

```bash
npm run pull:model
npm run pull:taxonomy
npm run sync:taxonomy-map -- --write
npm run validate:config
npm run dry-run -- --source source/docs
npm run upload -- --source source/docs
npm run publish -- --source source/docs --yes
```

## Example Workflow

1. Export a model snapshot from the target environment.
2. Export a taxonomy snapshot from the target organization.
3. Create or target a sandbox environment.
4. Update the YAML mappings to match the live model.
5. Parse source docs into canonical JSON.
6. Run a dry-run and inspect the reports.
7. Upload draft entries and assets into the sandbox.
8. Review entries in Contentful.
9. Publish explicitly only after approval.

## Commands

- `npm run pull:model`
  Pulls a live discovery snapshot through the SDK and attempts a CLI model export.
- `npm run pull:taxonomy`
  Pulls a live taxonomy snapshot through the SDK using `CONTENTFUL_ORG_ID`.
- `npm run sync:taxonomy-map -- --write`
  Generates `config/taxonomy-map.yml` from the latest taxonomy snapshot. By default it scopes to the taxonomy schemes allowed by the current target content type.
- `npm run create:sandbox -- --name sandbox-20260414 --source master`
  Creates a sandbox environment with CLI-first behavior and an SDK fallback.
- `npm run parse -- --source src/fixtures`
  Parses source docs and writes canonical JSON.
- `npm run validate:config`
  Validates mappings against the live Contentful model.
- `npm run validate:config -- --offline`
  Performs local-only config validation.
- `npm run dry-run -- --source source/docs`
  Resolves create versus update actions without writing to Contentful.
- `npm run upload -- --source source/docs`
  Uploads assets and upserts entries as drafts.
- `npm run clone:entity -- --env uat --entry-id <entry-id> --name "New Page Name"`
  Dry-runs a same-environment clone of one entry, its nested non-page entry children, and linked assets. The new name is used for the root ID/name, child IDs/names, asset IDs/titles, and root slug fields. Page-like entry links and external ResourceLinks are removed from the clone and reported.
- `npm run clone:entity -- --env uat --entry-id <entry-id> --name "New Page Name" --create`
  Creates the cloned entries and assets as drafts in the same environment. The command refuses to overwrite any existing generated entry or asset ID.
- `npm run dry-run -- --source source/docs --default-parent-entry-id <entry-id> --use-placeholder-asset`
  Fills missing page parent links with the supplied existing entry and reuses the configured placeholder asset for missing local asset files. The same flags are supported by `npm run upload`.
- `npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production`
  Dry-runs a UAT-to-production promotion for one published entry and all local entry/asset dependencies.
- `npm run promote:content -- --entry-ids <entry-id-1>,<entry-id-2> --source-env uat --target-env production --yes`
  Copies assets first, then dependent entries, then root entries into the target environment and publishes everything. The command fails by default if target IDs or `slug` values would collide.
- `npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --include-drafts --yes`
  Copies the latest UAT versions, including draft-only entries/assets and unpublished changes, into the target environment without publishing the copied content.
- `npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies`
  Dry-runs a promotion that reuses existing published production dependencies instead of overwriting them. Root page ID collisions still fail.
  Linked page-like dependencies are treated as reference-only links: clean published target pages are reused, while missing, unpublished, archived, or dirty target page links are removed from the copied fields and reported as warnings.
- `npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies --allow-dirty-target-reuse`
  Allows reused production dependencies, including page-like reference links, that are published but have unpublished changes. The promotion links to the currently published production version and reports a warning.
- `npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies --overwrite-unpublished-target-dependencies`
  For existing production dependencies that are draft-only, copies the UAT dependency over that target ID and publishes it instead of trying to reuse an unpublished target version.
- `npm run delete:run -- --state build/state/upload-<timestamp>.json`
  Previews deletion of entries and assets recorded by an upload run state. Add `--yes` to delete after review.
- `npm run publish -- --source source/docs --yes`
  Publishes assets and entries after validation and manual approval.
- `npm run search:export -- --env uat --query resource-pages-with-form-id`
  Exports a CSV of `resourcePage` entries where `formId` is populated. The export includes entry ID, content type, internal name, slug, form ID, and the locales where `formId` is set. Add `--locale en-US` to match and export values for one locale only, or `--output exports/resource-pages-with-form-id.csv` to choose the output path.
- `npm run search:export -- --env uat --query core-pages-with-forms`
  Exports a CSV of core page entries (`contentPage`, `resourcePage`, `homePage`, `listingPage`, and `searchPage`) whose component children ultimately link to a `form` entry. The export includes entry ID, content type, Contentful interface URL, slug, form entity names, and one dynamic column per discovered tag group. Multiple tags in the same group are separated with `|`.
- `npm run search:export -- --env uat --query rich-text-blocks-with-en-links`
  Exports a CSV of `richTextBlock` entries whose `content` rich text contains hyperlinks with `/en/` paths, plus the core parent page that references each block. Columns include rich text entry ID/link/name, parent page ID/type/link/name/slug, and the full matched `/en/` link.
- `npm run search:export -- --env uat --query link-fields-with-en-links`
  Exports a CSV of supported rich text hyperlink fields and external URL fields that contain `/en/` paths. The export includes entity ID/link/name, content type, field, parent page ID/type/link/name/slug where a parent page can be found, and the full matched `/en/` link. Excludes `formField`, `embedBlock`, `languageOption`, and `socialItem`.
- `npm run search:export -- --list-queries`
  Lists the available advanced search export queries.
- `npm run resource-forms:fill-ids -- --env master`
  Reads `source/search files/resource_form_urls.csv`, looks up each platform slug across `resourcePage` and `contentPage`, and fills blank `Contentful Entity ID` cells. Add `--dry-run` to preview, `--overwrite` to replace existing IDs, or `--input`/`--output` to use another CSV path.
- `npm run amend:en-links -- --env master --start-row 1 --limit 2`
  Dry-runs link amendments from `source/amendments/en_links_with_redirect_matches.csv`, or another CSV supplied with `--input`. The amendment CSV can use either the original rich text columns or the newer `Entity ID`/`Content Type`/`Field` columns from `link-fields-with-en-links`. Row numbers are data rows, so `--start-row 1 --limit 2` processes the first two rows after the header. The script skips `full /en/ link` values containing `https://`, picks `Replacement link` as an internal target when present, otherwise picks `quadient.com` as the external replacement with `mail.quadient.com` as fallback, runs an internal page slug check across `listingPage`, `searchPage`, `resourcePage`, `homePage`, and `contentPage`, and writes markdown/json reports to `build/reports/`.
- `npm run amend:en-links -- --env master --fix-internal`
  Also converts matching `/en/...` rich text URL hyperlinks into internal Contentful entry hyperlinks when the slug maps to exactly one page entry. Ambiguous slug matches are left unchanged and reported. Plain URL string fields still run the internal slug check; if a matching internal page exists, the report records it, and the script falls back to the external replacement when one is available.
- `npm run amend:en-links -- --env master --start-row 1 --limit 2 --yes --allow-non-sandbox`
  Applies the selected amendments, including entries that already have unpublished changes. The Contentful SDK request throttle defaults to 25 requests per second; override with `--throttle <1-30>`. Publishing runs once at the end by parent page group, publishing each affected page with references through a bulk publish action. Publish groups start at most once every 5 seconds by default; override with `--publish-interval-ms <milliseconds>` or change reference depth with `--publish-include-depth <1-10>`. Add `--no-publish` to leave updated entries as drafts.
- `npm run amend:404-links -- --env master --input source/amendments/404-links-with-replacements.csv`
  Dry-runs 404 link amendments from a crawl-style CSV with `Source`, `Destination`, and `Replacement link` columns. The script resolves each `Source` URL to a Contentful page, searches that page and its referenced entries for the `Destination`, records destinations that are already internal Contentful links, and converts fixable rich text/CTA URL matches to internal page references using `Replacement link`. Use `--start-row`, `--limit`, `--reference-include-depth`, and `--throttle` to tune the run; add `--yes --allow-non-sandbox` to apply.
- `npm run tags:add -- --env uat --group "Journey Stage" --tag "Decision" --yes`
  Creates a public grouped tag with a generated ID such as `journey-stage-decision`. Omit `--yes` to preview only.
- `npm run form-tags -- --env uat`
  Reads `source/tag documents/Form_Tag_Data.csv`, maps the configured form columns into grouped Contentful tags, checks the target `resourcePage` entries from `contentful-entryId`, and writes a markdown/json dry-run report to `build/reports/`. The report lists every tag that would be created, every entry, and each tag that would be added. Long generated tag IDs are hash-truncated to stay within Contentful's 64-character resource ID limit while preserving the full `Group: Tag` display name.
- `npm run form-tags -- --env uat --yes`
  Creates any missing public grouped tags and adds them to the target entries as Contentful metadata tags. Use `--allow-non-sandbox` for production-like environments after validating the dry-run report. Optional flags include `--input <csv>`, `--content-type <type>`, and `--update-existing-name`.
- `npm run form-tags -- --env uat --row 3`
  Limits the dry-run or upload to one CSV row. Row numbers match the report and include the header as row 1. You can also use `--entry-id <contentful-entryId>` to target one Contentful entry directly.
- `npm run amend:form-tags -- --env uat`
  Reads `source/tag documents/Form_Tag_Data_output_only.csv` and treats the columns after `formEntityNames` as the desired Contentful tag groups for each listed page, excluding `Form Type`. The dry-run report shows existing managed tags, desired tags, tags to add, tags to remove, and group-level replacements while preserving unrelated tags. Add `--yes` to apply, `--row <csv-row>` or `--entry-id <id>` to test one page, or `--no-create-tags` to fail when a desired tag does not already exist.
- `npm run form-tags:migrate-form-name -- --env uat`
  Dry-runs the migration from old `Form name: ...` tags to the corrected `Form Name: ...` tag group. Where the tag ID is unchanged, the tag is renamed in place; if a correctly named tag already exists under another ID, the report lists entry/asset metadata tag references that would be swapped before the old tag is deleted. Add `--yes` to apply, and `--allow-non-sandbox` for production-like environments after reviewing the report.
- `npm run sync:jobs -- --env uat`
  Pulls active jobs from SmartRecruiters company `Quadient1`, reads the job page template from `master/4bXLshsUozuOaCY9SvfJnc`, and writes a dry-run report showing job pages to create, update, publish, or archive, plus any taxonomy schemes/concepts that would be added. The `--env` value is the target environment for job pages; `--template-env` / `SMARTRECRUITERS_TEMPLATE_ENVIRONMENT_ID` only controls where the source template is read from.
- `npm run sync:jobs -- --env uat --yes`
  Syncs SmartRecruiters jobs into Contentful `resourcePage` entries, creates or updates required job taxonomies, publishes active job pages and their managed subentries, and archives managed job pages no longer returned by the API. Use `--allow-non-sandbox` for production-like environments after validating the dry-run report. Required env includes `SMARTRECRUITERS_TOKEN`; optional flags include `--company-id`, `--env`, `--template-env`, `--template-entry-id`, `--parent-entry-id`, `--hero-image-entry-id`, `--slug-prefix`, `--managed-entry-prefix`, and `--limit`. The target env can also be supplied as `SMARTRECRUITERS_TARGET_ENVIRONMENT_ID` or, as a global fallback, `CONTENTFUL_ENVIRONMENT_ID`. Parent/image settings can also be supplied through `SMARTRECRUITERS_UAT_PARENT_ENTRY_ID`, `SMARTRECRUITERS_UAT_IMAGE_ENTRY_ID`, `SMARTRECRUITERS_MASTER_PARENT_ENTRY_ID`, and `SMARTRECRUITERS_MASTER_IMAGE_ENTRY_ID`.
- `npm run report`
  Summarises the latest run state.

## Safety Notes

- Non-sandbox environments are blocked unless `--allow-non-sandbox` is explicitly supplied.
- Upload does not publish by default.
- Entity clone is dry-run-only unless `--create` is supplied. Create mode leaves cloned entries and assets in draft, blocks generated ID collisions, and requires `--allow-non-sandbox` for non-sandbox environments.
- `--default-parent-entry-id` only fills documents that do not already define frontmatter `parent`.
- `--use-placeholder-asset` uses `assets.sharedPlaceholder` for missing local asset files. Add `--placeholder-for-all-assets` only when every mapped asset should point at the shared placeholder for that run.
- Publish requires `--yes`.
- Content promotion is dry-run-only unless `--yes` is supplied, requires an explicit target environment, and refuses to overwrite existing target IDs unless `--allow-overwrite` is supplied. Use `--include-drafts` when latest UAT draft/unpublished versions should be copied and left unpublished in the target; it implies `--allow-source-drafts`. Use `--reuse-existing-dependencies` to link to clean published production dependencies while still blocking root page collisions. Add `--allow-dirty-target-reuse` only when reusing the currently published version of a production dependency with unpublished changes is intentional. Add `--overwrite-unpublished-target-dependencies` only when an existing draft-only production dependency should be replaced from UAT and published. Linked page-like dependencies are boundary links and are not recursively promoted unless supplied as root entries.
- Delete by run is preview-only by default and requires `--yes`.
- Tag creation is preview-only by default and requires `--yes`.
- SmartRecruiters job sync is preview-only by default and requires `--yes`; upload mode publishes active jobs and archives managed job entries missing from the API.
- Tags are linked by ID and are not created by default during upload.
- Taxonomy concept attachment is disabled by default until validated against the target space.
- The safest resume strategy is to fix the input or mapping and rerun the import. Deterministic IDs prevent duplication.

## Sample Inputs And Outputs

- Sample docs: `src/fixtures/sample-doc-1.md`, `sample-doc-2.md`, `sample-doc-3.md`
- Sample canonical output: `src/fixtures/sample-canonical.json`
- Generated canonical example: `build/normalized/example-sample-doc-1.canonical.json`
- Example validation report: `build/reports/example-validation-report.json`
- Example run state: `build/state/example-run-state.json`
- Generated canonical output: `build/normalized/`
- Generated reports: `build/reports/`
- Generated state files: `build/state/`

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contentful Setup](docs/CONTENTFUL_SETUP.md)
- [Configuration Guide](docs/CONFIGURATION_GUIDE.md)
- [Component List](docs/COMPONENT_LIST.md)
- [Content Team Draft Guide](docs/CONTENT_TEAM_DRAFT_GUIDE.md)
- [Content Page Draft Template](docs/CONTENT_PAGE_DRAFT_TEMPLATE.md)
- [Source Document Guide](docs/SOURCE_DOCUMENT_GUIDE.md)
- [Mapping Guide](docs/MAPPING_GUIDE.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Decisions](docs/DECISIONS.md)
