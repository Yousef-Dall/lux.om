export type SmartSearchFilters = {
  search?: string;
  transaction?: 'Sale' | 'Rent' | 'Short stay';
  location?: string;
  type?: string;
  buyerEligibility?: string;
  minBeds?: number;
  minPrice?: number;
  maxPrice?: number;
  hasVirtualTour?: boolean;
  hasFloorPlan?: boolean;
};

const eligibilityTerms: Record<string, string> = {
  expat: 'EXPAT_BUYABLE',
  foreigner: 'FOREIGNERS_ALLOWED',
  foreigners: 'FOREIGNERS_ALLOWED',
  itc: 'ITC',
  freehold: 'FREEHOLD',
  usufruct: 'USUFRUCT',
  'golden visa': 'GOLDEN_VISA_ELIGIBLE'
};

export function parseSmartPropertySearch(input: string): SmartSearchFilters {
  const text = input.trim();
  const lower = text.toLowerCase();
  const filters: SmartSearchFilters = { search: text };

  if (/\b(buy|sale|for sale)\b/.test(lower)) filters.transaction = 'Sale';
  if (/\b(rent|rental)\b/.test(lower)) filters.transaction = 'Rent';
  if (/\b(short stay|nightly|holiday)\b/.test(lower)) filters.transaction = 'Short stay';

  const beds = lower.match(/(\d+)\s*(bed|bedroom|br)\b/);
  if (beds) filters.minBeds = Number(beds[1]);

  const under = lower.match(/(?:under|max|below)\s*(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (under) {
    const multiplier = under[2] === 'm' ? 1_000_000 : under[2] === 'k' ? 1_000 : 1;
    filters.maxPrice = Number(under[1]) * multiplier;
  }

  for (const [term, value] of Object.entries(eligibilityTerms)) {
    if (lower.includes(term)) {
      filters.buyerEligibility = value;
      break;
    }
  }

  if (lower.includes('virtual tour') || lower.includes('360')) filters.hasVirtualTour = true;
  if (lower.includes('floor plan')) filters.hasFloorPlan = true;

  return filters;
}
