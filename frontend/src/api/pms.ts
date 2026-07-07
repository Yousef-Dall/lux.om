import { apiClient } from "./client";
import type { UserRole } from "../types";

export type PmsEntitlementStatus = "ACTIVE" | "SUSPENDED" | "TRIAL" | "EXPIRED";

export type PmsMemberRole =
  | "PMS_OWNER"
  | "PMS_MANAGER"
  | "PMS_ACCOUNTANT"
  | "PMS_MAINTENANCE"
  | "PMS_AGENT"
  | "PMS_VIEWER";

export type PmsUnitStatus =
  "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "UNAVAILABLE";
export type PmsOccupancyStatus = "VACANT" | "OCCUPIED" | "RESERVED" | "UNKNOWN";

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

export type PmsLinkedDeveloperProject = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  status: string;
};

export type PmsLinkedListing = {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  status: string;
};

export type PmsProperty = {
  id: string;
  companyId: string;
  name: string;
  code?: string | null;
  propertyType?: string | null;
  description?: string | null;
  addressLine?: string | null;
  city?: string | null;
  area?: string | null;
  notes?: string | null;
  active: boolean;
  mapPlaceLabel?: string | null;
  mapAddress?: string | null;
  mapGoogleUrl?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  developerProjectId?: string | null;
  developerProject?: PmsLinkedDeveloperProject | null;
  publicListingId?: string | null;
  publicListing?: PmsLinkedListing | null;
  counts: {
    units: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type PmsUnit = {
  id: string;
  companyId: string;
  propertyId: string;
  property: {
    id: string;
    name: string;
    code?: string | null;
    companyId: string;
  };
  unitNumber: string;
  unitName?: string | null;
  floor?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  status: PmsUnitStatus;
  occupancyStatus: PmsOccupancyStatus;
  rentAmount?: string | null;
  currency: string;
  notes?: string | null;
  developerProjectId?: string | null;
  developerProject?: PmsLinkedDeveloperProject | null;
  publicListingId?: string | null;
  publicListing?: PmsLinkedListing | null;
  createdAt: string;
  updatedAt: string;
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
    totalPmsProperties: number;
    totalPmsUnits: number;
    vacantPmsUnits: number;
    occupiedPmsUnits: number;
    maintenancePmsUnits: number;
    pmsOccupancyRate: number;
  };
  emptyStates: {
    properties: boolean;
    marketplaceListings?: boolean;
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
    pmsProperties: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPmsCompaniesQuery = {
  search?: string;
  status?: "ALL" | PmsEntitlementStatus;
  take?: number;
  skip?: number;
};

export type PmsPropertyPayload = {
  companyId?: string;
  name: string;
  code?: string | null;
  propertyType?: string | null;
  description?: string | null;
  addressLine?: string | null;
  city?: string | null;
  area?: string | null;
  notes?: string | null;
  active?: boolean;
  mapPlaceLabel?: string | null;
  mapAddress?: string | null;
  mapGoogleUrl?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  developerProjectId?: string | null;
  publicListingId?: string | null;
};

export type PmsUnitPayload = {
  unitNumber: string;
  unitName?: string | null;
  floor?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  status?: PmsUnitStatus;
  occupancyStatus?: PmsOccupancyStatus | null;
  rentAmount?: number | string | null;
  currency?: string;
  notes?: string | null;
  developerProjectId?: string | null;
  publicListingId?: string | null;
};

export async function getPmsOverview(token: string, companyId?: string) {
  return apiClient.get<PmsWorkspaceOverview>("/api/pms/overview", {
    token,
    params: {
      companyId,
    },
  });
}

export async function listPmsProperties(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    active?: "ALL" | "ACTIVE" | "INACTIVE";
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    properties: PmsProperty[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/properties", {
    token,
    params,
  });
}

export async function createPmsProperty(
  token: string,
  payload: PmsPropertyPayload & { companyId: string },
) {
  return apiClient.post<{ property: PmsProperty }>(
    "/api/pms/properties",
    payload,
    { token },
  );
}

export async function getPmsProperty(token: string, propertyId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    property: PmsProperty;
  }>(`/api/pms/properties/${propertyId}`, { token });
}

export async function updatePmsProperty(
  token: string,
  propertyId: string,
  payload: Partial<PmsPropertyPayload>,
) {
  return apiClient.patch<{ property: PmsProperty }>(
    `/api/pms/properties/${propertyId}`,
    payload,
    {
      token,
    },
  );
}

export async function listPmsUnits(
  token: string,
  params: {
    companyId?: string;
    propertyId?: string;
    search?: string;
    status?: "ALL" | PmsUnitStatus;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    units: PmsUnit[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/units", {
    token,
    params,
  });
}

export async function listPmsPropertyUnits(
  token: string,
  propertyId: string,
  params: {
    search?: string;
    status?: "ALL" | PmsUnitStatus;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    units: PmsUnit[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>(`/api/pms/properties/${propertyId}/units`, {
    token,
    params,
  });
}

export async function createPmsUnit(
  token: string,
  propertyId: string,
  payload: PmsUnitPayload,
) {
  return apiClient.post<{ unit: PmsUnit }>(
    `/api/pms/properties/${propertyId}/units`,
    payload,
    {
      token,
    },
  );
}

export async function getPmsUnit(token: string, unitId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    unit: PmsUnit;
  }>(`/api/pms/units/${unitId}`, { token });
}

export async function updatePmsUnit(
  token: string,
  unitId: string,
  payload: Partial<PmsUnitPayload>,
) {
  return apiClient.patch<{ unit: PmsUnit }>(
    `/api/pms/units/${unitId}`,
    payload,
    { token },
  );
}

export async function listAdminPmsCompanies(
  params: AdminPmsCompaniesQuery,
  token: string,
) {
  return apiClient.get<{
    companies: AdminPmsCompany[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/admin/companies", {
    token,
    params,
  });
}

export async function updateAdminPmsEntitlement(
  companyId: string,
  payload: {
    status: PmsEntitlementStatus;
    notes?: string;
    trialEndsAt?: string | null;
  },
  token: string,
) {
  return apiClient.patch<{
    entitlement: NonNullable<AdminPmsCompany["pmsEntitlement"]>;
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
  token: string,
) {
  return apiClient.post<{ member: AdminPmsMember }>(
    `/api/pms/admin/companies/${companyId}/members`,
    payload,
    { token },
  );
}

export async function updateAdminPmsMember(
  memberId: string,
  payload: {
    role?: PmsMemberRole;
    active?: boolean;
  },
  token: string,
) {
  return apiClient.patch<{ member: AdminPmsMember }>(
    `/api/pms/admin/members/${memberId}`,
    payload,
    { token },
  );
}
