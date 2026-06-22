import { apiClient } from './client';
import type { ApiBooking, ApiPayment, BookingStatus, PaymentStatus } from './bookings';
import type {
  ActivityStatus,
  ApiActivity,
  ApiDeveloperCompany,
  ApiListing,
  ApiTravelAgency,
  Inquiry,
  ListingStatus
} from '../types';


export type AdminFinanceLedgerItem = {
  id: string;
  bookingId: string;
  bookingStatus: BookingStatus | null;
  bookingTitle: string;
  customerName: string | null;
  customerEmail: string | null;
  providerId: string | null;
  providerName: string | null;
  providerEmail: string | null;
  status: PaymentStatus;
  amount: number;
  commission: number;
  providerPayoutAmount: number;
  payoutReady: boolean;
  payoutBlocked: boolean;
  provider?: string | null;
  reference?: string | null;
  providerSessionId?: string | null;
  checkoutUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminFinanceSummary = {
  totalPayments: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  failedAmount: number;
  totalCommission: number;
  paidCommission: number;
  payoutReadyAmount: number;
  payoutReadyCount: number;
  payoutBlockedAmount: number;
  payoutBlockedCount: number;
};

export type AdminFinance = {
  summary: AdminFinanceSummary;
  ledger: AdminFinanceLedgerItem[];
};

export type AdminFinanceResponse = {
  finance: AdminFinance;
};

export type AdminListingsResponse = {
  listings: ApiListing[];
};

export type AdminActivitiesResponse = {
  activities: ApiActivity[];
};

export type AdminInquiriesResponse = {
  inquiries: Inquiry[];
};

export type AdminBookingsResponse = {
  bookings: ApiBooking[];
  pagination: {
    take: number;
    skip: number;
    count: number;
  };
};

export type TravelAgenciesResponse = {
  travelAgencies: ApiTravelAgency[];
};

export type DevelopersResponse = {
  developers: ApiDeveloperCompany[];
};

export type CreateDeveloperPayload = {
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

export type UpdateDeveloperPayload = Partial<
  Pick<ApiDeveloperCompany, 'verified' | 'featured'>
>;

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

export type UpdateBookingStatusPayload = {
  status: BookingStatus;
};

export type UpdateBookingPaymentStatusPayload = {
  status: PaymentStatus;
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

export async function getAdminBookings(token: string) {
  return apiClient.get<AdminBookingsResponse>('/api/bookings/admin/all', { token });
}

export async function getAdminFinance(token: string) {
  return apiClient.get<AdminFinanceResponse>('/api/bookings/admin/finance', { token });
}

export async function getAdminTravelAgencies(token: string) {
  return apiClient.get<TravelAgenciesResponse>('/api/travel-agencies', { token });
}

export async function getAdminDevelopers(token: string) {
  return apiClient.get<DevelopersResponse>('/api/developers', { token });
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

export async function createAdminDeveloper(
  payload: CreateDeveloperPayload,
  token: string
) {
  return apiClient.post<{ developer: ApiDeveloperCompany }>(
    '/api/developers',
    payload,
    { token }
  );
}

export async function updateAdminDeveloper(
  developerId: string,
  payload: UpdateDeveloperPayload,
  token: string
) {
  return apiClient.patch<{ developer: ApiDeveloperCompany }>(
    `/api/developers/${developerId}`,
    payload,
    { token }
  );
}

export async function deleteAdminDeveloper(developerId: string, token: string) {
  return apiClient.delete<{ ok: boolean; deletedId: string }>(
    `/api/developers/${developerId}`,
    { token }
  );
}

export async function updateAdminBookingStatus(
  bookingId: string,
  payload: UpdateBookingStatusPayload,
  token: string
) {
  return apiClient.patch<{ booking: ApiBooking }>(
    `/api/bookings/admin/${bookingId}/status`,
    payload,
    { token }
  );
}

export async function updateAdminBookingPaymentStatus(
  paymentId: string,
  payload: UpdateBookingPaymentStatusPayload,
  token: string
) {
  return apiClient.patch<{ payment: ApiPayment }>(
    `/api/bookings/admin/payments/${paymentId}`,
    payload,
    { token }
  );
}
