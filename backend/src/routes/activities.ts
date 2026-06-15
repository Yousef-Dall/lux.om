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

export const activitiesRouter = Router();

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

  const dayNameSchema = z.enum([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]);

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must use HH:mm format'
  });

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

const activityCreateSchema = z
  .object({
    titleEn: z.string().trim().min(3).max(140),
    titleAr: z.string().trim().min(3).max(140).optional(),
    descriptionEn: z.string().trim().min(20).max(4000),
    descriptionAr: z.string().trim().min(20).max(4000).optional(),
    locationEn: z.string().trim().min(2).max(160),
    locationAr: z.string().trim().min(2).max(160).optional(),
    categoryEn: z.string().trim().min(2).max(80),
    categoryAr: z.string().trim().min(2).max(80).optional(),

    travelAgencyId: z.string().min(1).optional(),

    providerEn: z.string().trim().max(120).optional(),
    providerAr: z.string().trim().max(120).optional(),

    price: z.string().trim().min(1).max(80).optional(),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),
    durationMinutes: z.coerce.number().int().positive().max(10080).optional(),
    durationLabelEn: z.string().trim().max(80).optional(),
durationLabelAr: z.string().trim().max(80).optional(),
durationType: z.enum(['Short', 'Half day', 'Full day', 'Overnight']).optional(),
groupSize: z.string().trim().max(80).optional(),
    language: z.string().trim().max(80).optional(),
    difficulty: z.string().trim().max(80).optional(),
  activityType: z.string().trim().max(80).optional(),

availabilityDays: z.array(dayNameSchema).max(7).default([]),
availabilityStartTime: timeSchema.optional(),
availabilityEndTime: timeSchema.optional(),

familyFriendly: z.coerce.boolean().default(false),
    includesTransfer: z.coerce.boolean().default(false),
    mealIncluded: z.coerce.boolean().default(false),
    outdoor: z.coerce.boolean().default(false),

    nearestLandmarkId: z.string().min(1).optional(),
    distanceFromLandmarkEn: z.string().trim().max(120).optional(),
    distanceFromLandmarkAr: z.string().trim().max(120).optional(),

    images: z
      .array(
        z.object({
          url: imageUrlSchema,
          altEn: z.string().trim().max(160).optional(),
          altAr: z.string().trim().max(160).optional(),
          sortOrder: z.coerce.number().int().min(0).default(0)
        })
      )
      .max(20)
      .default([]),

    highlights: z
      .array(
        z.object({
          textEn: z.string().trim().min(1).max(160),
          textAr: z.string().trim().max(160).optional()
        })
      )
      .max(20)
      .default([])
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

const optionalBooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;

    return value === true || value === 'true';
  });

const activitiesQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  location: z.string().trim().optional(),
  nearestLandmarkId: z.string().trim().optional(),
  travelAgencyId: z.string().trim().optional(),

  availableDay: dayNameSchema.optional(),
  availableFrom: timeSchema.optional(),
  availableUntil: timeSchema.optional(),

  durationType: z.enum(['Short', 'Half day', 'Full day', 'Overnight']).optional(),
  activityType: z.enum(['Private', 'Group', 'Both']).optional(),

  familyFriendly: optionalBooleanQuerySchema,
  includesTransfer: optionalBooleanQuerySchema,
  mealIncluded: optionalBooleanQuerySchema,
  outdoor: optionalBooleanQuerySchema,
  featured: optionalBooleanQuerySchema,

  price: z.string().trim().optional(),

  sort: z
    .enum([
      'recommended',
      'newest',
      'price_asc',
      'price_desc'
    ])
    .default('recommended'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),

  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
});

const statusSchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    rejectedReason: z.string().trim().max(1000).optional()
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
  travelAgency: true,
  nearestLandmark: true,
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  highlights: true
};

