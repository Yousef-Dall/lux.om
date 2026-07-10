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

export type PmsPermissionKey =
  | "INVENTORY_VIEW"
  | "INVENTORY_MANAGE"
  | "TENANCY_VIEW"
  | "TENANCY_MANAGE"
  | "RENT_VIEW"
  | "RENT_MANAGE"
  | "ACCOUNTING_VIEW"
  | "ACCOUNTING_MANAGE"
  | "MAINTENANCE_VIEW"
  | "MAINTENANCE_MANAGE"
  | "REPORTS_VIEW"
  | "SETTINGS_MANAGE"
  | "COMMUNICATIONS_SEND"
  | "DOCUMENTS_VIEW"
  | "DOCUMENTS_MANAGE"
  | "STAFF_MANAGE"
  | "IMPORT_EXPORT";

export type PmsUnitStatus =
  "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "UNAVAILABLE";
export type PmsOccupancyStatus = "VACANT" | "OCCUPIED" | "RESERVED" | "UNKNOWN";

export type PmsLeaseStatus = "DRAFT" | "ACTIVE" | "EXPIRING" | "RENEWED" | "ENDED" | "TERMINATED";

export type PmsDocumentType =
  | "TENANT_ID"
  | "PASSPORT_RESIDENCY"
  | "LEASE_AGREEMENT"
  | "RENEWAL"
  | "MOVE_IN_REPORT"
  | "MOVE_OUT_REPORT"
  | "DEPOSIT_RECEIPT"
  | "INSPECTION_REPORT"
  | "MAINTENANCE_INVOICE"
  | "POLICY_NOTICE"
  | "OTHER";
export type PmsDocumentStatus = "ACTIVE" | "EXPIRING" | "EXPIRED" | "ARCHIVED";
export type PmsMoveChecklistType = "MOVE_IN" | "MOVE_OUT";
export type PmsMoveChecklistStatus = "PENDING" | "COMPLETED" | "WAIVED";
export type PmsRentDueStatus =
  | "UNPAID"
  | "DUE_SOON"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

export type PmsRentPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CARD_MANUAL"
  | "ONLINE_GATEWAY"
  | "OTHER";
export type PmsRentPaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";
export type PmsAccountingEntryType =
  | "INCOME"
  | "EXPENSE"
  | "DEPOSIT"
  | "ADJUSTMENT"
  | "REFUND"
  | "LATE_FEE"
  | "TRANSFER";
export type PmsAccountingSource =
  | "MANUAL"
  | "RENT_PAYMENT"
  | "MAINTENANCE_COST"
  | "SECURITY_DEPOSIT";
export type PmsRentFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type PmsMaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type PmsMaintenanceStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_VENDOR"
  | "RESOLVED"
  | "CANCELLED";
export type PmsMaintenanceQuoteStatus = "REQUESTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type PmsMaintenanceRecurrenceType = "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type PmsCommunicationChannel = "EMAIL" | "WHATSAPP" | "SMS" | "INTERNAL";
export type PmsCommunicationLogStatus = "DRAFT" | "LOGGED" | "SENT" | "FAILED" | "SKIPPED";
export type PmsReminderType = "RENT_DUE_SOON" | "OVERDUE_RENT" | "LEASE_EXPIRY" | "MAINTENANCE_STATUS";
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
export type PmsWorkOrderSortBy = "updatedAt" | "createdAt" | "scheduledFor" | "resolvedAt" | "targetDate" | "priority" | "status" | "title" | "cost";
export type PmsCommunicationTemplateSortBy = "updatedAt" | "createdAt" | "name" | "channel" | "active";
export type PmsPolicySortBy = "updatedAt" | "createdAt" | "title" | "category" | "active";
export type PmsInspectionSortBy = "scheduledFor" | "updatedAt" | "createdAt" | "title" | "status" | "rating";
export type PmsAccountingLedgerSortBy = "transactionDate" | "createdAt" | "updatedAt" | "amount" | "type" | "category";

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
    permissionKeys?: PmsPermissionKey[];
    propertyScope?: { allProperties: boolean; propertyIds: string[] };
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

