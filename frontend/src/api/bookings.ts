import { apiClient } from './client';
import type { ApiActivity, ApiListing } from '../types';

export type BookingStatus =
  | 'PENDING'
  | 'OWNER_APPROVED'
  | 'OWNER_REJECTED'
  | 'ADMIN_CONFIRMED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'NOT_REQUIRED';

export type ApiBookingEvent = {
  id: string;
  type: string;
  message: string | null;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  actorId: string | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  bookingId: string;
  createdAt: string;
};

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

export type ApiBookingReceipt = {
  receiptNumber: string;
  bookingId: string;
  bookingStatus: BookingStatus;
  bookingTitle: string;
  bookingType: string;
  bookingLocation?: string | null;
  bookingDate?: string | null;
  preferredTime?: string | null;
  guests: number;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  provider?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    type?: string | null;
  } | null;
  paymentId: string;
  amount: string | number;
  commission: string | number;
  providerPayoutAmount?: string | number | null;
  currency: string;
  status: PaymentStatus;
  providerName?: string | null;
  reference?: string | null;
  thawaniSessionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  note?: string | null;
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
  cancellationReason?: string | null;
  cancellationRequestedAt?: string | null;
  userId: string;
  payment?: ApiPayment | null;
  createdAt: string;
  updatedAt: string;
  events?: ApiBookingEvent[];
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
};

export type UpdateOwnerBookingStatusPayload = {
  status: Extract<BookingStatus, 'OWNER_APPROVED' | 'OWNER_REJECTED'>;
};

export type RequestBookingCancellationPayload = {
  reason: string;
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


export async function requestBookingCancellation(
  bookingId: string,
  payload: RequestBookingCancellationPayload,
  token: string
) {
  return apiClient.patch<{ booking: ApiBooking }>(
    `/api/bookings/${bookingId}/cancellation-request`,
    payload,
    { token }
  );
}


export async function getBookingReceipt(bookingId: string, token: string) {
  return apiClient.get<{ receipt: ApiBookingReceipt }>(
    `/api/bookings/${bookingId}/receipt`,
    { token }
  );
}
