import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export type CreateValuationPayload = {
  location: string;
  propertyType?: string;
  sqm?: number;
  beds?: number;
  baths?: number;
  askingPrice?: number;
  rentEstimate?: number;
  currency?: string;
  listingId?: string;
};

export async function createValuation(payload: CreateValuationPayload, token: string) {
  return apiClient.post<{ valuation: JsonRecord }>('/api/valuations', payload, { token });
}

export async function getMyValuations(token: string) {
  return apiClient.get<{ valuations: JsonRecord[] }>('/api/valuations/mine', { token });
}


export async function getAdminValuations(token: string) {
  return apiClient.get<{ valuations: JsonRecord[] }>('/api/valuations/admin/all', { token });
}

export async function updateAdminValuationReview(
  valuationId: string,
  payload: JsonRecord,
  token: string
) {
  return apiClient.patch<{ valuation: JsonRecord }>(
    `/api/valuations/admin/${valuationId}/review`,
    payload,
    { token }
  );
}
