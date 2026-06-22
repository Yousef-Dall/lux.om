import { apiClient } from './client';
import type { ApiActivity, ApiListing } from '../types';

export type BookingStatus =
  | 'PENDING'
  | 'OWNER_APPROVED'
  | 'OWNER_REJECTED'
  | 'ADMIN_CONFIRMED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'NOT_REQUIRED';

export type ApiPayment = {
  id: string;
  amount: string | number;
  commission: string | number;
  status: PaymentStatus;
  provider?: string | null;
  reference?: string | null;
  providerSessionId?: string | null;
  checkoutUrl?: string | null;
  paidAt?: string | null;
  bookingId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiBooking = {
  id: string;
  message?: string | null;
  status: BookingStatus;
  listingId?: string | null;
  listing?: ApiListing | null;
  activityId?: string | null;
  activity?: ApiActivity | null;
  scheduledDate?: string | null;
  preferredTime?: string | null;
  guests: number;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  userId: string;
  payment?: ApiPayment | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookingPayload = {
  listingId?: string;
  activityId?: string;
  scheduledDate?: string;
  preferredTime?: string;
  guests?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  amount?: number;
  commission?: number;
};

export type UpdateOwnerBookingStatusPayload = {
  status: Extract<BookingStatus, 'OWNER_APPROVED' | 'OWNER_REJECTED'>;
};

export async function createBooking(payload: CreateBookingPayload, token: string) {
  return apiClient.post<{ booking: ApiBooking }>('/api/bookings', payload, { token });
}

export async function createPaymentSession(bookingId: string, token: string) {
  return apiClient.post<{ booking: ApiBooking; payment: ApiPayment }>(
    `/api/bookings/${bookingId}/payments/session`,
    {},
    { token }
  );
}

export async function syncBookingPayment(bookingId: string, token: string) {
  return apiClient.post<{ booking: ApiBooking; payment: ApiPayment }>(
    `/api/bookings/${bookingId}/payments/sync`,
    {},
    { token }
  );
}

export async function updateOwnerBookingStatus(
  bookingId: string,
  payload: UpdateOwnerBookingStatusPayload,
  token: string
) {
  return apiClient.patch<{ booking: ApiBooking }>(
    `/api/bookings/${bookingId}/owner-status`,
    payload,
    { token }
  );
}
