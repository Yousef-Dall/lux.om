"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const slugify_1 = require("../utils/slugify");
exports.listingsRouter = (0, express_1.Router)();
const listingSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(3).max(120),
    description: zod_1.z.string().trim().min(20).max(3000),
    type: zod_1.z.string().trim().min(2).max(40),
    transaction: zod_1.z.enum(['Sale', 'Rent', 'Short stay']),
    location: zod_1.z.string().trim().min(2).max(120),
    price: zod_1.z.string().trim().min(2).max(80),
    beds: zod_1.z.coerce.number().int().min(0).max(50),
    baths: zod_1.z.coerce.number().int().min(0).max(50),
    sqm: zod_1.z.coerce.number().int().min(1).max(100000),
    image: zod_1.z.string().trim().url(),
    amenities: zod_1.z.array(zod_1.z.string().trim().min(1).max(50)).max(30).default([])
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED'])
});
const idParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
const slugParamsSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1)
});
const listingInclude = {
    amenities: true,
    owner: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true
        }
    }
};
exports.listingsRouter.get('/', async (req, res, next) => {
    try {
        const search = String(req.query.search ?? '').trim();
        const listings = await prisma_1.prisma.listing.findMany({
            where: {
                status: 'APPROVED',
                ...(search
                    ? {
                        OR: [
                            { title: { contains: search, mode: 'insensitive' } },
                            { location: { contains: search, mode: 'insensitive' } },
                            { type: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                    : {})
            },
            include: listingInclude,
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ listings });
    }
    catch (error) {
        next(error);
    }
});
exports.listingsRouter.get('/admin/all', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (_req, res, next) => {
    try {
        const listings = await prisma_1.prisma.listing.findMany({
            include: listingInclude,
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json({ listings });
    }
    catch (error) {
        next(error);
    }
});
exports.listingsRouter.patch('/admin/:id/status', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const { status } = statusSchema.parse(req.body);
        const listing = await prisma_1.prisma.listing.update({
            where: { id },
            data: { status },
            include: listingInclude
        });
        res.json({ listing });
    }
    catch (error) {
        next(error);
    }
});
exports.listingsRouter.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = slugParamsSchema.parse(req.params);
        const listing = await prisma_1.prisma.listing.findUnique({
            where: { slug },
            include: listingInclude
        });
        if (!listing || listing.status !== 'APPROVED') {
            throw new http_1.AppError(404, 'Listing not found');
        }
        res.json({ listing });
    }
    catch (error) {
        next(error);
    }
});
exports.listingsRouter.post('/', (0, auth_1.requireAuth)(), (0, auth_1.requireRole)('OWNER', 'ADMIN'), async (req, res, next) => {
    try {
        const data = listingSchema.parse(req.body);
        const baseSlug = (0, slugify_1.slugify)(data.title);
        const slug = `${baseSlug}-${Date.now().toString(36)}`;
        const listing = await prisma_1.prisma.listing.create({
            data: {
                title: data.title,
                description: data.description,
                type: data.type,
                transaction: data.transaction,
                location: data.location,
                price: data.price,
                beds: data.beds,
                baths: data.baths,
                sqm: data.sqm,
                image: data.image,
                slug,
                ownerId: req.user.id,
                amenities: {
                    create: data.amenities.map((name) => ({ name }))
                }
            },
            include: listingInclude
        });
        res.status(201).json({ listing });
    }
    catch (error) {
        next(error);
    }
});
