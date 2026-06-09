"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.developersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../utils/http");
exports.developersRouter = (0, express_1.Router)();
const developersQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    featured: zod_1.z.coerce.boolean().optional(),
    verified: zod_1.z.coerce.boolean().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const slugParamsSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1)
});
exports.developersRouter.get('/', async (req, res, next) => {
    try {
        const query = developersQuerySchema.parse(req.query);
        const search = query.search?.trim();
        const developers = await prisma_1.prisma.developerCompany.findMany({
            where: {
                ...(typeof query.featured === 'boolean'
                    ? {
                        featured: query.featured
                    }
                    : {}),
                ...(typeof query.verified === 'boolean'
                    ? {
                        verified: query.verified
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
                                headquartersEn: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            },
                            {
                                headquartersAr: {
                                    contains: search,
                                    mode: 'insensitive'
                                }
                            }
                        ]
                    }
                    : {})
            },
            include: {
                _count: {
                    select: {
                        listings: true
                    }
                }
            },
            orderBy: [
                {
                    featured: 'desc'
                },
                {
                    verified: 'desc'
                },
                {
                    nameEn: 'asc'
                }
            ],
            take: query.take,
            skip: query.skip
        });
        res.json({
            developers,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: developers.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.developersRouter.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = slugParamsSchema.parse(req.params);
        const developer = await prisma_1.prisma.developerCompany.findUnique({
            where: {
                slug
            },
            include: {
                listings: {
                    where: {
                        status: 'APPROVED'
                    },
                    include: {
                        amenities: true,
                        images: {
                            orderBy: {
                                sortOrder: 'asc'
                            }
                        },
                        nearestLandmark: true,
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });
        if (!developer) {
            throw new http_1.AppError(404, 'Developer not found');
        }
        res.json({
            developer
        });
    }
    catch (error) {
        next(error);
    }
});
