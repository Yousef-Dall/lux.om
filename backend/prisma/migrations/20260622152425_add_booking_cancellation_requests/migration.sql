-- AlterEnum
ALTER TYPE "BookingEventType" ADD VALUE 'CANCELLATION_REQUESTED';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLATION_REQUESTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CANCELLATION_REQUESTED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3);
