import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/http';

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

developersRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const developer = await prisma.developerCompany.findUnique({
      where: {
        slug
      },
      include: {
        listings: {
          where: {
            status: 'APPROVED'
          },
          include: {
            amenities: true,
            images: {
              orderBy: {
                sortOrder: 'asc'
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
            createdAt: 'desc'
          }
        }
      }
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