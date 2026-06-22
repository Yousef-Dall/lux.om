import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function createRentSchedule(payload: JsonRecord, token: string) {
  return apiClient.post<{ schedule: JsonRecord }>('/api/rent-payments/schedules', payload, { token });
}

export async function createRentDueItem(scheduleId: string, payload: JsonRecord, token: string) {
  return apiClient.post<{ dueItem: JsonRecord }>(`/api/rent-payments/schedules/${scheduleId}/due-items`, payload, { token });
}

export async function getMyRentSchedules(token: string) {
  return apiClient.get<{ schedules: JsonRecord[] }>('/api/rent-payments/mine', { token });
}

export async function markRentDueItemPaid(dueItemId: string, payload: JsonRecord, token: string) {
  return apiClient.patch<{ dueItem: JsonRecord }>(`/api/rent-payments/due-items/${dueItemId}/paid`, payload, { token });
}
