-- CreateEnum
CREATE TYPE "ListingBuyerEligibility" AS ENUM ('OMANI_ONLY', 'GCC_NATIONALS', 'OMAN_RESIDENTS', 'FOREIGNERS_ALLOWED', 'COMPANY_PURCHASE_ALLOWED', 'FREEHOLD', 'USUFRUCT');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "buyerEligibility" "ListingBuyerEligibility"[] DEFAULT ARRAY[]::"ListingBuyerEligibility"[];
