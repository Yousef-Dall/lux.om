# PMS QA checklist

Run this checklist before controlled beta onboarding and before each PMS release.

## Desktop smoke

- [ ] `/pms/overview` loads for active PMS staff.
- [ ] A non-PMS user cannot access `/pms`.
- [ ] Admin can enable/suspend PMS entitlement.
- [ ] PMS owner can invite/update/suspend staff.
- [ ] Property-scoped staff cannot open another property.
- [ ] Properties, units, tenants, leases, rent dues, maintenance, documents, communications, imports, and accounting pages load.

## Mobile smoke

- [ ] Sidebar navigation remains usable.
- [ ] Tables/cards wrap without horizontal layout breakage.
- [ ] Form fields remain readable and tappable.
- [ ] Dangerous actions still show confirmations.
- [ ] Tenant portal pages load on mobile.

## Permissions

- [ ] `PMS_VIEWER` cannot create/update/delete or send communications.
- [ ] `PMS_MAINTENANCE` cannot access accounting exports or rent collection actions.
- [ ] `PMS_ACCOUNTANT` cannot manage maintenance quotes/vendors.
- [ ] Tenant portal users cannot access `/pms` unless also PMS staff.
- [ ] Company A staff cannot access Company B data by guessing ids.

## Data isolation

- [ ] Every PMS list endpoint filters by company.
- [ ] Detail endpoints resolve the record's company before returning data.
- [ ] Tenant portal endpoints resolve tenant portal access before returning data.
- [ ] Public marketplace routes do not expose private PMS records.

## Reports and finance

- [ ] Rent payments update due item status.
- [ ] Accounting ledger reflects rent payments and maintenance costs.
- [ ] Owner/property statement preview matches ledger and rent due data.
- [ ] CSV exports include only the selected company data.

## Migration and recovery

- [ ] `npx prisma migrate status` is clean.
- [ ] Production backup exists before migration deploy.
- [ ] Rollback plan is documented for app deploy rollback.
- [ ] Database rollback is treated as restore-from-backup, not automatic down migration.
