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
  | 'APPROVAL_LISTING'
  | 'APPROVAL_ACTIVITY'
  | 'APPROVAL_DEVELOPER_PROJECT'
  | 'PUBLISHING'
  | 'REPORT'
  | 'VERIFICATION'
  | 'RENT_PAYMENT'
  | 'TRANSACTION'
  | 'SAVED_SEARCH'
  | 'DASHBOARD';

type PublishingReviewTarget =
  | 'LISTING'
  | 'ACTIVITY'
  | 'DEVELOPER_PROJECT'
  | null;

function dashboardAction(
  actionContext: NotificationActionContext,
  query?: Record<string, string | undefined | null>
) {
  return {
    actionUrl: buildAppPath('/dashboard', query),
    actionLabel: 'Open dashboard',
    actionContext
  };
}

function buildAppPath(path: string, query?: Record<string, string | undefined | null>) {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const queryString = params.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function includesAny(value: string, fragments: string[]) {
  return fragments.some((fragment) => value.includes(fragment));
}

function getPublishingReviewTarget(
  notification: NotificationWithActionSource
): PublishingReviewTarget {
  const title = notification.title.toLowerCase();
  const message = notification.message?.toLowerCase() ?? '';
  const combined = `${title} ${message}`;

  if (includesAny(combined, ['developer project', 'project moved to review'])) {
    return 'DEVELOPER_PROJECT';
  }

  if (includesAny(combined, ['listing awaiting review', 'listing needs admin review'])) {
    return 'LISTING';
  }

  if (includesAny(combined, ['activity awaiting review', 'activity needs admin review'])) {
    return 'ACTIVITY';
  }

  if (
    includesAny(combined, ['submitted or updated and needs admin review', 'awaiting review'])
  ) {
    if (includesAny(combined, ['listing'])) return 'LISTING';
    if (includesAny(combined, ['activity'])) return 'ACTIVITY';
  }

  return null;
}

function getPublishingOwnerAction(notification: NotificationWithActionSource) {
  const title = notification.title.toLowerCase();
  const message = notification.message?.toLowerCase() ?? '';
  const combined = `${title} ${message}`;

  if (combined.includes('developer project')) {
    return {
      actionUrl: buildAppPath('/dashboard', { workspace: 'projects-developments' }),
      actionLabel: 'Open developer projects',
      actionContext: 'APPROVAL_DEVELOPER_PROJECT' as const,
      targetType: 'DEVELOPER_PROJECT',
      targetId: notification.id
    };
  }

  if (combined.includes('activity')) {
    return {
      actionUrl: buildAppPath('/dashboard', { workspace: 'activities-command' }),
      actionLabel: 'Open activity workspace',
      actionContext: 'APPROVAL_ACTIVITY' as const,
      targetType: 'ACTIVITY',
      targetId: notification.id
    };
  }

  if (combined.includes('listing')) {
    return {
      actionUrl: buildAppPath('/dashboard', { workspace: 'listings-command' }),
      actionLabel: 'Open listing workspace',
      actionContext: 'APPROVAL_LISTING' as const,
      targetType: 'LISTING',
      targetId: notification.id
    };
  }

  return null;
}

function getAdminPublishingAction(
  target: Exclude<PublishingReviewTarget, null>,
  notificationId: string
) {
  if (target === 'LISTING') {
    return {
      actionUrl: buildAppPath('/admin', {
        workspace: 'approvals',
        section: 'admin-approvals',
        reviewType: 'listing'
      }),
      actionLabel: 'Review listing',
      actionContext: 'APPROVAL_LISTING' as const,
      targetType: 'LISTING',
      targetId: notificationId
    };
  }

  if (target === 'ACTIVITY') {
    return {
      actionUrl: buildAppPath('/admin', {
        workspace: 'approvals',
        section: 'admin-approvals',
        reviewType: 'activity'
      }),
      actionLabel: 'Review activity',
      actionContext: 'APPROVAL_ACTIVITY' as const,
      targetType: 'ACTIVITY',
      targetId: notificationId
    };
  }

  return {
    actionUrl: buildAppPath('/admin', {
      workspace: 'approvals',
      section: 'admin-developer-projects',
      reviewType: 'developer-project'
    }),
    actionLabel: 'Review developer project',
    actionContext: 'APPROVAL_DEVELOPER_PROJECT' as const,
    targetType: 'DEVELOPER_PROJECT',
    targetId: notificationId
  };
}

function isTrustReportNotification(notification: NotificationWithActionSource) {
  const title = notification.title.toLowerCase();
  const message = notification.message?.toLowerCase() ?? '';

  return title.includes('trust report') || message.includes('report is now');
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
        ? `/dashboard?bookingId=${notification.bookingId}`
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
    const publishingTarget = getPublishingReviewTarget(notification);

    if (isAdmin && publishingTarget) {
      return getAdminPublishingAction(publishingTarget, notification.id);
    }

    const ownerPublishingAction = getPublishingOwnerAction(notification);

    if (!isAdmin && ownerPublishingAction) {
      return ownerPublishingAction;
    }

    if (isTrustReportNotification(notification)) {
      return {
        actionUrl: isAdmin ? '/admin/reports' : '/notifications',
        actionLabel: isAdmin ? 'Open trust report queue' : 'View report outcome',
        actionContext: 'REPORT' as const,
        targetType: 'REPORT',
        targetId: notification.id
      };
    }

    return {
      actionUrl: isAdmin
        ? buildAppPath('/admin', { workspace: 'reviewDetails' })
        : '/notifications',
      actionLabel: isAdmin ? 'Open review queue' : 'View review update',
      actionContext: 'PUBLISHING' as const,
      targetType: 'REVIEW',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.VERIFICATION_STATUS_UPDATED) {
    return {
      actionUrl: isAdmin
        ? buildAppPath('/admin', { workspace: 'health', section: 'admin-health' })
        : buildAppPath('/dashboard', { workspace: 'verification' }),
      actionLabel: isAdmin ? 'Open verification queue' : 'Open verification workspace',
      actionContext: 'VERIFICATION' as const,
      targetType: 'VERIFICATION',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.RENT_PAYMENT_DUE) {
    return {
      ...dashboardAction('RENT_PAYMENT', { workspace: 'contracts-rent' }),
      actionLabel: 'Open rent payments',
      targetType: 'RENT_PAYMENT',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.TRANSACTION_STATUS_UPDATED) {
    return {
      actionUrl: isAdmin
        ? buildAppPath('/admin', { workspace: 'finance', section: 'admin-finance-section' })
        : buildAppPath('/dashboard', { workspace: 'transactions' }),
      actionLabel: isAdmin ? 'Open admin transactions' : 'Open transactions',
      actionContext: 'TRANSACTION' as const,
      targetType: 'TRANSACTION',
      targetId: notification.id
    };
  }

  if (notification.type === NotificationType.SAVED_SEARCH_MATCH) {
    return {
      actionUrl: buildAppPath('/dashboard', { workspace: 'saved-alerts' }),
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
