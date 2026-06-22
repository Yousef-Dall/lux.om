import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { createValuationFromAvailableData, normalizeValuationRequestInput } from '../services/valuation';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const valuationsRouter = Router();

const valuationSchema = z.object({
  location: z.string().trim().min(2).max(120),
  propertyType: z.string().trim().max(80).optional(),
  sqm: z.coerce.number().int().min(1).max(100000).optional(),
  beds: z.coerce.number().int().min(0).max(50).optional(),
  baths: z.coerce.number().int().min(0).max(50).optional(),
  askingPrice: z.coerce.number().finite().min(0).optional(),
  rentEstimate: z.coerce.number().finite().min(0).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  listingId: z.string().trim().optional()
}).strict();

const adminReviewSchema = z.object({
  reviewStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_DATA']),
  reviewNotes: z.string().trim().max(3000).optional()
}).strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

valuationsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = normalizeValuationRequestInput(valuationSchema.parse(req.body));

    if (data.listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: data.listingId } });

      if (!listing) {
        throw new AppError(404, 'Listing not found');
      }
    }

    const result = await createValuationFromAvailableData(prisma, data);

    const valuation = await prisma.valuationRequest.create({
      data: {
        status: result.estimateLow && result.estimateHigh ? 'ESTIMATE_READY' : 'LOW_DATA_READY',
        confidence: result.confidence,
        propertyType: data.propertyType,
        location: data.location,
        sqm: data.sqm,
        beds: data.beds,
        baths: data.baths,
        askingPrice: data.askingPrice === null ? null : data.askingPrice.toString(),
        rentEstimate: data.rentEstimate === null ? null : data.rentEstimate.toString(),
        currency: data.currency,
        estimateLow: result.estimateLow === null ? null : result.estimateLow.toString(),
        estimateHigh: result.estimateHigh === null ? null : result.estimateHigh.toString(),
        comparableSnapshots: result.comparableSnapshots,
        generatedNotes: result.notes,
        disclaimer: result.disclaimer,
        listingId: data.listingId,
        requestedById: req.user!.id
      }
    });

    res.status(201).json({ valuation });
  } catch (error) {
    next(error);
  }
});

valuationsRouter.get('/mine', requireAuth(), async (req, res, next) => {
  try {
    const valuations = await prisma.valuationRequest.findMany({
      where: { requestedById: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ valuations });
  } catch (error) {
    next(error);
  }
});

valuationsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const valuations = await prisma.valuationRequest.findMany({
      include: {
        listing: true,
        requestedBy: { select: { id: true, name: true, email: true, phone: true } },
        reviewedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ valuations });
  } catch (error) {
    next(error);
  }
});

valuationsRouter.patch('/admin/:id/review', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = adminReviewSchema.parse(req.body);

    const valuation = await prisma.valuationRequest.update({
      where: { id },
      data: {
        reviewStatus: data.reviewStatus,
        reviewNotes: data.reviewNotes,
        reviewedById: req.user!.id,
        status: data.reviewStatus === 'APPROVED' ? 'APPROVED' : undefined
      }
    });

    res.json({ valuation });
  } catch (error) {
    next(error);
  }
});
