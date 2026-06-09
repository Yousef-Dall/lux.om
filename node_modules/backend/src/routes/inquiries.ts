import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const inquiriesRouter = Router();

const inquiryCreateSchema = z
  .object({
    type: z.enum(['PROPERTY', 'ACTIVITY', 'DEVELOPER_PARTNERSHIP', 'OWNER_PARTNERSHIP', 'GENERAL']),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().toLowerCase(),
    phone: z.string().trim().min(6).max(30).optional(),
    message: z.string().trim().min(5).max(3000),
    listingId: z.string().min(1).optional(),
    activityId: z.string().min(1).optional()
  })
  .strict();

const inquiriesQuerySchema = z.object({
  type: z.enum(['PROPERTY', 'ACTIVITY', 'DEVELOPER_PARTNERSHIP', 'OWNER_PARTNERSHIP', 'GENERAL']).optional(),
  search: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const inquiryInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      titleAr: true,
      location: true,
      locationEn: true,
      locationAr: true,
      price: true,
      image: true,
      status: true
    }
  },
  activity: {
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleAr: true,
      locationEn: true,
      locationAr: true,
      price: true,
      status: true
    }
  }
};

inquiriesRouter.post('/', requireAuth(false), async (req, res, next) => {
  try {
    const data = inquiryCreateSchema.parse(req.body);

    if (data.type === 'PROPERTY' && !data.listingId) {
      throw new AppError(400, 'listingId is required for property inquiries');
    }

    if (data.type === 'ACTIVITY' && !data.activityId) {
      throw new AppError(400, 'activityId is required for activity inquiries');
    }

    if (data.listingId) {
      const listing = await prisma.listing.findUnique({
        where: {
          id: data.listingId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!listing || listing.status !== 'APPROVED') {
        throw new AppError(404, 'Listing not found');
      }
    }

    if (data.activityId) {
      const activity = await prisma.activity.findUnique({
        where: {
          id: data.activityId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!activity || activity.status !== 'APPROVED') {
        throw new AppError(404, 'Activity not found');
      }
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        type: data.type,
        name: data.name,
        email: data.email,
        phone: data.phone?.trim() || null,
        message: data.message,
        userId: req.user?.id ?? null,
        listingId: data.listingId ?? null,
        activityId: data.activityId ?? null
      },
      include: inquiryInclude
    });

    res.status(201).json({
      inquiry
    });
  } catch (error) {
    next(error);
  }
});

inquiriesRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const query = inquiriesQuerySchema.parse(req.query);
    const search = query.search?.trim();

    const inquiries = await prisma.inquiry.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  email: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  phone: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  message: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {})
      },
      include: inquiryInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      inquiries,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: inquiries.length
      }
    });
  } catch (error) {
    next(error);
  }
});

inquiriesRouter.get('/admin/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);

    const inquiry = await prisma.inquiry.findUnique({
      where: {
        id
      },
      include: inquiryInclude
    });

    if (!inquiry) {
      throw new AppError(404, 'Inquiry not found');
    }

    res.json({
      inquiry
    });
  } catch (error) {
    next(error);
  }
});

inquiriesRouter.delete('/admin/:id', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);

    await prisma.inquiry.delete({
      where: {
        id
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});