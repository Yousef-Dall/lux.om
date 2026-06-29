import type {
  BookingEventType,
  BookingStatus,
  NotificationType,
  PrismaClient
} from '@prisma/client';

import {
  deliverTransactionalNotificationToUser,
  deliverTransactionalNotificationToUsers
} from '../services/transactionalEmails';

type BookingWithAudience = {
  id: string;
  status: BookingStatus;
  userId: string;
  listing?: {
    ownerId: string;
    title?: string | null;
    titleEn?: string | null;
  } | null;
  activity?: {
    ownerId: string;
    titleEn?: string | null;
    titleAr?: string | null;
  } | null;
};

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  bookingId?: string;
};

type BookingEventInput = {
  bookingId: string;
  type: BookingEventType;
  actorId?: string;
  message?: string;
  fromStatus?: BookingStatus;
  toStatus?: BookingStatus;
};

export function getBookingOwnerId(booking: BookingWithAudience) {
  return booking.listing?.ownerId ?? booking.activity?.ownerId ?? null;
}

export function getBookingItemTitle(booking: BookingWithAudience) {
  return (
    booking.activity?.titleEn ||
    booking.activity?.titleAr ||
    booking.listing?.titleEn ||
    booking.listing?.title ||
    'booking request'
  );
}

export async function createNotification(
  prisma: PrismaClient,
  input: NotificationInput
) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      bookingId: input.bookingId
    }
  });

  await deliverTransactionalNotificationToUser(prisma, {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    bookingId: input.bookingId
  });

  return notification;
}

export async function createBookingEvent(
  prisma: PrismaClient,
  input: BookingEventInput
) {
  return prisma.bookingEvent.create({
    data: {
      bookingId: input.bookingId,
      type: input.type,
      actorId: input.actorId,
      message: input.message,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus
    }
  });
}

export async function notifyAdmins(
  prisma: PrismaClient,
  input: Omit<NotificationInput, 'userId'>
) {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN'
    },
    select: {
      id: true
    }
  });

  if (admins.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: input.type,
      title: input.title,
      message: input.message,
      bookingId: input.bookingId
    }))
  });

  await deliverTransactionalNotificationToUsers(prisma, {
    userIds: admins.map((admin) => admin.id),
    type: input.type,
    title: input.title,
    message: input.message,
    bookingId: input.bookingId,
    actionPath: input.bookingId
      ? `/dashboard?booking=${encodeURIComponent(input.bookingId)}`
      : '/dashboard'
  });
}

export async function recordBookingCreated(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  actorId: string
) {
  const ownerId = getBookingOwnerId(booking);
  const itemTitle = getBookingItemTitle(booking);

  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: 'BOOKING_CREATED',
    actorId,
    message: `Booking request created for ${itemTitle}`,
    toStatus: 'PENDING'
  });

  if (ownerId) {
    await createNotification(prisma, {
      userId: ownerId,
      type: 'BOOKING_CREATED',
      title: 'New booking request',
      message: `You received a new booking request for ${itemTitle}.`,
      bookingId: booking.id
    });
  }
}

export async function recordOwnerBookingDecision(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  actorId: string,
  fromStatus: BookingStatus,
  toStatus: 'OWNER_APPROVED' | 'OWNER_REJECTED'
) {
  const itemTitle = getBookingItemTitle(booking);
  const approved = toStatus === 'OWNER_APPROVED';

  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: approved ? 'OWNER_APPROVED' : 'OWNER_REJECTED',
    actorId,
    message: approved
      ? `Provider approved booking request for ${itemTitle}`
      : `Provider rejected booking request for ${itemTitle}`,
    fromStatus,
    toStatus
  });

  await createNotification(prisma, {
    userId: booking.userId,
    type: approved ? 'BOOKING_OWNER_APPROVED' : 'BOOKING_OWNER_REJECTED',
    title: approved ? 'Booking approved by provider' : 'Booking rejected by provider',
    message: approved
      ? `Your booking request for ${itemTitle} was approved. You can now continue to payment.`
      : `Your booking request for ${itemTitle} was rejected by the provider.`,
    bookingId: booking.id
  });

  if (approved) {
    await notifyAdmins(prisma, {
      type: 'BOOKING_OWNER_APPROVED',
      title: 'Booking needs admin follow-up',
      message: `Provider approved a booking request for ${itemTitle}.`,
      bookingId: booking.id
    });
  }
}

