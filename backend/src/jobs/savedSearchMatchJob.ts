import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SAVED_SEARCH_MATCH_LOOKBACK_DAYS = 7;
const SAVED_SEARCH_BATCH_SIZE = 100;
const SAVED_SEARCH_CANDIDATE_BATCH_SIZE = 50;

type SavedSearchRecord = {
  id: string;
  name: string;
  userId: string;
  category?: string | null;
  query?: string | null;
  filters: unknown;
  lastMatchedAt?: Date | null;
  createdAt: Date;
};

function getPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) return fallback;

  const parsed = Number(rawValue);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * ONE_DAY_MS);
}

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

function decimalLikeToNumber(
  value: Prisma.Decimal | string | number | null | undefined
) {
  if (value === null || value === undefined) return null;

  const numberValue =
    typeof value === 'number' ? value : Number(value.toString());

  return Number.isFinite(numberValue) ? numberValue : null;
}

function textIncludes(value: unknown, needle: string) {
  if (!needle) return true;

  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function getSinceDate(search: SavedSearchRecord, now: Date) {
  const lookbackDays = getPositiveIntegerEnv(
    'SAVED_SEARCH_MATCH_LOOKBACK_DAYS',
    DEFAULT_SAVED_SEARCH_MATCH_LOOKBACK_DAYS
  );

  const lookbackStart = addDays(now, -lookbackDays);
  const latestKnownDate = search.lastMatchedAt ?? search.createdAt ?? lookbackStart;

  return new Date(Math.max(latestKnownDate.getTime(), lookbackStart.getTime()));
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

function savedSearchCategoryMatches(
  search: SavedSearchRecord,
  target: 'LISTING' | 'ACTIVITY'
) {
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

  if (hasMeaningfulSavedSearchFilters(filters)) return true;

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

function getListingTitle(listing: {
  title?: string | null;
  titleEn?: string | null;
}) {
  return listing.titleEn ?? listing.title ?? 'Listing';
}

function getActivityTitle(activity: {
  titleEn?: string | null;
  titleAr?: string | null;
}) {
  return activity.titleEn ?? activity.titleAr ?? 'Activity';
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

function listingMatchesSavedSearch(
  listing: {
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
  if (view && view !== 'All' && !textIncludes(listing.view, view)) return false;

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

function activityMatchesSavedSearch(
  activity: {
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
    ![activity.categoryEn, activity.categoryAr].some((value) => textIncludes(value, category))
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

  return true;
}

async function processSavedSearchListingMatches(search: SavedSearchRecord, now: Date) {
  const since = getSinceDate(search, now);

  const listings = await prisma.listing.findMany({
    where: {
      status: 'APPROVED',
      ownerId: {
        not: search.userId
      },
      updatedAt: {
        gt: since
      }
    },
    include: {
      amenities: true,
      developer: true,
      nearestLandmark: true
    },
    orderBy: {
      updatedAt: 'asc'
    },
    take: SAVED_SEARCH_CANDIDATE_BATCH_SIZE
  });

  const matches = listings.filter((listing) => listingMatchesSavedSearch(listing, search));

  if (matches.length === 0) return 0;

  await prisma.notification.createMany({
    data: matches.map((listing) => ({
      userId: search.userId,
      type: 'SAVED_SEARCH_MATCH',
      title: 'New listing matches your saved search',
      message: `${getListingTitle(listing)} matches "${search.name}".`
    }))
  });

  return matches.length;
}

async function processSavedSearchActivityMatches(search: SavedSearchRecord, now: Date) {
  const since = getSinceDate(search, now);

  const activities = await prisma.activity.findMany({
    where: {
      status: 'APPROVED',
      ownerId: {
        not: search.userId
      },
      updatedAt: {
        gt: since
      }
    },
    include: {
      travelAgency: true,
      nearestLandmark: true
    },
    orderBy: {
      updatedAt: 'asc'
    },
    take: SAVED_SEARCH_CANDIDATE_BATCH_SIZE
  });

  const matches = activities.filter((activity) =>
    activityMatchesSavedSearch(activity, search)
  );

  if (matches.length === 0) return 0;

  await prisma.notification.createMany({
    data: matches.map((activity) => ({
      userId: search.userId,
      type: 'SAVED_SEARCH_MATCH',
      title: 'New activity matches your saved search',
      message: `${getActivityTitle(activity)} matches "${search.name}".`
    }))
  });

  return matches.length;
}

export async function runPeriodicSavedSearchMatchJob(now = new Date()) {
  if (process.env.SAVED_SEARCH_MATCH_JOBS_ENABLED === 'false') {
    return {
      savedSearchesChecked: 0,
      savedSearchMatchesCreated: 0
    };
  }

  const savedSearches = await prisma.savedSearch.findMany({
    where: {
      alertsEnabled: true,
      alertFrequency: {
        not: 'NONE'
      }
    },
    select: {
      id: true,
      name: true,
      userId: true,
      category: true,
      query: true,
      filters: true,
      lastMatchedAt: true,
      createdAt: true
    },
    orderBy: {
      updatedAt: 'asc'
    },
    take: SAVED_SEARCH_BATCH_SIZE
  });

  let matchesCreated = 0;

  for (const search of savedSearches) {
    matchesCreated += await processSavedSearchListingMatches(search, now);
    matchesCreated += await processSavedSearchActivityMatches(search, now);

    await prisma.savedSearch.update({
      where: {
        id: search.id
      },
      data: {
        lastMatchedAt: now
      }
    });
  }

  return {
    savedSearchesChecked: savedSearches.length,
    savedSearchMatchesCreated: matchesCreated
  };
}
