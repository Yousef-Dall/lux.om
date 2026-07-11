import { apiClient } from './client';
import type {
  PmsCompanySummary,
  PmsLease,
  PmsDocument,
  PmsDocumentType,
  PmsMaintenancePriority,
  PmsMaintenanceStatus,
  PmsRentDueItem,
  PmsRentDueStatus,
  PmsRentPayment,
  PmsRentReceipt,
  PmsWorkOrder
} from './pms';

export type TenantAccessSummary = {
  hasAccess: boolean;
  tenancies: Array<{
    accessId: string;
    active: boolean;
    company: PmsCompanySummary;
    tenant: {
      id: string;
      fullName: string;
      email?: string | null;
      phone?: string | null;
    };
  }>;
};

export type TenantPortalWorkspace = {
  access: {
    id: string;
    companyId: string;
    tenantId: string;
    userId: string;
    active: boolean;
  };
  company: PmsCompanySummary;
  tenant: {
    id: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactEmail?: string | null;
    active: boolean;
  };
};

export type TenantOverview = {
  workspace: TenantPortalWorkspace;
  activeLease: PmsLease | null;
  metrics: {
    unpaidRentCount: number;
    overdueRentCount: number;
    dueSoonRentCount: number;
    openMaintenanceCount: number;
  };
  latest: {
    rentDueItem: PmsRentDueItem | null;
    maintenanceRequest: PmsWorkOrder | null;
  };
  paymentFoundation: {
    onlineRentPaymentEnabled: boolean;
    note: string;
  };
};

export type TenantLeaseResponse = {
  workspace: TenantPortalWorkspace;
  activeLease: PmsLease | null;
  leases: PmsLease[];
};

export type TenantRentResponse = {
  workspace: TenantPortalWorkspace;
  rentDueItems: PmsRentDueItem[];
  pagination: {
    take: number;
    skip: number;
    count: number;
    total: number;
  };
  paymentFoundation: {
    onlineRentPaymentEnabled: boolean;
    note: string;
  };
};

export type TenantRentPaymentsResponse = {
  workspace: TenantPortalWorkspace;
  rentDueItem: PmsRentDueItem;
  payments: PmsRentPayment[];
};

export type TenantMaintenanceResponse = {
  workspace: TenantPortalWorkspace;
  workOrders: PmsWorkOrder[];
  pagination: {
    take: number;
    skip: number;
    count: number;
    total: number;
  };
};

export type TenantMaintenancePayload = {
  leaseId?: string;
  title: string;
  description?: string | null;
  priority?: PmsMaintenancePriority;
  imageUrls?: string[];
  documentUrls?: string[];
};

export type TenantDocumentsResponse = {
  workspace: TenantPortalWorkspace;
  documents: PmsDocument[];
  foundation: {
    enabled: boolean;
    note: string;
  };
};

export type TenantDocumentPayload = {
  leaseId?: string;
  type?: Extract<PmsDocumentType, 'TENANT_ID' | 'PASSPORT_RESIDENCY' | 'OTHER'>;
  title: string;
  fileUrl?: string;
  expiryDate?: string | null;
  notes?: string | null;
};

export type TenantProfilePayload = {
  phone?: string | null;
  email?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactEmail?: string | null;
};

function tenantParams(accessId?: string) {
  return { accessId };
}

export async function getTenantOverview(token: string, accessId?: string) {
  return apiClient.get<TenantOverview>('/api/tenant/overview', {
    token,
    params: tenantParams(accessId)
  });
}

export async function getTenantLease(token: string, accessId?: string) {
  return apiClient.get<TenantLeaseResponse>('/api/tenant/lease', {
    token,
    params: tenantParams(accessId)
  });
}

export async function listTenantRent(
  token: string,
  params: {
    accessId?: string;
    status?: 'ALL' | PmsRentDueStatus;
    take?: number;
    skip?: number;
  } = {}
) {
  return apiClient.get<TenantRentResponse>('/api/tenant/rent', {
    token,
    params
  });
}

export async function listTenantRentPayments(
  token: string,
  rentDueItemId: string,
  accessId?: string
) {
  return apiClient.get<TenantRentPaymentsResponse>(
    `/api/tenant/rent/${rentDueItemId}/payments`,
    { token, params: tenantParams(accessId) }
  );
}

