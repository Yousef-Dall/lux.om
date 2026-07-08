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

export type PmsLeaseStatus = "DRAFT" | "ACTIVE" | "EXPIRING" | "ENDED" | "TERMINATED";
export type PmsRentDueStatus =
  | "UNPAID"
  | "DUE_SOON"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";
export type PmsRentFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type PmsMaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type PmsMaintenanceStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_VENDOR"
  | "RESOLVED"
  | "CANCELLED";
export type PmsCommunicationChannel = "EMAIL" | "WHATSAPP" | "SMS" | "INTERNAL";
export type PmsPolicyCategory =
  | "GENERAL"
  | "RENT"
  | "MAINTENANCE"
  | "PAYMENT"
  | "MOVE_IN_OUT"
  | "SAFETY";
export type PmsInspectionStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "NEEDS_ACTION"
  | "CANCELLED";

export type PmsSortDirection = "asc" | "desc";
export type PmsPropertySortBy = "updatedAt" | "createdAt" | "name" | "city" | "active";
export type PmsUnitSortBy = "updatedAt" | "createdAt" | "unitNumber" | "status" | "rentAmount" | "areaSqm";
export type PmsTenantSortBy = "updatedAt" | "createdAt" | "fullName" | "active";
export type PmsLeaseSortBy = "updatedAt" | "createdAt" | "startDate" | "endDate" | "rentAmount" | "status";
export type PmsRentDueSortBy = "dueDate" | "updatedAt" | "createdAt" | "amount" | "paidAmount" | "status";
export type PmsWorkOrderSortBy = "updatedAt" | "createdAt" | "scheduledFor" | "resolvedAt" | "priority" | "status" | "title" | "cost";
export type PmsCommunicationTemplateSortBy = "updatedAt" | "createdAt" | "name" | "channel" | "active";
export type PmsPolicySortBy = "updatedAt" | "createdAt" | "title" | "category" | "active";
export type PmsInspectionSortBy = "scheduledFor" | "updatedAt" | "createdAt" | "title" | "status" | "rating";

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

export type PmsTenant = {
  id: string;
  companyId: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  nationalId?: string | null;
  passportNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactEmail?: string | null;
  notes?: string | null;
  active: boolean;
  counts: {
    leases: number;
  };
  portalAccesses: PmsTenantPortalAccess[];
  createdAt: string;
  updatedAt: string;
};

