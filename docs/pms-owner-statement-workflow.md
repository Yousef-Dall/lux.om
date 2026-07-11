# PMS owner statement operational workflow

Owner statements are immutable, property-specific, period-specific, and currency-specific financial snapshots.

## Lifecycle

- `GENERATED`: snapshot created from current eligible rent payments, accounting entries, and maintenance records.
- `NEEDS_REVIEW`: operator has completed initial preparation and sent it for control review.
- `APPROVED`: reviewer confirms the snapshot and supporting records.
- `PUBLISHED`: final historical statement. Later edits to source records do not alter it.
- `VOID`: statement is withdrawn but retained with history. A correction requires a new revision.
- `DRAFT`: reserved lifecycle state for imported or future preparatory workflows; normal API generation starts at `GENERATED`.

## Control checklist

1. Select one property, exact period, and one currency.
2. Confirm no mixed-currency value is being treated as a total.
3. Reconcile included rent payment IDs and accounting entry IDs.
4. Review opening balance, income, expenses, adjustments, and closing balance.
5. Confirm maintenance costs are recorded in the selected currency.
6. Move to review, approve, then publish using explicit transitions.
7. Export or render a document only from the stored snapshot/version.
8. For correction, void and create a revision referencing the void statement.

The active uniqueness constraint prevents duplicate non-void statements for the same company, property, period, and currency. Every transition records actor, request context, old status, new status, property, currency, and revision in `DomainAuditEvent`.
