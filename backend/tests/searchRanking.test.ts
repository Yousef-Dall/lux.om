import { describe, expect, it } from 'vitest';

import {
  buildSearchRelevance,
  paginateExplicitlySortedIds,
  paginateRankedIds,
  parseSortablePrice,
  restoreRankedOrder,
  type ExplicitSortCandidate,
  type RankedSearchCandidate
} from '../src/utils/searchRanking';

const oldest = new Date('2026-01-01T00:00:00.000Z');
const older = new Date('2026-02-01T00:00:00.000Z');
const newer = new Date('2026-03-01T00:00:00.000Z');
const newest = new Date('2026-04-01T00:00:00.000Z');

describe('buildSearchRelevance', () => {
  it('scores exact, prefix, contained, and missing matches', () => {
    expect(
      buildSearchRelevance('villa', [
        ['Villa'],
        ['Villa Heights'],
        ['Beach villa home'],
        ['Apartment']
      ])
    ).toEqual([3, 2, 1, 0]);
  });

  it('normalizes casing and surrounding whitespace', () => {
    expect(
      buildSearchRelevance('  MUSCAT  ', [
        ['muscat'],
        ['Muscat Hills']
      ])
    ).toEqual([3, 2]);
  });

  it('uses the strongest value inside each relevance group', () => {
    expect(
      buildSearchRelevance('villa', [
        ['Apartment', 'Villa'],
        ['Beach villa home', 'Villa Gardens']
      ])
    ).toEqual([3, 2]);
  });
});

describe('paginateRankedIds', () => {
  it('prioritizes higher relevance before partner tier', () => {
    const candidates: RankedSearchCandidate[] = [
      {
        id: 'exact-title',
        relevance: [3, 0],
        partnerTier: 0,
        qualityScore: 0,
        createdAt: oldest
      },
      {
        id: 'prefix-secondary-field',
        relevance: [2, 3],
        partnerTier: 3,
        qualityScore: 100,
        createdAt: newest
      }
    ];

    expect(
      paginateRankedIds(candidates, 0, 10)
    ).toEqual([
      'exact-title',
      'prefix-secondary-field'
    ]);
  });

  it('uses partner tier, quality, freshness, and id as tie-breakers', () => {
    const candidates: RankedSearchCandidate[] = [
      {
        id: 'quality',
        relevance: [1],
        partnerTier: 1,
        qualityScore: 10,
        createdAt: oldest
      },
      {
        id: 'partner',
        relevance: [1],
        partnerTier: 2,
        qualityScore: 0,
        createdAt: oldest
      },
      {
        id: 'fresh',
        relevance: [1],
        partnerTier: 1,
        qualityScore: 10,
        createdAt: newer
      },
      {
        id: 'alpha',
        relevance: [1],
        partnerTier: 1,
        qualityScore: 10,
        createdAt: newer
      }
    ];

    expect(
      paginateRankedIds(candidates, 0, 10)
    ).toEqual([
      'partner',
      'alpha',
      'fresh',
      'quality'
    ]);
  });

  it('applies skip and take after ranking', () => {
    const candidates: RankedSearchCandidate[] = [
      {
        id: 'first',
        relevance: [3],
        partnerTier: 0,
        qualityScore: 0,
        createdAt: oldest
      },
      {
        id: 'second',
        relevance: [2],
        partnerTier: 0,
        qualityScore: 0,
        createdAt: oldest
      },
      {
        id: 'third',
        relevance: [1],
        partnerTier: 0,
        qualityScore: 0,
        createdAt: oldest
      }
    ];

    expect(
      paginateRankedIds(candidates, 1, 1)
    ).toEqual(['second']);
  });
});

describe('restoreRankedOrder', () => {
  it('restores fetched records to their ranked id order', () => {
    const records = [
      { id: 'third', title: 'Third' },
      { id: 'first', title: 'First' },
      { id: 'second', title: 'Second' }
    ];

    expect(
      restoreRankedOrder(records, [
        'first',
        'second',
        'missing',
        'third'
      ])
    ).toEqual([
      { id: 'first', title: 'First' },
      { id: 'second', title: 'Second' },
      { id: 'third', title: 'Third' }
    ]);
  });
});

describe('parseSortablePrice', () => {
  it.each([
    ['OMR 1,250,000', 1_250_000],
    ['OMR 2,800 /mo', 2_800],
    ['From OMR 95.50', 95.5],
    ['100', 100]
  ])('parses %s as %s', (input, expected) => {
    expect(parseSortablePrice(input)).toBe(expected);
  });

  it.each([
    ['Price on request'],
    ['Contact us'],
    [''],
    [null],
    [undefined]
  ])('returns null for %s', (input) => {
    expect(parseSortablePrice(input)).toBeNull();
  });
});

describe('paginateExplicitlySortedIds', () => {
  const candidates: ExplicitSortCandidate[] = [
    {
      id: 'low',
      price: 'OMR 2,800 /mo',
      area: 420,
      partnerTier: 0,
      createdAt: oldest
    },
    {
      id: 'high',
      price: 'OMR 1,250,000',
      area: 650,
      partnerTier: 0,
      createdAt: older
    },
    {
      id: 'missing',
      price: null,
      area: 12,
      partnerTier: 1,
      createdAt: newer
    },
    {
      id: 'request',
      price: 'Price on request',
      area: null,
      partnerTier: 3,
      createdAt: newest
    }
  ];

  it('sorts numeric prices ascending and leaves nonnumeric prices last', () => {
    expect(
      paginateExplicitlySortedIds(
        candidates,
        'price_asc',
        0,
        10
      )
    ).toEqual([
      'low',
      'high',
      'request',
      'missing'
    ]);
  });

  it('sorts numeric prices descending and leaves nonnumeric prices last', () => {
    expect(
      paginateExplicitlySortedIds(
        candidates,
        'price_desc',
        0,
        10
      )
    ).toEqual([
      'high',
      'low',
      'request',
      'missing'
    ]);
  });

  it('sorts area descending and leaves missing areas last', () => {
    expect(
      paginateExplicitlySortedIds(
        candidates,
        'area_desc',
        0,
        10
      )
    ).toEqual([
      'high',
      'low',
      'missing',
      'request'
    ]);
  });

  it('sorts newest records first', () => {
    expect(
      paginateExplicitlySortedIds(
        candidates,
        'newest',
        0,
        10
      )
    ).toEqual([
      'request',
      'missing',
      'high',
      'low'
    ]);
  });

  it('applies pagination after explicit sorting', () => {
    expect(
      paginateExplicitlySortedIds(
        candidates,
        'price_asc',
        1,
        2
      )
    ).toEqual([
      'high',
      'request'
    ]);
  });
});
