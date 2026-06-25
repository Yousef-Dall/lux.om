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
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';
import { getLinkedPartnerTier, getManualPartnerTier } from '../utils/partnerTier';
import {
  priceQualifierValues,
  priceUnitValues,
  resolvePriceInput
} from '../utils/pricing';
import {
  buildSearchRelevance,
  paginateExplicitlySortedIds,
  paginateRankedIds,
  restoreRankedOrder
} from '../utils/searchRanking';
import { slugify } from '../utils/slugify';

export const listingsRouter = Router();

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

const optionalIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalLongTextSchema = z
  .string()
  .trim()
  .max(3000)
  .optional()
  .transform((value) => value || undefined);

const optionalNumberSchema = z
  .union([z.coerce.number().int(), z.undefined(), z.null()])
  .optional()
  .transform((value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined));

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
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase())
  .optional();

const optionalSafeMediaUrlSchema = z
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
      .max(1000)
      .refine((value) => isSafeMediaUrl(value), {
        message:
          'Media URL must be an uploaded file path or a supported media URL'
      })
      .optional()
  )
  .optional();

const listingBuyerEligibilityValues = [
  'OMANI_ONLY',
  'GCC_NATIONALS',
  'OMAN_RESIDENTS',
  'FOREIGNERS_ALLOWED',
  'COMPANY_PURCHASE_ALLOWED',
  'FREEHOLD',
  'USUFRUCT',
  'EXPAT_BUYABLE',
  'ITC',
  'GOLDEN_VISA_ELIGIBLE',
  'OMR_250K_RESIDENCY_ELIGIBLE',
  'OMR_500K_RESIDENCY_ELIGIBLE'
] as const;

const mediaAssetTypeValues = [
  'IMAGE',
  'VIDEO_WALKTHROUGH',
  'TOUR_360',
  'VIRTUAL_TOUR',
  'FLOOR_PLAN',
  'DOCUMENT',
  'OTHER'
] as const;

const mediaQualityStatusValues = [
  'NOT_CHECKED',
  'NEEDS_REVIEW',
  'ACCEPTABLE',
  'EXCELLENT',
  'BLOCKED'
] as const;

const enhancementStatusValues = [
  'NOT_REQUESTED',
  'NOT_CONFIGURED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
] as const;

const verificationStatusValues = [
  'UNVERIFIED',
  'SUBMITTED',
  'ADMIN_VERIFIED',
  'EXTERNALLY_VERIFIED',
  'REJECTED',
  'EXPIRED'
] as const;

const verificationSourceValues = [
  'LUX_OM_ADMIN_REVIEW',
  'OWNER_DOCUMENT_SUBMISSION',
  'FUTURE_MOLUP_API',
  'FUTURE_MUNICIPALITY_REGISTRATION',
  'FUTURE_THIRD_PARTY_PROVIDER'
] as const;

function normalizeBuyerEligibilitySearch(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function getBuyerEligibilitySearchMatches(search: string) {
  const normalizedSearch = normalizeBuyerEligibilitySearch(search);

  return listingBuyerEligibilityValues.filter((value) => {
    const normalizedValue = normalizeBuyerEligibilitySearch(value);

    return (
      normalizedValue.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedValue)
    );
  });
}

const premiumMediaInputSchema = z
  .object({
    type: z.enum(mediaAssetTypeValues),
    url: z
      .string()
      .trim()
      .max(1000)
      .refine((value) => isSafeMediaUrl(value), {
        message:
          'Premium media URL must be an uploaded file path or supported media URL'
      }),
    provider: optionalTextSchema,
    titleEn: z.string().trim().max(160).optional(),
    titleAr: z.string().trim().max(160).optional(),
    altEn: z.string().trim().max(160).optional(),
    altAr: z.string().trim().max(160).optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isPrimary: z.coerce.boolean().default(false)
  })
  .strict();

const listingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(3000),
    type: z.string().trim().min(2).max(40),
    transaction: z.enum(['Sale', 'Rent', 'Short stay']),
    buyerEligibility: z
      .array(z.enum(listingBuyerEligibilityValues))
      .max(listingBuyerEligibilityValues.length)
      .default([]),
    eligibilityNotes: optionalLongTextSchema,
    eligibilityDisclaimer: optionalLongTextSchema,
    investorHighlights: z
      .array(z.string().trim().min(1).max(120))
      .max(12)
      .default([]),
    location: z.string().trim().min(2).max(120),
    price: z.string().trim().min(1).max(80).optional(),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),
    beds: z.coerce.number().int().min(0).max(50),
    baths: z.coerce.number().int().min(0).max(50),
    sqm: z.coerce.number().int().min(1).max(100000),
    image: imageUrlSchema,
    images: z
      .array(
        z.object({
          url: imageUrlSchema,
          altEn: z.string().trim().max(160).optional(),
          altAr: z.string().trim().max(160).optional(),
          sortOrder: z.coerce.number().int().min(0).default(0)
        })
      )
      .max(20)
      .optional(),

    videoWalkthroughUrl: optionalSafeMediaUrlSchema,
    tour360Url: optionalSafeMediaUrlSchema,
    virtualTourUrl: optionalSafeMediaUrlSchema,
    floorPlanUrl: optionalSafeMediaUrlSchema,
    premiumMedia: z.array(premiumMediaInputSchema).max(20).default([]),

    amenities: z.array(z.string().trim().min(1).max(50)).max(30).default([]),

    developerId: optionalIdSchema,
    developerNameEn: optionalTextSchema,
    developerNameAr: optionalTextSchema,
    nearestLandmarkId: optionalIdSchema,
    distanceFromLandmark: optionalTextSchema,
    distanceFromLandmarkEn: optionalTextSchema,
    distanceFromLandmarkAr: optionalTextSchema,

    minStayNights: optionalNumberSchema,
    maxGuests: optionalNumberSchema,
    parkingSpaces: optionalNumberSchema,
    floorNumber: optionalNumberSchema,

    furnishing: optionalTextSchema,
    view: optionalTextSchema,
    paymentFrequency: optionalTextSchema
  })
  .strict()
  .superRefine((data, context) => {
    const hasStructuredPrice =
      data.priceAmount !== undefined ||
      data.priceCurrency !== undefined ||
      data.priceQualifier !== undefined ||
      data.priceUnit !== undefined;

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
        message:
          'On-request pricing cannot include an amount'
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
        message:
          'A numeric amount is required for this price type'
      });
    }

    if (data.transaction !== 'Sale' && data.buyerEligibility.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['buyerEligibility'],
        message: 'Buyer eligibility is only available for sale listings'
      });
    }
  });

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  transaction: z.enum(['Sale', 'Rent', 'Short stay']).optional(),
  buyerEligibility: z.enum(listingBuyerEligibilityValues).optional(),
  type: z.string().trim().optional(),
  location: z.string().trim().optional(),
  nearestLandmarkId: z.string().trim().optional(),
  developerId: z.string().trim().optional(),
  minBeds: z.coerce.number().int().min(0).optional(),
  minBaths: z.coerce.number().int().min(0).optional(),
  minSqm: z.coerce.number().int().min(0).optional(),
  minGuests: z.coerce.number().int().min(0).optional(),
  minParking: z.coerce.number().int().min(0).optional(),
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
  furnishing: z.string().trim().optional(),
  view: z.string().trim().optional(),
  amenities: z.string().trim().optional(),

  hasVideo: z.coerce.boolean().optional(),
  hasVirtualTour: z.coerce.boolean().optional(),
  hasFloorPlan: z.coerce.boolean().optional(),
  verificationStatus: z.enum(verificationStatusValues).optional(),
  mediaQualityStatus: z.enum(mediaQualityStatusValues).optional(),

  sort: z
    .enum([
      'recommended',
      'newest',
      'price_asc',
      'price_desc',
      'area_desc'
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
        message:
          'Maximum price must be greater than or equal to minimum price'
      });
    }
  });

const statusSchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    rejectedReason: z.string().trim().max(1000).optional()
  })
  .strict();

const adminStage8ListingSchema = z
  .object({
    buyerEligibility: z
      .array(z.enum(listingBuyerEligibilityValues))
      .max(listingBuyerEligibilityValues.length)
      .optional(),
    eligibilityNotes: z.string().trim().max(3000).nullable().optional(),
    eligibilityDisclaimer: z.string().trim().max(3000).nullable().optional(),
    adminVerificationNotes: z.string().trim().max(3000).nullable().optional(),
    investorHighlights: z
      .array(z.string().trim().min(1).max(120))
      .max(12)
      .optional(),

    price: z.string().trim().min(1).max(80).optional(),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),

    videoWalkthroughUrl: optionalSafeMediaUrlSchema.nullable(),
    tour360Url: optionalSafeMediaUrlSchema.nullable(),
    virtualTourUrl: optionalSafeMediaUrlSchema.nullable(),
    floorPlanUrl: optionalSafeMediaUrlSchema.nullable(),
    premiumMedia: z.array(premiumMediaInputSchema).max(20).optional(),

    mediaQualityStatus: z.enum(mediaQualityStatusValues).optional(),
    mediaQualityNotes: z.string().trim().max(3000).nullable().optional(),
    enhancedImageUrl: optionalSafeMediaUrlSchema.nullable(),
    enhancementStatus: z.enum(enhancementStatusValues).optional(),
    enhancementProvider: z.string().trim().max(120).nullable().optional(),
    enhancementNotes: z.string().trim().max(3000).nullable().optional(),

    verificationStatus: z.enum(verificationStatusValues).optional(),
    verificationSource: z.enum(verificationSourceValues).nullable().optional(),
    verificationNotes: z.string().trim().max(3000).nullable().optional(),
    verificationDate: z.coerce.date().nullable().optional(),
    verificationExpiryDate: z.coerce.date().nullable().optional()
  })
  .strict();


const listingUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(20).max(3000).optional(),
    type: z.string().trim().min(2).max(40).optional(),
    transaction: z.enum(['Sale', 'Rent', 'Short stay']).optional(),
    buyerEligibility: z
      .array(z.enum(listingBuyerEligibilityValues))
      .max(listingBuyerEligibilityValues.length)
      .optional(),
    eligibilityNotes: z.string().trim().max(3000).nullable().optional(),
    eligibilityDisclaimer: z.string().trim().max(3000).nullable().optional(),
    investorHighlights: z
      .array(z.string().trim().min(1).max(120))
      .max(12)
      .optional(),
    location: z.string().trim().min(2).max(120).optional(),

    price: z.string().trim().min(1).max(80).optional(),
    priceAmount: optionalPriceAmountSchema,
    priceCurrency: optionalCurrencySchema,
    priceQualifier: z.enum(priceQualifierValues).optional(),
    priceUnit: z.enum(priceUnitValues).optional(),

    beds: z.coerce.number().int().min(0).max(50).optional(),
    baths: z.coerce.number().int().min(0).max(50).optional(),
    sqm: z.coerce.number().int().min(1).max(100000).optional(),
    image: imageUrlSchema.optional(),
    images: z
      .array(
        z.object({
          url: imageUrlSchema,
          altEn: z.string().trim().max(160).optional(),
          altAr: z.string().trim().max(160).optional(),
          sortOrder: z.coerce.number().int().min(0).default(0)
        })
      )
      .max(20)
      .optional(),

    videoWalkthroughUrl: optionalSafeMediaUrlSchema.nullable(),
    tour360Url: optionalSafeMediaUrlSchema.nullable(),
    virtualTourUrl: optionalSafeMediaUrlSchema.nullable(),
    floorPlanUrl: optionalSafeMediaUrlSchema.nullable(),
    premiumMedia: z.array(premiumMediaInputSchema).max(20).optional(),

    amenities: z.array(z.string().trim().min(1).max(50)).max(30).optional(),

    developerId: optionalIdSchema,
    developerNameEn: optionalTextSchema,
    developerNameAr: optionalTextSchema,
    nearestLandmarkId: optionalIdSchema,
    distanceFromLandmark: optionalTextSchema,
    distanceFromLandmarkEn: optionalTextSchema,
    distanceFromLandmarkAr: optionalTextSchema,

    minStayNights: optionalNumberSchema,
    maxGuests: optionalNumberSchema,
    parkingSpaces: optionalNumberSchema,
    floorNumber: optionalNumberSchema,

    furnishing: optionalTextSchema,
    view: optionalTextSchema,
    paymentFrequency: optionalTextSchema
  })
  .strict();

type ListingUpdateData = z.infer<typeof listingUpdateSchema>;

const idParamsSchema = z.object({
  id: z.string().min(1)
});

const slugParamsSchema = z.object({
  slug: z.string().min(1)
});

