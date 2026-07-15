# CRM pipeline governance

Stage 21I-X moves workspace-level pipeline configuration to the dedicated `/crm/settings/pipelines` route.

## Access model

- CRM viewers may inspect pipeline and stage configuration.
- Pipeline creation, metadata changes, default changes, stage changes, archival, and restoration require workspace-configuration access.
- Property-scoped viewers see pipeline-wide configuration, while lead and deal usage counts remain restricted to their assigned property scope.
- Cross-workspace pipeline reads and mutations are rejected by the backend.

## Pipeline register

The pipeline register is server-driven and supports:

- search across pipeline names, descriptions, and stage names;
- active, archived, and all-state filters;
- name, created-time, and updated-time sorting;
- pagination with active, archived, and default summaries;
- URL persistence for workspace, filters, sort order, and page.

The existing unfiltered `GET /api/crm/pipelines?workspaceId=...` contract remains compatible with deal and lead selectors.

## Creation and defaults

A new pipeline must contain at least one active open, won, and lost stage. The dedicated UI creates a conservative five-stage starting workflow that can be edited after creation.

Only one pipeline may be the workspace default. Making another active pipeline the default atomically removes the previous default. The current default cannot be unset without choosing a replacement, and an archived pipeline cannot become the default.

## Stage integrity

Stage changes remain governed by historical usage:

- a used stage cannot be disabled;
- a used stage classification cannot be changed;
- every pipeline must retain active open, won, and lost stages;
- archived pipelines cannot have their stages edited;
- stage probability, SLA, position, name, required fields, and active state remain validated by the backend.

These rules preserve deal outcomes and immutable stage history.

## Archive and restore

Pipeline archival and restoration are idempotent and require a human-readable reason.

- The default pipeline cannot be archived.
- Archival sets the pipeline inactive and prevents it from being selected for new deals or lead conversions.
- Existing deals, leads, stages, and historical outcomes remain intact.
- Restoration makes the pipeline available again without rewriting historical records.
- Each real lifecycle change creates a completed CRM activity containing the reason and actor; duplicate requests do not create duplicate evidence.

No Prisma schema change, migration, backfill, or generated-client regeneration is required for Stage 21I-X.
