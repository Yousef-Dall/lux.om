-- Add provider-ready checkout metadata for website payments.
ALTER TABLE "Payment"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
