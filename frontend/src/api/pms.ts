import { apiClient } from './client';
import type { UserRole } from '../types';

export type PmsEntitlementStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'EXPIRED';

export type PmsMemberRole =
  | 'PMS_OWNER'
  | 'PMS_MANAGER'
  | 'PMS_ACCOUNTANT'
  | 'PMS_MAINTENANCE'
  | 'PMS_AGENT'
  | 'PMS_VIEWER';

export type PmsCompanySummary = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  logo?: string | null;
};

export type PmsAccessSummary = {
  hasAccess: boolean;
  workspaces: Array<{
    memberId: string;
    role: PmsMemberRole;
    company: PmsCompanySummary;
    entitlement: {
      status: PmsEntitlementStatus;
      trialEndsAt?: string | null;
    } | null;
  }>;
};

export type PmsWorkspaceOverview = {
  workspace: {
    company: PmsCompanySummary;
    member: {
      id: string;
      companyId: string;
      userId: string;
      role: PmsMemberRole;
      active: boolean;
    };
    entitlement: {
      id: string;
      status: PmsEntitlementStatus;
      trialEndsAt?: string | null;
      enabledAt?: string | null;
      disabledAt?: string | null;
    };
  };
  companies: Array<{
    memberId: string;
    role: PmsMemberRole;
    company: PmsCompanySummary & {
      pmsEntitlement?: {
        status: PmsEntitlementStatus;
        trialEndsAt?: string | null;
      } | null;
    };
  }>;
  metrics: {
    totalListings: number;
    approvedListings: number;
    draftOrPendingListings: number;
    totalProjects: number;
    approvedProjects: number;
    draftOrPendingProjects: number;
    activeRentSchedules: number;
    openContracts: number;
    pendingRentDueItems: number;
    overdueRentDueItems: number;
    activeTransactions: number;
  };
  emptyStates: {
    properties: boolean;
    rentals: boolean;
    contracts: boolean;
    accounting: boolean;
  };
};

export type AdminPmsMember = {
  id: string;
  role: PmsMemberRole;
  active: boolean;
  invitedEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    suspendedAt?: string | null;
    deactivatedAt?: string | null;
  };
};

export type AdminPmsCompany = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  headquartersEn?: string | null;
  headquartersAr?: string | null;
  email?: string | null;
  verified: boolean;
  featured: boolean;
  pmsEntitlement?: {
    id: string;
    status: PmsEntitlementStatus;
    notes?: string | null;
    enabledAt?: string | null;
    disabledAt?: string | null;
    trialEndsAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  pmsMembers: AdminPmsMember[];
  counts: {
    listings: number;
    projects: number;
    pmsMembers: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPmsCompaniesQuery = {
  search?: string;
  status?: 'ALL' | PmsEntitlementStatus;
  take?: number;
  skip?: number;
};

export async function getPmsOverview(token: string, companyId?: string) {
  return apiClient.get<PmsWorkspaceOverview>('/api/pms/overview', {
    token,
    params: {
      companyId
    }
  });
}

export async function listAdminPmsCompanies(params: AdminPmsCompaniesQuery, token: string) {
  return apiClient.get<{
    companies: AdminPmsCompany[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>('/api/pms/admin/companies', {
    token,
    params
  });
}

export async function updateAdminPmsEntitlement(
  companyId: string,
  payload: {
    status: PmsEntitlementStatus;
    notes?: string;
    trialEndsAt?: string | null;
  },
  token: string
) {
  return apiClient.patch<{
    entitlement: NonNullable<AdminPmsCompany['pmsEntitlement']>;
    company: AdminPmsCompany;
  }>(`/api/pms/admin/companies/${companyId}/entitlement`, payload, { token });
}

export async function upsertAdminPmsMember(
  companyId: string,
  payload: {
    userId?: string;
    email?: string;
    role: PmsMemberRole;
    active?: boolean;
  },
  token: string
) {
  return apiClient.post<{ member: AdminPmsMember }>(
    `/api/pms/admin/companies/${companyId}/members`,
    payload,
    { token }
  );
}

export async function updateAdminPmsMember(
  memberId: string,
  payload: {
    role?: PmsMemberRole;
    active?: boolean;
  },
  token: string
) {
  return apiClient.patch<{ member: AdminPmsMember }>(
    `/api/pms/admin/members/${memberId}`,
    payload,
    { token }
  );
}
