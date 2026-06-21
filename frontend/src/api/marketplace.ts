import { apiClient } from './client';
import {
  mapActivity,
  mapDeveloperCompany,
  mapLandmark,
  mapListing,
  mapTravelAgency
} from './mappers';

import type {
  Activity,
  ApiActivity,
  ApiDeveloperCompany,
  ApiLandmark,
  ApiListResponse,
  ApiPagination,
  ApiListing,
  ApiTravelAgency,
  DevelopmentCompany,
  Landmark,
  Language,
  Listing,
  TravelAgency
} from '../types';

type ListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  take?: number;
  skip?: number;
};

export type MarketplacePagination = {
  take: number;
  skip: number;
  count: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type MarketplacePage<T> = {
  items: T[];
  pagination: MarketplacePagination;
};

function normalizePagination(
  pagination: ApiPagination
): MarketplacePagination {
  const pageSize = pagination.pageSize ?? pagination.take;
  const page =
    pagination.page ??
    Math.floor(pagination.skip / Math.max(pageSize, 1)) + 1;
  const total = pagination.total ?? pagination.skip + pagination.count;
  const totalPages =
    pagination.totalPages ??
    (total === 0 ? 0 : Math.ceil(total / Math.max(pageSize, 1)));

  return {
    take: pagination.take,
    skip: pagination.skip,
    count: pagination.count,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage:
      pagination.hasNextPage ?? page < totalPages,
    hasPreviousPage:
      pagination.hasPreviousPage ?? page > 1
  };
}

type ListingParams = ListParams & {
  sort?:
    | 'recommended'
    | 'newest'
    | 'price_asc'
    | 'price_desc'
    | 'area_desc';
  transaction?: string;
  type?: string;
  location?: string;
  nearestLandmarkId?: string;
  developerId?: string;
  minBeds?: number;
  minBaths?: number;
  minSqm?: number;
  minGuests?: number;
  minParking?: number;
  minPrice?: number;
  maxPrice?: number;
  furnishing?: string;
  view?: string;
  amenities?: string;
};

type ActivityParams = ListParams & {
  sort?:
    | 'recommended'
    | 'newest'
    | 'price_asc'
    | 'price_desc';
  category?: string;
  difficulty?: string;
  location?: string;
  nearestLandmarkId?: string;
  travelAgencyId?: string;

  availableDay?: string;
  availableFrom?: string;
  availableUntil?: string;

  durationType?: string;
  activityType?: string;

  familyFriendly?: boolean;
  includesTransfer?: boolean;
  mealIncluded?: boolean;
  outdoor?: boolean;
  featured?: boolean;

  minPrice?: number;
  maxPrice?: number;
};

type DeveloperParams = ListParams & {
  featured?: boolean;
  verified?: boolean;
};

type TravelAgencyParams = ListParams & {
  featured?: boolean;
  verified?: boolean;
};

type LandmarkParams = ListParams & {
  city?: string;
  category?: string;
};

export async function getListingsPage(
  language: Language,
  params?: ListingParams
): Promise<MarketplacePage<Listing>> {
  const response = await apiClient.get<
    ApiListResponse<ApiListing, 'listings'>
  >('/api/listings', {
    params
  });

  return {
    items: response.listings.map((listing) =>
      mapListing(listing, language)
    ),
    pagination: normalizePagination(response.pagination)
  };
}

export async function getListings(
  language: Language,
  params?: ListingParams
): Promise<Listing[]> {
  const result = await getListingsPage(language, params);

  return result.items;
}

export async function getListingBySlug(
  slug: string,
  language: Language
): Promise<Listing> {
  const response = await apiClient.get<{ listing: ApiListing }>(`/api/listings/${slug}`);

  return mapListing(response.listing, language);
}

export async function getActivitiesPage(
  language: Language,
  params?: ActivityParams
): Promise<MarketplacePage<Activity>> {
  const response = await apiClient.get<
    ApiListResponse<ApiActivity, 'activities'>
  >('/api/activities', {
    params
  });

  return {
    items: response.activities.map((activity) =>
      mapActivity(activity, language)
    ),
    pagination: normalizePagination(response.pagination)
  };
}

export async function getActivities(
  language: Language,
  params?: ActivityParams
): Promise<Activity[]> {
  const result = await getActivitiesPage(language, params);

  return result.items;
}

export async function getActivityBySlug(
  slug: string,
  language: Language
): Promise<Activity> {
  const response = await apiClient.get<{ activity: ApiActivity }>(`/api/activities/${slug}`);

  return mapActivity(response.activity, language);
}

export async function getDevelopers(
  language: Language,
  params?: DeveloperParams
): Promise<DevelopmentCompany[]> {
  const response = await apiClient.get<ApiListResponse<ApiDeveloperCompany, 'developers'>>(
    '/api/developers',
    {
      params
    }
  );

  return response.developers.map((developer) => mapDeveloperCompany(developer, language));
}

export async function getDeveloperBySlug(
  slug: string,
  language: Language
): Promise<DevelopmentCompany> {
  const response = await apiClient.get<{ developer: ApiDeveloperCompany }>(
    `/api/developers/${slug}`
  );

  return mapDeveloperCompany(response.developer, language);
}

export async function getTravelAgencies(
  language: Language,
  params?: TravelAgencyParams
): Promise<TravelAgency[]> {
  const response = await apiClient.get<ApiListResponse<ApiTravelAgency, 'travelAgencies'>>(
    '/api/travel-agencies',
    {
      params
    }
  );

  return response.travelAgencies.map((agency) => mapTravelAgency(agency, language));
}

export async function getTravelAgencyBySlug(
  slug: string,
  language: Language
): Promise<TravelAgency> {
  const response = await apiClient.get<{ travelAgency: ApiTravelAgency }>(
    `/api/travel-agencies/${slug}`
  );

  return mapTravelAgency(response.travelAgency, language);
}

export async function getLandmarks(
  language: Language,
  params?: LandmarkParams
): Promise<Landmark[]> {
  const response = await apiClient.get<ApiListResponse<ApiLandmark, 'landmarks'>>(
    '/api/landmarks',
    {
      params
    }
  );

  return response.landmarks.map((landmark) => mapLandmark(landmark, language));
}

export async function getLandmarkBySlug(
  slug: string,
  language: Language
): Promise<Landmark> {
  const response = await apiClient.get<{ landmark: ApiLandmark }>(`/api/landmarks/${slug}`);

  return mapLandmark(response.landmark, language);
}