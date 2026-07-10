# CRM Stage 21C foundation

## Product boundary

Stage 21C introduces a private, cross-product CRM at `/crm`. It is shared by marketplace operators, PMS company workspaces, and lux.om administrators. It is not a public contact directory and it does not expose CRM records to customers.

Marketplace inquiry records, bookings, listings, activities, projects, valuation requests, saved searches, investor watchlists, PMS tenants, PMS properties, and PMS vendors remain canonical in their existing modules. CRM records hold relationship state, a scoped contact snapshot, assignment, stage, priority, next follow-up, activities, notes, and tasks. This avoids copying full source records into the CRM.

## Data model

The migration adds:

- `CrmContact` for a private contact snapshot inside one CRM workspace
- `CrmLead` for the opportunity, pipeline state, source references, assignment, and follow-up
- `CrmActivity` for notes, tasks, calls, emails, meetings, status changes, and assignment history
- CRM enums for status, priority, source, activity type, and activity status
- `CRM_VIEW` and `CRM_MANAGE` PMS permission keys

A CRM lead can belong to a marketplace user workspace through `ownerUserId`, a company workspace through `companyId`, or the global admin workspace when both are null. Company leads may also carry `pmsPropertyId` for property-level isolation.

## Access rules

- `ADMIN` users can inspect all CRM records and filter by company workspace.
- Marketplace `OWNER`, `ACTIVITY_PROVIDER`, `TRAVEL_AGENCY`, and `DEVELOPER` users receive a personal CRM workspace. They can only see and manage leads whose `ownerUserId` is their own user ID.
- PMS members require effective `CRM_VIEW` or `CRM_MANAGE` permission. Role defaults and active custom grants are combined using the existing PMS permission architecture.
- Property-scoped PMS members can only view and manage company CRM leads linked to their assigned properties.
- A property-scoped member cannot create an unscoped company lead.
- Lead assignment must remain inside the same workspace. A property-linked lead can only be assigned to a CRM-enabled company member who can access that property.
- Normal customer accounts do not receive CRM access.
- General contact-form leads without an owner or company are admin-only.

Backend authorization remains authoritative. Hiding a link or navigation item is not treated as an access control.

## API surface

All routes require authentication.

- `GET /api/crm/access`
- `GET /api/crm/properties?companyId=...`
- `GET /api/crm/assignees?companyId=...`
- `GET /api/crm/leads`
- `POST /api/crm/leads`
- `GET /api/crm/leads/:id`
- `PATCH /api/crm/leads/:id`
- `POST /api/crm/leads/:id/activities`
- `PATCH /api/crm/leads/:id/activities/:activityId`

Lead list filters support workspace/company, source, status, priority, assigned user, search, created date range, pagination, and result limits.

## Pipeline rules

The foundation supports these statuses:

`NEW → CONTACTED → QUALIFIED → VIEWING_SCHEDULED / PROPOSAL_SENT / NEGOTIATION → WON / LOST → ARCHIVED`

Invalid jumps are rejected by the backend. Reopening from `LOST` or `ARCHIVED` returns the lead to `NEW`. Status and assignment changes create completed timeline events.

Stage 21C intentionally does not add lead scoring, outbound automation, campaign delivery, or AI recommendations. Those belong in Stage 21D.

## Marketplace ingestion

Creating an approved listing or activity inquiry now creates the inquiry and its CRM lead in one database transaction. The lead is assigned to the source owner and links back to the inquiry and source asset. A failure does not leave a partial inquiry or partial CRM lead.

Other supported source references can be attached through the CRM API without changing the existing booking, valuation, saved-search, watchlist, or PMS workflows.

## Frontend

The CRM workspace is available at:

- `/crm`
- `/crm/:leadId` for a deep-linkable lead detail

The UI includes:

- workspace selector
- search, source, status, priority, assignee, and date-range filters
- live status totals and open activity counts
- lead list and private contact detail
- source-object links
- status, priority, assignment, and next-follow-up controls
- notes, tasks, calls, emails, meetings, and timeline
- explicit loading, no-access, empty, error, and saving states

PMS navigation shows CRM only when `CRM_VIEW` is effective. Marketplace dashboards expose CRM to eligible operators. The admin workspace links to global CRM oversight.

## Release verification

1. Apply the migration and regenerate Prisma Client.
2. Submit an inquiry for an approved listing and confirm exactly one CRM lead is created.
3. Confirm the listing owner sees the lead and another owner does not.
4. Confirm a normal customer receives `403` from CRM list routes.
5. Test a full-company PMS manager and two managers scoped to different properties.
6. Confirm property A leads do not appear for property B staff.
7. Attempt to assign a property A lead to property B staff and confirm `403`.
8. Confirm an admin can see global and company CRM records and use company filters.
9. Verify an invalid stage jump is rejected and a valid transition creates a timeline event.
10. Create and complete a task, then verify the detail timeline and open-activity count.
11. Verify CRM responses use `Cache-Control: no-store` through the sensitive API policy.
12. Run typecheck, build, unit tests, integration tests, diff check, and working-tree status checks.
