"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.landmarksRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.landmarksRouter = (0, express_1.Router)();
const landmarksQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    city: zod_1.z.string().trim().optional(),
    category: zod_1.z.string().trim().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const slugParamsSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1)
});
exports.landmarksRouter.get('/', async (req, res, next) => {
    try {
        const query = landmarksQuerySchema.parse(req.query);
        const search = query.search?.trim();
        const landmarks = await prisma_1.prisma.landmark.findMany({
            where: {
                ...(query.city
                    ? {
                        OR: [
                            {
                                cityEn: {
                                    contains: query.city,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                cityAr: {
                                    contains: query.city,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {}),
                ...(query.category
                    ? {
                        category: {
                            contains: query.category,
                            mode: 'insensitive'
                        }
                    }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            {
                                nameEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                nameAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                cityEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                cityAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                category: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {})
            },
            orderBy: {
                nameEn: 'asc'
            },
            take: query.take,
            skip: query.skip
        });
        res.json({
            landmarks,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: landmarks.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.landmarksRouter.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = slugParamsSchema.parse(req.params);
        const landmark = await prisma_1.prisma.landmark.findUnique({
            where: {
                slug
            },
            include: {
                listings: {
                    where: {
                        status: 'APPROVED'
                    },
                    take: 12,
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                activities: {
                    where: {
                        status: 'APPROVED'
                    },
                    take: 12,
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });
        if (!landmark) {
            res.status(404).json({
                message: 'Landmark not found'
            });
            return;
        }
        res.json({
            landmark
        });
    }
    catch (error) {
        next(error);
    }
});
