import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function createContractDraft(payload: JsonRecord, token: string) {
  return apiClient.post<{ contract: JsonRecord }>('/api/contracts', payload, { token });
}

export async function getMyContractDrafts(token: string) {
  return apiClient.get<{ contracts: JsonRecord[] }>('/api/contracts/mine', { token });
}

export async function getAdminContractDrafts(token: string) {
  return apiClient.get<{ contracts: JsonRecord[] }>('/api/contracts/admin/all', { token });
}
