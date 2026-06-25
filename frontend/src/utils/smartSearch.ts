export type SmartSearchFilters = {
  search?: string;
  transaction?: 'Sale' | 'Rent' | 'Short stay';
  location?: string;
  type?: string;
  buyerEligibility?: string;
  minBeds?: number;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  hasVirtualTour?: boolean;
  hasFloorPlan?: boolean;
};

const eligibilityTerms: Record<string, string> = {
  expat: 'EXPAT_BUYABLE',
  'expat buyable': 'EXPAT_BUYABLE',
  foreigner: 'FOREIGNERS_ALLOWED',
  foreigners: 'FOREIGNERS_ALLOWED',
  'foreigners allowed': 'FOREIGNERS_ALLOWED',
  itc: 'ITC',
  freehold: 'FREEHOLD',
  usufruct: 'USUFRUCT',
  'golden visa': 'GOLDEN_VISA_ELIGIBLE',
  '250k': 'OMR_250K_RESIDENCY_ELIGIBLE',
  '250 k': 'OMR_250K_RESIDENCY_ELIGIBLE',
  '500k': 'OMR_500K_RESIDENCY_ELIGIBLE',
  '500 k': 'OMR_500K_RESIDENCY_ELIGIBLE',
  'company purchase': 'COMPANY_PURCHASE_ALLOWED',
  'gcc nationals': 'GCC_NATIONALS',
  'omani only': 'OMANI_ONLY'
};

const propertyTypeTerms: Record<string, string> = {
  villa: 'Villa',
  villas: 'Villa',
  apartment: 'Apartment',
  apartments: 'Apartment',
  flat: 'Apartment',
  chalet: 'Chalet',
  chalets: 'Chalet',
  penthouse: 'Penthouse',
  penthouses: 'Penthouse',
  land: 'Land',
  plot: 'Land'
};

const knownLocations = [
  'Al Mouj',
  'The Wave',
  'Muscat Hills',
  'Bausher',
  'Bosher',
  'Al Khoud',
  'Qurum',
  'Azaiba',
  'Sifah',
  'Muscat',
  'Muttrah',
  'Seeb',
  'Mawaleh',
  'Ghubrah'
];

function normalizeLocation(value: string) {
  const normalized = value.trim().replace(/[.,!?]+$/g, '');

  if (!normalized) return undefined;

  const known = knownLocations.find(
    (location) => location.toLowerCase() === normalized.toLowerCase()
  );

  return known ?? normalized;
}

function extractLocation(lower: string, original: string) {
  for (const location of knownLocations) {
    if (lower.includes(location.toLowerCase())) {
      return location;
    }
  }

  const match = original.match(
    /\b(?:in|near|around)\s+([A-Z]?[A-Za-z]+(?:\s+[A-Z]?[A-Za-z]+){0,2})/i
  );

  return match ? normalizeLocation(match[1]) : undefined;
}

