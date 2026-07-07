import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { createMediaQualityUpdate } from '../services/mediaQuality';
import { getMediaProvider, isSafeMediaUrl } from '../services/mediaEmbeds';
import {
  createPaginationMetadata,
  resolvePagination
} from '../utils/pagination';
import { requireAuth, requireRole, requireVerifiedEmail } from '../middleware/auth';
import { AppError } from '../utils/http';
import { getLinkedPartnerTier, getManualPartnerTier } from '../utils/partnerTier';
import {
  priceQualifierValues,
  priceUnitValues,
  resolvePriceInput
} from '../utils/pricing';
import {
  buildSearchRelevance,
  getVerificationTrustScore,
  paginateExplicitlySortedIds,
  paginateRankedIds,
  restoreRankedOrder
} from '../utils/searchRanking';
import { slugify } from '../utils/slugify';

export const activitiesRouter = Router();

const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.startsWith('/uploads/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    {
      message: 'Image must be a valid URL or uploaded image path'
    }
  );

const dayNameSchema = z.enum([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]);

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must use HH:mm format'
  });

const activityTravelRegionValues = [
  'INSIDE_OMAN',
  'OUTSIDE_OMAN'
] as const;

const optionalPriceAmountSchema = z
  .preprocess(
    (value) =>
      value === '' ||
      value === null ||
      value === undefined
        ? undefined
        : value,
    z.union([
      z.coerce
        .number()
        .finite()
        .min(0)
        .max(99999999999.999),
      z.undefined()
    ])
  )
  .optional()
  .transform((value) =>
    value === undefined ? undefined : value.toString()
  );

const optionalCurrencySchema = z
  .preprocess(
    (value) =>
      value === '' ||
      value === null ||
      value === undefined
        ? undefined
        : value,
    z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional()
  )
  .optional();

const optionalTrimmedString = (max: number) =>
  z
    .preprocess(
      (value) =>
        value === '' ||
        value === null ||
        value === undefined
          ? undefined
          : value,
      z.string().trim().max(max).optional()
    )
    .optional();

const optionalSafeMediaUrlSchema = z
  .preprocess(
    (value) =>
      value === '' || value === null || value === undefined
        ? undefined
        : value,
    z
      .string()
      .trim()
      .max(1000)
      .refine((value) => isSafeMediaUrl(value), {
        message: 'Media URL must be an uploaded file path or a supported media URL'
      })
      .optional()
  )
  .optional();

const mediaAssetTypeValues = [
  'IMAGE',
  'VIDEO_WALKTHROUGH',
  'TOUR_360',
  'VIRTUAL_TOUR',
  'FLOOR_PLAN',
  'DOCUMENT',
  'OTHER'
] as const;

const verificationStatusValues = [
  'UNVERIFIED',
  'SUBMITTED',
  'ADMIN_VERIFIED',
  'EXTERNALLY_VERIFIED',
  'REJECTED',
  'EXPIRED'
] as const;

const premiumMediaInputSchema = z
  .object({
    type: z.enum(mediaAssetTypeValues),
    url: z
      .string()
      .trim()
      .max(1000)
      .refine((value) => isSafeMediaUrl(value), {
        message: 'Premium media URL must be an uploaded file path or supported media URL'
      }),
    provider: optionalTrimmedString(120),
    titleEn: optionalTrimmedString(160),
    titleAr: optionalTrimmedString(160),
    altEn: optionalTrimmedString(160),
    altAr: optionalTrimmedString(160),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isPrimary: z.coerce.boolean().default(false)
  })
  .strict();

const optionalPositiveIntSchema = (max = 365) =>
  z
    .preprocess(
      (value) =>
        value === '' ||
        value === null ||
        value === undefined
          ? undefined
          : value,
      z.union([
        z.coerce.number().int().positive().max(max),
        z.undefined()
      ])
    )
    .optional();

const activityCreateSchema = z
  .object({
    titleEn: z.string().trim().min(3).max(140),
    titleAr: optionalTrimmedString(140),
    descriptionEn: z.string().trim().min(20).max(4000),
    descriptionAr: optionalTrimmedString(4000),
    locationEn: z.string().trim().min(2).max(160),
    locationAr: optionalTrimmedString(160),
    categoryEn: z.string().trim().min(2).max(80),
    categoryAr: optionalTrimmedString(80),

    travelAgencyId: optionalTrimmedString(120),

    providerEn: optionalTrimmedString(120),
    providerAr: optionalTrimmedString(120),

    price: optionalTrimmedString(80),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),

    durationMinutes: z.coerce.number().int().positive().max(10080).optional(),
    durationLabelEn: optionalTrimmedString(80),
    durationLabelAr: optionalTrimmedString(80),
    durationType: z.enum(['Short', 'Half day', 'Full day', 'Overnight']).optional(),
    groupSize: optionalTrimmedString(80),
    capacity: optionalPositiveIntSchema(10000),
    language: optionalTrimmedString(80),
    difficulty: optionalTrimmedString(80),
    activityType: optionalTrimmedString(80),
    travelRegion: z.enum(activityTravelRegionValues).default('INSIDE_OMAN'),

    destinationCountry: optionalTrimmedString(120),
    destinationCity: optionalTrimmedString(120),
    departureCity: optionalTrimmedString(120),

    tripDurationDays: optionalPositiveIntSchema(365),
    tripDurationNights: optionalPositiveIntSchema(365),

    flightIncluded: z.coerce.boolean().default(false),
    airline: optionalTrimmedString(120),
    flightNotes: optionalTrimmedString(1000),

    hotelIncluded: z.coerce.boolean().default(false),
    hotelName: optionalTrimmedString(160),
    hotelRating: optionalPositiveIntSchema(7),
    roomType: optionalTrimmedString(120),
    mealPlan: optionalTrimmedString(80),

    visaSupportIncluded: z.coerce.boolean().default(false),
    travelInsuranceIncluded: z.coerce.boolean().default(false),
    airportTransferIncluded: z.coerce.boolean().default(false),

    packageItinerary: optionalTrimmedString(4000),
    requiredDocuments: optionalTrimmedString(2000),
    cancellationPolicy: optionalTrimmedString(2000),
    availableTravelDates: optionalTrimmedString(1000),
    minimumGroupSize: optionalPositiveIntSchema(10000),
    packageInclusions: optionalTrimmedString(2000),
    packageExclusions: optionalTrimmedString(2000),

    availabilityDays: z.array(dayNameSchema).max(7).default([]),
    availabilityStartTime: timeSchema.optional(),
    availabilityEndTime: timeSchema.optional(),

    familyFriendly: z.coerce.boolean().default(false),
    includesTransfer: z.coerce.boolean().default(false),
    mealIncluded: z.coerce.boolean().default(false),
    outdoor: z.coerce.boolean().default(false),

    videoWalkthroughUrl: optionalSafeMediaUrlSchema,
    tour360Url: optionalSafeMediaUrlSchema,
    virtualTourUrl: optionalSafeMediaUrlSchema,
    premiumMedia: z.array(premiumMediaInputSchema).max(20).default([]),

    nearestLandmarkId: optionalTrimmedString(120),
    distanceFromLandmarkEn: optionalTrimmedString(120),
    distanceFromLandmarkAr: optionalTrimmedString(120),

    images: z
      .array(
        z.object({
          url: imageUrlSchema,
          altEn: optionalTrimmedString(160),
          altAr: optionalTrimmedString(160),
          sortOrder: z.coerce.number().int().min(0).default(0)
        })
      )
      .max(20)
      .default([]),

    highlights: z
      .array(
        z.object({
          textEn: z.string().trim().min(1).max(160),
          textAr: optionalTrimmedString(160)
        })
      )
      .max(20)
      .default([])
  })
  .strict()
  .superRefine((data, context) => {
    const hasStructuredPrice =
      data.priceAmount !== undefined ||
      data.priceCurrency !== undefined ||
      data.priceQualifier !== undefined ||
      data.priceUnit !== undefined;

    if (data.travelRegion === 'OUTSIDE_OMAN') {
      if (!data.destinationCountry) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationCountry'],
          message: 'Destination country is required for outside-Oman packages'
        });
      }

      if (!data.destinationCity) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationCity'],
          message: 'Destination city is required for outside-Oman packages'
        });
      }

      if (data.tripDurationDays === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tripDurationDays'],
          message: 'Trip duration is required for outside-Oman packages'
        });
      }
    }

    if (!data.price && !hasStructuredPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'A display or structured price is required'
      });
    }

    if (
      data.priceQualifier === 'ON_REQUEST' &&
      data.priceAmount !== undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceAmount'],
        message: 'On-request pricing cannot include an amount'
      });
    }

    if (
      hasStructuredPrice &&
      data.priceQualifier !== 'ON_REQUEST' &&
      data.priceAmount === undefined &&
      !data.price
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceAmount'],
        message: 'A numeric amount is required for this price type'
      });
    }
  });


