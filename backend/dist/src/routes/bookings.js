"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
exports.bookingsRouter = (0, express_1.Router)();
const bookingSchema = zod_1.z
    .object({
    listingId: zod_1.z.string().min(1),
    message: zod_1.z.string().trim().max(1000).optional(),
    amount: zod_1.z.coerce.number().min(0).default(0),
    commission: zod_1.z.coerce.number().min(0).default(0)
})
    .strict();
const adminBookingsQuerySchema = zod_1.z.object({
    take: zod_1.z.coerce.number().int().min(1).max(100).default(100),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const paymentStatusSchema = zod_1.z
    .object({
    status: zod_1.z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'NOT_REQUIRED'])
})
    .strict();
const paramsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
exports.bookingsRouter.post('/', (0, auth_1.requireAuth)(), async (req, res, next) => {
    try {
        const data = bookingSchema.parse(req.body);
        const listing = await prisma_1.prisma.listing.findUnique({
            where: {
                id: data.listingId
            }
        });
        if (!listing || listing.status !== 'APPROVED') {
            throw new http_1.AppError(404, 'Listing not found');
        }
        if (listing.ownerId === req.user.id) {
            throw new http_1.AppError(400, 'You cannot create a booking request for your own listing');
        }
        const booking = await prisma_1.prisma.booking.create({
            data: {
                listingId: data.listingId,
                userId: req.user.id,
                message: data.message?.trim() || '',
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
        res.status(201).json({
            booking
        });
    }
    catch (error) {
        next(error);
    }
});
exports.bookingsRouter.get('/admin/all', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const query = adminBookingsQuerySchema.parse(req.query);
        const bookings = await prisma_1.prisma.booking.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                listing: true,
                payment: true
            },
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
    }
    catch (error) {
        next(error);
    }
});
exports.bookingsRouter.patch('/admin/payments/:id', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = paramsSchema.parse(req.params);
        const { status } = paymentStatusSchema.parse(req.body);
        const payment = await prisma_1.prisma.payment.update({
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
    }
    catch (error) {
        next(error);
    }
});
