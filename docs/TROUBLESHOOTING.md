# Troubleshooting

## Invalid Token

Symptoms:

- authentication failures
- `pull:model` fails before any discovery output

Checks:

- verify `CONTENTFUL_MANAGEMENT_TOKEN`
- confirm the token belongs to the correct account and space permissions

## Wrong Space Or Environment

Symptoms:

- missing content types
- validation errors against the wrong model

Checks:

- verify `CONTENTFUL_SPACE_ID`
- verify `CONTENTFUL_ENVIRONMENT_ID`
- rerun `npm run pull:model`

## Unknown Component Marker

Symptoms:

- validation error like `component.unknown`

Fix:

- add a matching component configuration in `config/component-map.example.yml`
- or fix the source document marker

## Content Type Mismatch

Symptoms:

- mapping validation errors such as `mapping.componentContentTypeMissing`

Fix:

- confirm the target content type exists in Contentful
- update the YAML mapping or the model

## Missing Required Field

Symptoms:

- `field.requiredMissing`

Fix:

- supply the missing value in the source document
- add a default or template in the mapping if appropriate
- confirm the field is genuinely required in the model

## Asset Upload Failure

Symptoms:

- upload report shows a failed document
- asset-specific errors during upload

Fix:

- confirm the file exists and is readable
- check the file path in the canonical JSON
- retry the upload after fixing the asset

## Rate Limit Issues

Symptoms:

- intermittent API errors during upload or publish

Fix:

- rerun the import
- keep concurrency conservative
- split large runs into smaller batches if needed

Phase 1 intentionally uses conservative sequencing to reduce this risk.

## Locale Mismatch

Symptoms:

- `locale.unknown`

Fix:

- confirm the locale exists in the target environment
- adjust the source doc locale or create the locale in Contentful

## Missing Tag

Symptoms:

- `tag.missing`
- upload blocked before entry writes begin

Fix:

- create the missing tag in Contentful first
- or remove or rename the tag in the source draft
- rerun `npm run dry-run -- --source ...` before upload

## Unmapped Taxonomy Token

Symptoms:

- `taxonomy.unmappedToken`

Fix:

- add the source taxonomy token to `config/taxonomy-map.yml`
- map it to the approved existing Contentful concept ID
- only enable `taxonomy.attachConcepts: true` after the mapping is complete

## Validation Errors

Symptoms:

- upload or publish blocked before writes

Fix:

- inspect `build/reports/*validation*.json`
- resolve every `error` severity issue
- rerun the blocked command
