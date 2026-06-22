import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function getReviews(params: { targetType?: string; targetId?: string; take?: number; skip?: number }) {
  return apiClient.get<{ reviews: JsonRecord[] }>('/api/reviews', { params });
}

export async function createReview(payload: JsonRecord, token: string) {
  return apiClient.post<{ review: JsonRecord }>('/api/reviews', payload, { token });
}

export async function getAdminReviews(token: string) {
  return apiClient.get<{ reviews: JsonRecord[] }>('/api/reviews/admin/all', { token });
}
