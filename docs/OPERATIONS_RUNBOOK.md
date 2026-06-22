# Operations Runbook

## Recommended Workflow

1. Confirm `.env` points at the correct space and sandbox environment.
2. Pull the live model snapshot.
3. Review or update YAML mappings.
4. Parse source documents.
5. Review canonical JSON and the parse report.
6. Run a dry-run.
7. Review create versus update decisions.
8. Upload drafts.
9. Review results in Contentful.
10. Publish only if approved.

## Preflight Checks

- correct `CONTENTFUL_SPACE_ID`
- correct `CONTENTFUL_ENVIRONMENT_ID`
- sandbox environment confirmed
- mapping files reviewed
- assets present on disk
- no unresolved pseudo-components in the source

## Migration Checklist

- export the current model
- apply migrations through the CLI
- export the model again
- rerun `validate:config`
- only then proceed to dry-run and upload

## Promoting Existing UAT Content To Production

Use `promote:content` when content already exists in UAT and needs to be copied, with its local dependencies, into production.

Dry-run first:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production
```

Promote after the dry-run report is clean:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --yes
```

Promote the latest UAT versions as target drafts, including draft-only source content and unpublished source changes:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --include-drafts --yes
```

Reuse existing production dependencies without overwriting them:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies --yes
```

If a reused production dependency, including a page-like reference link, is already published but has unpublished changes, explicitly allow linking to its currently published production version:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies --allow-dirty-target-reuse
```

If a reused production dependency is draft-only in production, explicitly allow replacing it from UAT and publishing it:

```bash
npm run promote:content -- --entry-id <entry-id> --source-env uat --target-env production --reuse-existing-dependencies --overwrite-unpublished-target-dependencies
```

For multiple roots, pass a comma-separated list or a newline-separated file:

```bash
npm run promote:content -- --entry-ids <entry-id-1>,<entry-id-2> --source-env uat --target-env production
npm run promote:content -- --ids-file ./promotion-entry-ids.txt --source-env uat --target-env production
```

The preflight checks:

- every source entry and asset is published and has no unpublished changes
- with `--include-drafts` or `--allow-source-drafts`, source draft-only content and unpublished source changes are allowed
- every referenced local entry and asset exists in UAT
- linked page-like dependencies are treated as reference-only boundary links rather than recursively promoted
- production has the required content types, locales, and tags
- production does not already contain the same entry or asset IDs
- production does not already contain the same `slug` values on any content type with a `slug` field
- dependent entries can be ordered so children publish before parents
- reused production dependencies are published, unarchived, and have no unpublished changes unless `--allow-dirty-target-reuse` is supplied
- draft-only production dependencies are not reused; with `--overwrite-unpublished-target-dependencies`, they are copied from UAT and published unless `--include-drafts` is also supplied

Reports are written to `build/reports/content-promotion-<mode>-<timestamp>.json` and `.md`. Use `--allow-overwrite` only for an intentional replacement of matching production IDs; use `--include-drafts` when latest UAT draft/unpublished versions should be copied and left unpublished in the target. `--include-drafts` implies `--allow-source-drafts`; `--allow-source-drafts` by itself only relaxes source validation and still publishes copied content. Use `--reuse-existing-dependencies` when existing production dependency IDs should be linked as-is. Root page collisions and slug collisions with other production entries still fail. Use `--allow-dirty-target-reuse` for reused target dependencies that have unpublished changes but already have a published production version. Use `--overwrite-unpublished-target-dependencies` for draft-only target dependencies that should be copied from UAT and published. For linked page-like dependencies, clean published target pages are reused; missing, unpublished, or archived target pages are removed from copied fields and reported as skipped-link warnings.

## Publishing Existing Pages With References

Use `publish:pages` when existing Contentful pages, or entries/assets referenced by pages, need to be published in-place with their references. The command reads CSV, TSV, TXT, or XLSX files from `source/publishing` by default and writes a timestamped JSON and Markdown report for every run.

Dry-run first:

```bash
npm run publish:pages -- --env master
```

Publish after the dry-run report is clean:

```bash
npm run publish:pages -- --env master --yes --allow-non-sandbox
```

If an input ID is not a page content type, the command walks incoming references until it finds the page or pages that reference it, then publishes those parent pages with references. The default page types are the known core page content types plus any content type ID ending in `Page`. Bulk publish actions are rate-limited to one page group every 10 seconds by default. Adjust only when needed:

```bash
npm run publish:pages -- --input "source/publishing/entities to publish 15-6-26 10-49.xlsx" --publish-interval-ms 10000
```

Reports are written to `build/reports/page-publishing-<mode>-<environment>-<timestamp>.json` and `.md`. The report includes source-row resolution, parent-page lookup paths, candidate entries/assets, skipped archived references, and the bulk action result for apply runs.

## Rollback Principles

Phase 1 avoids automated destructive rollback.

Use these principles instead:

- stop the pipeline when validation fails
- inspect run state files before rerunning
- fix config or source input rather than patching imported data blindly
- keep sandbox testing separate from production cutover
- use environment cloning or aliases for broader rollout plans

## When Mapping Fails

1. open the latest validation report
2. identify the failing component or field
3. compare the YAML mapping with the live content type
4. rerun `validate:config`
5. rerun `dry-run`

## When Asset Upload Fails

1. confirm the file path exists
2. confirm the file type is supported by your Contentful setup
3. inspect the upload report and run state
4. rerun the upload after fixing the source asset

## When Partial Uploads Occur

1. inspect `build/state/<run>.json`
2. identify which documents completed and which failed
3. fix the root cause
4. rerun the import

Deterministic IDs allow safe reruns without creating duplicate entries.
