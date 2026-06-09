"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inquiriesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
exports.inquiriesRouter = (0, express_1.Router)();
const inquiryCreateSchema = zod_1.z
    .object({
    type: zod_1.z.enum(['PROPERTY', 'ACTIVITY', 'DEVELOPER_PARTNERSHIP', 'OWNER_PARTNERSHIP', 'GENERAL']),
    name: zod_1.z.string().trim().min(2).max(100),
    email: zod_1.z.string().trim().email().toLowerCase(),
    phone: zod_1.z.string().trim().min(6).max(30).optional(),
    message: zod_1.z.string().trim().min(5).max(3000),
    listingId: zod_1.z.string().min(1).optional(),
    activityId: zod_1.z.string().min(1).optional()
})
    .strict();
const inquiriesQuerySchema = zod_1.z.object({
    type: zod_1.z.enum(['PROPERTY', 'ACTIVITY', 'DEVELOPER_PARTNERSHIP', 'OWNER_PARTNERSHIP', 'GENERAL']).optional(),
    search: zod_1.z.string().trim().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const idParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
const inquiryInclude = {
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true
        }
    },
    listing: {
        select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            titleAr: true,
            location: true,
            locationEn: true,
            locationAr: true,
            price: true,
            image: true,
            status: true
        }
    },
    activity: {
        select: {
            id: true,
            slug: true,
            titleEn: true,
            titleAr: true,
            locationEn: true,
            locationAr: true,
            price: true,
            status: true
        }
    }
};
exports.inquiriesRouter.post('/', (0, auth_1.requireAuth)(false), async (req, res, next) => {
    try {
        const data = inquiryCreateSchema.parse(req.body);
        if (data.type === 'PROPERTY' && !data.listingId) {
            throw new http_1.AppError(400, 'listingId is required for property inquiries');
        }
        if (data.type === 'ACTIVITY' && !data.activityId) {
            throw new http_1.AppError(400, 'activityId is required for activity inquiries');
        }
        if (data.listingId) {
            const listing = await prisma_1.prisma.listing.findUnique({
                where: {
                    id: data.listingId
                },
                select: {
                    id: true,
                    status: true
                }
            });
            if (!listing || listing.status !== 'APPROVED') {
                throw new http_1.AppError(404, 'Listing not found');
            }
        }
        if (data.activityId) {
            const activity = await prisma_1.prisma.activity.findUnique({
                where: {
                    id: data.activityId
                },
                select: {
                    id: true,
                    status: true
                }
            });
            if (!activity || activity.status !== 'APPROVED') {
                throw new http_1.AppError(404, 'Activity not found');
            }
        }
        const inquiry = await prisma_1.prisma.inquiry.create({
            data: {
                type: data.type,
                name: data.name,
                email: data.email,
                phone: data.phone?.trim() || null,
                message: data.message,
                userId: req.user?.id ?? null,
                listingId: data.listingId ?? null,
                activityId: data.activityId ?? null
            },
            include: inquiryInclude
        });
        res.status(201).json({
            inquiry
        });
    }
    catch (error) {
        next(error);
    }
});
exports.inquiriesRouter.get('/admin/all', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const query = inquiriesQuerySchema.parse(req.query);
        const search = query.search?.trim();
        const inquiries = await prisma_1.prisma.inquiry.findMany({
            where: {
                ...(query.type ? { type: query.type } : {}),
                ...(search
                    ? {
                        OR: [
                            {
                                name: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                email: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                phone: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                message: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {})
            },
            include: inquiryInclude,
            orderBy: {
                createdAt: 'desc'
            },
            take: query.take,
            skip: query.skip
        });
        res.json({
            inquiries,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: inquiries.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.inquiriesRouter.get('/admin/:id', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const inquiry = await prisma_1.prisma.inquiry.findUnique({
            where: {
                id
            },
            include: inquiryInclude
        });
        if (!inquiry) {
            throw new http_1.AppError(404, 'Inquiry not found');
        }
        res.json({
            inquiry
        });
    }
    catch (error) {
        next(error);
    }
});
exports.inquiriesRouter.delete('/admin/:id', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        await prisma_1.prisma.inquiry.delete({
            where: {
                id
            }
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
