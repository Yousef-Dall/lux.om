import { describe, expect, it } from 'vitest';

import {
  getLinkedPartnerTier,
  getManualPartnerTier,
  PARTNER_TIER,
  resolvePartnerStatus
} from '../src/utils/partnerTier';

describe('resolvePartnerStatus', () => {
  it('automatically verifies a featured partner', () => {
    expect(
      resolvePartnerStatus(
        {
          verified: false,
          featured: false
        },
        {
          featured: true
        }
      )
    ).toEqual({
      verified: true,
      featured: true
    });
  });

  it('removes featured status when verification is removed', () => {
    expect(
      resolvePartnerStatus(
        {
          verified: true,
          featured: true
        },
        {
          verified: false
        }
      )
    ).toEqual({
      verified: false,
      featured: false
    });
  });

  it('preserves unchanged partner fields', () => {
    expect(
      resolvePartnerStatus(
        {
          verified: true,
          featured: true
        },
        {
          featured: false
        }
      )
    ).toEqual({
      verified: true,
      featured: false
    });
  });
});

describe('getLinkedPartnerTier', () => {
  it('returns the featured tier for featured verified partners', () => {
    expect(
      getLinkedPartnerTier({
        verified: true,
        featured: true
      })
    ).toBe(PARTNER_TIER.FEATURED);
  });

  it('returns the verified tier for verified partners', () => {
    expect(
      getLinkedPartnerTier({
        verified: true,
        featured: false
      })
    ).toBe(PARTNER_TIER.VERIFIED);
  });

  it('returns the manual tier for unverified linked partners', () => {
    expect(
      getLinkedPartnerTier({
        verified: false,
        featured: false
      })
    ).toBe(PARTNER_TIER.UNVERIFIED_OR_MANUAL);
  });
});

describe('getManualPartnerTier', () => {
  it('detects a manually entered partner name', () => {
    expect(
      getManualPartnerTier(undefined, '  Manual Agency  ')
    ).toBe(PARTNER_TIER.UNVERIFIED_OR_MANUAL);
  });

  it('returns no tier when all names are empty', () => {
    expect(
      getManualPartnerTier(undefined, null, '', '   ')
    ).toBe(PARTNER_TIER.NONE);
  });
});
