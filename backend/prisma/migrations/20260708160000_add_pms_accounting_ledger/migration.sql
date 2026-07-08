-- CreateEnum
CREATE TYPE "PmsAccountingEntryType" AS ENUM ('INCOME', 'EXPENSE', 'DEPOSIT', 'ADJUSTMENT', 'REFUND', 'LATE_FEE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PmsAccountingSource" AS ENUM ('MANUAL', 'RENT_PAYMENT', 'MAINTENANCE_COST', 'SECURITY_DEPOSIT');

-- CreateTable
CREATE TABLE "PmsAccountingLedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "PmsAccountingEntryType" NOT NULL,
    "source" "PmsAccountingSource" NOT NULL DEFAULT 'MANUAL',
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "tenantId" TEXT,
    "leaseId" TEXT,
    "rentDueItemId" TEXT,
    "rentPaymentId" TEXT,
    "workOrderId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsAccountingLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_companyId_transactionDate_idx" ON "PmsAccountingLedgerEntry"("companyId", "transactionDate");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_companyId_type_idx" ON "PmsAccountingLedgerEntry"("companyId", "type");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_companyId_category_idx" ON "PmsAccountingLedgerEntry"("companyId", "category");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_propertyId_idx" ON "PmsAccountingLedgerEntry"("propertyId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_unitId_idx" ON "PmsAccountingLedgerEntry"("unitId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_tenantId_idx" ON "PmsAccountingLedgerEntry"("tenantId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_leaseId_idx" ON "PmsAccountingLedgerEntry"("leaseId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_rentDueItemId_idx" ON "PmsAccountingLedgerEntry"("rentDueItemId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_rentPaymentId_idx" ON "PmsAccountingLedgerEntry"("rentPaymentId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_workOrderId_idx" ON "PmsAccountingLedgerEntry"("workOrderId");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_createdById_idx" ON "PmsAccountingLedgerEntry"("createdById");

-- CreateIndex
CREATE INDEX "PmsAccountingLedgerEntry_updatedById_idx" ON "PmsAccountingLedgerEntry"("updatedById");

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "PmsRentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_rentPaymentId_fkey" FOREIGN KEY ("rentPaymentId") REFERENCES "PmsRentPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsAccountingLedgerEntry" ADD CONSTRAINT "PmsAccountingLedgerEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
