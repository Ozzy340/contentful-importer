# Decisions

## Why Use The CMA SDK For Import Instead Of CLI Space Import

The SDK gives the importer control over:

- deterministic IDs
- idempotent upserts
- child-before-parent orchestration
- draft-first behavior
- document-level state tracking
- clear dry-run reporting

`contentful space import` is powerful, but it is not the right main write path for a source-driven, rerunnable importer that needs fine-grained safety controls.

## Why Keep The CLI In The Workflow

The CLI is still valuable for:

- model snapshots
- migrations
- environment creation and cloning
- optional taxonomy workflows

This is a deliberate hybrid design rather than a pure SDK-only system.

## Why Mapping Is Config-Driven

The content model already exists in the target space. A config-driven layer lets the team:

- adapt without rewriting the importer
- add new pseudo-components safely
- validate model drift explicitly

## Why Deterministic IDs Are Required

Without deterministic IDs, reruns would create duplicates and make partial recovery much harder.

Deterministic IDs enable:

- safe reruns
- create versus update visibility
- easier debugging in Contentful
- better traceability in state files

## Why A Canonical Intermediate Schema Exists

The canonical schema separates:

- parsing concerns
- content mapping concerns
- Contentful write concerns

This makes the system easier to test, easier to extend, and easier to reason about when a run fails.

## Why Sandbox-First Testing Is Used

Phase 1 is intentionally conservative.

Sandbox-first testing reduces the risk of:

- accidental production writes
- premature publishing
- model mismatches discovered too late
- operator uncertainty during first migrations
