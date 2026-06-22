# Testing Guide

## Local Fixture Test

Run the fixture workflow first:

```bash
npm install
npm run typecheck
npm run parse -- --source src/fixtures
npm run validate:config -- --offline
npm run report
```

This verifies:

- TypeScript compiles
- the parser works
- canonical JSON is produced
- reports and state files are written

## Inspecting Canonical JSON

After parsing, inspect:

- `build/normalized/`
- `build/reports/parse-report.json`
- `build/state/`

## Live Model Validation

With Contentful credentials configured:

```bash
npm run pull:model
npm run validate:config
```

This confirms the YAML mappings line up with the real content model.

## Dry-Run Testing

```bash
npm run dry-run -- --source source/docs
```

Inspect:

- `build/reports/dry-run-report.json`
- `build/reports/dry-run-report.md`

Confirm:

- intended creates versus updates
- no validation errors
- deterministic IDs look correct
- all referenced tags already exist in Contentful
- any taxonomy tokens resolve through `config/taxonomy-map.yml`

## Draft Upload Testing

```bash
npm run upload -- --source source/docs
```

Then verify in Contentful:

- child entries exist
- parent entries reference them in order
- assets were created or updated
- tags were attached
- taxonomy concepts were attached only if `taxonomy.attachConcepts: true`
- entries remain draft unless you publish

## Publish Testing

Only after sandbox review:

```bash
npm run publish -- --source source/docs --yes
```

## Rerun Test

Run the same upload twice.

Expected result:

- second run should update existing deterministic IDs
- no duplicates should appear

## Failure-Case Tests

Try these intentionally:

- remove a required field value from a fixture
- use an unknown component marker
- reference a missing asset file
- map a component field to a non-existent Contentful field
- change the environment to a non-sandbox value without `--allow-non-sandbox`
- reference a tag that does not already exist in Contentful
- use a taxonomy token that is missing from `config/taxonomy-map.yml`

Each case should fail clearly and produce a useful report.
