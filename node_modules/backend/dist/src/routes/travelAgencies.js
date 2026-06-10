"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.travelAgenciesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const slugify_1 = require("../utils/slugify");
exports.travelAgenciesRouter = (0, express_1.Router)();
const travelAgenciesQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    featured: zod_1.z.coerce.boolean().optional(),
    verified: zod_1.z.coerce.boolean().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0)
});
const slugParamsSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1)
});
const idParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
const travelAgencyCreateSchema = zod_1.z
    .object({
    nameEn: zod_1.z.string().trim().min(2).max(140),
    nameAr: zod_1.z.string().trim().max(140).optional(),
    descriptionEn: zod_1.z.string().trim().max(2000).optional(),
    descriptionAr: zod_1.z.string().trim().max(2000).optional(),
    headquartersEn: zod_1.z.string().trim().max(160).optional(),
    headquartersAr: zod_1.z.string().trim().max(160).optional(),
    logo: zod_1.z.string().trim().url().optional(),
    phone: zod_1.z.string().trim().max(40).optional(),
    email: zod_1.z.string().trim().email().optional(),
    website: zod_1.z.string().trim().url().optional(),
    establishedYear: zod_1.z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
    verified: zod_1.z.coerce.boolean().default(false),
    featured: zod_1.z.coerce.boolean().default(false)
})
    .strict();
const travelAgencyUpdateSchema = travelAgencyCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
});
const travelAgencyInclude = {
    activities: {
        where: {
            status: 'APPROVED'
        },
        include: {
            images: {
                orderBy: {
                    sortOrder: 'asc'
                }
            },
            highlights: true,
            nearestLandmark: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    }
};
exports.travelAgenciesRouter.get('/', async (req, res, next) => {
    try {
        const query = travelAgenciesQuerySchema.parse(req.query);
        const search = query.search?.trim();
        const travelAgencies = await prisma_1.prisma.travelAgency.findMany({
            where: {
                ...(typeof query.featured === 'boolean' ? { featured: query.featured } : {}),
                ...(typeof query.verified === 'boolean' ? { verified: query.verified } : {}),
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
            orderBy: [
                {
                    featured: 'desc'
                },
                {
                    verified: 'desc'
                },
                {
                    createdAt: 'desc'
                }
            ],
            take: query.take,
            skip: query.skip
        });
        res.json({
            travelAgencies,
            pagination: {
                take: query.take,
                skip: query.skip,
                count: travelAgencies.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.travelAgenciesRouter.post('/', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const data = travelAgencyCreateSchema.parse(req.body);
        const slug = `${(0, slugify_1.slugify)(data.nameEn)}-${Date.now().toString(36)}`;
        const travelAgency = await prisma_1.prisma.travelAgency.create({
            data: {
                slug,
                nameEn: data.nameEn,
                nameAr: data.nameAr,
                descriptionEn: data.descriptionEn,
                descriptionAr: data.descriptionAr,
                headquartersEn: data.headquartersEn,
                headquartersAr: data.headquartersAr,
                logo: data.logo,
                phone: data.phone,
                email: data.email,
                website: data.website,
                establishedYear: data.establishedYear,
                verified: data.verified,
                featured: data.featured
            }
        });
        res.status(201).json({
            travelAgency
        });
    }
    catch (error) {
        next(error);
    }
});
exports.travelAgenciesRouter.patch('/:id', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const data = travelAgencyUpdateSchema.parse(req.body);
        const existingAgency = await prisma_1.prisma.travelAgency.findUnique({
            where: {
                id
            }
        });
        if (!existingAgency) {
            throw new http_1.AppError(404, 'Travel agency not found');
        }
        const travelAgency = await prisma_1.prisma.travelAgency.update({
            where: {
                id
            },
            data
        });
        res.json({
            travelAgency
        });
    }
    catch (error) {
        next(error);
    }
});
exports.travelAgenciesRouter.delete('/:id', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const existingAgency = await prisma_1.prisma.travelAgency.findUnique({
            where: {
                id
            }
        });
        if (!existingAgency) {
            throw new http_1.AppError(404, 'Travel agency not found');
        }
        await prisma_1.prisma.travelAgency.delete({
            where: {
                id
            }
        });
        res.json({
            ok: true,
            deletedId: id
        });
    }
    catch (error) {
        next(error);
    }
});
exports.travelAgenciesRouter.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = slugParamsSchema.parse(req.params);
        const travelAgency = await prisma_1.prisma.travelAgency.findUnique({
            where: {
                slug
            },
            include: travelAgencyInclude
        });
        if (!travelAgency) {
            throw new http_1.AppError(404, 'Travel agency not found');
        }
        res.json({
            travelAgency
        });
    }
    catch (error) {
        next(error);
    }
});
