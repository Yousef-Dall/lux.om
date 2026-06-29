import {
  NotificationType,
  Prisma,
  VerificationSource,
  VerificationStatus,
  type VerificationTargetType
} from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { submitVerificationRequest } from '../services/verificationAdapters';
import { AppError } from '../utils/http';

export const verificationRouter = Router();

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

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
  .strict()
  .superRefine((data, ctx) => {
    if (
      ['ADMIN_VERIFIED', 'EXTERNALLY_VERIFIED', 'REJECTED', 'EXPIRED'].includes(
        data.status
      ) &&
      (!data.notes || data.notes.length < 12)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'A clear review note of at least 12 characters is required'
      });
    }

    if (
      data.expiryDate &&
      data.status !== 'EXPIRED' &&
      data.expiryDate.getTime() <= Date.now()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date must be in the future'
      });
    }
  });

const adminVerificationQuerySchema = z
  .object({
    status: z
      .enum([
        'UNVERIFIED',
        'SUBMITTED',
        'ADMIN_VERIFIED',
        'EXTERNALLY_VERIFIED',
        'REJECTED',
        'EXPIRED'
      ])
      .optional(),
    source: z
      .enum([
        'LUX_OM_ADMIN_REVIEW',
        'OWNER_DOCUMENT_SUBMISSION',
        'FUTURE_MOLUP_API',
        'FUTURE_MUNICIPALITY_REGISTRATION',
        'FUTURE_THIRD_PARTY_PROVIDER'
      ])
      .optional(),
    targetType: z
      .enum([
        'LISTING',
        'ACTIVITY',
        'DEVELOPER',
        'TRAVEL_AGENCY',
        'USER',
        'CONTRACT',
        'TRANSACTION'
      ])
      .optional(),
    take: z.coerce.number().int().min(1).max(200).default(100),
    skip: z.coerce.number().int().min(0).default(0)
  })
  .strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

type AuthUser = {
  id: string;
  role: string;
};

type VerificationPayload = z.infer<typeof verificationSchema>;
type AdminReviewPayload = z.infer<typeof adminReviewSchema>;

function isAdmin(user: AuthUser) {
  return user.role === 'ADMIN';
}

function isVerifiedStatus(status: VerificationStatus | string) {
  return (
    status === VerificationStatus.ADMIN_VERIFIED ||
    status === VerificationStatus.EXTERNALLY_VERIFIED
  );
}

function shouldMarkTargetUnverified(status: VerificationStatus | string) {
  return (
    status === VerificationStatus.UNVERIFIED ||
    status === VerificationStatus.REJECTED ||
    status === VerificationStatus.EXPIRED
  );
}

function formatVerificationStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

function getReviewNotificationTitle(status: string) {
  if (isVerifiedStatus(status)) return 'Verification approved';
  if (status === VerificationStatus.REJECTED) return 'Verification rejected';
  if (status === VerificationStatus.EXPIRED) return 'Verification expired';

  return 'Verification status updated';
}

