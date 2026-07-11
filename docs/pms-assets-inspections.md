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
