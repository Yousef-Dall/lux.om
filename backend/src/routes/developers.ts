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

export const developersRouter = Router();

const developersQuerySchema = z.object({
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

const developerCreateSchema = z
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
    establishedYear: z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    verified: z.coerce.boolean().default(false),
    featured: z.coerce.boolean().default(false)
  })
  .strict();
const developerUpdateSchema = z
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
const developerDetailsInclude = {
  listings: {
    where: {
      status: 'APPROVED' as const
    },
    include: {
      amenities: true,
      images: {
        orderBy: {
          sortOrder: 'asc' as const
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
      createdAt: 'desc' as const
    }
  }
};

developersRouter.get('/', async (req, res, next) => {
  try {
    const query = developersQuerySchema.parse(req.query);
    const search = query.search?.trim();

    const developers = await prisma.developerCompany.findMany({
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
  } catch (error) {
    next(error);
  }
});

developersRouter.post(
  '/',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const data = developerCreateSchema.parse(req.body);
      const slug = `${slugify(data.nameEn)}-${Date.now().toString(36)}`;
      const partnerStatus = resolvePartnerStatus(
        {
          verified: false,
          featured: false
        },
        data
      );

      const developer = await prisma.developerCompany.create({
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
        },
        include: {
          _count: {
            select: {
              listings: true
            }
          }
        }
      });

      res.status(201).json({
        developer
      });
    } catch (error) {
      next(error);
    }
  }
);

developersRouter.patch(
  '/:id',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = developerUpdateSchema.parse(req.body);

      const existingDeveloper = await prisma.developerCompany.findUnique({
        where: {
          id
        }
      });

      if (!existingDeveloper) {
        throw new AppError(404, 'Developer company not found');
      }

      const partnerStatus = resolvePartnerStatus(existingDeveloper, data);
      const partnerTier = getLinkedPartnerTier(partnerStatus);

      const developer = await prisma.$transaction(async (transaction) => {
        const updatedDeveloper = await transaction.developerCompany.update({
          where: {
            id
          },
          data: {
            ...data,
            ...partnerStatus
          },
          include: {
            _count: {
              select: {
                listings: true
              }
            }
          }
        });

        await transaction.listing.updateMany({
          where: {
            developerId: id
          },
          data: {
            partnerTier
          }
        });

        return updatedDeveloper;
      });

      res.json({
        developer
      });
    } catch (error) {
      next(error);
    }
  }
);

developersRouter.delete(
  '/:id',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);

      const existingDeveloper = await prisma.developerCompany.findUnique({
        where: {
          id
        }
      });

      if (!existingDeveloper) {
        throw new AppError(404, 'Developer company not found');
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.listing.updateMany({
          where: {
            developerId: id
          },
          data: {
            developerNameEn: existingDeveloper.nameEn,
            developerNameAr: existingDeveloper.nameAr,
            partnerTier: PARTNER_TIER.UNVERIFIED_OR_MANUAL
          }
        });

        await transaction.developerCompany.delete({
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
  }
);

developersRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const developer = await prisma.developerCompany.findUnique({
      where: {
        slug
      },
      include: developerDetailsInclude
    });

    if (!developer) {
      throw new AppError(404, 'Developer not found');
    }

    res.json({
      developer
    });
  } catch (error) {
    next(error);
  }
});