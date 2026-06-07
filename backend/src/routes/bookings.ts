import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const bookingsRouter = Router();

const bookingSchema = z.object({
  listingId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
  amount: z.coerce.number().min(0).default(0),
  commission: z.coerce.number().min(0).default(0)
});

const paymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'NOT_REQUIRED'])
});

const paramsSchema = z.object({
  id: z.string().min(1)
});

bookingsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = bookingSchema.parse(req.body);
    const listing = await prisma.listing.findUnique({ where: { id: data.listingId } });

    if (!listing || listing.status !== 'APPROVED') {
      throw new AppError(404, 'Listing not found');
    }

    const booking = await prisma.booking.create({
      data: {
        listingId: data.listingId,
        userId: req.user!.id,
        message: data.message ?? '',
        payment: {
          create: {
            amount: data.amount,
            commission: data.commission,
            status: data.amount > 0 ? 'PENDING' : 'NOT_REQUIRED'
          }
        }
      },
      include: {
        payment: true,
        listing: true
      }
    });

    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        listing: true,
        payment: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.patch('/admin/payments/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const { status } = paymentStatusSchema.parse(req.body);

    const payment = await prisma.payment.update({
      where: { id },
      data: { status }
    });

    res.json({ payment });
  } catch (error) {
    next(error);
  }
});