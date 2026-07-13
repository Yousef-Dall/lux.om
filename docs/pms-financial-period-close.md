# PMS financial period close controls

Stage 21I-K turns financial-period closure into a governed month-end control. A period still follows `OPEN -> REVIEWING -> CLOSED`, but closure now requires complete treasury readiness, an independent accounting manager, and an immutable revisioned close pack.

## Close readiness

A period cannot close while any of these conditions remain in its company, property scope, currency, and date range:

- unmatched or duplicate reconciliation items;
- pending or approved security-deposit transactions;
- confirmed rent payments with remaining unallocated value;
- confirmed rent payments without one matched incoming reconciliation item;
- paid vendor invoices without one matched outgoing reconciliation item;
- manually paid owner payouts without one matched outgoing reconciliation item.

The readiness response returns each blocker count, the total blocker count, and the unallocated payment amount. Outstanding tenant receivables do not block closure by themselves; they remain valid balance-sheet/collection records.

## Maker-checker rule

Moving a period to `REVIEWING` records the reviewer in the period event history. The same user cannot close that review cycle. A different user with `ACCOUNTING_MANAGE` must perform `CLOSE` after all readiness blockers reach zero.

The backend is authoritative. The interface explains the separation rule, but direct API requests are rejected when reviewer and closer are the same person.

## Immutable close pack

Each successful close creates `PmsFinancialPeriodClose` with:

- a monotonically increasing revision per period;
- an explicit foreign-key link to the exact review transition event;
- reviewer, closer, reasons, and timestamps;
- the exact readiness result used for closure;
- period scope and currency;
- rent-payment, accounting-ledger, vendor-payment, owner-payout, deposit, and reconciliation totals;
- immutable included-record IDs;
- a deterministic SHA-256 snapshot hash.

The database permits only one active close revision per period. Close-pack evidence cannot be edited or deleted. Reopening records only the reopen actor, reason, and timestamp on the active revision. A later review and close creates a new revision rather than overwriting the prior pack.

## Legacy compatibility

Existing closed periods created before Stage 21I-K may not have a close pack. They can still be reopened through the governed API. After reopening, every future close requires the new maker-checker and close-pack controls.

## Operating sequence

1. Resolve statement-import exceptions and match every period cash movement.
2. Allocate or otherwise govern every confirmed payment so no unexplained available balance remains.
3. Complete or void pending deposit transactions.
4. Move the period to `REVIEWING` with a meaningful reason.
5. Have a different accounting manager inspect the readiness result and supporting records.
6. Close the period and retain the returned revision and snapshot hash in the month-end evidence record.
7. Reopen only for an approved correction. Reconcile the correction, review again, and create the next close revision.

Never edit a close-pack JSON value or hash directly. A hash mismatch or trigger failure indicates evidence tampering or an unsupported database write and must be investigated rather than bypassed.
