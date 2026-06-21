-- Extend booking requests to support direct activity bookings.
ALTER TABLE "Booking" ALTER COLUMN "listingId" DROP NOT NULL;

ALTER TABLE "Booking"
  ADD COLUMN "activityId" TEXT,
  ADD COLUMN "scheduledDate" TIMESTAMP(3),
  ADD COLUMN "preferredTime" TEXT,
  ADD COLUMN "guests" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT;

CREATE INDEX "Booking_activityId_idx" ON "Booking"("activityId");
CREATE INDEX "Booking_scheduledDate_idx" ON "Booking"("scheduledDate");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