const activityUpdateSchema = z
  .object({
    titleEn: z.string().trim().min(3).max(140).optional(),
    titleAr: optionalTrimmedString(140),
    descriptionEn: z.string().trim().min(20).max(4000).optional(),
    descriptionAr: optionalTrimmedString(4000),
    locationEn: z.string().trim().min(2).max(160).optional(),
    locationAr: optionalTrimmedString(160),
    categoryEn: z.string().trim().min(2).max(80).optional(),
    categoryAr: optionalTrimmedString(80),

    travelAgencyId: optionalTrimmedString(120),
    providerEn: optionalTrimmedString(120),
    providerAr: optionalTrimmedString(120),

    price: optionalTrimmedString(80),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),

    durationMinutes: z.coerce.number().int().positive().max(10080).optional(),
    durationLabelEn: optionalTrimmedString(80),
    durationLabelAr: optionalTrimmedString(80),
    durationType: z.enum(['Short', 'Half day', 'Full day', 'Overnight']).optional(),
    groupSize: optionalTrimmedString(80),
    capacity: optionalPositiveIntSchema(10000),
    language: optionalTrimmedString(80),
    difficulty: optionalTrimmedString(80),
    activityType: optionalTrimmedString(80),
    travelRegion: z.enum(activityTravelRegionValues).optional(),

    destinationCountry: optionalTrimmedString(120),
    destinationCity: optionalTrimmedString(120),
    departureCity: optionalTrimmedString(120),
    tripDurationDays: optionalPositiveIntSchema(365),
    tripDurationNights: optionalPositiveIntSchema(365),

    flightIncluded: z.coerce.boolean().optional(),
    airline: optionalTrimmedString(120),
    flightNotes: optionalTrimmedString(1000),

    hotelIncluded: z.coerce.boolean().optional(),
    hotelName: optionalTrimmedString(160),
    hotelRating: optionalPositiveIntSchema(7),
    roomType: optionalTrimmedString(120),
    mealPlan: optionalTrimmedString(80),

    visaSupportIncluded: z.coerce.boolean().optional(),
    travelInsuranceIncluded: z.coerce.boolean().optional(),
    airportTransferIncluded: z.coerce.boolean().optional(),

    packageItinerary: optionalTrimmedString(4000),
    requiredDocuments: optionalTrimmedString(2000),
    cancellationPolicy: optionalTrimmedString(2000),
    availableTravelDates: optionalTrimmedString(1000),
    minimumGroupSize: optionalPositiveIntSchema(10000),
    packageInclusions: optionalTrimmedString(2000),
    packageExclusions: optionalTrimmedString(2000),

    availabilityDays: z.array(dayNameSchema).max(7).optional(),
    availabilityStartTime: timeSchema.optional(),
    availabilityEndTime: timeSchema.optional(),

    familyFriendly: z.coerce.boolean().optional(),
    includesTransfer: z.coerce.boolean().optional(),
    mealIncluded: z.coerce.boolean().optional(),
    outdoor: z.coerce.boolean().optional(),

    videoWalkthroughUrl: optionalSafeMediaUrlSchema,
    tour360Url: optionalSafeMediaUrlSchema,
    virtualTourUrl: optionalSafeMediaUrlSchema,
    premiumMedia: z.array(premiumMediaInputSchema).max(20).optional(),

    nearestLandmarkId: optionalTrimmedString(120),
    distanceFromLandmarkEn: optionalTrimmedString(120),
    distanceFromLandmarkAr: optionalTrimmedString(120),

    images: z
      .array(
        z.object({
          url: imageUrlSchema,
          altEn: optionalTrimmedString(160),
          altAr: optionalTrimmedString(160),
          sortOrder: z.coerce.number().int().min(0).default(0)
        })
      )
      .max(20)
      .optional(),

    highlights: z
      .array(
        z.object({
          textEn: z.string().trim().min(1).max(160),
          textAr: optionalTrimmedString(160)
        })
      )
      .max(20)
      .optional()
  })
  .strict();

type ActivityUpdateData = z.infer<typeof activityUpdateSchema>;

const sensitiveActivityUpdateKeys = [
  'titleEn',
  'titleAr',
  'descriptionEn',
  'descriptionAr',
  'locationEn',
  'locationAr',
  'categoryEn',
  'categoryAr',
  'travelAgencyId',
  'providerEn',
  'providerAr',
  'travelRegion',
  'destinationCountry',
  'destinationCity',
  'departureCity',
  'packageItinerary',
  'requiredDocuments',
  'cancellationPolicy',
  'packageInclusions',
  'packageExclusions',
  'nearestLandmarkId',
  'distanceFromLandmarkEn',
  'distanceFromLandmarkAr'
] as const;

function hasSensitiveActivityUpdate(data: ActivityUpdateData) {
  return sensitiveActivityUpdateKeys.some((key) => hasOwnProperty(data, key));
}

const optionalBooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;

    return value === true || value === 'true';
  });

const activitiesQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    difficulty: z.string().trim().optional(),
    location: z.string().trim().optional(),
    nearestLandmarkId: z.string().trim().optional(),
    travelAgencyId: z.string().trim().optional(),

    availableDay: dayNameSchema.optional(),
    availableFrom: timeSchema.optional(),
    availableUntil: timeSchema.optional(),

    durationType: z.enum(['Short', 'Half day', 'Full day', 'Overnight']).optional(),
    activityType: z.enum(['Private', 'Group', 'Both']).optional(),
    travelRegion: z.enum(activityTravelRegionValues).optional(),

    familyFriendly: optionalBooleanQuerySchema,
    includesTransfer: optionalBooleanQuerySchema,
    mealIncluded: optionalBooleanQuerySchema,
    outdoor: optionalBooleanQuerySchema,
    featured: optionalBooleanQuerySchema,
    verificationStatus: z.enum(verificationStatusValues).optional(),
    verifiedOnly: optionalBooleanQuerySchema,

    price: z.string().trim().optional(),
    minPrice: z.coerce.number().finite().min(0).optional(),
    maxPrice: z.coerce.number().finite().min(0).optional(),
    priceCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),

    sort: z
      .enum([
        'recommended',
        'newest',
        'price_asc',
        'price_desc'
      ])
      .default('recommended'),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),

    take: z.coerce.number().int().min(1).max(100).default(50),
    skip: z.coerce.number().int().min(0).default(0)
  })
  .superRefine((data, context) => {
    if (
      data.minPrice !== undefined &&
      data.maxPrice !== undefined &&
      data.minPrice > data.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxPrice'],
        message: 'Maximum price must be greater than or equal to minimum price'
      });
    }
  });

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
});

const statusSchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    rejectedReason: z.string().trim().max(1000).optional()
  })
  .strict();

const activityInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  travelAgency: true,
  nearestLandmark: true,
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  premiumMedia: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  verificationReviewedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  },
  highlights: true
};

function hasOwnProperty<T extends object, K extends PropertyKey>(
  object: T,
  key: K
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}


function normalizeRelatedText(value?: string | null) {
  return value?.toLowerCase().trim() ?? '';
}

function hasRelatedTextMatch(
  candidateValue?: string | null,
  currentValue?: string | null
) {
  const candidate = normalizeRelatedText(candidateValue);
  const current = normalizeRelatedText(currentValue);

  return Boolean(candidate && current && candidate === current);
}

function getRelatedNumber(value?: { toString(): string } | string | number | null) {
  if (value === null || value === undefined) return null;

  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? parsed : null;
}

