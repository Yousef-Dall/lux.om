# PMS assets, preventive maintenance, and inspections

## Asset register

`PmsAsset` belongs to a company and property and may belong to a unit and vendor. It records an asset code, category, manufacturer, model, serial number, installation date, warranty expiry, service interval, next service date, status, and optional cost metadata in one currency.

Assets are private PMS records. Work orders, maintenance plans, documents, and inspection defects can link to an asset. `PmsAssetEvent` records created, updated, serviced, repaired, warranty, retirement, and disposal history.

Warranty and next-service dates are operational alert inputs; they are not external warranty-provider integrations.

## Preventive maintenance

`PmsMaintenancePlan` defines company/property/unit/asset/vendor scope, interval days, next service date, checklist, SLA, and status. The durable job entry point is:

```bash
npm run jobs:pms-preventive:once
```

Generation uses a deterministic preventive key for each plan and due date. The unique key prevents duplicate work orders if the job retries. After successful generation, the plan advances to the next calculated service date. Paused, completed, and cancelled plans do not generate work.

The HTTP `generate-due` route is an operator control for verified manual execution. Production scheduling should invoke the same service from the job runner, not duplicate its logic.

## Structured inspections

Templates contain ordered sections and checklist items. A run links the template to a property, optional unit, lease, and tenant. Results support structured outcomes, text or numeric values, notes, and photo references.

A failed result may create a `PmsInspectionDefect`. Defect conversion to a work order is explicit and idempotent. Repeating conversion returns the existing work order rather than creating another one.

Move-in and move-out comparison uses matching template item IDs and reports changed outcome or value. It does not overwrite either historical inspection.

Signatures and acknowledgements are stored only when a real captured acknowledgement exists. The system must not fabricate a signature or infer consent from inspection completion.

## Stage 21I asset workspace

The authenticated asset register uses database-backed pagination, search, filters, and sorting. The visible page count is kept separate from the full scoped result total, and company/property access is applied to every query.

Inventory managers may register assets, edit identity and placement, change lifecycle status, and retire or dispose records. Maintenance managers may append service, repair, and warranty events without gaining permission to edit asset identity or perform retirement/disposal actions. Every mutation continues to create domain audit evidence and asset events remain append-only history.

The register supports English and Arabic, RTL layouts, keyboard-operated dialogs, narrow mobile screens, localized dates, and permission-denied/read-only states. Mobile inspection execution, defect conversion, calendar/kanban planning, and attachment capture remain separate controlled Stage 21I batches.

## Stage 21I preventive-maintenance workspace

The preventive-plan register uses database-backed pagination, search, status/property/due filters, and deterministic sorting. API responses include visible-page metadata separately from scoped active and due totals so the UI never treats a truncated page as the complete schedule.

Maintenance managers can create and edit one-time or interval plans, link only in-scope properties, units, assets, and active vendors, preview the next interval date, maintain a checklist and SLA, and inspect the latest generated work-order history. Property-scoped managers may edit plans in their scope but cannot run company-wide generation. The manual generation dialog calls the same idempotent service used by the durable job runner and reports only work orders actually created.

The workspace supports English and Arabic, RTL and narrow layouts, keyboard-operated dialogs, URL-persisted filters, and read-only permission states. One-time plans complete after generation; interval plans advance from the locked due date. The UI does not claim offline support or fabricate generated work.

Offline inspection execution is not implemented. Operators must remain connected while saving asset and inspection changes; offline queueing and conflict resolution are future capabilities and must not be implied by the current UI.

## Stage 21I structured-inspection workspace

The inspection-run register uses database-backed pagination, search, property/status/type/date filters, and deterministic sorting. List responses separate the visible page count from scoped totals and return summary counts for scheduled runs, runs needing action, and open defects. A dedicated detail endpoint loads the immutable template version, ordered checklist items, recorded results, evidence references, and linked defects only after the operator opens a run.

Maintenance managers can schedule an active template against an in-scope property and optional unit, cancel only a still-scheduled run with an audited reason, and execute the captured template checklist from a keyboard- and mobile-friendly dialog. Required checklist items, duplicate item submissions, failure-photo requirements, and defect eligibility are enforced by the backend. Completion records acknowledgement metadata only when the operator supplies a real acknowledgement name; the system never fabricates a signature.

Failed or observation results may create defects with severity and photo references. Open defects can be converted explicitly to a vendor/asset work order. Conversion remains transactionally idempotent, and unit-scoped defects can link only to property-wide assets or assets assigned to the same unit. Repeating conversion returns the existing work order rather than creating a duplicate.

The workspace supports English and Arabic, RTL and narrow layouts, URL-persisted filters, localized dates, accessible dialogs, cancellation warnings, and read-only permission states. Evidence is currently captured as validated online photo URLs. Direct camera upload, offline execution, conflict resolution, template administration, and calendar/kanban planning remain future controlled batches and are not implied by this implementation.