activitiesRouter.get('/', async (req, res, next) => {
  try {
    const query = activitiesQuerySchema.parse(req.query);
    const search = query.search?.trim();
    const activityFilters: Prisma.ActivityWhereInput[] = [];

    if (typeof query.featured === 'boolean') {
      activityFilters.push(
        query.featured
          ? {
              travelAgency: {
                is: {
                  featured: true
                }
              }
            }
          : {
              OR: [
                {
                  travelAgencyId: null
                },
                {
                  travelAgency: {
                    is: {
                      featured: false
                    }
                  }
                }
              ]
            }
      );
    }

    if (query.travelAgencyId) {
      activityFilters.push({
        travelAgencyId: query.travelAgencyId
      });
    }

    if (query.category) {
      activityFilters.push({
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
      });
    }

    if (query.difficulty) {
      activityFilters.push({
        difficulty: {
          contains: query.difficulty,
          mode: 'insensitive'
        }
      });
    }

    if (query.location) {
      activityFilters.push({
        OR: [
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
          },
          {
            nearestLandmark: {
              is: {
                OR: [
                  {
                    nameEn: {
                      contains: query.location,
                      mode: 'insensitive'
                    }
                  },
                  {
                    nameAr: {
                      contains: query.location,
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

    if (query.nearestLandmarkId) {
      activityFilters.push({
        nearestLandmarkId: query.nearestLandmarkId
      });
    }

    if (query.availableDay) {
      activityFilters.push({
        OR: [
          {
            availabilityDays: {
              has: query.availableDay
            }
          },
          {
            availabilityDays: {
              isEmpty: true
            }
          }
        ]
      });
    }

    if (query.availableFrom) {
      const startTimeFilters: Prisma.ActivityWhereInput[] = [
        {
          availabilityStartTime: {
            gte: query.availableFrom
          }
        }
      ];

      if (query.availableFrom <= '09:00') {
        startTimeFilters.push({
          availabilityStartTime: null
        });
      }

      activityFilters.push({
        OR: startTimeFilters
      });
    }

    if (query.availableUntil) {
      const endTimeFilters: Prisma.ActivityWhereInput[] = [
        {
          availabilityEndTime: {
            lte: query.availableUntil
          }
        }
      ];

      if (query.availableUntil >= '18:00') {
        endTimeFilters.push({
          availabilityEndTime: null
        });
      }

      activityFilters.push({
        OR: endTimeFilters
      });
    }

    if (query.durationType) {
      activityFilters.push(
        query.durationType === 'Short'
          ? {
              OR: [
                {
                  durationType: 'Short'
                },
                {
                  durationType: null
                }
              ]
            }
          : {
              durationType: query.durationType
            }
      );
    }

    if (query.activityType) {
      if (query.activityType === 'Both') {
        activityFilters.push({
          activityType: 'Both'
        });
      } else if (query.activityType === 'Private') {
        activityFilters.push({
          OR: [
            {
              activityType: {
                in: ['Private', 'Both']
              }
            },
            {
              activityType: null
            }
          ]
        });
      } else {
        activityFilters.push({
          activityType: {
            in: ['Group', 'Both']
          }
        });
      }
    }

    if (query.familyFriendly === true) {
      activityFilters.push({
        familyFriendly: true
      });
    }

    if (query.includesTransfer === true) {
      activityFilters.push({
        includesTransfer: true
      });
    }

    if (query.mealIncluded === true) {
      activityFilters.push({
        mealIncluded: true
      });
    }

    if (query.outdoor === true) {
      activityFilters.push({
        outdoor: true
      });
    }

    if (query.price) {
      activityFilters.push({
        price: {
          contains: query.price,
          mode: 'insensitive'
        }
      });
    }

    if (search) {
      activityFilters.push({
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
          },
          {
            categoryEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            categoryAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            providerEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            providerAr: {
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
            durationLabelEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            durationLabelAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            durationType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            activityType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            groupSize: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            difficulty: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            language: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            travelAgency: {
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
            highlights: {
              some: {
                OR: [
                  {
                    textEn: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
                  {
                    textAr: {
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

    const activityWhere: Prisma.ActivityWhereInput = {
      status: 'APPROVED',
      AND: activityFilters
    };

    const pagination = resolvePagination(query);
    const total = await prisma.activity.count({
      where: activityWhere
    });

    let activities: Prisma.ActivityGetPayload<{
      include: typeof activityInclude;
    }>[];

    if (query.sort !== 'recommended') {
      const candidates = await prisma.activity.findMany({
        where: activityWhere,
        select: {
          id: true,
          price: true,
          priceAmount: true,
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
          partnerTier: candidate.partnerTier,
          createdAt: candidate.createdAt
        })),
        query.sort,
        pagination.skip,
        pagination.take
      );

      const explicitlySortedActivities =
        orderedIds.length > 0
          ? await prisma.activity.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: activityInclude
            })
          : [];

      activities = restoreRankedOrder(
        explicitlySortedActivities,
        orderedIds
      );
    } else if (search) {
      const candidates = await prisma.activity.findMany({
        where: activityWhere,
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          descriptionEn: true,
          descriptionAr: true,
          locationEn: true,
          locationAr: true,
          categoryEn: true,
          categoryAr: true,
          providerEn: true,
          providerAr: true,
          price: true,

          durationMinutes: true,
          durationLabelEn: true,
          durationLabelAr: true,
          durationType: true,
          groupSize: true,
          language: true,
          difficulty: true,
          activityType: true,

          availabilityDays: true,
          availabilityStartTime: true,
          availabilityEndTime: true,

          familyFriendly: true,
          includesTransfer: true,
          mealIncluded: true,
          outdoor: true,

          travelAgencyId: true,
          nearestLandmarkId: true,
          partnerTier: true,
          createdAt: true,

          travelAgency: {
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
          highlights: {
            select: {
              textEn: true,
              textAr: true
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
            candidate.providerEn,
            candidate.providerAr,
            candidate.travelAgency?.nameEn,
            candidate.travelAgency?.nameAr,
            candidate.nearestLandmark?.nameEn,
            candidate.nearestLandmark?.nameAr,
            ...candidate.highlights.flatMap((highlight) => [
              highlight.textEn,
              highlight.textAr
            ])
          ];

          const qualityScore =
            Math.min(candidate.images.length, 3) * 2 +
            Math.min(candidate.highlights.length, 5) +
            Number(candidate.descriptionEn.trim().length >= 80) +
            Number(Boolean(candidate.titleAr)) +
            Number(Boolean(candidate.descriptionAr)) +
            Number(Boolean(candidate.locationAr)) +
            Number(Boolean(candidate.categoryAr)) +
            Number(Boolean(candidate.durationMinutes)) +
            Number(Boolean(candidate.durationLabelEn)) +
            Number(Boolean(candidate.durationLabelAr)) +
            Number(Boolean(candidate.durationType)) +
            Number(Boolean(candidate.groupSize)) +
            Number(Boolean(candidate.language)) +
            Number(Boolean(candidate.difficulty)) +
            Number(Boolean(candidate.activityType)) +
            Number(candidate.availabilityDays.length > 0) +
            Number(Boolean(candidate.availabilityStartTime)) +
            Number(Boolean(candidate.availabilityEndTime)) +
            Number(Boolean(candidate.nearestLandmarkId)) +
            Number(
              Boolean(
                candidate.travelAgencyId ||
                  candidate.providerEn ||
                  candidate.providerAr
              )
            );

          return {
            id: candidate.id,
            relevance: buildSearchRelevance(search, [
              [
                candidate.titleEn,
                candidate.titleAr
              ],
              [
                candidate.categoryEn,
                candidate.categoryAr,
                candidate.locationEn,
                candidate.locationAr,
                candidate.price,
                candidate.durationLabelEn,
                candidate.durationLabelAr,
                candidate.durationType,
                candidate.activityType,
                candidate.groupSize,
                candidate.difficulty,
                candidate.language
              ],
              relatedSearchValues,
              [
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

      const rankedActivities =
        orderedIds.length > 0
          ? await prisma.activity.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: activityInclude
            })
          : [];

      activities = restoreRankedOrder(
        rankedActivities,
        orderedIds
      );
    } else {
      activities = await prisma.activity.findMany({
        where: activityWhere,
        include: activityInclude,
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
      activities,
      pagination: createPaginationMetadata(
        total,
        activities.length,
        pagination
      )
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const query = activitiesQuerySchema.parse(req.query);

    const activities = await prisma.activity.findMany({
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
  } catch (error) {
    next(error);
  }
});

activitiesRouter.patch('/admin/:id/status', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = statusSchema.parse(req.body);

    const activity = await prisma.activity.update({
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
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const activity = await prisma.activity.findUnique({
      where: {
        slug
      },
      include: activityInclude
    });

    if (!activity || activity.status !== 'APPROVED') {
      throw new AppError(404, 'Activity not found');
    }

    res.json({
      activity
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.post(
  '/',
  requireAuth(),
  requireRole('ACTIVITY_PROVIDER', 'OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = activityCreateSchema.parse(req.body);
      const slug = `${slugify(data.titleEn)}-${Date.now().toString(36)}`;

      const travelAgency = data.travelAgencyId
        ? await prisma.travelAgency.findUnique({
            where: {
              id: data.travelAgencyId
            }
          })
        : null;

      if (data.travelAgencyId && !travelAgency) {
        throw new AppError(400, 'Selected travel agency was not found');
      }

      if (data.travelAgencyId && (data.providerEn || data.providerAr)) {
        throw new AppError(
          400,
          'Choose either a listed travel agency or enter a manual organizer name'
        );
      }

      const partnerTier = travelAgency
        ? getLinkedPartnerTier(travelAgency)
        : getManualPartnerTier(data.providerEn, data.providerAr);

      const resolvedPrice = resolvePriceInput({
        displayPrice: data.price,
        priceAmount: data.priceAmount,
        priceCurrency: data.priceCurrency,
        priceQualifier: data.priceQualifier,
        priceUnit: data.priceUnit
      });

      const activity = await prisma.activity.create({
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

          partnerTier,
          travelAgencyId: travelAgency?.id,
          providerEn: data.providerEn ?? travelAgency?.nameEn,
          providerAr: data.providerAr ?? travelAgency?.nameAr,

          price: resolvedPrice.price,
          priceAmount: resolvedPrice.priceAmount,
          priceCurrency: resolvedPrice.priceCurrency,
          priceQualifier: resolvedPrice.priceQualifier,
          priceUnit: resolvedPrice.priceUnit,
          durationMinutes: data.durationMinutes,
durationLabelEn: data.durationLabelEn,
durationLabelAr: data.durationLabelAr,
durationType: data.durationType,
groupSize: data.groupSize,
          language: data.language,
          difficulty: data.difficulty,
          activityType: data.activityType,
availabilityDays: data.availabilityDays,
availabilityStartTime: data.availabilityStartTime,
availabilityEndTime: data.availabilityEndTime,
familyFriendly: data.familyFriendly,
includesTransfer: data.includesTransfer,
          mealIncluded: data.mealIncluded,
          outdoor: data.outdoor,
          nearestLandmarkId: data.nearestLandmarkId,
          distanceFromLandmarkEn: data.distanceFromLandmarkEn,
          distanceFromLandmarkAr: data.distanceFromLandmarkAr,
          status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
          ownerId: req.user!.id,
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
    } catch (error) {
      next(error);
    }
  }
);