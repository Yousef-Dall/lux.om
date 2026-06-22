import { describe, expect, it } from 'vitest';

import {
  createMarketInsightForLocation,
  normalizeLocationKey
} from '../src/services/marketInsights';

const baseListing = {
  title: 'Listing',
  titleEn: 'Listing',
  location: 'Al Mouj',
  locationEn: 'Al Mouj',
  type: 'Apartment',
  typeEn: 'Apartment',
  sqm: 100,
  beds: 2,
  baths: 2,
  status: 'APPROVED' as const,
  createdAt: new Date('2026-01-01')
};

describe('Stage 8 market insights', () => {
  it('normalizes Oman location keys consistently', () => {
    expect(normalizeLocationKey('The Wave / Al Mouj')).toBe('the-wave-al-mouj');
  });

  it('uses only lux.om listing samples and marks low-data markets safely', () => {
    const insight = createMarketInsightForLocation(
      [
        {
          ...baseListing,
          id: 'sale-1',
          transaction: 'Sale',
          priceAmount: '100000',
          priceUnit: 'TOTAL'
        },
        {
          ...baseListing,
          id: 'rent-1',
          transaction: 'Rent',
          priceAmount: '800',
          priceUnit: 'MONTH'
        }
      ] as any,
      'Al Mouj',
      { includeSimilarListings: true }
    );

    expect(insight.sampleSizeSale).toBe(1);
    expect(insight.sampleSizeRent).toBe(1);
    expect(insight.notEnoughData).toBe(true);
    expect(insight.avgAskingPrice).toBeNull();
    expect(insight.notes).toContain('Not enough lux.om listing data');
    expect(insight.similarListings).toHaveLength(2);
  });
});