function getRelatedPriceScore(
  currentPrice?: { toString(): string } | string | number | null,
  candidatePrice?: { toString(): string } | string | number | null
) {
  const current = getRelatedNumber(currentPrice);
  const candidate = getRelatedNumber(candidatePrice);

  if (current === null || candidate === null || current <= 0) return 0;

  const differenceRatio = Math.abs(current - candidate) / current;

  if (differenceRatio <= 0.15) return 3;
  if (differenceRatio <= 0.3) return 2;
  if (differenceRatio <= 0.5) return 1;

  return 0;
}

function getRelatedActivityScore(
  current: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>,
  candidate: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>
) {
  let score = 0;

  if (current.travelAgencyId && candidate.travelAgencyId === current.travelAgencyId) {
    score += 7;
  }

  if (
    current.nearestLandmarkId &&
    candidate.nearestLandmarkId === current.nearestLandmarkId
  ) {
    score += 5;
  }

  if (candidate.travelRegion === current.travelRegion) score += 5;

  if (
    hasRelatedTextMatch(candidate.categoryEn, current.categoryEn) ||
    hasRelatedTextMatch(candidate.categoryAr, current.categoryAr)
  ) {
    score += 4;
  }

  if (
    hasRelatedTextMatch(candidate.locationEn, current.locationEn) ||
    hasRelatedTextMatch(candidate.locationAr, current.locationAr)
  ) {
    score += 4;
  }

  if (
    current.travelRegion === 'OUTSIDE_OMAN' &&
    hasRelatedTextMatch(candidate.destinationCountry, current.destinationCountry)
  ) {
    score += 4;
  }

  if (
    current.travelRegion === 'OUTSIDE_OMAN' &&
    hasRelatedTextMatch(candidate.destinationCity, current.destinationCity)
  ) {
    score += 3;
  }

  if (candidate.activityType && candidate.activityType === current.activityType) score += 2;
  if (candidate.difficulty && candidate.difficulty === current.difficulty) score += 2;
  if (candidate.durationType && candidate.durationType === current.durationType) score += 1;

  if (candidate.familyFriendly === current.familyFriendly) score += 1;
  if (candidate.outdoor === current.outdoor) score += 1;
  if (candidate.includesTransfer === current.includesTransfer) score += 1;
  if (candidate.mealIncluded === current.mealIncluded) score += 1;

  score += getRelatedPriceScore(current.priceAmount, candidate.priceAmount);

  const currentHighlights = new Set(
    current.highlights.map((highlight) =>
      normalizeRelatedText(highlight.textEn || highlight.textAr)
    )
  );

  const sharedHighlightCount = candidate.highlights.filter((highlight) =>
    currentHighlights.has(normalizeRelatedText(highlight.textEn || highlight.textAr))
  ).length;

  score += Math.min(sharedHighlightCount, 3);
  score += candidate.partnerTier;
  score += getVerificationTrustScore(candidate.verificationStatus);
  score += candidate.mediaQualityStatus === 'EXCELLENT' ? 2 : 0;
  score += candidate.mediaQualityStatus === 'ACCEPTABLE' ? 1 : 0;

  return score;
}

function createPremiumMediaData(
  premiumMedia: z.infer<typeof premiumMediaInputSchema>[]
) {
  return premiumMedia.map((media) => ({
    type: media.type,
    url: media.url,
    provider: media.provider ?? getMediaProvider(media.url) ?? null,
    titleEn: media.titleEn,
    titleAr: media.titleAr,
    altEn: media.altEn,
    altAr: media.altAr,
    sortOrder: media.sortOrder,
    isPrimary: media.isPrimary
  }));
}

function createActivityMediaQualityInput(data: {
  image?: string | null;
  images?: Array<{ url?: string | null }>;
  videoWalkthroughUrl?: string | null;
  tour360Url?: string | null;
  virtualTourUrl?: string | null;
  category?: string | null;
}) {
  return {
    mainImage: data.image,
    images: data.images,
    videoWalkthroughUrl: data.videoWalkthroughUrl,
    tour360Url: data.tour360Url,
    virtualTourUrl: data.virtualTourUrl,
    activityType: data.category
  };
}


const activeAvailabilityBookingStatuses = [
  'PENDING',
  'OWNER_APPROVED',
  'ADMIN_CONFIRMED'
] as const;

const activityAvailabilityQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Date must use YYYY-MM-DD format'
    }),
  time: timeSchema.optional(),
  guests: z.coerce.number().int().min(1).max(100).default(1)
});

const availabilityDayNames = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
] as const;

function toAvailabilityDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'Invalid availability date');
  }

  return date;
}

function getAvailabilityDayName(date: Date) {
  return availabilityDayNames[date.getUTCDay()];
}

function getAvailabilityDayRange(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start,
    end
  };
}

function availabilityTimeToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');

  return Number(hours) * 60 + Number(minutes);
}

function getActivityScheduleUnavailableReason(
  activity: {
    availabilityDays: string[];
    availabilityStartTime: string | null;
    availabilityEndTime: string | null;
  },
  date: Date,
  time?: string
) {
  if (activity.availabilityDays.length > 0) {
    const requestedDay = getAvailabilityDayName(date);

    if (!activity.availabilityDays.includes(requestedDay)) {
      return 'Activity is not available on the selected date';
    }
  }

  if (time && activity.availabilityStartTime && activity.availabilityEndTime) {
    const requestedTime = availabilityTimeToMinutes(time);
    const startTime = availabilityTimeToMinutes(activity.availabilityStartTime);
    const endTime = availabilityTimeToMinutes(activity.availabilityEndTime);

    if (requestedTime < startTime || requestedTime > endTime) {
      return 'Preferred time is outside the activity availability window';
    }
  }

  return '';
}


activitiesRouter.get('/:id/availability', async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const query = activityAvailabilityQuerySchema.parse(req.query);
    const scheduledDate = toAvailabilityDate(query.date);

    const activity = await prisma.activity.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        status: true,
        capacity: true,
        availabilityDays: true,
        availabilityStartTime: true,
        availabilityEndTime: true
      }
    });

    if (!activity || activity.status !== 'APPROVED') {
      throw new AppError(404, 'Activity not found');
    }

    const scheduleUnavailableReason = getActivityScheduleUnavailableReason(
      activity,
      scheduledDate,
      query.time
    );

    const { start, end } = getAvailabilityDayRange(scheduledDate);

    const existingBookings = activity.capacity
      ? await prisma.booking.findMany({
          where: {
            activityId: activity.id,
            status: {
              in: [...activeAvailabilityBookingStatuses]
            },
            scheduledDate: {
              gte: start,
              lt: end
            },
            preferredTime: query.time ?? null
          },
          select: {
            guests: true
          }
        })
      : [];

    const reservedGuests = existingBookings.reduce(
      (total, booking) => total + booking.guests,
      0
    );

    const availableGuests =
      activity.capacity === null ? null : Math.max(activity.capacity - reservedGuests, 0);

    const capacityUnavailableReason =
      availableGuests !== null && query.guests > availableGuests
        ? 'Not enough availability for the selected date and time'
        : '';

    res.json({
      availability: {
        activityId: activity.id,
        date: query.date,
        time: query.time ?? null,
        requestedGuests: query.guests,
        capacity: activity.capacity,
        reservedGuests,
        availableGuests,
        available: !scheduleUnavailableReason && !capacityUnavailableReason,
        unavailableReason: scheduleUnavailableReason || capacityUnavailableReason || null
      }
    });
  } catch (error) {
    next(error);
  }
});

function decimalLikeToNumber(
  value: Prisma.Decimal | string | number | null | undefined
) {
  if (value === null || value === undefined) return null;

  const numberValue =
    typeof value === 'number' ? value : Number(value.toString());

  return Number.isFinite(numberValue) ? numberValue : null;
}

