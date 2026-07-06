import { VerificationStatus, type User } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requireVerifiedEmail } from '../middleware/auth';
import { AppError } from '../utils/http';
import {
  getLinkedPartnerTier,
  PARTNER_TIER,
  resolvePartnerStatus
} from '../utils/partnerTier';
import { slugify } from '../utils/slugify';

const optionalBooleanQuerySchema = z
  .preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;

    return value;
  }, z.boolean())
  .optional();

const optionalProjectNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}, z.coerce.number().finite().min(0).optional()).optional();

const optionalProjectDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}, z.coerce.date().optional()).optional();

const safeProjectUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) =>
      value.startsWith('/uploads/') ||
      value.startsWith('/assets/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    'Use an uploaded path or an http(s) URL'
  );

const optionalSafeProjectUrlSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}, safeProjectUrlSchema.optional()).optional();

const priceQualifierValues = ['FIXED', 'FROM', 'ON_REQUEST'] as const;
const projectStatusValues = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const developersRouter = Router();

const developersQuerySchema = z.object({
  search: z.string().trim().optional(),
  featured: optionalBooleanQuerySchema,
  verified: optionalBooleanQuerySchema,
  verifiedOnly: optionalBooleanQuerySchema,
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const developerProjectsQuerySchema = z.object({
  developerId: z.string().trim().optional(),
  status: z.enum(projectStatusValues).optional(),
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

const developerProjectImageSchema = z.object({
  url: safeProjectUrlSchema,
  altEn: z.string().trim().max(160).optional(),
  altAr: z.string().trim().max(160).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

const developerProjectCreateSchema = z
  .object({
    nameEn: z.string().trim().min(2).max(160),
    nameAr: z.string().trim().max(160).optional(),
    descriptionEn: z.string().trim().max(5000).optional(),
    descriptionAr: z.string().trim().max(5000).optional(),
    locationEn: z.string().trim().min(2).max(180),
    locationAr: z.string().trim().max(180).optional(),
    completionStatus: z.string().trim().max(120).optional(),
    handoverDate: optionalProjectDateSchema,
    totalUnits: z.coerce.number().int().min(0).max(10000).optional(),
    availableUnits: z.coerce.number().int().min(0).max(10000).optional(),
    bedroomsSummary: z.string().trim().max(180).optional(),
    amenities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    paymentPlan: z.string().trim().max(3000).optional(),
    brochureUrl: optionalSafeProjectUrlSchema,
    masterplanUrl: optionalSafeProjectUrlSchema,
    videoWalkthroughUrl: optionalSafeProjectUrlSchema,
    image: optionalSafeProjectUrlSchema,
    images: z.array(developerProjectImageSchema).max(20).default([]),
    startingPriceAmount: optionalProjectNumberSchema,
    priceCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    priceQualifier: z.enum(priceQualifierValues).default('FROM'),
    developerId: z.string().trim().optional(),
    developerNameEn: z.string().trim().max(140).optional(),
    developerNameAr: z.string().trim().max(140).optional(),
    nearestLandmarkId: z.string().trim().optional(),
    status: z.enum(projectStatusValues).optional()
  })
  .strict()
  .superRefine((data, context) => {
    if (data.developerId && (data.developerNameEn || data.developerNameAr)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['developerId'],
        message: 'Choose either a listed development company or enter a developer name'
      });
    }

    if (data.availableUnits !== undefined && data.totalUnits !== undefined && data.availableUnits > data.totalUnits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['availableUnits'],
        message: 'Available units cannot exceed total units'
      });
    }
  });

type DeveloperProjectCreateData = z.infer<typeof developerProjectCreateSchema>;

const listingUnitInclude = {
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

const developerProjectInclude = {
  developer: true,
  nearestLandmark: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  listings: {
    where: {
      status: 'APPROVED' as const
    },
    include: listingUnitInclude,
    orderBy: {
      createdAt: 'desc' as const
    }
  },
  _count: {
    select: {
      listings: true
    }
  }
};

const developerDetailsInclude = {
  listings: {
    where: {
      status: 'APPROVED' as const
    },
    include: listingUnitInclude,
    orderBy: {
      createdAt: 'desc' as const
    }
  },
  projects: {
    where: {
      status: 'APPROVED' as const
    },
    include: developerProjectInclude,
    orderBy: {
      createdAt: 'desc' as const
    }
  }
};

function createProjectImageData(data: DeveloperProjectCreateData) {
  const images = data.images.length
    ? data.images
    : data.image
      ? [
          {
            url: data.image,
            altEn: data.nameEn,
            sortOrder: 0
          }
        ]
      : [];

  return images.map((image) => ({
    url: image.url,
    altEn: image.altEn ?? data.nameEn,
    altAr: image.altAr ?? data.nameAr,
    sortOrder: image.sortOrder ?? 0
  }));
}

async function resolveDeveloperCompanyForProject(data: DeveloperProjectCreateData, user: User) {
  if (data.developerId) {
    const developer = await prisma.developerCompany.findUnique({
      where: {
        id: data.developerId
      }
    });

    if (!developer) {
      throw new AppError(400, 'Selected development company was not found');
    }

    return developer;
  }

  const companyName = data.developerNameEn || user.companyName || user.name;
  const existingDeveloper = await prisma.developerCompany.findFirst({
    where: {
      nameEn: {
        equals: companyName,
        mode: 'insensitive'
      }
    }
  });

  if (existingDeveloper) {
    return existingDeveloper;
  }

  return prisma.developerCompany.create({
    data: {
      slug: slugify(companyName) + '-' + Date.now().toString(36),
      nameEn: companyName,
      nameAr: data.developerNameAr,
      headquartersEn: data.locationEn,
      headquartersAr: data.locationAr,
      verified: false,
      featured: false
    }
  });
}

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
        ...(query.verifiedOnly
          ? {
              verificationStatus: {
                in: [
                  VerificationStatus.ADMIN_VERIFIED,
                  VerificationStatus.EXTERNALLY_VERIFIED
                ]
              }
            }
          : typeof query.verified === 'boolean'
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
            listings: true,
            projects: true
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
      const slug = slugify(data.nameEn) + '-' + Date.now().toString(36);
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
              listings: true,
              projects: true
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

developersRouter.get('/projects', async (req, res, next) => {
  try {
    const query = developerProjectsQuerySchema.parse(req.query);

    const projects = await prisma.developerProject.findMany({
      where: {
        status: 'APPROVED',
        ...(query.developerId
          ? {
              developerId: query.developerId
            }
          : {})
      },
      include: developerProjectInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      projects,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: projects.length
      }
    });
  } catch (error) {
    next(error);
  }
});

developersRouter.get(
  '/projects/mine',
  requireAuth(),
  requireRole('DEVELOPER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const query = developerProjectsQuerySchema.parse(req.query);

      const projects = await prisma.developerProject.findMany({
        where: {
          ownerId: req.user!.id,
          ...(query.status
            ? {
                status: query.status
              }
            : {})
        },
        include: developerProjectInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: query.take,
        skip: query.skip
      });

      res.json({
        projects,
        pagination: {
          take: query.take,
          skip: query.skip,
          count: projects.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

developersRouter.post(
  '/projects',
  requireAuth(),
  requireRole('DEVELOPER', 'ADMIN'),
  requireVerifiedEmail({ allowAdmin: true }),
  async (req, res, next) => {
    try {
      const data = developerProjectCreateSchema.parse(req.body);
      const developer = await resolveDeveloperCompanyForProject(data, req.user!);
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

      const imageData = createProjectImageData(data);
      const project = await prisma.developerProject.create({
        data: {
          slug: slugify(data.nameEn) + '-' + Date.now().toString(36),
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          descriptionEn: data.descriptionEn,
          descriptionAr: data.descriptionAr,
          locationEn: data.locationEn,
          locationAr: data.locationAr,
          completionStatus: data.completionStatus,
          handoverDate: data.handoverDate,
          totalUnits: data.totalUnits,
          availableUnits: data.availableUnits,
          bedroomsSummary: data.bedroomsSummary,
          amenities: data.amenities,
          paymentPlan: data.paymentPlan,
          brochureUrl: data.brochureUrl,
          masterplanUrl: data.masterplanUrl,
          videoWalkthroughUrl: data.videoWalkthroughUrl,
          image: data.image ?? imageData[0]?.url,
          startingPriceAmount: data.startingPriceAmount,
          priceCurrency: data.priceCurrency,
          priceQualifier: data.priceQualifier,
          status: req.user!.role === 'ADMIN' ? data.status ?? 'APPROVED' : 'PENDING',
          developerId: developer.id,
          ownerId: req.user!.id,
          nearestLandmarkId: nearestLandmark?.id,
          images: imageData.length
            ? {
                create: imageData
              }
            : undefined
        },
        include: developerProjectInclude
      });

      res.status(201).json({
        project
      });
    } catch (error) {
      next(error);
    }
  }
);

developersRouter.get('/projects/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);
    const project = await prisma.developerProject.findFirst({
      where: {
        slug,
        status: 'APPROVED'
      },
      include: developerProjectInclude
    });

    if (!project) {
      throw new AppError(404, 'Developer project not found');
    }

    res.json({
      project
    });
  } catch (error) {
    next(error);
  }
});

developersRouter.get('/:slug/projects', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);
    const query = developerProjectsQuerySchema.parse(req.query);
    const developer = await prisma.developerCompany.findUnique({
      where: {
        slug
      }
    });

    if (!developer) {
      throw new AppError(404, 'Developer not found');
    }

    const projects = await prisma.developerProject.findMany({
      where: {
        developerId: developer.id,
        status: 'APPROVED'
      },
      include: developerProjectInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      projects,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: projects.length
      }
    });
  } catch (error) {
    next(error);
  }
});

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
                listings: true,
                projects: true
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