export async function createTenantRentCheckoutSession(
  token: string,
  rentDueItemId: string,
  payload: { amount?: number | string } = {},
  accessId?: string
) {
  return apiClient.post<{
    workspace: TenantPortalWorkspace;
    rentDueItem: PmsRentDueItem;
    payment: PmsRentPayment;
    checkoutUrl: string;
  }>(`/api/tenant/rent/${rentDueItemId}/payments/session`, payload, {
    token,
    params: tenantParams(accessId)
  });
}

export async function syncTenantRentPayment(
  token: string,
  rentPaymentId: string,
  accessId?: string
) {
  return apiClient.post<{
    workspace: TenantPortalWorkspace;
    rentDueItem: PmsRentDueItem;
    payment: PmsRentPayment;
    receipt: PmsRentReceipt | null;
  }>(`/api/tenant/rent-payments/${rentPaymentId}/sync`, {}, {
    token,
    params: tenantParams(accessId)
  });
}

export async function getTenantRentPaymentReceipt(
  token: string,
  rentPaymentId: string,
  accessId?: string
) {
  return apiClient.get<{
    workspace: TenantPortalWorkspace;
    receipt: PmsRentReceipt;
  }>(`/api/tenant/rent-payments/${rentPaymentId}/receipt`, {
    token,
    params: tenantParams(accessId)
  });
}

export async function listTenantMaintenance(
  token: string,
  params: {
    accessId?: string;
    status?: 'ALL' | PmsMaintenanceStatus;
    take?: number;
    skip?: number;
  } = {}
) {
  return apiClient.get<TenantMaintenanceResponse>('/api/tenant/maintenance', {
    token,
    params
  });
}

export async function createTenantMaintenanceRequest(
  token: string,
  payload: TenantMaintenancePayload,
  accessId?: string
) {
  return apiClient.post<{
    workspace: TenantPortalWorkspace;
    workOrder: PmsWorkOrder;
  }>('/api/tenant/maintenance', payload, {
    token,
    params: tenantParams(accessId)
  });
}

export async function confirmTenantMaintenanceResolved(
  token: string,
  workOrderId: string,
  payload: { notes?: string | null } = {},
  accessId?: string
) {
  return apiClient.post<{ workspace: TenantPortalWorkspace; workOrder: PmsWorkOrder }>(
    `/api/tenant/maintenance/${workOrderId}/confirm-resolved`,
    payload,
    { token, params: tenantParams(accessId) }
  );
}

export async function reopenTenantMaintenance(
  token: string,
  workOrderId: string,
  payload: { notes?: string | null } = {},
  accessId?: string
) {
  return apiClient.post<{ workspace: TenantPortalWorkspace; workOrder: PmsWorkOrder }>(
    `/api/tenant/maintenance/${workOrderId}/reopen`,
    payload,
    { token, params: tenantParams(accessId) }
  );
}

export async function getTenantProfile(token: string, accessId?: string) {
  return apiClient.get<{
    workspace: TenantPortalWorkspace;
    profile: TenantPortalWorkspace['tenant'];
  }>('/api/tenant/profile', {
    token,
    params: tenantParams(accessId)
  });
}

export async function updateTenantProfile(
  token: string,
  payload: TenantProfilePayload,
  accessId?: string
) {
  return apiClient.patch<{
    workspace: TenantPortalWorkspace;
    profile: TenantPortalWorkspace['tenant'];
  }>('/api/tenant/profile', payload, {
    token,
    params: tenantParams(accessId)
  });
}

export async function getTenantDocuments(token: string, accessId?: string) {
  return apiClient.get<TenantDocumentsResponse>('/api/tenant/documents', {
    token,
    params: tenantParams(accessId)
  });
}

export async function uploadTenantDocument(
  token: string,
  payload: Omit<TenantDocumentPayload, 'fileUrl'>,
  file: File,
  accessId?: string,
) {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(payload));
  formData.append('file', file);
  return apiClient.upload<{
    workspace: TenantPortalWorkspace;
    document: PmsDocument;
  }>('/api/tenant/documents/upload', formData, { token, params: tenantParams(accessId) });
}

export async function downloadTenantDocument(token: string, documentId: string, accessId?: string) {
  return apiClient.download(`/api/tenant/documents/${documentId}/download`, {
    token,
    params: tenantParams(accessId),
  });
}

export async function createTenantDocument(
  token: string,
  payload: TenantDocumentPayload,
  accessId?: string
) {
  return apiClient.post<{
    workspace: TenantPortalWorkspace;
    document: PmsDocument;
  }>('/api/tenant/documents', payload, {
    token,
    params: tenantParams(accessId)
  });
}
