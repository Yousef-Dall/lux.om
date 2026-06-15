import { describe, expect, it } from 'vitest';

import {
  deriveStructuredPrice,
  formatStructuredPrice,
  resolvePriceInput
} from '../src/utils/pricing';

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

  it('recognizes Arabic digits and currency', () => {
    expect(
      deriveStructuredPrice('ابتداءً من ٤٥ ر.ع')
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

  it('does not mistake per for a currency', () => {
    expect(
      deriveStructuredPrice('35 per person')
    ).toEqual({
      priceAmount: '35',
      priceCurrency: null,
      priceQualifier: 'FIXED',
      priceUnit: 'PERSON'
    });
  });
});

describe('formatStructuredPrice', () => {
  it('formats a monthly OMR amount', () => {
    expect(
      formatStructuredPrice({
        priceAmount: '2800',
        priceCurrency: 'OMR',
        priceQualifier: 'FIXED',
        priceUnit: 'MONTH'
      })
    ).toBe('OMR 2,800 /mo');
  });

  it('formats a starting per-person amount', () => {
    expect(
      formatStructuredPrice({
        priceAmount: '95',
        priceCurrency: 'OMR',
        priceQualifier: 'FROM',
        priceUnit: 'PERSON'
      })
    ).toBe('From OMR 95 /person');
  });

  it('formats on-request pricing', () => {
    expect(
      formatStructuredPrice({
        priceAmount: null,
        priceCurrency: null,
        priceQualifier: 'ON_REQUEST',
        priceUnit: null
      })
    ).toBe('Price on request');
  });
});

describe('resolvePriceInput', () => {
  it('preserves a legacy display price', () => {
    expect(
      resolvePriceInput({
        displayPrice: 'OMR 900 /mo'
      })
    ).toEqual({
      price: 'OMR 900 /mo',
      priceAmount: '900',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'MONTH'
    });
  });

  it('creates a canonical display price from structured fields', () => {
    expect(
      resolvePriceInput({
        priceAmount: '2800',
        priceCurrency: 'omr',
        priceQualifier: 'FIXED',
        priceUnit: 'MONTH'
      })
    ).toEqual({
      price: 'OMR 2,800 /mo',
      priceAmount: '2800',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'MONTH'
    });
  });

  it('creates an on-request display price', () => {
    expect(
      resolvePriceInput({
        priceQualifier: 'ON_REQUEST'
      })
    ).toEqual({
      price: 'Price on request',
      priceAmount: null,
      priceCurrency: null,
      priceQualifier: 'ON_REQUEST',
      priceUnit: null
    });
  });

  it('rejects fixed structured pricing without an amount', () => {
    expect(() =>
      resolvePriceInput({
        priceQualifier: 'FIXED',
        priceCurrency: 'OMR'
      })
    ).toThrow(
      'A numeric amount is required for fixed and starting prices'
    );
  });
});
