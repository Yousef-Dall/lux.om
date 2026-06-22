import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function getSavedDashboard(token: string) {
  return apiClient.get<{
    listings: JsonRecord[];
    activities: JsonRecord[];
    searches: JsonRecord[];
    watchlist: JsonRecord[];
  }>('/api/saved', { token });
}

export async function saveListing(listingId: string, token: string) {
  return apiClient.post<{ saved: JsonRecord }>(`/api/saved/listings/${listingId}`, {}, { token });
}

export async function unsaveListing(listingId: string, token: string) {
  return apiClient.delete<{ ok: boolean }>(`/api/saved/listings/${listingId}`, { token });
}

export async function saveActivity(activityId: string, token: string) {
  return apiClient.post<{ saved: JsonRecord }>(`/api/saved/activities/${activityId}`, {}, { token });
}

export async function unsaveActivity(activityId: string, token: string) {
  return apiClient.delete<{ ok: boolean }>(`/api/saved/activities/${activityId}`, { token });
}

export async function createSavedSearch(payload: JsonRecord, token: string) {
  return apiClient.post<{ savedSearch: JsonRecord }>('/api/saved/searches', payload, { token });
}

export async function createInvestorWatchlistItem(payload: JsonRecord, token: string) {
  return apiClient.post<{ item: JsonRecord }>('/api/saved/watchlist', payload, { token });
}
