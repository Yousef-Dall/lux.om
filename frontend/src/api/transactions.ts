import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function createMarketplaceTransaction(payload: JsonRecord, token: string) {
  return apiClient.post<{ transaction: JsonRecord }>('/api/transactions', payload, { token });
}

export async function getMyMarketplaceTransactions(token: string) {
  return apiClient.get<{ transactions: JsonRecord[] }>('/api/transactions/mine', { token });
}

export async function getAdminMarketplaceTransactions(token: string) {
  return apiClient.get<{ transactions: JsonRecord[] }>('/api/transactions/admin/all', { token });
}
