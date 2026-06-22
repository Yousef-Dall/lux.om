import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const reportsRouter = Router();

const reportSchema = z.object({
  targetType: z.enum(['LISTING', 'ACTIVITY', 'TRAVEL_AGENCY', 'DEVELOPER', 'REVIEW', 'USER', 'OTHER']),
  targetId: z.string().trim().min(1),
  reason: z.enum([
    'MISLEADING_INFO',
    'SUSPECTED_FRAUD',
    'DUPLICATE',
    'INAPPROPRIATE_CONTENT',
    'WRONG_PRICE',
    'UNAVAILABLE',
    'SAFETY_CONCERN',
    'OTHER'
  ]),
  message: z.string().trim().max(3000).optional(),
  reporterName: z.string().trim().max(120).optional(),
  reporterEmail: z.string().trim().email().optional(),
  reporterPhone: z.string().trim().max(40).optional()
}).strict();

const adminStatusSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'DISMISSED']),
  reviewNotes: z.string().trim().max(3000).optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

reportsRouter.post('/', requireAuth(false), async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    const report = await prisma.trustReport.create({
      data: {
        ...data,
        reporterId: req.user?.id
      }
    });

    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const reports = await prisma.trustReport.findMany({
      include: {
        reporter: { select: { id: true, name: true, email: true, phone: true } },
        reviewedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

reportsRouter.patch('/admin/:id/status', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = adminStatusSchema.parse(req.body);

    const report = await prisma.trustReport.update({
      where: { id },
      data: {
        status: data.status,
        reviewNotes: data.reviewNotes,
        reviewedById: req.user!.id
      }
    });

    res.json({ report });
  } catch (error) {
    next(error);
  }
});
