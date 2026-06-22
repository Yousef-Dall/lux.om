import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const savedRouter = Router();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).optional(),
  query: z.string().trim().max(300).optional(),
  filters: z.unknown().default({}),
  alertFrequency: z.enum(['NONE', 'DASHBOARD_ONLY', 'DAILY', 'WEEKLY']).default('DASHBOARD_ONLY'),
  alertsEnabled: z.coerce.boolean().default(true)
}).strict();

const watchlistSchema = z.object({
  listingId: z.string().trim().optional(),
  valuationRequestId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  targetPrice: z.coerce.number().finite().min(0).optional(),
  alertOnPriceChange: z.coerce.boolean().default(true),
  alertOnNewComparables: z.coerce.boolean().default(false)
}).strict().superRefine((data, context) => {
  if (!data.listingId && !data.valuationRequestId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['listingId'],
      message: 'A listing or valuation request is required'
    });
  }
});

savedRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const [listings, activities, searches, watchlist] = await Promise.all([
      prisma.savedListing.findMany({
        where: { userId: req.user!.id },
        include: { listing: { include: { images: true, developer: true, nearestLandmark: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.savedActivity.findMany({
        where: { userId: req.user!.id },
        include: { activity: { include: { images: true, highlights: true, travelAgency: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.savedSearch.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.investorWatchlistItem.findMany({
        where: { userId: req.user!.id },
        include: { listing: true, valuationRequest: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({ listings, activities, searches, watchlist });
  } catch (error) {
    next(error);
  }
});

savedRouter.post('/listings/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const saved = await prisma.savedListing.upsert({
      where: { userId_listingId: { userId: req.user!.id, listingId: id } },
      update: {},
      create: { userId: req.user!.id, listingId: id }
    });

    res.status(201).json({ saved });
  } catch (error) {
    next(error);
  }
});

savedRouter.delete('/listings/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    await prisma.savedListing.deleteMany({ where: { userId: req.user!.id, listingId: id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

savedRouter.post('/activities/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const saved = await prisma.savedActivity.upsert({
      where: { userId_activityId: { userId: req.user!.id, activityId: id } },
      update: {},
      create: { userId: req.user!.id, activityId: id }
    });

    res.status(201).json({ saved });
  } catch (error) {
    next(error);
  }
});

savedRouter.delete('/activities/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    await prisma.savedActivity.deleteMany({ where: { userId: req.user!.id, activityId: id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

savedRouter.post('/searches', requireAuth(), async (req, res, next) => {
  try {
    const data = savedSearchSchema.parse(req.body);
    const savedSearch = await prisma.savedSearch.create({
      data: {
        name: data.name,
        category: data.category,
        query: data.query,
        filters: data.filters as Prisma.InputJsonValue,
        alertFrequency: data.alertFrequency,
        alertsEnabled: data.alertsEnabled,
        userId: req.user!.id
      }
    });

    res.status(201).json({ savedSearch });
  } catch (error) {
    next(error);
  }
});

savedRouter.post('/watchlist', requireAuth(), async (req, res, next) => {
  try {
    const data = watchlistSchema.parse(req.body);
    const item = await prisma.investorWatchlistItem.create({
      data: {
        ...data,
        targetPrice: data.targetPrice === undefined ? undefined : data.targetPrice.toString(),
        userId: req.user!.id
      }
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});