export type PmsStaffMember = {
  id: string;
  companyId: string;
  userId: string;
  role: PmsMemberRole;
  active: boolean;
  invitedEmail?: string | null;
  user: { id: string; name: string; email: string; role: UserRole; suspendedAt?: string | null; deactivatedAt?: string | null };
  permissionKeys: PmsPermissionKey[];
  customPermissionKeys: PmsPermissionKey[];
  propertyScope: {
    allProperties: boolean;
    propertyIds: string[];
    properties: Array<Pick<PmsProperty, "id" | "name" | "code">>;
  };
  createdAt: string;
  updatedAt: string;
};

export type PmsPortfolio = {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  active: boolean;
  propertyIds: string[];
  properties: Array<Pick<PmsProperty, "id" | "name" | "code" | "active">>;
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
  previousLeaseId?: string | null;
  previousLease?: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate"> | null;
  counts: {
    rentDueItems: number;
    renewalLeases?: number;
    documents?: number;
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
  balanceAmount?: string | null;
  currency: string;
  status: PmsRentDueStatus;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsRentPayment = {
  id: string;
  companyId: string;
  rentDueItemId: string;
  rentDueItem: PmsRentDueItem;
  leaseId: string;
  lease: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate" | "rentFrequency">;
  tenantId: string;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email">;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code">;
  unitId: string;
  unit: Pick<PmsUnit, "id" | "unitNumber" | "unitName">;
  amount: string;
  currency: string;
  method: PmsRentPaymentMethod;
  status: PmsRentPaymentStatus;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  receiptNumber?: string | null;
  provider?: string | null;
  providerReference?: string | null;
  providerSessionId?: string | null;
  checkoutUrl?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  recordedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsRentReceipt = {
  receiptNumber?: string | null;
  paymentId: string;
  rentDueItemId: string;
  status: PmsRentPaymentStatus;
  method: PmsRentPaymentMethod;
  amount: string;
  currency: string;
  referenceNumber?: string | null;
  providerReference?: string | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
  issuedAt: string;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email">;
  property: Pick<PmsProperty, "id" | "name" | "code">;
  unit: Pick<PmsUnit, "id" | "unitNumber" | "unitName">;
  lease: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate" | "rentFrequency">;
  rentDueItem: PmsRentDueItem;
  recordedBy?: { id: string; name: string; email: string } | null;
};

export type PmsAccountingLedgerEntry = {
  id: string;
  companyId: string;
  propertyId?: string | null;
  property?: Pick<PmsProperty, "id" | "name" | "code"> | null;
  unitId?: string | null;
  unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email"> | null;
  leaseId?: string | null;
  lease?: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate"> | null;
  rentDueItemId?: string | null;
  rentDueItem?: PmsRentDueItem | null;
  rentPaymentId?: string | null;
  rentPayment?: Pick<PmsRentPayment, "id" | "receiptNumber" | "method" | "status" | "referenceNumber"> | null;
  workOrderId?: string | null;
  workOrder?: Pick<PmsWorkOrder, "id" | "title" | "status" | "cost" | "currency"> | null;
  type: PmsAccountingEntryType;
  source: PmsAccountingSource;
  category: string;
  amount: string;
  currency: string;
  transactionDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsAccountingLedgerPayload = {
  companyId?: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  rentDueItemId?: string | null;
  workOrderId?: string | null;
  type: PmsAccountingEntryType;
  category: string;
  amount: number;
  currency?: string;
  transactionDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
};

export type PmsOwnerStatement = {
  period: { month?: string | null; from?: string | null; to?: string | null };
  scope: {
    companyId: string;
    propertyId?: string | null;
    unitId?: string | null;
    property?: Pick<PmsProperty, "id" | "name" | "code"> | null;
    unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  };
  totals: {
    rentCollected: string;
    manualIncome: string;
    income: string;
    outstandingRent: string;
    expenses: string;
    maintenanceCosts: string;
    netAmount: string;
    depositCollected: string;
    depositHeld: string;
    depositRefunded: string;
    depositDeductions: string;
  };
  income: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  outstanding: PmsRentDueItem[];
  deposits: Array<Record<string, unknown>>;
};

export type PmsVendor = {
  id: string;
  companyId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  trade?: string | null;
  notes?: string | null;
  active: boolean;
  counts?: { workOrders: number; quotes: number };
  createdAt: string;
  updatedAt: string;
};

export type PmsMaintenanceQuote = {
  id: string;
  companyId: string;
  workOrderId: string;
  vendorId?: string | null;
  vendor?: Pick<PmsVendor, "id" | "name" | "trade" | "phone" | "email" | "active"> | null;
  amount: string;
  currency: string;
  description?: string | null;
  status: PmsMaintenanceQuoteStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
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
  vendorId?: string | null;
  vendor?: Pick<PmsVendor, "id" | "name" | "trade" | "phone" | "email" | "active"> | null;
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
  targetDate?: string | null;
  imageUrls: string[];
  documentUrls: string[];
  beforeImageUrls?: string[];
  afterImageUrls?: string[];
  beforeDocumentUrls?: string[];
  afterDocumentUrls?: string[];
  recurrenceType?: PmsMaintenanceRecurrenceType;
  nextScheduledDate?: string | null;
  generatedFromWorkOrderId?: string | null;
  approvedQuoteId?: string | null;
  tenantConfirmedAt?: string | null;
  tenantReopenedAt?: string | null;
  tenantConfirmationNotes?: string | null;
  overdue?: boolean;
  quotes?: PmsMaintenanceQuote[];
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


export type PmsCommunicationLog = {
  id: string;
  companyId: string;
  templateId?: string | null;
  template?: Pick<PmsCommunicationTemplate, "id" | "name" | "channel" | "type"> | null;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email"> | null;
  leaseId?: string | null;
  lease?: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate"> | null;
  rentDueItemId?: string | null;
  rentDueItem?: Pick<PmsRentDueItem, "id" | "dueDate" | "amount" | "paidAmount" | "currency" | "status"> | null;
  workOrderId?: string | null;
  workOrder?: Pick<PmsWorkOrder, "id" | "title" | "status" | "priority"> | null;
  channel: PmsCommunicationChannel;
  subject?: string | null;
  body: string;
  status: PmsCommunicationLogStatus;
  deliveryMetadata?: unknown;
  sentAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string; email: string; role: UserRole } | null;
  sentBy?: { id: string; name: string; email: string; role: UserRole } | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsReminderCandidate = {
  type: PmsReminderType;
  rentDueItemId?: string;
  leaseId?: string;
  workOrderId?: string;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "email"> | null;
  property?: Pick<PmsProperty, "id" | "name"> | null;
  unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  vendor?: Pick<PmsVendor, "id" | "name" | "trade"> | null;
  dueDate?: string | null;
  leaseEndDate?: string | null;
  amount?: string;
  paidAmount?: string;
  currency?: string;
  status?: PmsRentDueStatus | PmsLeaseStatus | PmsMaintenanceStatus;
  maintenanceTitle?: string;
  maintenanceStatus?: PmsMaintenanceStatus;
  priority?: PmsMaintenancePriority;
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

export type PmsDocument = {
  id: string;
  companyId: string;
  propertyId?: string | null;
  property?: Pick<PmsProperty, "id" | "name" | "code" | "companyId"> | null;
  unitId?: string | null;
  unit?: Pick<PmsUnit, "id" | "unitNumber" | "unitName"> | null;
  tenantId?: string | null;
  tenant?: Pick<PmsTenant, "id" | "fullName" | "phone" | "email"> | null;
  leaseId?: string | null;
  lease?: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate"> | null;
  workOrderId?: string | null;
  workOrder?: Pick<PmsWorkOrder, "id" | "title" | "status"> | null;
  inspectionId?: string | null;
  inspection?: Pick<PmsInspection, "id" | "title" | "status" | "scheduledFor"> | null;
  type: PmsDocumentType;
  title: string;
  fileUrl: string;
  status: PmsDocumentStatus;
  expiryDate?: string | null;
  notes?: string | null;
  uploadedBy?: { id: string; name: string; email: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsMoveChecklistItem = {
  id: string;
  companyId: string;
  leaseId: string;
  lease: Pick<PmsLease, "id" | "title" | "status" | "startDate" | "endDate">;
  propertyId: string;
  property: Pick<PmsProperty, "id" | "name" | "code" | "companyId">;
  unitId: string;
  unit: Pick<PmsUnit, "id" | "unitNumber" | "unitName">;
  tenantId: string;
  tenant: Pick<PmsTenant, "id" | "fullName" | "phone" | "email">;
  type: PmsMoveChecklistType;
  title: string;
  description?: string | null;
  status: PmsMoveChecklistStatus;
  completedAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
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
      permissionKeys: PmsPermissionKey[];
      propertyScope: { allProperties: boolean; propertyIds: string[] };
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
    totalPmsProperties: number | null;
    totalPmsUnits: number | null;
    vacantPmsUnits: number | null;
    occupiedPmsUnits: number | null;
    maintenancePmsUnits: number | null;
    totalPmsTenants: number | null;
    activePmsLeases: number | null;
    expiringPmsLeases: number | null;
    unpaidPmsRentDueItems: number | null;
    overduePmsRentDueItems: number | null;
    partiallyPaidPmsRentDueItems: number | null;
    paidPmsRentDueItems: number | null;
    pmsRentDueAmount?: string | null;
    pmsRentCollectedAmount?: string | null;
    openPmsWorkOrders: number | null;
    inProgressPmsWorkOrders: number | null;
    urgentPmsWorkOrders: number | null;
    pmsMaintenanceCostAmount?: string | null;
    scheduledPmsInspections: number | null;
    needsActionPmsInspections: number | null;
    activePmsCommunicationTemplates: number | null;
    activePmsPolicies: number | null;
    pmsOccupancyRate: number | null;
  };
  alerts: {
    expiringLeases: PmsLease[];
  };
  emptyStates: {
    properties: boolean | null;
    tenants: boolean | null;
    marketplaceListings?: boolean;
    rentals: boolean | null;
    contracts: boolean;
    accounting: boolean | null;
    maintenance?: boolean | null;
    settings?: boolean | null;
  };
};


export type PmsCommandCenter = {
  workspace: PmsWorkspaceOverview["workspace"];
  generatedAt: string;
  period: { from: string; to: string };
  metrics: {
    totalProperties: number;
    totalUnits: number;
    occupancyRate: number | null;
    vacantUnits: number;
    overdueRentItems: number | null;
    overdueRentAmount: string | null;
    rentCollectedThisPeriod: string | null;
    leasesExpiringSoon: number | null;
    activeMaintenanceRequests: number | null;
    overdueMaintenanceRequests: number | null;
    missingLeaseDocuments: number | null;
    expiringDocuments: number | null;
    ownerStatementReadyProperties: number | null;
  };
  automation: {
    rentRemindersDue: number | null;
    leaseExpiryRemindersDue: number | null;
    maintenanceRemindersDue: number | null;
    documentExpiryRemindersDue: number | null;
  };
  priorityQueue: Array<{
    id: string;
    type: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM";
    title: string;
    detail: string;
    propertyId: string | null;
    propertyName: string | null;
    dueAt: string | null;
    href: string;
  }>;
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

export type PmsRentPaymentPayload = {
  amount: number | string;
  method?: Exclude<PmsRentPaymentMethod, "ONLINE_GATEWAY">;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt?: string | null;
};

export type PmsWorkOrderPayload = {
  companyId?: string;
  propertyId: string;
  unitId?: string | null;
  tenantId?: string | null;
  vendorId?: string | null;
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
  targetDate?: string | null;
  imageUrls?: string[];
  documentUrls?: string[];
  beforeImageUrls?: string[];
  afterImageUrls?: string[];
  beforeDocumentUrls?: string[];
  afterDocumentUrls?: string[];
  recurrenceType?: PmsMaintenanceRecurrenceType;
  nextScheduledDate?: string | null;
  generatedFromWorkOrderId?: string | null;
  tenantConfirmationNotes?: string | null;
  notes?: string | null;
};

export type PmsVendorPayload = {
  companyId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  trade?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type PmsMaintenanceQuotePayload = {
  vendorId?: string | null;
  amount?: number | string;
  currency?: string;
  description?: string | null;
  status?: PmsMaintenanceQuoteStatus;
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


export type PmsCommunicationSendPayload = {
  companyId?: string;
  templateId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  rentDueItemId?: string | null;
  workOrderId?: string | null;
  channel: PmsCommunicationChannel;
  subject?: string | null;
  body: string;
  status?: PmsCommunicationLogStatus;
  notes?: string | null;
  variables?: Record<string, string>;
};

export type PmsCommunicationPreviewPayload = Partial<PmsCommunicationSendPayload> & {
  body?: string;
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

export type PmsDocumentPayload = {
  companyId?: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  workOrderId?: string | null;
  inspectionId?: string | null;
  type: PmsDocumentType;
  title: string;
  fileUrl: string;
  status?: PmsDocumentStatus;
  expiryDate?: string | null;
  notes?: string | null;
};

export type PmsLeaseRenewalPayload = {
  title?: string | null;
  startDate: string;
  endDate?: string | null;
  rentAmount?: number | string;
  currency?: string;
  securityDeposit?: number | string | null;
  dueDayOfMonth?: number | null;
  notes?: string | null;
};

export type PmsMoveChecklistPayload = {
  type: PmsMoveChecklistType;
  title: string;
  description?: string | null;
  status?: PmsMoveChecklistStatus;
  completedAt?: string | null;
  notes?: string | null;
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

export async function listPmsStaff(token: string, companyId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    members: PmsStaffMember[];
    properties: Array<Pick<PmsProperty, "id" | "name" | "code" | "active">>;
    portfolios: PmsPortfolio[];
    permissionMatrix: Array<{ role: PmsMemberRole; permissionKeys: PmsPermissionKey[] }>;
  }>("/api/pms/staff", { token, params: { companyId } });
}

export async function upsertPmsStaffMember(
  token: string,
  payload: {
    companyId: string;
    email?: string;
    userId?: string;
    role: PmsMemberRole;
    active?: boolean;
    propertyIds?: string[];
    permissionKeys?: PmsPermissionKey[];
  },
) {
  return apiClient.post<{ member: PmsStaffMember }>("/api/pms/staff", payload, { token });
}

export async function updatePmsStaffMember(
  token: string,
  memberId: string,
  payload: {
    role?: PmsMemberRole;
    active?: boolean;
    propertyIds?: string[];
    permissionKeys?: PmsPermissionKey[];
  },
) {
  return apiClient.patch<{ member: PmsStaffMember }>(`/api/pms/staff/${memberId}`, payload, { token });
}

export async function createPmsPortfolio(
  token: string,
  payload: { companyId: string; name: string; description?: string; active?: boolean; propertyIds?: string[] },
) {
  return apiClient.post<{ portfolio: PmsPortfolio }>("/api/pms/portfolios", payload, { token });
}

export async function getPmsOverview(token: string, companyId?: string) {
  return apiClient.get<PmsWorkspaceOverview>("/api/pms/overview", {
    token,
    params: {
      companyId,
    },
  });
}

export async function getPmsCommandCenter(token: string, companyId?: string, propertyId?: string) {
  return apiClient.get<PmsCommandCenter>("/api/pms/command-center", {
    token,
    params: { companyId, propertyId },
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

export async function listPmsRentDuePayments(token: string, rentDueItemId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    rentDueItem: PmsRentDueItem;
    payments: PmsRentPayment[];
  }>(`/api/pms/rent-due/${rentDueItemId}/payments`, { token });
}

export async function recordPmsRentPayment(
  token: string,
  rentDueItemId: string,
  payload: PmsRentPaymentPayload,
) {
  return apiClient.post<{
    rentDueItem: PmsRentDueItem;
    payment: PmsRentPayment;
    receipt: PmsRentReceipt;
  }>(`/api/pms/rent-due/${rentDueItemId}/payments`, payload, { token });
}

export async function getPmsRentPaymentReceipt(token: string, rentPaymentId: string) {
  return apiClient.get<{ receipt: PmsRentReceipt }>(
    `/api/pms/rent-payments/${rentPaymentId}/receipt`,
    { token },
  );
}

export async function listPmsVendors(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    active?: "ALL" | "ACTIVE" | "INACTIVE";
    trade?: string;
    sortBy?: "updatedAt" | "createdAt" | "name" | "trade" | "active";
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    vendors: PmsVendor[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/vendors", { token, params });
}

export async function createPmsVendor(
  token: string,
  payload: PmsVendorPayload & { companyId: string },
) {
  return apiClient.post<{ vendor: PmsVendor }>("/api/pms/vendors", payload, { token });
}

export async function updatePmsVendor(
  token: string,
  vendorId: string,
  payload: Partial<PmsVendorPayload>,
) {
  return apiClient.patch<{ vendor: PmsVendor }>(`/api/pms/vendors/${vendorId}`, payload, { token });
}

export async function listPmsMaintenanceQuotes(token: string, workOrderId: string) {
  return apiClient.get<{ workspace: PmsWorkspaceOverview["workspace"]; quotes: PmsMaintenanceQuote[] }>(
    `/api/pms/maintenance/${workOrderId}/quotes`,
    { token },
  );
}

export async function createPmsMaintenanceQuote(
  token: string,
  workOrderId: string,
  payload: PmsMaintenanceQuotePayload,
) {
  return apiClient.post<{ quote: PmsMaintenanceQuote }>(
    `/api/pms/maintenance/${workOrderId}/quotes`,
    payload,
    { token },
  );
}

export async function updatePmsMaintenanceQuote(
  token: string,
  quoteId: string,
  payload: Partial<PmsMaintenanceQuotePayload>,
) {
  return apiClient.patch<{ quote: PmsMaintenanceQuote }>(
    `/api/pms/maintenance/quotes/${quoteId}`,
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
    vendorId?: string;
    overdue?: "ALL" | "OVERDUE" | "NOT_OVERDUE";
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

export async function listPmsAccountingLedger(
  token: string,
  params: {
    companyId?: string;
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    leaseId?: string;
    rentDueItemId?: string;
    workOrderId?: string;
    type?: "ALL" | PmsAccountingEntryType;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: PmsAccountingLedgerSortBy;
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    ledgerEntries: PmsAccountingLedgerEntry[];
    categories: { income: string[]; expense: string[] };
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/accounting/ledger", { token, params });
}

export async function createPmsAccountingLedgerEntry(
  token: string,
  payload: PmsAccountingLedgerPayload & { companyId: string },
) {
  return apiClient.post<{ ledgerEntry: PmsAccountingLedgerEntry }>(
    "/api/pms/accounting/ledger",
    payload,
    { token },
  );
}

export async function updatePmsAccountingLedgerEntry(
  token: string,
  ledgerEntryId: string,
  payload: Partial<PmsAccountingLedgerPayload>,
) {
  return apiClient.patch<{ ledgerEntry: PmsAccountingLedgerEntry }>(
    `/api/pms/accounting/ledger/${ledgerEntryId}`,
    payload,
    { token },
  );
}

export async function getPmsOwnerStatement(
  token: string,
  params: { companyId?: string; propertyId?: string; unitId?: string; month?: string; dateFrom?: string; dateTo?: string } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    statement: PmsOwnerStatement;
  }>("/api/pms/accounting/owner-statement", { token, params });
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


export async function previewPmsCommunication(
  token: string,
  payload: PmsCommunicationPreviewPayload,
) {
  return apiClient.post<{
    channel: PmsCommunicationChannel;
    variables: Record<string, string>;
    availableVariables: string[];
    subject?: string | null;
    body: string;
    template?: PmsCommunicationTemplate | null;
  }>("/api/pms/communication-templates/preview", payload, { token });
}

export async function listPmsCommunicationLogs(
  token: string,
  params: {
    companyId?: string;
    search?: string;
    channel?: "ALL" | PmsCommunicationChannel;
    status?: "ALL" | PmsCommunicationLogStatus;
    tenantId?: string | null;
    leaseId?: string | null;
    rentDueItemId?: string | null;
    workOrderId?: string | null;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    logs: PmsCommunicationLog[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/communication-logs", { token, params });
}

export async function sendPmsCommunication(
  token: string,
  payload: PmsCommunicationSendPayload & { companyId: string },
) {
  return apiClient.post<{ log: PmsCommunicationLog }>(
    "/api/pms/communication-logs/send",
    payload,
    { token },
  );
}

export async function listPmsReminderCandidates(
  token: string,
  params: {
    companyId?: string;
    type?: PmsReminderType;
    days?: number;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    type: PmsReminderType;
    schedulerReady: boolean;
    candidates: PmsReminderCandidate[];
    pagination: { take: number; skip: number; count: number };
  }>("/api/pms/communications/reminders", { token, params });
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

export async function listPmsDocuments(
  token: string,
  params: {
    companyId?: string;
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    leaseId?: string;
    workOrderId?: string;
    inspectionId?: string;
    search?: string;
    type?: "ALL" | PmsDocumentType;
    status?: "ALL" | PmsDocumentStatus;
    expiringWithinDays?: number;
    sortBy?: "updatedAt" | "createdAt" | "expiryDate" | "title" | "type" | "status";
    direction?: PmsSortDirection;
    take?: number;
    skip?: number;
  } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    documents: PmsDocument[];
    pagination: { take: number; skip: number; count: number; total: number };
  }>("/api/pms/documents", { token, params });
}

export async function listPmsDocumentExpiryAlerts(
  token: string,
  params: { companyId?: string; withinDays?: number } = {},
) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    documents: PmsDocument[];
    withinDays: number;
  }>("/api/pms/documents/expiry-alerts", { token, params });
}

export async function createPmsDocument(
  token: string,
  payload: PmsDocumentPayload & { companyId: string },
) {
  return apiClient.post<{ document: PmsDocument }>("/api/pms/documents", payload, { token });
}

export async function updatePmsDocument(
  token: string,
  documentId: string,
  payload: Partial<PmsDocumentPayload>,
) {
  return apiClient.patch<{ document: PmsDocument }>(`/api/pms/documents/${documentId}`, payload, { token });
}

export async function createPmsLeaseRenewalDraft(
  token: string,
  leaseId: string,
  payload: PmsLeaseRenewalPayload,
) {
  return apiClient.post<{ lease: PmsLease }>(`/api/pms/leases/${leaseId}/renewal-draft`, payload, { token });
}

export async function listPmsLeaseChecklists(token: string, leaseId: string) {
  return apiClient.get<{
    workspace: PmsWorkspaceOverview["workspace"];
    checklistItems: PmsMoveChecklistItem[];
  }>(`/api/pms/leases/${leaseId}/checklists`, { token });
}

export async function createPmsLeaseChecklistItem(
  token: string,
  leaseId: string,
  payload: PmsMoveChecklistPayload,
) {
  return apiClient.post<{ checklistItem: PmsMoveChecklistItem }>(
    `/api/pms/leases/${leaseId}/checklists`,
    payload,
    { token },
  );
}

export async function updatePmsLeaseChecklistItem(
  token: string,
  checklistItemId: string,
  payload: Partial<PmsMoveChecklistPayload>,
) {
  return apiClient.patch<{ checklistItem: PmsMoveChecklistItem }>(
    `/api/pms/lease-checklists/${checklistItemId}`,
    payload,
    { token },
  );
}


export type PmsImportType = "PROPERTIES" | "UNITS" | "TENANTS" | "LEASES";
export type PmsImportStatus = "PREVIEWED" | "COMMITTED" | "PARTIAL" | "FAILED";

export type PmsImportRowPreview = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
};

export type PmsImportPreview = {
  type: PmsImportType;
  headers: string[];
  totalRows: number;
  validRows: PmsImportRowPreview[];
  invalidRows: PmsImportRowPreview[];
};

export type PmsImportBatch = {
  id: string;
  companyId: string;
  type: PmsImportType;
  filename?: string | null;
  status: PmsImportStatus;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  metadata?: unknown;
  createdBy?: { id: string; name: string; email: string; role: UserRole } | null;
  createdAt: string;
  updatedAt: string;
};

export type PmsImportPayload = {
  companyId: string;
  type: PmsImportType;
  filename?: string | null;
  csvText: string;
};

export async function previewPmsImport(token: string, payload: PmsImportPayload) {
  return apiClient.post<{ preview: PmsImportPreview }>("/api/pms/imports/preview", payload, { token });
}

export async function commitPmsImport(token: string, payload: PmsImportPayload) {
  return apiClient.post<{ preview: PmsImportPreview; batch: PmsImportBatch }>("/api/pms/imports/commit", payload, { token });
}

export async function listPmsImportBatches(
  token: string,
  params: { companyId?: string; type?: PmsImportType | "ALL"; status?: PmsImportStatus | "ALL"; take?: number; skip?: number } = {},
) {
  return apiClient.get<{ batches: PmsImportBatch[]; page: { take: number; skip: number; count: number; total: number } }>(
    "/api/pms/import-batches",
    { token, params },
  );
}

export async function getPmsImportTemplateCsv(token: string, type: PmsImportType, companyId?: string) {
  return apiClient.get<string>(`/api/pms/imports/templates/${type}.csv`, {
    token,
    params: { companyId },
  });
}

export type PmsExportType = "properties" | "units" | "tenants" | "leases" | "rent-roll" | "maintenance" | "accounting-summary";

export async function getPmsExportCsv(token: string, type: PmsExportType, companyId?: string) {
  return apiClient.get<string>(`/api/pms/exports/${type}.csv`, {
    token,
    params: { companyId },
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
