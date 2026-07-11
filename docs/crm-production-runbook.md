# CRM production runbook

## Scope and access

CRM records must remain inside their explicit personal, company, property-scoped, or platform workspace. General company CRM access is controlled by shared workspace membership and does not require PMS entitlement. Reproduce access incidents with the exact company, property, lead, actor, and effective `CRM_VIEW`/`CRM_MANAGE` permissions. Never widen frontend queries to work around a backend `403`.

## Stage and assignment auditing

Lead stage changes and assignment changes create `DomainAuditEvent` records in the CRM domain. Events include company when applicable, lead ID, actor, manual/system/automation origin, safe before/after metadata, request ID, source IP, user agent, and timestamp. Contact secrets and unrestricted message/document content must not be stored in generic audit metadata.

After deployment, verify:

1. A property-scoped member cannot assign or change a lead outside assigned properties.
2. A cross-company operator cannot view or mutate the lead.
3. Stage and assignee changes create scoped CRM audit events.
4. Audit inspection is available only to safe admin/operator roles.
5. Personal workspace events do not leak into a PMS company audit feed.

## Retention and backup

CRM database backups are part of the normal encrypted PostgreSQL backup set. Define retention for lead/contact records, task history, communication history, and domain audits with privacy and legal review. Deletion workflows must account for restored backups and downstream exports; do not represent a row deletion as immediate erasure from immutable backups.

## Release checks

```bash
npm run typecheck
npm run build
cd backend && npm test && cd ..
npm run test:integration
git diff --check
git status --short
```

Also exercise one stage transition and one assignment transition, then confirm the CRM audit event is scoped to the expected company/lead and contains no contact identity document values or authentication data.


## Shared workspace operations

Stage 21F makes `Workspace` the authoritative CRM ownership boundary. Existing `companyId` and `ownerUserId` fields remain compatibility fields during the deprecation window; new access decisions must use `workspaceId`, `WorkspaceMember`, and `WorkspacePermission`.

Before deployment, review `docs/workspace-migration-backfill.md` and take a verified PostgreSQL backup. After migration, confirm that every CRM contact, lead, and activity has a workspace and that company workspaces remain available when PMS entitlement is disabled or suspended.

Generate and verify the shared CRM contract before release:

```bash
npm run contracts:crm:generate
npm run contracts:crm:check
```

Run the browser access-control suite after installing Chromium once:

```bash
npm run test:e2e:install
npm run test:e2e
```

The browser suite supplements backend integration tests; it does not replace them.

## Stage 21H revenue operations

After deploying migration `20260711233000_crm_stage21h_revenue_operations`, generate Prisma Client, recalculate durable scores, and run the backfill verifier:

```bash
npm run db:generate
npm run jobs:crm-scores:once
npm run ops:crm-stage21h:verify-backfill
```

Schedule these durable jobs with one active scheduler instance or a distributed job runner:

```bash
npm run jobs:crm-scores:once
npm run jobs:crm-communications:once -- --limit=100
```

Real CRM email submission additionally requires `CRM_EMAIL_DELIVERY_ENABLED=true`, verified SMTP variables, and authenticated provider webhooks via `CRM_PROVIDER_WEBHOOK_SECRET`. A queued or submitted attempt is not delivered. Only a provider confirmation may produce `DELIVERED`.

Review the ingestion thresholds in `docs/crm-source-ingestion-thresholds.md` before enabling new event producers. Passive marketplace behavior must not create leads without a documented high-intent rule.
