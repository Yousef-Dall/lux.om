-- Stage 20 PMS launch-readiness indexes for large beta datasets.
-- These mirror Prisma schema @@index declarations and keep route filters fast
-- for rent collection, statements, documents, communications, and imports.

CREATE INDEX IF NOT EXISTS "PmsLease_company_status_endDate_idx"
  ON "PmsLease" ("companyId", "status", "endDate");

CREATE INDEX IF NOT EXISTS "PmsRentDueItem_company_status_dueDate_idx"
  ON "PmsRentDueItem" ("companyId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "PmsRentPayment_company_status_paidAt_idx"
  ON "PmsRentPayment" ("companyId", "status", "paidAt");

CREATE INDEX IF NOT EXISTS "PmsAccounting_company_date_type_idx"
  ON "PmsAccountingLedgerEntry" ("companyId", "transactionDate", "type");

CREATE INDEX IF NOT EXISTS "PmsWorkOrder_company_status_targetDate_idx"
  ON "PmsWorkOrder" ("companyId", "status", "targetDate");

CREATE INDEX IF NOT EXISTS "PmsDocument_company_status_expiryDate_idx"
  ON "PmsDocument" ("companyId", "status", "expiryDate");

CREATE INDEX IF NOT EXISTS "PmsCommunicationLog_company_status_createdAt_idx"
  ON "PmsCommunicationLog" ("companyId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "PmsImportBatch_company_status_createdAt_idx"
  ON "PmsImportBatch" ("companyId", "status", "createdAt");
