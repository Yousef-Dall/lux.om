import { Router } from 'express';
import {
  EnhancementStatus,
  MediaQualityStatus,
  type Prisma
} from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const mediaQualityRouter = Router();

const mediaQueueQuerySchema = z
  .object({
    itemType: z.enum(['LISTING', 'ACTIVITY']).optional(),
    mediaQualityStatus: z.nativeEnum(MediaQualityStatus).optional(),
    take: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

const mediaItemParamsSchema = z.object({
  itemType: z.enum(['LISTING', 'ACTIVITY']),
  id: z.string().trim().min(1)
});

const mediaQualityUpdateSchema = z
  .object({
    mediaQualityStatus: z.nativeEnum(MediaQualityStatus).optional(),
    mediaQualityNotes: z.string().trim().max(3000).nullable().optional(),
    enhancementStatus: z.nativeEnum(EnhancementStatus).optional()
  })
  .strict()
  .refine(
    (data) =>
      data.mediaQualityStatus !== undefined ||
      data.mediaQualityNotes !== undefined ||
      data.enhancementStatus !== undefined,
    {
      message: 'At least one media quality field is required'
    }
  );

const queueStatuses: MediaQualityStatus[] = [
  'NOT_CHECKED',
  'NEEDS_REVIEW',
  'BLOCKED'
];

const listingMediaSelect = {
  id: true,
  title: true,
  titleEn: true,
  titleAr: true,
  slug: true,
  status: true,
  mediaQualityStatus: true,
  mediaQualityNotes: true,
  enhancementStatus: true,
  image: true,
  videoWalkthroughUrl: true,
  tour360Url: true,
  virtualTourUrl: true,
  floorPlanUrl: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  images: {
    select: {
      url: true
    },
    orderBy: {
      sortOrder: 'asc'
    }
  }
} satisfies Prisma.ListingSelect;

const activityMediaSelect = {
  id: true,
  titleEn: true,
  titleAr: true,
  slug: true,
  status: true,
  mediaQualityStatus: true,
  mediaQualityNotes: true,
  enhancementStatus: true,
  videoWalkthroughUrl: true,
  tour360Url: true,
  virtualTourUrl: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  images: {
    select: {
      url: true
    },
    orderBy: {
      sortOrder: 'asc'
    }
  }
} satisfies Prisma.ActivitySelect;

type ListingMediaRecord = Prisma.ListingGetPayload<{
  select: typeof listingMediaSelect;
}>;

type ActivityMediaRecord = Prisma.ActivityGetPayload<{
  select: typeof activityMediaSelect;
}>;

function hasValue(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function countUniqueImages(values: Array<string | null | undefined>) {
  return new Set(
    values
      .filter((value): value is string => hasValue(value))
      .map((value) => value.trim())
  ).size;
}

function getMediaWhere(status?: MediaQualityStatus) {
  return status
    ? {
        mediaQualityStatus: status
      }
    : {
        mediaQualityStatus: {
          in: queueStatuses
        }
      };
}

function getStatusPriority(status: MediaQualityStatus) {
  if (status === 'BLOCKED') return 0;
  if (status === 'NEEDS_REVIEW') return 1;
  if (status === 'NOT_CHECKED') return 2;
  if (status === 'ACCEPTABLE') return 3;

  return 4;
}

function formatListingMediaItem(listing: ListingMediaRecord) {
  const imageCount = countUniqueImages([
    listing.image,
    ...listing.images.map((image) => image.url)
  ]);

  return {
    id: listing.id,
    itemType: 'LISTING' as const,
    title: listing.titleEn || listing.titleAr || listing.title || 'Listing',
    slug: listing.slug,
    owner: listing.owner,
    status: listing.status,
    mediaQualityStatus: listing.mediaQualityStatus,
    mediaQualityNotes: listing.mediaQualityNotes,
    enhancementStatus: listing.enhancementStatus,
    imageCount,
    hasMainImage: hasValue(listing.image),
    hasVideoOrTour:
      hasValue(listing.videoWalkthroughUrl) ||
      hasValue(listing.tour360Url) ||
      hasValue(listing.virtualTourUrl),
    hasFloorPlan: hasValue(listing.floorPlanUrl),
    updatedAt: listing.updatedAt.toISOString(),
    publicPath: `/listings/${listing.slug}`
  };
}

function formatActivityMediaItem(activity: ActivityMediaRecord) {
  const imageCount = countUniqueImages(activity.images.map((image) => image.url));
  const firstImage = activity.images[0]?.url ?? null;

  return {
    id: activity.id,
    itemType: 'ACTIVITY' as const,
    title: activity.titleEn || activity.titleAr || 'Activity',
    slug: activity.slug,
    owner: activity.owner,
    status: activity.status,
    mediaQualityStatus: activity.mediaQualityStatus,
    mediaQualityNotes: activity.mediaQualityNotes,
    enhancementStatus: activity.enhancementStatus,
    imageCount,
    hasMainImage: hasValue(firstImage),
    hasVideoOrTour:
      hasValue(activity.videoWalkthroughUrl) ||
      hasValue(activity.tour360Url) ||
      hasValue(activity.virtualTourUrl),
    hasFloorPlan: false,
    updatedAt: activity.updatedAt.toISOString(),
    publicPath: `/activities/${activity.slug}`
  };
}

type MediaQueueItem =
  | ReturnType<typeof formatListingMediaItem>
  | ReturnType<typeof formatActivityMediaItem>;

function sortMediaItems(first: MediaQueueItem, second: MediaQueueItem) {
  const statusDiff =
    getStatusPriority(first.mediaQualityStatus) -
    getStatusPriority(second.mediaQualityStatus);

  if (statusDiff !== 0) return statusDiff;

  return (
    new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
}

mediaQualityRouter.get('/admin/queue', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    const query = mediaQueueQuerySchema.parse(req.query);

    const [listings, activities] = await Promise.all([
      query.itemType === 'ACTIVITY'
        ? Promise.resolve([])
        : prisma.listing.findMany({
            where: getMediaWhere(query.mediaQualityStatus),
            select: listingMediaSelect,
            orderBy: {
              updatedAt: 'desc'
            },
            take: query.take
          }),

      query.itemType === 'LISTING'
        ? Promise.resolve([])
        : prisma.activity.findMany({
            where: getMediaWhere(query.mediaQualityStatus),
            select: activityMediaSelect,
            orderBy: {
              updatedAt: 'desc'
            },
            take: query.take
          })
    ]);

    const items = [
      ...listings.map(formatListingMediaItem),
      ...activities.map(formatActivityMediaItem)
    ]
      .sort(sortMediaItems)
      .slice(0, query.take);

    res.json({
      items,
      total: items.length
    });
  } catch (error) {
    next(error);
  }
});

mediaQualityRouter.patch('/admin/:itemType/:id', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    const { itemType, id } = mediaItemParamsSchema.parse(req.params);
    const data = mediaQualityUpdateSchema.parse(req.body);

    if (itemType === 'LISTING') {
      const existingListing = await prisma.listing.findUnique({
        where: {
          id
        },
        select: {
          id: true
        }
      });

      if (!existingListing) {
        throw new AppError(404, 'Listing not found');
      }

      const listing = await prisma.listing.update({
        where: {
          id
        },
        data,
        select: listingMediaSelect
      });

      res.json({
        item: formatListingMediaItem(listing)
      });

      return;
    }

    const existingActivity = await prisma.activity.findUnique({
      where: {
        id
      },
      select: {
        id: true
      }
    });

    if (!existingActivity) {
      throw new AppError(404, 'Activity not found');
    }

    const activity = await prisma.activity.update({
      where: {
        id
      },
      data,
      select: activityMediaSelect
    });

    res.json({
      item: formatActivityMediaItem(activity)
    });
  } catch (error) {
    next(error);
  }
});
