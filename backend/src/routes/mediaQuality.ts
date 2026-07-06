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

const mediaItemTypes = ['LISTING', 'ACTIVITY', 'PROJECT'] as const;
const reviewWarningValues = [
  'MISSING_HERO',
  'WEAK_IMAGE_COUNT',
  'MISSING_VIDEO_TOUR',
  'MISSING_FLOOR_PLAN'
] as const;
const publishStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

type MediaItemType = (typeof mediaItemTypes)[number];
type ReviewWarning = (typeof reviewWarningValues)[number];

const mediaQueueQuerySchema = z
  .object({
    itemType: z.enum(mediaItemTypes).optional(),
    status: z.enum(publishStatuses).optional(),
    mediaQualityStatus: z.nativeEnum(MediaQualityStatus).optional(),
    warning: z.enum(reviewWarningValues).optional(),
    take: z.coerce.number().int().min(1).max(100).default(50),
    skip: z.coerce.number().int().min(0).default(0)
  })
  .strict();

const mediaItemParamsSchema = z.object({
  itemType: z.enum(mediaItemTypes),
  id: z.string().trim().min(1)
});

const mediaQualityUpdateSchema = z
  .object({
    mediaQualityStatus: z.nativeEnum(MediaQualityStatus).optional(),
    mediaQualityNotes: z.string().trim().max(3000).nullable().optional(),
    enhancementStatus: z.nativeEnum(EnhancementStatus).optional(),
    enhancementNotes: z.string().trim().max(3000).nullable().optional()
  })
  .strict()
  .refine(
    (data) =>
      data.mediaQualityStatus !== undefined ||
      data.mediaQualityNotes !== undefined ||
      data.enhancementStatus !== undefined ||
      data.enhancementNotes !== undefined,
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
  enhancementNotes: true,
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
  enhancementNotes: true,
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

const projectMediaSelect = {
  id: true,
  nameEn: true,
  nameAr: true,
  slug: true,
  status: true,
  mediaQualityStatus: true,
  mediaQualityNotes: true,
  enhancementStatus: true,
  enhancementNotes: true,
  image: true,
  videoWalkthroughUrl: true,
  masterplanUrl: true,
  brochureUrl: true,
  updatedAt: true,
  developer: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      email: true
    }
  },
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
} satisfies Prisma.DeveloperProjectSelect;

type ListingMediaRecord = Prisma.ListingGetPayload<{
  select: typeof listingMediaSelect;
}>;

type ActivityMediaRecord = Prisma.ActivityGetPayload<{
  select: typeof activityMediaSelect;
}>;

type ProjectMediaRecord = Prisma.DeveloperProjectGetPayload<{
  select: typeof projectMediaSelect;
}>;

type MediaQueueItem = {
  id: string;
  itemType: MediaItemType;
  title: string;
  slug: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  status: string;
  mediaQualityStatus: MediaQualityStatus;
  mediaQualityNotes: string | null;
  enhancementStatus: EnhancementStatus;
  enhancementNotes: string | null;
  imageCount: number;
  hasMainImage: boolean;
  hasVideoOrTour: boolean;
  hasFloorPlan: boolean;
  thumbnailUrl: string | null;
  warnings: ReviewWarning[];
  updatedAt: string;
  publicPath: string;
};

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

