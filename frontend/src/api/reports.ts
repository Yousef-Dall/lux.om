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


export type TrustReportUserSummary = {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
};

export type AdminTrustReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  message?: string | null;
  status: ModerationStatus;
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterPhone?: string | null;
  reporterId?: string | null;
  reporter?: TrustReportUserSummary | null;
  reviewedById?: string | null;
  reviewedBy?: TrustReportUserSummary | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateTrustReportStatusPayload = {
  status: ModerationStatus;
  reviewNotes?: string;
};

export async function createTrustReport(
  payload: TrustReportPayload,
  token?: string | null
) {
  return apiClient.post<{ report: AdminTrustReport }>(
    '/api/reports',
    payload,
    token ? { token } : undefined
  );
}

export async function getAdminReports(token: string) {
  return apiClient.get<{ reports: AdminTrustReport[] }>('/api/reports/admin/all', {
    token
  });
}

export async function updateAdminReportStatus(
  reportId: string,
  payload: UpdateTrustReportStatusPayload,
  token: string
) {
  return apiClient.patch<{ report: Pick<AdminTrustReport, 'id' | 'targetType' | 'status' | 'reporterId'> }>(
    `/api/reports/admin/${reportId}/status`,
    payload,
    { token }
  );
}