export function parseSmartPropertySearch(input: string): SmartSearchFilters {
  const text = input.trim();
  const lower = text.toLowerCase();
  const filters: SmartSearchFilters = { search: text };

  if (!text) return filters;

  if (/\b(buy|sale|for sale|purchase)\b/.test(lower)) {
    filters.transaction = 'Sale';
  }

  if (/\b(rent|rental|monthly)\b/.test(lower)) {
    filters.transaction = 'Rent';
  }

  if (/\b(short stay|nightly|holiday|weekend stay)\b/.test(lower)) {
    filters.transaction = 'Short stay';
  }

  const beds = lower.match(/(\d+)\s*(bed|beds|bedroom|bedrooms|br)\b/);
  if (beds) filters.minBeds = Number(beds[1]);

  const under = lower.match(/(?:under|max|below|less than)\s*(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (under) {
    const multiplier =
      under[2] === 'm' ? 1_000_000 : under[2] === 'k' ? 1_000 : 1;
    filters.maxPrice = Number(under[1]) * multiplier;
  }

  const over = lower.match(/(?:over|min|above|more than)\s*(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (over) {
    const multiplier =
      over[2] === 'm' ? 1_000_000 : over[2] === 'k' ? 1_000 : 1;
    filters.minPrice = Number(over[1]) * multiplier;
  }

  for (const [term, value] of Object.entries(eligibilityTerms)) {
    if (lower.includes(term)) {
      filters.buyerEligibility = value;
      break;
    }
  }

  for (const [term, value] of Object.entries(propertyTypeTerms)) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) {
      filters.type = value;
      break;
    }
  }

  const location = extractLocation(lower, text);
  if (location) filters.location = location;

  const amenities: string[] = [];

  if (/\b(pool|private pool|swimming pool)\b/.test(lower)) {
    amenities.push('Private pool');
  }

  if (lower.includes('sea view') || lower.includes('beach view')) {
    amenities.push('Sea view');
  }

  if (lower.includes('parking')) {
    amenities.push('Parking');
  }

  if (lower.includes('garden')) {
    amenities.push('Garden');
  }

  if (lower.includes('furnished')) {
    amenities.push('Furnished');
  }

  if (amenities.length) {
    filters.amenities = [...new Set(amenities)];
  }

  if (
    lower.includes('virtual tour') ||
    lower.includes('360') ||
    lower.includes('matterport') ||
    lower.includes('video walkthrough')
  ) {
    filters.hasVirtualTour = true;
  }

  if (lower.includes('floor plan') || lower.includes('floorplan')) {
    filters.hasFloorPlan = true;
  }

  return filters;
}

export type SmartActivitySearchFilters = {
  search?: string;
  category?: string;
  location?: string;
  travelRegion?: 'INSIDE_OMAN' | 'OUTSIDE_OMAN';
  durationType?: string;
  activityType?: string;
  minPrice?: number;
  maxPrice?: number;
  familyFriendly?: boolean;
  includesTransfer?: boolean;
  mealIncluded?: boolean;
  outdoor?: boolean;
};

const activityCategoryTerms: Record<string, string> = {
  desert: 'Desert',
  sea: 'Sea',
  boat: 'Sea',
  snorkeling: 'Sea',
  culture: 'Culture',
  cultural: 'Culture',
  adventure: 'Adventure',
  mountain: 'Mountain',
  hiking: 'Mountain',
  nature: 'Nature',
  wadi: 'Nature'
};

const activityLocationTerms = [
  'Muscat',
  'Nizwa',
  'Salalah',
  'Jebel Akhdar',
  'Jabal Akhdar',
  'Wahiba',
  'Sur',
  'Dubai',
  'Abu Dhabi',
  'Istanbul',
  'Turkey',
  'Georgia',
  'Azerbaijan',
  'Baku',
  'Maldives',
  'Doha'
];

function extractActivityLocation(lower: string, original: string) {
  for (const location of activityLocationTerms) {
    if (lower.includes(location.toLowerCase())) return location;
  }

  const match = original.match(
    /\b(?:in|near|around|to|from)\s+([A-Z]?[A-Za-z]+(?:\s+[A-Z]?[A-Za-z]+){0,2})/i
  );

  return match ? normalizeLocation(match[1]) : undefined;
}

export function parseSmartActivitySearch(input: string): SmartActivitySearchFilters {
  const text = input.trim();
  const lower = text.toLowerCase();
  const filters: SmartActivitySearchFilters = { search: text };

  if (!text) return filters;

  if (
    lower.includes('outside oman') ||
    lower.includes('travel package') ||
    lower.includes('package') ||
    lower.includes('flight') ||
    lower.includes('hotel') ||
    lower.includes('visa') ||
    lower.includes('dubai') ||
    lower.includes('turkey') ||
    lower.includes('istanbul') ||
    lower.includes('georgia') ||
    lower.includes('baku') ||
    lower.includes('maldives')
  ) {
    filters.travelRegion = 'OUTSIDE_OMAN';
  }

  if (
    lower.includes('inside oman') ||
    lower.includes('local') ||
    lower.includes('wadi') ||
    lower.includes('muscat') ||
    lower.includes('nizwa') ||
    lower.includes('salalah')
  ) {
    filters.travelRegion = 'INSIDE_OMAN';
  }

  for (const [term, value] of Object.entries(activityCategoryTerms)) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) {
      filters.category = value;
      break;
    }
  }

  if (lower.includes('private')) filters.activityType = 'Private';
  if (lower.includes('group')) filters.activityType = 'Group';

  if (lower.includes('overnight')) filters.durationType = 'Overnight';
  if (lower.includes('full day') || lower.includes('fullday')) filters.durationType = 'Full day';
  if (lower.includes('half day') || lower.includes('halfday')) filters.durationType = 'Half day';
  if (lower.includes('short')) filters.durationType = 'Short';

  const under = lower.match(/(?:under|max|below|less than)\s*(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (under) {
    const multiplier =
      under[2] === 'm' ? 1_000_000 : under[2] === 'k' ? 1_000 : 1;
    filters.maxPrice = Number(under[1]) * multiplier;
  }

  const over = lower.match(/(?:over|min|above|more than)\s*(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (over) {
    const multiplier =
      over[2] === 'm' ? 1_000_000 : over[2] === 'k' ? 1_000 : 1;
    filters.minPrice = Number(over[1]) * multiplier;
  }

  const location = extractActivityLocation(lower, text);
  if (location) filters.location = location;

  if (lower.includes('family') || lower.includes('kids') || lower.includes('children')) {
    filters.familyFriendly = true;
  }

  if (lower.includes('transfer') || lower.includes('pickup') || lower.includes('transport')) {
    filters.includesTransfer = true;
  }

  if (lower.includes('meal') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('breakfast')) {
    filters.mealIncluded = true;
  }

  if (lower.includes('outdoor') || lower.includes('hike') || lower.includes('camping') || lower.includes('desert')) {
    filters.outdoor = true;
  }

  return filters;
}
