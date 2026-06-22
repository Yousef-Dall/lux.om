import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const rentPaymentsRouter = Router();

const scheduleSchema = z.object({
  title: z.string().trim().min(2).max(160),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  amount: z.coerce.number().finite().min(0),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('OMR'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  notes: z.string().trim().max(1000).optional(),
  contractDraftId: z.string().trim().optional(),
  listingId: z.string().trim().optional(),
  landlordUserId: z.string().trim().optional(),
  tenantUserId: z.string().trim().optional()
}).strict();

const dueItemSchema = z.object({
  dueDate: z.coerce.date(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  amount: z.coerce.number().finite().min(0),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('OMR'),
  notes: z.string().trim().max(1000).optional()
}).strict();

const markPaidSchema = z.object({
  paidAt: z.coerce.date().optional(),
  paymentProvider: z.string().trim().max(80).optional(),
  paymentReference: z.string().trim().max(160).optional(),
  receiptNumber: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

rentPaymentsRouter.post('/schedules', requireAuth(), async (req, res, next) => {
  try {
    const data = scheduleSchema.parse(req.body);
    const schedule = await prisma.rentPaymentSchedule.create({
      data: {
        ...data,
        amount: data.amount.toString(),
        currency: data.currency.toUpperCase(),
        createdById: req.user!.id
      }
    });

    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
});

rentPaymentsRouter.post('/schedules/:id/due-items', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = dueItemSchema.parse(req.body);
    const dueItem = await prisma.rentPaymentDueItem.create({
      data: {
        ...data,
        amount: data.amount.toString(),
        currency: data.currency.toUpperCase(),
        scheduleId: id
      }
    });

    res.status(201).json({ dueItem });
  } catch (error) {
    next(error);
  }
});

rentPaymentsRouter.get('/mine', requireAuth(), async (req, res, next) => {
  try {
    const schedules = await prisma.rentPaymentSchedule.findMany({
      where: {
        OR: [
          { createdById: req.user!.id },
          { landlordUserId: req.user!.id },
          { tenantUserId: req.user!.id }
        ]
      },
      include: { dueItems: { orderBy: { dueDate: 'asc' } }, listing: true, contractDraft: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ schedules });
  } catch (error) {
    next(error);
  }
});

rentPaymentsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const schedules = await prisma.rentPaymentSchedule.findMany({
      include: { dueItems: { orderBy: { dueDate: 'asc' } }, listing: true, contractDraft: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ schedules });
  } catch (error) {
    next(error);
  }
});

rentPaymentsRouter.patch('/due-items/:id/paid', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = markPaidSchema.parse(req.body);

    const dueItem = await prisma.rentPaymentDueItem.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: data.paidAt ?? new Date(),
        paymentProvider: data.paymentProvider,
        paymentReference: data.paymentReference,
        receiptNumber: data.receiptNumber,
        notes: data.notes
      }
    });

    res.json({ dueItem });
  } catch (error) {
    next(error);
  }
});
