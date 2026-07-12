-- Stage 21I-H: governed vendor invoices and evidence-backed accounts payable.

ALTER TYPE "PmsAccountingSource" ADD VALUE IF NOT EXISTS 'VENDOR_INVOICE';

CREATE TYPE "PmsVendorInvoiceStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'NEEDS_REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REJECTED',
  'VOID'
);

CREATE TABLE "PmsVendorInvoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "externalInvoiceNumber" TEXT,
  "status" "PmsVendorInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "subtotalAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "approvedAmount" DECIMAL(14,3),
  "paidAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "processingAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "paymentMethodNote" TEXT,
  "failureReason" TEXT,
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "approvedQuoteId" TEXT,
  "createdById" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "processingById" TEXT,
  "paidById" TEXT,
  "rejectedById" TEXT,
  "voidedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsVendorInvoice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PmsVendorInvoice"
  ADD CONSTRAINT "PmsVendorInvoice_amounts_check" CHECK (
    "subtotalAmount" >= 0 AND
    "taxAmount" >= 0 AND
    "totalAmount" > 0 AND
    "subtotalAmount" + "taxAmount" = "totalAmount" AND
    ("approvedAmount" IS NULL OR ("approvedAmount" > 0 AND "approvedAmount" <= "totalAmount")) AND
    "paidAmount" >= 0 AND
    "paidAmount" <= COALESCE("approvedAmount", "totalAmount")
  ),
  ADD CONSTRAINT "PmsVendorInvoice_dates_check" CHECK ("dueDate" >= "issueDate"),
  ADD CONSTRAINT "PmsVendorInvoice_state_check" CHECK (
    ("status" NOT IN ('SUBMITTED', 'NEEDS_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED') OR ("submittedAt" IS NOT NULL AND "submittedById" IS NOT NULL)) AND
    ("status" <> 'NEEDS_REVIEW' OR ("reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)) AND
    ("status" NOT IN ('APPROVED', 'PROCESSING', 'PAID', 'FAILED') OR ("approvedAmount" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL)) AND
    ("status" NOT IN ('PROCESSING', 'PAID', 'FAILED') OR ("processingAt" IS NOT NULL AND "processingById" IS NOT NULL AND "paymentReference" IS NOT NULL AND "paymentMethodNote" IS NOT NULL)) AND
    ("status" <> 'PAID' OR ("paidAmount" > 0 AND "paidAt" IS NOT NULL AND "paidById" IS NOT NULL)) AND
    ("status" <> 'FAILED' OR ("failedAt" IS NOT NULL AND LENGTH(TRIM("failureReason")) >= 3)) AND
    ("status" <> 'REJECTED' OR ("rejectedAt" IS NOT NULL AND "rejectedById" IS NOT NULL AND LENGTH(TRIM("failureReason")) >= 3)) AND
    ("status" <> 'VOID' OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND LENGTH(TRIM("failureReason")) >= 3))
  );

ALTER TABLE "PmsDocument" ADD COLUMN "vendorInvoiceId" TEXT;
ALTER TABLE "PmsAccountingLedgerEntry" ADD COLUMN "vendorInvoiceId" TEXT;

CREATE UNIQUE INDEX "PmsVendorInvoice_companyId_vendorId_invoiceNumber_key"
  ON "PmsVendorInvoice"("companyId", "vendorId", "invoiceNumber");
CREATE INDEX "PmsVendorInvoice_companyId_status_dueDate_idx"
  ON "PmsVendorInvoice"("companyId", "status", "dueDate");
CREATE INDEX "PmsVendorInvoice_companyId_propertyId_status_idx"
  ON "PmsVendorInvoice"("companyId", "propertyId", "status");
CREATE INDEX "PmsVendorInvoice_vendorId_status_idx"
  ON "PmsVendorInvoice"("vendorId", "status");
CREATE INDEX "PmsVendorInvoice_workOrderId_idx"
  ON "PmsVendorInvoice"("workOrderId");
CREATE INDEX "PmsVendorInvoice_approvedQuoteId_idx"
  ON "PmsVendorInvoice"("approvedQuoteId");
CREATE INDEX "PmsDocument_vendorInvoiceId_idx" ON "PmsDocument"("vendorInvoiceId");
CREATE UNIQUE INDEX "PmsAccountingLedgerEntry_vendorInvoiceId_key"
  ON "PmsAccountingLedgerEntry"("vendorInvoiceId");

ALTER TABLE "PmsVendorInvoice"
  ADD CONSTRAINT "PmsVendorInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_approvedQuoteId_fkey" FOREIGN KEY ("approvedQuoteId") REFERENCES "PmsMaintenanceQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_processingById_fkey" FOREIGN KEY ("processingById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsVendorInvoice_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsDocument"
  ADD CONSTRAINT "PmsDocument_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "PmsVendorInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAccountingLedgerEntry"
  ADD CONSTRAINT "PmsAccountingLedgerEntry_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "PmsVendorInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "pms_require_vendor_invoice_draft_insert"()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'PMS vendor invoices must be created as drafts and submitted through a governed transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsVendorInvoice_draft_insert_only"
BEFORE INSERT ON "PmsVendorInvoice"
FOR EACH ROW EXECUTE FUNCTION "pms_require_vendor_invoice_draft_insert"();

CREATE OR REPLACE FUNCTION "pms_protect_vendor_invoice_financials"()
RETURNS trigger AS $$
BEGIN
  IF NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'PMS vendor invoice creation audit fields are immutable';
  END IF;
  IF OLD."submittedAt" IS NOT NULL AND (NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt" OR NEW."submittedById" IS DISTINCT FROM OLD."submittedById") THEN
    RAISE EXCEPTION 'PMS vendor invoice submission audit fields are immutable';
  END IF;
  IF OLD."reviewedAt" IS NOT NULL AND (NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" OR NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById") THEN
    RAISE EXCEPTION 'PMS vendor invoice review audit fields are immutable';
  END IF;
  IF OLD."approvedById" IS NOT NULL AND NEW."approvedById" IS DISTINCT FROM OLD."approvedById" THEN
    RAISE EXCEPTION 'PMS vendor invoice approver is immutable';
  END IF;
  IF OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    AND NOT (OLD."status" = 'FAILED' AND NEW."status" = 'APPROVED') THEN
    RAISE EXCEPTION 'PMS vendor invoice approval timestamp is immutable outside a governed retry';
  END IF;
  IF OLD."processingAt" IS NOT NULL
    AND (NEW."processingAt" IS DISTINCT FROM OLD."processingAt" OR NEW."processingById" IS DISTINCT FROM OLD."processingById")
    AND NOT (OLD."status" = 'FAILED' AND NEW."status" = 'APPROVED' AND NEW."processingAt" IS NULL AND NEW."processingById" IS NULL) THEN
    RAISE EXCEPTION 'PMS vendor invoice processing audit fields are immutable outside a governed retry';
  END IF;

  IF OLD."status" IN ('PAID', 'VOID') THEN
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
      RAISE EXCEPTION '% PMS vendor invoices are immutable', INITCAP(LOWER(OLD."status"::text));
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" <> 'DRAFT' OR NEW."status" IN ('SUBMITTED', 'VOID') THEN
    IF NEW."invoiceNumber" IS DISTINCT FROM OLD."invoiceNumber"
      OR NEW."externalInvoiceNumber" IS DISTINCT FROM OLD."externalInvoiceNumber"
      OR NEW."issueDate" IS DISTINCT FROM OLD."issueDate"
      OR NEW."dueDate" IS DISTINCT FROM OLD."dueDate"
      OR NEW."currency" IS DISTINCT FROM OLD."currency"
      OR NEW."subtotalAmount" IS DISTINCT FROM OLD."subtotalAmount"
      OR NEW."taxAmount" IS DISTINCT FROM OLD."taxAmount"
      OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
      OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
      OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
      OR NEW."vendorId" IS DISTINCT FROM OLD."vendorId"
      OR NEW."workOrderId" IS DISTINCT FROM OLD."workOrderId"
      OR NEW."approvedQuoteId" IS DISTINCT FROM OLD."approvedQuoteId" THEN
      RAISE EXCEPTION 'Submitted PMS vendor invoice financial composition is immutable';
    END IF;
  END IF;

  IF NEW."approvedAmount" IS DISTINCT FROM OLD."approvedAmount"
    AND NOT (OLD."status" = 'NEEDS_REVIEW' AND NEW."status" = 'APPROVED') THEN
    RAISE EXCEPTION 'PMS vendor invoice approved amount can only be set during approval';
  END IF;

  IF OLD."status" = 'DRAFT' AND NEW."status" NOT IN ('DRAFT', 'SUBMITTED', 'VOID') THEN
    RAISE EXCEPTION 'Draft PMS vendor invoices can only be submitted or voided';
  ELSIF OLD."status" = 'SUBMITTED' AND NEW."status" NOT IN ('SUBMITTED', 'NEEDS_REVIEW', 'REJECTED') THEN
    RAISE EXCEPTION 'Submitted PMS vendor invoices can only enter review or be rejected';
  ELSIF OLD."status" = 'NEEDS_REVIEW' AND NEW."status" NOT IN ('NEEDS_REVIEW', 'APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Reviewed PMS vendor invoices can only be approved or rejected';
  ELSIF OLD."status" = 'REJECTED' AND NEW."status" NOT IN ('REJECTED', 'VOID') THEN
    RAISE EXCEPTION 'Rejected PMS vendor invoices can only be voided';
  ELSIF OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('APPROVED', 'PROCESSING') THEN
    RAISE EXCEPTION 'Approved PMS vendor invoices can only enter payment processing';
  ELSIF OLD."status" = 'PROCESSING' AND NEW."status" NOT IN ('PROCESSING', 'PAID', 'FAILED') THEN
    RAISE EXCEPTION 'Processing PMS vendor invoices can only be paid or failed';
  ELSIF OLD."status" = 'FAILED' AND NEW."status" NOT IN ('FAILED', 'APPROVED') THEN
    RAISE EXCEPTION 'Failed PMS vendor invoices can only be retried';
  END IF;

  IF OLD."status" = 'DRAFT' AND NEW."status" = 'SUBMITTED' AND NOT EXISTS (
    SELECT 1 FROM "PmsDocument" document
    WHERE document."vendorInvoiceId" = NEW."id"
      AND document."type" = 'MAINTENANCE_INVOICE'
      AND document."status" <> 'ARCHIVED'
      AND document."scanStatus" NOT IN ('QUARANTINED', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'Submitted PMS vendor invoices require immutable invoice evidence';
  END IF;

  IF OLD."status" = 'NEEDS_REVIEW' AND NEW."status" = 'APPROVED' AND NOT EXISTS (
    SELECT 1 FROM "PmsDocument" document
    WHERE document."vendorInvoiceId" = NEW."id"
      AND document."type" = 'MAINTENANCE_INVOICE'
      AND document."status" <> 'ARCHIVED'
      AND document."scanStatus" NOT IN ('QUARANTINED', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'Approved PMS vendor invoices require immutable invoice evidence';
  END IF;

  IF OLD."status" = 'APPROVED' AND NEW."status" = 'PROCESSING' AND NOT EXISTS (
    SELECT 1 FROM "PmsDocument" document
    WHERE document."vendorInvoiceId" = NEW."id"
      AND document."type" = 'OTHER'
      AND document."status" <> 'ARCHIVED'
      AND document."scanStatus" NOT IN ('QUARANTINED', 'FAILED')
      AND document."createdAt" >= NEW."approvedAt"
  ) THEN
    RAISE EXCEPTION 'Vendor payment submission requires fresh immutable payment evidence';
  END IF;

  IF OLD."status" = 'PROCESSING' AND NEW."status" = 'PAID' AND NOT EXISTS (
    SELECT 1 FROM "PmsDocument" document
    WHERE document."vendorInvoiceId" = NEW."id"
      AND document."type" = 'OTHER'
      AND document."status" <> 'ARCHIVED'
      AND document."scanStatus" NOT IN ('QUARANTINED', 'FAILED')
      AND document."createdAt" >= OLD."processingAt"
  ) THEN
    RAISE EXCEPTION 'Paid PMS vendor invoices require fresh immutable settlement evidence';
  END IF;

  IF NEW."status" = 'PAID' AND OLD."status" <> 'PAID' AND NOT EXISTS (
    SELECT 1
    FROM "PmsAccountingLedgerEntry" ledger
    WHERE ledger."vendorInvoiceId" = NEW."id"
      AND ledger."source" = 'VENDOR_INVOICE'
      AND ledger."type" = 'EXPENSE'
      AND ledger."currency" = NEW."currency"
      AND ledger."amount" = NEW."paidAmount"
  ) THEN
    RAISE EXCEPTION 'Paid PMS vendor invoices require a matching immutable accounting expense';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsVendorInvoice_financial_immutability"
BEFORE UPDATE ON "PmsVendorInvoice"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_vendor_invoice_financials"();

CREATE OR REPLACE FUNCTION "pms_protect_governed_vendor_invoice_document"()
RETURNS trigger AS $$
BEGIN
  IF OLD."vendorInvoiceId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "PmsVendorInvoice" invoice
    WHERE invoice."id" = OLD."vendorInvoiceId" AND invoice."status" <> 'DRAFT'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Governed PMS vendor invoice evidence cannot be deleted';
    END IF;
    IF NEW."vendorInvoiceId" IS DISTINCT FROM OLD."vendorInvoiceId"
      OR NEW."type" IS DISTINCT FROM OLD."type"
      OR NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."fileUrl" IS DISTINCT FROM OLD."fileUrl"
      OR NEW."storageDriver" IS DISTINCT FROM OLD."storageDriver"
      OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
      OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename"
      OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType"
      OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
      OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
      OR NEW."fileVersion" IS DISTINCT FROM OLD."fileVersion" THEN
      RAISE EXCEPTION 'Governed PMS vendor invoice evidence is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsDocument_vendor_invoice_evidence_immutability"
BEFORE UPDATE OR DELETE ON "PmsDocument"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_governed_vendor_invoice_document"();

CREATE OR REPLACE FUNCTION "pms_protect_paid_vendor_invoice_ledger"()
RETURNS trigger AS $$
BEGIN
  IF OLD."vendorInvoiceId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "PmsVendorInvoice" invoice
    WHERE invoice."id" = OLD."vendorInvoiceId" AND invoice."status" = 'PAID'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Paid PMS vendor invoice accounting expenses cannot be deleted';
    END IF;
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
      RAISE EXCEPTION 'Paid PMS vendor invoice accounting expenses are immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsAccountingLedgerEntry_vendor_invoice_immutability"
BEFORE UPDATE OR DELETE ON "PmsAccountingLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_paid_vendor_invoice_ledger"();

CREATE OR REPLACE FUNCTION "pms_prevent_governed_vendor_invoice_delete"()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'Submitted PMS vendor invoices cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsVendorInvoice_delete_protection"
BEFORE DELETE ON "PmsVendorInvoice"
FOR EACH ROW EXECUTE FUNCTION "pms_prevent_governed_vendor_invoice_delete"();
