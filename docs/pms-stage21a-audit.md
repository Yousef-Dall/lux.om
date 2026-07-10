# PMS Stage 21A audit and consolidation

## Scope

This pass reviewed the existing PMS implementation after Stages 10A–20. It deliberately avoids CRM work and database changes. The patch concentrates on authorization consistency, company/property isolation, reliable financial metrics, coherent portal navigation, and regression coverage without changing public marketplace or tenant-portal contracts.

## Audit findings

### Access control

- The workspace response exposed effective permission keys, but several backend mutations still authorized against the member role only. That made custom grants descriptive rather than operational.
- `PMS_MANAGER` does not receive `STAFF_MANAGE` by default, yet the staff endpoints previously allowed the role through a broad role shortcut.
- Several read endpoints correctly enforced company membership but did not consistently inherit selected-property scope through related records.
- Bulk import cannot safely target an implicit subset of properties, so property-scoped members must not run it.

### Data consistency and reporting

- Outstanding and overdue rent totals used the scheduled amount instead of the remaining balance for partially paid items.
- Property-scoped report and statement queries needed the same scope filter as inventory and the command center.
- Direct record routes and CSV exports needed the same access rules as their list views.

### Product and UI coherence

- PMS modules were presented as one flat navigation list even though the product has clear workspace, leasing, operations, and control areas.
- Portal capabilities were inferred from role names rather than the effective permission set returned by the backend.
- Direct navigation to a restricted module could start API calls before showing an access boundary.
- The main overview could still expose totals from modules the member could not open.
- Some pages loaded optional related modules unconditionally, producing avoidable 403 errors for valid limited-access users.

## Implemented architecture

### Effective permissions

`workspace.member.permissionKeys` is now the authorization source used by both backend helpers and frontend capabilities. It contains role defaults plus active custom grants. Grants remain additive; this patch does not introduce deny rules.

Important default boundary: `PMS_MANAGER` does not implicitly manage staff. A manager needs an active `STAFF_MANAGE` grant, while `PMS_OWNER` receives it by default.

### Property scope

A member with `propertyScope.allProperties === false` is restricted across:

- tenants linked through leases
- leases and rent due items
- rent payments and receipts
- maintenance work orders, quotes, and inspections
- accounting ledger and owner statements
- documents and expiry alerts
- reports, dashboard metrics, and CSV exports

Records that cannot be tied to an assigned property are rejected on scoped direct-access and mutation paths. Bulk import requires workspace-wide property access.

### Metric rules

Outstanding and overdue rent are calculated as:

```text
max(sum(amount) - sum(paidAmount), 0)
```

This rule is used for report totals and PMS overview amounts so partial payments are not counted twice.

### Portal information architecture

Navigation is grouped into:

1. Workspace
2. Leasing
3. Operations
4. Control

Modules are shown from effective permissions, direct restricted routes render a clear access state, and optional cross-module data is fetched only when the member has the relevant permission. Overview and command-center metrics outside the member's effective permissions are returned as `null` and omitted from the UI rather than leaking module totals.

## Deployment notes

- No Prisma schema change or migration is included.
- No public marketplace, tenant portal, payment-provider, or CRM route is added or changed.
- Existing PMS URL contracts remain in place.
- Apply the patch, regenerate Prisma Client using the project’s normal environment, and run the full validation suite in the production-like test database.

## Regression coverage

The PMS integration suite now verifies:

- default manager staff-management denial
- explicit `STAFF_MANAGE` grant authorization only for workspace-wide operators
- non-owner delegation limits and active-owner continuity
- overview metric redaction and direct-route denial outside effective permissions
- selected-property isolation across tenant, lease, rent, maintenance, accounting, document, communication, report, and export paths
- direct blocked-property accounting filters, owner-statement unit filters, document access, and communication previews
- bulk-import denial for property-scoped staff
- remaining-balance reporting for partially paid rent

## Follow-up boundaries

The PMS router remains large. A later internal refactor can split it by module behind the same route contracts, but that rewrite is intentionally excluded from Stage 21A to keep regression risk controlled. Future mobile work should consume the current workspace, effective-permission, pagination, and property-scope contracts rather than re-implementing authorization on the client.
