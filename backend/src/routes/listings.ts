import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import { getLinkedPartnerTier, getManualPartnerTier } from '../utils/partnerTier';
import { slugify } from '../utils/slugify';

export const listingsRouter = Router();

const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.startsWith('/uploads/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    {
      message: 'Image must be a valid URL or uploaded image path'
    }
  );

const optionalIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalNumberSchema = z
  .union([z.coerce.number().int(), z.undefined(), z.null()])
  .optional()
  .transform((value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined));

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
    image: imageUrlSchema,

    amenities: z.array(z.string().trim().min(1).max(50)).max(30).default([]),

    developerId: optionalIdSchema,
    developerNameEn: optionalTextSchema,
    developerNameAr: optionalTextSchema,
    nearestLandmarkId: optionalIdSchema,
    distanceFromLandmark: optionalTextSchema,
    distanceFromLandmarkEn: optionalTextSchema,
    distanceFromLandmarkAr: optionalTextSchema,

    minStayNights: optionalNumberSchema,
    maxGuests: optionalNumberSchema,
    parkingSpaces: optionalNumberSchema,
    floorNumber: optionalNumberSchema,

    furnishing: optionalTextSchema,
    view: optionalTextSchema,
    paymentFrequency: optionalTextSchema
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
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    rejectedReason: z.string().trim().max(1000).optional()
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
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  developer: true,
  nearestLandmark: true,
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
              OR: [
                {
                  type: {
                    contains: query.type,
                    mode: 'insensitive'
                  }
                },
                {
                  typeEn: {
                    contains: query.type,
                    mode: 'insensitive'
                  }
                },
                {
                  typeAr: {
                    contains: query.type,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {}),
        ...(query.location
          ? {
              OR: [
                {
                  location: {
                    contains: query.location,
                    mode: 'insensitive'
                  }
                },
                {
                  locationEn: {
                    contains: query.location,
                    mode: 'insensitive'
                  }
                },
                {
                  locationAr: {
                    contains: query.location,
                    mode: 'insensitive'
                  }
                }
              ]
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
                  description: {
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
                  location: {
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
                },
                {
                  type: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  typeEn: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  typeAr: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {})
      },
      include: listingInclude,
      orderBy: [
        {
          partnerTier: 'desc'
        },
        {
          createdAt: 'desc'
        }
      ],
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

listingsRouter.patch(
  '/admin/:id/status',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = statusSchema.parse(req.body);

      const listing = await prisma.listing.update({
        where: {
          id
        },
        data: {
          status: data.status,
          rejectedReason: data.status === 'REJECTED' ? data.rejectedReason ?? null : null
        },
        include: listingInclude
      });

      res.json({
        listing
      });
    } catch (error) {
      next(error);
    }
  }
);

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

    const developer = data.developerId
      ? await prisma.developerCompany.findUnique({
          where: {
            id: data.developerId
          }
        })
      : null;

    if (data.developerId && !developer) {
      throw new AppError(400, 'Selected development company was not found');
    }

    if (data.developerId && (data.developerNameEn || data.developerNameAr)) {
      throw new AppError(
        400,
        'Choose either a listed development company or enter a manual developer name'
      );
    }

    const nearestLandmark = data.nearestLandmarkId
      ? await prisma.landmark.findUnique({
          where: {
            id: data.nearestLandmarkId
          }
        })
      : null;

    if (data.nearestLandmarkId && !nearestLandmark) {
      throw new AppError(400, 'Selected landmark was not found');
    }

    const distanceFromLandmarkEn =
      data.distanceFromLandmarkEn ?? data.distanceFromLandmark ?? undefined;

    const partnerTier = developer
      ? getLinkedPartnerTier(developer)
      : getManualPartnerTier(data.developerNameEn, data.developerNameAr);

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

        titleEn: data.title,
        descriptionEn: data.description,
        locationEn: data.location,
        typeEn: data.type,

        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        ownerId: req.user!.id,

        partnerTier,
        developerId: developer?.id,
        developerNameEn: developer ? null : data.developerNameEn,
        developerNameAr: developer ? null : data.developerNameAr,
        nearestLandmarkId: nearestLandmark?.id,
        distanceFromLandmarkEn,
        distanceFromLandmarkAr: data.distanceFromLandmarkAr,

        minStayNights: data.minStayNights,
        maxGuests: data.maxGuests,
        parking: typeof data.parkingSpaces === 'number' ? data.parkingSpaces > 0 : undefined,
        floor: data.floorNumber,
        furnishing: data.furnishing,
        view: data.view,
        paymentFrequency: data.paymentFrequency,

        amenities: {
          create: data.amenities.map((name) => ({
            name,
            nameEn: name
          }))
        },

        images: {
          create: [
            {
              url: data.image,
              altEn: data.title,
              sortOrder: 0
            }
          ]
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