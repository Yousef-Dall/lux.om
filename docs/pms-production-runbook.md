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

## Stage 21E privacy, finance, and audit controls

### Export authorization

- Every PMS CSV export requires `IMPORT_EXPORT` plus the effective view permission for the exported module.
- Accounting exports require `ACCOUNTING_VIEW`; tenant exports require `TENANCY_VIEW`; rent roll exports require `RENT_VIEW`.
- Tenant exports omit national ID and passport values by default.
- Sensitive tenant identity export additionally requires `SENSITIVE_DATA_EXPORT` and the exact confirmation value `EXPORT_SENSITIVE_TENANT_DATA`.
- Sensitive exports create a `DomainAuditEvent` containing the actor, company, export type, property filter, request ID, source IP, user agent, and timestamp. Identity values themselves are never written to audit metadata.

Release verification must include an owner, an agent without `IMPORT_EXPORT`, an accounting user without accounting export permission, a property-scoped operator, and an operator with the dedicated sensitive-export permission.

### Private PMS documents

Set a durable private storage directory outside the publicly served `UPLOAD_DIR`:

```env
PMS_PRIVATE_DOCUMENT_DIR=/srv/lux-om/private-pms-documents
MAX_PMS_DOCUMENT_MB=10
```

The backend accepts PDF, JPEG, PNG, and WEBP only. It verifies extension, MIME type, size, and magic-byte signature, stores a SHA-256 checksum, and serves files only through authenticated PMS or tenant routes with `Cache-Control: no-store, private`. The directory must not be mounted behind `/uploads`, Nginx static aliases, a public bucket, or a CDN origin.

The current local adapter is production-capable for a single durable filesystem. `OBJECT_STORAGE` metadata is only an adapter boundary; no object-storage signed URL provider is claimed active. Malware scanning is not active. New records use `NOT_CONFIGURED`; quarantined records cannot be downloaded. Deploy a real scanner before changing that status operationally.

Before migration:

```bash
npm run ops:db:backup -- --output=../backups/pre-stage21e.dump
npm run ops:pms-documents:migrate -- --limit=500
```

The first command backs up PostgreSQL. Also take an encrypted filesystem snapshot of both `UPLOAD_DIR` and `PMS_PRIVATE_DOCUMENT_DIR`. Review dry-run output. External legacy URLs require manual retrieval and re-upload; they are not fetched automatically.

Execute local legacy migration only after backup:

```bash
npm run ops:pms-documents:migrate -- --execute --limit=500
```

The migration validates each legacy file, writes the private copy, removes the public source file, updates metadata, and records a system audit event. Failed rows remain visible for remediation. Repeat until the dry run reports zero local candidates. Verify several PMS and tenant downloads, then confirm the old `/uploads/<name>` paths return `404`.

### Currency-safe reporting

PMS reporting groups values by stored ISO-style three-letter currency. It never performs live conversion and never combines unlike currencies. APIs return `EMPTY`, `SINGLE`, or `MIXED` currency state plus per-currency totals. Scalar compatibility fields are populated only for a single-currency result.

For a mixed-currency workspace, operators must review each currency independently. Do not post a manual converted total unless the business has separately implemented a stored-rate conversion ledger with rate source, effective timestamp, and immutable history.

### Owner statement workflow

Owner statements are persistent currency-specific snapshots:

`GENERATED → NEEDS_REVIEW → APPROVED → PUBLISHED`

Any non-void state can be moved to `VOID` only through the explicit transition endpoint. A property, reporting period, and currency can have only one non-void statement. A replacement requires the prior statement to be voided and a new revision created with `revisionOfId`.

Operational sequence:

1. Reconcile rent payments, accounting entries, and maintenance costs.
2. Generate one statement per property, period, and currency.
3. Confirm included record IDs, opening balance, income, expenses, adjustments, and closing balance.
4. Move to `NEEDS_REVIEW` and obtain an independent review.
5. Approve only after supporting records and document evidence are complete.
6. Publish. Published snapshots must never be rewritten when source records change later.
7. If an error is discovered, void the statement and create an explicit revision. Never mutate the historical snapshot.

Every transition records an immutable domain audit event with actor and request context.

### Lease and occupancy controls

`PmsLease` status is the source of truth for occupancy. `ACTIVE` and `EXPIRING` leases imply occupied. `PmsUnit.operationalStatus` separately represents availability constraints such as maintenance or unavailability. The compatibility `status` field is derived from both values.

The database has a partial unique constraint preventing more than one `ACTIVE` or `EXPIRING` lease per unit. The lease write path locks the unit row before checking conflicts. Bulk imports use the same invariant and cannot mark occupancy directly.

Inspect drift:

```http
GET /api/pms/occupancy/reconciliation?companyId=<id>
```

Apply only the derived unit-status repairs after reviewing the issue list:

```http
POST /api/pms/occupancy/reconciliation
Content-Type: application/json

{"companyId":"<id>","apply":true}
```

The report identifies occupied units without active leases, active leases on vacant units, expired leases still active, and overlapping lease periods. Applying reconciliation does not silently end leases or resolve overlaps; those require an operator decision.

### Domain audit retention and inspection

PMS and CRM operational actions use `DomainAuditEvent`, not account-security events. Audit metadata is allow-limited and strips password, token, authorization, cookie, passport, national ID, and document-content keys. Limit audit inspection to scoped operators and administrators.

Recommended baseline retention is seven years for published owner-statement and financial audit history, subject to Oman legal and contractual review. Document retention should follow the applicable lease, tax, dispute, and privacy schedule. Backups containing private documents must be encrypted, access logged, tested for restore, and deleted according to the same retention policy. Do not use database deletion alone as proof that an object or backup copy has expired.
