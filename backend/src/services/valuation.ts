import type { Listing, Prisma, PrismaClient, ValuationConfidence } from '@prisma/client';

import {
  listingMatchesLocation,
  toComparableListing,
  type MarketInsightComparable
} from './marketInsights';

type PrismaLike = Pick<PrismaClient, 'listing'>;

export type ValuationInput = {
  location: string;
  propertyType?: string | null;
  sqm?: number | null;
  beds?: number | null;
  baths?: number | null;
  askingPrice?: number | string | Prisma.Decimal | null;
  rentEstimate?: number | string | Prisma.Decimal | null;
  currency?: string | null;
  listingId?: string | null;
};

export type ValuationComparableListing = Pick<
  Listing,
  | 'id'
  | 'title'
  | 'titleEn'
  | 'location'
  | 'locationEn'
  | 'type'
  | 'typeEn'
  | 'transaction'
  | 'priceAmount'
  | 'priceUnit'
  | 'sqm'
  | 'beds'
  | 'baths'
  | 'status'
  | 'createdAt'
>;

export type DeterministicValuationResult = {
  estimateLow: number | null;
  estimateHigh: number | null;
  confidence: ValuationConfidence;
  comparableSnapshots: MarketInsightComparable[];
  notes: string;
  disclaimer: string;
};

const MIN_MEDIUM_CONFIDENCE_COMPARABLES = 3;
const MIN_HIGH_CONFIDENCE_COMPARABLES = 6;

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0);

  if (!filtered.length) return null;

  return filtered.reduce((total, value) => total + value, 0) / filtered.length;
}

function roundMoney(value: number | null) {
  if (value === null) return null;

  return Math.round(value * 1000) / 1000;
}

function isSaleListing(listing: ValuationComparableListing) {
  return normalizeText(listing.transaction).includes('sale');
}

function listingMatchesPropertyType(
  listing: ValuationComparableListing,
  propertyType?: string | null
) {
  if (!propertyType) return true;

  const requestedType = normalizeText(propertyType);

  if (!requestedType) return true;

  const listingType = normalizeText(
    [listing.type, listing.typeEn].filter(Boolean).join(' ')
  );

  return listingType.includes(requestedType) || requestedType.includes(listingType);
}

function getComparableScore(
  listing: ValuationComparableListing,
  input: ValuationInput
) {
  let score = 0;

  if (listingMatchesLocation(listing, input.location)) {
    score += 50;
  }

  if (listingMatchesPropertyType(listing, input.propertyType)) {
    score += 20;
  }

  if (input.sqm && listing.sqm) {
    const diffRatio = Math.abs(listing.sqm - input.sqm) / input.sqm;

    if (diffRatio <= 0.1) score += 15;
    else if (diffRatio <= 0.25) score += 10;
    else if (diffRatio <= 0.4) score += 5;
  }

  if (input.beds !== null && input.beds !== undefined && listing.beds === input.beds) {
    score += 5;
  }

  if (input.baths !== null && input.baths !== undefined && listing.baths === input.baths) {
    score += 5;
  }

  return score;
}

function getPricePerSqm(listing: ValuationComparableListing) {
  const amount = toNumber(listing.priceAmount);

  if (!amount || !listing.sqm || listing.sqm <= 0) return null;

  return amount / listing.sqm;
}

function getConfidence(comparableCount: number): ValuationConfidence {
  if (comparableCount >= MIN_HIGH_CONFIDENCE_COMPARABLES) {
    return 'HIGH_DATA';
  }

  if (comparableCount >= MIN_MEDIUM_CONFIDENCE_COMPARABLES) {
    return 'MEDIUM_DATA';
  }

  return 'LOW_DATA';
}

export function getValuationDisclaimer(confidence: ValuationConfidence) {
  if (confidence === 'LOW_DATA') {
    return 'Low confidence: more lux.om listing data is needed. This is not a formal appraisal.';
  }

  return 'Estimated market range based on available lux.om listing data. This is not a formal appraisal or financial guarantee.';
}