type SavedSearchRecord = {
  id: string;
  name: string;
  userId: string;
  category?: string | null;
  query?: string | null;
  filters: unknown;
  lastMatchedAt?: Date | null;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getFilterText(filters: Record<string, unknown>, key: string) {
  const value = filters[key];

  return typeof value === 'string' ? value.trim() : '';
}

function getFilterNumber(filters: Record<string, unknown>, key: string) {
  const value = filters[key];

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getFilterBoolean(filters: Record<string, unknown>, key: string) {
  const value = filters[key];

  return value === true || value === 'true' || value === '1';
}

function textIncludes(value: unknown, needle: string) {
  if (!needle) return true;

  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function getActivitySearchText(activity: {
  titleEn?: string | null;
  titleAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  locationEn?: string | null;
  locationAr?: string | null;
  categoryEn?: string | null;
  categoryAr?: string | null;
  providerEn?: string | null;
  providerAr?: string | null;
  destinationCountry?: string | null;
  destinationCity?: string | null;
  departureCity?: string | null;
  travelRegion?: string | null;
  travelAgency?: {
    nameEn?: string | null;
    nameAr?: string | null;
    slug?: string | null;
  } | null;
  nearestLandmark?: {
    nameEn?: string | null;
    nameAr?: string | null;
    slug?: string | null;
  } | null;
}) {
  return [
    activity.titleEn,
    activity.titleAr,
    activity.descriptionEn,
    activity.descriptionAr,
    activity.locationEn,
    activity.locationAr,
    activity.categoryEn,
    activity.categoryAr,
    activity.providerEn,
    activity.providerAr,
    activity.destinationCountry,
    activity.destinationCity,
    activity.departureCity,
    activity.travelRegion,
    activity.travelAgency?.nameEn,
    activity.travelAgency?.nameAr,
    activity.travelAgency?.slug,
    activity.nearestLandmark?.nameEn,
    activity.nearestLandmark?.nameAr,
    activity.nearestLandmark?.slug
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasMeaningfulSavedSearchFilters(filters: Record<string, unknown>) {
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'sortBy') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return Boolean(value.trim());

    return false;
  });
}

function savedSearchCategoryMatches(search: SavedSearchRecord, target: 'LISTING' | 'ACTIVITY') {
  if (!search.category) return true;

  const category = search.category.toUpperCase();

  if (target === 'LISTING') {
    return (
      category.includes('LISTING') ||
      category.includes('PROPERTY') ||
      category.includes('REAL_ESTATE')
    );
  }

  return category.includes('ACTIVITY') || category.includes('TRAVEL');
}

function savedSearchQueryMatches(search: SavedSearchRecord, candidateText: string) {
  const query = search.query?.trim();

  if (!query) return true;

  const filters = isPlainRecord(search.filters) ? search.filters : {};

  if (hasMeaningfulSavedSearchFilters(filters)) {
    return true;
  }

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9\u0600-\u06ff]/gi, ''))
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          'with',
          'under',
          'over',
          'near',
          'around',
          'from',
          'for',
          'the',
          'and'
        ].includes(token)
    );

  if (tokens.length === 0) return true;

  return tokens.every((token) => candidateText.includes(token));
}

function activityMatchesSavedSearch(
  activity: {
    id: string;
    ownerId: string;
    titleEn?: string | null;
    titleAr?: string | null;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    locationEn?: string | null;
    locationAr?: string | null;
    categoryEn?: string | null;
    categoryAr?: string | null;
    providerEn?: string | null;
    providerAr?: string | null;
    travelRegion?: string | null;
    verificationStatus?: string | null;
    priceAmount?: Prisma.Decimal | string | number | null;
    capacity?: number | null;
    destinationCountry?: string | null;
    destinationCity?: string | null;
    departureCity?: string | null;
    videoWalkthroughUrl?: string | null;
    tour360Url?: string | null;
    virtualTourUrl?: string | null;
    travelAgency?: {
      id?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      slug?: string | null;
    } | null;
    nearestLandmark?: {
      id?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      slug?: string | null;
    } | null;
  },
  search: SavedSearchRecord
) {
  if (!savedSearchCategoryMatches(search, 'ACTIVITY')) return false;

  const filters = isPlainRecord(search.filters) ? search.filters : {};
  const candidateText = getActivitySearchText(activity);

  if (!savedSearchQueryMatches(search, candidateText)) return false;

  const category = getFilterText(filters, 'category') || getFilterText(filters, 'activityType');
  if (
    category &&
    category !== 'All' &&
    ![activity.categoryEn, activity.categoryAr].some((value) =>
      textIncludes(value, category)
    )
  ) {
    return false;
  }

  const travelRegion = getFilterText(filters, 'travelRegion');
  if (travelRegion && activity.travelRegion !== travelRegion) return false;

  const location = getFilterText(filters, 'location');
  if (
    location &&
    ![
      activity.locationEn,
      activity.locationAr,
      activity.destinationCountry,
      activity.destinationCity,
      activity.departureCity,
      activity.nearestLandmark?.nameEn,
      activity.nearestLandmark?.nameAr
    ].some((value) => textIncludes(value, location))
  ) {
    return false;
  }

  const minGuests = getFilterNumber(filters, 'minGuests');
  if (minGuests !== null && activity.capacity !== null && activity.capacity !== undefined) {
    if (activity.capacity < minGuests) return false;
  }

  const minPrice = getFilterNumber(filters, 'minPrice');
  const maxPrice = getFilterNumber(filters, 'maxPrice');
  const price = decimalLikeToNumber(activity.priceAmount);

  if (minPrice !== null && (price === null || price < minPrice)) return false;
  if (maxPrice !== null && (price === null || price > maxPrice)) return false;

  if (
    getFilterBoolean(filters, 'hasVirtualTour') &&
    !activity.virtualTourUrl &&
    !activity.tour360Url &&
    !activity.videoWalkthroughUrl
  ) {
    return false;
  }

  if (
    getFilterBoolean(filters, 'verifiedOnly') &&
    getVerificationTrustScore(activity.verificationStatus) <= 0
  ) {
    return false;
  }

  return true;
}

async function notifySavedSearchMatchesForActivity({
  activity,
  actorId
}: {
  activity: {
    id: string;
    ownerId: string;
    titleEn?: string | null;
    titleAr?: string | null;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    locationEn?: string | null;
    locationAr?: string | null;
    categoryEn?: string | null;
    categoryAr?: string | null;
    providerEn?: string | null;
    providerAr?: string | null;
    travelRegion?: string | null;
    priceAmount?: Prisma.Decimal | string | number | null;
    capacity?: number | null;
    destinationCountry?: string | null;
    destinationCity?: string | null;
    departureCity?: string | null;
    videoWalkthroughUrl?: string | null;
    tour360Url?: string | null;
    virtualTourUrl?: string | null;
    travelAgency?: {
      id?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      slug?: string | null;
    } | null;
    nearestLandmark?: {
      id?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      slug?: string | null;
    } | null;
    updatedAt?: Date;
  };
  actorId?: string;
}) {
  const savedSearches = await prisma.savedSearch.findMany({
    where: {
      alertsEnabled: true,
      alertFrequency: {
        not: 'NONE'
      },
      userId: {
        notIn: [activity.ownerId, actorId].filter((id): id is string => Boolean(id))
      }
    },
    select: {
      id: true,
      name: true,
      userId: true,
      category: true,
      query: true,
      filters: true,
      lastMatchedAt: true
    }
  });

  const matchedSearches = savedSearches.filter((search) => {
    if (
      search.lastMatchedAt &&
      activity.updatedAt &&
      activity.updatedAt <= search.lastMatchedAt
    ) {
      return false;
    }

    return activityMatchesSavedSearch(activity, search);
  });

  if (matchedSearches.length === 0) return;

  await prisma.notification.createMany({
    data: matchedSearches.map((search) => ({
      userId: search.userId,
      type: 'SAVED_SEARCH_MATCH',
      title: 'New activity matches your saved search',
      message: `${getActivityNotificationTitle(
        activity
      )} matches "${search.name}".`
    }))
  });

  await prisma.savedSearch.updateMany({
    where: {
      id: {
        in: matchedSearches.map((search) => search.id)
      }
    },
    data: {
      lastMatchedAt: new Date()
    }
  });
}

