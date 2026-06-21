import { apiClient } from './client';

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

export async function createBooking(payload: CreateBookingPayload, token: string) {
  return apiClient.post<{ booking: unknown }>('/api/bookings', payload, { token });
}
