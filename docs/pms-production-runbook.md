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
