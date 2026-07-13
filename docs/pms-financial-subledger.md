# PMS financial subledger

## Charges

A structured charge contains company, property, optional unit, lease, tenant, currency, due date, service period, lines, adjustments, credits, paid amount, and balance. Supported line categories include rent, utilities, service charges, late fees, maintenance, deposit deductions, discounts, and manual adjustments.

Lifecycle:

`DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID`

An issued charge may be voided only through the explicit void endpoint and only when the service rules permit it. Issued charge core fields and lines are protected by database triggers. Corrections use adjustments or credit notes rather than historical rewrites.

## Payments and allocations

`PmsRentPayment` remains the payment record so existing receipts and tenant history remain compatible. `rentDueItemId` is nullable because a payment may be unallocated or split across charges.

Allocation rules:

1. Payment and charge must belong to the same company and property scope.
2. Payment and charge currencies must match.
3. Active allocation totals cannot exceed the payment amount after refunds or chargebacks.
4. Active allocation totals cannot exceed the charge balance.
5. A duplicate idempotency key returns the original result.
6. Concurrent conflicting allocations fail safely through serializable transaction retries or conflict responses.
7. Reversal creates an explicit reversal record and restores balances; it does not delete the original allocation.

Allocation receipts are calculated from actual active allocations and show allocated and unallocated amounts.

## Payment adjustments

Refunds, write-offs, and chargebacks are explicit payment adjustments with amount, reason, actor, status, and idempotency key. They reduce available payment value and cannot exceed the remaining available amount. A refund record is not evidence that a bank or provider transfer completed unless a real provider integration supplies that evidence.

## Security deposits

Security deposits use liability accounting:

- `COLLECTION`: increases liability and posts immediately.
- `ADJUSTMENT`: explicit correction with audit history.
- `DEDUCTION`: requires approval before posting and reducing liability.
- `REFUND`: requires approval before posting and reducing liability.
- `CONVERSION_TO_INCOME`: requires approval, a linked issued deduction charge, an explicit post transition, and settles only the converted amount against that charge.

Evidence can be linked through private `PmsDocument` records. The account stores expected, collected, deducted, refunded, and liability balances independently of ordinary rent income.

## Financial periods

Period lifecycle:

`OPEN -> REVIEWING -> CLOSED`

A closed period can return to `OPEN` only through `REOPEN` with a reason. Every transition creates `PmsFinancialPeriodEvent`. Posting helpers check both property-specific and company-wide periods. A partial unique database index prevents duplicate company-wide periods where `propertyId` is null.

Closure requires zero reconciliation exceptions, zero pending deposit transactions, zero unallocated confirmed payments, and complete incoming/outgoing treasury matching for confirmed rent payments, paid vendor invoices, and manually paid owner payouts in the period scope. The reviewer who moves a period to `REVIEWING` cannot close the same review cycle. Every successful close creates an immutable SHA-256-hashed `PmsFinancialPeriodClose` snapshot; reopening marks that revision as reopened and the next close creates a new revision. See `docs/pms-financial-period-close.md`.

## Treasury reconciliation

`PmsReconciliationItem` stores bank, payment-provider, cashbook, or manual references with an explicit `CREDIT` or `DEBIT` direction. Company/source/reference remains unique. Items may be unmatched, matched, duplicate, or ignored.

Supported exact-match targets are confirmed rent payments for credits, paid vendor invoices for property-scoped debits, and manually paid owner payouts for company-wide debits. Matching verifies company, property scope, currency, amount, target status, and one-time use in a serializable transaction. Matched rows and their target links are immutable and protected by database constraints, partial unique indexes, and triggers. Duplicate detection includes direction and remains explicit and auditable. See `docs/pms-treasury-reconciliation.md`.

## Owner payout foundation

Payout batches and lines calculate owner payable amounts by property and currency with management fees and reserved amounts separated. Linked statements must be published, match the property, currency, and exact payout period, and cannot be reused by another active payout. Manual lines require an explanatory note. Statuses include draft, approved, processing, manually paid, failed, and cancelled.

`PAID_MANUAL` requires a payout reference and evidence; it means an operator recorded external completion. lux.om does not claim to initiate or confirm a bank transfer. Future provider integration must add immutable provider references and webhook verification rather than reusing manual status.

Governed reporting reads the immutable close revision rather than recalculating historical totals from current operational rows. Integrity-verified CSV and JSON exports include the snapshot evidence and are audited. See `docs/pms-financial-close-reporting.md`.
