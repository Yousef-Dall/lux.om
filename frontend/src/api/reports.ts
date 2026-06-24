import { apiClient } from './client';

export type JsonRecord = Record<string, unknown>;

export type ReportTargetType =
  | 'LISTING'
  | 'ACTIVITY'
  | 'TRAVEL_AGENCY'
  | 'DEVELOPER'
  | 'REVIEW'
  | 'USER'
  | 'OTHER';

export type ReportReason =
  | 'MISLEADING_INFO'
  | 'SUSPECTED_FRAUD'
  | 'DUPLICATE'
  | 'INAPPROPRIATE_CONTENT'
  | 'WRONG_PRICE'
  | 'UNAVAILABLE'
  | 'SAFETY_CONCERN'
  | 'OTHER';

export type ModerationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESOLVED'
  | 'DISMISSED';

export type TrustReportPayload = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  message?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
};

export type UpdateTrustReportStatusPayload = {
  status: ModerationStatus;
  reviewNotes?: string;
};

export async function createTrustReport(
  payload: TrustReportPayload,
  token?: string | null
) {
  return apiClient.post<{ report: JsonRecord }>(
    '/api/reports',
    payload,
    token ? { token } : undefined
  );
}

export async function getAdminReports(token: string) {
  return apiClient.get<{ reports: JsonRecord[] }>('/api/reports/admin/all', {
    token
  });
}

export async function updateAdminReportStatus(
  reportId: string,
  payload: UpdateTrustReportStatusPayload,
  token: string
) {
  return apiClient.patch<{ report: JsonRecord }>(
    `/api/reports/admin/${reportId}/status`,
    payload,
    { token }
  );
}
