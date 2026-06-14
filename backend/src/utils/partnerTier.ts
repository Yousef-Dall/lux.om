export const PARTNER_TIER = {
  NONE: 0,
  UNVERIFIED_OR_MANUAL: 1,
  VERIFIED: 2,
  FEATURED: 3
} as const;

export type PartnerStatus = {
  verified: boolean;
  featured: boolean;
};

export function resolvePartnerStatus(
  current: PartnerStatus,
  changes: Partial<PartnerStatus>
): PartnerStatus {
  if (changes.featured === true) {
    return {
      featured: true,
      verified: true
    };
  }

  if (changes.verified === false) {
    return {
      featured: false,
      verified: false
    };
  }

  return {
    featured: changes.featured ?? current.featured,
    verified: changes.verified ?? current.verified
  };
}

export function getLinkedPartnerTier(partner: PartnerStatus) {
  if (partner.featured && partner.verified) {
    return PARTNER_TIER.FEATURED;
  }

  if (partner.verified) {
    return PARTNER_TIER.VERIFIED;
  }

  return PARTNER_TIER.UNVERIFIED_OR_MANUAL;
}

export function getManualPartnerTier(...names: Array<string | null | undefined>) {
  return names.some((name) => Boolean(name?.trim()))
    ? PARTNER_TIER.UNVERIFIED_OR_MANUAL
    : PARTNER_TIER.NONE;
}
