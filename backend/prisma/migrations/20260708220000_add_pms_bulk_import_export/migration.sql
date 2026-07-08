-- CreateEnum
CREATE TYPE "PmsImportType" AS ENUM ('PROPERTIES', 'UNITS', 'TENANTS', 'LEASES');

-- CreateEnum
CREATE TYPE "PmsImportStatus" AS ENUM ('PREVIEWED', 'COMMITTED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "PmsImportBatch" (
    "id" TEXT NOT NULL,
    "type" "PmsImportType" NOT NULL,
    "filename" TEXT,
    "status" "PmsImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PmsImportBatch_companyId_type_idx" ON "PmsImportBatch"("companyId", "type");

-- CreateIndex
CREATE INDEX "PmsImportBatch_companyId_status_idx" ON "PmsImportBatch"("companyId", "status");

-- CreateIndex
CREATE INDEX "PmsImportBatch_createdById_idx" ON "PmsImportBatch"("createdById");

-- CreateIndex
CREATE INDEX "PmsImportBatch_createdAt_idx" ON "PmsImportBatch"("createdAt");

-- AddForeignKey
ALTER TABLE "PmsImportBatch" ADD CONSTRAINT "PmsImportBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmsImportBatch" ADD CONSTRAINT "PmsImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
