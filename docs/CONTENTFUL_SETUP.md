# Contentful Setup

## Required Credentials

Set the following environment variables in `.env`:

- `CONTENTFUL_MANAGEMENT_TOKEN`
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ENVIRONMENT_ID`
- `CONTENTFUL_ORG_ID`
  Only needed if you later add taxonomy CLI workflows that require organisation-level access.
- `CONTENTFUL_SOURCE_SPACE_ID`
  Optional for content promotion. Defaults to `CONTENTFUL_SPACE_ID`.
- `CONTENTFUL_SOURCE_ENVIRONMENT_ID`
  Optional for content promotion. Defaults to `CONTENTFUL_ENVIRONMENT_ID`.
- `CONTENTFUL_TARGET_SPACE_ID`
  Optional for content promotion. Defaults to `CONTENTFUL_SPACE_ID`.
- `CONTENTFUL_TARGET_ENVIRONMENT_ID`
  Required for content promotion unless `--target-env` is passed.
- `CONTENTFUL_CLI_BIN`
  Optional. Defaults to `contentful`.

The management token needs enough permissions to:

- read content types, locales, tags, environments, entries, and assets
- create and update entries
- create and update assets
- publish content if the publish command will be used
- create environments if sandbox creation will be used
- read from the source environment and create/update/publish entries and assets in the target environment if content promotion will be used

## Installing The Contentful CLI

The importer itself uses the SDK for the content write path. The CLI is still recommended for:

- model export
- migrations
- environment management
- optional taxonomy import or export

Install it globally or expose it through `npx`, then set `CONTENTFUL_CLI_BIN` if needed.

## Exporting The Model

The recommended command path is:

```bash
npm run pull:model
```

What it does:

- always writes an SDK discovery snapshot to `exports/model-snapshot-<environment>.json`
- writes a readable markdown summary beside it
- attempts a CLI export using `exports/model-export.config.json`

## Exporting Taxonomy

To validate `taxonomy-map.yml` against the real organization taxonomy, run:

```bash
npm run pull:taxonomy
```

What it does:

- pulls concept schemes and concepts through the Contentful Management SDK
- writes `exports/taxonomy-snapshot-<organization>.json`
- writes a readable markdown summary beside it

To generate a taxonomy map from that snapshot, run:

```bash
npm run sync:taxonomy-map -- --write
```

Behavior:

- uses the latest taxonomy snapshot by default
- infers the taxonomy schemes allowed by the current target content type from `exports/content-model-export.json`
- generates stable source tokens such as `topic:accounts-payable` or `industry:finance`
- preserves existing valid tokens where possible
- overwrites `config/taxonomy-map.yml` only when `--write` is supplied

## Tags And Taxonomy Safety

The importer is now set up so upload should not create metadata by default:

- `tags.createIfMissing: false` means every referenced tag must already exist in Contentful
- taxonomy concepts are never created by upload
- taxonomy attachment only happens when `taxonomy.attachConcepts: true`
- source taxonomy tokens must resolve through `config/taxonomy-map.yml`

Recommended preparation before enabling taxonomy attachment:

1. Confirm which tags already exist in the target environment.
2. Run `npm run pull:taxonomy`.
3. Copy the real Contentful concept IDs into `config/taxonomy-map.yml`.
4. Run `npm run validate:config`.
5. Enable `taxonomy.attachConcepts: true` only after that mapping is complete.

## Creating A Sandbox

Recommended:

```bash
npm run create:sandbox -- --name sandbox-20260414 --source master
```

Behavior:

- tries the Contentful CLI first
- falls back to the SDK if the CLI path fails
- writes a report to `build/reports/`

## Pointing The Importer At An Environment

Set:

```env
CONTENTFUL_ENVIRONMENT_ID=sandbox-import-01
```

The same `.env` file is used by:

- `pull:model`
- `validate:config`
- `dry-run`
- `upload`
- `publish`

## Avoiding Accidental Production Writes

- Keep `CONTENTFUL_ENVIRONMENT_ID` pointed at a sandbox during configuration and testing.
- Use the allowed non-production prefixes configured in `config/conventions.yml`.
- Upload and publish block non-sandbox environments unless `--allow-non-sandbox` is provided.
- Publish also requires `--yes`.

## Migrations

This repository does not embed migration files yet, but the intended flow is:

1. export the current model
2. run Contentful migrations with the CLI
3. rerun `npm run pull:model`
4. rerun `npm run validate:config`
5. only then run `dry-run` or `upload`
