import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const reviewsRouter = Router();

const createReviewSchema = z.object({
  targetType: z.enum(['ACTIVITY', 'TRAVEL_AGENCY', 'DEVELOPER', 'LISTING']),
  targetId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().max(3000).optional()
}).strict();

const listQuerySchema = z.object({
  targetType: z.enum(['ACTIVITY', 'TRAVEL_AGENCY', 'DEVELOPER', 'LISTING']).optional(),
  targetId: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0)
});

const adminModerationSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED']),
  moderationNotes: z.string().trim().max(3000).optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

function relationData(targetType: string, targetId: string) {
  if (targetType === 'ACTIVITY') return { activityId: targetId };
  if (targetType === 'TRAVEL_AGENCY') return { travelAgencyId: targetId };
  if (targetType === 'DEVELOPER') return { developerId: targetId };
  if (targetType === 'LISTING') return { listingId: targetId };

  return {};
}

reviewsRouter.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const reviews = await prisma.review.findMany({
      where: {
        status: 'APPROVED',
        targetType: query.targetType,
        targetId: query.targetId
      },
      include: {
        reviewer: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: query.take,
      skip: query.skip
    });

    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = createReviewSchema.parse(req.body);
    const review = await prisma.review.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        rating: data.rating,
        title: data.title,
        body: data.body,
        reviewerId: req.user!.id,
        ...relationData(data.targetType, data.targetId)
      }
    });

    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        moderatedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.patch('/admin/:id/moderate', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = adminModerationSchema.parse(req.body);

    const review = await prisma.review.update({
      where: { id },
      data: {
        status: data.status,
        moderationNotes: data.moderationNotes,
        moderatedById: req.user!.id
      }
    });

    res.json({ review });
  } catch (error) {
    next(error);
  }
});