function getReviewNotificationMessage(verification: {
  targetType: string;
  status: string;
  notes?: string | null;
}) {
  const baseMessage = `${verification.targetType.toLowerCase()} verification is now ${formatVerificationStatus(
    verification.status
  )}.`;

  if (!verification.notes) return baseMessage;

  return `${baseMessage} Review note: ${verification.notes}`;
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

async function assertNoDuplicatePendingVerification(
  data: VerificationPayload,
  user: AuthUser
) {
  const existing = await prisma.verificationRecord.findFirst({
    where: {
      targetType: data.targetType,
      targetId: data.targetId,
      source: data.source,
      submittedById: user.id,
      status: VerificationStatus.SUBMITTED
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new AppError(
      409,
      'A pending verification request already exists for this target'
    );
  }
}

async function getAdminNotificationUserIds(db: DatabaseClient, actorId?: string) {
  const admins = await db.user.findMany({
    where: {
      role: 'ADMIN',
      suspendedAt: null,
      id: actorId
        ? {
            not: actorId
          }
        : undefined
    },
    select: {
      id: true
    }
  });

  return admins.map((admin) => admin.id);
}

async function getTargetNotificationUserIds(
  db: DatabaseClient,
  targetType: VerificationTargetType | string,
  targetId: string
) {
  if (targetType === 'LISTING') {
    const listing = await db.listing.findUnique({
      where: {
        id: targetId
      },
      select: {
        ownerId: true
      }
    });

    return listing?.ownerId ? [listing.ownerId] : [];
  }

  if (targetType === 'ACTIVITY') {
    const activity = await db.activity.findUnique({
      where: {
        id: targetId
      },
      select: {
        ownerId: true
      }
    });

    return activity?.ownerId ? [activity.ownerId] : [];
  }

  if (targetType === 'USER') {
    return [targetId];
  }

  if (targetType === 'CONTRACT') {
    const contract = await db.rentalContractDraft.findUnique({
      where: {
        id: targetId
      },
      select: {
        createdById: true,
        landlordUserId: true,
        tenantUserId: true
      }
    });

    return [
      contract?.createdById,
      contract?.landlordUserId,
      contract?.tenantUserId
    ].filter(Boolean) as string[];
  }

  if (targetType === 'TRANSACTION') {
    const transaction = await db.marketplaceTransaction.findUnique({
      where: {
        id: targetId
      },
      select: {
        buyerId: true,
        sellerId: true,
        landlordId: true,
        tenantId: true,
        providerId: true,
        adminId: true,
        participants: {
          select: {
            userId: true
          }
        }
      }
    });

    return [
      transaction?.buyerId,
      transaction?.sellerId,
      transaction?.landlordId,
      transaction?.tenantId,
      transaction?.providerId,
      transaction?.adminId,
      ...(transaction?.participants.map((participant) => participant.userId) ?? [])
    ].filter(Boolean) as string[];
  }

  return [];
}

async function createVerificationNotifications(
  db: DatabaseClient,
  input: {
    userIds: string[];
    title: string;
    message: string;
  }
) {
  const uniqueUserIds = [...new Set(input.userIds)].filter(Boolean);

  if (uniqueUserIds.length === 0) return;

  await db.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      type: NotificationType.VERIFICATION_STATUS_UPDATED,
      title: input.title,
      message: input.message
    }))
  });
}

async function notifyVerificationSubmitted(
  db: DatabaseClient,
  verification: {
    targetType: string;
    targetId: string;
    status: string;
    submittedById?: string | null;
  },
  actorId: string
) {
  const targetUserIds = await getTargetNotificationUserIds(
    db,
    verification.targetType,
    verification.targetId
  );

  const adminUserIds = await getAdminNotificationUserIds(db, actorId);

  await createVerificationNotifications(db, {
    userIds: verification.submittedById
      ? [...targetUserIds, verification.submittedById]
      : targetUserIds,
    title: 'Verification submitted',
    message: `${verification.targetType.toLowerCase()} verification was submitted and is now ${formatVerificationStatus(
      verification.status
    )}.`
  });

  await createVerificationNotifications(db, {
    userIds: adminUserIds,
    title: 'New verification submitted',
    message: `${verification.targetType.toLowerCase()} verification needs admin review. Target ID: ${verification.targetId}.`
  });
}

async function notifyVerificationReviewed(
  db: DatabaseClient,
  verification: {
    id: string;
    targetType: string;
    targetId: string;
    status: string;
    notes?: string | null;
    submittedById?: string | null;
  }
) {
  const targetUserIds = await getTargetNotificationUserIds(
    db,
    verification.targetType,
    verification.targetId
  );

  const userIds = verification.submittedById
    ? [...targetUserIds, verification.submittedById]
    : targetUserIds;

  await createVerificationNotifications(db, {
    userIds,
    title: getReviewNotificationTitle(verification.status),
    message: getReviewNotificationMessage(verification)
  });
}