async function getAdminNotificationUserIds(actorId?: string) {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      ...(actorId
        ? {
            id: {
              not: actorId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  });

  return admins.map((admin) => admin.id);
}

function getActivityNotificationTitle(activity: {
  titleEn?: string | null;
  titleAr?: string | null;
}) {
  return activity.titleEn ?? activity.titleAr ?? 'Activity';
}

function formatActivityStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

async function notifyActivitySubmittedForReview({
  activity,
  actorId
}: {
  activity: {
    id: string;
    titleEn?: string | null;
    titleAr?: string | null;
    ownerId: string;
  };
  actorId: string;
}) {
  const adminIds = await getAdminNotificationUserIds(actorId);

  if (adminIds.length === 0) return;

  await prisma.notification.createMany({
    data: adminIds.map((userId) => ({
      userId,
      type: 'REVIEW_STATUS_UPDATED',
      title: 'Activity awaiting review',
      message: `${getActivityNotificationTitle(
        activity
      )} was submitted or updated and needs admin review.`
    }))
  });
}

async function notifyActivityStatusReviewed({
  activity,
  actorId
}: {
  activity: {
    id: string;
    titleEn?: string | null;
    titleAr?: string | null;
    ownerId: string;
    status: string;
    rejectedReason?: string | null;
  };
  actorId: string;
}) {
  if (activity.ownerId === actorId) return;

  const activityTitle = getActivityNotificationTitle(activity);
  const isRejected = activity.status === 'REJECTED';

  await prisma.notification.create({
    data: {
      userId: activity.ownerId,
      type: 'REVIEW_STATUS_UPDATED',
      title:
        activity.status === 'APPROVED'
          ? 'Activity approved'
          : isRejected
            ? 'Activity rejected'
            : 'Activity status updated',
      message: isRejected
        ? `${activityTitle} was rejected${
            activity.rejectedReason ? `: ${activity.rejectedReason}` : '.'
          }`
        : `${activityTitle} is now ${formatActivityStatus(activity.status)}.`
    }
  });
}

activitiesRouter.get('/', async (req, res, next) => {
  try {
    const query = activitiesQuerySchema.parse(req.query);
    const search = query.search?.trim();
    const activityFilters: Prisma.ActivityWhereInput[] = [];

    if (typeof query.featured === 'boolean') {
      activityFilters.push(
        query.featured
          ? {
              travelAgency: {
                is: {
                  featured: true
                }
              }
            }
          : {
              OR: [
                {
                  travelAgencyId: null
                },
                {
                  travelAgency: {
                    is: {
                      featured: false
                    }
                  }
                }
              ]
            }
      );
    }

    if (query.travelAgencyId) {
      activityFilters.push({
        travelAgencyId: query.travelAgencyId
      });
    }

    if (query.travelRegion) {
      activityFilters.push({
        travelRegion: query.travelRegion
      });
    }

    if (query.category) {
      activityFilters.push({
        OR: [
          {
            categoryEn: {
              contains: query.category,
              mode: 'insensitive'
            }
          },
          {
            categoryAr: {
              contains: query.category,
              mode: 'insensitive'
            }
          }
        ]
      });
    }

    if (query.difficulty) {
      activityFilters.push({
        difficulty: {
          contains: query.difficulty,
          mode: 'insensitive'
        }
      });
    }

    if (query.location) {
      activityFilters.push({
        OR: [
          {
            locationEn: {
              contains: query.location,
              mode: 'insensitive'
            }
          },
          {
            locationAr: {
              contains: query.location,
              mode: 'insensitive'
            }
          },
          {
            nearestLandmark: {
              is: {
                OR: [
                  {
                    nameEn: {
                      contains: query.location,
                      mode: 'insensitive'
                    }
                  },
                  {
                    nameAr: {
                      contains: query.location,
                      mode: 'insensitive'
                    }
                  }
                ]
              }
            }
          }
        ]
      });
    }

    if (query.nearestLandmarkId) {
      activityFilters.push({
        nearestLandmarkId: query.nearestLandmarkId
      });
    }

    if (query.availableDay) {
      activityFilters.push({
        OR: [
          {
            availabilityDays: {
              has: query.availableDay
            }
          },
          {
            availabilityDays: {
              isEmpty: true
            }
          }
        ]
      });
    }

    if (query.availableFrom) {
      const startTimeFilters: Prisma.ActivityWhereInput[] = [
        {
          availabilityStartTime: {
            gte: query.availableFrom
          }
        }
      ];

      if (query.availableFrom <= '09:00') {
        startTimeFilters.push({
          availabilityStartTime: null
        });
      }

      activityFilters.push({
        OR: startTimeFilters
      });
    }

    if (query.availableUntil) {
      const endTimeFilters: Prisma.ActivityWhereInput[] = [
        {
          availabilityEndTime: {
            lte: query.availableUntil
          }
        }
      ];

      if (query.availableUntil >= '18:00') {
        endTimeFilters.push({
          availabilityEndTime: null
        });
      }

      activityFilters.push({
        OR: endTimeFilters
      });
    }

    if (query.durationType) {
      activityFilters.push(
        query.durationType === 'Short'
          ? {
              OR: [
                {
                  durationType: 'Short'
                },
                {
                  durationType: null
                }
              ]
            }
          : {
              durationType: query.durationType
            }
      );
    }

    if (query.activityType) {
      if (query.activityType === 'Both') {
        activityFilters.push({
          activityType: 'Both'
        });
      } else if (query.activityType === 'Private') {
        activityFilters.push({
          OR: [
            {
              activityType: {
                in: ['Private', 'Both']
              }
            },
            {
              activityType: null
            }
          ]
        });
      } else {
        activityFilters.push({
          activityType: {
            in: ['Group', 'Both']
          }
        });
      }
    }

    if (query.familyFriendly === true) {
      activityFilters.push({
        familyFriendly: true
      });
    }

    if (query.includesTransfer === true) {
      activityFilters.push({
        includesTransfer: true
      });
    }

    if (query.mealIncluded === true) {
      activityFilters.push({
        mealIncluded: true
      });
    }

    if (query.outdoor === true) {
      activityFilters.push({
        outdoor: true
      });
    }

    if (query.price) {
      activityFilters.push({
        price: {
          contains: query.price,
          mode: 'insensitive'
        }
      });
    }

    if (
      query.minPrice !== undefined ||
      query.maxPrice !== undefined
    ) {
      activityFilters.push({
        priceAmount: {
          ...(query.minPrice !== undefined
            ? { gte: query.minPrice }
            : {}),
          ...(query.maxPrice !== undefined
            ? { lte: query.maxPrice }
            : {})
        }
      });
    }

    if (query.priceCurrency) {
      activityFilters.push({
        priceCurrency: query.priceCurrency
      });
    }

    if (query.priceQualifier) {
      activityFilters.push({
        priceQualifier: query.priceQualifier
      });
    }

    if (query.priceUnit) {
      activityFilters.push({
        priceUnit: query.priceUnit
      });
    }

    if (query.verifiedOnly) {
      activityFilters.push({
        verificationStatus: {
          in: ['ADMIN_VERIFIED', 'EXTERNALLY_VERIFIED']
        }
      });
    } else if (query.verificationStatus) {
      activityFilters.push({
        verificationStatus: query.verificationStatus
      });
    }

    if (search) {
      activityFilters.push({
        OR: [
          {
            titleEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            titleAr: {
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
            locationEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            locationAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            categoryEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            categoryAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            providerEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            providerAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            price: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            durationLabelEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            durationLabelAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            durationType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            activityType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            groupSize: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            difficulty: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            language: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            destinationCountry: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            destinationCity: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            departureCity: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            airline: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            hotelName: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            roomType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            mealPlan: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            packageItinerary: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            requiredDocuments: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            cancellationPolicy: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            availableTravelDates: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            packageInclusions: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            packageExclusions: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            travelAgency: {
              is: {
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
                  }
                ]
              }
            }
          },
          {
            nearestLandmark: {
              is: {
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
                  }
                ]
              }
            }
          },
          {
            highlights: {
              some: {
                OR: [
                  {
                    textEn: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
                  {
                    textAr: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                ]
              }
            }
          }
        ]
      });
    }

    const activityWhere: Prisma.ActivityWhereInput = {
      status: 'APPROVED',
      AND: activityFilters
    };

    const pagination = resolvePagination(query);
    const total = await prisma.activity.count({
      where: activityWhere
    });

    let activities: Prisma.ActivityGetPayload<{
      include: typeof activityInclude;
    }>[];

    if (query.sort !== 'recommended') {
      const candidates = await prisma.activity.findMany({
        where: activityWhere,
        select: {
          id: true,
          price: true,
          priceAmount: true,
          partnerTier: true,
          verificationStatus: true,
          createdAt: true
        }
      });

      const orderedIds = paginateExplicitlySortedIds(
        candidates.map((candidate) => ({
          id: candidate.id,
          price:
            candidate.priceAmount?.toString() ??
            candidate.price,
          partnerTier: candidate.partnerTier,
          trustScore: getVerificationTrustScore(candidate.verificationStatus),
          createdAt: candidate.createdAt
        })),
        query.sort,
        pagination.skip,
        pagination.take
      );

      const explicitlySortedActivities =
        orderedIds.length > 0
          ? await prisma.activity.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: activityInclude
            })
          : [];

      activities = restoreRankedOrder(
        explicitlySortedActivities,
        orderedIds
      );
    } else if (search) {
      const candidates = await prisma.activity.findMany({
        where: activityWhere,
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          descriptionEn: true,
          descriptionAr: true,
          locationEn: true,
          locationAr: true,
          categoryEn: true,
          categoryAr: true,
          providerEn: true,
          providerAr: true,
          price: true,

          durationMinutes: true,
          durationLabelEn: true,
          durationLabelAr: true,
          durationType: true,
          groupSize: true,
          capacity: true,
          language: true,
          difficulty: true,
          activityType: true,
          travelRegion: true,

          destinationCountry: true,
          destinationCity: true,
          departureCity: true,
          tripDurationDays: true,
          tripDurationNights: true,
          airline: true,
          flightNotes: true,
          hotelName: true,
          hotelRating: true,
          roomType: true,
          mealPlan: true,
          packageItinerary: true,
          requiredDocuments: true,
          cancellationPolicy: true,
          availableTravelDates: true,
          minimumGroupSize: true,
          packageInclusions: true,
          packageExclusions: true,

          availabilityDays: true,
          availabilityStartTime: true,
          availabilityEndTime: true,

          familyFriendly: true,
          includesTransfer: true,
          mealIncluded: true,
          outdoor: true,

          verificationStatus: true,

          travelAgencyId: true,
          nearestLandmarkId: true,
          partnerTier: true,
          createdAt: true,

          travelAgency: {
            select: {
              nameEn: true,
              nameAr: true
            }
          },
          nearestLandmark: {
            select: {
              nameEn: true,
              nameAr: true
            }
          },
          highlights: {
            select: {
              textEn: true,
              textAr: true
            }
          },
          images: {
            select: {
              id: true
            }
          }
        }
      });

      const orderedIds = paginateRankedIds(
        candidates.map((candidate) => {
          const relatedSearchValues = [
            candidate.providerEn,
            candidate.providerAr,
            candidate.travelAgency?.nameEn,
            candidate.travelAgency?.nameAr,
            candidate.nearestLandmark?.nameEn,
            candidate.nearestLandmark?.nameAr,
            candidate.verificationStatus,
            ...candidate.highlights.flatMap((highlight) => [
              highlight.textEn,
              highlight.textAr
            ])
          ];

          const packageSearchValues = [
            candidate.destinationCountry,
            candidate.destinationCity,
            candidate.departureCity,
            candidate.airline,
            candidate.flightNotes,
            candidate.hotelName,
            candidate.roomType,
            candidate.mealPlan,
            candidate.packageItinerary,
            candidate.requiredDocuments,
            candidate.cancellationPolicy,
            candidate.availableTravelDates,
            candidate.packageInclusions,
            candidate.packageExclusions
          ];

          const qualityScore =
            Math.min(candidate.images.length, 3) * 2 +
            Math.min(candidate.highlights.length, 5) +
            Number(candidate.descriptionEn.trim().length >= 80) +
            Number(Boolean(candidate.titleAr)) +
            Number(Boolean(candidate.descriptionAr)) +
            Number(Boolean(candidate.locationAr)) +
            Number(Boolean(candidate.categoryAr)) +
            Number(Boolean(candidate.durationMinutes)) +
            Number(Boolean(candidate.durationLabelEn)) +
            Number(Boolean(candidate.durationLabelAr)) +
            Number(Boolean(candidate.durationType)) +
            Number(Boolean(candidate.groupSize)) +
            Number(Boolean(candidate.language)) +
            Number(Boolean(candidate.difficulty)) +
            Number(Boolean(candidate.activityType)) +
            Number(Boolean(candidate.travelRegion)) +
            Number(candidate.verificationStatus === 'ADMIN_VERIFIED') * 2 +
            Number(candidate.verificationStatus === 'EXTERNALLY_VERIFIED') * 3 +
            Number(Boolean(candidate.destinationCountry)) +
            Number(Boolean(candidate.destinationCity)) +
            Number(Boolean(candidate.departureCity)) +
            Number(Boolean(candidate.tripDurationDays)) +
            Number(Boolean(candidate.tripDurationNights)) +
            Number(Boolean(candidate.airline)) +
            Number(Boolean(candidate.hotelName)) +
            Number(Boolean(candidate.hotelRating)) +
            Number(Boolean(candidate.roomType)) +
            Number(Boolean(candidate.mealPlan)) +
            Number(Boolean(candidate.packageItinerary)) +
            Number(Boolean(candidate.requiredDocuments)) +
            Number(Boolean(candidate.cancellationPolicy)) +
            Number(Boolean(candidate.availableTravelDates)) +
            Number(Boolean(candidate.minimumGroupSize)) +
            Number(Boolean(candidate.packageInclusions)) +
            Number(Boolean(candidate.packageExclusions)) +
            Number(candidate.availabilityDays.length > 0) +
            Number(Boolean(candidate.availabilityStartTime)) +
            Number(Boolean(candidate.availabilityEndTime)) +
            Number(Boolean(candidate.nearestLandmarkId)) +
            Number(
              Boolean(
                candidate.travelAgencyId ||
                  candidate.providerEn ||
                  candidate.providerAr
              )
            );

          return {
            id: candidate.id,
            relevance: buildSearchRelevance(search, [
              [
                candidate.titleEn,
                candidate.titleAr
              ],
              [
                candidate.categoryEn,
                candidate.categoryAr,
                candidate.locationEn,
                candidate.locationAr,
                candidate.price,
                candidate.durationLabelEn,
                candidate.durationLabelAr,
                candidate.durationType,
                candidate.activityType,
                candidate.travelRegion,
                candidate.groupSize,
                candidate.difficulty,
                candidate.language,
                candidate.destinationCountry,
                candidate.destinationCity,
                candidate.departureCity
              ],
              [
                ...relatedSearchValues,
                ...packageSearchValues
              ],
              [
                candidate.descriptionEn,
                candidate.descriptionAr
              ]
            ]),
            partnerTier: candidate.partnerTier,
            trustScore: getVerificationTrustScore(candidate.verificationStatus),
            qualityScore,
            createdAt: candidate.createdAt
          };
        }),
        pagination.skip,
        pagination.take
      );

      const rankedActivities =
        orderedIds.length > 0
          ? await prisma.activity.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: activityInclude
            })
          : [];

      activities = restoreRankedOrder(
        rankedActivities,
        orderedIds
      );
    } else {
      const candidates = await prisma.activity.findMany({
        where: activityWhere,
        select: {
          id: true,
          partnerTier: true,
          verificationStatus: true,
          createdAt: true
        }
      });

      const orderedIds = paginateRankedIds(
        candidates.map((candidate) => ({
          id: candidate.id,
          relevance: [],
          partnerTier: candidate.partnerTier,
          trustScore: getVerificationTrustScore(candidate.verificationStatus),
          qualityScore: 0,
          createdAt: candidate.createdAt
        })),
        pagination.skip,
        pagination.take
      );

      const trustedActivities =
        orderedIds.length > 0
          ? await prisma.activity.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: activityInclude
            })
          : [];

      activities = restoreRankedOrder(trustedActivities, orderedIds);
    }

    res.json({
      activities,
      pagination: createPaginationMetadata(
        total,
        activities.length,
        pagination
      )
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get(
  '/admin/all',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const query = activitiesQuerySchema.parse(req.query);

      const activities = await prisma.activity.findMany({
        include: activityInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: query.take,
        skip: query.skip
      });

      res.json({
        activities,
        pagination: {
          take: query.take,
          skip: query.skip,
          count: activities.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

activitiesRouter.patch(
  '/admin/:id/status',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = statusSchema.parse(req.body);

      const activity = await prisma.activity.update({
        where: {
          id
        },
        data: {
          status: data.status,
          rejectedReason:
            data.status === 'REJECTED'
              ? data.rejectedReason ?? null
              : null
        },
        include: activityInclude
      });

      await notifyActivityStatusReviewed({
        activity,
        actorId: req.user!.id
      });

      if (activity.status === 'APPROVED') {
        await notifySavedSearchMatchesForActivity({
          activity,
          actorId: req.user!.id
        });
      }

      res.json({
        activity
      });
    } catch (error) {
      next(error);
    }
  }
);


activitiesRouter.patch('/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = activityUpdateSchema.parse(req.body);

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'At least one activity field is required');
    }

    const existingActivity = await prisma.activity.findUnique({
      where: {
        id
      },
      include: {
        images: true
      }
    });

    if (!existingActivity) {
      throw new AppError(404, 'Activity not found');
    }

    if (req.user!.role !== 'ADMIN' && existingActivity.ownerId !== req.user!.id) {
      throw new AppError(403, 'You can only update your own activities');
    }

    const nextTravelRegion = data.travelRegion ?? existingActivity.travelRegion;

    if (nextTravelRegion === 'OUTSIDE_OMAN') {
      const destinationCountry =
        data.destinationCountry ?? existingActivity.destinationCountry;
      const destinationCity = data.destinationCity ?? existingActivity.destinationCity;
      const tripDurationDays =
        data.tripDurationDays ?? existingActivity.tripDurationDays;

      if (!destinationCountry || !destinationCity || !tripDurationDays) {
        throw new AppError(
          400,
          'Destination country, destination city, and trip duration are required for outside-Oman packages'
        );
      }
    }

    const travelAgency = data.travelAgencyId
      ? await prisma.travelAgency.findUnique({
          where: {
            id: data.travelAgencyId
          }
        })
      : null;

    if (data.travelAgencyId && !travelAgency) {
      throw new AppError(400, 'Selected travel agency was not found');
    }

    if (data.travelAgencyId && (data.providerEn || data.providerAr)) {
      throw new AppError(
        400,
        'Choose either a listed travel agency or manual provider details'
      );
    }

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

    const updateData: Prisma.ActivityUpdateInput = {};

    const hasPriceUpdate =
      hasOwnProperty(data, 'price') ||
      hasOwnProperty(data, 'priceAmount') ||
      hasOwnProperty(data, 'priceCurrency') ||
      hasOwnProperty(data, 'priceQualifier') ||
      hasOwnProperty(data, 'priceUnit');

    if (hasPriceUpdate) {
      const resolvedPrice = resolvePriceInput({
        displayPrice: data.price ?? existingActivity.price,
        priceAmount:
          data.priceAmount ?? existingActivity.priceAmount?.toString() ?? undefined,
        priceCurrency:
          data.priceCurrency ?? existingActivity.priceCurrency ?? undefined,
        priceQualifier:
          data.priceQualifier ?? existingActivity.priceQualifier ?? undefined,
        priceUnit: data.priceUnit ?? existingActivity.priceUnit ?? undefined
      });

      updateData.price = resolvedPrice.price;
      updateData.priceAmount = resolvedPrice.priceAmount;
      updateData.priceCurrency = resolvedPrice.priceCurrency;
      updateData.priceQualifier = resolvedPrice.priceQualifier;
      updateData.priceUnit = resolvedPrice.priceUnit;
    }

    const scalarFields = [
      'titleEn',
      'titleAr',
      'descriptionEn',
      'descriptionAr',
      'locationEn',
      'locationAr',
      'categoryEn',
      'categoryAr',
      'providerEn',
      'providerAr',
      'durationMinutes',
      'durationLabelEn',
      'durationLabelAr',
      'durationType',
      'groupSize',
      'capacity',
      'language',
      'difficulty',
      'activityType',
      'travelRegion',
      'destinationCountry',
      'destinationCity',
      'departureCity',
      'tripDurationDays',
      'tripDurationNights',
      'flightIncluded',
      'airline',
      'flightNotes',
      'hotelIncluded',
      'hotelName',
      'hotelRating',
      'roomType',
      'mealPlan',
      'visaSupportIncluded',
      'travelInsuranceIncluded',
      'airportTransferIncluded',
      'packageItinerary',
      'requiredDocuments',
      'cancellationPolicy',
      'availableTravelDates',
      'minimumGroupSize',
      'packageInclusions',
      'packageExclusions',
      'availabilityStartTime',
      'availabilityEndTime',
      'familyFriendly',
      'includesTransfer',
      'mealIncluded',
      'outdoor',
      'videoWalkthroughUrl',
      'tour360Url',
      'virtualTourUrl',
      'distanceFromLandmarkEn',
      'distanceFromLandmarkAr'
    ] as const;

    const scalarUpdateData = updateData as Record<string, unknown>;

    scalarFields.forEach((field) => {
      if (hasOwnProperty(data, field)) {
        scalarUpdateData[field] = data[field] ?? null;
      }
    });

    if (hasOwnProperty(data, 'availabilityDays')) {
      updateData.availabilityDays = {
        set: data.availabilityDays ?? []
      };
    }

    if (hasOwnProperty(data, 'travelAgencyId')) {
      updateData.travelAgency = travelAgency
        ? {
            connect: {
              id: travelAgency.id
            }
          }
        : {
            disconnect: true
          };
      updateData.providerEn = travelAgency ? travelAgency.nameEn : updateData.providerEn;
      updateData.providerAr = travelAgency ? travelAgency.nameAr : updateData.providerAr;
    }

    if (hasOwnProperty(data, 'nearestLandmarkId')) {
      updateData.nearestLandmark = nearestLandmark
        ? {
            connect: {
              id: nearestLandmark.id
            }
          }
        : {
            disconnect: true
          };
    }

    if (hasOwnProperty(data, 'images')) {
      updateData.images = {
        deleteMany: {},
        create: data.images ?? []
      };
    }

    if (hasOwnProperty(data, 'premiumMedia')) {
      updateData.premiumMedia = {
        deleteMany: {},
        create: createPremiumMediaData(data.premiumMedia ?? [])
      };
    }

    if (hasOwnProperty(data, 'highlights')) {
      updateData.highlights = {
        deleteMany: {},
        create: data.highlights ?? []
      };
    }

    const hasMediaQualityUpdate =
      hasOwnProperty(data, 'images') ||
      hasOwnProperty(data, 'videoWalkthroughUrl') ||
      hasOwnProperty(data, 'tour360Url') ||
      hasOwnProperty(data, 'virtualTourUrl') ||
      hasOwnProperty(data, 'categoryEn');

    if (hasMediaQualityUpdate) {
      const nextImages =
        data.images ?? existingActivity.images.map((image) => ({ url: image.url }));
      const qualityUpdate = createMediaQualityUpdate(
        createActivityMediaQualityInput({
          images: nextImages,
          videoWalkthroughUrl:
            data.videoWalkthroughUrl ?? existingActivity.videoWalkthroughUrl,
          tour360Url: data.tour360Url ?? existingActivity.tour360Url,
          virtualTourUrl: data.virtualTourUrl ?? existingActivity.virtualTourUrl,
          category: data.categoryEn ?? existingActivity.categoryEn
        })
      );

      updateData.mediaQualityStatus = qualityUpdate.mediaQualityStatus;
      updateData.mediaQualityNotes = qualityUpdate.mediaQualityNotes;
      updateData.enhancementStatus = qualityUpdate.enhancementStatus;
    }

    if (req.user!.role !== 'ADMIN' && hasSensitiveActivityUpdate(data)) {
      updateData.status = 'PENDING';
      updateData.rejectedReason = null;
    }

    const activity = await prisma.activity.update({
      where: {
        id
      },
      data: updateData,
      include: activityInclude
    });

    if (
      req.user!.role !== 'ADMIN' &&
      hasSensitiveActivityUpdate(data) &&
      activity.status === 'PENDING'
    ) {
      await notifyActivitySubmittedForReview({
        activity,
        actorId: req.user!.id
      });
    }

    res.json({
      activity
    });
  } catch (error) {
    next(error);
  }
});


