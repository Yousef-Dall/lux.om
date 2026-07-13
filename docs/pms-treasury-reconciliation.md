# PMS treasury reconciliation

## Purpose

Treasury reconciliation links an imported bank, provider, cashbook, or manual line to exactly one governed PMS financial target. It records evidence that an external cash movement corresponds to a PMS record; it does not initiate a bank transfer or modify the target amount.

Supported flows:

- `CREDIT` → one confirmed rent payment.
- `DEBIT` with property scope → one paid vendor invoice for that property.
- company-wide `DEBIT` → one manually paid owner payout batch.

No currency conversion or tolerance is applied. Company, scope, currency, and amount must match exactly.

## Lifecycle and controls

Items use `UNMATCHED`, `MATCHED`, `DUPLICATE`, or `IGNORED` status. Import requires a positive amount, three-letter currency, transaction date, direction, source, and external reference. Duplicate detection includes source, direction, and property scope so unrelated external lines are not collapsed accidentally.

Matching runs in a serializable transaction with row locks on both the reconciliation item and target. A target can be matched only once. A matched item requires an actor, timestamp, and explicit reason and is immutable at the database layer. Deleting a matched target is blocked because it would invalidate the reconciliation history.

Property-scoped users can reconcile only their assigned properties. Company-wide owner-payout reconciliation requires all-properties accounting access. Vendor invoices can be matched only to property-scoped debit lines; owner payouts can be matched only to company-wide debit lines.

## Database safeguards

The migration adds:

- direction-aware reconciliation indexing;
- target-cardinality and direction/target check constraints;
- partial unique indexes for matched rent payments, vendor invoices, and owner payouts;
- a trigger validating target company, property, currency, amount, and paid/confirmed status;
- matched-row immutability and delete protection;
- preflight checks for malformed or duplicate legacy payment matches.

If migration preflight fails, stop deployment and repair the reported legacy reconciliation rows manually. Do not remove the safeguards or force the migration.

## Operating sequence

1. Import or enter the external transaction with the correct direction and property scope.
2. Review duplicates and ignored lines before matching.
3. Select the exact eligible target:
   - confirmed rent payment for a credit;
   - paid vendor invoice for a property debit;
   - paid owner payout for a company-wide debit.
4. Verify the external reference, counterparty reference, date, amount, currency, and supporting bank evidence outside lux.om.
5. Record a reason and match the line.
6. Treat the matched record as permanent. Corrections require a governed operational process rather than direct database edits.

A `MATCHED` status confirms an operator-controlled record association. It is not independent confirmation from a bank API unless a future provider integration supplies authenticated settlement data.
## Statement imports

Workspace-wide accounting managers can preview and commit CSV statements through the reconciliation import endpoints. Imports are duplicate-safe at both file and external-reference level, create only unmatched reconciliation items, and preserve immutable batch/row provenance. See `docs/pms-treasury-statement-imports.md` for the CSV contract and operational controls.
