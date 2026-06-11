import { apiClient } from './client';
import type { Inquiry, InquiryType } from '../types';

export type CreateInquiryPayload = {
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  message: string;
  listingId?: string;
  activityId?: string;
};

export async function createInquiry(payload: CreateInquiryPayload) {
  return apiClient.post<{ inquiry: Inquiry }>('/api/inquiries', payload);
}