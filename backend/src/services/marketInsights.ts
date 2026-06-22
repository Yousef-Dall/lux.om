import type { Listing, Prisma, PrismaClient } from '@prisma/client';

type PrismaLike = Pick<PrismaClient, 'listing' | 'marketInsightSnapshot'>;

export type MarketInsightListing = Pick<
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

export type MarketInsightResult = {
  location: string;
  locationKey: string;
  transaction?: string | null;
  propertyType?: string | null;
  sampleSizeSale: number;
  sampleSizeRent: number;
  avgAskingPrice: number | null;
  avgRent: number | null;
  avgPricePerSqm: number | null;
  estimatedRentalYield: number | null;
  notEnoughData: boolean;
  notes: string;
  generatedAt: Date;
  similarListings?: MarketInsightComparable[];
};

export type MarketInsightComparable = {
  id: string;
  title: string;
  location: string;
  type: string;
  transaction: string;
  priceAmount: number | null;
  priceUnit: string | null;
  sqm: number | null;
  beds: number | null;
  baths: number | null;
  createdAt: Date;
};

export const MARKET_INSIGHT_MIN_SAMPLE_SIZE = 3;

export const MARKET_INSIGHT_NEIGHBORHOODS = [
  'Al Mouj',
  'The Wave / Al Mouj',
  'Muscat Hills',
  'Bausher',
  'Al Khoud',
  'Qurum',
  'Azaiba',
  'Muscat'
];

const LOCATION_ALIASES: Record<string, string[]> = {
  'al-mouj': ['al mouj', 'almouj', 'the wave', 'the wave muscat'],
  'the-wave-al-mouj': ['the wave / al mouj', 'the wave', 'al mouj', 'almouj'],
  'muscat-hills': ['muscat hills', 'muscat hill'],
  bausher: ['bausher', 'bousher', 'bosher', 'بوشر'],
  'al-khoud': ['al khoud', 'alkhoud', 'al khoudh', 'alkhoudh', 'الخوض'],
  qurum: ['qurum', 'qurm', 'القرم'],
  azaiba: ['azaiba', 'al azaiba', 'العذيبة'],
  muscat: ['muscat', 'مسقط']
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
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

function roundRate(value: number | null) {
  if (value === null) return null;

  return Math.round(value * 10000) / 10000;
}

export function normalizeLocationKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[/]+/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSearchText(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[/]+/g, ' ')
    .replace(/\s+/g, ' ') ?? '';
}

function getListingTitle(listing: MarketInsightListing) {
  return listing.titleEn || listing.title || 'Listing';
}

function getListingLocation(listing: MarketInsightListing) {
  return listing.locationEn || listing.location || '';
}

function getListingType(listing: MarketInsightListing) {
  return listing.typeEn || listing.type || '';
}

function isSaleListing(listing: MarketInsightListing) {
  return normalizeSearchText(listing.transaction).includes('sale');
}

function isRentListing(listing: MarketInsightListing) {
  const transaction = normalizeSearchText(listing.transaction);

  return transaction === 'rent' || transaction.includes('rent');
}

function getMonthlyRentEquivalent(listing: MarketInsightListing) {
  const amount = toNumber(listing.priceAmount);

  if (!amount || amount <= 0) return null;

  if (listing.priceUnit === 'YEAR') {
    return amount / 12;
  }

  if (listing.priceUnit === 'MONTH' || !listing.priceUnit) {
    return amount;
  }

  return null;
}

function getListingPricePerSqm(listing: MarketInsightListing) {
  const amount = toNumber(listing.priceAmount);

  if (!amount || !listing.sqm || listing.sqm <= 0) return null;

  return amount / listing.sqm;
}

function getAliasesForLocation(location: string) {
  const key = normalizeLocationKey(location);

  return LOCATION_ALIASES[key] ?? [normalizeSearchText(location)];
}

export function listingMatchesLocation(
  listing: Pick<MarketInsightListing, 'location' | 'locationEn'>,
  location: string
) {
  const listingLocation = normalizeSearchText(
    [listing.location, listing.locationEn].filter(Boolean).join(' ')
  );

  if (!listingLocation) return false;

  const aliases = getAliasesForLocation(location);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeSearchText(alias);

    return (
      listingLocation === normalizedAlias ||
      listingLocation.includes(normalizedAlias) ||
      normalizedAlias.includes(listingLocation)
    );
  });
}

export function toComparableListing(
  listing: MarketInsightListing
): MarketInsightComparable {
  return {
    id: listing.id,
    title: getListingTitle(listing),
    location: getListingLocation(listing),
    type: getListingType(listing),
    transaction: listing.transaction,
    priceAmount: toNumber(listing.priceAmount),
    priceUnit: listing.priceUnit,
    sqm: listing.sqm,
    beds: listing.beds,
    baths: listing.baths,
    createdAt: listing.createdAt
  };
}

