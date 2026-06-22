import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function createTrustReport(payload: JsonRecord, token?: string) {
  return apiClient.post<{ report: JsonRecord }>('/api/reports', payload, token ? { token } : undefined);
}

export async function getAdminReports(token: string) {
  return apiClient.get<{ reports: JsonRecord[] }>('/api/reports/admin/all', { token });
}
