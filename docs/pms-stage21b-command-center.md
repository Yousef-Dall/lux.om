# PMS Stage 21B command center and operational automation

## Scope

Stage 21B upgrades the existing PMS overview into a company-scoped operational command center. It does not add a CRM, external scheduler, or outbound messaging provider. All signals are calculated from existing PMS records and remain subject to effective PMS permissions and assigned-property scope.

## Command center endpoint

`GET /api/pms/command-center`

Supported filters:

- `companyId`
- `propertyId`
- `dateFrom` and `dateTo` for the financial period, limited to 366 days
- `riskWindowDays` from 7 to 180 days
- `status`: `ALL`, `OPEN`, `OVERDUE`, `UPCOMING`, or `NEEDS_REVIEW`
- `priority`: `ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`
- `take`, capped at 50 queue items

The response includes:

- stable property filter options within the member's workspace scope
- permission-redacted portfolio, occupancy, collection, arrears, maintenance, compliance, and tenant-experience health signals
- real inventory, rent, lease, maintenance, document, inspection, and owner-statement readiness metrics
- high-risk tenant accounts calculated from arrears age, remaining balance, and repeated overdue items
- a sorted operations inbox with actionable PMS links
- due automation counts and the latest generated internal-alert timestamp

A metric is `null` when the effective permission does not allow that data category. A health signal is `NO_DATA` when the required underlying records do not exist. The endpoint does not substitute demo values.

## Priority queue rules

The queue can contain:

- overdue rent account risk
- overdue maintenance SLA items
- urgent open maintenance
- leases expiring inside the selected risk window
- active leases missing a non-archived lease agreement
- expired or expiring documents
- overdue inspections or inspections needing action
- owner statements with selected-period financial activity
- incomplete property or unit setup

Priority scores are deterministic. They use record age, remaining balance, repeated arrears, maintenance priority and SLA date, lease proximity, and document expiry state. Queue filtering happens on the backend after permission and property scope have been applied.

## Operational automation foundation

`GET /api/pms/communications/reminders` previews candidates.

`POST /api/pms/automations/run` supports:

- `RENT_DUE_SOON`
- `OVERDUE_RENT`
- `LEASE_EXPIRY`
- `MAINTENANCE_STATUS`
- `DOCUMENT_EXPIRY`

A dry run returns candidates without writing records. An execution creates internal `PmsCommunicationLog` records only. It does not send email, SMS, or WhatsApp messages. Generated records contain a candidate key and are idempotent per UTC day, so rerunning the same automation skips existing candidates. Each execution also records a PMS workspace audit event.

Communication permission remains context-aware:

- accountants may execute rent automations
- maintenance users may execute maintenance automations
- general lease or document automations require general communication permission

## Release verification

1. Compare command-center totals with the underlying scoped list endpoints.
2. Test an unrestricted owner and a selected-property manager.
3. Test a maintenance-only and accounting-only role to confirm redacted metrics and queue categories.
4. Verify `propertyId` outside the member scope returns `403`.
5. Dry-run an automation before execution.
6. Execute it twice and verify the second run skips the same candidate.
7. Confirm the generated communication log is `INTERNAL` and `LOGGED`.
8. Confirm an account security event titled `PMS automation alerts generated` exists.
9. Verify actionable links remain inside the selected company workspace.
