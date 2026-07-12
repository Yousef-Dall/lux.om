import { apiClient } from './client';

export type OwnerPortalAccessSummary = {
  hasAccess: boolean;
  accesses: Array<{
    id: string;
    canApproveQuotes: boolean;
    canViewMaintenanceCosts: boolean;
    company: { id: string; slug: string; nameEn: string; nameAr?: string | null };
    property: { id: string; name: string; address?: string | null };
  }>;
};
export type OwnerPortalOverview = {
  access: OwnerPortalAccessSummary['accesses'][number];
  occupancy: { totalUnits: number; occupiedUnits: number; vacantUnits: number; occupancyRate: number };
  financialSummaries: Array<{ currency: string; income: string; expenses: string; adjustments: string; net: string; periodStart: string; periodEnd: string }>;
  statements: Array<{ id: string; periodStart: string; periodEnd: string; currency: string; closingBalance: string; publishedAt?: string | null; revision: number; documents: Array<{ id: string; title: string; type: string; originalFilename?: string | null }> }>;
  maintenance: Array<{ id: string; title: string; priority: string; status: string; cost?: string | null; currency: string; asset?: { assetCode: string; name: string } | null }>;
  payouts: Array<{ id: string; payoutNumber: string; status: string; currency: string; payoutAmount: string; periodStart: string; periodEnd: string; payoutReference?: string | null; paidAt?: string | null; failureReason?: string | null }>;
  quotesAwaitingApproval: Array<{ id: string; amount: string; currency: string; description?: string | null; workOrder: { id: string; title: string; vendor?: { name: string } | null } }>;
};
export type OwnerPortalDocument = { id: string; title: string; type: string; originalFilename?: string | null; createdAt: string };

export async function getOwnerPortalOverview(token: string, accessId?: string) {
  return apiClient.get<OwnerPortalOverview>('/api/owner/overview', { token, params: { accessId } });
}
export async function listOwnerPortalDocuments(token: string, accessId?: string) {
  return apiClient.get<{ documents: OwnerPortalDocument[] }>('/api/owner/documents', { token, params: { accessId } });
}
export async function downloadOwnerPortalDocument(token: string, documentId: string, accessId?: string) {
  return apiClient.download(`/api/owner/documents/${documentId}/download`, { token, params: { accessId } });
}
export async function decideOwnerQuote(token: string, quoteId: string, payload: { accessId?: string; decision: 'APPROVE' | 'REJECT'; comment?: string }) {
  return apiClient.post<{ quote: unknown }>(`/api/owner/quotes/${quoteId}/decision`, payload, { token });
}
