import { Router } from 'express';
import { z } from 'zod';

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

notificationsRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const query = notificationsQuerySchema.parse(req.query);

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: req.user!.id
        },
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
      notifications,
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
      }
    });

    if (!notification) {
      throw new AppError(404, 'Notification not found');
    }

    const updatedNotification = await prisma.notification.update({
      where: {
        id
      },
      data: {
        readAt: notification.readAt ?? new Date()
      }
    });

    res.json({
      notification: updatedNotification
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
