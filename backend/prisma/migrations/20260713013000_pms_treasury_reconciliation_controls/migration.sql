-- Stage 21I-I: treasury reconciliation for incoming rent receipts and outgoing governed settlements.

CREATE TYPE "PmsReconciliationDirection" AS ENUM ('CREDIT', 'DEBIT');

ALTER TABLE "PmsReconciliationItem"
  ADD COLUMN "direction" "PmsReconciliationDirection" NOT NULL DEFAULT 'CREDIT',
  ADD COLUMN "vendorInvoiceId" TEXT,
  ADD COLUMN "ownerPayoutBatchId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PmsReconciliationItem"
    WHERE "status" = 'MATCHED' AND "paymentId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enable treasury reconciliation: an existing matched reconciliation item has no rent payment target';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PmsReconciliationItem"
    WHERE "status" <> 'MATCHED' AND "paymentId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enable treasury reconciliation: an existing non-matched reconciliation item still references a rent payment';
  END IF;

  IF EXISTS (
    SELECT "paymentId"
    FROM "PmsReconciliationItem"
    WHERE "status" = 'MATCHED' AND "paymentId" IS NOT NULL
    GROUP BY "paymentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enable treasury reconciliation: a rent payment is matched by more than one reconciliation item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PmsReconciliationItem" item
    WHERE item."status" = 'MATCHED'
      AND (
        item."matchedAt" IS NULL OR
        item."matchedById" IS NULL OR
        LENGTH(TRIM(COALESCE(item."matchReason", ''))) < 3 OR
        NOT EXISTS (
          SELECT 1
          FROM "PmsRentPayment" payment
          WHERE payment."id" = item."paymentId"
            AND payment."companyId" = item."companyId"
            AND payment."status" = 'CONFIRMED'
            AND payment."currency" = item."currency"
            AND payment."amount" = item."amount"
            AND (item."propertyId" IS NULL OR payment."propertyId" = item."propertyId")
        )
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enable treasury reconciliation: an existing matched rent payment fails actor, reason, scope, status, currency, or amount validation';
  END IF;
END;
$$;

ALTER TABLE "PmsReconciliationItem"
  ADD CONSTRAINT "PmsReconciliationItem_vendorInvoiceId_fkey"
    FOREIGN KEY ("vendorInvoiceId") REFERENCES "PmsVendorInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsReconciliationItem_ownerPayoutBatchId_fkey"
    FOREIGN KEY ("ownerPayoutBatchId") REFERENCES "PmsOwnerPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsReconciliationItem_target_cardinality_check" CHECK (
    (("paymentId" IS NOT NULL)::int + ("vendorInvoiceId" IS NOT NULL)::int + ("ownerPayoutBatchId" IS NOT NULL)::int) <= 1
    AND (
      ("status" = 'MATCHED' AND (("paymentId" IS NOT NULL)::int + ("vendorInvoiceId" IS NOT NULL)::int + ("ownerPayoutBatchId" IS NOT NULL)::int) = 1)
      OR
      ("status" <> 'MATCHED' AND "paymentId" IS NULL AND "vendorInvoiceId" IS NULL AND "ownerPayoutBatchId" IS NULL)
    )
  ),
  ADD CONSTRAINT "PmsReconciliationItem_direction_target_check" CHECK (
    ("paymentId" IS NULL OR "direction" = 'CREDIT')
    AND ("vendorInvoiceId" IS NULL OR "direction" = 'DEBIT')
    AND ("ownerPayoutBatchId" IS NULL OR "direction" = 'DEBIT')
  );

DROP INDEX "PmsReconciliationItem_companyId_status_transactionDate_idx";
CREATE INDEX "PmsReconciliationItem_companyId_status_direction_transactionDate_idx"
  ON "PmsReconciliationItem"("companyId", "status", "direction", "transactionDate");
CREATE INDEX "PmsReconciliationItem_vendorInvoiceId_idx" ON "PmsReconciliationItem"("vendorInvoiceId");
CREATE INDEX "PmsReconciliationItem_ownerPayoutBatchId_idx" ON "PmsReconciliationItem"("ownerPayoutBatchId");

CREATE UNIQUE INDEX "PmsReconciliationItem_matched_payment_key"
  ON "PmsReconciliationItem"("paymentId")
  WHERE "status" = 'MATCHED' AND "paymentId" IS NOT NULL;
CREATE UNIQUE INDEX "PmsReconciliationItem_matched_vendor_invoice_key"
  ON "PmsReconciliationItem"("vendorInvoiceId")
  WHERE "status" = 'MATCHED' AND "vendorInvoiceId" IS NOT NULL;
CREATE UNIQUE INDEX "PmsReconciliationItem_matched_owner_payout_key"
  ON "PmsReconciliationItem"("ownerPayoutBatchId")
  WHERE "status" = 'MATCHED' AND "ownerPayoutBatchId" IS NOT NULL;

CREATE OR REPLACE FUNCTION "pms_protect_reconciliation_match"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'MATCHED' THEN
      RAISE EXCEPTION 'Matched PMS reconciliation items cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'MATCHED' THEN
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
      RAISE EXCEPTION 'Matched PMS reconciliation items are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = 'MATCHED' THEN
    IF NEW."matchedAt" IS NULL OR NEW."matchedById" IS NULL OR LENGTH(TRIM(COALESCE(NEW."matchReason", ''))) < 3 THEN
      RAISE EXCEPTION 'Matched PMS reconciliation items require actor, timestamp, and reason';
    END IF;

    IF NEW."paymentId" IS NOT NULL THEN
      PERFORM 1
      FROM "PmsRentPayment" payment
      WHERE payment."id" = NEW."paymentId"
        AND payment."companyId" = NEW."companyId"
        AND payment."status" = 'CONFIRMED'
        AND payment."currency" = NEW."currency"
        AND payment."amount" = NEW."amount"
        AND (NEW."propertyId" IS NULL OR payment."propertyId" = NEW."propertyId");
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Rent-payment reconciliation target must be confirmed and match company, property, currency, and amount';
      END IF;
    ELSIF NEW."vendorInvoiceId" IS NOT NULL THEN
      PERFORM 1
      FROM "PmsVendorInvoice" invoice
      WHERE invoice."id" = NEW."vendorInvoiceId"
        AND invoice."companyId" = NEW."companyId"
        AND invoice."propertyId" = NEW."propertyId"
        AND invoice."status" = 'PAID'
        AND invoice."paidAmount" > 0
        AND invoice."currency" = NEW."currency"
        AND invoice."paidAmount" = NEW."amount";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor-invoice reconciliation target must be paid and match company, property, currency, and amount';
      END IF;
    ELSIF NEW."ownerPayoutBatchId" IS NOT NULL THEN
      IF NEW."propertyId" IS NOT NULL THEN
        RAISE EXCEPTION 'Owner-payout reconciliation items must be company-wide';
      END IF;
      PERFORM 1
      FROM "PmsOwnerPayoutBatch" payout
      WHERE payout."id" = NEW."ownerPayoutBatchId"
        AND payout."companyId" = NEW."companyId"
        AND payout."status" = 'PAID_MANUAL'
        AND payout."payoutAmount" > 0
        AND payout."currency" = NEW."currency"
        AND payout."payoutAmount" = NEW."amount";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Owner-payout reconciliation target must be paid and match company, currency, and amount';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsReconciliationItem_match_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "PmsReconciliationItem"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_reconciliation_match"();
