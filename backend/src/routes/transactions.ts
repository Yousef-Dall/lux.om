import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';

export const transactionsRouter = Router();

const transactionSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(['PROPERTY_SALE', 'PROPERTY_RENTAL', 'ACTIVITY_BOOKING', 'PROVIDER_PAYOUT', 'OTHER']).default('OTHER'),
  amount: z.coerce.number().finite().min(0).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('OMR'),
  listingId: z.string().trim().optional(),
  activityId: z.string().trim().optional(),
  bookingId: z.string().trim().optional(),
  contractDraftId: z.string().trim().optional(),
  rentDueItemId: z.string().trim().optional(),
  buyerId: z.string().trim().optional(),
  sellerId: z.string().trim().optional(),
  landlordId: z.string().trim().optional(),
  tenantId: z.string().trim().optional(),
  providerId: z.string().trim().optional(),
  adminNotes: z.string().trim().max(3000).optional(),
  documentChecklist: z.unknown().optional()
}).strict();

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'ARCHIVED']).optional(),
  escrowStatus: z.enum(['NOT_STARTED', 'PENDING_DEPOSIT', 'HELD', 'RELEASE_REQUESTED', 'RELEASED', 'DISPUTED', 'CANCELLED']).optional(),
  message: z.string().trim().max(1000).optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

transactionsRouter.post('/', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);

    const createdTransaction = await prisma.marketplaceTransaction.create({
      data: {
        title: data.title,
        type: data.type,
        amount: data.amount === undefined ? undefined : data.amount.toString(),
        currency: data.currency.toUpperCase(),
        listingId: data.listingId,
        activityId: data.activityId,
        bookingId: data.bookingId,
        contractDraftId: data.contractDraftId,
        rentDueItemId: data.rentDueItemId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        landlordId: data.landlordId,
        tenantId: data.tenantId,
        providerId: data.providerId,
        adminId: req.user!.role === 'ADMIN' ? req.user!.id : undefined,
        adminNotes: data.adminNotes,
        documentChecklist:
          data.documentChecklist === undefined
            ? undefined
            : data.documentChecklist === null
              ? Prisma.JsonNull
              : (data.documentChecklist as Prisma.InputJsonValue)
      }
    });

    await prisma.transactionAuditEvent.create({
      data: {
        transactionId: createdTransaction.id,
        type: 'CREATED',
        message: 'Transaction created.',
        actorId: req.user!.id
      }
    });

    const transaction = await prisma.marketplaceTransaction.findUniqueOrThrow({
      where: {
        id: createdTransaction.id
      },
      include: {
        auditEvents: true
      }
    });

    res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
});

transactionsRouter.get('/mine', requireAuth(), async (req, res, next) => {
  try {
    const transactions = await prisma.marketplaceTransaction.findMany({
      where: {
        OR: [
          { buyerId: req.user!.id },
          { sellerId: req.user!.id },
          { landlordId: req.user!.id },
          { tenantId: req.user!.id },
          { providerId: req.user!.id },
          { adminId: req.user!.id },
          { participants: { some: { userId: req.user!.id } } }
        ]
      },
      include: { auditEvents: { orderBy: { createdAt: 'desc' } }, ledgerEntries: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ transactions });
  } catch (error) {
    next(error);
  }
});

transactionsRouter.get('/admin/all', requireAuth(), requireAdmin(), async (_req, res, next) => {
  try {
    const transactions = await prisma.marketplaceTransaction.findMany({
      include: {
        listing: true,
        activity: true,
        booking: true,
        contractDraft: true,
        participants: true,
        auditEvents: { orderBy: { createdAt: 'desc' } },
        ledgerEntries: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ transactions });
  } catch (error) {
    next(error);
  }
});

transactionsRouter.patch('/admin/:id/status', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = statusSchema.parse(req.body);

    const transaction = await prisma.marketplaceTransaction.update({
      where: { id },
      data: {
        status: data.status,
        escrowStatus: data.escrowStatus,
        auditEvents: {
          create: {
            type: data.escrowStatus ? 'ESCROW_STATUS_CHANGED' : 'STATUS_CHANGED',
            message: data.message ?? 'Transaction status updated.',
            actorId: req.user!.id
          }
        }
      },
      include: { auditEvents: { orderBy: { createdAt: 'desc' } } }
    });

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});