activitiesRouter.get('/:slug/related', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const activity = await prisma.activity.findUnique({
      where: {
        slug
      },
      include: activityInclude
    });

    if (!activity || activity.status !== 'APPROVED') {
      throw new AppError(404, 'Activity not found');
    }

    const relatedSignals: Prisma.ActivityWhereInput[] = [
      {
        travelRegion: activity.travelRegion
      },
      {
        categoryEn: activity.categoryEn
      },
      {
        locationEn: activity.locationEn
      }
    ];

    if (activity.categoryAr) {
      relatedSignals.push({
        categoryAr: activity.categoryAr
      });
    }

    if (activity.locationAr) {
      relatedSignals.push({
        locationAr: activity.locationAr
      });
    }

    if (activity.travelAgencyId) {
      relatedSignals.push({
        travelAgencyId: activity.travelAgencyId
      });
    }

    if (activity.nearestLandmarkId) {
      relatedSignals.push({
        nearestLandmarkId: activity.nearestLandmarkId
      });
    }

    if (activity.destinationCountry) {
      relatedSignals.push({
        destinationCountry: activity.destinationCountry
      });
    }

    if (activity.destinationCity) {
      relatedSignals.push({
        destinationCity: activity.destinationCity
      });
    }

    if (activity.activityType) {
      relatedSignals.push({
        activityType: activity.activityType
      });
    }

    const candidates = await prisma.activity.findMany({
      where: {
        status: 'APPROVED',
        id: {
          not: activity.id
        },
        OR: relatedSignals
      },
      include: activityInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: 32
    });

    const fallbackCandidates =
      candidates.length >= 4
        ? []
        : await prisma.activity.findMany({
            where: {
              status: 'APPROVED',
              id: {
                notIn: [activity.id, ...candidates.map((candidate) => candidate.id)]
              }
            },
            include: activityInclude,
            orderBy: {
              createdAt: 'desc'
            },
            take: 12
          });

    const activities = [...candidates, ...fallbackCandidates]
      .map((candidate) => ({
        candidate,
        score: getRelatedActivityScore(activity, candidate)
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
      })
      .slice(0, 4)
      .map(({ candidate }) => candidate);

    res.json({
      activities
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const activity = await prisma.activity.findUnique({
      where: {
        slug
      },
      include: activityInclude
    });

    if (!activity || activity.status !== 'APPROVED') {
      throw new AppError(404, 'Activity not found');
    }

    res.json({
      activity
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.post(
  '/',
  requireAuth(),
  requireRole('ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'ADMIN'),
  requireVerifiedEmail({ allowAdmin: true }),
  async (req, res, next) => {
    try {
      const data = activityCreateSchema.parse(req.body);
      const slug = `${slugify(data.titleEn)}-${Date.now().toString(36)}`;

      const travelAgency = data.travelAgencyId
        ? await prisma.travelAgency.findUnique({
            where: {
              id: data.travelAgencyId
            }
          })
        : null;

      if (data.travelAgencyId && !travelAgency) {
        throw new AppError(400, 'Selected travel agency was not found');
      }

      if (data.travelAgencyId && (data.providerEn || data.providerAr)) {
        throw new AppError(
          400,
          'Choose either a listed travel agency or enter a manual organizer name'
        );
      }

      const partnerTier = travelAgency
        ? getLinkedPartnerTier(travelAgency)
        : getManualPartnerTier(data.providerEn, data.providerAr);

      const resolvedPrice = resolvePriceInput({
        displayPrice: data.price,
        priceAmount: data.priceAmount,
        priceCurrency: data.priceCurrency,
        priceQualifier: data.priceQualifier,
        priceUnit: data.priceUnit
      });

      const qualityUpdate = createMediaQualityUpdate(
      createActivityMediaQualityInput({
        image: data.images[0]?.url,
        images: data.images,
        videoWalkthroughUrl: data.videoWalkthroughUrl,
        tour360Url: data.tour360Url,
        virtualTourUrl: data.virtualTourUrl,
        category: data.categoryEn
      })
    );

    const activity = await prisma.activity.create({
        data: {
          slug,
          titleEn: data.titleEn,
          titleAr: data.titleAr,
          descriptionEn: data.descriptionEn,
          descriptionAr: data.descriptionAr,
          locationEn: data.locationEn,
          locationAr: data.locationAr,
          categoryEn: data.categoryEn,
          categoryAr: data.categoryAr,

          partnerTier,
          travelAgencyId: travelAgency?.id,
          providerEn: data.providerEn ?? travelAgency?.nameEn,
          providerAr: data.providerAr ?? travelAgency?.nameAr,

          price: resolvedPrice.price,
          priceAmount: resolvedPrice.priceAmount,
          priceCurrency: resolvedPrice.priceCurrency,
          priceQualifier: resolvedPrice.priceQualifier,
          priceUnit: resolvedPrice.priceUnit,

          durationMinutes: data.durationMinutes,
          durationLabelEn: data.durationLabelEn,
          durationLabelAr: data.durationLabelAr,
          durationType: data.durationType,
          groupSize: data.groupSize,
          capacity: data.capacity,
          language: data.language,
          difficulty: data.difficulty,
          activityType: data.activityType,
          travelRegion: data.travelRegion,

          destinationCountry: data.destinationCountry,
          destinationCity: data.destinationCity,
          departureCity: data.departureCity,
          tripDurationDays: data.tripDurationDays,
          tripDurationNights: data.tripDurationNights,
          flightIncluded: data.flightIncluded,
          airline: data.airline,
          flightNotes: data.flightNotes,
          hotelIncluded: data.hotelIncluded,
          hotelName: data.hotelName,
          hotelRating: data.hotelRating,
          roomType: data.roomType,
          mealPlan: data.mealPlan,
          visaSupportIncluded: data.visaSupportIncluded,
          travelInsuranceIncluded: data.travelInsuranceIncluded,
          airportTransferIncluded: data.airportTransferIncluded,
          packageItinerary: data.packageItinerary,
          requiredDocuments: data.requiredDocuments,
          cancellationPolicy: data.cancellationPolicy,
          availableTravelDates: data.availableTravelDates,
          minimumGroupSize: data.minimumGroupSize,
          packageInclusions: data.packageInclusions,
          packageExclusions: data.packageExclusions,

          availabilityDays: data.availabilityDays,
          availabilityStartTime: data.availabilityStartTime,
          availabilityEndTime: data.availabilityEndTime,

          familyFriendly: data.familyFriendly,
          includesTransfer: data.includesTransfer,
          mealIncluded: data.mealIncluded,
          outdoor: data.outdoor,

          videoWalkthroughUrl: data.videoWalkthroughUrl,
          tour360Url: data.tour360Url,
          virtualTourUrl: data.virtualTourUrl,
          mediaQualityStatus: qualityUpdate.mediaQualityStatus,
          mediaQualityNotes: qualityUpdate.mediaQualityNotes,
          enhancementStatus: qualityUpdate.enhancementStatus,

          nearestLandmarkId: data.nearestLandmarkId,
          distanceFromLandmarkEn: data.distanceFromLandmarkEn,
          distanceFromLandmarkAr: data.distanceFromLandmarkAr,

          status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
          ownerId: req.user!.id,
          images: {
            create: data.images
          },
          premiumMedia: data.premiumMedia.length
            ? {
                create: createPremiumMediaData(data.premiumMedia)
              }
            : undefined,
          highlights: {
            create: data.highlights
          }
        },
        include: activityInclude
      });

      if (activity.status === 'PENDING') {
        await notifyActivitySubmittedForReview({
          activity,
          actorId: req.user!.id
        });
      }

      if (activity.status === 'APPROVED') {
        await notifySavedSearchMatchesForActivity({
          activity,
          actorId: req.user!.id
        });
      }

      res.status(201).json({
        activity
      });
    } catch (error) {
      next(error);
    }
  }
);