export function selectComparableListings(
  listings: ValuationComparableListing[],
  input: ValuationInput
) {
  return listings
    .filter((listing) => {
      const amount = toNumber(listing.priceAmount);

      return (
        listing.status === 'APPROVED' &&
        isSaleListing(listing) &&
        Boolean(amount && amount > 0) &&
        listingMatchesLocation(listing, input.location) &&
        listingMatchesPropertyType(listing, input.propertyType)
      );
    })
    .map((listing) => ({
      listing,
      score: getComparableScore(listing, input)
    }))
    .filter((item) => item.score >= 50)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return second.listing.createdAt.getTime() - first.listing.createdAt.getTime();
    })
    .slice(0, 12)
    .map((item) => item.listing);
}

export function createDeterministicValuation(
  listings: ValuationComparableListing[],
  input: ValuationInput
): DeterministicValuationResult {
  const comparables = selectComparableListings(listings, input);
  const confidence = getConfidence(comparables.length);
  const comparableSnapshots = comparables.map(toComparableListing);

  if (confidence === 'LOW_DATA') {
    return {
      estimateLow: null,
      estimateHigh: null,
      confidence,
      comparableSnapshots,
      notes: 'Not enough comparable lux.om sale listings for a reliable estimate.',
      disclaimer: getValuationDisclaimer(confidence)
    };
  }

  const pricePerSqmValues = comparables
    .map(getPricePerSqm)
    .filter((value): value is number => Boolean(value && value > 0));

  const directPrices = comparables
    .map((listing) => toNumber(listing.priceAmount))
    .filter((value): value is number => Boolean(value && value > 0));

  const avgPricePerSqm = average(pricePerSqmValues);
  const avgDirectPrice = average(directPrices);

  let midpoint: number | null = null;

  if (avgPricePerSqm && input.sqm && input.sqm > 0) {
    midpoint = avgPricePerSqm * input.sqm;
  } else if (avgDirectPrice) {
    midpoint = avgDirectPrice;
  }

  if (!midpoint) {
    return {
      estimateLow: null,
      estimateHigh: null,
      confidence: 'LOW_DATA',
      comparableSnapshots,
      notes: 'Comparable listings exist, but not enough usable price/area data is available.',
      disclaimer: getValuationDisclaimer('LOW_DATA')
    };
  }

  const spread = confidence === 'HIGH_DATA' ? 0.12 : 0.18;

  return {
    estimateLow: roundMoney(midpoint * (1 - spread)),
    estimateHigh: roundMoney(midpoint * (1 + spread)),
    confidence,
    comparableSnapshots,
    notes:
      confidence === 'HIGH_DATA'
        ? 'Estimate range generated from multiple comparable lux.om listings.'
        : 'Estimate range generated from limited comparable lux.om listings.',
    disclaimer: getValuationDisclaimer(confidence)
  };
}

export async function getApprovedComparableListings(prisma: PrismaLike) {
  return prisma.listing.findMany({
    where: {
      status: 'APPROVED',
      transaction: {
        contains: 'Sale',
        mode: 'insensitive'
      },
      priceAmount: {
        not: null
      }
    },
    select: {
      id: true,
      title: true,
      titleEn: true,
      location: true,
      locationEn: true,
      type: true,
      typeEn: true,
      transaction: true,
      priceAmount: true,
      priceUnit: true,
      sqm: true,
      beds: true,
      baths: true,
      status: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

export async function createValuationFromAvailableData(
  prisma: PrismaLike,
  input: ValuationInput
) {
  const listings = await getApprovedComparableListings(prisma);

  return createDeterministicValuation(listings, input);
}

export function normalizeValuationRequestInput(input: ValuationInput) {
  return {
    location: input.location.trim(),
    propertyType: input.propertyType?.trim() || null,
    sqm: input.sqm ?? null,
    beds: input.beds ?? null,
    baths: input.baths ?? null,
    askingPrice:
      input.askingPrice === null || input.askingPrice === undefined
        ? null
        : toNumber(input.askingPrice),
    rentEstimate:
      input.rentEstimate === null || input.rentEstimate === undefined
        ? null
        : toNumber(input.rentEstimate),
    currency: input.currency?.trim().toUpperCase() || 'OMR',
    listingId: input.listingId?.trim() || null
  };
}