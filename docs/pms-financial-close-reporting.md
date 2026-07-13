# PMS financial close reporting

Stage 21I-L exposes governed month-end reporting directly from the immutable `PmsFinancialPeriodClose` evidence created during period closure. It does not recalculate historical totals from mutable operational tables and does not create a second ledger.

## Source of truth

Each report is rendered from one stored close-pack revision. Before detail or export, the backend:

1. recomputes the deterministic SHA-256 hash from the stored snapshot;
2. compares it with the immutable stored hash;
3. validates the supported snapshot-version contract;
4. classifies the result as `VERIFIED`, `HASH_MISMATCH`, `UNSUPPORTED_VERSION`, or `INVALID_SNAPSHOT`.

A report with failed integrity remains visible to authorized finance users for investigation, but CSV and JSON exports are blocked. Never bypass that block or repair the hash directly. Reopen the period through the governed workflow when source records require correction, then review and close again to create a new revision.

## Access and scope

Close reports require both `REPORTS_VIEW` and `ACCOUNTING_VIEW`. Company and property access are enforced by the PMS workspace boundary:

- workspace-wide users may browse company-wide and property-specific close packs;
- property-scoped users may see only close packs for assigned properties;
- company-wide close packs are intentionally hidden from property-scoped users;
- cross-company detail and export requests return no report.

Filters support property, currency, active or reopened revision, close date, pagination, and deterministic ordering.

## Evidence shown

The report displays the close revision, period and property scope, reviewer and closer, close/reopen lineage, stored and recomputed hashes, readiness controls, grouped ledger/reconciliation/deposit totals, paid vendor and owner totals, and counts for every immutable record-ID collection in the snapshot.

The JSON export preserves the complete verified report and raw snapshot. The CSV export contains:

- integrity values and both hashes;
- period, review, close, and reopen metadata;
- all six readiness blocker categories;
- totals grouped by ledger type, ledger source, reconciliation state, and deposit type;
- every included record ID, not only aggregate counts.

Every successful export creates `PMS_FINANCIAL_PERIOD_CLOSE_EXPORTED` audit evidence with actor, company, close revision, period, format, hash, request ID, source IP, user agent, and timestamp. Export responses are private and `no-store`.

## Operating sequence

1. Complete the governed month-end close and retain its revision and hash.
2. Open **PMS → Reports → Financial close reports**.
3. Filter by currency, property, or active/reopened status.
4. Open the required revision and confirm **Integrity verified**.
5. Compare reviewer, closer, dates, readiness, totals, and included-record counts with the approval package.
6. Export CSV for tabular audit review or JSON for full machine-readable evidence.
7. Store the exported evidence under the organization’s retention and access policy.

Exports are evidence of the stored close pack. They do not initiate payments, post ledger entries, convert currencies, or prove an external bank transfer beyond the reconciled records included in the close snapshot.
