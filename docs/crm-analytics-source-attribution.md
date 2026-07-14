# CRM analytics and source attribution

Stage 21I-S turns the existing complete-data forecast contract into a dedicated operational analytics workspace and adds a governed source-signal audit register.

## Complete-data analytics

`GET /api/crm/analytics/forecast?workspaceId=...` continues to calculate conversion, pipeline, outcome, stage, reason, and overdue-follow-up metrics from complete database queries. It does not derive business metrics from the currently visible browser page.

The frontend deliberately:

- separates every pipeline and weighted forecast by ISO currency;
- preserves won and lost outcomes after a deal is archived;
- shows lead-to-qualified and qualified-to-deal conversion rates;
- exposes source, score-band, stage, time-in-stage, and won/lost reason dimensions;
- labels property-scoped access when only assigned PMS properties are visible.

No cross-currency total is calculated.

## Source-signal register

`GET /api/crm/source-events` supports server-side browsing with:

- `workspaceId`;
- `search` across source references, rule keys, and linked contact, lead, account, or deal names;
- `type`;
- `consentStatus`;
- `linkedTo=ANY|CONTACT|LEAD|ACCOUNT|DEAL|UNLINKED`;
- `sortBy=occurredAt|type|consentStatus`;
- `direction=asc|desc`;
- `take` and `skip` pagination.

Property scope is applied before search, filters, pagination, and total counting. The endpoint returns the visible linked contact, lead, account, and deal summaries, plus explicit rules confirming that the count is complete for the effective scope.

The browser stores audit-register browsing state in `analytics*` URL parameters so links and reloads preserve the current view.

## Access and data integrity

Analytics and source-event routes require CRM view access. Company members restricted to selected PMS properties receive only source events and analytics linked to those properties. The UI does not attempt to widen access when the backend returns an empty or forbidden result.

Source events remain immutable provenance records. This batch does not add edit, delete, replay, or manual relinking controls.

## Localization and responsive behavior

The dedicated `/crm/analytics` route is lazy loaded and includes English and Arabic copy, RTL layout support, keyboard-accessible filters and pagination, and single-column rendering on narrow screens.

## Verification

Targeted checks:

```bash
npm run contracts:crm:check
npm run typecheck
npm run build
npm run test:integration -w backend -- tests/crmStage21h.integration.test.ts
npm run test:e2e -w frontend -- e2e/crm-analytics.spec.ts e2e/crm-shell-navigation.spec.ts --workers=1
```
