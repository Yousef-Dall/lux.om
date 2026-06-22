import { describe, expect, it } from 'vitest';

import { createDeterministicValuation } from '../src/services/valuation';

const comparable = {
  title: 'Comparable',
  titleEn: 'Comparable',
  location: 'Al Mouj',
  locationEn: 'Al Mouj',
  type: 'Apartment',
  typeEn: 'Apartment',
  transaction: 'Sale',
  priceUnit: 'TOTAL',
  sqm: 100,
  beds: 2,
  baths: 2,
  status: 'APPROVED' as const
};

describe('Stage 8 valuation', () => {
  it('returns low-data output instead of a fake valuation when samples are insufficient', () => {
    const result = createDeterministicValuation(
      [
        {
          ...comparable,
          id: 'listing-1',
          priceAmount: '100000',
          createdAt: new Date('2026-01-01')
        }
      ] as any,
      {
        location: 'Al Mouj',
        propertyType: 'Apartment',
        sqm: 100,
        beds: 2,
        baths: 2
      }
    );

    expect(result.confidence).toBe('LOW_DATA');
    expect(result.estimateLow).toBeNull();
    expect(result.disclaimer).toContain('not a formal appraisal');
  });

  it('creates a deterministic estimate range when enough comparable data exists', () => {
    const result = createDeterministicValuation(
      Array.from({ length: 3 }, (_, index) => ({
        ...comparable,
        id: `listing-${index + 1}`,
        priceAmount: String(100000 + index * 10000),
        createdAt: new Date(`2026-01-0${index + 1}`)
      })) as any,
      {
        location: 'Al Mouj',
        propertyType: 'Apartment',
        sqm: 100,
        beds: 2,
        baths: 2
      }
    );

    expect(result.confidence).toBe('MEDIUM_DATA');
    expect(result.estimateLow).toBeGreaterThan(0);
    expect(result.estimateHigh).toBeGreaterThan(result.estimateLow ?? 0);
    expect(result.comparableSnapshots).toHaveLength(3);
  });
});
