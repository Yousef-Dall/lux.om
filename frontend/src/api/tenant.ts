import { apiClient } from './client';
import type {
  PmsCompanySummary,
  PmsLease,
  PmsMaintenancePriority,
  PmsMaintenanceStatus,
  PmsRentDueItem,
  PmsRentDueStatus,
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
  return apiClient.get<{
    workspace: TenantPortalWorkspace;
    documents: unknown[];
    foundation: {
      enabled: boolean;
      note: string;
    };
  }>('/api/tenant/documents', {
    token,
    params: tenantParams(accessId)
  });
}
