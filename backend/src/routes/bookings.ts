import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const bookingsRouter = Router();

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must use HH:mm format'
  });

const bookingSchema = z
  .object({
    listingId: z.string().min(1).optional(),
    activityId: z.string().min(1).optional(),
    scheduledDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Date must use YYYY-MM-DD format'
      })
      .optional(),
    preferredTime: timeSchema.optional(),
    guests: z.coerce.number().int().min(1).max(100).default(1),
    contactName: z.string().trim().min(2).max(100).optional(),
    contactEmail: z.string().trim().email().max(160).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    message: z.string().trim().max(1000).optional(),
    amount: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0)
  })
  .strict()
  .superRefine((data, context) => {
    if (Boolean(data.listingId) === Boolean(data.activityId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activityId'],
        message: 'Choose either a listing or an activity booking target'
      });
    }
  });

const adminBookingsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(100),
  skip: z.coerce.number().int().min(0).default(0)
});

const paymentStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'NOT_REQUIRED'])
  })
  .strict();

const paramsSchema = z.object({
  id: z.string().min(1)
});

const bookingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  listing: true,
  activity: true,
  payment: true
};

function toScheduledDate(value?: string) {
  if (!value) return undefined;

  return new Date(`${value}T00:00:00.000Z`);
}

function getDayName(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC'
  });
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

bookingsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = bookingSchema.parse(req.body);
    const scheduledDate = toScheduledDate(data.scheduledDate);

    if (data.listingId) {
      const listing = await prisma.listing.findUnique({
        where: {
          id: data.listingId
        }
      });

      if (!listing || listing.status !== 'APPROVED') {
        throw new AppError(404, 'Listing not found');
      }

      if (listing.ownerId === req.user!.id) {
        throw new AppError(400, 'You cannot create a booking request for your own listing');
      }

      const booking = await prisma.booking.create({
        data: {
          listingId: data.listingId,
          userId: req.user!.id,
          message: data.message?.trim() || '',
          scheduledDate,
          preferredTime: data.preferredTime,
          guests: data.guests,
          contactName: data.contactName?.trim() || req.user!.name,
          contactEmail: data.contactEmail?.trim() || req.user!.email,
          contactPhone: data.contactPhone?.trim() || req.user!.phone,
          payment: {
            create: {
              amount: data.amount,
              commission: data.commission,
              status: data.amount > 0 ? 'PENDING' : 'NOT_REQUIRED'
            }
          }
        },
        include: bookingInclude
      });

      res.status(201).json({
        booking
      });

      return;
    }

    const activity = await prisma.activity.findUnique({
      where: {
        id: data.activityId
      }
    });

    if (!activity || activity.status !== 'APPROVED') {
      throw new AppError(404, 'Activity not found');
    }

    if (activity.ownerId === req.user!.id) {
      throw new AppError(400, 'You cannot create a booking request for your own activity');
    }

    if (!scheduledDate) {
      throw new AppError(400, 'Scheduled date is required for activity bookings');
    }

    if (activity.availabilityDays.length > 0) {
      const requestedDay = getDayName(scheduledDate);

      if (!activity.availabilityDays.includes(requestedDay)) {
        throw new AppError(400, 'Activity is not available on the selected date');
      }
    }

    if (data.preferredTime && activity.availabilityStartTime && activity.availabilityEndTime) {
      const requestedTime = timeToMinutes(data.preferredTime);
      const startTime = timeToMinutes(activity.availabilityStartTime);
      const endTime = timeToMinutes(activity.availabilityEndTime);

      if (requestedTime < startTime || requestedTime > endTime) {
        throw new AppError(400, 'Preferred time is outside the activity availability window');
      }
    }

    const booking = await prisma.booking.create({
      data: {
        activityId: data.activityId,
        userId: req.user!.id,
        message: data.message?.trim() || '',
        scheduledDate,
        preferredTime: data.preferredTime,
        guests: data.guests,
        contactName: data.contactName?.trim() || req.user!.name,
        contactEmail: data.contactEmail?.trim() || req.user!.email,
        contactPhone: data.contactPhone?.trim() || req.user!.phone,
        payment: {
          create: {
            amount: data.amount,
            commission: data.commission,
            status: data.amount > 0 ? 'PENDING' : 'NOT_REQUIRED'
          }
        }
      },
      include: bookingInclude
    });

    res.status(201).json({
      booking
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const query = adminBookingsQuerySchema.parse(req.query);

    const bookings = await prisma.booking.findMany({
      include: bookingInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      bookings,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: bookings.length
      }
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.patch('/admin/payments/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const { status } = paymentStatusSchema.parse(req.body);

    const payment = await prisma.payment.update({
      where: {
        id
      },
      data: {
        status
      }
    });

    res.json({
      payment
    });
  } catch (error) {
    next(error);
  }
});
