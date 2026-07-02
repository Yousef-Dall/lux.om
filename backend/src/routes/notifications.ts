import { Router } from 'express';
import { z } from 'zod';
import {
  NotificationType,
  Role,
  type Prisma
} from '@prisma/client';

import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const notificationsRouter = Router();

const notificationsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0)
});

const paramsSchema = z.object({
  id: z.string().min(1)
});


const notificationInclude = {
  booking: {
    select: {
      id: true,
      status: true,
      listingId: true,
      activityId: true,
      payment: {
        select: {
          status: true
        }
      }
    }
  }
} satisfies Prisma.NotificationInclude;

type NotificationWithActionSource = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type NotificationActionContext =
  | 'ACCOUNT_SECURITY'
  | 'BOOKING'
  | 'PUBLISHING'
  | 'REPORT'
  | 'VERIFICATION'
  | 'RENT_PAYMENT'
  | 'TRANSACTION'
  | 'SAVED_SEARCH'
  | 'DASHBOARD';

function dashboardAction(actionContext: NotificationActionContext) {
  return {
    actionUrl: '/dashboard',
    actionLabel: 'Open dashboard',
    actionContext
  };
}

function isPublishingReviewNotification(notification: NotificationWithActionSource) {
  const title = notification.title.toLowerCase();
  const message = notification.message?.toLowerCase() ?? '';

  return (
    title.includes('listing awaiting review') ||
    title.includes('activity awaiting review') ||
    message.includes('needs admin review') ||
    message.includes('awaiting review')
  );
}

function getNotificationAction(
  notification: NotificationWithActionSource,
  userRole: Role
) {
  const isAdmin = userRole === Role.ADMIN;

  if (
    notification.type === NotificationType.BOOKING_CREATED ||
    notification.type === NotificationType.BOOKING_OWNER_APPROVED ||
    notification.type === NotificationType.BOOKING_OWNER_REJECTED ||
    notification.type === NotificationType.BOOKING_ADMIN_CONFIRMED ||
    notification.type === NotificationType.BOOKING_CANCELLATION_REQUESTED ||
    notification.type === NotificationType.BOOKING_CANCELLED ||
    notification.type === NotificationType.BOOKING_PAYMENT_PAID ||
    notification.type === NotificationType.BOOKING_PAYMENT_FAILED
  ) {
    return {
      actionUrl: notification.bookingId
        ? `/dashboard?booking=${notification.bookingId}`
        : '/dashboard',
      actionLabel: 'View booking',
      actionContext: 'BOOKING' as const,
      targetType: 'BOOKING',
      targetId: notification.bookingId
    };
  }

  if (notification.type === NotificationType.ACCOUNT_SECURITY) {
    return {
      actionUrl: '/profile',
      actionLabel: 'Review account security',
      actionContext: 'ACCOUNT_SECURITY' as const,
      targetType: 'ACCOUNT_SECURITY',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.REVIEW_STATUS_UPDATED) {
    if (isAdmin && isPublishingReviewNotification(notification)) {
      return {
        actionUrl: '/admin',
        actionLabel: 'Open approval workflow',
        actionContext: 'PUBLISHING' as const,
        targetType: 'PUBLISHING',
        targetId: notification.id
      };
    }

    return {
      actionUrl: isAdmin ? '/admin/reports' : '/dashboard',
      actionLabel: isAdmin ? 'Open report queue' : 'View dashboard',
      actionContext: 'REPORT' as const,
      targetType: 'REPORT',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.VERIFICATION_STATUS_UPDATED) {
    return {
      actionUrl: isAdmin ? '/admin' : '/dashboard',
      actionLabel: isAdmin ? 'Open verification queue' : 'View verification workspace',
      actionContext: 'VERIFICATION' as const,
      targetType: 'VERIFICATION',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.RENT_PAYMENT_DUE) {
    return {
      ...dashboardAction('RENT_PAYMENT'),
      actionLabel: 'Open rent payments',
      targetType: 'RENT_PAYMENT',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.TRANSACTION_STATUS_UPDATED) {
    return {
      actionUrl: isAdmin ? '/admin' : '/dashboard',
      actionLabel: isAdmin ? 'Open admin transactions' : 'Open transactions',
      actionContext: 'TRANSACTION' as const,
      targetType: 'TRANSACTION',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.SAVED_SEARCH_MATCH) {
    return {
      actionUrl: '/dashboard',
      actionLabel: 'Open saved searches',
      actionContext: 'SAVED_SEARCH' as const,
      targetType: 'SAVED_SEARCH',
      targetId: notification.id
    };
  }

  return {
    ...dashboardAction('DASHBOARD'),
    targetType: 'DASHBOARD',
    targetId: notification.id
  };
}

function decorateNotification(
  notification: NotificationWithActionSource,
  userRole: Role
) {
  return {
    ...notification,
    ...getNotificationAction(notification, userRole)
  };
}

notificationsRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const query = notificationsQuerySchema.parse(req.query);

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: req.user!.id
        },
        include: notificationInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: query.take,
        skip: query.skip
      }),

      prisma.notification.count({
        where: {
          userId: req.user!.id,
          readAt: null
        }
      }),

      prisma.notification.count({
        where: {
          userId: req.user!.id
        }
      })
    ]);

    res.json({
      notifications: notifications.map((notification) =>
        decorateNotification(notification, req.user!.role)
      ),
      unreadCount,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: notifications.length,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/:id/read', requireAuth(), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: req.user!.id
      },
      include: notificationInclude
    });

    if (!notification) {
      throw new AppError(404, 'Notification not found');
    }

    await prisma.notification.update({
      where: {
        id
      },
      data: {
        readAt: notification.readAt ?? new Date()
      }
    });

    const updatedNotification = await prisma.notification.findFirstOrThrow({
      where: {
        id,
        userId: req.user!.id
      },
      include: notificationInclude
    });

    res.json({
      notification: decorateNotification(updatedNotification, req.user!.role)
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/read-all', requireAuth(), async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    res.json({
      count: result.count
    });
  } catch (error) {
    next(error);
  }
});
