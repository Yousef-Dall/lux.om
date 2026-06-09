"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activitiesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const slugify_1 = require("../utils/slugify");
exports.activitiesRouter = (0, express_1.Router)();
const activityCreateSchema = zod_1.z
    .object({
    titleEn: zod_1.z.string().trim().min(3).max(140),
    titleAr: zod_1.z.string().trim().min(3).max(140).optional(),
    descriptionEn: zod_1.z.string().trim().min(20).max(4000),
    descriptionAr: zod_1.z.string().trim().min(20).max(4000).optional(),
    locationEn: zod_1.z.string().trim().min(2).max(160),
    locationAr: zod_1.z.string().trim().min(2).max(160).optional(),
    categoryEn: zod_1.z.string().trim().min(2).max(80),
    categoryAr: zod_1.z.string().trim().min(2).max(80).optional(),
    providerEn: zod_1.z.string().trim().max(120).optional(),
    providerAr: zod_1.z.string().trim().max(120).optional(),
    price: zod_1.z.string().trim().min(1).max(80),
    durationMinutes: zod_1.z.coerce.number().int().positive().max(10080).optional(),
    durationLabelEn: zod_1.z.string().trim().max(80).optional(),
    durationLabelAr: zod_1.z.string().trim().max(80).optional(),
    groupSize: zod_1.z.string().trim().max(80).optional(),
    language: zod_1.z.string().trim().max(80).optional(),
    difficulty: zod_1.z.string().trim().max(80).optional(),
    activityType: zod_1.z.string().trim().max(80).optional(),
    familyFriendly: zod_1.z.coerce.boolean().default(false),
    includesTransfer: zod_1.z.coerce.boolean().default(false),
    mealIncluded: zod_1.z.coerce.boolean().default(false),
    outdoor: zod_1.z.coerce.boolean().default(false),
    nearestLandmarkId: zod_1.z.string().min(1).optional(),
    distanceFromLandmarkEn: zod_1.z.string().trim().max(120).optional(),
    distanceFromLandmarkAr: zod_1.z.string().trim().max(120).optional(),
    images: zod_1.z
        .array(zod_1.z.object({
        url: zod_1.z.string().trim().url(),
        altEn: zod_1.z.string().trim().max(160).optional(),
        altAr: zod_1.z.string().trim().max(160).optional(),
        sortOrder: zod_1.z.coerce.number().int().min(0).default(0)
    }))
        .max(20)
        .default([]),
    highlights: zod_1.z
        .array(zod_1.z.object({
        textEn: zod_1.z.string().trim().min(1).max(160),
        textAr: zod_1.z.string().trim().max(160).optional()
    }))
        .max(20)
        .default([])
})
    .strict();
const activitiesQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    category: zod_1.z.string().trim().optional(),
    difficulty: zod_1.z.string().trim().optional(),
    featured: zod_1.z.coerce.boolean().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const idParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
const slugParamsSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1)
});
const statusSchema = zod_1.z
    .object({
    status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    rejectedReason: zod_1.z.string().trim().max(1000).optional()
})
    .strict();
const activityInclude = {
    owner: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true
        }
    },
    nearestLandmark: true,
    images: {
        orderBy: {
            sortOrder: 'asc'
        }
    },
    highlights: true
};
exports.activitiesRouter.get('/', async (req, res, next) => {
    try {
        const query = activitiesQuerySchema.parse(req.query);
        const search = query.search?.trim();
        const activities = await prisma_1.prisma.activity.findMany({
            where: {
                status: 'APPROVED',
                ...(typeof query.featured === 'boolean' ? { featured: query.featured } : {}),
                ...(query.category
                    ? {
                        OR: [
                            {
                                categoryEn: {
                                    contains: query.category,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                categoryAr: {
                                    contains: query.category,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {}),
                ...(query.difficulty
                    ? {
                        difficulty: {
                            contains: query.difficulty,
                            mode: 'insensitive'
                        }
                    }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            {
                                titleEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                titleAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                descriptionEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                descriptionAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                locationEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                locationAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {})
            },
            include: activityInclude,
            orderBy: {
                createdAt: 'desc'
            },
            take: query.take,
            skip: query.skip
        });
        res.json({
            activities,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: activities.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.activitiesRouter.get('/admin/all', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const query = activitiesQuerySchema.parse(req.query);
        const activities = await prisma_1.prisma.activity.findMany({
            include: activityInclude,
            orderBy: {
                createdAt: 'desc'
            },
            take: query.take,
            skip: query.skip
        });
        res.json({
            activities,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: activities.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.activitiesRouter.patch('/admin/:id/status', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const data = statusSchema.parse(req.body);
        const activity = await prisma_1.prisma.activity.update({
            where: {
                id
            },
            data: {
                status: data.status,
                rejectedReason: data.status === 'REJECTED' ? data.rejectedReason ?? null : null
            },
            include: activityInclude
        });
        res.json({
            activity
        });
    }
    catch (error) {
        next(error);
    }
});
exports.activitiesRouter.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = slugParamsSchema.parse(req.params);
        const activity = await prisma_1.prisma.activity.findUnique({
            where: {
                slug
            },
            include: activityInclude
        });
        if (!activity || activity.status !== 'APPROVED') {
            throw new http_1.AppError(404, 'Activity not found');
        }
        res.json({
            activity
        });
    }
    catch (error) {
        next(error);
    }
});
exports.activitiesRouter.post('/', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ACTIVITY_PROVIDER', 'OWNER', 'ADMIN'), async (req, res, next) => {
    try {
        const data = activityCreateSchema.parse(req.body);
        const slug = `${(0, slugify_1.slugify)(data.titleEn)}-${Date.now().toString(36)}`;
        const activity = await prisma_1.prisma.activity.create({
            data: {
                slug,
                titleEn: data.titleEn,
                titleAr: data.titleAr,
                descriptionEn: data.descriptionEn,
                descriptionAr: data.descriptionAr,
                locationEn: data.locationEn,
                locationAr: data.locationAr,
                categoryEn: data.categoryEn,
                categoryAr: data.categoryAr,
                providerEn: data.providerEn,
                providerAr: data.providerAr,
                price: data.price,
                durationMinutes: data.durationMinutes,
                durationLabelEn: data.durationLabelEn,
                durationLabelAr: data.durationLabelAr,
                groupSize: data.groupSize,
                language: data.language,
                difficulty: data.difficulty,
                activityType: data.activityType,
                familyFriendly: data.familyFriendly,
                includesTransfer: data.includesTransfer,
                mealIncluded: data.mealIncluded,
                outdoor: data.outdoor,
                nearestLandmarkId: data.nearestLandmarkId,
                distanceFromLandmarkEn: data.distanceFromLandmarkEn,
                distanceFromLandmarkAr: data.distanceFromLandmarkAr,
                status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
                ownerId: req.user.id,
                images: {
                    create: data.images
                },
                highlights: {
                    create: data.highlights
                }
            },
            include: activityInclude
        });
        res.status(201).json({
            activity
        });
    }
    catch (error) {
        next(error);
    }
});
