# PMS Stage 21G architecture

Stage 21G adds an incremental financial subledger and collaboration layer around the existing PMS. It does not replace legacy rent schedules, rent payments, accounting entries, published owner statements, private documents, or maintenance workflows.

## Module boundaries

Backend modules:

- `modules/pms/finance`: structured charges, allocations, payment adjustments, deposits, periods, reconciliation, owner payouts, and legacy compatibility.
- `modules/pms/assets`: private property and unit asset register and asset history.
- `modules/pms/maintenance`: preventive-maintenance plans and idempotent work-order generation.
- `modules/pms/inspections`: templates, structured results, defects, comparisons, and defect-to-work-order conversion.
- `modules/pms/portals`: management of portal grants plus strictly scoped owner and vendor APIs.
- `modules/pms/shared`: route-access and private-document helpers shared by extracted modules.

Existing public PMS URLs remain mounted below `/api/pms`. Owner and vendor collaboration use separate authenticated namespaces, `/api/owner` and `/api/vendor`, so their minimized contracts are not confused with internal PMS contracts.

## Accounting boundary

`PmsCharge` is the receivable obligation. `PmsRentPayment` remains the received-payment instrument for compatibility. `PmsPaymentAllocation` links payment value to one or more charges. No currency conversion occurs. Balances are stored and returned in the record currency.

Issued charges are immutable except through explicit adjustments, credit notes, allocations, reversals, or void workflows. Financially relevant records are never silently deleted.

`PmsSecurityDepositAccount` is a liability account. Collection increases liability. Refund, deduction, and conversion requests require an explicit transaction workflow. Conversion to income requires an approved linked issued charge, cannot exceed its outstanding balance, settles that charge when posted, and does not happen merely because a deposit was collected.

`PmsFinancialPeriod` protects posting dates. Closed periods block charge, payment, allocation, adjustment, deposit, and manual ledger postings. Payout workflow records remain separate from bank settlement and reference already published statement periods. Reopening requires a reason and records an event.

## Portal boundary

Owner portal access is an explicit `(property, user)` grant. It does not come from marketplace ownership, company membership, CRM workspace membership, or PMS staff membership. Owner responses intentionally omit tenant identity and expose only assigned-property occupancy, latest approved summaries derived only from published statements, published statement history, permitted maintenance costs, quote approvals, payout status, and private property documents.

Vendor portal access is an explicit `(vendor, user)` grant. Vendors see only work orders assigned to that vendor record. Tenant objects and internal ledgers are never serialized. Vendor files remain in private PMS storage and are downloaded through authenticated scoped routes.

## Compatibility

Legacy rent due items are backfilled one-to-one into structured rent charges. Confirmed legacy rent payments are backfilled into active allocations where a matching rent due exists. New rent schedules create their structured charge at write time. Existing public tenant and PMS payment endpoints continue to operate.

Published owner statements remain immutable snapshots. Stage 21G payout and statement references reconcile to those snapshots but never rewrite them.

## Operational invariants

- Never allocate more than the payment available balance.
- Never allocate more than the charge outstanding balance.
- Never mix payment and charge currencies.
- Use serializable transactions and row locks for balance-changing operations.
- Use caller-provided idempotency keys for external or retryable financial writes.
- Never mark a payout paid without explicit manual evidence or a future real payout-provider integration.
- Never expose private PMS files through static upload paths.
- Never widen property scope in a portal or extracted module.
