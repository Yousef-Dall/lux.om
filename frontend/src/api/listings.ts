import { apiClient } from './client';
import type {
  ApiListing,
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
  amenities: string[];

  developerId?: string;
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