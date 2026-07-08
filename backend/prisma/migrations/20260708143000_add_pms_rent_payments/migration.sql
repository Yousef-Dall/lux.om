-- CreateEnum
CREATE TYPE "PmsRentPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD_MANUAL', 'ONLINE_GATEWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PmsRentPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "PmsRentPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "method" "PmsRentPaymentMethod" NOT NULL,
    "status" "PmsRentPaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "receiptNumber" TEXT,
    "provider" TEXT,
    "providerReference" TEXT,
    "providerSessionId" TEXT,
    "checkoutUrl" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "rentDueItemId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsRentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PmsRentPayment_receiptNumber_key" ON "PmsRentPayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PmsRentPayment_providerReference_key" ON "PmsRentPayment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "PmsRentPayment_providerSessionId_key" ON "PmsRentPayment"("providerSessionId");

-- CreateIndex
CREATE INDEX "PmsRentPayment_companyId_status_idx" ON "PmsRentPayment"("companyId", "status");

-- CreateIndex
CREATE INDEX "PmsRentPayment_rentDueItemId_status_idx" ON "PmsRentPayment"("rentDueItemId", "status");

-- CreateIndex
CREATE INDEX "PmsRentPayment_tenantId_status_idx" ON "PmsRentPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PmsRentPayment_leaseId_idx" ON "PmsRentPayment"("leaseId");

-- CreateIndex
CREATE INDEX "PmsRentPayment_propertyId_idx" ON "PmsRentPayment"("propertyId");

-- CreateIndex
CREATE INDEX "PmsRentPayment_unitId_idx" ON "PmsRentPayment"("unitId");

-- CreateIndex
CREATE INDEX "PmsRentPayment_recordedById_idx" ON "PmsRentPayment"("recordedById");

-- CreateIndex
CREATE INDEX "PmsRentPayment_paidAt_idx" ON "PmsRentPayment"("paidAt");

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "PmsRentDueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsRentPayment" ADD CONSTRAINT "PmsRentPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
