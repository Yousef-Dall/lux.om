import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function getMarketInsights() {
  return apiClient.get<{ insights: JsonRecord[]; disclaimer: string }>('/api/market-insights');
}

export async function getMarketInsightForLocation(params: {
  location: string;
  propertyType?: string;
  includeSimilarListings?: boolean;
}) {
  return apiClient.get<{ insight: JsonRecord; disclaimer: string }>('/api/market-insights/location', {
    params
  });
}

export async function refreshMarketInsightSnapshots(token: string) {
  return apiClient.post<{ snapshots: JsonRecord[]; count: number }>(
    '/api/market-insights/admin/refresh-snapshots',
    {},
    { token }
  );
}
