import type { Language, ListingBuyerEligibility } from '../types';

export const listingBuyerEligibilityOptions: ListingBuyerEligibility[] = [
  'OMANI_ONLY',
  'GCC_NATIONALS',
  'OMAN_RESIDENTS',
  'FOREIGNERS_ALLOWED',
  'COMPANY_PURCHASE_ALLOWED',
  'FREEHOLD',
  'USUFRUCT'
];

const buyerEligibilityLabels: Record<
  ListingBuyerEligibility,
  Record<Language, string>
> = {
  OMANI_ONLY: {
    en: 'Omanis only',
    ar: 'للعُمانيين فقط'
  },
  GCC_NATIONALS: {
    en: 'GCC nationals',
    ar: 'لمواطني دول الخليج'
  },
  OMAN_RESIDENTS: {
    en: 'Oman residents',
    ar: 'للمقيمين في عُمان'
  },
  FOREIGNERS_ALLOWED: {
    en: 'Foreigners allowed',
    ar: 'مسموح للأجانب'
  },
  COMPANY_PURCHASE_ALLOWED: {
    en: 'Company purchase allowed',
    ar: 'مسموح شراء الشركات'
  },
  FREEHOLD: {
    en: 'Freehold',
    ar: 'تملك حر'
  },
  USUFRUCT: {
    en: 'Usufruct',
    ar: 'حق انتفاع'
  }
};

export function formatListingBuyerEligibility(
  value: ListingBuyerEligibility,
  language: Language
) {
  return buyerEligibilityLabels[value]?.[language] ?? value;
}

export function formatListingBuyerEligibilityList(
  values: ListingBuyerEligibility[],
  language: Language
) {
  const separator = language === 'ar' ? '، ' : ', ';

  return values
    .map((value) => formatListingBuyerEligibility(value, language))
    .join(separator);
}
