-- Stage 21I-J: controlled treasury statement imports with immutable source provenance.

CREATE TABLE "PmsTreasuryImportBatch" (
  "id" TEXT NOT NULL,
  "source" "PmsReconciliationSource" NOT NULL,
  "filename" TEXT,
  "accountReference" TEXT,
  "contentHash" TEXT NOT NULL,
  "status" "PmsImportStatus" NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsTreasuryImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsTreasuryImportBatch_counts_check" CHECK (
    "totalRows" > 0 AND "importedRows" >= 0 AND "duplicateRows" >= 0 AND "failedRows" >= 0
    AND "importedRows" + "duplicateRows" + "failedRows" = "totalRows"
    AND (
      ("status" = 'COMMITTED' AND "importedRows" = "totalRows" AND "duplicateRows" = 0 AND "failedRows" = 0)
      OR ("status" = 'PARTIAL' AND "importedRows" > 0 AND "duplicateRows" + "failedRows" > 0)
      OR ("status" = 'FAILED' AND "importedRows" = 0)
    )
  ),
  CONSTRAINT "PmsTreasuryImportBatch_source_check" CHECK ("source" IN ('BANK', 'PAYMENT_PROVIDER', 'CASHBOOK')),
  CONSTRAINT "PmsTreasuryImportBatch_content_hash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PmsTreasuryImportBatch_text_lengths_check" CHECK (
    ("filename" IS NULL OR char_length("filename") <= 255)
    AND ("accountReference" IS NULL OR char_length("accountReference") <= 200)
  )
);

ALTER TABLE "PmsReconciliationItem"
  ADD COLUMN "importBatchId" TEXT,
  ADD COLUMN "importRowNumber" INTEGER,
  ADD CONSTRAINT "PmsReconciliationItem_import_provenance_check" CHECK (
    ("importBatchId" IS NULL AND "importRowNumber" IS NULL)
    OR ("importBatchId" IS NOT NULL AND "importRowNumber" IS NOT NULL AND "importRowNumber" > 1)
  );

ALTER TABLE "PmsTreasuryImportBatch"
  ADD CONSTRAINT "PmsTreasuryImportBatch_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsTreasuryImportBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsReconciliationItem"
  ADD CONSTRAINT "PmsReconciliationItem_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "PmsTreasuryImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PmsTreasuryImportBatch_company_source_contentHash_key"
  ON "PmsTreasuryImportBatch"("companyId", "source", "contentHash");
CREATE INDEX "PmsTreasuryImportBatch_company_createdAt_idx"
  ON "PmsTreasuryImportBatch"("companyId", "createdAt");
CREATE INDEX "PmsTreasuryImportBatch_company_status_createdAt_idx"
  ON "PmsTreasuryImportBatch"("companyId", "status", "createdAt");
CREATE INDEX "PmsTreasuryImportBatch_createdById_idx"
  ON "PmsTreasuryImportBatch"("createdById");
CREATE INDEX "PmsReconciliationItem_importBatchId_idx"
  ON "PmsReconciliationItem"("importBatchId");
CREATE UNIQUE INDEX "PmsReconciliationItem_importBatchId_importRowNumber_key"
  ON "PmsReconciliationItem"("importBatchId", "importRowNumber");

CREATE OR REPLACE FUNCTION "pms_protect_treasury_import_batch"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
      RAISE EXCEPTION 'Committed PMS treasury import batches are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Committed PMS treasury import batches cannot be deleted';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsTreasuryImportBatch_immutable_guard"
BEFORE UPDATE OR DELETE ON "PmsTreasuryImportBatch"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_treasury_import_batch"();

CREATE OR REPLACE FUNCTION "pms_protect_reconciliation_import_provenance"()
RETURNS trigger AS $$
DECLARE
  batch_company_id TEXT;
  batch_source "PmsReconciliationSource";
  batch_total_rows INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."importBatchId" IS NOT NULL THEN
      RAISE EXCEPTION 'Imported PMS reconciliation items cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."importBatchId" IS DISTINCT FROM OLD."importBatchId"
    OR NEW."importRowNumber" IS DISTINCT FROM OLD."importRowNumber"
  ) THEN
    RAISE EXCEPTION 'PMS reconciliation import provenance is immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."importBatchId" IS NOT NULL AND (
    NEW."companyId" IS DISTINCT FROM OLD."companyId"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."direction" IS DISTINCT FROM OLD."direction"
    OR NEW."externalReference" IS DISTINCT FROM OLD."externalReference"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."transactionDate" IS DISTINCT FROM OLD."transactionDate"
    OR NEW."payerReference" IS DISTINCT FROM OLD."payerReference"
    OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
    OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Imported PMS reconciliation source fields are immutable';
  END IF;

  IF NEW."importBatchId" IS NOT NULL THEN
    SELECT batch."companyId", batch."source", batch."totalRows"
      INTO batch_company_id, batch_source, batch_total_rows
    FROM "PmsTreasuryImportBatch" batch
    WHERE batch."id" = NEW."importBatchId";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Treasury import batch not found';
    END IF;

    IF batch_company_id <> NEW."companyId" OR batch_source <> NEW."source" THEN
      RAISE EXCEPTION 'Imported PMS reconciliation items must match the batch company and source';
    END IF;

    IF NEW."importRowNumber" <= 1 OR NEW."importRowNumber" > batch_total_rows + 1 THEN
      RAISE EXCEPTION 'Imported PMS reconciliation row number is outside the source statement range';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsReconciliationItem_import_provenance_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "PmsReconciliationItem"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_reconciliation_import_provenance"();

CREATE OR REPLACE FUNCTION "pms_validate_treasury_import_item_count"()
RETURNS trigger AS $$
DECLARE
  batch_id TEXT;
  expected_count INTEGER;
  actual_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'PmsTreasuryImportBatch' THEN
    batch_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    batch_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."importBatchId" ELSE NEW."importBatchId" END;
  END IF;

  IF batch_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT batch."importedRows" INTO expected_count
  FROM "PmsTreasuryImportBatch" batch
  WHERE batch."id" = batch_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO actual_count
  FROM "PmsReconciliationItem" item
  WHERE item."importBatchId" = batch_id;

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'Treasury import batch item count does not match importedRows';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PmsTreasuryImportBatch_item_count_guard"
AFTER INSERT OR UPDATE ON "PmsTreasuryImportBatch"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "pms_validate_treasury_import_item_count"();

CREATE CONSTRAINT TRIGGER "PmsReconciliationItem_import_count_guard"
AFTER INSERT OR UPDATE OR DELETE ON "PmsReconciliationItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "pms_validate_treasury_import_item_count"();
