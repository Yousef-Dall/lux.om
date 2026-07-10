# PMS production runbook

This runbook is for beta launch operations of the lux.om PMS module.

## Required environment assumptions

PMS uses the main lux.om backend, PostgreSQL database, JWT auth, notification system, and configured upload/storage driver. PMS rent payment records are separate from public activity bookings. Tenant portal access requires a normal lux.om user account linked to a PMS tenant record.

## Pre-release commands

Run from the repo root:

```bash
npm run typecheck
npm run build
cd backend && npm test && cd ..
npm run test
npm run test:pms-smoke
cd backend && npx prisma migrate status && cd ..
git diff --check
git status --short
```

For full integration coverage, also run:

```bash
npm run test:integration
```

## Optional local demo seed

The normal seed remains marketplace-focused. To include local PMS demo data, run only outside production:

```bash
SEED_INCLUDE_PMS_DEMO=true npm run db:seed
```

This creates one demo PMS company workspace, property, unit, tenant, lease, rent dues, rent payment, accounting entries, maintenance work order, vendor, policy, template, document, inspection, and tenant portal link.

## Beta onboarding order

1. Enable PMS entitlement.
2. Add PMS owner/manager.
3. Add or import properties and units.
4. Add or import tenants and leases.
5. Validate generated rent due items.
6. Add policies/templates/vendors.
7. Link tenant portal accounts only after tenant users exist.
8. Run reports, rent roll export, and owner statement preview.

## Operational monitoring

- Watch API error logs for `/api/pms` and `/api/tenant`.
- Watch account security events for staff changes and entitlement changes.
- Review failed email delivery events before enabling broad email notices.
- Keep WhatsApp/SMS as copy-only until a real provider is configured.
- Review import batches after onboarding sessions.

## Backup and rollback

Before production PMS migrations, take a PostgreSQL backup. App rollback can use the previous deploy artifact. Data rollback should be a deliberate database restore from backup because PMS migrations add financial and tenant records that should not be automatically deleted.

## Stage 21A workspace scope and navigation checks

- Treat the selected PMS company and the member property scope as mandatory filters for every dashboard metric, alert, export, and list response.
- A member with selected-property access must never receive aggregate counts or financial totals from unassigned properties.
- `workspace.member.permissionKeys` is the effective permission set: default role permissions plus active custom grants.
- PMS navigation should only expose modules represented in the effective permission set. Backend authorization remains authoritative for direct API requests.
- During release verification, test one unrestricted owner, one property-scoped staff member, and one user without PMS access.
- `PMS_MANAGER` does not receive staff administration implicitly. Grant `STAFF_MANAGE` explicitly when a manager must invite, suspend, or rescope members.
- Property-scoped members cannot run bulk imports. Use an unrestricted owner or explicitly authorized workspace-wide operator for onboarding imports.
- Verify direct URL access as well as sidebar visibility. A hidden module must still return `403` from its protected API when the effective permission is absent.

## Financial consistency checks

- Outstanding and overdue rent must use the remaining balance: `amount - paidAmount`, never the full scheduled amount for partially paid items.
- Compare the overview, reports summary, rent roll, and owner statement for the same company/property/date range before release.
- A selected-property member must receive the same property boundary in the ledger, owner statement, documents, maintenance, reports, and CSV exports.
- Treat confirmed rent payments and manual ledger entries as separate sources. Do not manually duplicate confirmed rent income in the ledger.

## Permission and scope incident triage

1. Confirm the active PMS company membership and entitlement.
2. Inspect the member role, active custom grants, and assigned property IDs.
3. Reproduce with the exact company and record ID, not only the sidebar route.
4. Check whether the record is linked to an assigned property. Scoped access intentionally rejects unlinked records.
5. Review the account security event for recent staff or scope changes.
6. Never work around a `403` by widening a query in the frontend; correct the membership, grant, or property assignment.


## PMS command center checks

The PMS overview loads `/api/pms/command-center` for live operational intelligence. Verify that overdue rent, outstanding balances, selected-period collection, maintenance SLA risk, urgent work, lease expiry, document gaps, inspection follow-up, setup completeness, and owner-statement readiness match the underlying workspace records. Property-scoped staff must see only assigned-property metrics and queue items. Permission-restricted categories return `null` metrics and are omitted from the queue rather than leaking financial, tenant, or document data.

Exercise the property, date-range, risk-window, status, and priority filters during release verification. The date range is financial reporting scope; the risk window controls upcoming lease, document, inspection, and reminder signals. Health cards must display `NO_DATA` instead of invented scores when the required records do not exist.

The automation queue is an auditable internal-alert foundation. Preview candidates with `GET /api/pms/communications/reminders`. Execute them with `POST /api/pms/automations/run`; execution writes `INTERNAL` / `LOGGED` communication records and a workspace audit event, but does not send email, SMS, or WhatsApp messages. Candidate keys are deduplicated per UTC day. Run the same automation twice in release testing and confirm the second run reports skipped duplicates.

See `docs/pms-stage21b-command-center.md` for metric definitions, supported filters, automation types, permission behavior, and the verification checklist.
