import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
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

    price: z.string().trim().min(1).max(80),
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
  .strict();

const activitiesQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  travelAgencyId: z.string().trim().optional(),
  featured: z.coerce.boolean().optional(),
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

    const activities = await prisma.activity.findMany({
      where: {
        status: 'APPROVED',
        ...(typeof query.featured === 'boolean' ? { featured: query.featured } : {}),
        ...(query.travelAgencyId ? { travelAgencyId: query.travelAgencyId } : {}),
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
                  travelAgency: {
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

          travelAgencyId: travelAgency?.id,
          providerEn: data.providerEn ?? travelAgency?.nameEn,
          providerAr: data.providerAr ?? travelAgency?.nameAr,

          price: data.price,
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