function getFirstImage(values: Array<string | null | undefined>) {
  return values.find((value): value is string => hasValue(value))?.trim() ?? null;
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

function getReviewWarnings(input: {
  itemType: MediaItemType;
  imageCount: number;
  hasMainImage: boolean;
  hasVideoOrTour: boolean;
  hasFloorPlan: boolean;
}) {
  const warnings: ReviewWarning[] = [];

  if (!input.hasMainImage) warnings.push('MISSING_HERO');
  if (input.imageCount < 4) warnings.push('WEAK_IMAGE_COUNT');
  if (!input.hasVideoOrTour) warnings.push('MISSING_VIDEO_TOUR');

  if (input.itemType === 'LISTING' && !input.hasFloorPlan) {
    warnings.push('MISSING_FLOOR_PLAN');
  }

  if (input.itemType === 'PROJECT' && !input.hasFloorPlan) {
    warnings.push('MISSING_FLOOR_PLAN');
  }

  return warnings;
}

function formatListingMediaItem(listing: ListingMediaRecord): MediaQueueItem {
  const imageUrls = [listing.image, ...listing.images.map((image) => image.url)];
  const imageCount = countUniqueImages(imageUrls);
  const thumbnailUrl = getFirstImage(imageUrls);
  const hasMainImage = hasValue(listing.image);
  const hasVideoOrTour =
    hasValue(listing.videoWalkthroughUrl) ||
    hasValue(listing.tour360Url) ||
    hasValue(listing.virtualTourUrl);
  const hasFloorPlan = hasValue(listing.floorPlanUrl);

  return {
    id: listing.id,
    itemType: 'LISTING',
    title: listing.titleEn || listing.titleAr || listing.title || 'Listing',
    slug: listing.slug,
    owner: listing.owner,
    status: listing.status,
    mediaQualityStatus: listing.mediaQualityStatus,
    mediaQualityNotes: listing.mediaQualityNotes,
    enhancementStatus: listing.enhancementStatus,
    enhancementNotes: listing.enhancementNotes,
    imageCount,
    hasMainImage,
    hasVideoOrTour,
    hasFloorPlan,
    thumbnailUrl,
    warnings: getReviewWarnings({
      itemType: 'LISTING',
      imageCount,
      hasMainImage,
      hasVideoOrTour,
      hasFloorPlan
    }),
    updatedAt: listing.updatedAt.toISOString(),
    publicPath: `/listings/${listing.slug}`
  };
}

function formatActivityMediaItem(activity: ActivityMediaRecord): MediaQueueItem {
  const imageUrls = activity.images.map((image) => image.url);
  const imageCount = countUniqueImages(imageUrls);
  const thumbnailUrl = getFirstImage(imageUrls);
  const hasMainImage = Boolean(thumbnailUrl);
  const hasVideoOrTour =
    hasValue(activity.videoWalkthroughUrl) ||
    hasValue(activity.tour360Url) ||
    hasValue(activity.virtualTourUrl);

  return {
    id: activity.id,
    itemType: 'ACTIVITY',
    title: activity.titleEn || activity.titleAr || 'Activity',
    slug: activity.slug,
    owner: activity.owner,
    status: activity.status,
    mediaQualityStatus: activity.mediaQualityStatus,
    mediaQualityNotes: activity.mediaQualityNotes,
    enhancementStatus: activity.enhancementStatus,
    enhancementNotes: activity.enhancementNotes,
    imageCount,
    hasMainImage,
    hasVideoOrTour,
    hasFloorPlan: false,
    thumbnailUrl,
    warnings: getReviewWarnings({
      itemType: 'ACTIVITY',
      imageCount,
      hasMainImage,
      hasVideoOrTour,
      hasFloorPlan: true
    }),
    updatedAt: activity.updatedAt.toISOString(),
    publicPath: `/activities/${activity.slug}`
  };
}

function formatProjectMediaItem(project: ProjectMediaRecord): MediaQueueItem {
  const imageUrls = [project.image, ...project.images.map((image) => image.url)];
  const imageCount = countUniqueImages(imageUrls);
  const thumbnailUrl = getFirstImage(imageUrls);
  const hasMainImage = hasValue(project.image) || Boolean(thumbnailUrl);
  const hasVideoOrTour = hasValue(project.videoWalkthroughUrl);
  const hasFloorPlan = hasValue(project.masterplanUrl) || hasValue(project.brochureUrl);

  return {
    id: project.id,
    itemType: 'PROJECT',
    title: project.nameEn || project.nameAr || 'Developer project',
    slug: project.slug,
    owner: project.owner,
    status: project.status,
    mediaQualityStatus: project.mediaQualityStatus,
    mediaQualityNotes: project.mediaQualityNotes,
    enhancementStatus: project.enhancementStatus,
    enhancementNotes: project.enhancementNotes,
    imageCount,
    hasMainImage,
    hasVideoOrTour,
    hasFloorPlan,
    thumbnailUrl,
    warnings: getReviewWarnings({
      itemType: 'PROJECT',
      imageCount,
      hasMainImage,
      hasVideoOrTour,
      hasFloorPlan
    }),
    updatedAt: project.updatedAt.toISOString(),
    publicPath: `/developer-projects/${project.slug}`
  };
}

function sortMediaItems(first: MediaQueueItem, second: MediaQueueItem) {
  const statusDiff =
    getStatusPriority(first.mediaQualityStatus) -
    getStatusPriority(second.mediaQualityStatus);

  if (statusDiff !== 0) return statusDiff;

  return (
    new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
}

function filterByWarning(items: MediaQueueItem[], warning?: ReviewWarning) {
  return warning
    ? items.filter((item) => item.warnings.includes(warning))
    : items;
}

mediaQualityRouter.get(
  '/admin/queue',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const query = mediaQueueQuerySchema.parse(req.query);
      const where = {
        ...getMediaWhere(query.mediaQualityStatus),
        ...(query.status
          ? {
              status: query.status
            }
          : {})
      };

      const [listings, activities, projects] = await Promise.all([
        query.itemType && query.itemType !== 'LISTING'
          ? Promise.resolve([])
          : prisma.listing.findMany({
              where,
              select: listingMediaSelect,
              orderBy: {
                updatedAt: 'desc'
              },
              take: query.take + query.skip
            }),

        query.itemType && query.itemType !== 'ACTIVITY'
          ? Promise.resolve([])
          : prisma.activity.findMany({
              where,
              select: activityMediaSelect,
              orderBy: {
                updatedAt: 'desc'
              },
              take: query.take + query.skip
            }),

        query.itemType && query.itemType !== 'PROJECT'
          ? Promise.resolve([])
          : prisma.developerProject.findMany({
              where,
              select: projectMediaSelect,
              orderBy: {
                updatedAt: 'desc'
              },
              take: query.take + query.skip
            })
      ]);

      const filteredItems = filterByWarning(
        [
          ...listings.map(formatListingMediaItem),
          ...activities.map(formatActivityMediaItem),
          ...projects.map(formatProjectMediaItem)
        ].sort(sortMediaItems),
        query.warning
      );

      const items = filteredItems.slice(query.skip, query.skip + query.take);

      res.json({
        items,
        total: filteredItems.length,
        pagination: {
          take: query.take,
          skip: query.skip,
          count: items.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

mediaQualityRouter.patch(
  '/admin/:itemType/:id',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
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

      if (itemType === 'ACTIVITY') {
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

        return;
      }

      const existingProject = await prisma.developerProject.findUnique({
        where: {
          id
        },
        select: {
          id: true
        }
      });

      if (!existingProject) {
        throw new AppError(404, 'Developer project not found');
      }

      const project = await prisma.developerProject.update({
        where: {
          id
        },
        data,
        select: projectMediaSelect
      });

      res.json({
        item: formatProjectMediaItem(project)
      });
    } catch (error) {
      next(error);
    }
  }
);
