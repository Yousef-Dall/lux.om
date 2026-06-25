import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;


export async function submitVerification(payload: JsonRecord, token: string) {
  return apiClient.post<{ verification: JsonRecord }>('/api/verification', payload, { token });
}

export async function getAdminVerifications(token: string) {
  return apiClient.get<{ verifications: JsonRecord[] }>('/api/verification/admin/all', { token });
}


export async function updateAdminVerificationReview(
  verificationId: string,
  payload: JsonRecord,
  token: string
) {
  return apiClient.patch<{ verification: JsonRecord }>(
    `/api/verification/admin/${verificationId}/review`,
    payload,
    { token }
  );
}