async function applyVerificationToTarget(
  db: DatabaseClient,
  verification: {
    targetType: string;
    targetId: string;
    status: VerificationStatus;
    source: VerificationSource;
    notes?: string | null;
    verificationDate?: Date | null;
    expiryDate?: Date | null;
  },
  reviewerId: string
) {
  const commonData = {
    verificationStatus: verification.status,
    verificationSource: verification.source,
    verificationNotes: verification.notes ?? null,
    verificationDate: isVerifiedStatus(verification.status)
      ? (verification.verificationDate ?? new Date())
      : null,
    verificationExpiryDate: verification.expiryDate ?? null,
    verificationReviewedById: reviewerId
  };

  if (verification.targetType === 'LISTING') {
    await db.listing.update({
      where: {
        id: verification.targetId
      },
      data: commonData
    });
    return;
  }

  if (verification.targetType === 'ACTIVITY') {
    await db.activity.update({
      where: {
        id: verification.targetId
      },
      data: commonData
    });
    return;
  }

  const verifiedFlagUpdate =
    isVerifiedStatus(verification.status)
      ? { verified: true }
      : shouldMarkTargetUnverified(verification.status)
        ? { verified: false }
        : {};

  if (verification.targetType === 'DEVELOPER') {
    await db.developerCompany.update({
      where: {
        id: verification.targetId
      },
      data: {
        ...commonData,
        ...verifiedFlagUpdate
      }
    });
    return;
  }

  if (verification.targetType === 'TRAVEL_AGENCY') {
    await db.travelAgency.update({
      where: {
        id: verification.targetId
      },
      data: {
        ...commonData,
        ...verifiedFlagUpdate
      }
    });
  }
}

function assertReviewDecisionAllowed(
  existing: {
    source: string;
  },
  data: AdminReviewPayload
) {
  if (
    data.status === VerificationStatus.EXTERNALLY_VERIFIED &&
    existing.source === 'OWNER_DOCUMENT_SUBMISSION'
  ) {
    throw new AppError(
      400,
      'Owner document submissions must be admin verified, not externally verified'
    );
  }
}

verificationRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = verificationSchema.parse(req.body);

    await assertUserCanSubmitVerification(data, req.user!);
    await assertNoDuplicatePendingVerification(data, req.user!);

    const adapterResult = await submitVerificationRequest({
      targetType: data.targetType,
      targetId: data.targetId,
      source: data.source,
      submittedDocumentUrls: data.submittedDocumentUrls,
      notes: data.notes
    });

    const verification = await prisma.$transaction(async (tx) => {
      const createdVerification = await tx.verificationRecord.create({
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

      await notifyVerificationSubmitted(tx, createdVerification, req.user!.id);

      return createdVerification;
    });

    res.status(201).json({ verification });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get(
  '/admin/all',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const query = adminVerificationQuerySchema.parse(req.query);

      const where: Prisma.VerificationRecordWhereInput = {
        status: query.status,
        source: query.source,
        targetType: query.targetType
      };

      const [verifications, total] = await Promise.all([
        prisma.verificationRecord.findMany({
          where,
          include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: query.take,
          skip: query.skip
        }),
        prisma.verificationRecord.count({ where })
      ]);

      res.json({
        verifications,
        pagination: {
          take: query.take,
          skip: query.skip,
          count: verifications.length,
          total
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

verificationRouter.patch(
  '/admin/:id/review',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = adminReviewSchema.parse(req.body);

      const verification = await prisma.$transaction(async (tx) => {
        const existingVerification = await tx.verificationRecord.findUnique({
          where: { id }
        });

        if (!existingVerification) {
          throw new AppError(404, 'Verification request not found');
        }

        assertReviewDecisionAllowed(existingVerification, data);

        const updateData: Prisma.VerificationRecordUpdateInput = {
          status: data.status,
          verificationDate: isVerifiedStatus(data.status) ? new Date() : null,
          reviewedBy: {
            connect: {
              id: req.user!.id
            }
          }
        };

        if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
          updateData.notes = data.notes ?? null;
        }

        if (Object.prototype.hasOwnProperty.call(data, 'expiryDate')) {
          updateData.expiryDate = data.expiryDate ?? null;
        }

        const updatedVerification = await tx.verificationRecord.update({
          where: { id },
          data: updateData,
          include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true, email: true } }
          }
        });

        await applyVerificationToTarget(
          tx,
          {
            targetType: updatedVerification.targetType,
            targetId: updatedVerification.targetId,
            status: updatedVerification.status,
            source: updatedVerification.source,
            notes: updatedVerification.notes,
            verificationDate: updatedVerification.verificationDate,
            expiryDate: updatedVerification.expiryDate
          },
          req.user!.id
        );

        await notifyVerificationReviewed(tx, updatedVerification);

        return updatedVerification;
      });

      res.json({ verification });
    } catch (error) {
      next(error);
    }
  }
);
