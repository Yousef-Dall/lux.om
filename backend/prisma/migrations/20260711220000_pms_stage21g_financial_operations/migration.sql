-- Stage 21G: advanced PMS finance, portals, assets, preventive maintenance, and inspections
-- This migration is additive and includes compatibility backfills for legacy rent schedules/payments.

ALTER TYPE "PmsMaintenanceStatus" ADD VALUE IF NOT EXISTS 'COMPLETION_REQUESTED';

CREATE TYPE "PmsChargeCategory" AS ENUM ('RENT', 'UTILITIES', 'SERVICE_CHARGE', 'LATE_FEE', 'MAINTENANCE', 'DEPOSIT_DEDUCTION', 'DISCOUNT', 'MANUAL_ADJUSTMENT', 'OTHER');
CREATE TYPE "PmsChargeStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "PmsChargeAdjustmentType" AS ENUM ('DISCOUNT', 'WRITE_OFF', 'REVERSAL', 'MANUAL');
CREATE TYPE "PmsCreditNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED', 'VOID');
CREATE TYPE "PmsPaymentAllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TYPE "PmsPaymentAdjustmentType" AS ENUM ('REFUND', 'REVERSAL', 'CHARGEBACK', 'WRITE_OFF');
CREATE TYPE "PmsPaymentAdjustmentStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "PmsSecurityDepositStatus" AS ENUM ('EXPECTED', 'HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CLOSED');
CREATE TYPE "PmsSecurityDepositTransactionType" AS ENUM ('COLLECTION', 'DEDUCTION', 'REFUND', 'CONVERSION_TO_INCOME', 'ADJUSTMENT');
CREATE TYPE "PmsSecurityDepositTransactionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'VOID');
CREATE TYPE "PmsFinancialPeriodStatus" AS ENUM ('OPEN', 'REVIEWING', 'CLOSED');
CREATE TYPE "PmsReconciliationSource" AS ENUM ('BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL');
CREATE TYPE "PmsReconciliationStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'DUPLICATE', 'IGNORED');
CREATE TYPE "PmsOwnerPayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSING', 'PAID_MANUAL', 'FAILED', 'CANCELLED');
CREATE TYPE "PmsAssetStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'RETIRED', 'DISPOSED');
CREATE TYPE "PmsAssetEventType" AS ENUM ('CREATED', 'UPDATED', 'SERVICED', 'REPAIRED', 'WARRANTY_CLAIM', 'RETIRED', 'DISPOSED');
CREATE TYPE "PmsMaintenancePlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PmsInspectionType" AS ENUM ('GENERAL', 'MOVE_IN', 'MOVE_OUT', 'PERIODIC', 'SAFETY');
CREATE TYPE "PmsInspectionItemResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE', 'OBSERVATION');
CREATE TYPE "PmsInspectionDefectStatus" AS ENUM ('OPEN', 'WORK_ORDER_CREATED', 'RESOLVED', 'WAIVED');

ALTER TABLE "PmsRentPayment" ALTER COLUMN "rentDueItemId" DROP NOT NULL;
ALTER TABLE "PmsRentPayment" DROP CONSTRAINT IF EXISTS "PmsRentPayment_rentDueItemId_fkey";
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "PmsRentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsAccountingLedgerEntry" ADD COLUMN "chargeId" TEXT;
ALTER TABLE "PmsAccountingLedgerEntry" ADD COLUMN "securityDepositTransactionId" TEXT;
ALTER TABLE "PmsAccountingLedgerEntry" ADD COLUMN "ownerPayoutBatchId" TEXT;

ALTER TABLE "PmsDocument" ADD COLUMN "chargeId" TEXT;
ALTER TABLE "PmsDocument" ADD COLUMN "securityDepositTransactionId" TEXT;
ALTER TABLE "PmsDocument" ADD COLUMN "ownerPayoutBatchId" TEXT;
ALTER TABLE "PmsDocument" ADD COLUMN "assetId" TEXT;
ALTER TABLE "PmsDocument" ADD COLUMN "statementId" TEXT;
ALTER TABLE "PmsDocument" ADD COLUMN "inspectionDefectId" TEXT;

ALTER TABLE "PmsInspection" ADD COLUMN "type" "PmsInspectionType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "PmsInspection" ADD COLUMN "acknowledgement" JSONB;
ALTER TABLE "PmsInspection" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);
ALTER TABLE "PmsInspection" ADD COLUMN "templateId" TEXT;

ALTER TABLE "PmsWorkOrder" ADD COLUMN "preventiveGenerationKey" TEXT;
ALTER TABLE "PmsWorkOrder" ADD COLUMN "assetId" TEXT;
ALTER TABLE "PmsWorkOrder" ADD COLUMN "maintenancePlanId" TEXT;
CREATE UNIQUE INDEX "PmsWorkOrder_preventiveGenerationKey_key" ON "PmsWorkOrder"("preventiveGenerationKey");

