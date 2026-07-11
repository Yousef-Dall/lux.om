import { apiClient } from './client';

export type VendorPortalAccessSummary = {
  hasAccess: boolean;
  accesses: Array<{
    id: string;
    company: { id: string; slug: string; nameEn: string; nameAr?: string | null };
    vendor: { id: string; name: string; trade?: string | null };
  }>;
};
export type VendorWorkOrder = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  scheduledFor?: string | null;
  targetDate?: string | null;
  property: { id: string; name: string; address?: string | null };
  unit?: { id: string; unitNumber: string } | null;
  asset?: { id: string; assetCode: string; name: string; warrantyExpiry?: string | null } | null;
  quotes: Array<{ id: string; amount: string; currency: string; status: string }>;
  pmsDocuments: Array<{ id: string; title: string; type: string; originalFilename?: string | null }>;
};
export async function listVendorWorkOrders(token: string, accessId?: string) {
  return apiClient.get<{ access: { id: string; company: unknown; vendor: unknown }; workOrders: VendorWorkOrder[] }>('/api/vendor/work-orders', { token, params: { accessId } });
}
export async function updateVendorWorkOrder(token: string, workOrderId: string, payload: { accessId?: string; action: 'SCHEDULE' | 'START' | 'REQUEST_COMPLETION'; comment: string; scheduledFor?: string; targetDate?: string }) {
  return apiClient.post<{ workOrder: VendorWorkOrder }>(`/api/vendor/work-orders/${workOrderId}/progress`, payload, { token });
}
export async function submitVendorQuote(token: string, workOrderId: string, payload: { accessId?: string; amount: number; currency: string; description?: string; notes?: string }) {
  return apiClient.post<{ quote: unknown }>(`/api/vendor/work-orders/${workOrderId}/quotes`, payload, { token });
}
export async function uploadVendorFile(token: string, workOrderId: string, formData: FormData) {
  return apiClient.upload<{ document: unknown }>(`/api/vendor/work-orders/${workOrderId}/files`, formData, { token });
}
export async function downloadVendorDocument(token: string, documentId: string, accessId?: string) {
  return apiClient.download(`/api/vendor/documents/${documentId}/download`, { token, params: { accessId } });
}
