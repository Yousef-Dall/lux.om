# PMS treasury statement imports

Stage 21I-J adds controlled CSV ingestion for external treasury movements. It creates reconciliation items only; it does not post accounting entries, confirm bank settlement, or automatically match transactions.

## Access boundary

Statement preview, commit, and import history require `ACCOUNTING_MANAGE` plus workspace-wide property access. Property-scoped operators may continue to create and reconcile individual property lines, but they cannot ingest a company bank statement that may contain movements outside their assignments.

## CSV contract

A statement may contain up to 5,000 data rows and 2 MB of UTF-8 CSV content. Quoted fields and escaped quotes are supported.

Required values:

- `externalReference` (aliases: `reference`, `bankReference`, `transactionId`, `transactionReference`)
- `currency` or `currencyCode`, exactly three letters
- `transactionDate` (aliases: `date`, `valueDate`, `bookingDate`), preferably ISO 8601 such as `2026-07-13`
- one amount representation:
  - `amount`, optionally paired with `direction`; a negative amount is interpreted as `DEBIT` when direction is absent, and an explicit direction must agree with the amount sign;
  - `credit` / `creditAmount` / `moneyIn`; or
  - `debit` / `debitAmount` / `moneyOut`.

Amounts must be non-zero, no greater than 1,000,000,000, and use at most three decimal places to match the PMS accounting precision.

Optional values:

- `propertyId`, `propertyCode`, or `propertyName`
- `payerReference`, `counterparty`, `description`, `beneficiary`, or `narrative`

A property reference must resolve inside the selected company. An empty property creates a company-wide line, which can later match a paid owner payout. Property lines may later match rent receipts or paid vendor invoices according to direction and the existing reconciliation controls.

## Preview and commit

Preview re-parses the source file and classifies every row as:

- `VALID`: eligible to become an unmatched reconciliation item;
- `DUPLICATE`: the external reference already exists for the same company/source or repeats earlier in the file;
- `INVALID`: required fields, amount, currency, date, or property scope failed validation.

Commit repeats the preview server-side and never trusts a client-supplied result. Only valid rows are inserted. A batch is:

- `COMMITTED` when every row imports;
- `PARTIAL` when valid rows import alongside duplicate or invalid rows;
- `FAILED` when no row is valid.

The normalized file content, source, and account reference produce a SHA-256 content hash. The same statement cannot be committed twice for the same company and source. Individual external references also remain protected by the reconciliation uniqueness constraint.

## Audit and immutability

Each commit records a `PmsTreasuryImportBatch`, counts, exceptions, actor, filename, source, account reference, and a domain audit event. Imported reconciliation items retain immutable `importBatchId` and `importRowNumber` provenance. PostgreSQL triggers prevent direct edits or deletion of committed batches and prevent provenance reassignment.

Keep the original bank statement according to the company retention policy. The CSV itself is not stored in the database; batch metadata stores the headers and exception rows, while the content hash proves repeated submission of the same normalized statement.
