import { describe, expect, it } from 'vitest';

import { deriveStructuredPrice } from '../src/utils/pricing';

describe('deriveStructuredPrice', () => {
  it('structures a total OMR sale price', () => {
    expect(
      deriveStructuredPrice(
        'OMR 1,250,000',
        'Total sale price'
      )
    ).toEqual({
      priceAmount: '1250000',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'TOTAL'
    });
  });

  it('structures a monthly price', () => {
    expect(
      deriveStructuredPrice('OMR 2,800 /mo')
    ).toEqual({
      priceAmount: '2800',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'MONTH'
    });
  });

  it('recognizes a starting price', () => {
    expect(
      deriveStructuredPrice('From OMR 95')
    ).toEqual({
      priceAmount: '95',
      priceCurrency: 'OMR',
      priceQualifier: 'FROM',
      priceUnit: null
    });
  });

  it('recognizes an Arabic starting OMR price', () => {
    expect(
      deriveStructuredPrice('ابتداءً من 45 ر.ع')
    ).toEqual({
      priceAmount: '45',
      priceCurrency: 'OMR',
      priceQualifier: 'FROM',
      priceUnit: null
    });
  });

  it('recognizes an on-request price', () => {
    expect(
      deriveStructuredPrice('Price on request')
    ).toEqual({
      priceAmount: null,
      priceCurrency: null,
      priceQualifier: 'ON_REQUEST',
      priceUnit: null
    });
  });

  it('recognizes a per-person activity price', () => {
    expect(
      deriveStructuredPrice('OMR 35 per person')
    ).toEqual({
      priceAmount: '35',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'PERSON'
    });
  });
});
