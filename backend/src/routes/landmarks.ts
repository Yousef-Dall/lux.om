import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';

export const landmarksRouter = Router();

const landmarksQuerySchema = z.object({
  search: z.string().trim().optional(),
  city: z.string().trim().optional(),
  category: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
});

landmarksRouter.get('/', async (req, res, next) => {
  try {
    const query = landmarksQuerySchema.parse(req.query);
    const search = query.search?.trim();

    const landmarks = await prisma.landmark.findMany({
      where: {
        ...(query.city
          ? {
              OR: [
                {
                  cityEn: {
                    contains: query.city,
                    mode: 'insensitive'
                  }
                },
                {
                  cityAr: {
                    contains: query.city,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {}),
        ...(query.category
          ? {
              category: {
                contains: query.category,
                mode: 'insensitive'
              }
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
                  cityEn: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  cityAr: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  category: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {})
      },
      orderBy: {
        nameEn: 'asc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      landmarks,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: landmarks.length
      }
    });
  } catch (error) {
    next(error);
  }
});

landmarksRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const landmark = await prisma.landmark.findUnique({
      where: {
        slug
      },
      include: {
        listings: {
          where: {
            status: 'APPROVED'
          },
          take: 12,
          orderBy: {
            createdAt: 'desc'
          }
        },
        activities: {
          where: {
            status: 'APPROVED'
          },
          take: 12,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!landmark) {
      res.status(404).json({
        message: 'Landmark not found'
      });
      return;
    }

    res.json({
      landmark
    });
  } catch (error) {
    next(error);
  }
});