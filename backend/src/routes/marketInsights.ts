import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import {
  getMarketInsightForLocation,
  getNeighborhoodMarketInsights,
  refreshNeighborhoodMarketInsightSnapshots
} from '../services/marketInsights';
import { requireAuth, requireRole } from '../middleware/auth';

export const marketInsightsRouter = Router();

const locationQuerySchema = z.object({
  location: z.string().trim().min(2).max(120),
  propertyType: z.string().trim().max(80).optional(),
  includeSimilarListings: z.coerce.boolean().optional()
});

marketInsightsRouter.get('/', async (_req, res, next) => {
  try {
    const insights = await getNeighborhoodMarketInsights(prisma);

    res.json({
      insights,
      disclaimer:
        'Market insights are based only on available lux.om asking prices and are not formal valuations.'
    });
  } catch (error) {
    next(error);
  }
});

marketInsightsRouter.get('/location', async (req, res, next) => {
  try {
    const query = locationQuerySchema.parse(req.query);
    const insight = await getMarketInsightForLocation(prisma, query.location, {
      propertyType: query.propertyType,
      includeSimilarListings: query.includeSimilarListings
    });

    res.json({
      insight,
      disclaimer:
        'Market insights are based only on available lux.om asking prices and are not formal valuations.'
    });
  } catch (error) {
    next(error);
  }
});

marketInsightsRouter.post(
  '/admin/refresh-snapshots',
  requireAuth(),
  requireRole('ADMIN'),
  async (_req, res, next) => {
    try {
      const snapshots = await refreshNeighborhoodMarketInsightSnapshots(prisma);

      res.status(201).json({
        snapshots,
        count: snapshots.length
      });
    } catch (error) {
      next(error);
    }
  }
);
