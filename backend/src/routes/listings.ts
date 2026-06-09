import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import { slugify } from '../utils/slugify';

export const listingsRouter = Router();

const listingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(3000),
    type: z.string().trim().min(2).max(40),
    transaction: z.enum(['Sale', 'Rent', 'Short stay']),
    location: z.string().trim().min(2).max(120),
    price: z.string().trim().min(2).max(80),
    beds: z.coerce.number().int().min(0).max(50),
    baths: z.coerce.number().int().min(0).max(50),
    sqm: z.coerce.number().int().min(1).max(100000),
    image: z.string().trim().url(),
    amenities: z.array(z.string().trim().min(1).max(50)).max(30).default([])
  })
  .strict();

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  transaction: z.enum(['Sale', 'Rent', 'Short stay']).optional(),
  type: z.string().trim().optional(),
  location: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const statusSchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED'])
  })
  .strict();

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
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

listingsRouter.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const search = query.search?.trim();

    const listings = await prisma.listing.findMany({
      where: {
        status: 'APPROVED',
        ...(query.transaction ? { transaction: query.transaction } : {}),
        ...(query.type
          ? {
              type: {
                contains: query.type,
                mode: 'insensitive'
              }
            }
          : {}),
        ...(query.location
          ? {
              location: {
                contains: query.location,
                mode: 'insensitive'
              }
            }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  title: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  description: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  location: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  type: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {})
      },
      include: listingInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      listings,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: listings.length
      }
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);

    const listings = await prisma.listing.findMany({
      include: listingInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      listings,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: listings.length
      }
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.patch('/admin/:id/status', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const { status } = statusSchema.parse(req.body);

    const listing = await prisma.listing.update({
      where: {
        id
      },
      data: {
        status
      },
      include: listingInclude
    });

    res.json({
      listing
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const listing = await prisma.listing.findUnique({
      where: {
        slug
      },
      include: listingInclude
    });

    if (!listing || listing.status !== 'APPROVED') {
      throw new AppError(404, 'Listing not found');
    }

    res.json({
      listing
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.post('/', requireAuth(), requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const data = listingSchema.parse(req.body);
    const baseSlug = slugify(data.title);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const listing = await prisma.listing.create({
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
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        ownerId: req.user!.id,
        amenities: {
          create: data.amenities.map((name) => ({
            name
          }))
        }
      },
      include: listingInclude
    });

    res.status(201).json({
      listing
    });
  } catch (error) {
    next(error);
  }
});