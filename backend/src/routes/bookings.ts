import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import {
  recordAdminBookingDecision,
  recordBookingCreated,
  recordOwnerBookingDecision,
  recordPaymentSessionCreated,
  recordPaymentSync
} from '../lib/bookingNotifications';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const bookingsRouter = Router();

const CHECKOUT_PROVIDER = 'THAWANI';
const DEFAULT_COMMISSION_RATE = 0.1;
const DEFAULT_THAWANI_API_BASE_URL = 'https://uatcheckout.thawani.om/api/v1';
const DEFAULT_THAWANI_CHECKOUT_BASE_URL = 'https://uatcheckout.thawani.om';

type BookingWithPayment = NonNullable<
  Awaited<ReturnType<typeof prisma.booking.findUnique>>
>;

type ThawaniApiResponse<T> = {
  success?: boolean;
  code?: number;
  description?: string;
  data?: T;
};

type ThawaniCreateSessionData = {
  session_id: string;
  payment_status?: 'paid' | 'unpaid' | 'cancelled';
};

type ThawaniRetrieveSessionData = {
  session_id: string;
  payment_status: 'paid' | 'unpaid' | 'cancelled';
};

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

const bookingStatusSchema = z
  .object({
    status: z.enum([
      'PENDING',
      'OWNER_APPROVED',
      'OWNER_REJECTED',
      'ADMIN_CONFIRMED',
      'CANCELLED'
    ])
  })
  .strict();

