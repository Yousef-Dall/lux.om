import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { submitVerificationRequest } from '../services/verificationAdapters';
import { AppError } from '../utils/http';

export const verificationRouter = Router();

const verificationSchema = z
  .object({
    targetType: z.enum([
      'LISTING',
      'ACTIVITY',
      'DEVELOPER',
      'TRAVEL_AGENCY',
      'USER',
      'CONTRACT',
      'TRANSACTION'
    ]),
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
  })
  .strict();

const adminReviewSchema = z
  .object({
    status: z.enum([
      'UNVERIFIED',
      'SUBMITTED',
      'ADMIN_VERIFIED',
      'EXTERNALLY_VERIFIED',
      'REJECTED',
      'EXPIRED'
    ]),
    notes: z.string().trim().max(3000).optional(),
    expiryDate: z.coerce.date().nullable().optional()
  })
  .strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

type AuthUser = {
  id: string;
  role: string;
};

type VerificationPayload = z.infer<typeof verificationSchema>;

function isAdmin(user: AuthUser) {
  return user.role === 'ADMIN';
}

async function assertVerificationTargetExists(data: VerificationPayload) {
  if (data.targetType === 'LISTING') {
    const listing = await prisma.listing.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!listing) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'ACTIVITY') {
    const activity = await prisma.activity.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!activity) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'DEVELOPER') {
    const developer = await prisma.developerCompany.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!developer) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'TRAVEL_AGENCY') {
    const travelAgency = await prisma.travelAgency.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!travelAgency) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'USER') {
    const user = await prisma.user.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!user) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'CONTRACT') {
    const contract = await prisma.rentalContractDraft.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!contract) throw new AppError(404, 'Verification target not found');
    return;
  }

  if (data.targetType === 'TRANSACTION') {
    const transaction = await prisma.marketplaceTransaction.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        id: true
      }
    });

    if (!transaction) throw new AppError(404, 'Verification target not found');
  }
}

async function assertUserCanSubmitVerification(
  data: VerificationPayload,
  user: AuthUser
) {
  await assertVerificationTargetExists(data);

  if (isAdmin(user)) return;

  if (data.source !== 'OWNER_DOCUMENT_SUBMISSION') {
    throw new AppError(
      403,
      'Only admin users can submit this verification source'
    );
  }

  if (data.targetType === 'LISTING') {
    const listing = await prisma.listing.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        ownerId: true
      }
    });

    if (listing?.ownerId === user.id) return;

    throw new AppError(403, 'You cannot submit verification for this listing');
  }

  if (data.targetType === 'ACTIVITY') {
    const activity = await prisma.activity.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        ownerId: true
      }
    });

    if (activity?.ownerId === user.id) return;

    throw new AppError(403, 'You cannot submit verification for this activity');
  }

  if (data.targetType === 'USER') {
    if (data.targetId === user.id) return;

    throw new AppError(403, 'You cannot submit verification for another user');
  }

  if (data.targetType === 'CONTRACT') {
    const contract = await prisma.rentalContractDraft.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        createdById: true,
        landlordUserId: true,
        tenantUserId: true
      }
    });

    if (
      contract?.createdById === user.id ||
      contract?.landlordUserId === user.id ||
      contract?.tenantUserId === user.id
    ) {
      return;
    }

    throw new AppError(403, 'You cannot submit verification for this contract');
  }

  if (data.targetType === 'TRANSACTION') {
    const transaction = await prisma.marketplaceTransaction.findUnique({
      where: {
        id: data.targetId
      },
      select: {
        buyerId: true,
        sellerId: true,
        landlordId: true,
        tenantId: true,
        providerId: true,
        adminId: true,
        participants: {
          where: {
            userId: user.id
          },
          select: {
            id: true
          },
          take: 1
        }
      }
    });

    if (
      transaction?.buyerId === user.id ||
      transaction?.sellerId === user.id ||
      transaction?.landlordId === user.id ||
      transaction?.tenantId === user.id ||
      transaction?.providerId === user.id ||
      transaction?.adminId === user.id ||
      Number(transaction?.participants.length) > 0
    ) {
      return;
    }

    throw new AppError(403, 'You cannot submit verification for this transaction');
  }

  throw new AppError(
    403,
    'This verification target requires an admin-reviewed workflow'
  );
}

function formatVerificationStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

async function notifyVerificationReviewed(verification: {
  id: string;
  targetType: string;
  status: string;
  submittedById?: string | null;
}) {
  if (!verification.submittedById) return;

  await prisma.notification.create({
    data: {
      userId: verification.submittedById,
      type: 'VERIFICATION_STATUS_UPDATED',
      title: 'Verification status updated',
      message: `${verification.targetType.toLowerCase()} verification is now ${formatVerificationStatus(
        verification.status
      )}.`
    }
  });
}

verificationRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = verificationSchema.parse(req.body);

    await assertUserCanSubmitVerification(data, req.user!);

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
        verificationDate:
          adapterResult.status === 'ADMIN_VERIFIED' ||
          adapterResult.status === 'EXTERNALLY_VERIFIED'
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
        verificationDate:
          data.status === 'ADMIN_VERIFIED' || data.status === 'EXTERNALLY_VERIFIED'
            ? new Date()
            : undefined,
        reviewedById: req.user!.id
      },
      select: {
        id: true,
        targetType: true,
        status: true,
        submittedById: true
      }
    });

    await notifyVerificationReviewed(verification);

    res.json({ verification });
  } catch (error) {
    next(error);
  }
});