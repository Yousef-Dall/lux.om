import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import { deliverTransactionalNotificationToUser } from '../services/transactionalEmails';

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

async function assertReportTargetExists(targetType: string, targetId: string) {
  if (targetType === 'OTHER') return;

  if (targetType === 'LISTING') {
    const listing = await prisma.listing.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!listing) throw new AppError(404, 'Report target not found');
    return;
  }

  if (targetType === 'ACTIVITY') {
    const activity = await prisma.activity.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!activity) throw new AppError(404, 'Report target not found');
    return;
  }

  if (targetType === 'TRAVEL_AGENCY') {
    const travelAgency = await prisma.travelAgency.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!travelAgency) throw new AppError(404, 'Report target not found');
    return;
  }

  if (targetType === 'DEVELOPER') {
    const developer = await prisma.developerCompany.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!developer) throw new AppError(404, 'Report target not found');
    return;
  }

  if (targetType === 'REVIEW') {
    const review = await prisma.review.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!review) throw new AppError(404, 'Report target not found');
    return;
  }

  if (targetType === 'USER') {
    const user = await prisma.user.findUnique({
      where: {
        id: targetId
      },
      select: {
        id: true
      }
    });

    if (!user) throw new AppError(404, 'Report target not found');
  }
}

function formatReportStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

async function notifyTrustReportReviewed(report: {
  id: string;
  targetType: string;
  status: string;
  reporterId?: string | null;
}) {
  if (!report.reporterId) return;

  const title = 'Trust report reviewed';
  const message = `Your ${report.targetType.toLowerCase()} report is now ${formatReportStatus(
    report.status
  )}.`;

  await prisma.notification.create({
    data: {
      userId: report.reporterId,
      type: 'REVIEW_STATUS_UPDATED',
      title,
      message
    }
  });

  await deliverTransactionalNotificationToUser(prisma, {
    userId: report.reporterId,
    type: 'REVIEW_STATUS_UPDATED',
    title,
    message,
    actionPath: '/notifications'
  });
}

reportsRouter.post('/', requireAuth(false), async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);

    await assertReportTargetExists(data.targetType, data.targetId);

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
      },
      select: {
        id: true,
        targetType: true,
        status: true,
        reporterId: true
      }
    });

    await notifyTrustReportReviewed(report);

    res.json({ report });
  } catch (error) {
    next(error);
  }
});