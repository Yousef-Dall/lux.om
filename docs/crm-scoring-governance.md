# CRM scoring governance

Stage 21I-Y exposes the existing deterministic CRM scoring foundation as a dedicated operational workspace at `/crm/settings/scoring`.

## Supported operations

- Browse current lead scores with server-side search, score-band filters, archive-state filters, sorting, and pagination.
- Review the latest explainable reasons, source signals, scoring version, trend, and immutable score history for an individual lead.
- Recalculate all scores in a workspace through the existing workspace-configuration permission boundary.
- Supply an explicit scoring version for controlled model/version rollouts.
- Preserve historical snapshots when a score, reason set, signal set, or scoring version changes.

## Governance rules

- The UI does not expose editable scoring weights or rules because the production API does not support rule authoring.
- Score snapshots are immutable database evidence and cannot be rewritten after creation.
- Recalculation requires workspace-management access; property-scoped viewers can only inspect leads within their property scope.
- A manual recalculation uses a unique job key and returns the number of leads evaluated and snapshots created.
- The scoring register reports the backend's current deterministic scoring version and flags records that have never been calculated or use a different version.
- Archived leads remain reviewable through the explicit archived/all filters and retain their scoring evidence.

## Scope boundaries

This batch does not add editable scoring rules, machine-learning model training, schema changes, migrations, backfills, or contract regeneration. Communication consent, suppression, templates, and delivery policy remain under the separate communication-governance surface.
