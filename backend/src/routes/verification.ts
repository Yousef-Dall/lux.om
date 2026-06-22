import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { submitVerificationRequest } from '../services/verificationAdapters';

export const verificationRouter = Router();

const verificationSchema = z.object({
  targetType: z.enum(['LISTING', 'ACTIVITY', 'DEVELOPER', 'TRAVEL_AGENCY', 'USER', 'CONTRACT', 'TRANSACTION']),
  targetId: z.string().trim().min(1),
  source: z.enum([
    'LUX_OM_ADMIN_REVIEW',
    'OWNER_DOCUMENT_SUBMISSION',
    'FUTURE_MOLUP_API',
    'FUTURE_MUNICIPALITY_REGISTRATION',
    'FUTURE_THIRD_PARTY_PROVIDER'
  ]),
  notes: z.string().trim().max(3000).optional(),
  submittedDocumentUrls: z.array(z.string().trim().url()).max(20).optional(),
  documentChecklist: z.unknown().optional()
}).strict();

const adminReviewSchema = z.object({
  status: z.enum(['UNVERIFIED', 'SUBMITTED', 'ADMIN_VERIFIED', 'EXTERNALLY_VERIFIED', 'REJECTED', 'EXPIRED']),
  notes: z.string().trim().max(3000).optional(),
  expiryDate: z.coerce.date().nullable().optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

verificationRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = verificationSchema.parse(req.body);
    const adapterResult = await submitVerificationRequest({
      targetType: data.targetType,
      targetId: data.targetId,
      source: data.source,
      submittedDocumentUrls: data.submittedDocumentUrls,
      notes: data.notes
    });

    const verification = await prisma.verificationRecord.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        status: adapterResult.status,
        source: data.source,
        notes: adapterResult.notes,
        documentChecklist:
          data.documentChecklist === undefined
            ? undefined
            : data.documentChecklist === null
              ? Prisma.JsonNull
              : (data.documentChecklist as Prisma.InputJsonValue),
        verificationDate: adapterResult.status === 'ADMIN_VERIFIED' || adapterResult.status === 'EXTERNALLY_VERIFIED'
          ? adapterResult.checkedAt
          : null,
        expiryDate: adapterResult.expiresAt ?? null,
        submittedById: req.user!.id
      }
    });

    res.status(201).json({ verification });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const verifications = await prisma.verificationRecord.findMany({
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ verifications });
  } catch (error) {
    next(error);
  }
});

verificationRouter.patch('/admin/:id/review', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = adminReviewSchema.parse(req.body);

    const verification = await prisma.verificationRecord.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        expiryDate: data.expiryDate ?? undefined,
        verificationDate: data.status === 'ADMIN_VERIFIED' || data.status === 'EXTERNALLY_VERIFIED'
          ? new Date()
          : undefined,
        reviewedById: req.user!.id
      }
    });

    res.json({ verification });
  } catch (error) {
    next(error);
  }
});
