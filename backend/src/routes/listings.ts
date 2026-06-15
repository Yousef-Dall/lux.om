import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import {
  createPaginationMetadata,
  resolvePagination
} from '../utils/pagination';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import { getLinkedPartnerTier, getManualPartnerTier } from '../utils/partnerTier';
import {
  priceQualifierValues,
  priceUnitValues,
  resolvePriceInput
} from '../utils/pricing';
import {
  buildSearchRelevance,
  paginateExplicitlySortedIds,
  paginateRankedIds,
  restoreRankedOrder
} from '../utils/searchRanking';
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

const optionalPriceAmountSchema = z
  .preprocess(
    (value) =>
      value === '' ||
      value === null ||
      value === undefined
        ? undefined
        : value,
    z.union([
      z.coerce
        .number()
        .finite()
        .min(0)
        .max(99999999999.999),
      z.undefined()
    ])
  )
  .optional()
  .transform((value) =>
    value === undefined ? undefined : value.toString()
  );

const optionalCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase())
  .optional();

const listingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(3000),
    type: z.string().trim().min(2).max(40),
    transaction: z.enum(['Sale', 'Rent', 'Short stay']),
    location: z.string().trim().min(2).max(120),
    price: z.string().trim().min(1).max(80).optional(),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),
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
  .strict()
  .superRefine((data, context) => {
    const hasStructuredPrice =
      data.priceAmount !== undefined ||
      data.priceCurrency !== undefined ||
      data.priceQualifier !== undefined ||
      data.priceUnit !== undefined;

    if (!data.price && !hasStructuredPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'A display or structured price is required'
      });
    }

    if (
      data.priceQualifier === 'ON_REQUEST' &&
      data.priceAmount !== undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceAmount'],
        message:
          'On-request pricing cannot include an amount'
      });
    }

    if (
      hasStructuredPrice &&
      data.priceQualifier !== 'ON_REQUEST' &&
      data.priceAmount === undefined &&
      !data.price
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceAmount'],
        message:
          'A numeric amount is required for this price type'
      });
    }
  });

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  transaction: z.enum(['Sale', 'Rent', 'Short stay']).optional(),
  type: z.string().trim().optional(),
  location: z.string().trim().optional(),
  nearestLandmarkId: z.string().trim().optional(),
  developerId: z.string().trim().optional(),
  minBeds: z.coerce.number().int().min(0).optional(),
  minBaths: z.coerce.number().int().min(0).optional(),
  minSqm: z.coerce.number().int().min(0).optional(),
  minGuests: z.coerce.number().int().min(0).optional(),
  minParking: z.coerce.number().int().min(0).optional(),
  price: z.string().trim().optional(),
  furnishing: z.string().trim().optional(),
  view: z.string().trim().optional(),
  amenities: z.string().trim().optional(),

  sort: z
    .enum([
      'recommended',
      'newest',
      'price_asc',
      'price_desc',
      'area_desc'
    ])
    .default('recommended'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),

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
    const selectedAmenities =
      query.amenities
        ?.split(',')
        .map((amenity) => amenity.trim())
        .filter(Boolean) ?? [];
    const listingFilters: Prisma.ListingWhereInput[] = [];

    if (query.transaction) {
      listingFilters.push({
        transaction: query.transaction
      });
    }

    if (query.type) {
      listingFilters.push({
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
      });
    }

    if (query.location) {
      listingFilters.push({
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
      });
    }

    if (query.nearestLandmarkId) {
      listingFilters.push({
        nearestLandmarkId: query.nearestLandmarkId
      });
    }

    if (query.developerId) {
      listingFilters.push({
        developerId: query.developerId
      });
    }

    if (query.minBeds !== undefined) {
      listingFilters.push({
        beds: {
          gte: query.minBeds
        }
      });
    }

    if (query.minBaths !== undefined) {
      listingFilters.push({
        baths: {
          gte: query.minBaths
        }
      });
    }

    if (query.minSqm !== undefined) {
      listingFilters.push({
        sqm: {
          gte: query.minSqm
        }
      });
    }

    if (query.minGuests !== undefined) {
      listingFilters.push({
        maxGuests: {
          gte: query.minGuests
        }
      });
    }

    if (query.minParking !== undefined && query.minParking > 0) {
      listingFilters.push(
        query.minParking === 1
          ? {
              parking: true
            }
          : {
              id: '__no_listing_matches_parking_requirement__'
            }
      );
    }

    if (query.price) {
      listingFilters.push({
        price: {
          contains: query.price,
          mode: 'insensitive'
        }
      });
    }

    if (query.furnishing) {
      listingFilters.push({
        furnishing: query.furnishing
      });
    }

    if (query.view) {
      listingFilters.push({
        view: query.view
      });
    }

    for (const amenity of selectedAmenities) {
      listingFilters.push({
        amenities: {
          some: {
            OR: [
              {
                name: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              },
              {
                nameEn: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              },
              {
                nameAr: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              }
            ]
          }
        }
      });
    }

    if (search) {
      listingFilters.push({
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
          },
          {
            price: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            developerNameEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            developerNameAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            developer: {
              is: {
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
                  }
                ]
              }
            }
          },
          {
            nearestLandmark: {
              is: {
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
                  }
                ]
              }
            }
          },
          {
            amenities: {
              some: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
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
                  }
                ]
              }
            }
          }
        ]
      });
    }


    const listingWhere: Prisma.ListingWhereInput = {
      status: 'APPROVED',
      AND: listingFilters
    };

    const pagination = resolvePagination(query);
    const total = await prisma.listing.count({
      where: listingWhere
    });

    let listings: Prisma.ListingGetPayload<{
      include: typeof listingInclude;
    }>[];

    if (query.sort !== 'recommended') {
      const candidates = await prisma.listing.findMany({
        where: listingWhere,
        select: {
          id: true,
          price: true,
          priceAmount: true,
          sqm: true,
          partnerTier: true,
          createdAt: true
        }
      });

      const orderedIds = paginateExplicitlySortedIds(
        candidates.map((candidate) => ({
          id: candidate.id,
          price:
            candidate.priceAmount?.toString() ??
            candidate.price,
          area: candidate.sqm,
          partnerTier: candidate.partnerTier,
          createdAt: candidate.createdAt
        })),
        query.sort,
        pagination.skip,
        pagination.take
      );

      const explicitlySortedListings =
        orderedIds.length > 0
          ? await prisma.listing.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: listingInclude
            })
          : [];

      listings = restoreRankedOrder(
        explicitlySortedListings,
        orderedIds
      );
    } else if (search) {
      const candidates = await prisma.listing.findMany({
        where: listingWhere,
        select: {
          id: true,
          title: true,
          titleEn: true,
          titleAr: true,
          description: true,
          descriptionEn: true,
          descriptionAr: true,
          location: true,
          locationEn: true,
          locationAr: true,
          type: true,
          typeEn: true,
          typeAr: true,
          price: true,

          developerId: true,
          developerNameEn: true,
          developerNameAr: true,
          nearestLandmarkId: true,

          beds: true,
          baths: true,
          sqm: true,
          maxGuests: true,
          minStayNights: true,
          parking: true,
          floor: true,
          furnishing: true,
          view: true,
          paymentFrequency: true,

          partnerTier: true,
          createdAt: true,

          developer: {
            select: {
              nameEn: true,
              nameAr: true
            }
          },
          nearestLandmark: {
            select: {
              nameEn: true,
              nameAr: true
            }
          },
          amenities: {
            select: {
              name: true,
              nameEn: true,
              nameAr: true
            }
          },
          images: {
            select: {
              id: true
            }
          }
        }
      });

      const orderedIds = paginateRankedIds(
        candidates.map((candidate) => {
          const relatedSearchValues = [
            candidate.developerNameEn,
            candidate.developerNameAr,
            candidate.developer?.nameEn,
            candidate.developer?.nameAr,
            candidate.nearestLandmark?.nameEn,
            candidate.nearestLandmark?.nameAr,
            ...candidate.amenities.flatMap((amenity) => [
              amenity.name,
              amenity.nameEn,
              amenity.nameAr
            ])
          ];

          const qualityScore =
            Math.min(candidate.images.length, 3) * 2 +
            Math.min(candidate.amenities.length, 5) +
            Number((candidate.descriptionEn ?? '').trim().length >= 80) +
            Number(Boolean(candidate.titleAr)) +
            Number(Boolean(candidate.descriptionAr)) +
            Number(Boolean(candidate.locationAr)) +
            Number(Boolean(candidate.typeAr)) +
            Number(candidate.beds > 0) +
            Number(candidate.baths > 0) +
            Number(candidate.sqm > 0) +
            Number(Boolean(candidate.maxGuests)) +
            Number(Boolean(candidate.minStayNights)) +
            Number(candidate.parking === true) +
            Number(Boolean(candidate.floor)) +
            Number(Boolean(candidate.furnishing)) +
            Number(Boolean(candidate.view)) +
            Number(Boolean(candidate.paymentFrequency)) +
            Number(Boolean(candidate.nearestLandmarkId)) +
            Number(
              Boolean(
                candidate.developerId ||
                  candidate.developerNameEn ||
                  candidate.developerNameAr
              )
            );

          return {
            id: candidate.id,
            relevance: buildSearchRelevance(search, [
              [
                candidate.title,
                candidate.titleEn,
                candidate.titleAr
              ],
              [
                candidate.type,
                candidate.typeEn,
                candidate.typeAr,
                candidate.location,
                candidate.locationEn,
                candidate.locationAr,
                candidate.price
              ],
              relatedSearchValues,
              [
                candidate.description,
                candidate.descriptionEn,
                candidate.descriptionAr
              ]
            ]),
            partnerTier: candidate.partnerTier,
            qualityScore,
            createdAt: candidate.createdAt
          };
        }),
        pagination.skip,
        pagination.take
      );

      const rankedListings =
        orderedIds.length > 0
          ? await prisma.listing.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: listingInclude
            })
          : [];

      listings = restoreRankedOrder(rankedListings, orderedIds);
    } else {
      listings = await prisma.listing.findMany({
        where: listingWhere,
        include: listingInclude,
        orderBy: [
          {
            partnerTier: 'desc'
          },
          {
            createdAt: 'desc'
          }
        ],
        take: pagination.take,
        skip: pagination.skip
      });
    }

    res.json({
      listings,
      pagination: createPaginationMetadata(
        total,
        listings.length,
        pagination
      )
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

    const resolvedPrice = resolvePriceInput({
      displayPrice: data.price,
      priceAmount: data.priceAmount,
      priceCurrency: data.priceCurrency,
      priceQualifier: data.priceQualifier,
      priceUnit: data.priceUnit,
      paymentFrequency: data.paymentFrequency
    });

    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        transaction: data.transaction,
        location: data.location,
        price: resolvedPrice.price,
        priceAmount: resolvedPrice.priceAmount,
        priceCurrency: resolvedPrice.priceCurrency,
        priceQualifier: resolvedPrice.priceQualifier,
        priceUnit: resolvedPrice.priceUnit,
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