import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'SUBMITTED'
  | 'ADMIN_VERIFIED'
  | 'EXTERNALLY_VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type VerificationSource =
  | 'LUX_OM_ADMIN_REVIEW'
  | 'OWNER_DOCUMENT_SUBMISSION'
  | 'FUTURE_MOLUP_API'
  | 'FUTURE_MUNICIPALITY_REGISTRATION'
  | 'FUTURE_THIRD_PARTY_PROVIDER';

export type VerificationTargetType =
  | 'LISTING'
  | 'ACTIVITY'
  | 'DEVELOPER'
  | 'TRAVEL_AGENCY'
  | 'USER'
  | 'CONTRACT'
  | 'TRANSACTION';

export type VerificationActor = {
  id: string;
  name: string;
  email: string;
};

export type VerificationRecord = {
  id: string;
  targetType: VerificationTargetType;
  targetId: string;
  status: VerificationStatus;
  source: VerificationSource;
  notes?: string | null;
  documentChecklist?: unknown;
  verificationDate?: string | null;
  expiryDate?: string | null;
  submittedById?: string | null;
  reviewedById?: string | null;
  submittedBy?: VerificationActor | null;
  reviewedBy?: VerificationActor | null;
  createdAt: string;
  updatedAt: string;
};

export async function submitVerification(payload: JsonRecord, token: string) {
  return apiClient.post<{ verification: JsonRecord }>('/api/verification', payload, {
    token
  });
}

export async function getAdminVerifications(token: string) {
  return apiClient.get<{ verifications: VerificationRecord[] }>(
    '/api/verification/admin/all',
    {
      token
    }
  );
}

export async function updateAdminVerificationReview(
  verificationId: string,
  payload: {
    status: VerificationStatus;
    notes?: string;
    expiryDate?: string;
  },
  token: string
) {
  return apiClient.patch<{ verification: Partial<VerificationRecord> }>(
    `/api/verification/admin/${verificationId}/review`,
    payload,
    { token }
  );
}