export async function recordAdminBookingDecision(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  actorId: string,
  fromStatus: BookingStatus,
  toStatus: BookingStatus
) {
  const itemTitle = getBookingItemTitle(booking);
  const ownerId = getBookingOwnerId(booking);
  const confirmed = toStatus === 'ADMIN_CONFIRMED';
  const cancelled = toStatus === 'CANCELLED';

  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: confirmed ? 'ADMIN_CONFIRMED' : cancelled ? 'CANCELLED' : 'OWNER_REJECTED',
    actorId,
    message: confirmed
      ? `Admin confirmed booking for ${itemTitle}`
      : cancelled
        ? `Admin cancelled booking for ${itemTitle}`
        : `Admin updated booking status for ${itemTitle}`,
    fromStatus,
    toStatus
  });

  await createNotification(prisma, {
    userId: booking.userId,
    type: confirmed
      ? 'BOOKING_ADMIN_CONFIRMED'
      : cancelled
        ? 'BOOKING_CANCELLED'
        : 'BOOKING_OWNER_REJECTED',
    title: confirmed
      ? 'Booking confirmed'
      : cancelled
        ? 'Booking cancelled'
        : 'Booking status updated',
    message: confirmed
      ? `Your booking for ${itemTitle} has been confirmed.`
      : cancelled
        ? `Your booking for ${itemTitle} has been cancelled.`
        : `Your booking status for ${itemTitle} was updated.`,
    bookingId: booking.id
  });

  if (ownerId) {
    await createNotification(prisma, {
      userId: ownerId,
      type: confirmed
        ? 'BOOKING_ADMIN_CONFIRMED'
        : cancelled
          ? 'BOOKING_CANCELLED'
          : 'BOOKING_OWNER_REJECTED',
      title: confirmed
        ? 'Booking confirmed by admin'
        : cancelled
          ? 'Booking cancelled by admin'
          : 'Booking status updated by admin',
      message: confirmed
        ? `Admin confirmed the booking for ${itemTitle}.`
        : cancelled
          ? `Admin cancelled the booking for ${itemTitle}.`
          : `Admin updated the booking status for ${itemTitle}.`,
      bookingId: booking.id
    });
  }
}


export async function recordBookingCancellationRequested(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  actorId: string,
  fromStatus: BookingStatus,
  reason: string
) {
  const itemTitle = getBookingItemTitle(booking);
  const ownerId = getBookingOwnerId(booking);
  const message = reason.trim();

  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: 'CANCELLATION_REQUESTED',
    actorId,
    message: `Customer requested cancellation for ${itemTitle}. Reason: ${message}`,
    fromStatus,
    toStatus: 'CANCELLATION_REQUESTED'
  });

  await createNotification(prisma, {
    userId: booking.userId,
    type: 'BOOKING_CANCELLATION_REQUESTED',
    title: 'Cancellation request received',
    message: `Your cancellation request for ${itemTitle} has been received and is waiting for review.`,
    bookingId: booking.id
  });

  if (ownerId) {
    await createNotification(prisma, {
      userId: ownerId,
      type: 'BOOKING_CANCELLATION_REQUESTED',
      title: 'Cancellation requested',
      message: `A customer requested cancellation for ${itemTitle}.`,
      bookingId: booking.id
    });
  }

  await notifyAdmins(prisma, {
    type: 'BOOKING_CANCELLATION_REQUESTED',
    title: 'Cancellation request needs review',
    message: `A customer requested cancellation for ${itemTitle}.`,
    bookingId: booking.id
  });
}

export async function recordPaymentSessionCreated(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  actorId: string
) {
  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: 'PAYMENT_SESSION_CREATED',
    actorId,
    message: 'Payment checkout session was created',
    fromStatus: booking.status,
    toStatus: booking.status
  });
}

export async function recordPaymentSync(
  prisma: PrismaClient,
  booking: BookingWithAudience,
  paid: boolean
) {
  const ownerId = getBookingOwnerId(booking);
  const itemTitle = getBookingItemTitle(booking);

  await createBookingEvent(prisma, {
    bookingId: booking.id,
    type: paid ? 'PAYMENT_PAID' : 'PAYMENT_FAILED',
    message: paid
      ? `Payment completed for ${itemTitle}`
      : `Payment failed for ${itemTitle}`,
    fromStatus: booking.status,
    toStatus: booking.status
  });

  await createNotification(prisma, {
    userId: booking.userId,
    type: paid ? 'BOOKING_PAYMENT_PAID' : 'BOOKING_PAYMENT_FAILED',
    title: paid ? 'Payment completed' : 'Payment failed',
    message: paid
      ? `Your payment for ${itemTitle} was completed successfully.`
      : `Your payment for ${itemTitle} could not be completed.`,
    bookingId: booking.id
  });

  if (ownerId) {
    await createNotification(prisma, {
      userId: ownerId,
      type: paid ? 'BOOKING_PAYMENT_PAID' : 'BOOKING_PAYMENT_FAILED',
      title: paid ? 'Customer payment completed' : 'Customer payment failed',
      message: paid
        ? `Customer payment for ${itemTitle} was completed.`
        : `Customer payment for ${itemTitle} failed.`,
      bookingId: booking.id
    });
  }

  if (paid) {
    await notifyAdmins(prisma, {
      type: 'BOOKING_PAYMENT_PAID',
      title: 'Booking payment completed',
      message: `A booking payment for ${itemTitle} was completed.`,
      bookingId: booking.id
    });
  }
}
