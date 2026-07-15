# CRM deal governance

Stage 21I-W makes CRM deals an operational workspace rather than a tab inside the legacy combined operations page.

## Route and access

- Canonical route: `/crm/deals`
- Detail route: `/crm/deals/:dealId`
- All reads and mutations resolve CRM workspace access before returning records.
- Company property-scoped members only receive deals whose `pmsPropertyId` is inside their assigned property scope.
- View-only members can browse records and immutable history, but cannot create, transition, archive, or restore deals.

## Server-side register

`GET /api/crm/deals` supports:

- search across deal, account, contact, pipeline, and stage labels;
- pipeline and stage filters;
- open, won, and lost outcome filters;
- currency filtering without combining currencies;
- active, archived, and all-record states;
- expected-close date range filtering;
- name, expected-close, expected-value, created, and updated sorting;
- bounded server pagination;
- active, archived, open, won, and lost summary counts.

The older `includeArchived` query remains accepted for backward compatibility. New clients should use `status`.

## Creation

A deal must be linked to:

- the selected workspace;
- an account inside the same workspace/property scope;
- an active pipeline;
- an active stage inside that pipeline.

The server continues to derive and enforce property scope from the linked account. Currency remains a three-letter ISO-style code and values are never aggregated across currencies in the UI.

## Stage transitions

All stage changes continue through the existing governed transition endpoint and accessible review dialog.

- Lost transitions require a lost reason.
- Closed deals must reopen through an open stage before changing commercial outcome.
- Reopening requires an audit note.
- Stage-required fields remain server enforced.
- Every accepted transition writes immutable `CrmStageHistory` and a CRM status-change activity.
- Archived deals cannot transition until restored.

## Archive and restore

Archive and restore require a reason of at least three characters.

- Repeating the same requested state is idempotent.
- Only real state changes create an activity.
- Commercial outcome, stage history, values, and linked records are preserved.
- Archive is operational visibility control, not deletion.

## Accessibility and localization

The deal center includes:

- keyboard-reachable filters and actions;
- explicit table row/column semantics;
- focus restoration after dialogs;
- English and Arabic copy;
- RTL support;
- responsive card-style rows on narrow screens;
- explicit read-only messaging and hidden mutation controls.
