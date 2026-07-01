import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const rentPaymentsRouter = Router();

const scheduleSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    frequency: z
      .enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
      .default('MONTHLY'),
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
  })
  .strict();

const dueItemSchema = z
  .object({
    dueDate: z.coerce.date(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    amount: z.coerce.number().finite().min(0),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('OMR'),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();

const markPaidSchema = z
  .object({
    paidAt: z.coerce.date().optional(),
    paymentProvider: z.string().trim().max(80).optional(),
    paymentReference: z.string().trim().max(160).optional(),
    receiptNumber: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

const rentScheduleAccessInclude = {
  listing: {
    select: {
      id: true,
      ownerId: true
    }
  },
  contractDraft: {
    select: {
      id: true,
      createdById: true,
      landlordUserId: true,
      tenantUserId: true,
      listing: {
        select: {
          id: true,
          ownerId: true
        }
      }
    }
  }
};

type AuthUser = {
  id: string;
  role: string;
};

type RentScheduleAccessRecord = {
  createdById: string;
  landlordUserId?: string | null;
  tenantUserId?: string | null;
  listing?: {
    id: string;
    ownerId: string;
  } | null;
  contractDraft?: {
    id: string;
    createdById: string;
    landlordUserId?: string | null;
    tenantUserId?: string | null;
    listing?: {
      id: string;
      ownerId: string;
    } | null;
  } | null;
};

function isAdmin(user: AuthUser) {
  return user.role === 'ADMIN';
}

function canManageRentSchedule(
  schedule: RentScheduleAccessRecord,
  user: AuthUser
) {
  if (isAdmin(user)) return true;

  return (
    schedule.createdById === user.id ||
    schedule.landlordUserId === user.id ||
    schedule.listing?.ownerId === user.id ||
    schedule.contractDraft?.createdById === user.id ||
    schedule.contractDraft?.landlordUserId === user.id ||
    schedule.contractDraft?.listing?.ownerId === user.id
  );
}

function assertCanManageRentSchedule(
  schedule: RentScheduleAccessRecord,
  user: AuthUser
) {
  if (!canManageRentSchedule(schedule, user)) {
    throw new AppError(403, 'You do not have access to manage this rent payment schedule');
  }
}

async function assertScheduleCreateLinksAreAllowed(
  data: z.infer<typeof scheduleSchema>,
  user: AuthUser
) {
  if (isAdmin(user)) return;

  if (data.landlordUserId && data.landlordUserId !== user.id) {
    throw new AppError(403, 'You cannot create a rent schedule for another landlord');
  }

  if (data.tenantUserId && !data.contractDraftId) {
    throw new AppError(403, 'Tenant user links require an existing contract draft');
  }

  if (data.listingId) {
    const listing = await prisma.listing.findUnique({
      where: {
        id: data.listingId
      },
      select: {
        id: true,
        ownerId: true
      }
    });

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.ownerId !== user.id) {
      throw new AppError(403, 'You cannot create a rent schedule for this listing');
    }
  }

  if (data.contractDraftId) {
    const contractDraft = await prisma.rentalContractDraft.findUnique({
      where: {
        id: data.contractDraftId
      },
      select: {
        id: true,
        createdById: true,
        landlordUserId: true,
        tenantUserId: true,
        listing: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });

    if (!contractDraft) {
      throw new AppError(404, 'Contract draft not found');
    }

    const canUseContract =
      contractDraft.createdById === user.id ||
      contractDraft.landlordUserId === user.id ||
      contractDraft.listing?.ownerId === user.id;

    if (!canUseContract) {
      throw new AppError(403, 'You cannot create a rent schedule for this contract');
    }

    if (data.tenantUserId && data.tenantUserId !== contractDraft.tenantUserId) {
      throw new AppError(403, 'Tenant user must match the linked contract draft');
    }
  }
}

async function getRentScheduleForManagement(scheduleId: string, user: AuthUser) {
  const schedule = await prisma.rentPaymentSchedule.findUnique({
    where: {
      id: scheduleId
    },
    include: rentScheduleAccessInclude
  });

  if (!schedule) {
    throw new AppError(404, 'Rent payment schedule not found');
  }

  assertCanManageRentSchedule(schedule, user);

  return schedule;
}

function getUniqueRentNotificationUsers(
  schedule: {
    createdById: string;
    landlordUserId?: string | null;
    tenantUserId?: string | null;
    listing?: {
      ownerId: string;
    } | null;
    contractDraft?: {
      createdById: string;
      landlordUserId?: string | null;
      tenantUserId?: string | null;
      listing?: {
        ownerId: string;
      } | null;
    } | null;
  },
  actorId?: string
) {
  return Array.from(
    new Set(
      [
        schedule.createdById,
        schedule.landlordUserId,
        schedule.tenantUserId,
        schedule.listing?.ownerId,
        schedule.contractDraft?.createdById,
        schedule.contractDraft?.landlordUserId,
        schedule.contractDraft?.tenantUserId,
        schedule.contractDraft?.listing?.ownerId
      ]
        .filter((id): id is string => Boolean(id))
        .filter((id) => id !== actorId)
    )
  );
}

function formatRentMoney(amount: { toString(): string } | string | number, currency: string) {
  const numericAmount = Number(amount.toString());

  if (!Number.isFinite(numericAmount)) return `${currency} ${amount.toString()}`;

  return `${currency} ${numericAmount.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function formatRentDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(value);
}

async function notifyRentDueCreated({
  schedule,
  dueItem,
  actorId
}: {
  schedule: Awaited<ReturnType<typeof getRentScheduleForManagement>>;
  dueItem: {
    dueDate: Date;
    amount: { toString(): string } | string | number;
    currency: string;
  };
  actorId: string;
}) {
  const userIds = getUniqueRentNotificationUsers(schedule, actorId);

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'RENT_PAYMENT_DUE',
      title: 'Rent payment due',
      message: `${schedule.title} has a rent payment due on ${formatRentDate(
        dueItem.dueDate
      )} for ${formatRentMoney(dueItem.amount, dueItem.currency)}.`
    }))
  });
}

async function notifyRentMarkedPaid({
  schedule,
  dueItem,
  actorId
}: {
  schedule: Awaited<ReturnType<typeof getRentScheduleForManagement>>;
  dueItem: {
    paidAt?: Date | null;
    amount: { toString(): string } | string | number;
    currency: string;
    receiptNumber?: string | null;
  };
  actorId: string;
}) {
  const userIds = getUniqueRentNotificationUsers(schedule, actorId);

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'RENT_PAYMENT_DUE',
      title: 'Rent payment marked paid',
      message: `${schedule.title} payment of ${formatRentMoney(
        dueItem.amount,
        dueItem.currency
      )} was marked paid${
        dueItem.receiptNumber ? ` with receipt ${dueItem.receiptNumber}` : ''
      }.`
    }))
  });
}

rentPaymentsRouter.post('/schedules', requireAuth(), async (req, res, next) => {
  try {
    const data = scheduleSchema.parse(req.body);

    await assertScheduleCreateLinksAreAllowed(data, req.user!);

    const schedule = await prisma.rentPaymentSchedule.create({
      data: {
        title: data.title,
        frequency: data.frequency,
        amount: data.amount.toString(),
        currency: data.currency.toUpperCase(),
        startDate: data.startDate,
        endDate: data.endDate,
        dueDayOfMonth: data.dueDayOfMonth,
        notes: data.notes,
        contractDraftId: data.contractDraftId,
        listingId: data.listingId,
        createdById: req.user!.id,
        landlordUserId:
          req.user!.role === 'ADMIN'
            ? data.landlordUserId
            : data.landlordUserId ?? req.user!.id,
        tenantUserId: data.tenantUserId
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

    const schedule = await getRentScheduleForManagement(id, req.user!);

    const dueItem = await prisma.rentPaymentDueItem.create({
      data: {
        dueDate: data.dueDate,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        amount: data.amount.toString(),
        currency: data.currency.toUpperCase(),
        notes: data.notes,
        scheduleId: id
      }
    });

    await notifyRentDueCreated({
      schedule,
      dueItem,
      actorId: req.user!.id
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
      include: {
        dueItems: {
          orderBy: {
            dueDate: 'asc'
          }
        },
        listing: true,
        contractDraft: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ schedules });
  } catch (error) {
    next(error);
  }
});

rentPaymentsRouter.get('/admin/all', requireAuth(), requireAdmin(), async (_req, res, next) => {
  try {
    const schedules = await prisma.rentPaymentSchedule.findMany({
      include: {
        dueItems: {
          orderBy: {
            dueDate: 'asc'
          }
        },
        listing: true,
        contractDraft: true
      },
      orderBy: {
        createdAt: 'desc'
      },
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

    const dueItem = await prisma.rentPaymentDueItem.findUnique({
      where: {
        id
      },
      include: {
        schedule: {
          include: rentScheduleAccessInclude
        }
      }
    });

    if (!dueItem) {
      throw new AppError(404, 'Rent payment due item not found');
    }

    assertCanManageRentSchedule(dueItem.schedule, req.user!);

    const updatedDueItem = await prisma.rentPaymentDueItem.update({
      where: {
        id
      },
      data: {
        status: 'PAID',
        paidAt: data.paidAt ?? new Date(),
        paymentProvider: data.paymentProvider,
        paymentReference: data.paymentReference,
        receiptNumber: data.receiptNumber,
        notes: data.notes
      }
    });

    await notifyRentMarkedPaid({
      schedule: dueItem.schedule,
      dueItem: updatedDueItem,
      actorId: req.user!.id
    });

    res.json({ dueItem: updatedDueItem });
  } catch (error) {
    next(error);
  }
});