const listingInclude = {
  amenities: true,
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
  eligibilityMarkedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
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

function hasOwnProperty<T extends object, K extends PropertyKey>(
  object: T,
  key: K
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
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

function shouldMarkEligibility(data: {
  transaction?: string;
  buyerEligibility?: readonly string[];
  eligibilityNotes?: string | null;
  eligibilityDisclaimer?: string | null;
  investorHighlights?: readonly string[];
}) {
  return (
    data.transaction === 'Sale' &&
    Boolean(
      data.buyerEligibility?.length ||
        data.eligibilityNotes ||
        data.eligibilityDisclaimer ||
        data.investorHighlights?.length
    )
  );
}

function createMediaQualityInput(data: {
  image?: string | null;
  images?: Array<{ url?: string | null }>;
  videoWalkthroughUrl?: string | null;
  tour360Url?: string | null;
  virtualTourUrl?: string | null;
  floorPlanUrl?: string | null;
  type?: string | null;
  transaction?: string | null;
}) {
  return {
    mainImage: data.image,
    images: data.images,
    videoWalkthroughUrl: data.videoWalkthroughUrl,
    tour360Url: data.tour360Url,
    virtualTourUrl: data.virtualTourUrl,
    floorPlanUrl: data.floorPlanUrl,
    listingType: data.type,
    transaction: data.transaction
  };
}

const sensitiveListingUpdateKeys = [
  'title',
  'description',
  'type',
  'transaction',
  'buyerEligibility',
  'eligibilityNotes',
  'eligibilityDisclaimer',
  'investorHighlights',
  'location',
  'developerId',
  'developerNameEn',
  'developerNameAr',
  'nearestLandmarkId',
  'distanceFromLandmark',
  'distanceFromLandmarkEn',
  'distanceFromLandmarkAr'
] as const;

function hasSensitiveListingUpdate(data: ListingUpdateData) {
  return sensitiveListingUpdateKeys.some((key) => hasOwnProperty(data, key));
}

function decimalLikeToNumber(
  value: Prisma.Decimal | string | number | null | undefined
) {
  if (value === null || value === undefined) return null;

  const numberValue =
    typeof value === 'number' ? value : Number(value.toString());

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPriceForNotification(amount: number, currency: string | null | undefined) {
  return `${currency ?? 'OMR'} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

async function notifyInvestorPriceTargetHits({
  listingId,
  listingTitle,
  previousPrice,
  nextPrice,
  currency,
  status
}: {
  listingId: string;
  listingTitle: string;
  previousPrice: Prisma.Decimal | string | number | null | undefined;
  nextPrice: Prisma.Decimal | string | number | null | undefined;
  currency: string | null | undefined;
  status: string;
}) {
  if (status !== 'APPROVED') return;

  const previous = decimalLikeToNumber(previousPrice);
  const next = decimalLikeToNumber(nextPrice);

  if (previous === null || next === null || next >= previous) return;

  const watchlistItems = await prisma.investorWatchlistItem.findMany({
    where: {
      listingId,
      alertOnPriceChange: true,
      targetPrice: {
        not: null
      }
    },
    select: {
      id: true,
      userId: true,
      targetPrice: true
    }
  });

  const crossedTargets = watchlistItems.filter((item) => {
    const target = decimalLikeToNumber(item.targetPrice);

    return target !== null && previous > target && next <= target;
  });

  if (crossedTargets.length === 0) return;

  await prisma.notification.createMany({
    data: crossedTargets.map((item) => {
      const target = decimalLikeToNumber(item.targetPrice);

      return {
        userId: item.userId,
        type: 'SAVED_SEARCH_MATCH',
        title: 'Investor price target reached',
        message: `${listingTitle} dropped to ${formatPriceForNotification(
          next,
          currency
        )}. Your target was ${formatPriceForNotification(
          target ?? next,
          currency
        )}.`
      };
    })
  });
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

function getFilterTextArray(filters: Record<string, unknown>, key: string) {
  const value = filters[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function textIncludes(value: unknown, needle: string) {
  if (!needle) return true;

  return normalizeSearchText(value).includes(needle.toLowerCase());
}

function getListingSearchText(listing: {
  title?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  location?: string | null;
  locationEn?: string | null;
  locationAr?: string | null;
  type?: string | null;
  typeEn?: string | null;
  typeAr?: string | null;
  transaction?: string | null;
  buyerEligibility?: readonly string[];
  developer?: {
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
    listing.title,
    listing.titleEn,
    listing.titleAr,
    listing.description,
    listing.descriptionEn,
    listing.descriptionAr,
    listing.location,
    listing.locationEn,
    listing.locationAr,
    listing.type,
    listing.typeEn,
    listing.typeAr,
    listing.transaction,
    ...(listing.buyerEligibility ?? []),
    listing.developer?.nameEn,
    listing.developer?.nameAr,
    listing.developer?.slug,
    listing.nearestLandmark?.nameEn,
    listing.nearestLandmark?.nameAr,
    listing.nearestLandmark?.slug
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

function listingMatchesSavedSearch(
  listing: {
    id: string;
    ownerId: string;
    title?: string | null;
    titleEn?: string | null;
    titleAr?: string | null;
    description?: string | null;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    location?: string | null;
    locationEn?: string | null;
    locationAr?: string | null;
    type?: string | null;
    typeEn?: string | null;
    typeAr?: string | null;
    transaction?: string | null;
    priceAmount?: Prisma.Decimal | string | number | null;
    beds?: number | null;
    baths?: number | null;
    sqm?: number | null;
    parking?: boolean | null;
    furnishing?: string | null;
    view?: string | null;
    videoWalkthroughUrl?: string | null;
    tour360Url?: string | null;
    virtualTourUrl?: string | null;
    floorPlanUrl?: string | null;
    buyerEligibility?: readonly string[];
    amenities?: Array<{
      name?: string | null;
      nameEn?: string | null;
    }>;
    developer?: {
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
  if (!savedSearchCategoryMatches(search, 'LISTING')) return false;

  const filters = isPlainRecord(search.filters) ? search.filters : {};
  const candidateText = getListingSearchText(listing);

  if (!savedSearchQueryMatches(search, candidateText)) return false;

  const transaction = getFilterText(filters, 'transaction');
  if (transaction && transaction !== 'All' && listing.transaction !== transaction) {
    return false;
  }

  const propertyType = getFilterText(filters, 'propertyType') || getFilterText(filters, 'type');
  if (
    propertyType &&
    propertyType !== 'All' &&
    !textIncludes(listing.typeEn ?? listing.type, propertyType)
  ) {
    return false;
  }

  const buyerEligibility = getFilterText(filters, 'buyerEligibility');
  if (
    buyerEligibility &&
    buyerEligibility !== 'All' &&
    !(listing.buyerEligibility ?? []).includes(buyerEligibility)
  ) {
    return false;
  }

  const location = getFilterText(filters, 'location');
  if (
    location &&
    ![
      listing.location,
      listing.locationEn,
      listing.locationAr,
      listing.nearestLandmark?.nameEn,
      listing.nearestLandmark?.nameAr
    ].some((value) => textIncludes(value, location))
  ) {
    return false;
  }

  const developer = getFilterText(filters, 'developer');
  if (
    developer &&
    ![
      listing.developer?.id,
      listing.developer?.slug,
      listing.developer?.nameEn,
      listing.developer?.nameAr
    ].some((value) => textIncludes(value, developer))
  ) {
    return false;
  }

  const near = getFilterText(filters, 'near');
  if (
    near &&
    ![
      listing.nearestLandmark?.id,
      listing.nearestLandmark?.slug,
      listing.nearestLandmark?.nameEn,
      listing.nearestLandmark?.nameAr
    ].some((value) => textIncludes(value, near))
  ) {
    return false;
  }

  const minBeds = getFilterNumber(filters, 'minBeds');
  if (minBeds !== null && (listing.beds ?? 0) < minBeds) return false;

  const minBaths = getFilterNumber(filters, 'minBaths');
  if (minBaths !== null && (listing.baths ?? 0) < minBaths) return false;

  const minSqm = getFilterNumber(filters, 'minSqm');
  if (minSqm !== null && (listing.sqm ?? 0) < minSqm) return false;

  const minPrice = getFilterNumber(filters, 'minPrice');
  const maxPrice = getFilterNumber(filters, 'maxPrice');
  const price = decimalLikeToNumber(listing.priceAmount);

  if (minPrice !== null && (price === null || price < minPrice)) return false;
  if (maxPrice !== null && (price === null || price > maxPrice)) return false;

  const furnishing = getFilterText(filters, 'furnishing');
  if (furnishing && furnishing !== 'All' && !textIncludes(listing.furnishing, furnishing)) {
    return false;
  }

  const view = getFilterText(filters, 'view');
  if (view && view !== 'All' && !textIncludes(listing.view, view)) {
    return false;
  }

  const amenities = getFilterTextArray(filters, 'amenities');
  if (amenities.length > 0) {
    const listingAmenities = (listing.amenities ?? [])
      .flatMap((amenity) => [amenity.name, amenity.nameEn])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!amenities.every((amenity) => listingAmenities.includes(amenity.toLowerCase()))) {
      return false;
    }
  }

  if (
    getFilterBoolean(filters, 'hasVirtualTour') &&
    !listing.virtualTourUrl &&
    !listing.tour360Url &&
    !listing.videoWalkthroughUrl
  ) {
    return false;
  }

  if (getFilterBoolean(filters, 'hasFloorPlan') && !listing.floorPlanUrl) {
    return false;
  }

  return true;
}

async function notifySavedSearchMatchesForListing({
  listing,
  actorId
}: {
  listing: {
    id: string;
    ownerId: string;
    title?: string | null;
    titleEn?: string | null;
    titleAr?: string | null;
    description?: string | null;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    location?: string | null;
    locationEn?: string | null;
    locationAr?: string | null;
    type?: string | null;
    typeEn?: string | null;
    typeAr?: string | null;
    transaction?: string | null;
    priceAmount?: Prisma.Decimal | string | number | null;
    beds?: number | null;
    baths?: number | null;
    sqm?: number | null;
    parking?: boolean | null;
    furnishing?: string | null;
    view?: string | null;
    videoWalkthroughUrl?: string | null;
    tour360Url?: string | null;
    virtualTourUrl?: string | null;
    floorPlanUrl?: string | null;
    buyerEligibility?: readonly string[];
    amenities?: Array<{
      name?: string | null;
      nameEn?: string | null;
    }>;
    developer?: {
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
        notIn: [listing.ownerId, actorId].filter((id): id is string => Boolean(id))
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
      listing.updatedAt &&
      listing.updatedAt <= search.lastMatchedAt
    ) {
      return false;
    }

    return listingMatchesSavedSearch(listing, search);
  });

  if (matchedSearches.length === 0) return;

  await prisma.notification.createMany({
    data: matchedSearches.map((search) => ({
      userId: search.userId,
      type: 'SAVED_SEARCH_MATCH',
      title: 'New listing matches your saved search',
      message: `${getListingNotificationTitle(
        listing
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

function getListingNotificationTitle(listing: {
  title?: string | null;
  titleEn?: string | null;
}) {
  return listing.titleEn ?? listing.title ?? 'Listing';
}

function formatListingStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

async function notifyListingSubmittedForReview({
  listing,
  actorId
}: {
  listing: {
    id: string;
    title?: string | null;
    titleEn?: string | null;
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
      title: 'Listing awaiting review',
      message: `${getListingNotificationTitle(
        listing
      )} was submitted or updated and needs admin review.`
    }))
  });
}

async function notifyListingStatusReviewed({
  listing,
  actorId
}: {
  listing: {
    id: string;
    title?: string | null;
    titleEn?: string | null;
    ownerId: string;
    status: string;
    rejectedReason?: string | null;
  };
  actorId: string;
}) {
  if (listing.ownerId === actorId) return;

  const listingTitle = getListingNotificationTitle(listing);
  const isRejected = listing.status === 'REJECTED';

  await prisma.notification.create({
    data: {
      userId: listing.ownerId,
      type: 'REVIEW_STATUS_UPDATED',
      title:
        listing.status === 'APPROVED'
          ? 'Listing approved'
          : isRejected
            ? 'Listing rejected'
            : 'Listing status updated',
      message: isRejected
        ? `${listingTitle} was rejected${
            listing.rejectedReason ? `: ${listing.rejectedReason}` : '.'
          }`
        : `${listingTitle} is now ${formatListingStatus(listing.status)}.`
    }
  });
}

listingsRouter.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const search = query.search?.trim();
    const selectedAmenities =
      query.amenities
        ?.split(',')
        .map((amenity) => amenity.trim())
        .filter(Boolean) ?? [];
    const listingFilters: Prisma.ListingWhereInput[] = [];

    if (query.transaction) {
      listingFilters.push({
        transaction: query.transaction
      });
    }

    if (query.buyerEligibility) {
      listingFilters.push({
        buyerEligibility: {
          has: query.buyerEligibility
        }
      });
    }

    if (query.type) {
      listingFilters.push({
        OR: [
          {
            type: {
              contains: query.type,
              mode: 'insensitive'
            }
          },
          {
            typeEn: {
              contains: query.type,
              mode: 'insensitive'
            }
          },
          {
            typeAr: {
              contains: query.type,
              mode: 'insensitive'
            }
          }
        ]
      });
    }

    if (query.location) {
      listingFilters.push({
        OR: [
          {
            location: {
              contains: query.location,
              mode: 'insensitive'
            }
          },
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
          }
        ]
      });
    }

    if (query.nearestLandmarkId) {
      listingFilters.push({
        nearestLandmarkId: query.nearestLandmarkId
      });
    }

    if (query.developerId) {
      listingFilters.push({
        developerId: query.developerId
      });
    }

    if (query.minBeds !== undefined) {
      listingFilters.push({
        beds: {
          gte: query.minBeds
        }
      });
    }

    if (query.minBaths !== undefined) {
      listingFilters.push({
        baths: {
          gte: query.minBaths
        }
      });
    }

    if (query.minSqm !== undefined) {
      listingFilters.push({
        sqm: {
          gte: query.minSqm
        }
      });
    }

    if (query.minGuests !== undefined) {
      listingFilters.push({
        maxGuests: {
          gte: query.minGuests
        }
      });
    }

    if (query.minParking !== undefined && query.minParking > 0) {
      listingFilters.push(
        query.minParking === 1
          ? {
              parking: true
            }
          : {
              id: '__no_listing_matches_parking_requirement__'
            }
      );
    }

    if (query.price) {
      listingFilters.push({
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
      listingFilters.push({
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
      listingFilters.push({
        priceCurrency: query.priceCurrency
      });
    }

    if (query.priceQualifier) {
      listingFilters.push({
        priceQualifier: query.priceQualifier
      });
    }

    if (query.priceUnit) {
      listingFilters.push({
        priceUnit: query.priceUnit
      });
    }

    if (query.furnishing) {
      listingFilters.push({
        furnishing: query.furnishing
      });
    }

    if (query.view) {
      listingFilters.push({
        view: query.view
      });
    }

    if (query.hasVideo) {
      listingFilters.push({
        OR: [
          {
            videoWalkthroughUrl: {
              not: null
            }
          },
          {
            premiumMedia: {
              some: {
                type: 'VIDEO_WALKTHROUGH'
              }
            }
          }
        ]
      });
    }

    if (query.hasVirtualTour) {
      listingFilters.push({
        OR: [
          {
            tour360Url: {
              not: null
            }
          },
          {
            virtualTourUrl: {
              not: null
            }
          },
          {
            premiumMedia: {
              some: {
                type: {
                  in: ['TOUR_360', 'VIRTUAL_TOUR']
                }
              }
            }
          }
        ]
      });
    }

    if (query.hasFloorPlan) {
      listingFilters.push({
        OR: [
          {
            floorPlanUrl: {
              not: null
            }
          },
          {
            premiumMedia: {
              some: {
                type: 'FLOOR_PLAN'
              }
            }
          }
        ]
      });
    }

    if (query.verificationStatus) {
      listingFilters.push({
        verificationStatus: query.verificationStatus
      });
    }

    if (query.mediaQualityStatus) {
      listingFilters.push({
        mediaQualityStatus: query.mediaQualityStatus
      });
    }

    for (const amenity of selectedAmenities) {
      listingFilters.push({
        amenities: {
          some: {
            OR: [
              {
                name: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              },
              {
                nameEn: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              },
              {
                nameAr: {
                  equals: amenity,
                  mode: 'insensitive'
                }
              }
            ]
          }
        }
      });
    }

    if (search) {
      const matchingBuyerEligibility = getBuyerEligibilitySearchMatches(search);

      listingFilters.push({
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive'
            }
          },
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
            description: {
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
            location: {
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
            type: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            typeEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            typeAr: {
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
          ...(matchingBuyerEligibility.length > 0
            ? [
                {
                  buyerEligibility: {
                    hasSome: matchingBuyerEligibility
                  }
                }
              ]
            : []),
          {
            eligibilityNotes: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            investorHighlights: {
              has: search
            }
          },
          {
            developerNameEn: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            developerNameAr: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            developer: {
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
            amenities: {
              some: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
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
          }
        ]
      });
    }

    const listingWhere: Prisma.ListingWhereInput = {
      status: 'APPROVED',
      AND: listingFilters
    };

    const pagination = resolvePagination(query);
    const total = await prisma.listing.count({
      where: listingWhere
    });

    let listings: Prisma.ListingGetPayload<{
      include: typeof listingInclude;
    }>[];

    if (query.sort !== 'recommended') {
      const candidates = await prisma.listing.findMany({
        where: listingWhere,
        select: {
          id: true,
          price: true,
          priceAmount: true,
          sqm: true,
          partnerTier: true,
          createdAt: true
        }
      });

      const orderedIds = paginateExplicitlySortedIds(
        candidates.map((candidate) => ({
          id: candidate.id,
          price:
            candidate.priceAmount?.toString() ??
            candidate.price,
          area: candidate.sqm,
          partnerTier: candidate.partnerTier,
          createdAt: candidate.createdAt
        })),
        query.sort,
        pagination.skip,
        pagination.take
      );

      const explicitlySortedListings =
        orderedIds.length > 0
          ? await prisma.listing.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: listingInclude
            })
          : [];

      listings = restoreRankedOrder(
        explicitlySortedListings,
        orderedIds
      );
    } else if (search) {
      const candidates = await prisma.listing.findMany({
        where: listingWhere,
        select: {
          id: true,
          title: true,
          titleEn: true,
          titleAr: true,
          description: true,
          descriptionEn: true,
          descriptionAr: true,
          location: true,
          locationEn: true,
          locationAr: true,
          type: true,
          typeEn: true,
          typeAr: true,
          price: true,
          buyerEligibility: true,
          eligibilityNotes: true,
          investorHighlights: true,
          videoWalkthroughUrl: true,
          tour360Url: true,
          virtualTourUrl: true,
          floorPlanUrl: true,
          verificationStatus: true,

          developerId: true,
          developerNameEn: true,
          developerNameAr: true,
          nearestLandmarkId: true,

          beds: true,
          baths: true,
          sqm: true,
          maxGuests: true,
          minStayNights: true,
          parking: true,
          floor: true,
          furnishing: true,
          view: true,
          paymentFrequency: true,

          partnerTier: true,
          createdAt: true,

          developer: {
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
          amenities: {
            select: {
              name: true,
              nameEn: true,
              nameAr: true
            }
          },
          images: {
            select: {
              id: true
            }
          },
          premiumMedia: {
            select: {
              id: true,
              type: true
            }
          }
        }
      });

      const orderedIds = paginateRankedIds(
        candidates.map((candidate) => {
          const relatedSearchValues = [
            candidate.developerNameEn,
            candidate.developerNameAr,
            candidate.developer?.nameEn,
            candidate.developer?.nameAr,
            candidate.nearestLandmark?.nameEn,
            candidate.nearestLandmark?.nameAr,
            candidate.eligibilityNotes,
            candidate.verificationStatus,
            ...candidate.investorHighlights,
            ...candidate.amenities.flatMap((amenity) => [
              amenity.name,
              amenity.nameEn,
              amenity.nameAr
            ])
          ];

          const hasVirtualTour =
            Boolean(candidate.tour360Url || candidate.virtualTourUrl) ||
            candidate.premiumMedia.some((media) =>
              media.type === 'TOUR_360' || media.type === 'VIRTUAL_TOUR'
            );

          const qualityScore =
            Math.min(candidate.images.length, 3) * 2 +
            Math.min(candidate.amenities.length, 5) +
            Math.min(candidate.premiumMedia.length, 3) * 2 +
            Number((candidate.descriptionEn ?? '').trim().length >= 80) +
            Number(Boolean(candidate.titleAr)) +
            Number(Boolean(candidate.descriptionAr)) +
            Number(Boolean(candidate.locationAr)) +
            Number(Boolean(candidate.typeAr)) +
            Number(candidate.beds > 0) +
            Number(candidate.baths > 0) +
            Number(candidate.sqm > 0) +
            Number(Boolean(candidate.maxGuests)) +
            Number(Boolean(candidate.minStayNights)) +
            Number(candidate.parking === true) +
            Number(Boolean(candidate.floor)) +
            Number(Boolean(candidate.furnishing)) +
            Number(Boolean(candidate.view)) +
            Number(Boolean(candidate.paymentFrequency)) +
            Number(candidate.buyerEligibility.length > 0) +
            Number(hasVirtualTour) * 2 +
            Number(Boolean(candidate.floorPlanUrl)) +
            Number(candidate.verificationStatus === 'ADMIN_VERIFIED') * 2 +
            Number(candidate.verificationStatus === 'EXTERNALLY_VERIFIED') * 3 +
            Number(Boolean(candidate.nearestLandmarkId)) +
            Number(
              Boolean(
                candidate.developerId ||
                  candidate.developerNameEn ||
                  candidate.developerNameAr
              )
            );

          return {
            id: candidate.id,
            relevance: buildSearchRelevance(search, [
              [
                candidate.title,
                candidate.titleEn,
                candidate.titleAr
              ],
              [
                candidate.type,
                candidate.typeEn,
                candidate.typeAr,
                candidate.location,
                candidate.locationEn,
                candidate.locationAr,
                candidate.price,
                ...candidate.buyerEligibility,
                ...candidate.investorHighlights
              ],
              relatedSearchValues,
              [
                candidate.description,
                candidate.descriptionEn,
                candidate.descriptionAr
              ]
            ]),
            partnerTier: candidate.partnerTier,
            qualityScore,
            createdAt: candidate.createdAt
          };
        }),
        pagination.skip,
        pagination.take
      );

      const rankedListings =
        orderedIds.length > 0
          ? await prisma.listing.findMany({
              where: {
                id: {
                  in: orderedIds
                }
              },
              include: listingInclude
            })
          : [];

      listings = restoreRankedOrder(rankedListings, orderedIds);
    } else {
      listings = await prisma.listing.findMany({
        where: listingWhere,
        include: listingInclude,
        orderBy: [
          {
            partnerTier: 'desc'
          },
          {
            createdAt: 'desc'
          }
        ],
        take: pagination.take,
        skip: pagination.skip
      });
    }

    res.json({
      listings,
      pagination: createPaginationMetadata(
        total,
        listings.length,
        pagination
      )
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);

    const listings = await prisma.listing.findMany({
      include: listingInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.take,
      skip: query.skip
    });

    res.json({
      listings,
      pagination: {
        take: query.take,
        skip: query.skip,
        count: listings.length
      }
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.patch(
  '/admin/:id/status',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = statusSchema.parse(req.body);

      const listing = await prisma.listing.update({
        where: {
          id
        },
        data: {
          status: data.status,
          rejectedReason: data.status === 'REJECTED' ? data.rejectedReason ?? null : null
        },
        include: listingInclude
      });

      await notifyListingStatusReviewed({
        listing,
        actorId: req.user!.id
      });

      if (listing.status === 'APPROVED') {
        await notifySavedSearchMatchesForListing({
          listing,
          actorId: req.user!.id
        });
      }

      res.json({
        listing
      });
    } catch (error) {
      next(error);
    }
  }
);

listingsRouter.patch(
  '/admin/:id/stage8',
  requireAuth(),
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const data = adminStage8ListingSchema.parse(req.body);

      const existingListing = await prisma.listing.findUnique({
        where: {
          id
        },
        include: {
          images: true
        }
      });

      if (!existingListing) {
        throw new AppError(404, 'Listing not found');
      }

      const updateData: Prisma.ListingUpdateInput = {};

      const hasPriceUpdate =
        hasOwnProperty(data, 'price') ||
        hasOwnProperty(data, 'priceAmount') ||
        hasOwnProperty(data, 'priceCurrency') ||
        hasOwnProperty(data, 'priceQualifier') ||
        hasOwnProperty(data, 'priceUnit');

      if (hasPriceUpdate) {
        const resolvedPrice = resolvePriceInput({
          displayPrice: data.price ?? existingListing.price,
          priceAmount:
            data.priceAmount ??
            existingListing.priceAmount?.toString() ??
            undefined,
          priceCurrency:
            data.priceCurrency ?? existingListing.priceCurrency ?? undefined,
          priceQualifier:
            data.priceQualifier ?? existingListing.priceQualifier ?? undefined,
          priceUnit: data.priceUnit ?? existingListing.priceUnit ?? undefined,
          paymentFrequency: existingListing.paymentFrequency ?? undefined
        });

        updateData.price = resolvedPrice.price;
        updateData.priceAmount = resolvedPrice.priceAmount;
        updateData.priceCurrency = resolvedPrice.priceCurrency;
        updateData.priceQualifier = resolvedPrice.priceQualifier;
        updateData.priceUnit = resolvedPrice.priceUnit;
      }

      if (hasOwnProperty(data, 'buyerEligibility')) {
        updateData.buyerEligibility =
          existingListing.transaction === 'Sale'
            ? {
                set: data.buyerEligibility ?? []
              }
            : {
                set: []
              };
        updateData.eligibilityMarkedBy = {
          connect: {
            id: req.user!.id
          }
        };
      }

      if (hasOwnProperty(data, 'eligibilityNotes')) {
        updateData.eligibilityNotes = data.eligibilityNotes ?? null;
        updateData.eligibilityMarkedBy = {
          connect: {
            id: req.user!.id
          }
        };
      }

      if (hasOwnProperty(data, 'eligibilityDisclaimer')) {
        updateData.eligibilityDisclaimer = data.eligibilityDisclaimer ?? null;
      }

      if (hasOwnProperty(data, 'adminVerificationNotes')) {
        updateData.adminVerificationNotes = data.adminVerificationNotes ?? null;
      }

      if (hasOwnProperty(data, 'investorHighlights')) {
        updateData.investorHighlights = {
          set: data.investorHighlights ?? []
        };
      }

      if (hasOwnProperty(data, 'videoWalkthroughUrl')) {
        updateData.videoWalkthroughUrl = data.videoWalkthroughUrl ?? null;
      }

      if (hasOwnProperty(data, 'tour360Url')) {
        updateData.tour360Url = data.tour360Url ?? null;
      }

      if (hasOwnProperty(data, 'virtualTourUrl')) {
        updateData.virtualTourUrl = data.virtualTourUrl ?? null;
      }

      if (hasOwnProperty(data, 'floorPlanUrl')) {
        updateData.floorPlanUrl = data.floorPlanUrl ?? null;
      }

      if (hasOwnProperty(data, 'mediaQualityStatus')) {
        updateData.mediaQualityStatus = data.mediaQualityStatus;
      }

      if (hasOwnProperty(data, 'mediaQualityNotes')) {
        updateData.mediaQualityNotes = data.mediaQualityNotes ?? null;
      }

      if (hasOwnProperty(data, 'enhancedImageUrl')) {
        updateData.enhancedImageUrl = data.enhancedImageUrl ?? null;
      }

      if (hasOwnProperty(data, 'enhancementStatus')) {
        updateData.enhancementStatus = data.enhancementStatus;
      }

      if (hasOwnProperty(data, 'enhancementProvider')) {
        updateData.enhancementProvider = data.enhancementProvider ?? null;
      }

      if (hasOwnProperty(data, 'enhancementNotes')) {
        updateData.enhancementNotes = data.enhancementNotes ?? null;
      }

      if (hasOwnProperty(data, 'verificationStatus')) {
        updateData.verificationStatus = data.verificationStatus;
        updateData.verificationReviewedBy = {
          connect: {
            id: req.user!.id
          }
        };

        if (
          data.verificationStatus === 'ADMIN_VERIFIED' ||
          data.verificationStatus === 'EXTERNALLY_VERIFIED'
        ) {
          updateData.verificationDate = new Date();
        }
      }

      if (hasOwnProperty(data, 'verificationSource')) {
        updateData.verificationSource = data.verificationSource ?? null;
      }

      if (hasOwnProperty(data, 'verificationNotes')) {
        updateData.verificationNotes = data.verificationNotes ?? null;
      }

      if (hasOwnProperty(data, 'verificationDate')) {
        updateData.verificationDate = data.verificationDate ?? null;
      }

      if (hasOwnProperty(data, 'verificationExpiryDate')) {
        updateData.verificationExpiryDate = data.verificationExpiryDate ?? null;
      }

      if (
        hasOwnProperty(data, 'videoWalkthroughUrl') ||
        hasOwnProperty(data, 'tour360Url') ||
        hasOwnProperty(data, 'virtualTourUrl') ||
        hasOwnProperty(data, 'floorPlanUrl')
      ) {
        const qualityUpdate = createMediaQualityUpdate(
          createMediaQualityInput({
            image: existingListing.image,
            images: existingListing.images,
            videoWalkthroughUrl:
              data.videoWalkthroughUrl ?? existingListing.videoWalkthroughUrl,
            tour360Url: data.tour360Url ?? existingListing.tour360Url,
            virtualTourUrl: data.virtualTourUrl ?? existingListing.virtualTourUrl,
            floorPlanUrl: data.floorPlanUrl ?? existingListing.floorPlanUrl,
            type: existingListing.type,
            transaction: existingListing.transaction
          })
        );

        if (!hasOwnProperty(data, 'mediaQualityStatus')) {
          updateData.mediaQualityStatus = qualityUpdate.mediaQualityStatus;
        }

        if (!hasOwnProperty(data, 'mediaQualityNotes')) {
          updateData.mediaQualityNotes = qualityUpdate.mediaQualityNotes;
        }

        if (!hasOwnProperty(data, 'enhancementStatus')) {
          updateData.enhancementStatus = qualityUpdate.enhancementStatus;
        }
      }

      if (hasOwnProperty(data, 'premiumMedia')) {
        updateData.premiumMedia = {
          deleteMany: {},
          create: createPremiumMediaData(data.premiumMedia ?? [])
        };
      }

      const listing = await prisma.listing.update({
        where: {
          id
        },
        data: updateData,
        include: listingInclude
      });

      res.json({
        listing
      });
    } catch (error) {
      next(error);
    }
  }
);


listingsRouter.patch('/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = listingUpdateSchema.parse(req.body);

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'At least one listing field is required');
    }

    const existingListing = await prisma.listing.findUnique({
      where: {
        id
      },
      include: {
        images: true
      }
    });

    if (!existingListing) {
      throw new AppError(404, 'Listing not found');
    }

    if (req.user!.role !== 'ADMIN' && existingListing.ownerId !== req.user!.id) {
      throw new AppError(403, 'You can only update your own listings');
    }

    const mergedTransaction = data.transaction ?? existingListing.transaction;

    if (
      mergedTransaction !== 'Sale' &&
      hasOwnProperty(data, 'buyerEligibility') &&
      (data.buyerEligibility?.length ?? 0) > 0
    ) {
      throw new AppError(400, 'Buyer eligibility is only available for sale listings');
    }

    if (data.developerId && (data.developerNameEn || data.developerNameAr)) {
      throw new AppError(
        400,
        'Choose either a listed development company or enter a manual developer name'
      );
    }

    const developer = data.developerId
      ? await prisma.developerCompany.findUnique({
          where: {
            id: data.developerId
          }
        })
      : null;

    if (data.developerId && !developer) {
      throw new AppError(400, 'Selected development company was not found');
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

    const updateData: Prisma.ListingUpdateInput = {};

    const hasPriceUpdate =
      hasOwnProperty(data, 'price') ||
      hasOwnProperty(data, 'priceAmount') ||
      hasOwnProperty(data, 'priceCurrency') ||
      hasOwnProperty(data, 'priceQualifier') ||
      hasOwnProperty(data, 'priceUnit') ||
      hasOwnProperty(data, 'paymentFrequency');

    if (hasPriceUpdate) {
      const resolvedPrice = resolvePriceInput({
        displayPrice: data.price ?? existingListing.price,
        priceAmount:
          data.priceAmount ?? existingListing.priceAmount?.toString() ?? undefined,
        priceCurrency:
          data.priceCurrency ?? existingListing.priceCurrency ?? undefined,
        priceQualifier:
          data.priceQualifier ?? existingListing.priceQualifier ?? undefined,
        priceUnit: data.priceUnit ?? existingListing.priceUnit ?? undefined,
        paymentFrequency:
          data.paymentFrequency ?? existingListing.paymentFrequency ?? undefined
      });

      updateData.price = resolvedPrice.price;
      updateData.priceAmount = resolvedPrice.priceAmount;
      updateData.priceCurrency = resolvedPrice.priceCurrency;
      updateData.priceQualifier = resolvedPrice.priceQualifier;
      updateData.priceUnit = resolvedPrice.priceUnit;
    }

    if (hasOwnProperty(data, 'title')) {
      updateData.title = data.title;
      updateData.titleEn = data.title;
    }

    if (hasOwnProperty(data, 'description')) {
      updateData.description = data.description;
      updateData.descriptionEn = data.description;
    }

    if (hasOwnProperty(data, 'type')) {
      updateData.type = data.type;
      updateData.typeEn = data.type;
    }

    if (hasOwnProperty(data, 'transaction')) {
      updateData.transaction = data.transaction;
    }

    if (hasOwnProperty(data, 'location')) {
      updateData.location = data.location;
      updateData.locationEn = data.location;
    }

    if (hasOwnProperty(data, 'buyerEligibility') || data.transaction !== undefined) {
      updateData.buyerEligibility =
        mergedTransaction === 'Sale'
          ? {
              set: data.buyerEligibility ?? existingListing.buyerEligibility
            }
          : {
              set: []
            };

      if (mergedTransaction === 'Sale') {
        updateData.eligibilityMarkedBy = {
          connect: {
            id: req.user!.id
          }
        };
      }
    }

    if (hasOwnProperty(data, 'eligibilityNotes')) {
      updateData.eligibilityNotes = data.eligibilityNotes ?? null;
      updateData.eligibilityMarkedBy = {
        connect: {
          id: req.user!.id
        }
      };
    }

    if (hasOwnProperty(data, 'eligibilityDisclaimer')) {
      updateData.eligibilityDisclaimer = data.eligibilityDisclaimer ?? null;
    }

    if (hasOwnProperty(data, 'investorHighlights')) {
      updateData.investorHighlights = {
        set: data.investorHighlights ?? []
      };
    }

    if (hasOwnProperty(data, 'beds')) updateData.beds = data.beds;
    if (hasOwnProperty(data, 'baths')) updateData.baths = data.baths;
    if (hasOwnProperty(data, 'sqm')) updateData.sqm = data.sqm;
    if (hasOwnProperty(data, 'image')) updateData.image = data.image;

    if (hasOwnProperty(data, 'videoWalkthroughUrl')) {
      updateData.videoWalkthroughUrl = data.videoWalkthroughUrl ?? null;
    }

    if (hasOwnProperty(data, 'tour360Url')) {
      updateData.tour360Url = data.tour360Url ?? null;
    }

    if (hasOwnProperty(data, 'virtualTourUrl')) {
      updateData.virtualTourUrl = data.virtualTourUrl ?? null;
    }

    if (hasOwnProperty(data, 'floorPlanUrl')) {
      updateData.floorPlanUrl = data.floorPlanUrl ?? null;
    }

    if (hasOwnProperty(data, 'developerId')) {
      updateData.developer = developer
        ? {
            connect: {
              id: developer.id
            }
          }
        : {
            disconnect: true
          };
      updateData.developerNameEn = developer ? null : existingListing.developerNameEn;
      updateData.developerNameAr = developer ? null : existingListing.developerNameAr;
    }

    if (hasOwnProperty(data, 'developerNameEn') || hasOwnProperty(data, 'developerNameAr')) {
      updateData.developer = {
        disconnect: true
      };
      updateData.developerNameEn = data.developerNameEn ?? existingListing.developerNameEn;
      updateData.developerNameAr = data.developerNameAr ?? existingListing.developerNameAr;
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

    if (hasOwnProperty(data, 'distanceFromLandmark') || hasOwnProperty(data, 'distanceFromLandmarkEn')) {
      updateData.distanceFromLandmarkEn =
        data.distanceFromLandmarkEn ?? data.distanceFromLandmark ?? null;
    }

    if (hasOwnProperty(data, 'distanceFromLandmarkAr')) {
      updateData.distanceFromLandmarkAr = data.distanceFromLandmarkAr ?? null;
    }

    if (hasOwnProperty(data, 'minStayNights')) updateData.minStayNights = data.minStayNights ?? null;
    if (hasOwnProperty(data, 'maxGuests')) updateData.maxGuests = data.maxGuests ?? null;
    if (hasOwnProperty(data, 'parkingSpaces')) {
      updateData.parking = typeof data.parkingSpaces === 'number' ? data.parkingSpaces > 0 : null;
    }
    if (hasOwnProperty(data, 'floorNumber')) updateData.floor = data.floorNumber ?? null;
    if (hasOwnProperty(data, 'furnishing')) updateData.furnishing = data.furnishing ?? null;
    if (hasOwnProperty(data, 'view')) updateData.view = data.view ?? null;
    if (hasOwnProperty(data, 'paymentFrequency')) updateData.paymentFrequency = data.paymentFrequency ?? null;

    if (hasOwnProperty(data, 'amenities')) {
      updateData.amenities = {
        deleteMany: {},
        create: (data.amenities ?? []).map((name) => ({
          name,
          nameEn: name
        }))
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

    const hasMediaQualityUpdate =
      hasOwnProperty(data, 'image') ||
      hasOwnProperty(data, 'images') ||
      hasOwnProperty(data, 'videoWalkthroughUrl') ||
      hasOwnProperty(data, 'tour360Url') ||
      hasOwnProperty(data, 'virtualTourUrl') ||
      hasOwnProperty(data, 'floorPlanUrl') ||
      hasOwnProperty(data, 'type') ||
      hasOwnProperty(data, 'transaction');

    if (hasMediaQualityUpdate) {
      const nextImages =
        data.images ?? existingListing.images.map((image) => ({ url: image.url }));
      const qualityUpdate = createMediaQualityUpdate(
        createMediaQualityInput({
          image: data.image ?? existingListing.image,
          images: nextImages,
          videoWalkthroughUrl:
            data.videoWalkthroughUrl ?? existingListing.videoWalkthroughUrl,
          tour360Url: data.tour360Url ?? existingListing.tour360Url,
          virtualTourUrl: data.virtualTourUrl ?? existingListing.virtualTourUrl,
          floorPlanUrl: data.floorPlanUrl ?? existingListing.floorPlanUrl,
          type: data.type ?? existingListing.type,
          transaction: data.transaction ?? existingListing.transaction
        })
      );

      updateData.mediaQualityStatus = qualityUpdate.mediaQualityStatus;
      updateData.mediaQualityNotes = qualityUpdate.mediaQualityNotes;
      updateData.enhancementStatus = qualityUpdate.enhancementStatus;
    }

    if (req.user!.role !== 'ADMIN' && hasSensitiveListingUpdate(data)) {
      updateData.status = 'PENDING';
      updateData.rejectedReason = null;
    }

    const listing = await prisma.listing.update({
      where: {
        id
      },
      data: updateData,
      include: listingInclude
    });

    if (
      req.user!.role !== 'ADMIN' &&
      hasSensitiveListingUpdate(data) &&
      listing.status === 'PENDING'
    ) {
      await notifyListingSubmittedForReview({
        listing,
        actorId: req.user!.id
      });
    }

    if (hasPriceUpdate) {
      await notifyInvestorPriceTargetHits({
        listingId: listing.id,
        listingTitle: listing.titleEn ?? listing.title ?? 'Listing',
        previousPrice: existingListing.priceAmount,
        nextPrice: listing.priceAmount,
        currency: listing.priceCurrency ?? existingListing.priceCurrency,
        status: listing.status
      });
    }

    res.json({
      listing
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugParamsSchema.parse(req.params);

    const listing = await prisma.listing.findUnique({
      where: {
        slug
      },
      include: listingInclude
    });

    if (!listing || listing.status !== 'APPROVED') {
      throw new AppError(404, 'Listing not found');
    }

    res.json({
      listing
    });
  } catch (error) {
    next(error);
  }
});

listingsRouter.post('/', requireAuth(), requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const data = listingSchema.parse(req.body);
    const baseSlug = slugify(data.title);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const developer = data.developerId
      ? await prisma.developerCompany.findUnique({
          where: {
            id: data.developerId
          }
        })
      : null;

    if (data.developerId && !developer) {
      throw new AppError(400, 'Selected development company was not found');
    }

    if (data.developerId && (data.developerNameEn || data.developerNameAr)) {
      throw new AppError(
        400,
        'Choose either a listed development company or enter a manual developer name'
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

    const distanceFromLandmarkEn =
      data.distanceFromLandmarkEn ?? data.distanceFromLandmark ?? undefined;

    const partnerTier = developer
      ? getLinkedPartnerTier(developer)
      : getManualPartnerTier(data.developerNameEn, data.developerNameAr);

    const resolvedPrice = resolvePriceInput({
      displayPrice: data.price,
      priceAmount: data.priceAmount,
      priceCurrency: data.priceCurrency,
      priceQualifier: data.priceQualifier,
      priceUnit: data.priceUnit,
      paymentFrequency: data.paymentFrequency
    });

    const listingImages =
      data.images && data.images.length > 0
        ? data.images
        : [
            {
              url: data.image,
              altEn: data.title,
              sortOrder: 0
            }
          ];

    const qualityUpdate = createMediaQualityUpdate(
      createMediaQualityInput({
        image: data.image,
        images: listingImages,
        videoWalkthroughUrl: data.videoWalkthroughUrl,
        tour360Url: data.tour360Url,
        virtualTourUrl: data.virtualTourUrl,
        floorPlanUrl: data.floorPlanUrl,
        type: data.type,
        transaction: data.transaction
      })
    );

    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        transaction: data.transaction,
        buyerEligibility:
          data.transaction === 'Sale' ? data.buyerEligibility : [],
        eligibilityMarkedById: shouldMarkEligibility(data)
          ? req.user!.id
          : undefined,
        eligibilityNotes:
          data.transaction === 'Sale' ? data.eligibilityNotes : undefined,
        eligibilityDisclaimer:
          data.transaction === 'Sale'
            ? data.eligibilityDisclaimer ??
              'Eligibility should be verified before purchase. Subject to applicable Omani regulations.'
            : undefined,
        investorHighlights:
          data.transaction === 'Sale' ? data.investorHighlights : [],
        location: data.location,
        price: resolvedPrice.price,
        priceAmount: resolvedPrice.priceAmount,
        priceCurrency: resolvedPrice.priceCurrency,
        priceQualifier: resolvedPrice.priceQualifier,
        priceUnit: resolvedPrice.priceUnit,
        beds: data.beds,
        baths: data.baths,
        sqm: data.sqm,
        image: data.image,
        slug,

        titleEn: data.title,
        descriptionEn: data.description,
        locationEn: data.location,
        typeEn: data.type,

        videoWalkthroughUrl: data.videoWalkthroughUrl,
        tour360Url: data.tour360Url,
        virtualTourUrl: data.virtualTourUrl,
        floorPlanUrl: data.floorPlanUrl,

        mediaQualityStatus: qualityUpdate.mediaQualityStatus,
        mediaQualityNotes: qualityUpdate.mediaQualityNotes,
        enhancementStatus: qualityUpdate.enhancementStatus,

        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        ownerId: req.user!.id,

        partnerTier,
        developerId: developer?.id,
        developerNameEn: developer ? null : data.developerNameEn,
        developerNameAr: developer ? null : data.developerNameAr,
        nearestLandmarkId: nearestLandmark?.id,
        distanceFromLandmarkEn,
        distanceFromLandmarkAr: data.distanceFromLandmarkAr,

        minStayNights: data.minStayNights,
        maxGuests: data.maxGuests,
        parking: typeof data.parkingSpaces === 'number' ? data.parkingSpaces > 0 : undefined,
        floor: data.floorNumber,
        furnishing: data.furnishing,
        view: data.view,
        paymentFrequency: data.paymentFrequency,

        amenities: {
          create: data.amenities.map((name) => ({
            name,
            nameEn: name
          }))
        },

        images: {
          create: listingImages
        },

        premiumMedia: data.premiumMedia.length
          ? {
              create: createPremiumMediaData(data.premiumMedia)
            }
          : undefined
      },
      include: listingInclude
    });

    if (listing.status === 'PENDING') {
      await notifyListingSubmittedForReview({
        listing,
        actorId: req.user!.id
      });
    }

    if (listing.status === 'APPROVED') {
      await notifySavedSearchMatchesForListing({
        listing,
        actorId: req.user!.id
      });
    }

    res.status(201).json({
      listing
    });
  } catch (error) {
    next(error);
  }
});