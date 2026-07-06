import { apiClient } from './client';
import type {
  ApiListing,
  ListingBuyerEligibility,
  ListingFurnishing,
  ListingTransaction,
  ListingView,
  PaymentFrequency,
  PriceQualifier,
  PriceUnit
} from '../types';

export type CreateListingPayload = {
  title: string;
  description: string;
  type: string;
  transaction: ListingTransaction;
  buyerEligibility?: ListingBuyerEligibility[];
  location: string;

  /**
   * Legacy display price remains supported while forms migrate.
   */
  price?: string;

  priceAmount?: string | number;
  priceCurrency?: string;
  priceQualifier?: PriceQualifier;
  priceUnit?: PriceUnit;

  beds: number;
  baths: number;
  sqm: number;
  image: string;
  images?: Array<{
    url: string;
    altEn?: string;
    altAr?: string;
    sortOrder?: number;
  }>;
  videoWalkthroughUrl?: string;
  tour360Url?: string;
  virtualTourUrl?: string;
  floorPlanUrl?: string;
  premiumMedia?: Array<{
    type: string;
    url: string;
    provider?: string;
    titleEn?: string;
    titleAr?: string;
    altEn?: string;
    altAr?: string;
    sortOrder?: number;
    isPrimary?: boolean;
  }>;
  eligibilityNotes?: string;
  eligibilityDisclaimer?: string;
  investorHighlights?: string[];
  amenities: string[];

  developerId?: string;
  developerProjectId?: string;
  developerNameEn?: string;
  developerNameAr?: string;
  nearestLandmarkId?: string;
  distanceFromLandmark?: string;

  minStayNights?: number;
  maxGuests?: number;
  parkingSpaces?: number;
  floorNumber?: number;
  furnishing?: ListingFurnishing;
  view?: ListingView;
  paymentFrequency?: PaymentFrequency;
};

export async function createListing(payload: CreateListingPayload, token: string) {
  return apiClient.post<{ listing: ApiListing }>('/api/listings', payload, { token });
}