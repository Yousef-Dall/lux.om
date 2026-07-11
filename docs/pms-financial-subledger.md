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

## Reconciliation

`PmsReconciliationItem` stores bank, payment-provider, cashbook, or manual references. Company/source/reference is unique. Items may be unmatched, matched, duplicate, or ignored. Matching verifies currency, amount, company, and property scope against a real payment, and one payment cannot be matched to multiple active reconciliation items. Duplicate detection remains explicit and auditable.

## Owner payout foundation

Payout batches and lines calculate owner payable amounts by property and currency with management fees and reserved amounts separated. Linked statements must be published, match the property, currency, and exact payout period, and cannot be reused by another active payout. Manual lines require an explanatory note. Statuses include draft, approved, processing, manually paid, failed, and cancelled.

`PAID_MANUAL` requires a payout reference and evidence; it means an operator recorded external completion. lux.om does not claim to initiate or confirm a bank transfer. Future provider integration must add immutable provider references and webhook verification rather than reusing manual status.