CREATE TABLE "PmsCharge" (
    "id" TEXT NOT NULL,
    "chargeNumber" TEXT NOT NULL,
    "status" "PmsChargeStatus" DEFAULT 'DRAFT' NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'OMR' NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "servicePeriodStart" TIMESTAMP(3),
    "servicePeriodEnd" TIMESTAMP(3),
    "subtotal" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "adjustmentTotal" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "creditedAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "paidAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "totalAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "balanceAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "sourceRentDueItemId" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsChargeLine" (
    "id" TEXT NOT NULL,
    "category" "PmsChargeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) DEFAULT 1 NOT NULL,
    "unitAmount" DECIMAL(14,3) NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "position" INTEGER DEFAULT 0 NOT NULL,
    "servicePeriodStart" TIMESTAMP(3),
    "servicePeriodEnd" TIMESTAMP(3),
    "metadata" JSONB,
    "companyId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsChargeLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsChargeAdjustment" (
    "id" TEXT NOT NULL,
    "type" "PmsChargeAdjustmentType" NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "createdById" TEXT,
    "reversedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsChargeAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsCreditNote" (
    "id" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "status" "PmsCreditNoteStatus" DEFAULT 'DRAFT' NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "remainingAmount" DECIMAL(14,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "chargeId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsCreditNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsPaymentAllocation" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PmsPaymentAllocationStatus" DEFAULT 'ACTIVE' NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "createdById" TEXT,
    "reversedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsPaymentAdjustment" (
    "id" TEXT NOT NULL,
    "type" "PmsPaymentAdjustmentType" NOT NULL,
    "status" "PmsPaymentAdjustmentStatus" DEFAULT 'POSTED' NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "reversedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "allocationId" TEXT,
    "createdById" TEXT,
    "reversedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsPaymentAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsSecurityDepositAccount" (
    "id" TEXT NOT NULL,
    "status" "PmsSecurityDepositStatus" DEFAULT 'EXPECTED' NOT NULL,
    "expectedAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "liabilityBalance" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsSecurityDepositAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsSecurityDepositTransaction" (
    "id" TEXT NOT NULL,
    "type" "PmsSecurityDepositTransactionType" NOT NULL,
    "status" "PmsSecurityDepositTransactionStatus" DEFAULT 'DRAFT' NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "chargeId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsSecurityDepositTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsFinancialPeriod" (
    "id" TEXT NOT NULL,
    "status" "PmsFinancialPeriodStatus" DEFAULT 'OPEN' NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "closeReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsFinancialPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsFinancialPeriodEvent" (
    "id" TEXT NOT NULL,
    "fromStatus" "PmsFinancialPeriodStatus",
    "toStatus" "PmsFinancialPeriodStatus" NOT NULL,
    "reason" TEXT,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsFinancialPeriodEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsReconciliationItem" (
    "id" TEXT NOT NULL,
    "source" "PmsReconciliationSource" NOT NULL,
    "status" "PmsReconciliationStatus" DEFAULT 'UNMATCHED' NOT NULL,
    "externalReference" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "payerReference" TEXT,
    "metadata" JSONB,
    "matchedAt" TIMESTAMP(3),
    "matchReason" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "paymentId" TEXT,
    "duplicateOfId" TEXT,
    "createdById" TEXT,
    "matchedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsReconciliationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsOwnerPortalAccess" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true NOT NULL,
    "canApproveQuotes" BOOLEAN DEFAULT false NOT NULL,
    "canViewMaintenanceCosts" BOOLEAN DEFAULT true NOT NULL,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsOwnerPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsOwnerPayoutBatch" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "status" "PmsOwnerPayoutStatus" DEFAULT 'DRAFT' NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "grossAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "managementFeeAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "reservedAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "payoutAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payoutReference" TEXT,
    "paymentMethodNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "paidById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsOwnerPayoutBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsOwnerPayoutLine" (
    "id" TEXT NOT NULL,
    "incomeAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "expenseAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "managementFeeAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "reservedAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "netAmount" DECIMAL(14,3) DEFAULT 0 NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "payoutBatchId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "statementId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsOwnerPayoutLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsVendorPortalAccess" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsVendorPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "installationDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "serviceIntervalDays" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "status" "PmsAssetStatus" DEFAULT 'ACTIVE' NOT NULL,
    "purchaseCost" DECIMAL(14,3),
    "currency" VARCHAR(3) DEFAULT 'OMR' NOT NULL,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "vendorId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsAssetEvent" (
    "id" TEXT NOT NULL,
    "type" "PmsAssetEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "cost" DECIMAL(14,3),
    "currency" VARCHAR(3),
    "notes" TEXT,
    "metadata" JSONB,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsAssetEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsMaintenancePlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PmsMaintenancePlanStatus" DEFAULT 'ACTIVE' NOT NULL,
    "intervalDays" INTEGER,
    "nextServiceDate" TIMESTAMP(3) NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3),
    "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "slaHours" INTEGER,
    "priority" "PmsMaintenancePriority" DEFAULT 'MEDIUM' NOT NULL,
    "estimatedCost" DECIMAL(14,3),
    "currency" VARCHAR(3) DEFAULT 'OMR' NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "assetId" TEXT,
    "vendorId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsMaintenancePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspectionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PmsInspectionType" DEFAULT 'GENERAL' NOT NULL,
    "active" BOOLEAN DEFAULT true NOT NULL,
    "version" INTEGER DEFAULT 1 NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsInspectionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspectionTemplateSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER DEFAULT 0 NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsInspectionTemplateSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "position" INTEGER DEFAULT 0 NOT NULL,
    "required" BOOLEAN DEFAULT true NOT NULL,
    "requiresPhotoOnFailure" BOOLEAN DEFAULT false NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PmsInspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspectionResult" (
    "id" TEXT NOT NULL,
    "result" "PmsInspectionItemResult" NOT NULL,
    "valueText" TEXT,
    "notes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "acknowledgedByName" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsInspectionResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspectionDefect" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "PmsMaintenancePriority" DEFAULT 'MEDIUM' NOT NULL,
    "status" "PmsInspectionDefectStatus" DEFAULT 'OPEN' NOT NULL,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "resultId" TEXT,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "workOrderId" TEXT,
    "convertedById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PmsInspectionDefect_pkey" PRIMARY KEY ("id")
);

-- Indexes and uniqueness constraints
CREATE UNIQUE INDEX "PmsCharge_sourceRentDueItemId_key" ON "PmsCharge"("sourceRentDueItemId");
CREATE UNIQUE INDEX "PmsCharge_companyId_chargeNumber_key" ON "PmsCharge"("companyId", "chargeNumber");
CREATE INDEX "PmsCharge_companyId_status_dueDate_idx" ON "PmsCharge"("companyId", "status", "dueDate");
CREATE INDEX "PmsCharge_propertyId_status_dueDate_idx" ON "PmsCharge"("propertyId", "status", "dueDate");
CREATE INDEX "PmsCharge_tenantId_status_idx" ON "PmsCharge"("tenantId", "status");
CREATE INDEX "PmsCharge_leaseId_idx" ON "PmsCharge"("leaseId");
CREATE INDEX "PmsChargeLine_companyId_category_idx" ON "PmsChargeLine"("companyId", "category");
CREATE INDEX "PmsChargeLine_chargeId_position_idx" ON "PmsChargeLine"("chargeId", "position");
CREATE INDEX "PmsChargeAdjustment_companyId_type_idx" ON "PmsChargeAdjustment"("companyId", "type");
CREATE INDEX "PmsChargeAdjustment_chargeId_active_idx" ON "PmsChargeAdjustment"("chargeId", "active");
CREATE UNIQUE INDEX "PmsCreditNote_companyId_creditNumber_key" ON "PmsCreditNote"("companyId", "creditNumber");
CREATE INDEX "PmsCreditNote_companyId_status_idx" ON "PmsCreditNote"("companyId", "status");
CREATE INDEX "PmsCreditNote_tenantId_status_idx" ON "PmsCreditNote"("tenantId", "status");
CREATE INDEX "PmsCreditNote_chargeId_idx" ON "PmsCreditNote"("chargeId");
CREATE UNIQUE INDEX "PmsPaymentAllocation_companyId_idempotencyKey_key" ON "PmsPaymentAllocation"("companyId", "idempotencyKey");
CREATE INDEX "PmsPaymentAllocation_paymentId_status_idx" ON "PmsPaymentAllocation"("paymentId", "status");
CREATE INDEX "PmsPaymentAllocation_chargeId_status_idx" ON "PmsPaymentAllocation"("chargeId", "status");
CREATE UNIQUE INDEX "PmsPaymentAdjustment_companyId_idempotencyKey_key" ON "PmsPaymentAdjustment"("companyId", "idempotencyKey");
CREATE INDEX "PmsPaymentAdjustment_paymentId_status_idx" ON "PmsPaymentAdjustment"("paymentId", "status");
CREATE INDEX "PmsPaymentAdjustment_allocationId_idx" ON "PmsPaymentAdjustment"("allocationId");
CREATE UNIQUE INDEX "PmsSecurityDepositAccount_leaseId_key" ON "PmsSecurityDepositAccount"("leaseId");
CREATE INDEX "PmsSecurityDepositAccount_companyId_status_idx" ON "PmsSecurityDepositAccount"("companyId", "status");
CREATE INDEX "PmsSecurityDepositAccount_propertyId_status_idx" ON "PmsSecurityDepositAccount"("propertyId", "status");
CREATE INDEX "PmsSecurityDepositAccount_tenantId_idx" ON "PmsSecurityDepositAccount"("tenantId");
CREATE UNIQUE INDEX "PmsSecurityDepositTransaction_companyId_idempotencyKey_key" ON "PmsSecurityDepositTransaction"("companyId", "idempotencyKey");
CREATE INDEX "PmsSecurityDepositTransaction_accountId_status_idx" ON "PmsSecurityDepositTransaction"("accountId", "status");
CREATE INDEX "PmsSecurityDepositTransaction_paymentId_idx" ON "PmsSecurityDepositTransaction"("paymentId");
CREATE INDEX "PmsSecurityDepositTransaction_chargeId_idx" ON "PmsSecurityDepositTransaction"("chargeId");
CREATE UNIQUE INDEX "PmsFinancialPeriod_companyId_propertyId_periodStart_periodEnd_currency_key" ON "PmsFinancialPeriod"("companyId", "propertyId", "periodStart", "periodEnd", "currency");
CREATE UNIQUE INDEX "PmsFinancialPeriod_company_global_period_currency_key" ON "PmsFinancialPeriod"("companyId", "periodStart", "periodEnd", "currency") WHERE "propertyId" IS NULL;
CREATE INDEX "PmsFinancialPeriod_companyId_status_periodStart_idx" ON "PmsFinancialPeriod"("companyId", "status", "periodStart");
CREATE INDEX "PmsFinancialPeriod_propertyId_status_periodStart_idx" ON "PmsFinancialPeriod"("propertyId", "status", "periodStart");
CREATE INDEX "PmsFinancialPeriodEvent_companyId_createdAt_idx" ON "PmsFinancialPeriodEvent"("companyId", "createdAt");
CREATE INDEX "PmsFinancialPeriodEvent_periodId_createdAt_idx" ON "PmsFinancialPeriodEvent"("periodId", "createdAt");
CREATE UNIQUE INDEX "PmsReconciliationItem_companyId_source_externalReference_key" ON "PmsReconciliationItem"("companyId", "source", "externalReference");
CREATE INDEX "PmsReconciliationItem_companyId_status_transactionDate_idx" ON "PmsReconciliationItem"("companyId", "status", "transactionDate");
CREATE INDEX "PmsReconciliationItem_paymentId_idx" ON "PmsReconciliationItem"("paymentId");
CREATE INDEX "PmsReconciliationItem_duplicateOfId_idx" ON "PmsReconciliationItem"("duplicateOfId");
CREATE UNIQUE INDEX "PmsOwnerPortalAccess_propertyId_userId_key" ON "PmsOwnerPortalAccess"("propertyId", "userId");
CREATE INDEX "PmsOwnerPortalAccess_companyId_active_idx" ON "PmsOwnerPortalAccess"("companyId", "active");
CREATE INDEX "PmsOwnerPortalAccess_userId_active_idx" ON "PmsOwnerPortalAccess"("userId", "active");
CREATE UNIQUE INDEX "PmsOwnerPayoutBatch_companyId_payoutNumber_key" ON "PmsOwnerPayoutBatch"("companyId", "payoutNumber");
CREATE INDEX "PmsOwnerPayoutBatch_companyId_status_periodEnd_idx" ON "PmsOwnerPayoutBatch"("companyId", "status", "periodEnd");
CREATE INDEX "PmsOwnerPayoutBatch_ownerUserId_status_idx" ON "PmsOwnerPayoutBatch"("ownerUserId", "status");
CREATE UNIQUE INDEX "PmsOwnerPayoutLine_payoutBatchId_propertyId_key" ON "PmsOwnerPayoutLine"("payoutBatchId", "propertyId");
CREATE INDEX "PmsOwnerPayoutLine_companyId_propertyId_idx" ON "PmsOwnerPayoutLine"("companyId", "propertyId");
CREATE INDEX "PmsOwnerPayoutLine_statementId_idx" ON "PmsOwnerPayoutLine"("statementId");
CREATE UNIQUE INDEX "PmsVendorPortalAccess_vendorId_userId_key" ON "PmsVendorPortalAccess"("vendorId", "userId");
CREATE INDEX "PmsVendorPortalAccess_companyId_active_idx" ON "PmsVendorPortalAccess"("companyId", "active");
CREATE INDEX "PmsVendorPortalAccess_userId_active_idx" ON "PmsVendorPortalAccess"("userId", "active");
CREATE UNIQUE INDEX "PmsAsset_companyId_assetCode_key" ON "PmsAsset"("companyId", "assetCode");
CREATE INDEX "PmsAsset_propertyId_status_idx" ON "PmsAsset"("propertyId", "status");
CREATE INDEX "PmsAsset_unitId_idx" ON "PmsAsset"("unitId");
CREATE INDEX "PmsAsset_vendorId_idx" ON "PmsAsset"("vendorId");
CREATE INDEX "PmsAsset_warrantyExpiry_idx" ON "PmsAsset"("warrantyExpiry");
CREATE INDEX "PmsAsset_nextServiceDate_idx" ON "PmsAsset"("nextServiceDate");
CREATE INDEX "PmsAssetEvent_companyId_occurredAt_idx" ON "PmsAssetEvent"("companyId", "occurredAt");
CREATE INDEX "PmsAssetEvent_assetId_occurredAt_idx" ON "PmsAssetEvent"("assetId", "occurredAt");
CREATE INDEX "PmsMaintenancePlan_companyId_status_nextServiceDate_idx" ON "PmsMaintenancePlan"("companyId", "status", "nextServiceDate");
CREATE INDEX "PmsMaintenancePlan_propertyId_status_idx" ON "PmsMaintenancePlan"("propertyId", "status");
CREATE INDEX "PmsMaintenancePlan_assetId_idx" ON "PmsMaintenancePlan"("assetId");
CREATE INDEX "PmsMaintenancePlan_vendorId_idx" ON "PmsMaintenancePlan"("vendorId");
CREATE UNIQUE INDEX "PmsInspectionTemplate_companyId_name_version_key" ON "PmsInspectionTemplate"("companyId", "name", "version");
CREATE INDEX "PmsInspectionTemplate_companyId_active_type_idx" ON "PmsInspectionTemplate"("companyId", "active", "type");
CREATE INDEX "PmsInspectionTemplate_propertyId_idx" ON "PmsInspectionTemplate"("propertyId");
CREATE INDEX "PmsInspectionTemplateSection_templateId_position_idx" ON "PmsInspectionTemplateSection"("templateId", "position");
CREATE INDEX "PmsInspectionTemplateItem_sectionId_position_idx" ON "PmsInspectionTemplateItem"("sectionId", "position");
CREATE UNIQUE INDEX "PmsInspectionResult_inspectionId_templateItemId_key" ON "PmsInspectionResult"("inspectionId", "templateItemId");
CREATE INDEX "PmsInspectionResult_companyId_result_idx" ON "PmsInspectionResult"("companyId", "result");
CREATE INDEX "PmsInspectionResult_templateItemId_idx" ON "PmsInspectionResult"("templateItemId");
CREATE UNIQUE INDEX "PmsInspectionDefect_workOrderId_key" ON "PmsInspectionDefect"("workOrderId");
CREATE INDEX "PmsInspectionDefect_companyId_status_idx" ON "PmsInspectionDefect"("companyId", "status");
CREATE INDEX "PmsInspectionDefect_inspectionId_status_idx" ON "PmsInspectionDefect"("inspectionId", "status");
CREATE INDEX "PmsInspectionDefect_propertyId_idx" ON "PmsInspectionDefect"("propertyId");
CREATE INDEX "PmsInspectionDefect_unitId_idx" ON "PmsInspectionDefect"("unitId");
CREATE INDEX "PmsInspectionDefect_leaseId_idx" ON "PmsInspectionDefect"("leaseId");

CREATE INDEX "PmsAccountingLedgerEntry_chargeId_idx" ON "PmsAccountingLedgerEntry"("chargeId");
CREATE INDEX "PmsAccountingLedgerEntry_securityDepositTransactionId_idx" ON "PmsAccountingLedgerEntry"("securityDepositTransactionId");
CREATE INDEX "PmsAccountingLedgerEntry_ownerPayoutBatchId_idx" ON "PmsAccountingLedgerEntry"("ownerPayoutBatchId");
CREATE INDEX "PmsDocument_chargeId_idx" ON "PmsDocument"("chargeId");
CREATE INDEX "PmsDocument_securityDepositTransactionId_idx" ON "PmsDocument"("securityDepositTransactionId");
CREATE INDEX "PmsDocument_ownerPayoutBatchId_idx" ON "PmsDocument"("ownerPayoutBatchId");
CREATE INDEX "PmsDocument_assetId_idx" ON "PmsDocument"("assetId");
CREATE INDEX "PmsDocument_statementId_idx" ON "PmsDocument"("statementId");
CREATE INDEX "PmsDocument_inspectionDefectId_idx" ON "PmsDocument"("inspectionDefectId");
CREATE INDEX "PmsInspection_templateId_idx" ON "PmsInspection"("templateId");
CREATE INDEX "PmsWorkOrder_assetId_idx" ON "PmsWorkOrder"("assetId");
CREATE INDEX "PmsWorkOrder_maintenancePlanId_idx" ON "PmsWorkOrder"("maintenancePlanId");

-- Foreign keys for new domain tables
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_sourceRentDueItemId_fkey" FOREIGN KEY ("sourceRentDueItemId") REFERENCES "PmsRentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsChargeLine" ADD CONSTRAINT "PmsChargeLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsChargeLine" ADD CONSTRAINT "PmsChargeLine_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsChargeAdjustment" ADD CONSTRAINT "PmsChargeAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsChargeAdjustment" ADD CONSTRAINT "PmsChargeAdjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsChargeAdjustment" ADD CONSTRAINT "PmsChargeAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsChargeAdjustment" ADD CONSTRAINT "PmsChargeAdjustment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCreditNote" ADD CONSTRAINT "PmsCreditNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PmsRentPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAdjustment" ADD CONSTRAINT "PmsPaymentAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAdjustment" ADD CONSTRAINT "PmsPaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PmsRentPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAdjustment" ADD CONSTRAINT "PmsPaymentAdjustment_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "PmsPaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAdjustment" ADD CONSTRAINT "PmsPaymentAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPaymentAdjustment" ADD CONSTRAINT "PmsPaymentAdjustment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PmsSecurityDepositAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PmsRentPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsSecurityDepositTransaction" ADD CONSTRAINT "PmsSecurityDepositTransaction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriod" ADD CONSTRAINT "PmsFinancialPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriod" ADD CONSTRAINT "PmsFinancialPeriod_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriod" ADD CONSTRAINT "PmsFinancialPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriod" ADD CONSTRAINT "PmsFinancialPeriod_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriodEvent" ADD CONSTRAINT "PmsFinancialPeriodEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriodEvent" ADD CONSTRAINT "PmsFinancialPeriodEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PmsFinancialPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsFinancialPeriodEvent" ADD CONSTRAINT "PmsFinancialPeriodEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PmsRentPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "PmsReconciliationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsReconciliationItem" ADD CONSTRAINT "PmsReconciliationItem_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPortalAccess" ADD CONSTRAINT "PmsOwnerPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPortalAccess" ADD CONSTRAINT "PmsOwnerPortalAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPortalAccess" ADD CONSTRAINT "PmsOwnerPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPortalAccess" ADD CONSTRAINT "PmsOwnerPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutBatch" ADD CONSTRAINT "PmsOwnerPayoutBatch_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutLine" ADD CONSTRAINT "PmsOwnerPayoutLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutLine" ADD CONSTRAINT "PmsOwnerPayoutLine_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PmsOwnerPayoutBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutLine" ADD CONSTRAINT "PmsOwnerPayoutLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerPayoutLine" ADD CONSTRAINT "PmsOwnerPayoutLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PmsOwnerStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsVendorPortalAccess" ADD CONSTRAINT "PmsVendorPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsVendorPortalAccess" ADD CONSTRAINT "PmsVendorPortalAccess_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsVendorPortalAccess" ADD CONSTRAINT "PmsVendorPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsVendorPortalAccess" ADD CONSTRAINT "PmsVendorPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAsset" ADD CONSTRAINT "PmsAsset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAssetEvent" ADD CONSTRAINT "PmsAssetEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsAssetEvent" ADD CONSTRAINT "PmsAssetEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PmsAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsAssetEvent" ADD CONSTRAINT "PmsAssetEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PmsAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenancePlan" ADD CONSTRAINT "PmsMaintenancePlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplate" ADD CONSTRAINT "PmsInspectionTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplate" ADD CONSTRAINT "PmsInspectionTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplate" ADD CONSTRAINT "PmsInspectionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplate" ADD CONSTRAINT "PmsInspectionTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplateSection" ADD CONSTRAINT "PmsInspectionTemplateSection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplateSection" ADD CONSTRAINT "PmsInspectionTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmsInspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplateItem" ADD CONSTRAINT "PmsInspectionTemplateItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionTemplateItem" ADD CONSTRAINT "PmsInspectionTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PmsInspectionTemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionResult" ADD CONSTRAINT "PmsInspectionResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionResult" ADD CONSTRAINT "PmsInspectionResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PmsInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionResult" ADD CONSTRAINT "PmsInspectionResult_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "PmsInspectionTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PmsInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "PmsInspectionResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspectionDefect" ADD CONSTRAINT "PmsInspectionDefect_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_securityDepositTransactionId_fkey" FOREIGN KEY ("securityDepositTransactionId") REFERENCES "PmsSecurityDepositTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_ownerPayoutBatchId_fkey" FOREIGN KEY ("ownerPayoutBatchId") REFERENCES "PmsOwnerPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PmsCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_securityDepositTransactionId_fkey" FOREIGN KEY ("securityDepositTransactionId") REFERENCES "PmsSecurityDepositTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_ownerPayoutBatchId_fkey" FOREIGN KEY ("ownerPayoutBatchId") REFERENCES "PmsOwnerPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PmsAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PmsOwnerStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_inspectionDefectId_fkey" FOREIGN KEY ("inspectionDefectId") REFERENCES "PmsInspectionDefect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmsInspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PmsAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_maintenancePlanId_fkey" FOREIGN KEY ("maintenancePlanId") REFERENCES "PmsMaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one structured issued charge per legacy rent due item.
INSERT INTO "PmsCharge" ("id", "chargeNumber", "status", "currency", "dueDate", "servicePeriodStart", "servicePeriodEnd", "subtotal", "adjustmentTotal", "creditedAmount", "paidAmount", "totalAmount", "balanceAmount", "notes", "issuedAt", "voidedAt", "voidReason", "companyId", "propertyId", "unitId", "leaseId", "tenantId", "sourceRentDueItemId", "createdById", "issuedById", "createdAt", "updatedAt")
SELECT md5('stage21g-charge:' || r."id"), 'RENT-' || r."id",
  CASE WHEN r."status" = 'CANCELLED' THEN 'VOID'::"PmsChargeStatus"
       WHEN r."status" = 'PAID' THEN 'PAID'::"PmsChargeStatus"
       WHEN r."status" = 'PARTIALLY_PAID' THEN 'PARTIALLY_PAID'::"PmsChargeStatus"
       ELSE 'ISSUED'::"PmsChargeStatus" END,
  r."currency", r."dueDate", r."periodStart", r."periodEnd", r."amount", 0, 0, r."paidAmount", r."amount", GREATEST(r."amount" - r."paidAmount", 0), r."notes",
  CASE WHEN r."status" = 'CANCELLED' THEN NULL ELSE r."createdAt" END,
  CASE WHEN r."status" = 'CANCELLED' THEN COALESCE(r."updatedAt", CURRENT_TIMESTAMP) ELSE NULL END,
  CASE WHEN r."status" = 'CANCELLED' THEN 'Legacy rent due item was cancelled.' ELSE NULL END,
  r."companyId", r."propertyId", r."unitId", r."leaseId", r."tenantId", r."id", r."createdById", r."createdById", r."createdAt", r."updatedAt"
FROM "PmsRentDueItem" r
ON CONFLICT ("sourceRentDueItemId") DO NOTHING;
INSERT INTO "PmsChargeLine" ("id", "category", "description", "quantity", "unitAmount", "amount", "position", "servicePeriodStart", "servicePeriodEnd", "metadata", "companyId", "chargeId", "createdAt")
SELECT md5('stage21g-line:' || r."id"), 'RENT'::"PmsChargeCategory", 'Rent due ' || to_char(r."dueDate", 'YYYY-MM-DD'), 1, r."amount", r."amount", 0, r."periodStart", r."periodEnd", jsonb_build_object('compatibilitySource', 'PmsRentDueItem', 'rentDueItemId', r."id"), r."companyId", c."id", r."createdAt"
FROM "PmsRentDueItem" r JOIN "PmsCharge" c ON c."sourceRentDueItemId" = r."id"
ON CONFLICT ("id") DO NOTHING;

-- Backfill confirmed legacy rent payments without over-allocating a charge. Any historical overpayment remains unallocated credit on the payment.
WITH payment_candidates AS (
  SELECT
    p.*,
    c."id" AS "chargeId",
    c."totalAmount" AS "chargeTotal",
    COALESCE(
      SUM(p."amount") OVER (
        PARTITION BY c."id"
        ORDER BY p."createdAt", p."id"
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS "previousPayments"
  FROM "PmsRentPayment" p
  JOIN "PmsCharge" c ON c."sourceRentDueItemId" = p."rentDueItemId"
  WHERE p."status" = 'CONFIRMED'
    AND p."rentDueItemId" IS NOT NULL
    AND p."currency" = c."currency"
), allocations AS (
  SELECT *, LEAST("amount", GREATEST("chargeTotal" - "previousPayments", 0)) AS "allocationAmount"
  FROM payment_candidates
)
INSERT INTO "PmsPaymentAllocation" ("id", "amount", "currency", "status", "idempotencyKey", "companyId", "paymentId", "chargeId", "createdById", "createdAt", "updatedAt")
SELECT md5('stage21g-allocation:' || "id"), "allocationAmount", "currency", 'ACTIVE'::"PmsPaymentAllocationStatus", 'legacy-rent-payment:' || "id", "companyId", "id", "chargeId", "recordedById", "createdAt", "updatedAt"
FROM allocations
WHERE "allocationAmount" > 0
ON CONFLICT ("companyId", "idempotencyKey") DO NOTHING;

-- Recalculate charge balances from the actual allocation rows after backfill.
UPDATE "PmsCharge" c SET
  "paidAmount" = x."paidAmount",
  "balanceAmount" = GREATEST(c."totalAmount" - c."creditedAmount" - x."paidAmount", 0),
  "status" = CASE WHEN c."status" = 'VOID' THEN c."status"
                  WHEN GREATEST(c."totalAmount" - c."creditedAmount" - x."paidAmount", 0) = 0 THEN 'PAID'::"PmsChargeStatus"
                  WHEN x."paidAmount" > 0 THEN 'PARTIALLY_PAID'::"PmsChargeStatus"
                  ELSE 'ISSUED'::"PmsChargeStatus" END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM (SELECT c2."id", COALESCE(SUM(a."amount") FILTER (WHERE a."status" = 'ACTIVE'), 0) AS "paidAmount" FROM "PmsCharge" c2 LEFT JOIN "PmsPaymentAllocation" a ON a."chargeId" = c2."id" GROUP BY c2."id") x
WHERE c."id" = x."id";

-- Backfill deposit liability accounts. A lease deposit remains an expected liability until a collection transaction is posted.
INSERT INTO "PmsSecurityDepositAccount" ("id", "status", "expectedAmount", "liabilityBalance", "currency", "companyId", "propertyId", "unitId", "leaseId", "tenantId", "createdAt", "updatedAt")
SELECT md5('stage21g-deposit:' || l."id"), 'EXPECTED'::"PmsSecurityDepositStatus", COALESCE(l."securityDeposit", 0), 0, l."currency", l."companyId", l."propertyId", l."unitId", l."id", l."tenantId", l."createdAt", l."updatedAt"
FROM "PmsLease" l
ON CONFLICT ("leaseId") DO NOTHING;

-- Database-level financial invariants and immutable issued-charge history.
ALTER TABLE "PmsCharge" ADD CONSTRAINT "PmsCharge_nonnegative_balances_check" CHECK ("subtotal" >= 0 AND "creditedAmount" >= 0 AND "paidAmount" >= 0 AND "totalAmount" >= 0 AND "balanceAmount" >= 0);
ALTER TABLE "PmsPaymentAllocation" ADD CONSTRAINT "PmsPaymentAllocation_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "PmsSecurityDepositAccount" ADD CONSTRAINT "PmsSecurityDepositAccount_nonnegative_liability_check" CHECK ("expectedAmount" >= 0 AND "liabilityBalance" >= 0);
ALTER TABLE "PmsFinancialPeriod" ADD CONSTRAINT "PmsFinancialPeriod_range_check" CHECK ("periodEnd" >= "periodStart");
CREATE OR REPLACE FUNCTION pms_protect_issued_charge() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."companyId" IS DISTINCT FROM OLD."companyId" OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR
    NEW."unitId" IS DISTINCT FROM OLD."unitId" OR NEW."leaseId" IS DISTINCT FROM OLD."leaseId" OR
    NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."dueDate" IS DISTINCT FROM OLD."dueDate" OR NEW."servicePeriodStart" IS DISTINCT FROM OLD."servicePeriodStart" OR
    NEW."servicePeriodEnd" IS DISTINCT FROM OLD."servicePeriodEnd" OR NEW."sourceRentDueItemId" IS DISTINCT FROM OLD."sourceRentDueItemId"
  ) THEN RAISE EXCEPTION 'Issued PMS charge scope and service history are immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PmsCharge_protect_issued_history" BEFORE UPDATE ON "PmsCharge" FOR EACH ROW EXECUTE FUNCTION pms_protect_issued_charge();
CREATE OR REPLACE FUNCTION pms_protect_issued_charge_line() RETURNS trigger AS $$
DECLARE current_status "PmsChargeStatus";
DECLARE target_charge_id TEXT;
BEGIN
  target_charge_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."chargeId" ELSE NEW."chargeId" END;
  SELECT "status" INTO current_status FROM "PmsCharge" WHERE "id" = target_charge_id;
  IF current_status <> 'DRAFT' THEN RAISE EXCEPTION 'Issued PMS charge lines are immutable; use adjustments or credit notes'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PmsChargeLine_protect_issued_history" BEFORE INSERT OR UPDATE OR DELETE ON "PmsChargeLine" FOR EACH ROW EXECUTE FUNCTION pms_protect_issued_charge_line();
