import { apiClient } from './client';
import type {
  ActivityStatus,
  ApiActivity,
  ApiListing,
  ApiTravelAgency,
  Inquiry,
  ListingStatus
} from '../types';

export type AdminListingsResponse = {
  listings: ApiListing[];
};

export type AdminActivitiesResponse = {
  activities: ApiActivity[];
};

export type AdminInquiriesResponse = {
  inquiries: Inquiry[];
};

export type TravelAgenciesResponse = {
  travelAgencies: ApiTravelAgency[];
};

export type CreateTravelAgencyPayload = {
  nameEn: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  headquartersEn?: string;
  headquartersAr?: string;
  logo?: string;
  phone?: string;
  email?: string;
  website?: string;
  establishedYear?: number;
  verified: boolean;
  featured: boolean;
};

export type UpdateTravelAgencyPayload = Partial<
  Pick<ApiTravelAgency, 'verified' | 'featured'>
>;

export type UpdateListingStatusPayload = {
  status: ListingStatus;
  rejectedReason?: string;
};

export type UpdateActivityStatusPayload = {
  status: ActivityStatus;
  rejectedReason?: string;
};

export async function getAdminListings(token: string) {
  return apiClient.get<AdminListingsResponse>('/api/listings/admin/all', { token });
}

export async function getAdminActivities(token: string) {
  return apiClient.get<AdminActivitiesResponse>('/api/activities/admin/all', { token });
}

export async function getAdminInquiries(token: string) {
  return apiClient.get<AdminInquiriesResponse>('/api/inquiries/admin/all', { token });
}

export async function getAdminTravelAgencies(token: string) {
  return apiClient.get<TravelAgenciesResponse>('/api/travel-agencies', { token });
}

export async function updateAdminListingStatus(
  listingId: string,
  payload: UpdateListingStatusPayload,
  token: string
) {
  return apiClient.patch<{ listing: ApiListing }>(
    `/api/listings/admin/${listingId}/status`,
    payload,
    { token }
  );
}

export async function updateAdminActivityStatus(
  activityId: string,
  payload: UpdateActivityStatusPayload,
  token: string
) {
  return apiClient.patch<{ activity: ApiActivity }>(
    `/api/activities/admin/${activityId}/status`,
    payload,
    { token }
  );
}

export async function createAdminTravelAgency(
  payload: CreateTravelAgencyPayload,
  token: string
) {
  return apiClient.post<{ travelAgency: ApiTravelAgency }>(
    '/api/travel-agencies',
    payload,
    { token }
  );
}

export async function updateAdminTravelAgency(
  agencyId: string,
  payload: UpdateTravelAgencyPayload,
  token: string
) {
  return apiClient.patch<{ travelAgency: ApiTravelAgency }>(
    `/api/travel-agencies/${agencyId}`,
    payload,
    { token }
  );
}

export async function deleteAdminTravelAgency(agencyId: string, token: string) {
  return apiClient.delete<{ ok: boolean; deletedId: string }>(
    `/api/travel-agencies/${agencyId}`,
    { token }
  );
}