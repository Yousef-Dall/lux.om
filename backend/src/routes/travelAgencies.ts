import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import {
  getLinkedPartnerTier,
  PARTNER_TIER,
  resolvePartnerStatus
} from '../utils/partnerTier';
import { slugify } from '../utils/slugify';

export const travelAgenciesRouter = Router();

const travelAgenciesQuerySchema = z.object({
  search: z.string().trim().optional(),
  featured: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
});

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const travelAgencyCreateSchema = z
  .object({
    nameEn: z.string().trim().min(2).max(140),
    nameAr: z.string().trim().max(140).optional(),
    descriptionEn: z.string().trim().max(2000).optional(),
    descriptionAr: z.string().trim().max(2000).optional(),
    headquartersEn: z.string().trim().max(160).optional(),
    headquartersAr: z.string().trim().max(160).optional(),
    logo: z.string().trim().url().optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().optional(),
    website: z.string().trim().url().optional(),
    establishedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
    verified: z.coerce.boolean().default(false),
    featured: z.coerce.boolean().default(false)
  })
  .strict();

const travelAgencyUpdateSchema = z
  .object({
    nameEn: z.string().trim().min(2).max(140).optional(),
    nameAr: z.string().trim().max(140).optional(),
    descriptionEn: z.string().trim().max(2000).optional(),
    descriptionAr: z.string().trim().max(2000).optional(),
    headquartersEn: z.string().trim().max(160).optional(),
    headquartersAr: z.string().trim().max(160).optional(),
    logo: z.string().trim().url().optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().optional(),
    website: z.string().trim().url().optional(),
    establishedYear: z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    verified: z.boolean().optional(),
    featured: z.boolean().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const travelAgencyInclude = {
  activities: {
    where: {
      status: 'APPROVED' as const
    },
    include: {
      images: {
        orderBy: {
          sortOrder: 'asc' as const
        }
      },
      highlights: true,
      nearestLandmark: true
    },
    orderBy: {
      createdAt: 'desc' as const
    }
  }
};

travelAgenciesRouter.get('/', async (req, res, next) => {
  try {
    const query = travelAgenciesQuerySchema.parse(req.query);
    const search = query.search?.trim();

    const travelAgencies = await prisma.travelAgency.findMany({
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
  } catch (error) {
    next(error);
  }
});

travelAgenciesRouter.post('/', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = travelAgencyCreateSchema.parse(req.body);
    const slug = `${slugify(data.nameEn)}-${Date.now().toString(36)}`;
    const partnerStatus = resolvePartnerStatus(
      {
        verified: false,
        featured: false
      },
      data
    );

    const travelAgency = await prisma.travelAgency.create({
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
        verified: partnerStatus.verified,
        featured: partnerStatus.featured
      }
    });

    res.status(201).json({
      travelAgency
    });
  } catch (error) {
    next(error);
  }
});

travelAgenciesRouter.patch('/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = travelAgencyUpdateSchema.parse(req.body);

    const existingAgency = await prisma.travelAgency.findUnique({
      where: {
        id
      }
    });

    if (!existingAgency) {
      throw new AppError(404, 'Travel agency not found');
    }

    const partnerStatus = resolvePartnerStatus(existingAgency, data);
    const partnerTier = getLinkedPartnerTier(partnerStatus);

    const travelAgency = await prisma.$transaction(async (transaction) => {
      const updatedAgency = await transaction.travelAgency.update({
        where: {
          id
        },
        data: {
          ...data,
          ...partnerStatus
        }
      });

      await transaction.activity.updateMany({
        where: {
          travelAgencyId: id
        },
        data: {
          partnerTier
        }
      });

      return updatedAgency;
    });

    res.json({
      travelAgency
    });
  } catch (error) {
    next(error);
  }
});

travelAgenciesRouter.delete('/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);

    const existingAgency = await prisma.travelAgency.findUnique({
      where: {
        id
      }
    });

    if (!existingAgency) {
      throw new AppError(404, 'Travel agency not found');
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.activity.updateMany({
        where: {
          travelAgencyId: id
        },
        data: {
          providerEn: existingAgency.nameEn,
          providerAr: existingAgency.nameAr,
          partnerTier: PARTNER_TIER.UNVERIFIED_OR_MANUAL
        }
      });

      await transaction.travelAgency.delete({
        where: {
          id
        }
      });
    });

    res.json({
      ok: true,
      deletedId: id
    });
  } catch (error) {
    next(error);
  }
});

travelAgenciesRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const travelAgency = await prisma.travelAgency.findUnique({
      where: {
        slug
      },
      include: travelAgencyInclude
    });

    if (!travelAgency) {
      throw new AppError(404, 'Travel agency not found');
    }

    res.json({
      travelAgency
    });
  } catch (error) {
    next(error);
  }
});