export function createMarketInsightForLocation(
  listings: MarketInsightListing[],
  location: string,
  options: {
    propertyType?: string | null;
    includeSimilarListings?: boolean;
  } = {}
): MarketInsightResult {
  const matchingListings = listings.filter((listing) => {
    if (!listingMatchesLocation(listing, location)) {
      return false;
    }

    if (!options.propertyType) {
      return true;
    }

    return normalizeSearchText(getListingType(listing)).includes(
      normalizeSearchText(options.propertyType)
    );
  });

  const saleListings = matchingListings.filter((listing) => {
    const amount = toNumber(listing.priceAmount);

    return isSaleListing(listing) && Boolean(amount && amount > 0);
  });

  const rentListings = matchingListings.filter((listing) => {
    const amount = getMonthlyRentEquivalent(listing);

    return isRentListing(listing) && Boolean(amount && amount > 0);
  });

  const salePrices = saleListings
    .map((listing) => toNumber(listing.priceAmount))
    .filter((value): value is number => Boolean(value && value > 0));

  const rentPrices = rentListings
    .map((listing) => getMonthlyRentEquivalent(listing))
    .filter((value): value is number => Boolean(value && value > 0));

  const pricePerSqmValues = saleListings
    .map((listing) => getListingPricePerSqm(listing))
    .filter((value): value is number => Boolean(value && value > 0));

  const avgAskingPrice = roundMoney(average(salePrices));
  const avgRent = roundMoney(average(rentPrices));
  const avgPricePerSqm = roundMoney(average(pricePerSqmValues));

  const hasEnoughSaleData = saleListings.length >= MARKET_INSIGHT_MIN_SAMPLE_SIZE;
  const hasEnoughRentData = rentListings.length >= MARKET_INSIGHT_MIN_SAMPLE_SIZE;
  const hasYieldData =
    hasEnoughSaleData &&
    hasEnoughRentData &&
    Boolean(avgAskingPrice && avgAskingPrice > 0 && avgRent && avgRent > 0);

  const estimatedRentalYield = hasYieldData
    ? roundRate(((avgRent as number) * 12) / (avgAskingPrice as number))
    : null;

  const notEnoughData = !hasEnoughSaleData && !hasEnoughRentData;

  const notes = notEnoughData
    ? 'Not enough lux.om listing data yet for a reliable market insight.'
    : 'Based only on available lux.om asking prices. This is not a formal valuation or market guarantee.';

  return {
    location,
    locationKey: normalizeLocationKey(location),
    propertyType: options.propertyType ?? null,
    sampleSizeSale: saleListings.length,
    sampleSizeRent: rentListings.length,
    avgAskingPrice: hasEnoughSaleData ? avgAskingPrice : null,
    avgRent: hasEnoughRentData ? avgRent : null,
    avgPricePerSqm: hasEnoughSaleData ? avgPricePerSqm : null,
    estimatedRentalYield,
    notEnoughData,
    notes,
    generatedAt: new Date(),
    similarListings: options.includeSimilarListings
      ? matchingListings
          .slice()
          .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
          .slice(0, 8)
          .map(toComparableListing)
      : undefined
  };
}

export async function getApprovedMarketListings(prisma: PrismaLike) {
  return prisma.listing.findMany({
    where: {
      status: 'APPROVED',
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

export async function getMarketInsightForLocation(
  prisma: PrismaLike,
  location: string,
  options: {
    propertyType?: string | null;
    includeSimilarListings?: boolean;
  } = {}
) {
  const listings = await getApprovedMarketListings(prisma);

  return createMarketInsightForLocation(listings, location, options);
}

export async function getNeighborhoodMarketInsights(prisma: PrismaLike) {
  const listings = await getApprovedMarketListings(prisma);

  return MARKET_INSIGHT_NEIGHBORHOODS.map((location) =>
    createMarketInsightForLocation(listings, location)
  );
}

export async function saveMarketInsightSnapshot(
  prisma: PrismaLike,
  insight: MarketInsightResult
) {
  return prisma.marketInsightSnapshot.create({
    data: {
      location: insight.location,
      locationKey: insight.locationKey,
      transaction: insight.transaction ?? null,
      propertyType: insight.propertyType ?? null,
      sampleSizeSale: insight.sampleSizeSale,
      sampleSizeRent: insight.sampleSizeRent,
      avgAskingPrice:
        insight.avgAskingPrice === null ? null : insight.avgAskingPrice.toString(),
      avgRent: insight.avgRent === null ? null : insight.avgRent.toString(),
      avgPricePerSqm:
        insight.avgPricePerSqm === null ? null : insight.avgPricePerSqm.toString(),
      estimatedRentalYield:
        insight.estimatedRentalYield === null
          ? null
          : insight.estimatedRentalYield.toString(),
      notEnoughData: insight.notEnoughData,
      notes: insight.notes
    }
  });
}

export async function refreshNeighborhoodMarketInsightSnapshots(
  prisma: PrismaLike
) {
  const insights = await getNeighborhoodMarketInsights(prisma);

  return Promise.all(
    insights.map((insight) => saveMarketInsightSnapshot(prisma, insight))
  );
}