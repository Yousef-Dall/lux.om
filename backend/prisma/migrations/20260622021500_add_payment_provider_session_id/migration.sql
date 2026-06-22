-- Store the external Thawani checkout session id used to verify real payments.
ALTER TABLE "Payment"
  ADD COLUMN "providerSessionId" TEXT;

CREATE UNIQUE INDEX "Payment_providerSessionId_key" ON "Payment"("providerSessionId");