const ownerBookingStatusSchema = z
  .object({
    status: z.enum(['OWNER_APPROVED', 'OWNER_REJECTED'])
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
  payment: true,
  events: {
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  }
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

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function toBaisa(amount: number) {
  return Math.round(amount * 1000);
}

function getCommissionRate() {
  const envValue = Number(process.env.PLATFORM_COMMISSION_RATE);

  if (Number.isFinite(envValue) && envValue >= 0 && envValue <= 1) {
    return envValue;
  }

  return DEFAULT_COMMISSION_RATE;
}

function calculateCommission(amount: number) {
  return toMoney(amount * getCommissionRate());
}

function decimalToNumber(value: unknown) {
  if (!value) return 0;

  const numberValue = Number(value.toString());

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function createPaymentReference() {
  return `lux_${randomUUID().replace(/-/g, '')}`;
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
}

function getThawaniApiBaseUrl() {
  return (process.env.THAWANI_API_BASE_URL ?? DEFAULT_THAWANI_API_BASE_URL).replace(/\/+$/, '');
}

function getThawaniCheckoutBaseUrl() {
  return (
    process.env.THAWANI_CHECKOUT_BASE_URL ?? DEFAULT_THAWANI_CHECKOUT_BASE_URL
  ).replace(/\/+$/, '');
}

function getThawaniConfig() {
  const secretKey = process.env.THAWANI_SECRET_KEY?.trim();
  const publishableKey = process.env.THAWANI_PUBLISHABLE_KEY?.trim();

  if (!secretKey || !publishableKey) {
    throw new AppError(
      503,
      'Thawani payment gateway is not configured. Set THAWANI_SECRET_KEY and THAWANI_PUBLISHABLE_KEY.'
    );
  }

  return {
    secretKey,
    publishableKey,
    apiBaseUrl: getThawaniApiBaseUrl(),
    checkoutBaseUrl: getThawaniCheckoutBaseUrl()
  };
}


const ACTIVE_CAPACITY_BOOKING_STATUSES = [
  'PENDING',
  'OWNER_APPROVED',
  'ADMIN_CONFIRMED'
] as const;

function getScheduledDayRange(scheduledDate: Date) {
  const start = new Date(scheduledDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end
  };
}

async function assertActivityCapacityAvailable(
  activity: { id: string; capacity: number | null },
  scheduledDate: Date,
  preferredTime: string | undefined,
  requestedGuests: number,
  excludeBookingId?: string
) {
  if (!activity.capacity) return;

  if (requestedGuests > activity.capacity) {
    throw new AppError(400, 'Guest count exceeds this activity capacity');
  }

  const { start, end } = getScheduledDayRange(scheduledDate);

  const existingBookings = await prisma.booking.findMany({
    where: {
      activityId: activity.id,
      status: {
        in: [...ACTIVE_CAPACITY_BOOKING_STATUSES]
      },
      scheduledDate: {
        gte: start,
        lt: end
      },
      preferredTime: preferredTime ?? null,
      ...(excludeBookingId
        ? {
            id: {
              not: excludeBookingId
            }
          }
        : {})
    },
    select: {
      guests: true
    }
  });

  const reservedGuests = existingBookings.reduce(
    (total, booking) => total + booking.guests,
    0
  );

  if (reservedGuests + requestedGuests > activity.capacity) {
    throw new AppError(409, 'Not enough availability for the selected date and time');
  }
}

function createReturnUrl(bookingId: string, reference: string, result: 'success' | 'cancel') {
  const url = new URL('/dashboard', getFrontendBaseUrl());
  url.searchParams.set('booking', bookingId);
  url.searchParams.set('payment', reference);
  url.searchParams.set('paymentResult', result);

  return url.toString();
}

function createCheckoutUrl(sessionId: string) {
  const { publishableKey, checkoutBaseUrl } = getThawaniConfig();

  return `${checkoutBaseUrl}/pay/${sessionId}?key=${encodeURIComponent(publishableKey)}`;
}

function calculateActivityPayment(activity: {
  priceAmount: unknown;
  priceCurrency: string | null;
  priceQualifier: string | null;
  priceUnit: string | null;
}, guests: number) {
  if (activity.priceQualifier === 'ON_REQUEST') {
    return {
      amount: 0,
      commission: 0,
      status: 'NOT_REQUIRED' as const,
      provider: null,
      reference: null
    };
  }

  const baseAmount = decimalToNumber(activity.priceAmount);

  if (baseAmount <= 0) {
    return {
      amount: 0,
      commission: 0,
      status: 'NOT_REQUIRED' as const,
      provider: null,
      reference: null
    };
  }

  const currency = activity.priceCurrency ?? 'OMR';

  if (currency !== 'OMR') {
    throw new AppError(400, 'Online activity payments currently support OMR only');
  }

  const quantity = activity.priceUnit === 'PERSON' ? guests : 1;
  const amount = toMoney(baseAmount * quantity);

  return {
    amount,
    commission: calculateCommission(amount),
    status: 'PENDING' as const,
    provider: CHECKOUT_PROVIDER,
    reference: createPaymentReference()
  };
}

function createManualPayment(amount: number, commission: number) {
  const normalizedAmount = toMoney(amount);
  const normalizedCommission = toMoney(commission);
  const paymentRequired = normalizedAmount > 0;

  return {
    amount: normalizedAmount,
    commission: normalizedCommission,
    status: paymentRequired ? ('PENDING' as const) : ('NOT_REQUIRED' as const),
    provider: paymentRequired ? CHECKOUT_PROVIDER : null,
    reference: paymentRequired ? createPaymentReference() : null
  };
}

function assertBookingAccess(booking: { userId: string }, user: { id: string; role: string }) {
  if (booking.userId !== user.id && user.role !== 'ADMIN') {
    throw new AppError(403, 'You do not have access to this booking');
  }
}

function assertBookingOwnerAccess(
  booking: {
    listing?: { ownerId: string } | null;
    activity?: { ownerId: string } | null;
  },
  user: { id: string; role: string }
) {
  if (user.role === 'ADMIN') return;

  if (booking.listing?.ownerId === user.id || booking.activity?.ownerId === user.id) {
    return;
  }

  throw new AppError(403, 'You do not have owner access to this booking');
}

function isPaidBooking(booking: { payment?: { status: string } | null }) {
  return booking.payment?.status === 'PAID';
}

function assertBookingCanStartPayment(booking: { status: string }) {
  if (booking.status === 'OWNER_APPROVED' || booking.status === 'ADMIN_CONFIRMED') {
    return;
  }

  throw new AppError(
    400,
    'Booking must be approved by the provider before payment can start'
  );
}

function assertOwnerBookingTransition(
  booking: {
    status: string;
    payment?: { status: string } | null;
  },
  nextStatus: 'OWNER_APPROVED' | 'OWNER_REJECTED'
) {
  if (nextStatus === 'OWNER_REJECTED' && isPaidBooking(booking)) {
    throw new AppError(400, 'Paid bookings cannot be rejected by the provider');
  }

  if (booking.status !== 'PENDING') {
    throw new AppError(
      400,
      'Only pending bookings can be approved or rejected by the provider'
    );
  }
}

function assertAdminBookingTransition(
  booking: {
    status: string;
    payment?: { status: string } | null;
  },
  nextStatus: string
) {
  if (
    isPaidBooking(booking) &&
    (nextStatus === 'OWNER_REJECTED' || nextStatus === 'CANCELLED')
  ) {
    throw new AppError(400, 'Paid bookings cannot be rejected or cancelled');
  }

  if (booking.status === 'CANCELLED' && nextStatus !== 'CANCELLED') {
    throw new AppError(400, 'Cancelled bookings cannot be reopened');
  }
}

function getBookingPaymentTitle(booking: any) {
  const activityTitle =
    booking.activity?.titleEn || booking.activity?.titleAr || booking.activity?.title;
  const listingTitle =
    booking.listing?.titleEn || booking.listing?.titleAr || booking.listing?.title;

  return String(activityTitle || listingTitle || 'lux.om booking').slice(0, 40);
}

async function callThawani<T>(path: string, init?: RequestInit) {
  const { secretKey, apiBaseUrl } = getThawaniConfig();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'thawani-api-key': secretKey,
      ...(init?.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => null)) as ThawaniApiResponse<T> | null;

  if (!response.ok || !body?.success || !body.data) {
    throw new AppError(
      502,
      body?.description || 'Thawani payment gateway request failed'
    );
  }

  return body.data;
}

async function createThawaniCheckoutSession(booking: any) {
  if (!booking.payment) {
    throw new AppError(400, 'Payment is not available for this booking');
  }

  const amount = decimalToNumber(booking.payment.amount);
  const reference = booking.payment.reference ?? createPaymentReference();

  if (amount <= 0 || toBaisa(amount) < 100) {
    throw new AppError(400, 'Payment amount is below the minimum Thawani amount');
  }

  const session = await callThawani<ThawaniCreateSessionData>('/checkout/session', {
    method: 'POST',
    body: JSON.stringify({
      client_reference_id: reference,
      mode: 'payment',
      products: [
        {
          name: getBookingPaymentTitle(booking),
          quantity: 1,
          unit_amount: toBaisa(amount)
        }
      ],
      success_url: createReturnUrl(booking.id, reference, 'success'),
      cancel_url: createReturnUrl(booking.id, reference, 'cancel'),
      metadata: {
        booking_id: booking.id,
        payment_id: booking.payment.id,
        customer_name: booking.contactName || booking.user?.name || '',
        customer_email: booking.contactEmail || booking.user?.email || '',
        customer_phone: booking.contactPhone || booking.user?.phone || ''
      }
    })
  });

  if (!session.session_id) {
    throw new AppError(502, 'Thawani did not return a checkout session id');
  }

  return {
    reference,
    sessionId: session.session_id,
    checkoutUrl: createCheckoutUrl(session.session_id)
  };
}

async function retrieveThawaniSession(sessionId: string) {
  return callThawani<ThawaniRetrieveSessionData>(`/checkout/session/${sessionId}`);
}

function mapThawaniPaymentStatus(status: string) {
  if (status === 'paid') return 'PAID' as const;
  if (status === 'cancelled') return 'FAILED' as const;

  return 'PENDING' as const;
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

      const payment = createManualPayment(data.amount, data.commission);

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
            create: payment
          }
        },
        include: bookingInclude
      });

      await recordBookingCreated(prisma, booking, req.user!.id);

      res.status(201).json({
        booking
      });

      return;
    }

    if (!data.activityId) {
      throw new AppError(400, 'Activity is required');
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

    await assertActivityCapacityAvailable(
      activity,
      scheduledDate,
      data.preferredTime,
      data.guests
    );

    const payment = calculateActivityPayment(activity, data.guests);

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
          create: payment
        }
      },
      include: bookingInclude
    });

    await recordBookingCreated(prisma, booking, req.user!.id);

    res.status(201).json({
      booking
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.patch('/:id/owner-status', requireAuth(), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const { status } = ownerBookingStatusSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: {
        id
      },
      include: bookingInclude
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    assertBookingOwnerAccess(booking, req.user!);
    assertOwnerBookingTransition(booking, status);

    const updatedBooking = await prisma.booking.update({
      where: {
        id
      },
      data: {
        status
      },
      include: bookingInclude
    });

    await recordOwnerBookingDecision(
      prisma,
      updatedBooking,
      req.user!.id,
      booking.status,
      status
    );

    res.json({
      booking: updatedBooking
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post('/:id/payments/session', requireAuth(), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);

    const booking = await prisma.booking.findUnique({
      where: {
        id
      },
      include: bookingInclude
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    assertBookingAccess(booking, req.user!);

    if (!booking.payment || booking.payment.status === 'NOT_REQUIRED') {
      throw new AppError(400, 'Payment is not required for this booking');
    }

    assertBookingCanStartPayment(booking);

    if (booking.activityId && booking.activity && booking.scheduledDate) {
      await assertActivityCapacityAvailable(
        booking.activity,
        booking.scheduledDate,
        booking.preferredTime ?? undefined,
        booking.guests,
        booking.id
      );
    }

    if (booking.payment.status === 'PAID') {
      res.json({
        booking,
        payment: booking.payment
      });
      return;
    }

    const session = await createThawaniCheckoutSession(booking);

    const payment = await prisma.payment.update({
      where: {
        id: booking.payment.id
      },
      data: {
        provider: CHECKOUT_PROVIDER,
        reference: session.reference,
        providerSessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        status: 'PENDING'
      }
    });

    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: booking.id
      },
      include: bookingInclude
    });

    await recordPaymentSessionCreated(prisma, updatedBooking, req.user!.id);

    res.json({
      booking: updatedBooking,
      payment
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post('/:id/payments/sync', requireAuth(), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);

    const booking = await prisma.booking.findUnique({
      where: {
        id
      },
      include: bookingInclude
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    assertBookingAccess(booking, req.user!);

    if (!booking.payment || booking.payment.status === 'NOT_REQUIRED') {
      throw new AppError(400, 'Payment is not required for this booking');
    }

    if (!booking.payment.providerSessionId) {
      throw new AppError(400, 'Payment session has not been created yet');
    }

    const thawaniSession = await retrieveThawaniSession(booking.payment.providerSessionId);
    const status = mapThawaniPaymentStatus(thawaniSession.payment_status);

    const payment = await prisma.payment.update({
      where: {
        id: booking.payment.id
      },
      data: {
        provider: CHECKOUT_PROVIDER,
        status,
        paidAt: status === 'PAID' ? (booking.payment.paidAt ?? new Date()) : null
      }
    });

    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: booking.id
      },
      include: bookingInclude
    });

    if (
      status !== booking.payment.status &&
      (status === 'PAID' || status === 'FAILED')
    ) {
      await recordPaymentSync(prisma, updatedBooking, status === 'PAID');
    }

    res.json({
      booking: updatedBooking,
      payment
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

bookingsRouter.patch('/admin/:id/status', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const { status } = bookingStatusSchema.parse(req.body);

    const existingBooking = await prisma.booking.findUnique({
      where: {
        id
      },
      include: bookingInclude
    });

    if (!existingBooking) {
      throw new AppError(404, 'Booking not found');
    }

    assertAdminBookingTransition(existingBooking, status);

    const booking = await prisma.booking.update({
      where: {
        id
      },
      data: {
        status
      },
      include: bookingInclude
    });

    await recordAdminBookingDecision(
      prisma,
      booking,
      req.user!.id,
      existingBooking.status,
      status
    );

    res.json({
      booking
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
        status,
        paidAt: status === 'PAID' ? new Date() : null
      }
    });

    res.json({
      payment
    });
  } catch (error) {
    next(error);
  }
});