export type PmsLease = {
  id: string;
  companyId: string;
  tenantId: string;
  tenant: Pick<PmsTenant, "id" | "fullName" | "phone" | "email" | "active">;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code" | "companyId">;
  unitId: string;
  unit: Pick<PmsUnit, "id" | "unitNumber" | "unitName" | "status" | "occupancyStatus">;
  contractDraftId?: string | null;
  contractDraft?: {
    id: string;
    title: string;
    status: string;
    registrationStatus: string;
  } | null;
  title?: string | null;
  status: PmsLeaseStatus;
  startDate: string;
  endDate?: string | null;
  rentFrequency: PmsRentFrequency;
  rentAmount: string;
  currency: string;
  securityDeposit?: string | null;
  dueDayOfMonth?: number | null;
  notes?: string | null;
  counts: {
    rentDueItems: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type PmsRentDueItem = {
  id: string;
  companyId: string;
  leaseId: string;
  lease: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate" | "rentFrequency">;
  tenantId: string;
  tenant: Pick<PmsTenant, "id" | "fullName" | "phone" | "email">;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code">;
  unitId: string;
  unit: Pick<PmsUnit, "id" | "unitNumber" | "unitName">;
  dueDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount: string;
  paidAmount: string;
  currency: string;
  status: PmsRentDueStatus;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsWorkOrder = {
  id: string;
  companyId: string;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code" | "companyId">;
  unitId?: string | null;
  unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email"> | null;
  title: string;
  description?: string | null;
  priority: PmsMaintenancePriority;
  status: PmsMaintenanceStatus;
  assignedToText?: string | null;
  vendorText?: string | null;
  cost?: string | null;
  currency: string;
  scheduledFor?: string | null;
  resolvedAt?: string | null;
  imageUrls: string[];
  documentUrls: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsCommunicationTemplate = {
  id: string;
  companyId: string;
  name: string;
  channel: PmsCommunicationChannel;
  type?: string | null;
  subject?: string | null;
  body: string;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsPolicy = {
  id: string;
  companyId: string;
  title: string;
  category: PmsPolicyCategory;
  body: string;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsInspection = {
  id: string;
  companyId: string;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code" | "companyId">;
  unitId?: string | null;
  unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email"> | null;
  leaseId?: string | null;
  lease?: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate"> | null;
  title: string;
  status: PmsInspectionStatus;
  scheduledFor?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  feedback?: string | null;
  rating?: number | null;
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
    totalPmsTenants: number;
    activePmsLeases: number;
    expiringPmsLeases: number;
    unpaidPmsRentDueItems: number;
    overduePmsRentDueItems: number;
    partiallyPaidPmsRentDueItems: number;
    paidPmsRentDueItems: number;
    pmsRentDueAmount?: string | null;
    pmsRentCollectedAmount?: string | null;
    openPmsWorkOrders: number;
    inProgressPmsWorkOrders: number;
    urgentPmsWorkOrders: number;
    pmsMaintenanceCostAmount?: string | null;
    scheduledPmsInspections: number;
    needsActionPmsInspections: number;
    activePmsCommunicationTemplates: number;
    activePmsPolicies: number;
    pmsOccupancyRate: number;
  };
  alerts: {
    expiringLeases: PmsLease[];
  };
  emptyStates: {
    properties: boolean;
    tenants: boolean;
    marketplaceListings?: boolean;
    rentals: boolean;
    contracts: boolean;
    accounting: boolean;
    maintenance?: boolean;
    settings?: boolean;
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

export type PmsTenantPayload = {
  companyId?: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  nationalId?: string | null;
  passportNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactEmail?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type PmsLeasePayload = {
  companyId?: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  title?: string | null;
  status?: PmsLeaseStatus;
  startDate: string;
  endDate?: string | null;
  rentFrequency?: PmsRentFrequency;
  rentAmount: number | string;
  currency?: string;
  securityDeposit?: number | string | null;
  dueDayOfMonth?: number | null;
  contractDraftId?: string | null;
  notes?: string | null;
  generateRentDueItems?: boolean;
};

export type PmsRentDueUpdatePayload = {
  status?: PmsRentDueStatus;
  paidAmount?: number | string;
  paidAt?: string | null;
  notes?: string | null;
};

export type PmsWorkOrderPayload = {
  companyId?: string;
  propertyId: string;
  unitId?: string | null;
  tenantId?: string | null;
  title: string;
  description?: string | null;
  priority?: PmsMaintenancePriority;
  status?: PmsMaintenanceStatus;
  assignedToText?: string | null;
  vendorText?: string | null;
  cost?: number | string | null;
  currency?: string;
  scheduledFor?: string | null;
  resolvedAt?: string | null;
  imageUrls?: string[];
  documentUrls?: string[];
  notes?: string | null;
};

export type PmsCommunicationTemplatePayload = {
  companyId?: string;
  name: string;
  channel?: PmsCommunicationChannel;
  type?: string | null;
  subject?: string | null;
  body: string;
  active?: boolean;
  notes?: string | null;
};

export type PmsPolicyPayload = {
  companyId?: string;
  title: string;
  category?: PmsPolicyCategory;
  body: string;
  active?: boolean;
  notes?: string | null;
};

export type PmsInspectionPayload = {
  companyId?: string;
  propertyId: string;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  title: string;
  status?: PmsInspectionStatus;
  scheduledFor?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  feedback?: string | null;
  rating?: number | null;
};

export type PmsReportsSummary = {
  workspace: PmsWorkspaceOverview["workspace"];
  accounting: {
    incomeCollected?: string | null;
    outstandingRent?: string | null;
    overdueRent?: string | null;
    expenses?: string | null;
    maintenanceCosts?: string | null;
    lateFeeFoundationEnabled: boolean;
    lateFeeNote: string;
  };
  reports: {
    occupancy: {
      totalUnits: number;
      occupiedUnits: number;
      vacantUnits: number;
      occupancyRate: number;
    };
    revenue: {
      collected?: string | null;
      outstanding?: string | null;
      overdue?: string | null;
    };
    overdueTopList: PmsRentDueItem[];
    maintenance: {
      open: number;
      inProgress: number;
      resolved: number;
      urgent: number;
      costs?: string | null;
    };
    leaseRenewals: PmsLease[];
    inspections: {
      scheduled: number;
      completed: number;
      needsAction: number;
    };
    communications: {
      activeTemplates: number;
    };
    policies: {
      activePolicies: number;
    };
  };
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
    sortBy?: PmsPropertySortBy;
    direction?: PmsSortDirection;
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
    sortBy?: PmsUnitSortBy;
    direction?: PmsSortDirection;
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
    sortBy?: PmsUnitSortBy;
    direction?: PmsSortDirection;
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


export async function listPmsTenants(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    active?: "ALL" | "ACTIVE" | "INACTIVE";
    sortBy?: PmsTenantSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    tenants: PmsTenant[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/tenants", { token, params });
}

export async function createPmsTenant(
  token: string,
  payload: PmsTenantPayload & { companyId: string },
) {
  return apiClient.post<{ tenant: PmsTenant }>("/api/pms/tenants", payload, {
    token,
  });
}

export async function getPmsTenant(token: string, tenantId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    tenant: PmsTenant;
  }>(`/api/pms/tenants/${tenantId}`, { token });
}

export async function updatePmsTenant(
  token: string,
  tenantId: string,
  payload: Partial<PmsTenantPayload>,
) {
  return apiClient.patch<{ tenant: PmsTenant }>(
    `/api/pms/tenants/${tenantId}`,
    payload,
    { token },
  );
}

export async function listPmsLeases(
  token: string,
  params: {
    companyId?: string;
    tenantId?: string;
    propertyId?: string;
    unitId?: string;
    search?: string;
    status?: "ALL" | PmsLeaseStatus;
    sortBy?: PmsLeaseSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    leases: PmsLease[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/leases", { token, params });
}

export async function createPmsLease(
  token: string,
  payload: PmsLeasePayload & { companyId: string },
) {
  return apiClient.post<{ lease: PmsLease }>("/api/pms/leases", payload, {
    token,
  });
}

export async function getPmsLease(token: string, leaseId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    lease: PmsLease;
  }>(`/api/pms/leases/${leaseId}`, { token });
}

export async function updatePmsLease(
  token: string,
  leaseId: string,
  payload: Partial<PmsLeasePayload>,
) {
  return apiClient.patch<{ lease: PmsLease }>(
    `/api/pms/leases/${leaseId}`,
    payload,
    { token },
  );
}

export async function listPmsRentDueItems(
  token: string,
  params: {
    companyId?: string;
    leaseId?: string;
    tenantId?: string;
    propertyId?: string;
    unitId?: string;
    dueFrom?: string;
    dueTo?: string;
    status?: "ALL" | PmsRentDueStatus;
    sortBy?: PmsRentDueSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    rentDueItems: PmsRentDueItem[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>("/api/pms/rent-due", { token, params });
}

export async function listPmsLeaseRentDueItems(
  token: string,
  leaseId: string,
  params: {
    dueFrom?: string;
    dueTo?: string;
    status?: "ALL" | PmsRentDueStatus;
    sortBy?: PmsRentDueSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    rentDueItems: PmsRentDueItem[];
    pagination: {
      take: number;
      skip: number;
      count: number;
      total: number;
    };
  }>(`/api/pms/leases/${leaseId}/rent-due`, { token, params });
}

export async function updatePmsRentDueItem(
  token: string,
  rentDueItemId: string,
  payload: PmsRentDueUpdatePayload,
) {
  return apiClient.patch<{ rentDueItem: PmsRentDueItem }>(
    `/api/pms/rent-due/${rentDueItemId}`,
    payload,
    { token },
  );
}

export async function listPmsWorkOrders(
  token: string,
  params: {
    companyId?: string;
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    search?: string;
    status?: "ALL" | PmsMaintenanceStatus;
    priority?: "ALL" | PmsMaintenancePriority;
    sortBy?: PmsWorkOrderSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    workOrders: PmsWorkOrder[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/maintenance", { token, params });
}

export async function createPmsWorkOrder(
  token: string,
  payload: PmsWorkOrderPayload & { companyId: string },
) {
  return apiClient.post<{ workOrder: PmsWorkOrder }>("/api/pms/maintenance", payload, {
    token,
  });
}

export async function updatePmsWorkOrder(
  token: string,
  workOrderId: string,
  payload: Partial<PmsWorkOrderPayload>,
) {
  return apiClient.patch<{ workOrder: PmsWorkOrder }>(
    `/api/pms/maintenance/${workOrderId}`,
    payload,
    { token },
  );
}

export async function getPmsReportsSummary(token: string, companyId?: string) {
  return apiClient.get<PmsReportsSummary>("/api/pms/reports/summary", {
    token,
    params: { companyId },
  });
}

export async function listPmsCommunicationTemplates(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    active?: "ALL" | "ACTIVE" | "INACTIVE";
    channel?: "ALL" | PmsCommunicationChannel;
    sortBy?: PmsCommunicationTemplateSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    templates: PmsCommunicationTemplate[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/communication-templates", { token, params });
}

export async function createPmsCommunicationTemplate(
  token: string,
  payload: PmsCommunicationTemplatePayload & { companyId: string },
) {
  return apiClient.post<{ template: PmsCommunicationTemplate }>(
    "/api/pms/communication-templates",
    payload,
    { token },
  );
}

export async function listPmsPolicies(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    active?: "ALL" | "ACTIVE" | "INACTIVE";
    category?: "ALL" | PmsPolicyCategory;
    sortBy?: PmsPolicySortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    policies: PmsPolicy[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/policies", { token, params });
}

export async function createPmsPolicy(
  token: string,
  payload: PmsPolicyPayload & { companyId: string },
) {
  return apiClient.post<{ policy: PmsPolicy }>("/api/pms/policies", payload, {
    token,
  });
}

export async function listPmsInspections(
  token: string,
  params: {
    companyId?: string;
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    leaseId?: string;
    search?: string;
    status?: "ALL" | PmsInspectionStatus;
    sortBy?: PmsInspectionSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    inspections: PmsInspection[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/inspections", { token, params });
}

export async function createPmsInspection(
  token: string,
  payload: PmsInspectionPayload & { companyId: string },
) {
  return apiClient.post<{ inspection: PmsInspection }>("/api/pms/inspections", payload, {
    token,
  });
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

export type PmsTenantPortalAccess = {
  id: string;
  companyId: string;
  tenantId: string;
  userId: string;
  active: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  createdAt: string;
  updatedAt: string;
};

export async function upsertPmsTenantPortalAccess(
  tenantId: string,
  payload: {
    userId?: string;
    email?: string;
    active?: boolean;
  },
  token: string,
) {
  return apiClient.post<{ tenantAccess: PmsTenantPortalAccess }>(
    `/api/pms/tenants/${tenantId}/portal-access`,
    payload,
    { token },
  );
}
