import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { ApiError } from "../api/client";
import {
  createPmsAccountingLedgerEntry,
  createPmsCommunicationTemplate,
  previewPmsCommunication,
  sendPmsCommunication,
  createPmsInspection,
  createPmsOwnerStatement,
  createPmsLeaseChecklistItem,
  createPmsLeaseRenewalDraft,
  createPmsLease,
  createPmsMaintenanceQuote,
  createPmsPolicy,
  createPmsPortfolio,
  createPmsVendor,
  createPmsProperty,
  createPmsTenant,
  createPmsUnit,
  createPmsWorkOrder,
  commitPmsImport,
  getPmsExportCsv,
  getPmsImportTemplateCsv,
  getPmsLease,
  getPmsOverview,
  getPmsCommandCenter,
  getPmsProperty,
  getPmsOwnerStatement,
  getPmsOccupancyReconciliation,
  getPmsReportsSummary,
  runPmsAutomation,
  listPmsAccountingLedger,
  listPmsDocuments,
  listPmsImportBatches,
  listPmsDocumentExpiryAlerts,
  listPmsLeaseChecklists,
  listPmsCommunicationTemplates,
  listPmsCommunicationLogs,
  listPmsReminderCandidates,
  listPmsInspections,
  listPmsLeaseRentDueItems,
  listPmsLeases,
  listPmsPolicies,
  listPmsOwnerStatements,
  listPmsProperties,
  listPmsPropertyUnits,
  listPmsStaff,
  listPmsRentDueItems,
  listPmsTenants,
  listPmsVendors,
  recordPmsRentPayment,
  listPmsUnits,
  listPmsWorkOrders,
  previewPmsImport,
  applyPmsOccupancyReconciliation,
  downloadPmsDocument,
  transitionPmsOwnerStatement,
  uploadPmsDocument,
  updatePmsProperty,
  updatePmsStaffMember,
  upsertPmsStaffMember,
  updatePmsUnit,
  updatePmsLeaseChecklistItem,
  updatePmsMaintenanceQuote,
  updatePmsWorkOrder,
  upsertPmsTenantPortalAccess,
  type PmsAccountingLedgerEntry,
  type PmsAccountingLedgerPayload,
  type PmsCommunicationLog,
  type PmsCommunicationTemplate,
  type PmsCommunicationTemplatePayload,
  type PmsReminderCandidate,
  type PmsDocument,
  type PmsDocumentPayload,
  type PmsDocumentStatus,
  type PmsDocumentType,
  type PmsInspection,
  type PmsImportBatch,
  type PmsImportPreview,
  type PmsImportType,
  type PmsExportType,
  type PmsInspectionPayload,
  type PmsLease,
  type PmsLeasePayload,
  type PmsMaintenancePriority,
  type PmsMaintenanceQuote,
  type PmsMaintenanceRecurrenceType,
  type PmsMaintenanceStatus,
  type PmsMemberRole,
  type PmsMoveChecklistItem,
  type PmsMoveChecklistPayload,
  type PmsPolicy,
  type PmsPermissionKey,
  type PmsPolicyPayload,
  type PmsPortfolio,
  type PmsProperty,
  type PmsPropertyPayload,
  type PmsRentDueItem,
  type PmsOwnerStatement,
  type PmsOwnerStatementStatus,
  type PmsPersistedOwnerStatement,
  type PmsOccupancyReconciliation,
  type PmsRentReceipt,
  type PmsReportsSummary,
  type PmsStaffMember,
  type PmsTenant,
  type PmsTenantPayload,
  type PmsTenantPortalAccess,
  type PmsUnit,
  type PmsUnitPayload,
  type PmsUnitStatus,
  type PmsVendor,
  type PmsVendorPayload,
  type PmsWorkspaceOverview,
  type PmsCommandCenter,
  type PmsCommandPriority,
  type PmsCommandStatus,
  type PmsReminderType,
  type PmsWorkOrder,
  type PmsWorkOrderPayload,
} from "../api/pms";
import { useAuth } from "../auth/AuthContext";
import MapLocationPanel from "../components/MapLocationPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/format";
import { parseCoordinatesFromMapInput } from "../utils/mapLocation";

const pmsNavigation = [
  { to: "/pms/overview", key: "overview", group: "workspace", icon: Home, permission: null },
  { to: "/crm", key: "crm", group: "workspace", icon: UserRoundCheck, permission: "CRM_VIEW" },
  { to: "/pms/properties", key: "properties", group: "workspace", icon: Building2, permission: "INVENTORY_VIEW" },
  { to: "/pms/units", key: "units", group: "workspace", icon: KeyRound, permission: "INVENTORY_VIEW" },
  { to: "/pms/tenants", key: "tenants", group: "leasing", icon: UserRoundCheck, permission: "TENANCY_VIEW" },
  { to: "/pms/rentals", key: "rentals", group: "leasing", icon: ClipboardList, permission: "TENANCY_VIEW" },
  { to: "/pms/documents", key: "documents", group: "operations", icon: FileText, permission: "DOCUMENTS_VIEW" },
  { to: "/pms/maintenance", key: "maintenance", group: "operations", icon: Wrench, permission: "MAINTENANCE_VIEW" },
  { to: "/pms/accounting", key: "accounting", group: "control", icon: CreditCard, permission: "ACCOUNTING_VIEW" },
  { to: "/pms/reports", key: "reports", group: "control", icon: BarChart3, permission: "REPORTS_VIEW" },
  { to: "/pms/import-export", key: "importExport", group: "control", icon: FileText, permission: "IMPORT_EXPORT" },
  { to: "/pms/staff", key: "staff", group: "control", icon: UserCog, permission: "STAFF_MANAGE" },
  { to: "/pms/settings", key: "settings", group: "control", icon: Settings, permission: "SETTINGS_MANAGE" },
] as const satisfies ReadonlyArray<{
  to: string;
  key: "overview" | "crm" | "properties" | "units" | "tenants" | "rentals" | "documents" | "maintenance" | "accounting" | "importExport" | "staff" | "reports" | "settings";
  group: "workspace" | "leasing" | "operations" | "control";
  icon: typeof Home;
  permission: PmsPermissionKey | null;
}>;

const pmsNavigationGroups = ["workspace", "leasing", "operations", "control"] as const;

const pmsRoles: PmsMemberRole[] = [
  "PMS_OWNER",
  "PMS_MANAGER",
  "PMS_ACCOUNTANT",
  "PMS_MAINTENANCE",
  "PMS_AGENT",
  "PMS_VIEWER",
];

const pmsPermissionGroups: Array<{
  key: string;
  label: { en: string; ar: string };
  permissions: PmsPermissionKey[];
}> = [
  {
    key: "inventory",
    label: { en: "Inventory", ar: "المخزون" },
    permissions: ["INVENTORY_VIEW", "INVENTORY_MANAGE", "IMPORT_EXPORT"],
  },
  {
    key: "tenancy",
    label: { en: "Tenancy", ar: "الإيجارات" },
    permissions: ["TENANCY_VIEW", "TENANCY_MANAGE", "RENT_VIEW", "RENT_MANAGE"],
  },
  {
    key: "finance",
    label: { en: "Finance", ar: "المالية" },
    permissions: ["ACCOUNTING_VIEW", "ACCOUNTING_MANAGE", "REPORTS_VIEW"],
  },
  {
    key: "operations",
    label: { en: "Operations", ar: "التشغيل" },
    permissions: ["MAINTENANCE_VIEW", "MAINTENANCE_MANAGE", "DOCUMENTS_VIEW", "DOCUMENTS_MANAGE", "COMMUNICATIONS_SEND", "SENSITIVE_DATA_VIEW", "SENSITIVE_DATA_EXPORT"],
  },
  {
    key: "crm",
    label: { en: "CRM", ar: "إدارة العملاء" },
    permissions: ["CRM_VIEW", "CRM_MANAGE"],
  },
  {
    key: "admin",
    label: { en: "Administration", ar: "الإدارة" },
    permissions: ["SETTINGS_MANAGE", "STAFF_MANAGE"],
  },
];

const pmsPermissionLabels: Record<PmsPermissionKey, { en: string; ar: string }> = {
  INVENTORY_VIEW: { en: "View inventory", ar: "عرض المخزون" },
  INVENTORY_MANAGE: { en: "Manage inventory", ar: "إدارة المخزون" },
  TENANCY_VIEW: { en: "View tenancy", ar: "عرض الإيجارات" },
  TENANCY_MANAGE: { en: "Manage tenancy", ar: "إدارة الإيجارات" },
  RENT_VIEW: { en: "View rent", ar: "عرض الإيجار" },
  RENT_MANAGE: { en: "Manage rent", ar: "إدارة الإيجار" },
  ACCOUNTING_VIEW: { en: "View accounting", ar: "عرض المحاسبة" },
  ACCOUNTING_MANAGE: { en: "Manage accounting", ar: "إدارة المحاسبة" },
  MAINTENANCE_VIEW: { en: "View maintenance", ar: "عرض الصيانة" },
  MAINTENANCE_MANAGE: { en: "Manage maintenance", ar: "إدارة الصيانة" },
  REPORTS_VIEW: { en: "View reports", ar: "عرض التقارير" },
  SETTINGS_MANAGE: { en: "Manage settings", ar: "إدارة الإعدادات" },
  COMMUNICATIONS_SEND: { en: "Send communications", ar: "إرسال التواصل" },
  DOCUMENTS_VIEW: { en: "View documents", ar: "عرض المستندات" },
  DOCUMENTS_MANAGE: { en: "Manage documents", ar: "إدارة المستندات" },
  STAFF_MANAGE: { en: "Manage staff", ar: "إدارة الفريق" },
  IMPORT_EXPORT: { en: "Import / export", ar: "استيراد وتصدير" },
  SENSITIVE_DATA_VIEW: { en: "View sensitive identity data", ar: "عرض بيانات الهوية الحساسة" },
  SENSITIVE_DATA_EXPORT: { en: "Export sensitive identity data", ar: "تصدير بيانات الهوية الحساسة" },
  CRM_VIEW: { en: "View CRM", ar: "عرض إدارة العملاء" },
  CRM_MANAGE: { en: "Manage CRM", ar: "إدارة العملاء" },
};

const unitStatuses: PmsUnitStatus[] = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "UNAVAILABLE",
];

const rentFrequencies: Array<NonNullable<PmsLeasePayload["rentFrequency"]>> = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];

const maintenancePriorities: PmsMaintenancePriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

const maintenanceStatuses: PmsMaintenanceStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_VENDOR",
  "RESOLVED",
  "CANCELLED",
];

const maintenanceRecurrenceTypes: PmsMaintenanceRecurrenceType[] = [
  "NONE",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];

const pmsDocumentTypes: PmsDocumentType[] = [
  "TENANT_ID",
  "PASSPORT_RESIDENCY",
  "LEASE_AGREEMENT",
  "RENEWAL",
  "MOVE_IN_REPORT",
  "MOVE_OUT_REPORT",
  "DEPOSIT_RECEIPT",
  "INSPECTION_REPORT",
  "MAINTENANCE_INVOICE",
  "POLICY_NOTICE",
  "OTHER",
];

const pmsDocumentStatuses: PmsDocumentStatus[] = [
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "ARCHIVED",
];

const emptyPropertyForm: PmsPropertyPayload = {
  name: "",
  code: "",
  propertyType: "",
  description: "",
  addressLine: "",
  city: "",
  area: "",
  notes: "",
  active: true,
  mapPlaceLabel: "",
  mapAddress: "",
  mapGoogleUrl: "",
  latitude: "",
  longitude: "",
  developerProjectId: "",
  publicListingId: "",
};

const emptyUnitForm: PmsUnitPayload = {
  unitNumber: "",
  unitName: "",
  floor: "",
  bedrooms: null,
  bathrooms: null,
  areaSqm: null,
  status: "VACANT",
  occupancyStatus: null,
  rentAmount: "",
  currency: "OMR",
  notes: "",
  developerProjectId: "",
  publicListingId: "",
};

const emptyTenantForm: PmsTenantPayload = {
  fullName: "",
  phone: "",
  email: "",
  nationality: "",
  nationalId: "",
  passportNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactEmail: "",
  notes: "",
  active: true,
};

const emptyLeaseForm: PmsLeasePayload = {
  tenantId: "",
  propertyId: "",
  unitId: "",
  title: "",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  rentFrequency: "MONTHLY",
  rentAmount: "",
  currency: "OMR",
  securityDeposit: "",
  dueDayOfMonth: null,
  contractDraftId: "",
  notes: "",
  generateRentDueItems: true,
};

const emptyWorkOrderForm: PmsWorkOrderPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  vendorId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  status: "OPEN",
  assignedToText: "",
  vendorText: "",
  cost: "",
  currency: "OMR",
  scheduledFor: "",
  targetDate: "",
  recurrenceType: "NONE",
  nextScheduledDate: "",
  notes: "",
};

const emptyVendorForm: PmsVendorPayload = {
  name: "",
  phone: "",
  email: "",
  trade: "",
  notes: "",
  active: true,
};

const emptyLedgerForm: PmsAccountingLedgerPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  leaseId: "",
  rentDueItemId: "",
  workOrderId: "",
  type: "EXPENSE",
  category: "Repairs",
  amount: 0,
  currency: "OMR",
  transactionDate: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
  notes: "",
};

const emptyTemplateForm: PmsCommunicationTemplatePayload = {
  name: "",
  channel: "EMAIL",
  type: "",
  subject: "",
  body: "",
  active: true,
  notes: "",
};

const emptyPolicyForm: PmsPolicyPayload = {
  title: "",
  category: "GENERAL",
  body: "",
  active: true,
  notes: "",
};

const emptyInspectionForm: PmsInspectionPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  leaseId: "",
  title: "",
  status: "SCHEDULED",
  scheduledFor: "",
  notes: "",
  feedback: "",
  rating: null,
};

const emptyDocumentForm: PmsDocumentPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  leaseId: "",
  workOrderId: "",
  inspectionId: "",
  type: "LEASE_AGREEMENT",
  title: "",
  fileUrl: "",
  status: "ACTIVE",
  expiryDate: "",
  notes: "",
};

function formatNumber(
  value: number | null | undefined,
  language: "en" | "ar",
) {
  if (value == null) return "—";
  return new Intl.NumberFormat(language === "ar" ? "ar-OM" : "en-GB").format(
    value,
  );
}

function formatPercent(
  value: number | null | undefined,
  language: "en" | "ar",
) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-OM" : "en-GB", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatCurrencyAmount(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  language: "en" | "ar",
) {
  if (value == null || !currency) return "—";
  const numericValue = typeof value === "number" ? value : Number(value);
  const amount = Number.isFinite(numericValue)
    ? new Intl.NumberFormat(language === "ar" ? "ar-OM" : "en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericValue)
    : String(value);
  return `${amount} ${currency}`;
}

function formatCommandCurrencyBreakdown(
  totals: PmsCommandCenter["metrics"]["financialsByCurrency"],
  field: "outstandingRent" | "overdueRent" | "rentCollected",
  language: "en" | "ar",
) {
  if (!totals.length) return "—";
  return totals
    .map((total) => formatCurrencyAmount(total[field], total.currency, language))
    .join(" · ");
}

function getRoleLabel(role: string, language: "en" | "ar") {
  const labels: Record<string, { en: string; ar: string }> = {
    PMS_OWNER: { en: "Owner", ar: "مالك المساحة" },
    PMS_MANAGER: { en: "Manager", ar: "مدير" },
    PMS_ACCOUNTANT: { en: "Accountant", ar: "محاسب" },
    PMS_MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    PMS_AGENT: { en: "Agent", ar: "وسيط" },
    PMS_VIEWER: { en: "Viewer", ar: "مشاهد" },
  };

  return labels[role]?.[language] ?? role;
}

function getPermissionLabel(permission: PmsPermissionKey, language: "en" | "ar") {
  return pmsPermissionLabels[permission]?.[language] ?? formatStatusText(permission);
}

function getPermissionGroupLabel(group: (typeof pmsPermissionGroups)[number], language: "en" | "ar") {
  return group.label[language];
}

function getCompanyName(
  company: { nameEn: string; nameAr?: string | null },
  language: "en" | "ar",
) {
  return language === "ar"
    ? company.nameAr || company.nameEn
    : company.nameEn || company.nameAr || "";
}

function hasPmsPermission(
  permissionKeys: readonly PmsPermissionKey[] | undefined,
  permission: PmsPermissionKey,
) {
  return permissionKeys?.includes(permission) ?? false;
}

function getPmsSectionPermission(section: string): PmsPermissionKey | null {
  if (section === "properties" || section === "propertyDetail" || section === "units") return "INVENTORY_VIEW";
  if (section === "tenants" || section === "rentals" || section === "leaseDetail") return "TENANCY_VIEW";
  if (section === "documents") return "DOCUMENTS_VIEW";
  if (section === "maintenance") return "MAINTENANCE_VIEW";
  if (section === "accounting") return "ACCOUNTING_VIEW";
  if (section === "reports") return "REPORTS_VIEW";
  if (section === "importExport") return "IMPORT_EXPORT";
  if (section === "staff") return "STAFF_MANAGE";
  if (section === "settings") return "SETTINGS_MANAGE";
  return null;
}

function getUnitStatusLabel(status: PmsUnitStatus, language: "en" | "ar") {
  const labels: Record<PmsUnitStatus, { en: string; ar: string }> = {
    VACANT: { en: "Vacant", ar: "شاغرة" },
    OCCUPIED: { en: "Occupied", ar: "مشغولة" },
    RESERVED: { en: "Reserved", ar: "محجوزة" },
    MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    UNAVAILABLE: { en: "Unavailable", ar: "غير متاحة" },
  };

  return labels[status][language];
}

function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanPropertyPayload(
  form: PmsPropertyPayload,
  companyId: string,
): PmsPropertyPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    code: form.code || null,
    propertyType: form.propertyType || null,
    description: form.description || null,
    addressLine: form.addressLine || null,
    city: form.city || null,
    area: form.area || null,
    notes: form.notes || null,
    mapPlaceLabel: form.mapPlaceLabel || null,
    mapAddress: form.mapAddress || null,
    mapGoogleUrl: form.mapGoogleUrl || null,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
    active: form.active ?? true,
  };
}

function cleanPropertyUpdatePayload(
  form: PmsPropertyPayload,
): Partial<PmsPropertyPayload> {
  return {
    name: form.name,
    code: form.code || null,
    propertyType: form.propertyType || null,
    description: form.description || null,
    addressLine: form.addressLine || null,
    city: form.city || null,
    area: form.area || null,
    notes: form.notes || null,
    mapPlaceLabel: form.mapPlaceLabel || null,
    mapAddress: form.mapAddress || null,
    mapGoogleUrl: form.mapGoogleUrl || null,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
    active: form.active ?? true,
  };
}

function cleanUnitPayload(form: PmsUnitPayload): PmsUnitPayload {
  return {
    ...form,
    unitName: form.unitName || null,
    floor: form.floor || null,
    bedrooms: numberOrNull(form.bedrooms),
    bathrooms: numberOrNull(form.bathrooms),
    areaSqm: numberOrNull(form.areaSqm),
    rentAmount: numberOrNull(form.rentAmount),
    currency: form.currency || "OMR",
    notes: form.notes || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
  };
}

function cleanUnitUpdatePayload(
  form: Partial<PmsUnitPayload>,
): Partial<PmsUnitPayload> {
  const payload: Partial<PmsUnitPayload> = {};

  if ("unitNumber" in form) payload.unitNumber = form.unitNumber;
  if ("unitName" in form) payload.unitName = form.unitName || null;
  if ("floor" in form) payload.floor = form.floor || null;
  if ("bedrooms" in form) payload.bedrooms = numberOrNull(form.bedrooms);
  if ("bathrooms" in form) payload.bathrooms = numberOrNull(form.bathrooms);
  if ("areaSqm" in form) payload.areaSqm = numberOrNull(form.areaSqm);
  if ("status" in form) payload.status = form.status;
  if ("occupancyStatus" in form) payload.occupancyStatus = form.occupancyStatus;
  if ("rentAmount" in form) payload.rentAmount = numberOrNull(form.rentAmount);
  if ("currency" in form) payload.currency = form.currency || "OMR";
  if ("notes" in form) payload.notes = form.notes || null;
  if ("developerProjectId" in form) {
    payload.developerProjectId = form.developerProjectId || null;
  }
  if ("publicListingId" in form) {
    payload.publicListingId = form.publicListingId || null;
  }

  return payload;
}

function cleanTenantPayload(
  form: PmsTenantPayload,
  companyId: string,
): PmsTenantPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    phone: form.phone || null,
    email: form.email || null,
    nationality: form.nationality || null,
    nationalId: form.nationalId || null,
    passportNumber: form.passportNumber || null,
    emergencyContactName: form.emergencyContactName || null,
    emergencyContactPhone: form.emergencyContactPhone || null,
    emergencyContactEmail: form.emergencyContactEmail || null,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanLeasePayload(
  form: PmsLeasePayload,
  companyId: string,
): PmsLeasePayload & { companyId: string } {
  return {
    ...form,
    companyId,
    title: form.title || null,
    endDate: form.endDate || null,
    rentAmount: numberOrNull(form.rentAmount) ?? 0,
    currency: form.currency || "OMR",
    securityDeposit: numberOrNull(form.securityDeposit),
    dueDayOfMonth: numberOrNull(form.dueDayOfMonth),
    contractDraftId: form.contractDraftId || null,
    notes: form.notes || null,
    generateRentDueItems: form.generateRentDueItems ?? true,
  };
}

function cleanWorkOrderPayload(
  form: PmsWorkOrderPayload,
  companyId: string,
): PmsWorkOrderPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    unitId: form.unitId || null,
    tenantId: form.tenantId || null,
    vendorId: form.vendorId || null,
    description: form.description || null,
    assignedToText: form.assignedToText || null,
    vendorText: form.vendorText || null,
    cost: numberOrNull(form.cost),
    currency: form.currency || "OMR",
    scheduledFor: form.scheduledFor || null,
    resolvedAt: form.resolvedAt || null,
    targetDate: form.targetDate || null,
    recurrenceType: form.recurrenceType || "NONE",
    nextScheduledDate: form.nextScheduledDate || null,
    notes: form.notes || null,
  };
}

function cleanVendorPayload(
  form: PmsVendorPayload,
  companyId: string,
): PmsVendorPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    phone: form.phone || null,
    email: form.email || null,
    trade: form.trade || null,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanTemplatePayload(
  form: PmsCommunicationTemplatePayload,
  companyId: string,
): PmsCommunicationTemplatePayload & { companyId: string } {
  return {
    ...form,
    companyId,
    type: form.type || null,
    subject: form.subject || null,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanPolicyPayload(
  form: PmsPolicyPayload,
  companyId: string,
): PmsPolicyPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanInspectionPayload(
  form: PmsInspectionPayload,
  companyId: string,
): PmsInspectionPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    unitId: form.unitId || null,
    tenantId: form.tenantId || null,
    leaseId: form.leaseId || null,
    scheduledFor: form.scheduledFor || null,
    completedAt: form.completedAt || null,
    notes: form.notes || null,
    feedback: form.feedback || null,
    rating: numberOrNull(form.rating),
  };
}

function formatDate(value?: string | null, language: "en" | "ar" = "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-OM" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function propertyToForm(property: PmsProperty): PmsPropertyPayload {
  return {
    name: property.name,
    code: property.code ?? "",
    propertyType: property.propertyType ?? "",
    description: property.description ?? "",
    addressLine: property.addressLine ?? "",
    city: property.city ?? "",
    area: property.area ?? "",
    notes: property.notes ?? "",
    active: property.active,
    mapPlaceLabel: property.mapPlaceLabel ?? "",
    mapAddress: property.mapAddress ?? "",
    mapGoogleUrl: property.mapGoogleUrl ?? "",
    latitude: property.latitude ?? "",
    longitude: property.longitude ?? "",
    developerProjectId: property.developerProjectId ?? "",
    publicListingId: property.publicListingId ?? "",
  };
}

function formatStatusText(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanDocumentPayload(form: PmsDocumentPayload, companyId: string): PmsDocumentPayload & { companyId: string } {
  return {
    companyId,
    propertyId: form.propertyId || null,
    unitId: form.unitId || null,
    tenantId: form.tenantId || null,
    leaseId: form.leaseId || null,
    workOrderId: form.workOrderId || null,
    inspectionId: form.inspectionId || null,
    type: form.type || "OTHER",
    title: form.title.trim(),
    fileUrl: form.fileUrl?.trim() ?? "",
    status: form.status || "ACTIVE",
    expiryDate: form.expiryDate || null,
    notes: form.notes?.trim() || null,
  };
}

function cleanPrivateDocumentPayload(
  form: PmsDocumentPayload,
  companyId: string,
): Omit<PmsDocumentPayload, "fileUrl"> & { companyId: string } {
  const { fileUrl: _legacyFileUrl, ...payload } = cleanDocumentPayload(form, companyId);
  return payload;
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`pms-status-badge pms-status-badge--${status.toLowerCase()}`}
    >
      {label ?? formatStatusText(status)}
    </span>
  );
}

function downloadCsvFile(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function pmsExportFilename(type: PmsExportType) {
  return `pms-${type}.csv`;
}

function pmsTemplateFilename(type: PmsImportType) {
  return `pms-${type.toLowerCase()}-template.csv`;
}

export default function PmsPortal() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompanyId = searchParams.get("companyId") ?? undefined;
  const selectedPropertyId = params.propertyId;
  const selectedLeaseId = params.leaseId;

  const [overview, setOverview] = useState<PmsWorkspaceOverview | null>(null);
  const [commandCenter, setCommandCenter] = useState<PmsCommandCenter | null>(null);
  const [commandPriorityFilter, setCommandPriorityFilter] = useState<"ALL" | PmsCommandPriority>("ALL");
  const [commandStatusFilter, setCommandStatusFilter] = useState<"ALL" | PmsCommandStatus>("ALL");
  const [commandPropertyFilter, setCommandPropertyFilter] = useState("ALL");
  const [commandDateFrom, setCommandDateFrom] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  });
  const [commandDateTo, setCommandDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [commandRiskWindowDays, setCommandRiskWindowDays] = useState(60);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [automationRunning, setAutomationRunning] = useState<PmsReminderType | null>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [tenants, setTenants] = useState<PmsTenant[]>([]);
  const [leases, setLeases] = useState<PmsLease[]>([]);
  const [rentDueItems, setRentDueItems] = useState<PmsRentDueItem[]>([]);
  const [workOrders, setWorkOrders] = useState<PmsWorkOrder[]>([]);
  const [vendors, setVendors] = useState<PmsVendor[]>([]);
  const [reportsSummary, setReportsSummary] = useState<PmsReportsSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<PmsAccountingLedgerEntry[]>([]);
  const [ownerStatement, setOwnerStatement] = useState<PmsOwnerStatement | null>(null);
  const [ownerStatements, setOwnerStatements] = useState<PmsPersistedOwnerStatement[]>([]);
  const [ownerStatementMonth, setOwnerStatementMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [ownerStatementPropertyId, setOwnerStatementPropertyId] = useState("");
  const [ownerStatementCurrency, setOwnerStatementCurrency] = useState("OMR");
  const [occupancyReconciliation, setOccupancyReconciliation] = useState<PmsOccupancyReconciliation | null>(null);
  const [rentReceipt, setRentReceipt] = useState<PmsRentReceipt | null>(null);
  const [templates, setTemplates] = useState<PmsCommunicationTemplate[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<PmsCommunicationLog[]>([]);
  const [reminderCandidates, setReminderCandidates] = useState<PmsReminderCandidate[]>([]);
  const [importPreview, setImportPreview] = useState<PmsImportPreview | null>(null);
  const [importBatches, setImportBatches] = useState<PmsImportBatch[]>([]);
  const [importType, setImportType] = useState<PmsImportType>("PROPERTIES");
  const [importFilename, setImportFilename] = useState("");
  const [importCsvText, setImportCsvText] = useState("");
  const [staffMembers, setStaffMembers] = useState<PmsStaffMember[]>([]);
  const [staffProperties, setStaffProperties] = useState<Array<Pick<PmsProperty, "id" | "name" | "code" | "active">>>([]);
  const [staffPortfolios, setStaffPortfolios] = useState<PmsPortfolio[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<PmsMemberRole>("PMS_VIEWER");
  const [staffPropertyIds, setStaffPropertyIds] = useState<string[]>([]);
  const [staffPermissionKeys, setStaffPermissionKeys] = useState<PmsPermissionKey[]>([]);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioPropertyIds, setPortfolioPropertyIds] = useState<string[]>([]);
  const [communicationPreview, setCommunicationPreview] = useState<{ subject?: string | null; body: string } | null>(null);
  const [policies, setPolicies] = useState<PmsPolicy[]>([]);
  const [inspections, setInspections] = useState<PmsInspection[]>([]);
  const [documents, setDocuments] = useState<PmsDocument[]>([]);
  const [documentAlerts, setDocumentAlerts] = useState<PmsDocument[]>([]);
  const [activeLeaseDocuments, setActiveLeaseDocuments] = useState<PmsDocument[]>([]);
  const [activeLeaseChecklists, setActiveLeaseChecklists] = useState<PmsMoveChecklistItem[]>([]);
  const [activeProperty, setActiveProperty] = useState<PmsProperty | null>(
    null,
  );
  const [activeLease, setActiveLease] = useState<PmsLease | null>(null);
  const [propertyForm, setPropertyForm] =
    useState<PmsPropertyPayload>(emptyPropertyForm);
  const [unitForm, setUnitForm] = useState<PmsUnitPayload>(emptyUnitForm);
  const [tenantForm, setTenantForm] =
    useState<PmsTenantPayload>(emptyTenantForm);
  const [portalAccessEmails, setPortalAccessEmails] = useState<Record<string, string>>({});
  const [portalAccessBusy, setPortalAccessBusy] = useState<Record<string, boolean>>({});
  const [leaseForm, setLeaseForm] = useState<PmsLeasePayload>(emptyLeaseForm);
  const [workOrderForm, setWorkOrderForm] =
    useState<PmsWorkOrderPayload>(emptyWorkOrderForm);
  const [vendorForm, setVendorForm] = useState<PmsVendorPayload>(emptyVendorForm);
  const [ledgerForm, setLedgerForm] =
    useState<PmsAccountingLedgerPayload>(emptyLedgerForm);
  const [templateForm, setTemplateForm] =
    useState<PmsCommunicationTemplatePayload>(emptyTemplateForm);
  const [policyForm, setPolicyForm] =
    useState<PmsPolicyPayload>(emptyPolicyForm);
  const [inspectionForm, setInspectionForm] =
    useState<PmsInspectionPayload>(emptyInspectionForm);
  const [documentForm, setDocumentForm] =
    useState<PmsDocumentPayload>(emptyDocumentForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDownloadingId, setDocumentDownloadingId] = useState<string | null>(null);
  const [unitDrafts, setUnitDrafts] = useState<
    Record<string, Partial<PmsUnitPayload>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useDocumentTitle("lux PMS");

  const copy =
    language === "ar"
      ? {
          eyebrow: "lux PMS",
          portal: "بوابة إدارة العقارات",
          portalText:
            "مساحة B2B منفصلة لإدارة المحافظ والوحدات والإيجارات والعمليات المالية تدريجياً.",
          active: "مفعّل",
          trial: "تجريبي",
          suspended: "معلق",
          expired: "منتهي",
          company: "الشركة",
          role: "صلاحيتك",
          loading: "جاري تحميل بوابة PMS...",
          unavailable: "تعذر تحميل بيانات PMS.",
          saved: "تم الحفظ بنجاح.",
          overview: "نظرة عامة",
          crm: "إدارة العملاء",
          properties: "العقارات",
          units: "الوحدات",
          tenants: "المستأجرون",
          rentals: "الإيجارات",
          maintenance: "الصيانة",
          accounting: "المحاسبة",
          reports: "التقارير",
          settings: "الإعدادات",
          documents: "المستندات",
          soon: "قريباً",
          headline: "مركز إدارة محفظة العقارات",
          headlineText:
            "هذه بوابة PMS الخاصة. المخزون هنا خاص ولا يظهر في سوق lux.om إلا إذا تم ربطه أو نشره لاحقاً بشكل واضح.",
          totalPmsProperties: "عقارات PMS خاصة",
          totalPmsUnits: "إجمالي الوحدات",
          vacantPmsUnits: "وحدات شاغرة",
          occupiedPmsUnits: "وحدات مشغولة",
          maintenancePmsUnits: "وحدات صيانة",
          occupancyRate: "نسبة الإشغال",
          totalListings: "إعلانات عامة مرتبطة",
          approvedListings: "إعلانات منشورة",
          totalProjects: "مشاريع مرتبطة",
          readiness: "جاهزية المساحة",
          launchChecklist: "قائمة جاهزية الإطلاق",
          launchChecklistText: "استخدم هذه القائمة قبل دعوة أول شركة أو مستأجرين إلى التجربة.",
          launchDocs: "مستندات التشغيل",
          launchDocsText: "راجع دليل الإعداد وقائمة QA و runbook الإنتاج قبل الإطلاق.",
          checklistPmsAccess: "تفعيل PMS وإضافة مسؤول للشركة",
          checklistInventory: "إضافة عقارات ووحدات أو استيرادها",
          checklistTenancy: "إضافة مستأجرين وعقود وجدولة الإيجارات",
          checklistFinance: "اختبار التحصيل والإيصال والمحاسبة",
          checklistOperations: "إضافة صيانة ومستندات وقوالب تواصل",
          checklistPermissions: "مراجعة صلاحيات الفريق ونطاق العقارات",
          checklistComplete: "جاهز",
          checklistPending: "يحتاج مراجعة",
          entitlementReady: "تم تفعيل صلاحية PMS للشركة.",
          accessScoped:
            "صلاحيتك مرتبطة بهذه الشركة فقط وليست صلاحية عامة على المنصة.",
          privateInventory: "مخزون PMS خاص ومنفصل عن السوق العام.",
          emptyProperties: "لا توجد عقارات PMS خاصة بعد.",
          emptyUnits: "لا توجد وحدات بعد.",
          emptyRentals: "لا توجد جداول إيجار نشطة بعد.",
          emptyAccounting: "لا توجد دفعات مستحقة أو متأخرة حالياً.",
          switchCompany: "تبديل الشركة",
          createProperty: "إضافة عقار PMS",
          editProperty: "تعديل العقار",
          createUnit: "إضافة وحدة",
          propertyName: "اسم العقار",
          code: "الكود الداخلي",
          type: "النوع",
          city: "المدينة",
          area: "المنطقة",
          address: "العنوان",
          description: "الوصف",
          notes: "ملاحظات خاصة",
          googleMap: "رابط Google Maps أو الإحداثيات",
          placeLabel: "اسم نقطة الخريطة",
          latitude: "خط العرض",
          longitude: "خط الطول",
          activeLabel: "نشط",
          save: "حفظ",
          unitNumber: "رقم الوحدة",
          unitName: "اسم الوحدة",
          floor: "الدور",
          bedrooms: "غرف",
          bathrooms: "حمامات",
          areaSqm: "المساحة م²",
          rent: "الإيجار",
          currency: "العملة",
          status: "الحالة",
          linkedPublicListing: "رابط إعلان عام اختياري",
          linkedProject: "رابط مشروع اختياري",
          privateNote: "لن يظهر هذا المخزون في السوق العام تلقائياً.",
          view: "عرض",
          update: "تحديث",
          cannotEdit: "صلاحيتك تسمح بالعرض فقط.",
          tenantName: "اسم المستأجر",
          phone: "الهاتف",
          email: "البريد الإلكتروني",
          nationality: "الجنسية",
          nationalId: "رقم الهوية",
          passportNumber: "رقم الجواز",
          emergencyContact: "جهة اتصال للطوارئ",
          createTenant: "إضافة مستأجر",
          createLease: "إضافة عقد إيجار",
          lease: "العقد",
          leaseTitle: "عنوان العقد",
          startDate: "تاريخ البداية",
          endDate: "تاريخ النهاية",
          frequency: "الدورية",
          deposit: "التأمين",
          dueDay: "يوم الاستحقاق",
          activeLeases: "عقود نشطة",
          expiringLeases: "عقود قاربت الانتهاء",
          unpaidRent: "دفعات غير مدفوعة",
          overdueRent: "دفعات متأخرة",
          paidRent: "دفعات مدفوعة",
          rentCollection: "تحصيل الإيجار",
          markPaid: "تسجيل دفعة",
          confirmMarkPaid: "أدخل مبلغ الدفعة",
          paymentMethod: "طريقة الدفع",
          paymentReference: "رقم المرجع",
          printableReceipt: "إيصال قابل للطباعة",
          printReceipt: "طباعة الإيصال",
          paidAmount: "المبلغ المدفوع",
          dueDate: "تاريخ الاستحقاق",
          amount: "المبلغ",
          partiallyPaid: "مدفوع جزئياً",
          emptyTenants: "لا يوجد مستأجرون بعد.",
          tenantPortalAccess: "صلاحية بوابة المستأجر",
          tenantPortalAccessText:
            "اربط حساب lux.om الخاص بالمستأجر بهذا السجل حتى يتمكن من رؤية عقده ودفعاته وطلبات الصيانة فقط.",
          portalEmail: "بريد حساب المستأجر",
          grantPortalAccess: "تفعيل الوصول",
          disablePortalAccess: "تعطيل",
          noPortalAccess: "لا يوجد حساب مرتبط ببوابة المستأجر بعد.",
          portalAccessActive: "مفعل",
          portalAccessDisabled: "معطل",
          confirmDisablePortalAccess: "هل تريد تعطيل وصول هذا المستخدم إلى بوابة المستأجر؟",
          portalAccessSaved: "تم تحديث صلاحية بوابة المستأجر.",
          tenantUserRequired:
            "يجب أن يكون لدى المستأجر حساب lux.om بنفس البريد قبل تفعيل الوصول.",
          emptyLeases: "لا توجد عقود PMS بعد.",
          emptyRentDue: "لا توجد دفعات إيجار PMS بعد.",
          documentsCenter: "مركز مستندات PMS",
          documentAlerts: "تنبيهات انتهاء المستندات",
          createDocument: "إضافة مستند",
          documentTitle: "عنوان المستند",
          documentUrl: "رابط أو مسار الملف",
          documentType: "نوع المستند",
          expiryDate: "تاريخ الانتهاء",
          openDocument: "فتح المستند",
          emptyDocuments: "لا توجد مستندات PMS بعد.",
          renewalDraft: "مسودة تجديد",
          createRenewalDraft: "إنشاء مسودة تجديد",
          moveChecklist: "قائمة انتقال المستأجر",
          addChecklistItem: "إضافة بند",
          completeChecklistItem: "إكمال",
          createWorkOrder: "إضافة طلب صيانة",
          workOrderTitle: "عنوان طلب الصيانة",
          priority: "الأولوية",
          assignedTo: "المسؤول",
          vendor: "المورّد",
          vendors: "المورّدون",
          createVendor: "إضافة مورّد",
          trade: "التخصص",
          quote: "عرض السعر",
          addQuote: "إضافة عرض سعر",
          approveQuote: "اعتماد العرض",
          targetDate: "تاريخ الاستهداف",
          recurrence: "التكرار",
          overdue: "متأخر",
          tenantConfirmed: "أكده المستأجر",
          cost: "التكلفة",
          scheduledFor: "موعد مجدول",
          maintenanceRequests: "طلبات الصيانة",
          emptyMaintenance: "لا توجد طلبات صيانة بعد.",
          resolve: "إنهاء",
          confirmResolve: "هل تريد إنهاء طلب الصيانة هذا؟",
          createTemplate: "إضافة قالب تواصل",
          previewTemplate: "معاينة القالب",
          sendNotice: "إرسال إشعار",
          communicationHistory: "سجل التواصل",
          reminderCenter: "مركز التذكيرات",
          reminderCandidates: "مرشحون للتذكير",
          whatsappCopyOnly: "واتساب محفوظ كنص/قالب فقط إلى أن يتم ربط تكامل حقيقي.",
          templateVariables: "المتغيرات المتاحة",
          templatePreview: "معاينة القالب",
          templateName: "اسم القالب",
          channel: "القناة",
          subject: "الموضوع",
          body: "النص",
          createPolicy: "إضافة سياسة",
          policyTitle: "عنوان السياسة",
          category: "التصنيف",
          createInspection: "إضافة فحص",
          inspectionTitle: "عنوان الفحص",
          feedback: "ملاحظات/تقييم",
          rating: "التقييم",
          accountingSummary: "ملخص المحاسبة",
          accountingLedger: "دفتر القيود",
          ownerStatement: "كشف المالك",
          createLedgerEntry: "إضافة قيد",
          ledgerEntryType: "نوع القيد",
          transactionDate: "تاريخ العملية",
          referenceNumber: "رقم المرجع",
          netAmount: "الصافي",
          depositHeld: "التأمين المحتفظ به",
          manualEntry: "قيد يدوي",
          incomeCollected: "الدخل المحصل",
          outstandingRent: "إيجار مستحق",
          overdueAmount: "مبالغ متأخرة",
          expenses: "المصروفات",
          maintenanceCosts: "تكاليف الصيانة",
          lateFeeFoundation: "أساس رسوم التأخير",
          occupancyReport: "تقرير الإشغال",
          revenueReport: "تقرير الإيرادات",
          overdueTopList: "أعلى المتأخرات",
          leaseRenewals: "تجديدات العقود",
          inspections: "الفحوصات",
          communications: "التواصل",
          policies: "السياسات",
          importExport: "الاستيراد والتصدير",
          importExportTitle: "الاستيراد والتصدير",
          importExportDescription: "استورد بيانات PMS بشكل آمن مع معاينة أخطاء قبل الاعتماد، أو صدّر بيانات التشغيل كملفات CSV.",
          bulkImport: "استيراد CSV",
          bulkExport: "تصدير CSV",
          importType: "نوع الاستيراد",
          csvFile: "ملف CSV",
          previewImport: "معاينة الاستيراد",
          commitImport: "اعتماد الاستيراد",
          validRows: "صفوف صحيحة",
          invalidRows: "صفوف بها أخطاء",
          importBatches: "دفعات الاستيراد",
          downloadTemplate: "تحميل نموذج CSV",
          exportData: "تصدير البيانات",
          previewDoesNotWrite: "المعاينة لا تنشئ أي سجلات. الاعتماد فقط يستورد الصفوف الصحيحة.",
          pasteCsvOrUpload: "الصق CSV هنا أو اختر ملفاً للمعاينة.",
          csvEditorPlaceholder: "name,code,city\nExample Tower,EX-001,Muscat",
          noImportBatches: "لا توجد دفعات استيراد بعد. ستظهر عمليات الاستيراد المعتمدة هنا.",
          exportHelp: "حمّل ملفات CSV لاستخدامها في التدقيق أو الانتقال أو التحليل.",
          staff: "فريق PMS",
          staffTitle: "الفريق والصلاحيات",
          staffDescription: "ادعُ الموظفين، عيّن أدوار PMS، وحدد نطاق العقارات والصلاحيات بدون منح صلاحيات منصة عامة.",
          inviteStaff: "إضافة موظف",
          staffEmail: "بريد المستخدم",
          propertyScope: "نطاق العقارات",
          allProperties: "كل العقارات",
          selectedProperties: "عقارات محددة",
          customPermissions: "صلاحيات إضافية",
          permissionGroups: "مجموعات الصلاحيات",
          noExtraPermissions: "لا توجد صلاحيات إضافية محددة.",
          activeStaff: "أعضاء نشطون",
          staffDangerZone: "إجراء حساس",
          staffScopeHelp: "اتركه فارغاً للوصول لكل العقارات، أو حدد عقارات معينة لهذا الموظف.",
          portfolioHelp: "اجمع العقارات داخل محافظ لتسهيل إدارة الفِرق والتقارير.",
          emptyPortfolios: "لا توجد محافظ بعد. أنشئ محفظة لتجميع العقارات أو الفروع.",
          noPropertiesForScope: "أضف عقارات أولاً لتفعيل تحديد النطاق.",
          suspendAccess: "تعليق الوصول",
          restoreAccess: "إعادة التفعيل",
          portfolios: "المحافظ",
          portfolioName: "اسم المحفظة",
          createPortfolio: "إنشاء محفظة",
          accessControls: "صلاحيات ومساحات العمل",
          emptyReports: "لا توجد بيانات تقارير كافية بعد.",
        }
      : {
          eyebrow: "lux PMS",
          portal: "Property Management System portal",
          portalText:
            "A separate private B2B workspace for portfolio, unit, rental, maintenance, and accounting operations.",
          active: "Active",
          trial: "Trial",
          suspended: "Suspended",
          expired: "Expired",
          company: "Company",
          role: "Your role",
          loading: "Loading PMS portal...",
          unavailable: "Could not load PMS data.",
          saved: "Saved successfully.",
          overview: "Overview",
          crm: "CRM",
          properties: "Properties",
          units: "Units",
          tenants: "Tenants",
          rentals: "Rentals",
          maintenance: "Maintenance",
          accounting: "Accounting",
          reports: "Reports",
          settings: "Settings",
          documents: "Documents",
          soon: "Soon",
          headline: "Private property inventory command center",
          headlineText:
            "This PMS inventory is private by default. It does not appear on lux.om marketplace unless you explicitly link or publish it later.",
          totalPmsProperties: "Private PMS properties",
          totalPmsUnits: "Total units",
          vacantPmsUnits: "Vacant units",
          occupiedPmsUnits: "Occupied units",
          maintenancePmsUnits: "Maintenance units",
          occupancyRate: "Occupancy rate",
          totalListings: "Linked public listings",
          approvedListings: "Published listings",
          totalProjects: "Linked projects",
          readiness: "Workspace readiness",
          launchChecklist: "Launch readiness checklist",
          launchChecklistText: "Use this before inviting the first beta company or tenant users.",
          launchDocs: "Operating docs",
          launchDocsText: "Review the setup guide, QA checklist, and production runbook before launch.",
          checklistPmsAccess: "Enable PMS and add company owner",
          checklistInventory: "Add or import properties and units",
          checklistTenancy: "Add tenants, leases, and rent schedule",
          checklistFinance: "Test rent payment, receipt, and accounting",
          checklistOperations: "Add maintenance, documents, and communication templates",
          checklistPermissions: "Review staff roles and property scopes",
          checklistComplete: "Ready",
          checklistPending: "Needs review",
          entitlementReady: "PMS entitlement is enabled for this company.",
          accessScoped:
            "Your PMS access is scoped to this company, not global marketplace power.",
          privateInventory:
            "PMS inventory is private and separate from the public marketplace.",
          emptyProperties: "No private PMS properties yet.",
          emptyUnits: "No units yet.",
          emptyRentals: "No active rent schedules yet.",
          emptyAccounting: "No due or overdue rent payments right now.",
          switchCompany: "Switch company",
          createProperty: "Create PMS property",
          editProperty: "Edit property",
          createUnit: "Create unit",
          propertyName: "Property name",
          code: "Internal code",
          type: "Type",
          city: "City",
          area: "Area",
          address: "Address",
          description: "Description",
          notes: "Private notes",
          googleMap: "Google Maps URL or coordinates",
          placeLabel: "Map pin label",
          latitude: "Latitude",
          longitude: "Longitude",
          activeLabel: "Active",
          save: "Save",
          unitNumber: "Unit number",
          unitName: "Unit name",
          floor: "Floor",
          bedrooms: "Beds",
          bathrooms: "Baths",
          areaSqm: "Area sqm",
          rent: "Rent",
          currency: "Currency",
          status: "Status",
          linkedPublicListing: "Optional public listing link",
          linkedProject: "Optional project link",
          privateNote:
            "This inventory will not appear on the public marketplace automatically.",
          view: "View",
          update: "Update",
          cannotEdit: "Your PMS role is view-only for inventory changes.",
          tenantName: "Tenant name",
          phone: "Phone",
          email: "Email",
          nationality: "Nationality",
          nationalId: "National ID",
          passportNumber: "Passport number",
          emergencyContact: "Emergency contact",
          createTenant: "Create tenant",
          createLease: "Create lease",
          lease: "Lease",
          leaseTitle: "Lease title",
          startDate: "Start date",
          endDate: "End date",
          frequency: "Frequency",
          deposit: "Deposit",
          dueDay: "Due day",
          activeLeases: "Active leases",
          expiringLeases: "Expiring leases",
          unpaidRent: "Unpaid rent",
          overdueRent: "Overdue rent",
          paidRent: "Paid rent",
          rentCollection: "Rent collection",
          markPaid: "Record payment",
          confirmMarkPaid: "Enter payment amount",
          paymentMethod: "Payment method",
          paymentReference: "Reference number",
          printableReceipt: "Printable receipt",
          printReceipt: "Print receipt",
          paidAmount: "Paid amount",
          dueDate: "Due date",
          amount: "Amount",
          partiallyPaid: "Partially paid",
          emptyTenants: "No PMS tenants yet.",
          tenantPortalAccess: "Tenant portal access",
          tenantPortalAccessText:
            "Link the tenant's lux.om user account to this PMS tenant record so they can see only their own lease, rent, and maintenance information.",
          portalEmail: "Tenant account email",
          grantPortalAccess: "Grant access",
          disablePortalAccess: "Disable",
          noPortalAccess: "No tenant portal user is linked yet.",
          portalAccessActive: "Active",
          portalAccessDisabled: "Disabled",
          confirmDisablePortalAccess: "Disable this user's tenant portal access?",
          portalAccessSaved: "Tenant portal access updated.",
          tenantUserRequired:
            "The tenant needs a lux.om user account with this email before access can be granted.",
          emptyLeases: "No PMS leases yet.",
          emptyRentDue: "No PMS rent due items yet.",
          documentsCenter: "PMS document center",
          documentAlerts: "Document expiry alerts",
          createDocument: "Add document",
          documentTitle: "Document title",
          documentUrl: "File URL or path",
          documentType: "Document type",
          expiryDate: "Expiry date",
          openDocument: "Open document",
          emptyDocuments: "No PMS documents yet.",
          renewalDraft: "Renewal draft",
          createRenewalDraft: "Create renewal draft",
          moveChecklist: "Move-in / move-out checklist",
          addChecklistItem: "Add checklist item",
          completeChecklistItem: "Complete",
          createWorkOrder: "Create work order",
          workOrderTitle: "Work order title",
          priority: "Priority",
          assignedTo: "Assigned to",
          vendor: "Vendor",
          vendors: "Vendors",
          createVendor: "Create vendor",
          trade: "Trade",
          quote: "Quote",
          addQuote: "Add quote",
          approveQuote: "Approve quote",
          targetDate: "Target date",
          recurrence: "Recurrence",
          overdue: "Overdue",
          tenantConfirmed: "Tenant confirmed",
          cost: "Cost",
          scheduledFor: "Scheduled for",
          maintenanceRequests: "Maintenance requests",
          emptyMaintenance: "No maintenance requests yet.",
          resolve: "Resolve",
          confirmResolve: "Resolve this maintenance work order?",
          createTemplate: "Create communication template",
          previewTemplate: "Preview template",
          sendNotice: "Send notice",
          communicationHistory: "Communication history",
          reminderCenter: "Reminder center",
          reminderCandidates: "Reminder candidates",
          whatsappCopyOnly: "WhatsApp is copy/template only until a real integration is configured.",
          templateVariables: "Available variables",
          templatePreview: "Template preview",
          templateName: "Template name",
          channel: "Channel",
          subject: "Subject",
          body: "Body",
          createPolicy: "Create policy",
          policyTitle: "Policy title",
          category: "Category",
          createInspection: "Create inspection",
          inspectionTitle: "Inspection title",
          feedback: "Feedback",
          rating: "Rating",
          accountingSummary: "Accounting summary",
          accountingLedger: "Accounting ledger",
          ownerStatement: "Owner statement",
          createLedgerEntry: "Create ledger entry",
          ledgerEntryType: "Entry type",
          transactionDate: "Transaction date",
          referenceNumber: "Reference number",
          netAmount: "Net amount",
          depositHeld: "Deposit held",
          manualEntry: "Manual entry",
          incomeCollected: "Income collected",
          outstandingRent: "Outstanding rent",
          overdueAmount: "Overdue amount",
          expenses: "Expenses",
          maintenanceCosts: "Maintenance costs",
          lateFeeFoundation: "Late fee foundation",
          occupancyReport: "Occupancy report",
          revenueReport: "Revenue report",
          overdueTopList: "Overdue top list",
          leaseRenewals: "Lease renewals",
          inspections: "Inspections",
          communications: "Communications",
          policies: "Policies",
          importExport: "Import / Export",
          importExportTitle: "Import / Export",
          importExportDescription: "Safely onboard PMS records with CSV validation before commit, or export operational datasets for audit and migration.",
          bulkImport: "CSV import",
          bulkExport: "CSV export",
          importType: "Import type",
          csvFile: "CSV file",
          previewImport: "Preview import",
          commitImport: "Commit import",
          validRows: "Valid rows",
          invalidRows: "Invalid rows",
          importBatches: "Import batches",
          downloadTemplate: "Download CSV template",
          exportData: "Export data",
          previewDoesNotWrite: "Preview does not create records. Commit imports valid rows only.",
          pasteCsvOrUpload: "Paste CSV here or choose a file to preview.",
          csvEditorPlaceholder: "name,code,city\nExample Tower,EX-001,Muscat",
          noImportBatches: "No import batches yet. Committed imports will appear here.",
          exportHelp: "Download CSV files for audits, migration checks, or offline review.",
          staff: "PMS staff",
          staffTitle: "Staff and permissions",
          staffDescription: "Invite staff, assign PMS roles, limit property scopes, and add focused permissions without granting global platform power.",
          inviteStaff: "Invite staff",
          staffEmail: "User email",
          propertyScope: "Property scope",
          allProperties: "All properties",
          selectedProperties: "Selected properties",
          customPermissions: "Extra permissions",
          permissionGroups: "Permission groups",
          noExtraPermissions: "No extra permissions selected.",
          activeStaff: "Active staff",
          staffDangerZone: "Sensitive action",
          staffScopeHelp: "Leave empty for all company properties, or select specific properties for this staff member.",
          portfolioHelp: "Group properties into portfolios for branch, team, or reporting workflows.",
          emptyPortfolios: "No portfolios yet. Create one to group properties or branches.",
          noPropertiesForScope: "Add properties before assigning a property scope.",
          suspendAccess: "Suspend access",
          restoreAccess: "Restore access",
          portfolios: "Portfolios",
          portfolioName: "Portfolio name",
          createPortfolio: "Create portfolio",
          accessControls: "Access controls",
          emptyReports: "Not enough PMS report data yet.",
        };

  const section = selectedLeaseId
    ? "leaseDetail"
    : selectedPropertyId
      ? "propertyDetail"
      : location.pathname.startsWith("/pms/units")
        ? "units"
        : location.pathname.startsWith("/pms/properties")
          ? "properties"
          : location.pathname.startsWith("/pms/tenants")
            ? "tenants"
            : location.pathname.startsWith("/pms/rentals")
              ? "rentals"
              : location.pathname.startsWith("/pms/documents")
                ? "documents"
                : location.pathname.startsWith("/pms/maintenance")
                ? "maintenance"
                : location.pathname.startsWith("/pms/accounting")
                  ? "accounting"
                  : location.pathname.startsWith("/pms/import-export")
                    ? "importExport"
                  : location.pathname.startsWith("/pms/staff")
                    ? "staff"
                  : location.pathname.startsWith("/pms/reports")
                    ? "reports"
                    : location.pathname.startsWith("/pms/settings")
                      ? "settings"
                      : "overview";

  const permissionKeys = overview?.workspace.member.permissionKeys;
  const canViewInventory = hasPmsPermission(permissionKeys, "INVENTORY_VIEW");
  const canViewTenancy = hasPmsPermission(permissionKeys, "TENANCY_VIEW");
  const canViewRent = hasPmsPermission(permissionKeys, "RENT_VIEW");
  const canViewMaintenance = hasPmsPermission(permissionKeys, "MAINTENANCE_VIEW");
  const canViewSettings = hasPmsPermission(permissionKeys, "SETTINGS_MANAGE");
  const canEdit = hasPmsPermission(permissionKeys, "INVENTORY_MANAGE");
  const canEditTenantRecords = hasPmsPermission(permissionKeys, "TENANCY_MANAGE");
  const canCollect = hasPmsPermission(permissionKeys, "RENT_MANAGE");
  const canSeeAccounting = hasPmsPermission(permissionKeys, "ACCOUNTING_VIEW");
  const canManageAccounting = hasPmsPermission(permissionKeys, "ACCOUNTING_MANAGE");
  const canExportSensitiveIdentity = hasPmsPermission(permissionKeys, "SENSITIVE_DATA_EXPORT");
  const canManageMaintenance = hasPmsPermission(permissionKeys, "MAINTENANCE_MANAGE");
  const canManageOperations = hasPmsPermission(permissionKeys, "SETTINGS_MANAGE");
  const hasWorkspaceWidePropertyAccess =
    overview?.workspace.member.propertyScope.allProperties ?? false;
  const canManageImportRecords =
    hasPmsPermission(permissionKeys, "IMPORT_EXPORT") &&
    hasWorkspaceWidePropertyAccess;
  const canManageStaffRecords =
    hasPmsPermission(permissionKeys, "STAFF_MANAGE") &&
    hasWorkspaceWidePropertyAccess;
  const canSeeDocuments = hasPmsPermission(permissionKeys, "DOCUMENTS_VIEW");
  const canManageDocumentRecords = hasPmsPermission(permissionKeys, "DOCUMENTS_MANAGE") ||
    (hasPmsPermission(permissionKeys, "MAINTENANCE_MANAGE") &&
      hasPmsPermission(permissionKeys, "DOCUMENTS_VIEW"));

  const sectionMeta = section === "importExport"
    ? { eyebrow: copy.importExport, title: copy.importExportTitle, description: copy.importExportDescription }
    : section === "staff"
      ? { eyebrow: copy.accessControls, title: copy.staffTitle, description: copy.staffDescription }
      : { eyebrow: copy.eyebrow, title: copy.portal, description: copy.portalText };

  const isOperationalSubpage = section === "importExport" || section === "staff";
  const requiredSectionPermission = getPmsSectionPermission(section);
  const sectionAccessDenied = Boolean(
    overview &&
      ((requiredSectionPermission &&
        !hasPmsPermission(
          overview.workspace.member.permissionKeys,
          requiredSectionPermission,
        )) ||
        ((section === "importExport" || section === "staff") &&
          !overview.workspace.member.propertyScope.allProperties)),
  );

  async function loadPortal() {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      const overviewResponse = await getPmsOverview(token, selectedCompanyId);
      setOverview(overviewResponse);
      const companyId = overviewResponse.workspace.company.id;
      const workspacePermissions = overviewResponse.workspace.member.permissionKeys;
      const requiredPermission = getPmsSectionPermission(section);

      if (
        (requiredPermission &&
          !overviewResponse.workspace.member.permissionKeys.includes(requiredPermission)) ||
        ((section === "importExport" || section === "staff") &&
          !overviewResponse.workspace.member.propertyScope.allProperties)
      ) {
        setCommandCenter(null);
        return;
      }

      if (section === "properties") {
        const propertyResponse = await listPmsProperties(token, {
          companyId,
          take: 100,
        });
        setProperties(propertyResponse.properties);
        setActiveProperty(null);
        setActiveLease(null);
        setUnits([]);
        setTenants([]);
        setLeases([]);
        setRentDueItems([]);
      } else if (section === "propertyDetail" && selectedPropertyId) {
        const [propertyResponse, unitsResponse] = await Promise.all([
          getPmsProperty(token, selectedPropertyId),
          listPmsPropertyUnits(token, selectedPropertyId, { take: 200 }),
        ]);
        setActiveProperty(propertyResponse.property);
        setPropertyForm(propertyToForm(propertyResponse.property));
        setUnits(unitsResponse.units);
        setActiveLease(null);
      } else if (section === "units") {
        const [unitsResponse, reconciliationResponse] = await Promise.all([
          listPmsUnits(token, {
            companyId,
            take: 200,
          }),
          workspacePermissions.includes("TENANCY_VIEW")
            ? getPmsOccupancyReconciliation(token, { companyId })
            : Promise.resolve(null),
        ]);
        setUnits(unitsResponse.units);
        setOccupancyReconciliation(reconciliationResponse);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "tenants") {
        const tenantsResponse = await listPmsTenants(token, {
          companyId,
          take: 100,
        });
        setTenants(tenantsResponse.tenants);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "rentals") {
        const [tenantsResponse, propertiesResponse, unitsResponse, leasesResponse] =
          await Promise.all([
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsLeases(token, { companyId, take: 100 }),
          ]);
        setTenants(tenantsResponse.tenants);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setLeases(leasesResponse.leases);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "leaseDetail" && selectedLeaseId) {
        const canViewRent =
          overviewResponse.workspace.member.permissionKeys.includes("RENT_VIEW");
        const canViewDocuments =
          overviewResponse.workspace.member.permissionKeys.includes("DOCUMENTS_VIEW");
        const [leaseResponse, leaseRentDueItems, leaseDocuments, leaseChecklists] =
          await Promise.all([
            getPmsLease(token, selectedLeaseId),
            canViewRent
              ? listPmsLeaseRentDueItems(token, selectedLeaseId, { take: 200 }).then(
                  (response) => response.rentDueItems,
                )
              : Promise.resolve([] as PmsRentDueItem[]),
            canViewDocuments
              ? listPmsDocuments(token, {
                  companyId,
                  leaseId: selectedLeaseId,
                  take: 50,
                }).then((response) => response.documents)
              : Promise.resolve([] as PmsDocument[]),
            canViewDocuments
              ? listPmsLeaseChecklists(token, selectedLeaseId).then(
                  (response) => response.checklistItems,
                )
              : Promise.resolve([] as PmsMoveChecklistItem[]),
          ]);
        setActiveLease(leaseResponse.lease);
        setRentDueItems(leaseRentDueItems);
        setActiveLeaseDocuments(leaseDocuments);
        setActiveLeaseChecklists(leaseChecklists);
        setActiveProperty(null);
      } else if (section === "documents") {
        const canViewMaintenance = workspacePermissions.includes("MAINTENANCE_VIEW");
        const [propertiesResponse, unitsResponse, tenantsResponse, leasesResponse, documentsResponse, alertsResponse] =
          await Promise.all([
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsLeases(token, { companyId, take: 100 }),
            listPmsDocuments(token, { companyId, take: 100 }),
            listPmsDocumentExpiryAlerts(token, { companyId, withinDays: 30 }),
          ]);
        const [workOrdersResponse, inspectionsResponse] = canViewMaintenance
          ? await Promise.all([
              listPmsWorkOrders(token, { companyId, take: 100 }),
              listPmsInspections(token, { companyId, take: 100 }),
            ])
          : [{ workOrders: [] as PmsWorkOrder[] }, { inspections: [] as PmsInspection[] }];
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setLeases(leasesResponse.leases);
        setWorkOrders(workOrdersResponse.workOrders);
        setInspections(inspectionsResponse.inspections);
        setDocuments(documentsResponse.documents);
        setDocumentAlerts(alertsResponse.documents);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "maintenance") {
        const [propertiesResponse, unitsResponse, tenantsResponse, vendorsResponse, workOrdersResponse] =
          await Promise.all([
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsVendors(token, { companyId, take: 100 }),
            listPmsWorkOrders(token, { companyId, take: 100 }),
          ]);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setVendors(vendorsResponse.vendors);
        setWorkOrders(workOrdersResponse.workOrders);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "accounting") {
        const canViewRent = workspacePermissions.includes("RENT_VIEW");
        const canViewReports = workspacePermissions.includes("REPORTS_VIEW");
        const canViewMaintenance = workspacePermissions.includes("MAINTENANCE_VIEW");
        const [ledgerResponse, statementResponse, statementsResponse, propertiesResponse, unitsResponse, tenantsResponse, leasesResponse] = await Promise.all([
          listPmsAccountingLedger(token, { companyId, take: 100 }),
          getPmsOwnerStatement(token, { companyId }),
          listPmsOwnerStatements(token, { companyId, take: 50 }),
          listPmsProperties(token, { companyId, take: 100 }),
          listPmsUnits(token, { companyId, take: 200 }),
          listPmsTenants(token, { companyId, take: 100 }),
          listPmsLeases(token, { companyId, take: 100 }),
        ]);
        const [rentDueResponse, summaryResponse, workOrdersResponse] = await Promise.all([
          canViewRent
            ? listPmsRentDueItems(token, { companyId, take: 200 })
            : Promise.resolve({ rentDueItems: [] as PmsRentDueItem[] }),
          canViewReports
            ? getPmsReportsSummary(token, companyId)
            : Promise.resolve(null),
          canViewMaintenance
            ? listPmsWorkOrders(token, { companyId, take: 100 })
            : Promise.resolve({ workOrders: [] as PmsWorkOrder[] }),
        ]);
        setRentDueItems(rentDueResponse.rentDueItems);
        setReportsSummary(summaryResponse);
        setLedgerEntries(ledgerResponse.ledgerEntries);
        setOwnerStatement(statementResponse.statement);
        setOwnerStatements(statementsResponse.statements);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setLeases(leasesResponse.leases);
        setWorkOrders(workOrdersResponse.workOrders);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "importExport") {
        const batchesResponse = await listPmsImportBatches(token, { companyId, take: 25 });
        setImportBatches(batchesResponse.batches);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "staff") {
        const staffResponse = await listPmsStaff(token, companyId);
        setStaffMembers(staffResponse.members);
        setStaffProperties(staffResponse.properties);
        setStaffPortfolios(staffResponse.portfolios);
        setProperties(staffResponse.properties as PmsProperty[]);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "reports") {
        const summaryResponse = await getPmsReportsSummary(token, companyId);
        setReportsSummary(summaryResponse);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "settings") {
        const canViewMaintenance = workspacePermissions.includes("MAINTENANCE_VIEW");
        const [propertiesResponse, unitsResponse, tenantsResponse, leasesResponse, templatesResponse, communicationLogsResponse, remindersResponse, policiesResponse] =
          await Promise.all([
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsLeases(token, { companyId, take: 100 }),
            listPmsCommunicationTemplates(token, { companyId, take: 100 }),
            listPmsCommunicationLogs(token, { companyId, take: 25 }),
            listPmsReminderCandidates(token, { companyId, type: "RENT_DUE_SOON", days: 14, take: 25 }),
            listPmsPolicies(token, { companyId, take: 100 }),
          ]);
        const inspectionsResponse = canViewMaintenance
          ? await listPmsInspections(token, { companyId, take: 100 })
          : { inspections: [] as PmsInspection[] };
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setLeases(leasesResponse.leases);
        setTemplates(templatesResponse.templates);
        setCommunicationLogs(communicationLogsResponse.logs);
        setReminderCandidates(remindersResponse.candidates);
        setPolicies(policiesResponse.policies);
        setInspections(inspectionsResponse.inspections);
        setActiveProperty(null);
        setActiveLease(null);
      } else {
        setProperties([]);
        setUnits([]);
        setTenants([]);
        setLeases([]);
        setRentDueItems([]);
        setWorkOrders([]);
        setVendors([]);
        setReportsSummary(null);
        setTemplates([]);
        setCommunicationLogs([]);
        setReminderCandidates([]);
        setImportBatches([]);
        setImportPreview(null);
        setCommunicationPreview(null);
        setPolicies([]);
        setInspections([]);
        setDocuments([]);
        setDocumentAlerts([]);
        setActiveLeaseDocuments([]);
        setActiveLeaseChecklists([]);
        setActiveProperty(null);
        setActiveLease(null);
      }
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof ApiError ? loadError.message : copy.unavailable,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.unavailable, selectedCompanyId, selectedLeaseId, selectedPropertyId, section, token]);

  useEffect(() => {
    if (!token || !overview || section !== "overview") {
      setCommandCenter(null);
      setCommandError("");
      return;
    }

    const activeToken = token;
    const companyId = overview.workspace.company.id;
    let active = true;
    async function loadOperationalCommandCenter() {
      try {
        setCommandLoading(true);
        setCommandError("");
        const response = await getPmsCommandCenter(activeToken, {
          companyId,
          propertyId: commandPropertyFilter === "ALL" ? undefined : commandPropertyFilter,
          dateFrom: commandDateFrom || undefined,
          dateTo: commandDateTo || undefined,
          riskWindowDays: commandRiskWindowDays,
          status: commandStatusFilter,
          priority: commandPriorityFilter,
          take: 30,
        });
        if (active) setCommandCenter(response);
      } catch (loadError) {
        console.error(loadError);
        if (active) {
          setCommandCenter(null);
          setCommandError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
        }
      } finally {
        if (active) setCommandLoading(false);
      }
    }

    void loadOperationalCommandCenter();
    return () => {
      active = false;
    };
  }, [
    commandDateFrom,
    commandDateTo,
    commandPriorityFilter,
    commandPropertyFilter,
    commandRiskWindowDays,
    commandStatusFilter,
    copy.unavailable,
    overview,
    section,
    token,
  ]);

  useEffect(() => {
    setCommandPropertyFilter("ALL");
  }, [overview?.workspace.company.id]);

  const overviewMetrics = useMemo(() => {
    if (!overview) return [];

    const items: Array<{ key: string; label: string; value: string }> = [];

    if (canViewInventory) {
      items.push(
        { key: "totalPmsProperties", label: copy.totalPmsProperties, value: formatNumber(overview.metrics.totalPmsProperties, language) },
        { key: "totalPmsUnits", label: copy.totalPmsUnits, value: formatNumber(overview.metrics.totalPmsUnits, language) },
        { key: "vacantPmsUnits", label: copy.vacantPmsUnits, value: formatNumber(overview.metrics.vacantPmsUnits, language) },
        { key: "occupiedPmsUnits", label: copy.occupiedPmsUnits, value: formatNumber(overview.metrics.occupiedPmsUnits, language) },
        { key: "maintenancePmsUnits", label: copy.maintenancePmsUnits, value: formatNumber(overview.metrics.maintenancePmsUnits, language) },
        { key: "pmsOccupancyRate", label: copy.occupancyRate, value: formatPercent(overview.metrics.pmsOccupancyRate, language) },
      );
    }

    if (canViewTenancy) {
      items.push(
        { key: "totalPmsTenants", label: copy.tenants, value: formatNumber(overview.metrics.totalPmsTenants, language) },
        { key: "activePmsLeases", label: copy.activeLeases, value: formatNumber(overview.metrics.activePmsLeases, language) },
        { key: "expiringPmsLeases", label: copy.expiringLeases, value: formatNumber(overview.metrics.expiringPmsLeases, language) },
      );
    }

    if (canViewRent) {
      items.push(
        { key: "unpaidPmsRentDueItems", label: copy.unpaidRent, value: formatNumber(overview.metrics.unpaidPmsRentDueItems, language) },
        { key: "overduePmsRentDueItems", label: copy.overdueRent, value: formatNumber(overview.metrics.overduePmsRentDueItems, language) },
        { key: "paidPmsRentDueItems", label: copy.paidRent, value: formatNumber(overview.metrics.paidPmsRentDueItems, language) },
      );
    }

    if (canViewMaintenance) {
      items.push(
        { key: "openPmsWorkOrders", label: copy.maintenanceRequests, value: formatNumber(overview.metrics.openPmsWorkOrders, language) },
        { key: "urgentPmsWorkOrders", label: copy.priority, value: formatNumber(overview.metrics.urgentPmsWorkOrders, language) },
        { key: "scheduledPmsInspections", label: copy.inspections, value: formatNumber(overview.metrics.scheduledPmsInspections, language) },
      );
    }

    items.push(
      { key: "totalListings", label: copy.totalListings, value: formatNumber(overview.metrics.totalListings, language) },
      { key: "approvedListings", label: copy.approvedListings, value: formatNumber(overview.metrics.approvedListings, language) },
      { key: "totalProjects", label: copy.totalProjects, value: formatNumber(overview.metrics.totalProjects, language) },
    );

    return items;
  }, [
    canViewInventory,
    canViewMaintenance,
    canViewRent,
    canViewTenancy,
    copy,
    language,
    overview,
  ]);

  const commandCenterPropertyOptions = useMemo(
    () => commandCenter?.properties.map((property) => ({ id: property.id, name: property.name })) ?? [],
    [commandCenter],
  );

  const filteredPriorityQueue = commandCenter?.priorityQueue ?? [];

  const commandHealthSignals = useMemo(() => {
    if (!commandCenter) return [];
    return [
      commandCenter.health.portfolio,
      commandCenter.health.occupancy,
      commandCenter.health.collection,
      commandCenter.health.arrears,
      commandCenter.health.maintenance,
      commandCenter.health.compliance,
      commandCenter.health.tenantExperience,
    ];
  }, [commandCenter]);

  const launchChecklistItems = useMemo(() => {
    if (!overview) return [];

    const items = [
      {
        key: "access",
        label: copy.checklistPmsAccess,
        complete: Boolean(overview.workspace.entitlement.status && overview.workspace.member.role),
      },
    ];

    if (canViewInventory) {
      items.push({
        key: "inventory",
        label: copy.checklistInventory,
        complete:
          (overview.metrics.totalPmsProperties ?? 0) > 0 &&
          (overview.metrics.totalPmsUnits ?? 0) > 0,
      });
    }

    if (canViewTenancy) {
      items.push({
        key: "tenancy",
        label: copy.checklistTenancy,
        complete:
          (overview.metrics.totalPmsTenants ?? 0) > 0 &&
          (overview.metrics.activePmsLeases ?? 0) > 0,
      });
    }

    if (canViewRent) {
      items.push({
        key: "finance",
        label: copy.checklistFinance,
        complete:
          Number(overview.metrics.pmsRentCollectedAmount) > 0 ||
          (overview.metrics.paidPmsRentDueItems ?? 0) > 0,
      });
    }

    if (canViewMaintenance || canViewSettings) {
      items.push({
        key: "operations",
        label: copy.checklistOperations,
        complete:
          (overview.metrics.openPmsWorkOrders ?? 0) > 0 ||
          (overview.metrics.activePmsCommunicationTemplates ?? 0) > 0 ||
          (overview.metrics.activePmsPolicies ?? 0) > 0,
      });
    }

    items.push({
      key: "permissions",
      label: copy.checklistPermissions,
      complete: true,
    });

    return items;
  }, [
    canViewInventory,
    canViewMaintenance,
    canViewRent,
    canViewSettings,
    canViewTenancy,
    copy,
    overview,
  ]);

  const statusLabel =
    overview?.workspace.entitlement.status === "ACTIVE"
      ? copy.active
      : overview?.workspace.entitlement.status === "TRIAL"
        ? copy.trial
        : overview?.workspace.entitlement.status === "SUSPENDED"
          ? copy.suspended
          : copy.expired;

  function handleMapInput(value: string) {
    const parsed = parseCoordinatesFromMapInput(value);
    setPropertyForm((current) => ({
      ...current,
      mapGoogleUrl: value,
      ...(parsed
        ? {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          }
        : {}),
    }));
  }

  async function handleRunPmsAutomation(type: PmsReminderType) {
    if (!token || !overview) return;

    try {
      setAutomationRunning(type);
      setError("");
      setSuccess("");
      const result = await runPmsAutomation(token, {
        companyId: overview.workspace.company.id,
        propertyId: commandPropertyFilter === "ALL" ? undefined : commandPropertyFilter,
        type,
        days: commandRiskWindowDays,
        take: 25,
        dryRun: false,
      });
      setSuccess(
        language === "ar"
          ? `تم إنشاء ${result.createdCount} تنبيه داخلي وتخطي ${result.skippedCount} مكرر.`
          : `${result.createdCount} internal alerts generated; ${result.skippedCount} duplicates skipped.`,
      );
      const refreshed = await getPmsCommandCenter(token, {
        companyId: overview.workspace.company.id,
        propertyId: commandPropertyFilter === "ALL" ? undefined : commandPropertyFilter,
        dateFrom: commandDateFrom || undefined,
        dateTo: commandDateTo || undefined,
        riskWindowDays: commandRiskWindowDays,
        status: commandStatusFilter,
        priority: commandPriorityFilter,
        take: 30,
      });
      setCommandCenter(refreshed);
    } catch (automationError) {
      console.error(automationError);
      setError(automationError instanceof ApiError ? automationError.message : copy.unavailable);
    } finally {
      setAutomationRunning(null);
    }
  }

  async function handleImportFileChange(file?: File | null) {
    if (!file) return;
    setImportFilename(file.name);
    setImportCsvText(await file.text());
    setImportPreview(null);
  }

  async function handlePreviewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview || !canManageImportRecords) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await previewPmsImport(token, {
        companyId: overview.workspace.company.id,
        type: importType,
        filename: importFilename || null,
        csvText: importCsvText,
      });
      setImportPreview(response.preview);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCommitImport() {
    if (!token || !overview || !canManageImportRecords || !importCsvText) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await commitPmsImport(token, {
        companyId: overview.workspace.company.id,
        type: importType,
        filename: importFilename || null,
        csvText: importCsvText,
      });
      setImportPreview(response.preview);
      setSuccess(copy.saved);
      const batchesResponse = await listPmsImportBatches(token, {
        companyId: overview.workspace.company.id,
        take: 25,
      });
      setImportBatches(batchesResponse.batches);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadImportTemplate() {
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      const csvText = await getPmsImportTemplateCsv(token, importType, overview.workspace.company.id);
      downloadCsvFile(pmsTemplateFilename(importType), csvText);
    } catch (downloadError) {
      console.error(downloadError);
      setError(downloadError instanceof ApiError ? downloadError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportCsv(type: PmsExportType, includeSensitive = false) {
    if (!token || !overview) return;

    if (includeSensitive) {
      const confirmed = window.confirm(
        language === "ar"
          ? "سيشمل هذا التصدير أرقام الهوية والجوازات الحساسة وسيتم تسجيل العملية في سجل التدقيق. هل تريد المتابعة؟"
          : "This export will include sensitive national ID and passport fields and will be recorded in the audit trail. Continue?",
      );
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      setError("");
      const csvText = await getPmsExportCsv(token, type, {
        companyId: overview.workspace.company.id,
        includeSensitive,
        sensitiveExportConfirmation: includeSensitive ? "EXPORT_SENSITIVE_TENANT_DATA" : undefined,
      });
      downloadCsvFile(includeSensitive ? "pms-tenants-sensitive.csv" : pmsExportFilename(type), csvText);
    } catch (downloadError) {
      console.error(downloadError);
      setError(downloadError instanceof ApiError ? downloadError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  function toggleStaffProperty(propertyId: string) {
    setStaffPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  }

  function toggleStaffPermission(permissionKey: PmsPermissionKey) {
    setStaffPermissionKeys((current) =>
      current.includes(permissionKey)
        ? current.filter((key) => key !== permissionKey)
        : [...current, permissionKey],
    );
  }

  function togglePortfolioProperty(propertyId: string) {
    setPortfolioPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  }

  async function refreshStaff(companyId: string) {
    if (!token) return;
    const response = await listPmsStaff(token, companyId);
    setStaffMembers(response.members);
    setStaffProperties(response.properties);
    setStaffPortfolios(response.portfolios);
  }

  async function handleInviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview || !canManageStaffRecords) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await upsertPmsStaffMember(token, {
        companyId: overview.workspace.company.id,
        email: staffEmail,
        role: staffRole,
        active: true,
        propertyIds: staffPropertyIds,
        permissionKeys: staffPermissionKeys,
      });
      setStaffEmail("");
      setStaffRole("PMS_VIEWER");
      setStaffPropertyIds([]);
      setStaffPermissionKeys([]);
      await refreshStaff(overview.workspace.company.id);
      setSuccess(copy.saved);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStaffAccess(member: PmsStaffMember) {
    if (!token || !overview || !canManageStaffRecords) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsStaffMember(token, member.id, { active: !member.active });
      await refreshStaff(overview.workspace.company.id);
      setSuccess(copy.saved);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview || !canManageStaffRecords) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsPortfolio(token, {
        companyId: overview.workspace.company.id,
        name: portfolioName,
        propertyIds: portfolioPropertyIds,
      });
      setPortfolioName("");
      setPortfolioPropertyIds([]);
      await refreshStaff(overview.workspace.company.id);
      setSuccess(copy.saved);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await createPmsProperty(
        token,
        cleanPropertyPayload(propertyForm, overview.workspace.company.id),
      );
      setPropertyForm(emptyPropertyForm);
      setSuccess(copy.saved);
      navigate(
        `/pms/properties/${response.property.id}?companyId=${overview.workspace.company.id}`,
      );
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeProperty) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await updatePmsProperty(
        token,
        activeProperty.id,
        cleanPropertyUpdatePayload(propertyForm),
      );
      setActiveProperty(response.property);
      setPropertyForm(propertyToForm(response.property));
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeProperty) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsUnit(token, activeProperty.id, cleanUnitPayload(unitForm));
      setUnitForm(emptyUnitForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUnit(unit: PmsUnit) {
    if (!token) return;
    const draft = unitDrafts[unit.id];
    if (!draft) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsUnit(token, unit.id, cleanUnitUpdatePayload(draft));
      setSuccess(copy.saved);
      setUnitDrafts((current) => {
        const next = { ...current };
        delete next[unit.id];
        return next;
      });
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }


  function setPortalAccessEmail(tenantId: string, value: string) {
    setPortalAccessEmails((current) => ({ ...current, [tenantId]: value }));
  }

  function setPortalAccessLoading(key: string, value: boolean) {
    setPortalAccessBusy((current) => ({ ...current, [key]: value }));
  }

  async function handleGrantTenantPortalAccess(
    event: FormEvent<HTMLFormElement>,
    tenant: PmsTenant,
  ) {
    event.preventDefault();
    if (!token || !canEditTenantRecords) return;

    const email = (portalAccessEmails[tenant.id] ?? tenant.email ?? "").trim();
    if (!email) {
      setError(copy.tenantUserRequired);
      return;
    }

    try {
      setSaving(true);
      setPortalAccessLoading(tenant.id, true);
      setError("");
      setSuccess("");
      await upsertPmsTenantPortalAccess(
        tenant.id,
        { email, active: true },
        token,
      );
      setPortalAccessEmails((current) => ({ ...current, [tenant.id]: "" }));
      setSuccess(copy.portalAccessSaved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setPortalAccessLoading(tenant.id, false);
      setSaving(false);
    }
  }

  async function handleDisableTenantPortalAccess(
    tenant: PmsTenant,
    access: PmsTenantPortalAccess,
  ) {
    if (!token || !canEditTenantRecords) return;
    if (!window.confirm(copy.confirmDisablePortalAccess)) return;

    const busyKey = `${tenant.id}:${access.userId}`;
    try {
      setSaving(true);
      setPortalAccessLoading(busyKey, true);
      setError("");
      setSuccess("");
      await upsertPmsTenantPortalAccess(
        tenant.id,
        { userId: access.userId, active: false },
        token,
      );
      setSuccess(copy.portalAccessSaved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setPortalAccessLoading(busyKey, false);
      setSaving(false);
    }
  }

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsTenant(
        token,
        cleanTenantPayload(tenantForm, overview.workspace.company.id),
      );
      setTenantForm(emptyTenantForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await createPmsLease(
        token,
        cleanLeasePayload(leaseForm, overview.workspace.company.id),
      );
      setLeaseForm(emptyLeaseForm);
      setSuccess(copy.saved);
      navigate(
        `/pms/rentals/${response.lease.id}?companyId=${overview.workspace.company.id}`,
      );
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordRentPayment(item: PmsRentDueItem) {
    if (!token) return;

    const suggestedAmount = item.balanceAmount || String(Math.max(Number(item.amount) - Number(item.paidAmount || 0), 0));
    const amountInput = window.prompt(copy.confirmMarkPaid, suggestedAmount);
    if (!amountInput) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(copy.unavailable);
      return;
    }

    const methodInput = window.prompt(
      `${copy.paymentMethod}: CASH, BANK_TRANSFER, CHEQUE, CARD_MANUAL, OTHER`,
      "BANK_TRANSFER",
    );
    if (!methodInput) return;
    const normalizedMethod = methodInput.trim().toUpperCase();
    const allowedMethods = [
      "CASH",
      "BANK_TRANSFER",
      "CHEQUE",
      "CARD_MANUAL",
      "OTHER",
    ] as const;

    if (!allowedMethods.includes(normalizedMethod as (typeof allowedMethods)[number])) {
      setError(copy.unavailable);
      return;
    }

    const method = normalizedMethod as (typeof allowedMethods)[number];
    const referenceNumber = window.prompt(copy.paymentReference, "") || undefined;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await recordPmsRentPayment(token, item.id, {
        amount,
        method,
        referenceNumber,
        paidAt: new Date().toISOString(),
      });
      setRentReceipt(response.receipt);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleCreateLedgerEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsAccountingLedgerEntry(token, {
        ...ledgerForm,
        companyId: overview.workspace.company.id,
        propertyId: ledgerForm.propertyId || null,
        unitId: ledgerForm.unitId || null,
        tenantId: ledgerForm.tenantId || null,
        leaseId: ledgerForm.leaseId || null,
        rentDueItemId: ledgerForm.rentDueItemId || null,
        workOrderId: ledgerForm.workOrderId || null,
        referenceNumber: ledgerForm.referenceNumber || null,
        notes: ledgerForm.notes || null,
      });
      setLedgerForm({ ...emptyLedgerForm, transactionDate: new Date().toISOString().slice(0, 10) });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsWorkOrder(
        token,
        cleanWorkOrderPayload(workOrderForm, overview.workspace.company.id),
      );
      setWorkOrderForm(emptyWorkOrderForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveWorkOrder(workOrder: PmsWorkOrder) {
    if (!token) return;
    if (!window.confirm(copy.confirmResolve)) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsWorkOrder(token, workOrder.id, { status: "RESOLVED" });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsVendor(token, cleanVendorPayload(vendorForm, overview.workspace.company.id));
      setVendorForm(emptyVendorForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMaintenanceQuote(workOrder: PmsWorkOrder) {
    if (!token) return;
    const amountInput = window.prompt(`${copy.quote} ${copy.amount}`, workOrder.cost ?? "");
    if (!amountInput) return;
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(copy.unavailable);
      return;
    }
    const vendorId = workOrder.vendorId || window.prompt(copy.vendor, "") || undefined;
    const description = window.prompt(copy.quote, "") || undefined;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsMaintenanceQuote(token, workOrder.id, {
        amount,
        vendorId: vendorId || null,
        currency: workOrder.currency,
        description,
        status: "SUBMITTED",
      });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveMaintenanceQuote(quote: PmsMaintenanceQuote) {
    if (!token) return;
    if (!window.confirm(copy.approveQuote)) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsMaintenanceQuote(token, quote.id, { status: "APPROVED" });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsCommunicationTemplate(
        token,
        cleanTemplatePayload(templateForm, overview.workspace.company.id),
      );
      setTemplateForm(emptyTemplateForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }


  async function handlePreviewTemplate(template: PmsCommunicationTemplate) {
    if (!token || !overview) return;
    try {
      setSaving(true);
      setError("");
      const preview = await previewPmsCommunication(token, {
        companyId: overview.workspace.company.id,
        templateId: template.id,
      });
      setCommunicationPreview({ subject: preview.subject, body: preview.body });
    } catch (previewError) {
      console.error(previewError);
      setError(previewError instanceof ApiError ? previewError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTemplate(template: PmsCommunicationTemplate) {
    if (!token || !overview) return;
    const tenantId = window.prompt(`${copy.tenants} ID`, tenants[0]?.id ?? "") || undefined;
    if (!tenantId) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await sendPmsCommunication(token, {
        companyId: overview.workspace.company.id,
        templateId: template.id,
        tenantId,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        status: "LOGGED",
      });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (sendError) {
      console.error(sendError);
      setError(sendError instanceof ApiError ? sendError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsPolicy(
        token,
        cleanPolicyPayload(policyForm, overview.workspace.company.id),
      );
      setPolicyForm(emptyPolicyForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsInspection(
        token,
        cleanInspectionPayload(inspectionForm, overview.workspace.company.id),
      );
      setInspectionForm(emptyInspectionForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview || !canManageDocumentRecords || !documentFile) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await uploadPmsDocument(
        token,
        cleanPrivateDocumentPayload(documentForm, overview.workspace.company.id),
        documentFile,
      );
      setDocumentForm(emptyDocumentForm);
      setDocumentFile(null);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadDocument(document: PmsDocument) {
    if (!token) return;
    try {
      setDocumentDownloadingId(document.id);
      setError("");
      const response = await downloadPmsDocument(token, document.id);
      downloadBlobFile(response.filename || document.originalFilename || `${document.title}.bin`, response.blob);
    } catch (downloadError) {
      console.error(downloadError);
      setError(downloadError instanceof ApiError ? downloadError.message : copy.unavailable);
    } finally {
      setDocumentDownloadingId(null);
    }
  }

  async function handleCreateOwnerStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview || !canManageAccounting || !ownerStatementPropertyId) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsOwnerStatement(token, {
        companyId: overview.workspace.company.id,
        propertyId: ownerStatementPropertyId,
        month: ownerStatementMonth,
        currency: ownerStatementCurrency.trim().toUpperCase(),
      });
      const response = await listPmsOwnerStatements(token, {
        companyId: overview.workspace.company.id,
        take: 50,
      });
      setOwnerStatements(response.statements);
      setSuccess(copy.saved);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleOwnerStatementTransition(
    statement: PmsPersistedOwnerStatement,
    status: PmsOwnerStatementStatus,
  ) {
    if (!token || !overview || !canManageAccounting) return;
    const destructive = status === "VOID";
    if (destructive && !window.confirm(language === "ar" ? "إلغاء هذا الكشف؟ لا يمكن تعديل النسخة المنشورة." : "Void this statement? Published snapshots remain immutable.")) return;
    try {
      setSaving(true);
      setError("");
      const response = await transitionPmsOwnerStatement(token, statement.id, status);
      setOwnerStatements((current) => current.map((item) => item.id === statement.id ? response.statement : item));
      setSuccess(copy.saved);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleOccupancyReconciliation(apply: boolean) {
    if (!token || !overview) return;
    if (apply && !window.confirm(language === "ar" ? "تحديث حالة إشغال الوحدات من العقود النشطة؟" : "Reconcile unit occupancy from active lease state?")) return;
    try {
      setSaving(true);
      setError("");
      const response = apply
        ? await applyPmsOccupancyReconciliation(token, { companyId: overview.workspace.company.id, apply: true })
        : await getPmsOccupancyReconciliation(token, { companyId: overview.workspace.company.id });
      setOccupancyReconciliation(response);
      if (apply) {
        const unitsResponse = await listPmsUnits(token, { companyId: overview.workspace.company.id, take: 200 });
        setUnits(unitsResponse.units);
      }
    } catch (reconciliationError) {
      console.error(reconciliationError);
      setError(reconciliationError instanceof ApiError ? reconciliationError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLeaseRenewalDraft() {
    if (!token || !activeLease || !overview || !canEditTenantRecords) return;

    const renewalDefaultDate = (
      activeLease.endDate ??
      activeLease.startDate ??
      new Date().toISOString()
    ).slice(0, 10);
    const nextStartDate = window.prompt(copy.startDate, renewalDefaultDate);
    if (!nextStartDate) return;
    const nextEndDate = window.prompt(copy.endDate, renewalDefaultDate);
    if (!nextEndDate) return;
    const rentAmount = window.prompt(copy.rent, String(activeLease.rentAmount));

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await createPmsLeaseRenewalDraft(token, activeLease.id, {
        startDate: nextStartDate,
        endDate: nextEndDate,
        rentAmount: rentAmount ? Number(rentAmount) : activeLease.rentAmount,
        securityDeposit: activeLease.securityDeposit,
        title: `${activeLease.title} renewal`,
      });
      setSuccess(copy.saved);
      navigate(`/pms/rentals/${response.lease.id}?companyId=${overview.workspace.company.id}`);
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChecklistItem(type: PmsMoveChecklistPayload["type"]) {
    if (!token || !activeLease || !canEditTenantRecords) return;

    const title = window.prompt(copy.addChecklistItem, type === "MOVE_IN" ? "Move-in check" : "Move-out check");
    if (!title) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsLeaseChecklistItem(token, activeLease.id, { type, title });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteChecklistItem(item: PmsMoveChecklistItem) {
    if (!token || !canEditTenantRecords) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsLeaseChecklistItem(token, item.id, { status: "COMPLETED" });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pms-portal" aria-labelledby="pms-title">
      <aside className="pms-sidebar" aria-label={copy.portal}>
        <NavLink className="pms-sidebar__brand" to="/pms/overview">
          <span>lux</span>
          <strong>PMS</strong>
        </NavLink>

        <nav className="pms-sidebar__nav">
          {pmsNavigationGroups.map((group) => {
            const items = pmsNavigation.filter(
              (item) =>
                item.group === group &&
                (!item.permission ||
                  overview?.workspace.member.permissionKeys.includes(item.permission)) &&
                ((item.key !== "importExport" && item.key !== "staff") ||
                  overview?.workspace.member.propertyScope.allProperties),
            );

            if (items.length === 0) return null;

            const groupLabel = {
              workspace: language === "ar" ? "مساحة العمل" : "Workspace",
              leasing: language === "ar" ? "الإيجارات" : "Leasing",
              operations: language === "ar" ? "العمليات" : "Operations",
              control: language === "ar" ? "المالية والتحكم" : "Finance & control",
            }[group];

            return (
              <div key={group} className="pms-sidebar__group">
                <span className="pms-sidebar__group-label">{groupLabel}</span>
                {items.map((item) => {
                  const Icon = item.icon;
                  const label = copy[item.key];

                  return (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      className={({ isActive }) =>
                        cn("pms-sidebar__link", isActive && "pms-sidebar__link--active")
                      }
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className={cn("pms-main", isOperationalSubpage && "pms-main--compact")}>
        <header className="pms-header">
          <div>
            <p className="eyebrow">{sectionMeta.eyebrow}</p>
            <h1 id="pms-title">{sectionMeta.title}</h1>
            <p>{sectionMeta.description}</p>
          </div>

          {overview ? (
            <div className="pms-company-card">
              <span>{copy.company}</span>
              <strong>
                {getCompanyName(overview.workspace.company, language)}
              </strong>
              <small>
                {copy.role}:{" "}
                {getRoleLabel(overview.workspace.member.role, language)}
              </small>
              <small>
                {overview.workspace.member.propertyScope.allProperties
                  ? language === "ar"
                    ? "كل العقارات"
                    : "All properties"
                  : language === "ar"
                    ? `${overview.workspace.member.propertyScope.propertyIds.length} عقارات محددة`
                    : `${overview.workspace.member.propertyScope.propertyIds.length} assigned properties`}
              </small>
              <em>{statusLabel}</em>
            </div>
          ) : null}
        </header>

        {overview && overview.companies.length > 1 ? (
          <label className="pms-company-switcher">
            {copy.switchCompany}
            <select
              value={overview.workspace.company.id}
              onChange={(event) => {
                setSearchParams({ companyId: event.target.value });
              }}
            >
              {overview.companies.map((workspace) => (
                <option key={workspace.company.id} value={workspace.company.id}>
                  {getCompanyName(workspace.company, language)} ·{" "}
                  {getRoleLabel(workspace.role, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? (
          <div className="pms-loading" role="status">
            <Loader2 size={22} aria-hidden="true" />
            {copy.loading}
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? <p className="form-success">{success}</p> : null}

        {overview && sectionAccessDenied ? (
          <section className="pms-empty-card" role="alert">
            <ShieldCheck size={24} aria-hidden="true" />
            <div>
              <h2>{language === "ar" ? "هذه الوحدة غير متاحة لصلاحيتك" : "This module is outside your access"}</h2>
              <p>
                {language === "ar"
                  ? "ارجع إلى النظرة العامة أو اطلب من مسؤول PMS إضافة الصلاحية المطلوبة."
                  : "Return to the overview or ask a PMS owner to grant the required permission."}
              </p>
              <Link className="button-link" to={`/pms/overview?companyId=${overview.workspace.company.id}`}>
                {language === "ar" ? "العودة للنظرة العامة" : "Back to overview"}
              </Link>
            </div>
          </section>
        ) : overview ? (
          <div className="pms-content-grid">
            {section === "overview" ? (
              <>
                <section className="pms-hero-card">
                  <div>
                    <p className="eyebrow">{copy.overview}</p>
                    <h2>{copy.headline}</h2>
                    <p>{copy.headlineText}</p>
                  </div>

                  <div
                    className="pms-readiness-list"
                    aria-label={copy.readiness}
                  >
                    <div>
                      <ShieldCheck size={18} aria-hidden="true" />
                      <span>{copy.entitlementReady}</span>
                    </div>
                    <div>
                      <UserRoundCheck size={18} aria-hidden="true" />
                      <span>{copy.accessScoped}</span>
                    </div>
                    <div>
                      <Building2 size={18} aria-hidden="true" />
                      <span>{copy.privateInventory}</span>
                    </div>
                  </div>
                </section>

                <section className="pms-metric-grid" aria-label={copy.overview}>
                  {overviewMetrics.map((metric) => (
                    <article key={metric.key} className="pms-metric-card">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </section>

                <section className="pms-command-center">
                  <div className="pms-command-center__header">
                    <div>
                      <p className="eyebrow">{language === "ar" ? "الذكاء التشغيلي" : "Operational intelligence"}</p>
                      <h2>{language === "ar" ? "ما يحتاج إلى انتباه الآن" : "What needs attention now"}</h2>
                      <p>
                        {language === "ar"
                          ? "مؤشرات حقيقية ومخاطر مرتبة حسب الأولوية ضمن نطاق صلاحياتك."
                          : "Live operational signals and prioritized risks within your workspace scope."}
                      </p>
                    </div>
                    <div className="pms-command-center__filters">
                      <label>
                        <span>{language === "ar" ? "العقار" : "Property"}</span>
                        <select value={commandPropertyFilter} onChange={(event) => setCommandPropertyFilter(event.target.value)}>
                          <option value="ALL">{language === "ar" ? "كل العقارات" : "All properties"}</option>
                          {commandCenterPropertyOptions.map((property) => (
                            <option key={property.id} value={property.id}>{property.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{language === "ar" ? "من" : "From"}</span>
                        <input type="date" value={commandDateFrom} onChange={(event) => setCommandDateFrom(event.target.value)} />
                      </label>
                      <label>
                        <span>{language === "ar" ? "إلى" : "To"}</span>
                        <input type="date" value={commandDateTo} onChange={(event) => setCommandDateTo(event.target.value)} />
                      </label>
                      <label>
                        <span>{language === "ar" ? "نافذة المخاطر" : "Risk window"}</span>
                        <select value={commandRiskWindowDays} onChange={(event) => setCommandRiskWindowDays(Number(event.target.value))}>
                          <option value={30}>30 {language === "ar" ? "يوماً" : "days"}</option>
                          <option value={60}>60 {language === "ar" ? "يوماً" : "days"}</option>
                          <option value={90}>90 {language === "ar" ? "يوماً" : "days"}</option>
                          <option value={120}>120 {language === "ar" ? "يوماً" : "days"}</option>
                        </select>
                      </label>
                      <label>
                        <span>{language === "ar" ? "الحالة" : "Status"}</span>
                        <select value={commandStatusFilter} onChange={(event) => setCommandStatusFilter(event.target.value as typeof commandStatusFilter)}>
                          <option value="ALL">{language === "ar" ? "كل الحالات" : "All statuses"}</option>
                          <option value="OVERDUE">{language === "ar" ? "متأخر" : "Overdue"}</option>
                          <option value="UPCOMING">{language === "ar" ? "قادم" : "Upcoming"}</option>
                          <option value="NEEDS_REVIEW">{language === "ar" ? "يحتاج مراجعة" : "Needs review"}</option>
                          <option value="OPEN">{language === "ar" ? "مفتوح" : "Open"}</option>
                        </select>
                      </label>
                      <label>
                        <span>{language === "ar" ? "الأولوية" : "Priority"}</span>
                        <select value={commandPriorityFilter} onChange={(event) => setCommandPriorityFilter(event.target.value as typeof commandPriorityFilter)}>
                          <option value="ALL">{language === "ar" ? "كل الأولويات" : "All priorities"}</option>
                          <option value="CRITICAL">CRITICAL</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="LOW">LOW</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {commandLoading ? (
                    <div className="pms-command-state"><Loader2 className="spin" size={20} /><span>{language === "ar" ? "جاري حساب المؤشرات..." : "Calculating operational signals..."}</span></div>
                  ) : commandError ? (
                    <div className="pms-command-state pms-command-state--error" role="alert">{commandError}</div>
                  ) : commandCenter ? (
                    <>
                      <div className="pms-command-health-grid">
                        {commandHealthSignals.map((signal) => (
                          <article key={signal.label} className={`pms-health-card pms-health-card--${signal.status.toLowerCase().replace("_", "-")}`}>
                            <span>{signal.label}</span>
                            <strong>{signal.score == null ? "—" : `${signal.score}/100`}</strong>
                            <small>{signal.detail}</small>
                          </article>
                        ))}
                      </div>

                      <div className="pms-command-kpi-grid">
                        <article><span>{language === "ar" ? "الإشغال" : "Occupancy"}</span><strong>{formatPercent(commandCenter.metrics.occupancyRate, language)}</strong><small>{commandCenter.metrics.occupiedUnits ?? "—"} / {commandCenter.metrics.totalUnits ?? "—"} {language === "ar" ? "وحدة" : "units"}</small></article>
                        <article>
                          <span>{language === "ar" ? "إيجار مستحق" : "Outstanding rent"}</span>
                          <strong>{formatCurrencyAmount(commandCenter.metrics.outstandingRentAmount, commandCenter.metrics.currencyState?.displayCurrency, language)}</strong>
                          <small>{commandCenter.metrics.currencyState?.status === "MIXED" ? formatCommandCurrencyBreakdown(commandCenter.metrics.financialsByCurrency, "outstandingRent", language) : `${commandCenter.metrics.outstandingRentItems ?? "—"} ${language === "ar" ? "بند" : "items"}`}</small>
                        </article>
                        <article>
                          <span>{language === "ar" ? "إيجار متأخر" : "Overdue rent"}</span>
                          <strong>{formatCurrencyAmount(commandCenter.metrics.overdueRentAmount, commandCenter.metrics.currencyState?.displayCurrency, language)}</strong>
                          <small>{commandCenter.metrics.currencyState?.status === "MIXED" ? formatCommandCurrencyBreakdown(commandCenter.metrics.financialsByCurrency, "overdueRent", language) : `${commandCenter.metrics.highRiskTenantAccounts ?? "—"} ${language === "ar" ? "حساب عالي المخاطر" : "high-risk accounts"}`}</small>
                        </article>
                        <article>
                          <span>{language === "ar" ? "معدل التحصيل" : "Collection rate"}</span>
                          <strong>{formatPercent(commandCenter.metrics.rentCollectionRate, language)}</strong>
                          <small>{commandCenter.metrics.currencyState?.status === "MIXED" ? formatCommandCurrencyBreakdown(commandCenter.metrics.financialsByCurrency, "rentCollected", language) : `${formatCurrencyAmount(commandCenter.metrics.rentCollectedThisPeriod, commandCenter.metrics.currencyState?.displayCurrency, language)} ${language === "ar" ? "محصل" : "collected"}`}</small>
                        </article>
                        <article><span>{language === "ar" ? "عقود تنتهي" : "Leases expiring"}</span><strong>{commandCenter.metrics.leasesExpiringSoon ?? "—"}</strong><small>{commandCenter.riskWindow.days} {language === "ar" ? "يوماً" : "day window"}</small></article>
                        <article><span>{language === "ar" ? "صيانة متأخرة" : "Maintenance overdue"}</span><strong>{commandCenter.metrics.overdueMaintenanceRequests ?? "—"}</strong><small>{commandCenter.metrics.urgentMaintenanceRequests ?? "—"} {language === "ar" ? "عاجلة" : "urgent"}</small></article>
                        <article><span>{language === "ar" ? "فجوات الامتثال" : "Compliance gaps"}</span><strong>{(commandCenter.metrics.missingLeaseDocuments ?? 0) + (commandCenter.metrics.expiredDocuments ?? 0)}</strong><small>{commandCenter.metrics.expiringDocuments ?? "—"} {language === "ar" ? "تنتهي قريباً" : "expiring soon"}</small></article>
                        <article><span>{language === "ar" ? "كشوف معتمدة" : "Approved statements"}</span><strong>{commandCenter.metrics.ownerStatementReadyProperties ?? "—"}</strong><small>{language === "ar" ? "جاهزة للنشر" : "ready to publish"}</small></article>
                      </div>

                      <div className="pms-priority-summary" aria-label={language === "ar" ? "ملخص الأولويات" : "Priority summary"}>
                        <span><strong>{commandCenter.prioritySummary.critical}</strong> Critical</span>
                        <span><strong>{commandCenter.prioritySummary.high}</strong> High</span>
                        <span><strong>{commandCenter.prioritySummary.medium}</strong> Medium</span>
                        <span><strong>{commandCenter.prioritySummary.low}</strong> Low</span>
                      </div>

                      <div className="pms-command-center__body">
                        <div className="pms-priority-queue">
                          <div className="pms-command-section-heading">
                            <div><h3>{language === "ar" ? "صندوق العمليات" : "Operations inbox"}</h3><p>{language === "ar" ? "مرتّب حسب درجة المخاطر والاستحقاق." : "Ranked by risk score and due date."}</p></div>
                            <strong>{filteredPriorityQueue.length}</strong>
                          </div>
                          {filteredPriorityQueue.length ? filteredPriorityQueue.map((item) => (
                            <Link key={item.id} className="pms-priority-item" to={item.href}>
                              <span className={`pms-priority-item__badge pms-priority-item__badge--${item.priority.toLowerCase()}`}>{item.priority}</span>
                              <span>
                                <strong>{item.title}</strong>
                                <small>{item.detail}{item.propertyName ? ` · ${item.propertyName}` : ""}{item.dueAt ? ` · ${formatDate(item.dueAt, language)}` : ""}</small>
                                <small>{language === "ar" ? "درجة المخاطر" : "Risk score"}: {item.riskScore}/100 · {item.status.replaceAll("_", " ")}</small>
                              </span>
                              <ChevronRight size={16} />
                            </Link>
                          )) : (
                            <div className="pms-command-empty">
                              <ShieldCheck size={22} />
                              <p>{commandCenter.emptyState ?? (language === "ar" ? "لا توجد عناصر مطابقة." : "No matching priority items.")}</p>
                            </div>
                          )}
                        </div>

                        <div className="pms-automation-queue">
                          <div className="pms-command-section-heading">
                            <div><h3>{language === "ar" ? "قائمة الأتمتة" : "Automation queue"}</h3><p>{language === "ar" ? "تنشئ تنبيهات داخلية مدققة ولا ترسل رسائل خارجية." : "Creates audited internal alerts; no external messages are sent."}</p></div>
                          </div>
                          {commandCenter.automation.items.map((item) => (
                            <div key={item.type} className="pms-automation-item">
                              <span>
                                <strong>{item.label}</strong>
                                <small>{item.lastGeneratedAt ? `${language === "ar" ? "آخر تشغيل" : "Last run"}: ${formatDate(item.lastGeneratedAt, language)}` : (language === "ar" ? "لم يتم التشغيل بعد" : "Not run in this period")}</small>
                              </span>
                              <strong>{item.count ?? "—"}</strong>
                              <button
                                className="button-link"
                                type="button"
                                disabled={!item.canRun || !item.count || automationRunning !== null}
                                onClick={() => void handleRunPmsAutomation(item.type)}
                              >
                                {automationRunning === item.type
                                  ? (language === "ar" ? "جاري الإنشاء..." : "Generating...")
                                  : (language === "ar" ? "إنشاء تنبيهات" : "Generate alerts")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {commandCenter.riskSignals.highRiskTenants.length ? (
                        <div className="pms-risk-accounts">
                          <div className="pms-command-section-heading"><div><h3>{language === "ar" ? "حسابات المستأجرين عالية المخاطر" : "High-risk tenant accounts"}</h3><p>{language === "ar" ? "مبنية على عمر المتأخرات والرصيد وتكرار البنود." : "Based on arrears age, outstanding balance, and repeated overdue items."}</p></div></div>
                          <div className="pms-compact-table" role="table">
                            {commandCenter.riskSignals.highRiskTenants.slice(0, 5).map((tenant) => (
                              <Link key={tenant.tenantId} to={tenant.href} role="row">
                                <span><strong>{tenant.tenantName}</strong><small>{tenant.propertyName}</small></span>
                                <span>{formatCurrencyAmount(tenant.outstandingAmount, tenant.currency, language)}</span>
                                <span>{tenant.overdueItems} {language === "ar" ? "متأخر" : "overdue"}</span>
                                <span className={`pms-priority-item__badge pms-priority-item__badge--${tenant.priority.toLowerCase()}`}>{tenant.riskScore}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="pms-command-state">{language === "ar" ? "لا توجد بيانات تشغيلية متاحة." : "No operational data is available."}</div>
                  )}
                </section>

                <section className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.readiness}</p>
                    <h2>{copy.overview}</h2>
                  </div>

                  <div className="pms-empty-state-list">
                    {overview.emptyStates.properties ? (
                      <Link
                        to={`/pms/properties?companyId=${overview.workspace.company.id}`}
                      >
                        <Building2 size={18} aria-hidden="true" />
                        <span>{copy.emptyProperties}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    ) : null}

                    {overview.emptyStates.rentals ? (
                      <div>
                        <FileText size={18} aria-hidden="true" />
                        <span>{copy.emptyRentals}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </div>
                    ) : null}

                    {overview.emptyStates.accounting ? (
                      <div>
                        <CreditCard size={18} aria-hidden="true" />
                        <span>{copy.emptyAccounting}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="pms-next-actions pms-launch-checklist">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.readiness}</p>
                    <h2>{copy.launchChecklist}</h2>
                    <p>{copy.launchChecklistText}</p>
                  </div>

                  <div className="pms-empty-state-list">
                    {launchChecklistItems.map((item) => (
                      <div key={item.key}>
                        <ShieldCheck size={18} aria-hidden="true" />
                        <span>{item.label}</span>
                        <small className={item.complete ? "pms-status-badge pms-status-badge--completed" : "pms-status-badge"}>
                          {item.complete ? copy.checklistComplete : copy.checklistPending}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="pms-next-actions pms-launch-docs">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.launchDocs}</p>
                    <h2>{copy.launchDocs}</h2>
                    <p>{copy.launchDocsText}</p>
                  </div>
                  <div className="pms-empty-state-list">
                    <div>docs/pms-admin-setup-guide.md</div>
                    <div>docs/pms-company-onboarding-guide.md</div>
                    <div>docs/pms-qa-checklist.md</div>
                    <div>docs/pms-production-runbook.md</div>
                  </div>
                </section>
              </>
            ) : null}

            {section === "properties" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.privateInventory}</p>
                    <h2>{copy.properties}</h2>
                  </div>

                  {properties.length === 0 ? (
                    <p>{copy.emptyProperties}</p>
                  ) : null}

                  <div className="pms-inventory-list">
                    {properties.map((property) => (
                      <article key={property.id} className="pms-inventory-card">
                        <div>
                          <strong>{property.name}</strong>
                          <span>
                            {[
                              property.code,
                              property.propertyType,
                              property.city,
                              property.area,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <small>
                          {formatNumber(property.counts.units, language)}{" "}
                          {copy.units}
                        </small>
                        <Link
                          className="button-link button-link--secondary"
                          to={`/pms/properties/${property.id}?companyId=${property.companyId}`}
                        >
                          {copy.view}
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateProperty}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createProperty}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <PropertyFields
                    copy={copy}
                    form={propertyForm}
                    setForm={setPropertyForm}
                    onMapInput={handleMapInput}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createProperty}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "propertyDetail" && activeProperty ? (
              <section className="pms-panel-grid">
                <form className="pms-form-card" onSubmit={handleUpdateProperty}>
                  <div>
                    <p className="eyebrow">{copy.privateInventory}</p>
                    <h2>{copy.editProperty}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <PropertyFields
                    copy={copy}
                    form={propertyForm}
                    setForm={setPropertyForm}
                    onMapInput={handleMapInput}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Save size={16} aria-hidden="true" />
                    {copy.save}
                  </button>
                </form>

                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">
                      {activeProperty.code || copy.properties}
                    </p>
                    <h2>{activeProperty.name}</h2>
                  </div>

                  <MapLocationPanel
                    title={activeProperty.name}
                    location={
                      activeProperty.city || activeProperty.area || "Oman"
                    }
                    placeLabel={activeProperty.mapPlaceLabel}
                    address={
                      activeProperty.mapAddress || activeProperty.addressLine
                    }
                    googleMapsUrl={activeProperty.mapGoogleUrl}
                    latitude={activeProperty.latitude}
                    longitude={activeProperty.longitude}
                  />
                </div>

                <form className="pms-form-card" onSubmit={handleCreateUnit}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createUnit}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <UnitFields
                    copy={copy}
                    form={unitForm}
                    setForm={setUnitForm}
                    language={language}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createUnit}
                  </button>
                </form>

                <UnitTable
                  copy={copy}
                  units={units}
                  language={language}
                  canEdit={canEdit}
                  saving={saving}
                  unitDrafts={unitDrafts}
                  setUnitDrafts={setUnitDrafts}
                  onUpdateUnit={handleUpdateUnit}
                />
              </section>
            ) : null}

            {section === "units" ? (
              <section className="pms-panel-grid">
                <OccupancyReconciliationPanel
                  language={language}
                  reconciliation={occupancyReconciliation}
                  canApply={canEdit && canEditTenantRecords}
                  saving={saving}
                  onRefresh={() => void handleOccupancyReconciliation(false)}
                  onApply={() => void handleOccupancyReconciliation(true)}
                />
                <UnitTable
                  copy={copy}
                  units={units}
                  language={language}
                  canEdit={canEdit}
                  saving={saving}
                  unitDrafts={unitDrafts}
                  setUnitDrafts={setUnitDrafts}
                  onUpdateUnit={handleUpdateUnit}
                />
              </section>
            ) : null}

            {section === "tenants" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.tenants}</p>
                    <h2>{copy.tenants}</h2>
                  </div>
                  {tenants.length === 0 ? <p>{copy.emptyTenants}</p> : null}
                  <div className="pms-inventory-list">
                    {tenants.map((tenant) => {
                      const portalEmail = portalAccessEmails[tenant.id] ?? tenant.email ?? "";

                      return (
                        <article key={tenant.id} className="pms-inventory-card pms-tenant-card">
                          <div className="pms-tenant-card__summary">
                            <strong>{tenant.fullName}</strong>
                            <span>
                              {[tenant.phone, tenant.email, tenant.nationality]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            <small>
                              {formatNumber(tenant.counts.leases, language)} {copy.rentals}
                            </small>
                          </div>

                          <div className="pms-tenant-card__portal">
                            <div>
                              <strong>{copy.tenantPortalAccess}</strong>
                              <span>{copy.tenantPortalAccessText}</span>
                            </div>
                            {tenant.portalAccesses.length > 0 ? (
                              <div className="pms-tenant-card__access-list">
                                {tenant.portalAccesses.map((access) => {
                                  const busyKey = `${tenant.id}:${access.userId}`;

                                  return (
                                    <div key={access.id} className="pms-tenant-card__access-row">
                                      <span>
                                        <strong>{access.user.name || access.user.email}</strong>
                                        <small>{access.user.email}</small>
                                      </span>
                                      <StatusBadge
                                        status={access.active ? "ACTIVE" : "CANCELLED"}
                                        label={
                                          access.active
                                            ? copy.portalAccessActive
                                            : copy.portalAccessDisabled
                                        }
                                      />
                                      {access.active ? (
                                        <button
                                          className="button-link"
                                          type="button"
                                          disabled={
                                            !canEditTenantRecords ||
                                            saving ||
                                            Boolean(portalAccessBusy[busyKey])
                                          }
                                          onClick={() => handleDisableTenantPortalAccess(tenant, access)}
                                        >
                                          {copy.disablePortalAccess}
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="pms-tenant-card__empty">{copy.noPortalAccess}</p>
                            )}

                            <form
                              className="pms-tenant-card__access-form"
                              onSubmit={(event) => handleGrantTenantPortalAccess(event, tenant)}
                            >
                              <label>
                                {copy.portalEmail}
                                <input
                                  type="email"
                                  value={portalEmail}
                                  placeholder={tenant.email ?? "tenant@example.com"}
                                  onChange={(event) =>
                                    setPortalAccessEmail(tenant.id, event.target.value)
                                  }
                                  disabled={!canEditTenantRecords || saving}
                                />
                              </label>
                              <button
                                className="button-link button-link--primary"
                                type="submit"
                                disabled={
                                  !canEditTenantRecords ||
                                  saving ||
                                  Boolean(portalAccessBusy[tenant.id])
                                }
                              >
                                {portalAccessBusy[tenant.id] ? (
                                  <Loader2 size={16} aria-hidden="true" />
                                ) : null}
                                {copy.grantPortalAccess}
                              </button>
                            </form>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateTenant}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createTenant}</h2>
                  </div>
                  {!canEditTenantRecords ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <TenantFields
                    copy={copy}
                    form={tenantForm}
                    setForm={setTenantForm}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEditTenantRecords || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createTenant}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "rentals" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <LeaseTable
                  copy={copy}
                  leases={leases}
                  language={language}
                />

                <form className="pms-form-card" onSubmit={handleCreateLease}>
                  <div>
                    <p className="eyebrow">{copy.rentals}</p>
                    <h2>{copy.createLease}</h2>
                  </div>
                  {!canEditTenantRecords ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <LeaseFields
                    copy={copy}
                    form={leaseForm}
                    setForm={setLeaseForm}
                    tenants={tenants}
                    properties={properties}
                    units={units}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEditTenantRecords || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createLease}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "leaseDetail" && activeLease ? (
              <section className="pms-panel-grid">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.lease}</p>
                    <h2>{activeLease.title || activeLease.unit.unitNumber}</h2>
                  </div>
                  <div className="pms-detail-list">
                    <span>{copy.tenantName}: <strong>{activeLease.tenant.fullName}</strong></span>
                    <span>{copy.propertyName}: <strong>{activeLease.property.name}</strong></span>
                    <span>{copy.unitNumber}: <strong>{activeLease.unit.unitNumber}</strong></span>
                    <span>{copy.startDate}: <strong>{formatDate(activeLease.startDate, language)}</strong></span>
                    <span>{copy.endDate}: <strong>{formatDate(activeLease.endDate, language)}</strong></span>
                    <span>{copy.rent}: <strong>{activeLease.rentAmount} {activeLease.currency}</strong></span>
                    <span>{copy.status}: <strong>{activeLease.status}</strong></span>
                  </div>
                </div>
                {rentReceipt ? (
                  <PmsRentReceiptPanel copy={copy} receipt={rentReceipt} language={language} />
                ) : null}

                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.renewalDraft}</p>
                    <h2>{copy.documents}</h2>
                  </div>
                  {activeLease.previousLease ? (
                    <p>{copy.renewalDraft}: {activeLease.previousLease.title}</p>
                  ) : null}
                  <button
                    className="button-link button-link--primary"
                    type="button"
                    disabled={!canEditTenantRecords || saving}
                    onClick={handleCreateLeaseRenewalDraft}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createRenewalDraft}
                  </button>
                  <div className="pms-inventory-list">
                    {activeLeaseDocuments.length === 0 ? <p>{copy.emptyDocuments}</p> : null}
                    {activeLeaseDocuments.map((document) => (
                      <article key={document.id} className="pms-inventory-card">
                        <div>
                          <strong>{document.title}</strong>
                          <span>{formatStatusText(document.type)} · {document.status}</span>
                        </div>
                        <button className="button-link" type="button" disabled={documentDownloadingId === document.id} onClick={() => void handleDownloadDocument(document)}>
                          {documentDownloadingId === document.id ? copy.loading : copy.openDocument}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.moveChecklist}</p>
                    <h2>{copy.moveChecklist}</h2>
                  </div>
                  <div className="pms-action-row">
                    <button className="button-link" type="button" disabled={!canEditTenantRecords || saving} onClick={() => handleCreateChecklistItem("MOVE_IN")}>
                      {copy.addChecklistItem} · Move-in
                    </button>
                    <button className="button-link" type="button" disabled={!canEditTenantRecords || saving} onClick={() => handleCreateChecklistItem("MOVE_OUT")}>
                      {copy.addChecklistItem} · Move-out
                    </button>
                  </div>
                  <div className="pms-inventory-list">
                    {activeLeaseChecklists.map((item) => (
                      <article key={item.id} className="pms-inventory-card">
                        <div>
                          <strong>{item.title}</strong>
                          <span>{formatStatusText(item.type)} · {formatStatusText(item.status)}</span>
                        </div>
                        {item.status !== "COMPLETED" ? (
                          <button className="button-link" type="button" disabled={!canEditTenantRecords || saving} onClick={() => handleCompleteChecklistItem(item)}>
                            {copy.completeChecklistItem}
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>

                <RentDueTable
                  copy={copy}
                  items={rentDueItems}
                  language={language}
                  canCollect={canCollect}
                  saving={saving}
                  onMarkPaid={handleRecordRentPayment}
                />
              </section>
            ) : null}

            {section === "documents" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.documentsCenter}</h2>
                  </div>
                  {!canSeeDocuments ? <p className="form-error">{copy.cannotEdit}</p> : null}

                  <div className="pms-inventory-list">
                    {documentAlerts.length > 0 ? (
                      <article className="pms-inventory-card">
                        <div>
                          <strong>{copy.documentAlerts}</strong>
                          <span>{documentAlerts.map((document) => document.title).join(", ")}</span>
                        </div>
                      </article>
                    ) : null}
                    {documents.length === 0 ? <p>{copy.emptyDocuments}</p> : null}
                    {documents.map((document) => (
                      <article key={document.id} className="pms-inventory-card">
                        <div>
                          <strong>{document.title}</strong>
                          <span>
                            {formatStatusText(document.type)} · {document.status}
                            {document.expiryDate ? ` · ${formatDate(document.expiryDate, language)}` : ""}
                          </span>
                          <small>
                            {[document.tenant?.fullName, document.lease?.title, document.property?.name, document.unit?.unitNumber]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </div>
                        <button className="button-link" type="button" disabled={documentDownloadingId === document.id} onClick={() => void handleDownloadDocument(document)}>
                          {documentDownloadingId === document.id ? copy.loading : copy.openDocument}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateDocument}>
                  <div>
                    <p className="eyebrow">{copy.documents}</p>
                    <h2>{copy.createDocument}</h2>
                  </div>
                  {!canManageDocumentRecords ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <DocumentFields
                    copy={copy}
                    form={documentForm}
                    setForm={setDocumentForm}
                    properties={properties}
                    units={units}
                    tenants={tenants}
                    leases={leases}
                    workOrders={workOrders}
                    inspections={inspections}
                    file={documentFile}
                    onFileChange={setDocumentFile}
                  />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageDocumentRecords || saving || !documentFile}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createDocument}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "maintenance" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <MaintenanceTable
                  copy={copy}
                  workOrders={workOrders}
                  language={language}
                  canManage={canManageMaintenance}
                  canApprove={canManageOperations}
                  saving={saving}
                  onResolve={handleResolveWorkOrder}
                  onAddQuote={handleAddMaintenanceQuote}
                  onApproveQuote={handleApproveMaintenanceQuote}
                />

                <form className="pms-form-card" onSubmit={handleCreateVendor}>
                  <div>
                    <p className="eyebrow">{copy.vendors}</p>
                    <h2>{copy.createVendor}</h2>
                  </div>
                  {!canManageMaintenance ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <label>
                    {copy.vendor}
                    <input required value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    {copy.trade}
                    <input value={vendorForm.trade ?? ""} onChange={(event) => setVendorForm((current) => ({ ...current, trade: event.target.value }))} />
                  </label>
                  <label>
                    {copy.phone}
                    <input value={vendorForm.phone ?? ""} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} />
                  </label>
                  <label>
                    {copy.email}
                    <input type="email" value={vendorForm.email ?? ""} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} />
                  </label>
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageMaintenance || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createVendor}
                  </button>
                  {vendors.length > 0 ? (
                    <div className="pms-mini-list">
                      {vendors.slice(0, 6).map((vendor) => (
                        <span key={vendor.id}>{vendor.name}{vendor.trade ? ` · ${vendor.trade}` : ""}</span>
                      ))}
                    </div>
                  ) : null}
                </form>

                <form className="pms-form-card" onSubmit={handleCreateWorkOrder}>
                  <div>
                    <p className="eyebrow">{copy.maintenance}</p>
                    <h2>{copy.createWorkOrder}</h2>
                  </div>
                  {!canManageMaintenance ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <WorkOrderFields
                    copy={copy}
                    form={workOrderForm}
                    setForm={setWorkOrderForm}
                    properties={properties}
                    units={units}
                    tenants={tenants}
                    vendors={vendors}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canManageMaintenance || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createWorkOrder}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "accounting" ? (
              <section className="pms-panel-grid">
                {!canSeeAccounting ? <p className="form-error">{copy.cannotEdit}</p> : null}
                <ReportsSummaryPanel
                  copy={copy}
                  summary={reportsSummary}
                  language={language}
                />
                <OwnerStatementPanel copy={copy} statement={ownerStatement} />
                <OwnerStatementLifecyclePanel
                  language={language}
                  properties={properties}
                  statements={ownerStatements}
                  propertyId={ownerStatementPropertyId}
                  month={ownerStatementMonth}
                  currency={ownerStatementCurrency}
                  canManage={canManageAccounting}
                  saving={saving}
                  onPropertyChange={setOwnerStatementPropertyId}
                  onMonthChange={setOwnerStatementMonth}
                  onCurrencyChange={setOwnerStatementCurrency}
                  onCreate={handleCreateOwnerStatement}
                  onTransition={(statement, status) => void handleOwnerStatementTransition(statement, status)}
                />
                {rentReceipt ? (
                  <PmsRentReceiptPanel copy={copy} receipt={rentReceipt} language={language} />
                ) : null}
                <LedgerEntryForm
                  copy={copy}
                  form={ledgerForm}
                  setForm={setLedgerForm}
                  properties={properties}
                  units={units}
                  tenants={tenants}
                  leases={leases}
                  workOrders={workOrders}
                  saving={saving}
                  canManage={canCollect}
                  onSubmit={handleCreateLedgerEntry}
                />
                <AccountingLedgerTable
                  copy={copy}
                  entries={ledgerEntries}
                  language={language}
                />
                <RentDueTable
                  copy={copy}
                  items={rentDueItems}
                  language={language}
                  canCollect={canCollect}
                  saving={saving}
                  onMarkPaid={handleRecordRentPayment}
                />
              </section>
            ) : null}

            {section === "importExport" ? (
              <section className="pms-panel-grid pms-panel-grid--operations">
                <form className="pms-form-card pms-import-card" onSubmit={handlePreviewImport}>
                  <div className="pms-card-heading">
                    <p className="eyebrow">{copy.privateInventory}</p>
                    <h2>{copy.bulkImport}</h2>
                    <p>{copy.previewDoesNotWrite}</p>
                  </div>
                  {!canManageImportRecords ? <p className="form-error">{copy.cannotEdit}</p> : null}

                  <div className="pms-form-grid pms-form-grid--compact">
                    <label>
                      {copy.importType}
                      <select value={importType} onChange={(event) => { setImportType(event.target.value as PmsImportType); setImportPreview(null); }}>
                        <option value="PROPERTIES">{copy.properties}</option>
                        <option value="UNITS">{copy.units}</option>
                        <option value="TENANTS">{copy.tenants}</option>
                        <option value="LEASES">{copy.rentals}</option>
                      </select>
                    </label>

                    <label className="pms-upload-control">
                      <span>{copy.csvFile}</span>
                      <input type="file" accept=".csv,text/csv" onChange={(event) => void handleImportFileChange(event.target.files?.[0])} />
                      <strong>{copy.pasteCsvOrUpload}</strong>
                    </label>
                  </div>

                  <label className="pms-csv-editor">
                    <span>CSV</span>
                    <textarea
                      rows={10}
                      value={importCsvText}
                      onChange={(event) => { setImportCsvText(event.target.value); setImportPreview(null); }}
                      placeholder={copy.csvEditorPlaceholder}
                    />
                  </label>

                  <div className="pms-card-actions pms-card-actions--wrap pms-card-actions--prominent">
                    <button className="button-link" type="button" onClick={handleDownloadImportTemplate} disabled={!overview || !token || saving}>
                      {copy.downloadTemplate}
                    </button>
                    <button className="button-link button-link--primary" type="submit" disabled={!canManageImportRecords || saving || !importCsvText.trim()}>
                      {copy.previewImport}
                    </button>
                    <button className="button-link" type="button" disabled={!canManageImportRecords || saving || !importPreview || importPreview.validRows.length === 0} onClick={() => void handleCommitImport()}>
                      {copy.commitImport}
                    </button>
                  </div>

                  {importPreview ? (
                    <article className="pms-import-preview pms-import-preview--inline">
                      <div>
                        <span>{copy.validRows}</span>
                        <strong>{formatNumber(importPreview.validRows.length, language)}</strong>
                      </div>
                      <div>
                        <span>{copy.invalidRows}</span>
                        <strong>{formatNumber(importPreview.invalidRows.length, language)}</strong>
                      </div>
                      {importPreview.invalidRows.length > 0 ? (
                        <ul>
                          {importPreview.invalidRows.slice(0, 5).map((row) => (
                            <li key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join("; ")}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ) : null}
                </form>

                <div className="pms-next-actions pms-export-card">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.importExport}</p>
                    <h2>{copy.bulkExport}</h2>
                    <p>{copy.exportHelp}</p>
                  </div>
                  <div className="pms-export-grid">
                    {([
                      ["properties", copy.properties],
                      ["units", copy.units],
                      ["tenants", copy.tenants],
                      ["leases", copy.rentals],
                      ["rent-roll", copy.rentCollection],
                      ["maintenance", copy.maintenance],
                      ["accounting-summary", copy.accountingSummary],
                    ] as const).map(([type, label]) => (
                      <button
                        key={type}
                        type="button"
                        className="pms-export-button"
                        onClick={() => handleExportCsv(type)}
                        disabled={!overview || !token || saving}
                      >
                        <span>{copy.exportData}</span>
                        <strong>{label}</strong>
                      </button>
                    ))}
                    {canExportSensitiveIdentity ? (
                      <button
                        type="button"
                        className="pms-export-button pms-export-button--sensitive"
                        onClick={() => void handleExportCsv("tenants", true)}
                        disabled={!overview || !token || saving}
                      >
                        <span>{language === "ar" ? "تصدير حساس ومدقق" : "Audited sensitive export"}</span>
                        <strong>{language === "ar" ? "هويات المستأجرين" : "Tenant identity fields"}</strong>
                      </button>
                    ) : null}
                  </div>

                  <div className="pms-inventory-list pms-import-batches">
                    <div className="pms-next-actions__header">
                      <p className="eyebrow">{copy.importBatches}</p>
                    </div>
                    {importBatches.length === 0 ? (
                      <div className="pms-empty-card">{copy.noImportBatches}</div>
                    ) : null}
                    {importBatches.map((batch) => (
                      <article key={batch.id} className="pms-inventory-card pms-import-batch-card">
                        <div>
                          <strong>{batch.type} · {batch.status}</strong>
                          <span>{copy.validRows}: {batch.successfulRows} · {copy.invalidRows}: {batch.failedRows}</span>
                          <small>{batch.filename || formatDate(batch.createdAt, language)}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {section === "staff" ? (
              <section className="pms-panel-grid pms-panel-grid--operations">
                <form className="pms-form-card pms-staff-form" onSubmit={handleInviteStaff}>
                  <div className="pms-card-heading">
                    <p className="eyebrow">{copy.accessControls}</p>
                    <h2>{copy.inviteStaff}</h2>
                    <p>{copy.accessScoped}</p>
                  </div>

                  <div className="pms-form-grid pms-form-grid--compact">
                    <label>
                      {copy.staffEmail}
                      <input
                        type="email"
                        value={staffEmail}
                        onChange={(event) => setStaffEmail(event.target.value)}
                        placeholder="user@example.com"
                        required
                      />
                    </label>

                    <label>
                      {copy.role}
                      <select
                        value={staffRole}
                        onChange={(event) => setStaffRole(event.target.value as PmsMemberRole)}
                      >
                        {pmsRoles.map((role) => (
                          <option key={role} value={role}>
                            {getRoleLabel(role, language)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <fieldset className="pms-scope-card">
                    <legend>{copy.propertyScope}</legend>
                    <p>{copy.staffScopeHelp}</p>
                    <div className="pms-scope-summary">
                      {staffPropertyIds.length === 0 ? copy.allProperties : `${copy.selectedProperties}: ${staffPropertyIds.length}`}
                    </div>
                    {staffProperties.length === 0 ? <div className="pms-empty-card">{copy.noPropertiesForScope}</div> : null}
                    <div className="pms-pill-grid">
                      {staffProperties.map((property) => (
                        <label key={property.id} className="pms-pill-check">
                          <input
                            type="checkbox"
                            checked={staffPropertyIds.includes(property.id)}
                            onChange={() => toggleStaffProperty(property.id)}
                          />
                          <span>{property.name}{property.code ? ` · ${property.code}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="pms-permission-groups">
                    <legend>{copy.permissionGroups}</legend>
                    {pmsPermissionGroups.map((group) => (
                      <div key={group.key} className="pms-permission-group">
                        <h3>{getPermissionGroupLabel(group, language)}</h3>
                        <div className="pms-pill-grid">
                          {group.permissions.map((permissionKey) => (
                            <label key={permissionKey} className="pms-pill-check">
                              <input
                                type="checkbox"
                                checked={staffPermissionKeys.includes(permissionKey)}
                                onChange={() => toggleStaffPermission(permissionKey)}
                              />
                              <span>{getPermissionLabel(permissionKey, language)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </fieldset>

                  <button className="button-link button-link--primary pms-full-width-action" type="submit" disabled={!canManageStaffRecords || saving}>
                    {copy.inviteStaff}
                  </button>
                </form>

                <div className="pms-next-actions pms-staff-list-card">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.accessControls}</p>
                    <h2>{copy.staff}</h2>
                  </div>

                  <div className="pms-staff-list">
                    {staffMembers.map((member) => (
                      <article key={member.id} className="pms-staff-card">
                        <div className="pms-staff-card__identity">
                          <div>
                            <strong>{member.user.name}</strong>
                            <span>{member.user.email}</span>
                          </div>
                          <em className="pms-status-badge pms-status-badge--active">{getRoleLabel(member.role, language)}</em>
                        </div>
                        <div className="pms-staff-card__meta">
                          <span>
                            {member.propertyScope.allProperties
                              ? copy.allProperties
                              : `${copy.selectedProperties}: ${member.propertyScope.properties.map((property) => property.name).join(", ")}`}
                          </span>
                          <span>
                            {member.role === "PMS_OWNER" || member.role === "PMS_MANAGER"
                              ? language === "ar"
                                ? "صلاحيات كاملة حسب الدور"
                                : "Full PMS access through role"
                              : member.permissionKeys.length > 0
                                ? member.permissionKeys.slice(0, 6).map((permission) => getPermissionLabel(permission, language)).join(", ")
                                : copy.noExtraPermissions}
                          </span>
                        </div>
                        <div className="pms-staff-card__danger">
                          <span>{copy.staffDangerZone}</span>
                          <button className={cn("button-link", member.active && "button-link--danger")} type="button" disabled={!canManageStaffRecords || saving} onClick={() => void handleToggleStaffAccess(member)}>
                            {member.active ? copy.suspendAccess : copy.restoreAccess}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card pms-portfolio-form" onSubmit={handleCreatePortfolio}>
                  <div className="pms-card-heading">
                    <p className="eyebrow">{copy.propertyScope}</p>
                    <h2>{copy.createPortfolio}</h2>
                    <p>{copy.portfolioHelp}</p>
                  </div>
                  <label>
                    {copy.portfolioName}
                    <input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} required />
                  </label>
                  <fieldset className="pms-scope-card pms-scope-card--nested">
                    <legend>{copy.properties}</legend>
                    {staffProperties.length === 0 ? <div className="pms-empty-card">{copy.noPropertiesForScope}</div> : null}
                    <div className="pms-pill-grid">
                      {staffProperties.map((property) => (
                        <label key={property.id} className="pms-pill-check">
                          <input
                            type="checkbox"
                            checked={portfolioPropertyIds.includes(property.id)}
                            onChange={() => togglePortfolioProperty(property.id)}
                          />
                          <span>{property.name}{property.code ? ` · ${property.code}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="button-link button-link--primary pms-full-width-action" type="submit" disabled={!canManageStaffRecords || saving}>
                    {copy.createPortfolio}
                  </button>
                </form>

                <div className="pms-next-actions pms-portfolio-list-card">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.accessControls}</p>
                    <h2>{copy.portfolios}</h2>
                  </div>
                  <div className="pms-inventory-list">
                    {staffPortfolios.length === 0 ? <div className="pms-empty-card">{copy.emptyPortfolios}</div> : null}
                    {staffPortfolios.map((portfolio) => (
                      <article key={portfolio.id} className="pms-inventory-card pms-portfolio-card">
                        <div>
                          <strong>{portfolio.name}</strong>
                          <span>{portfolio.properties.map((property) => property.name).join(", ") || copy.emptyProperties}</span>
                          <small>{portfolio.active ? copy.active : copy.suspended}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {section === "reports" ? (
              <ReportsSummaryPanel
                copy={copy}
                summary={reportsSummary}
                language={language}
              />
            ) : null}

            {section === "settings" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.communications}</p>
                    <h2>{copy.settings}</h2>
                  </div>
                  <div className="pms-inventory-list">
                    {templates.map((template) => (
                      <article key={template.id} className="pms-inventory-card">
                        <div>
                          <strong>{template.name}</strong>
                          <span>{template.channel} · {template.type || copy.communications}</span>
                          {template.channel === "WHATSAPP" ? <small>{copy.whatsappCopyOnly}</small> : null}
                        </div>
                        <div className="pms-card-actions">
                          <button className="button-link" type="button" disabled={saving} onClick={() => void handlePreviewTemplate(template)}>
                            {copy.previewTemplate}
                          </button>
                          <button className="button-link button-link--primary" type="button" disabled={saving || tenants.length === 0} onClick={() => void handleSendTemplate(template)}>
                            {copy.sendNotice}
                          </button>
                        </div>
                      </article>
                    ))}
                    {communicationPreview ? (
                      <article className="pms-inventory-card pms-inventory-card--highlight">
                        <div>
                          <strong>{copy.templatePreview}</strong>
                          <span>{communicationPreview.subject || copy.subject}</span>
                          <p>{communicationPreview.body}</p>
                        </div>
                      </article>
                    ) : null}
                    <article className="pms-inventory-card">
                      <div>
                        <strong>{copy.reminderCenter}</strong>
                        <span>{copy.reminderCandidates}: {formatNumber(reminderCandidates.length, language)}</span>
                        <small>{copy.templateVariables}: tenantName, propertyName, unitLabel, dueDate, amount, leaseEndDate, maintenanceTitle, maintenanceStatus</small>
                      </div>
                    </article>
                    {communicationLogs.slice(0, 5).map((log) => (
                      <article key={log.id} className="pms-inventory-card">
                        <div>
                          <strong>{log.subject || copy.communicationHistory}</strong>
                          <span>{log.channel} · {log.status} · {formatDate(log.createdAt, language)}</span>
                          <small>{log.tenant?.fullName || log.template?.name || copy.communications}</small>
                        </div>
                      </article>
                    ))}
                    {policies.map((policy) => (
                      <article key={policy.id} className="pms-inventory-card">
                        <div>
                          <strong>{policy.title}</strong>
                          <span>{policy.category}</span>
                        </div>
                      </article>
                    ))}
                    {inspections.map((inspection) => (
                      <article key={inspection.id} className="pms-inventory-card">
                        <div>
                          <strong>{inspection.title}</strong>
                          <span>{inspection.status} · {inspection.property.name}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateTemplate}>
                  <div>
                    <p className="eyebrow">{copy.communications}</p>
                    <h2>{copy.createTemplate}</h2>
                  </div>
                  {!canManageOperations ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <TemplateFields copy={copy} form={templateForm} setForm={setTemplateForm} />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageOperations || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createTemplate}
                  </button>
                </form>

                <form className="pms-form-card" onSubmit={handleCreatePolicy}>
                  <div>
                    <p className="eyebrow">{copy.policies}</p>
                    <h2>{copy.createPolicy}</h2>
                  </div>
                  {!canManageOperations ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <PolicyFields copy={copy} form={policyForm} setForm={setPolicyForm} />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageOperations || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createPolicy}
                  </button>
                </form>

                <form className="pms-form-card" onSubmit={handleCreateInspection}>
                  <div>
                    <p className="eyebrow">{copy.inspections}</p>
                    <h2>{copy.createInspection}</h2>
                  </div>
                  {!canManageMaintenance ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <InspectionFields
                    copy={copy}
                    form={inspectionForm}
                    setForm={setInspectionForm}
                    properties={properties}
                    units={units}
                    tenants={tenants}
                    leases={leases}
                  />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageMaintenance || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createInspection}
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type PmsCopy = Record<string, string>;

function PropertyFields({
  copy,
  form,
  setForm,
  onMapInput,
}: {
  copy: PmsCopy;
  form: PmsPropertyPayload;
  setForm: (
    updater: (current: PmsPropertyPayload) => PmsPropertyPayload,
  ) => void;
  onMapInput: (value: string) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <input
          required
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.code}
        <input
          value={form.code ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, code: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.type}
        <input
          value={form.propertyType ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyType: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.city}
        <input
          value={form.city ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, city: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.area}
        <input
          value={form.area ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, area: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.address}
        <input
          value={form.addressLine ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              addressLine: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.description}
        <textarea
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.googleMap}
        <input
          value={form.mapGoogleUrl ?? ""}
          onChange={(event) => onMapInput(event.target.value)}
        />
      </label>
      <label>
        {copy.placeLabel}
        <input
          value={form.mapPlaceLabel ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              mapPlaceLabel: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.latitude}
        <input
          value={form.latitude ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, latitude: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.longitude}
        <input
          value={form.longitude ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              longitude: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.linkedProject}
        <input
          value={form.developerProjectId ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              developerProjectId: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.linkedPublicListing}
        <input
          value={form.publicListingId ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              publicListingId: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(form.active)}
          onChange={(event) =>
            setForm((current) => ({ ...current, active: event.target.checked }))
          }
        />
        {copy.activeLabel}
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function UnitFields({
  copy,
  form,
  setForm,
  language,
}: {
  copy: PmsCopy;
  form: PmsUnitPayload;
  setForm: (updater: (current: PmsUnitPayload) => PmsUnitPayload) => void;
  language: "en" | "ar";
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.unitNumber}
        <input
          required
          value={form.unitNumber}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              unitNumber: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.unitName}
        <input
          value={form.unitName ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitName: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.floor}
        <input
          value={form.floor ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, floor: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.status}
        <select
          value={form.status ?? "VACANT"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as PmsUnitStatus,
              occupancyStatus: null,
            }))
          }
        >
          {unitStatuses.map((status) => (
            <option key={status} value={status}>
              {getUnitStatusLabel(status, language)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.bedrooms}
        <input
          type="number"
          min="0"
          value={form.bedrooms ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              bedrooms: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.bathrooms}
        <input
          type="number"
          min="0"
          value={form.bathrooms ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              bathrooms: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.areaSqm}
        <input
          type="number"
          min="0"
          value={form.areaSqm ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              areaSqm: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.rent}
        <input
          type="number"
          min="0"
          value={form.rentAmount ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              rentAmount: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.currency}
        <input
          maxLength={3}
          value={form.currency ?? "OMR"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              currency: event.target.value.toUpperCase(),
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function UnitTable({
  copy,
  units,
  language,
  canEdit,
  saving,
  unitDrafts,
  setUnitDrafts,
  onUpdateUnit,
}: {
  copy: PmsCopy;
  units: PmsUnit[];
  language: "en" | "ar";
  canEdit: boolean;
  saving: boolean;
  unitDrafts: Record<string, Partial<PmsUnitPayload>>;
  setUnitDrafts: (
    updater: (
      current: Record<string, Partial<PmsUnitPayload>>,
    ) => Record<string, Partial<PmsUnitPayload>>,
  ) => void;
  onUpdateUnit: (unit: PmsUnit) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.privateInventory}</p>
        <h2>{copy.units}</h2>
      </div>

      {units.length === 0 ? <p>{copy.emptyUnits}</p> : null}

      {units.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.unitNumber}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.status}</th>
                <th>{copy.bedrooms}</th>
                <th>{copy.areaSqm}</th>
                <th>{copy.rent}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const draft = unitDrafts[unit.id] ?? {};
                const draftStatus = (draft.status ??
                  unit.status) as PmsUnitStatus;
                return (
                  <tr key={unit.id}>
                    <td>
                      <strong>{unit.unitNumber}</strong>
                      {unit.unitName ? <small>{unit.unitName}</small> : null}
                    </td>
                    <td>{unit.property.name}</td>
                    <td>
                      {canEdit ? (
                        <select
                          value={draftStatus}
                          onChange={(event) =>
                            setUnitDrafts((current) => ({
                              ...current,
                              [unit.id]: {
                                ...current[unit.id],
                                status: event.target.value as PmsUnitStatus,
                              },
                            }))
                          }
                        >
                          {unitStatuses.map((status) => (
                            <option key={status} value={status}>
                              {getUnitStatusLabel(status, language)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge
                          status={unit.status}
                          label={getUnitStatusLabel(unit.status, language)}
                        />
                      )}
                    </td>
                    <td>{unit.bedrooms ?? "—"}</td>
                    <td>{unit.areaSqm ?? "—"}</td>
                    <td>
                      {unit.rentAmount
                        ? `${unit.rentAmount} ${unit.currency}`
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="button-link button-link--secondary"
                        type="button"
                        disabled={!canEdit || saving || !unitDrafts[unit.id]}
                        onClick={() => void onUpdateUnit(unit)}
                      >
                        {copy.update}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TenantFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsTenantPayload;
  setForm: (updater: (current: PmsTenantPayload) => PmsTenantPayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.tenantName}
        <input
          required
          value={form.fullName}
          onChange={(event) =>
            setForm((current) => ({ ...current, fullName: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.phone}
        <input
          value={form.phone ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, phone: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.email}
        <input
          type="email"
          value={form.email ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.nationality}
        <input
          value={form.nationality ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              nationality: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.nationalId}
        <input
          value={form.nationalId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, nationalId: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.passportNumber}
        <input
          value={form.passportNumber ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              passportNumber: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.emergencyContact}
        <input
          value={form.emergencyContactName ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              emergencyContactName: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.phone}
        <input
          value={form.emergencyContactPhone ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              emergencyContactPhone: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function LeaseFields({
  copy,
  form,
  setForm,
  tenants,
  properties,
  units,
}: {
  copy: PmsCopy;
  form: PmsLeasePayload;
  setForm: (updater: (current: PmsLeasePayload) => PmsLeasePayload) => void;
  tenants: PmsTenant[];
  properties: PmsProperty[];
  units: PmsUnit[];
}) {
  const availableUnits = units.filter(
    (unit) => !form.propertyId || unit.propertyId === form.propertyId,
  );

  return (
    <div className="pms-form-grid">
      <label>
        {copy.tenantName}
        <select
          required
          value={form.tenantId}
          onChange={(event) =>
            setForm((current) => ({ ...current, tenantId: event.target.value }))
          }
        >
          <option value="">—</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.propertyName}
        <select
          required
          value={form.propertyId}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyId: event.target.value,
              unitId: "",
            }))
          }
        >
          <option value="">—</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select
          required
          value={form.unitId}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitId: event.target.value }))
          }
        >
          <option value="">—</option>
          {availableUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitNumber} · {unit.status}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.leaseTitle}
        <input
          value={form.title ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.startDate}
        <input
          required
          type="date"
          value={form.startDate}
          onChange={(event) =>
            setForm((current) => ({ ...current, startDate: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.endDate}
        <input
          type="date"
          value={form.endDate ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, endDate: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.frequency}
        <select
          value={form.rentFrequency ?? "MONTHLY"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              rentFrequency: event.target.value as NonNullable<
                PmsLeasePayload["rentFrequency"]
              >,
            }))
          }
        >
          {rentFrequencies.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequency}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.rent}
        <input
          required
          type="number"
          min="0"
          value={form.rentAmount}
          onChange={(event) =>
            setForm((current) => ({ ...current, rentAmount: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.deposit}
        <input
          type="number"
          min="0"
          value={form.securityDeposit ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              securityDeposit: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.dueDay}
        <input
          type="number"
          min="1"
          max="31"
          value={form.dueDayOfMonth ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              dueDayOfMonth: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.currency}
        <input
          maxLength={3}
          value={form.currency ?? "OMR"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              currency: event.target.value.toUpperCase(),
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function LeaseTable({
  copy,
  leases,
  language,
}: {
  copy: PmsCopy;
  leases: PmsLease[];
  language: "en" | "ar";
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.rentals}</p>
        <h2>{copy.rentals}</h2>
      </div>
      {leases.length === 0 ? <p>{copy.emptyLeases}</p> : null}
      {leases.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.tenantName}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.rent}</th>
                <th>{copy.endDate}</th>
                <th>{copy.status}</th>
                <th>{copy.view}</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td>{lease.tenant.fullName}</td>
                  <td>{lease.property.name}</td>
                  <td>{lease.unit.unitNumber}</td>
                  <td>{lease.rentAmount} {lease.currency}</td>
                  <td>{formatDate(lease.endDate, language)}</td>
                  <td>{lease.status}</td>
                  <td>
                    <Link
                      className="button-link button-link--secondary"
                      to={`/pms/rentals/${lease.id}?companyId=${lease.companyId}`}
                    >
                      {copy.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}


function MaintenanceTable({
  copy,
  workOrders,
  language,
  canManage,
  canApprove,
  saving,
  onResolve,
  onAddQuote,
  onApproveQuote,
}: {
  copy: PmsCopy;
  workOrders: PmsWorkOrder[];
  language: "en" | "ar";
  canManage: boolean;
  canApprove: boolean;
  saving: boolean;
  onResolve: (workOrder: PmsWorkOrder) => Promise<void>;
  onAddQuote: (workOrder: PmsWorkOrder) => Promise<void>;
  onApproveQuote: (quote: PmsMaintenanceQuote) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.maintenance}</p>
        <h2>{copy.maintenanceRequests}</h2>
      </div>
      {workOrders.length === 0 ? <p>{copy.emptyMaintenance}</p> : null}
      {workOrders.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.workOrderTitle}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.priority}</th>
                <th>{copy.status}</th>
                <th>{copy.vendor}</th>
                <th>{copy.targetDate}</th>
                <th>{copy.cost}</th>
                <th>{copy.quote}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>{workOrder.title}</td>
                  <td>{workOrder.property.name}</td>
                  <td>{workOrder.unit?.unitNumber ?? "—"}</td>
                  <td><StatusBadge status={workOrder.priority} /></td>
                  <td><StatusBadge status={workOrder.status} /></td>
                  <td>{workOrder.vendor?.name ?? workOrder.vendorText ?? "—"}</td>
                  <td>{workOrder.targetDate ? formatDate(workOrder.targetDate, language) : "—"}{workOrder.overdue ? ` · ${copy.overdue}` : ""}</td>
                  <td>{workOrder.cost ? `${workOrder.cost} ${workOrder.currency}` : "—"}</td>
                  <td>
                    {(workOrder.quotes ?? []).slice(0, 2).map((quote) => (
                      <div className="pms-inline-actions" key={quote.id}>
                        <span>{quote.amount} {quote.currency} · {quote.status}</span>
                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={!canApprove || saving || quote.status === "APPROVED"}
                          onClick={() => void onApproveQuote(quote)}
                        >
                          {copy.approveQuote}
                        </button>
                      </div>
                    ))}
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={!canManage || saving}
                      onClick={() => void onAddQuote(workOrder)}
                    >
                      {copy.addQuote}
                    </button>
                  </td>
                  <td>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={!canManage || saving || workOrder.status === "RESOLVED"}
                      onClick={() => void onResolve(workOrder)}
                    >
                      {copy.resolve}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <small>{formatDate(new Date().toISOString(), language)}</small>
    </section>
  );
}

function WorkOrderFields({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
  vendors,
}: {
  copy: PmsCopy;
  form: PmsWorkOrderPayload;
  setForm: (updater: (current: PmsWorkOrderPayload) => PmsWorkOrderPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
  vendors: PmsVendor[];
}) {
  const propertyUnits = form.propertyId
    ? units.filter((unit) => unit.propertyId === form.propertyId)
    : units;

  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <select
          required
          value={form.propertyId}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyId: event.target.value,
              unitId: "",
            }))
          }
        >
          <option value="">—</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select
          value={form.unitId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitId: event.target.value }))
          }
        >
          <option value="">—</option>
          {propertyUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitNumber}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.tenantName}
        <select
          value={form.tenantId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, tenantId: event.target.value }))
          }
        >
          <option value="">—</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.vendor}
        <select
          value={form.vendorId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, vendorId: event.target.value }))
          }
        >
          <option value="">—</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}{vendor.trade ? ` · ${vendor.trade}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.workOrderTitle}
        <input
          required
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.priority}
        <select
          value={form.priority ?? "MEDIUM"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value as PmsMaintenancePriority,
            }))
          }
        >
          {maintenancePriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.status}
        <select
          value={form.status ?? "OPEN"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as PmsMaintenanceStatus,
            }))
          }
        >
          {maintenanceStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.assignedTo}
        <input
          value={form.assignedToText ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, assignedToText: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.vendor}
        <input
          value={form.vendorText ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, vendorText: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.cost}
        <input
          type="number"
          min="0"
          value={form.cost ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, cost: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.scheduledFor}
        <input
          type="date"
          value={form.scheduledFor ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, scheduledFor: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.targetDate}
        <input
          type="date"
          value={form.targetDate ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, targetDate: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.recurrence}
        <select
          value={form.recurrenceType ?? "NONE"}
          onChange={(event) =>
            setForm((current) => ({ ...current, recurrenceType: event.target.value as PmsMaintenanceRecurrenceType }))
          }
        >
          {maintenanceRecurrenceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label>
        {copy.targetDate} / {copy.recurrence}
        <input
          type="date"
          value={form.nextScheduledDate ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, nextScheduledDate: event.target.value }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.description}
        <textarea
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function LedgerEntryForm({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
  leases,
  workOrders,
  saving,
  canManage,
  onSubmit,
}: {
  copy: PmsCopy;
  form: PmsAccountingLedgerPayload;
  setForm: (updater: (current: PmsAccountingLedgerPayload) => PmsAccountingLedgerPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
  leases: PmsLease[];
  workOrders: PmsWorkOrder[];
  saving: boolean;
  canManage: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const propertyUnits = form.propertyId ? units.filter((unit) => unit.propertyId === form.propertyId) : units;

  return (
    <form className="pms-form-card" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">{copy.manualEntry}</p>
        <h2>{copy.createLedgerEntry}</h2>
      </div>
      {!canManage ? <p className="form-error">{copy.cannotEdit}</p> : null}
      <div className="pms-form-grid">
        <label>
          {copy.ledgerEntryType}
          <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PmsAccountingLedgerPayload["type"] }))}>
            {(["INCOME", "EXPENSE", "DEPOSIT", "ADJUSTMENT", "REFUND", "LATE_FEE", "TRANSFER"] as const).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          {copy.category}
          <input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
        </label>
        <label>
          {copy.amount}
          <input required type="number" min="0.001" step="0.001" value={form.amount || ""} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} />
        </label>
        <label>
          {copy.currency}
          <input required maxLength={3} value={form.currency ?? "OMR"} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
        </label>
        <label>
          {copy.transactionDate}
          <input required type="date" value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
        </label>
        <label>
          {copy.propertyName}
          <select value={form.propertyId ?? ""} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value, unitId: "" }))}>
            <option value="">—</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        <label>
          {copy.unitNumber}
          <select value={form.unitId ?? ""} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}>
            <option value="">—</option>
            {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
          </select>
        </label>
        <label>
          {copy.tenantName}
          <select value={form.tenantId ?? ""} onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}>
            <option value="">—</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>)}
          </select>
        </label>
        <label>
          {copy.lease}
          <select value={form.leaseId ?? ""} onChange={(event) => setForm((current) => ({ ...current, leaseId: event.target.value }))}>
            <option value="">—</option>
            {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.title || lease.unit.unitNumber}</option>)}
          </select>
        </label>
        <label>
          {copy.maintenanceRequests}
          <select value={form.workOrderId ?? ""} onChange={(event) => setForm((current) => ({ ...current, workOrderId: event.target.value }))}>
            <option value="">—</option>
            {workOrders.map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.title}</option>)}
          </select>
        </label>
        <label>
          {copy.referenceNumber}
          <input value={form.referenceNumber ?? ""} onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} />
        </label>
        <label className="pms-form-grid__wide">
          {copy.notes}
          <textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </div>
      <button className="button-link button-link--primary" type="submit" disabled={!canManage || saving}>
        <Plus size={16} aria-hidden="true" />
        {copy.createLedgerEntry}
      </button>
    </form>
  );
}

function OwnerStatementPanel({ copy, statement }: { copy: PmsCopy; statement: PmsOwnerStatement | null }) {
  if (!statement) {
    return (
      <section className="pms-next-actions pms-unit-table-card">
        <div className="pms-next-actions__header">
          <p className="eyebrow">{copy.accounting}</p>
          <h2>{copy.ownerStatement}</h2>
        </div>
        <p>{copy.emptyReports}</p>
      </section>
    );
  }

  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.accounting}</p>
        <h2>{copy.ownerStatement}</h2>
      </div>
      {statement.currencyState.status === "MIXED" ? (
        <p className="form-error">{statement.currencyState.message ?? "Amounts are grouped by currency and are not combined."}</p>
      ) : null}
      <div className="pms-metric-grid">
        {statement.totalsByCurrency.map((totals) => (
          <article className="pms-metric-card" key={totals.currency}>
            <span>{copy.netAmount} · {totals.currency}</span>
            <strong>{totals.netAmount} {totals.currency}</strong>
            <small>{copy.incomeCollected}: {totals.income} · {copy.expenses}: {totals.expenses}</small>
            <small>{copy.outstandingRent}: {totals.outstandingRent} · {copy.maintenanceCosts}: {totals.maintenanceCosts}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function OwnerStatementLifecyclePanel({
  language,
  properties,
  statements,
  propertyId,
  month,
  currency,
  canManage,
  saving,
  onPropertyChange,
  onMonthChange,
  onCurrencyChange,
  onCreate,
  onTransition,
}: {
  language: "en" | "ar";
  properties: PmsProperty[];
  statements: PmsPersistedOwnerStatement[];
  propertyId: string;
  month: string;
  currency: string;
  canManage: boolean;
  saving: boolean;
  onPropertyChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onTransition: (statement: PmsPersistedOwnerStatement, status: PmsOwnerStatementStatus) => void;
}) {
  const labels = language === "ar"
    ? { title: "دورة كشف المالك", create: "إنشاء لقطة كشف", empty: "لا توجد كشوف محفوظة بعد.", property: "العقار", month: "الشهر", currency: "العملة", immutable: "النسخ المنشورة محفوظة كلقطات غير قابلة للتعديل" }
    : { title: "Owner statement lifecycle", create: "Generate statement snapshot", empty: "No persisted statements yet.", property: "Property", month: "Month", currency: "Currency", immutable: "Published statements are immutable snapshots" };
  const nextStatus: Partial<Record<PmsOwnerStatementStatus, PmsOwnerStatementStatus>> = {
    DRAFT: "GENERATED",
    GENERATED: "NEEDS_REVIEW",
    NEEDS_REVIEW: "APPROVED",
    APPROVED: "PUBLISHED",
  };

  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{labels.immutable}</p>
        <h2>{labels.title}</h2>
      </div>
      <form className="pms-form-grid pms-form-grid--compact" onSubmit={onCreate}>
        <label>{labels.property}<select required value={propertyId} onChange={(event) => onPropertyChange(event.target.value)}><option value="">—</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label>{labels.month}<input required type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        <label>{labels.currency}<input required minLength={3} maxLength={3} value={currency} onChange={(event) => onCurrencyChange(event.target.value.toUpperCase())} /></label>
        <button className="button-link button-link--primary" type="submit" disabled={!canManage || saving || !propertyId}>{labels.create}</button>
      </form>
      {statements.length === 0 ? <p>{labels.empty}</p> : null}
      <div className="pms-inventory-list">
        {statements.map((statement) => {
          const next = nextStatus[statement.status];
          return (
            <article className="pms-inventory-card" key={statement.id}>
              <div>
                <strong>{statement.property.name} · {statement.currency}</strong>
                <span>{formatStatusText(statement.status)} · v{statement.revision} · {statement.closingBalance} {statement.currency}</span>
                <small>{formatDate(statement.periodStart, language)} – {formatDate(statement.periodEnd, language)}</small>
              </div>
              <div className="pms-action-row">
                {next ? <button className="button-link" type="button" disabled={!canManage || saving} onClick={() => onTransition(statement, next)}>{formatStatusText(next)}</button> : null}
                {statement.status !== "VOID" ? <button className="button-link button-link--danger" type="button" disabled={!canManage || saving} onClick={() => onTransition(statement, "VOID")}>VOID</button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OccupancyReconciliationPanel({
  language,
  reconciliation,
  canApply,
  saving,
  onRefresh,
  onApply,
}: {
  language: "en" | "ar";
  reconciliation: PmsOccupancyReconciliation | null;
  canApply: boolean;
  saving: boolean;
  onRefresh: () => void;
  onApply: () => void;
}) {
  const issueCount = reconciliation?.issueCount ?? reconciliation?.detectedIssues ?? reconciliation?.issues.length ?? 0;
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{language === "ar" ? "العقود النشطة هي مصدر الإشغال" : "Active leases are the occupancy source of truth"}</p>
        <h2>{language === "ar" ? "مطابقة الإشغال" : "Occupancy reconciliation"}</h2>
      </div>
      <p>{issueCount === 0 ? (language === "ar" ? "لا توجد تناقضات مكتشفة." : "No occupancy inconsistencies detected.") : `${issueCount} ${language === "ar" ? "مشكلة تحتاج مراجعة" : "issues require review"}`}</p>
      <div className="pms-action-row">
        <button className="button-link" type="button" disabled={saving} onClick={onRefresh}>{language === "ar" ? "إعادة الفحص" : "Run check"}</button>
        <button className="button-link button-link--primary" type="button" disabled={!canApply || saving || issueCount === 0} onClick={onApply}>{language === "ar" ? "إصلاح حالات الوحدات" : "Repair unit occupancy"}</button>
      </div>
      {reconciliation?.issues.slice(0, 10).map((issue, index) => (
        <div className="pms-detail-list" key={`${issue.type}-${issue.unitId}-${index}`}>
          <span><strong>{formatStatusText(issue.type)}</strong> · {issue.unitNumber}</span>
        </div>
      ))}
    </section>
  );
}

function AccountingLedgerTable({
  copy,
  entries,
  language,
}: {
  copy: PmsCopy;
  entries: PmsAccountingLedgerEntry[];
  language: "en" | "ar";
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.accounting}</p>
        <h2>{copy.accountingLedger}</h2>
      </div>
      {entries.length === 0 ? <p>{copy.emptyReports}</p> : null}
      {entries.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.transactionDate}</th>
                <th>{copy.ledgerEntryType}</th>
                <th>{copy.category}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.amount}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.transactionDate, language)}</td>
                  <td><StatusBadge status={entry.type} /></td>
                  <td>{entry.category}</td>
                  <td>{entry.property?.name || "—"}</td>
                  <td>{entry.amount} {entry.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ReportsSummaryPanel({
  copy,
  summary,
  language,
}: {
  copy: PmsCopy;
  summary: PmsReportsSummary | null;
  language: "en" | "ar";
}) {
  if (!summary) {
    return <p>{copy.emptyReports}</p>;
  }

  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.reports}</p>
        <h2>{copy.accountingSummary}</h2>
      </div>
      {summary.accounting.currencyState.status === "MIXED" ? (
        <p className="form-error">
          {summary.accounting.currencyState.message ?? (language === "ar" ? "تم تجميع المبالغ حسب العملة ولا يمكن جمعها بأمان." : "Amounts are grouped by currency and cannot be combined safely.")}
        </p>
      ) : null}
      <div className="pms-metric-grid">
        {summary.accounting.totalsByCurrency.map((total) => (
          <article className="pms-metric-card" key={total.currency}>
            <span>{copy.incomeCollected} · {total.currency}</span>
            <strong>{total.incomeCollected} {total.currency}</strong>
            <small>{copy.outstandingRent}: {total.outstandingRent} · {copy.overdueAmount}: {total.overdueRent}</small>
            <small>{copy.maintenanceCosts}: {total.maintenanceCosts} · {copy.expenses}: {total.expenses}</small>
          </article>
        ))}
        <article className="pms-metric-card">
          <span>{copy.occupancyReport}</span>
          <strong>{formatPercent(summary.reports.occupancy.occupancyRate, language)}</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.inspections}</span>
          <strong>{formatNumber(summary.reports.inspections.needsAction, language)}</strong>
        </article>
      </div>
      <div className="pms-detail-list">
        <span>{copy.lateFeeFoundation}: <strong>{summary.accounting.lateFeeNote}</strong></span>
        <span>{copy.maintenanceRequests}: <strong>{formatNumber(summary.reports.maintenance.open + summary.reports.maintenance.inProgress, language)}</strong></span>
        <span>{copy.communications}: <strong>{formatNumber(summary.reports.communications.activeTemplates, language)}</strong></span>
        <span>{copy.policies}: <strong>{formatNumber(summary.reports.policies.activePolicies, language)}</strong></span>
      </div>
      {summary.reports.overdueTopList.length > 0 ? (
        <div className="pms-table-scroll">
          <h3>{copy.overdueTopList}</h3>
          <table className="pms-table">
            <tbody>
              {summary.reports.overdueTopList.map((item) => (
                <tr key={item.id}>
                  <td>{item.tenant.fullName}</td>
                  <td>{item.unit.unitNumber}</td>
                  <td>{formatDate(item.dueDate, language)}</td>
                  <td>{item.amount} {item.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {summary.reports.leaseRenewals.length > 0 ? (
        <div className="pms-table-scroll">
          <h3>{copy.leaseRenewals}</h3>
          <table className="pms-table">
            <tbody>
              {summary.reports.leaseRenewals.map((lease) => (
                <tr key={lease.id}>
                  <td>{lease.tenant.fullName}</td>
                  <td>{lease.unit.unitNumber}</td>
                  <td>{formatDate(lease.endDate, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TemplateFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsCommunicationTemplatePayload;
  setForm: (updater: (current: PmsCommunicationTemplatePayload) => PmsCommunicationTemplatePayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.templateName}
        <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      </label>
      <label>
        {copy.channel}
        <select value={form.channel ?? "EMAIL"} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as PmsCommunicationTemplatePayload["channel"] }))}>
          {(["EMAIL", "WHATSAPP", "SMS", "INTERNAL"] as const).map((channel) => <option key={channel} value={channel}>{channel}</option>)}
        </select>
      </label>
      <label>
        {copy.type}
        <input value={form.type ?? ""} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
      </label>
      <label>
        {copy.subject}
        <input value={form.subject ?? ""} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
      </label>
      <label className="pms-form-grid__wide">
        {copy.body}
        <textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
      </label>
    </div>
  );
}

function PolicyFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsPolicyPayload;
  setForm: (updater: (current: PmsPolicyPayload) => PmsPolicyPayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.policyTitle}
        <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label>
        {copy.category}
        <select value={form.category ?? "GENERAL"} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PmsPolicyPayload["category"] }))}>
          {(["GENERAL", "RENT", "MAINTENANCE", "PAYMENT", "MOVE_IN_OUT", "SAFETY"] as const).map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="pms-form-grid__wide">
        {copy.body}
        <textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
      </label>
    </div>
  );
}

function DocumentFields({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
  leases,
  workOrders,
  inspections,
  file,
  onFileChange,
}: {
  copy: PmsCopy;
  form: PmsDocumentPayload;
  setForm: (updater: (current: PmsDocumentPayload) => PmsDocumentPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
  leases: PmsLease[];
  workOrders: PmsWorkOrder[];
  inspections: PmsInspection[];
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const propertyUnits = form.propertyId ? units.filter((unit) => unit.propertyId === form.propertyId) : units;

  return (
    <div className="pms-form-grid">
      <label>
        {copy.documentTitle}
        <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label>
        {copy.documentType}
        <select value={form.type ?? "OTHER"} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PmsDocumentPayload["type"] }))}>
          {pmsDocumentTypes.map((type) => <option key={type} value={type}>{formatStatusText(type)}</option>)}
        </select>
      </label>
      <label>
        {copy.status}
        <select value={form.status ?? "ACTIVE"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PmsDocumentPayload["status"] }))}>
          {pmsDocumentStatuses.map((status) => <option key={status} value={status}>{formatStatusText(status)}</option>)}
        </select>
      </label>
      <label>
        {copy.documentUrl}
        <input
          required
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <small>{file?.name ?? (copy.privateNote || "Private file")}</small>
      </label>
      <label>
        {copy.expiryDate}
        <input type="date" value={form.expiryDate ?? ""} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} />
      </label>
      <label>
        {copy.propertyName}
        <select value={form.propertyId ?? ""} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value, unitId: "" }))}>
          <option value="">—</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select value={form.unitId ?? ""} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}>
          <option value="">—</option>
          {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.tenantName}
        <select value={form.tenantId ?? ""} onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}>
          <option value="">—</option>
          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>)}
        </select>
      </label>
      <label>
        {copy.lease}
        <select value={form.leaseId ?? ""} onChange={(event) => setForm((current) => ({ ...current, leaseId: event.target.value }))}>
          <option value="">—</option>
          {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.title || lease.unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.maintenanceRequests}
        <select value={form.workOrderId ?? ""} onChange={(event) => setForm((current) => ({ ...current, workOrderId: event.target.value }))}>
          <option value="">—</option>
          {workOrders.map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.title}</option>)}
        </select>
      </label>
      <label>
        {copy.inspections}
        <select value={form.inspectionId ?? ""} onChange={(event) => setForm((current) => ({ ...current, inspectionId: event.target.value }))}>
          <option value="">—</option>
          {inspections.map((inspection) => <option key={inspection.id} value={inspection.id}>{inspection.title}</option>)}
        </select>
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </label>
    </div>
  );
}

function InspectionFields({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
  leases,
}: {
  copy: PmsCopy;
  form: PmsInspectionPayload;
  setForm: (updater: (current: PmsInspectionPayload) => PmsInspectionPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
  leases: PmsLease[];
}) {
  const propertyUnits = form.propertyId ? units.filter((unit) => unit.propertyId === form.propertyId) : units;

  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <select required value={form.propertyId} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value, unitId: "" }))}>
          <option value="">—</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select value={form.unitId ?? ""} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}>
          <option value="">—</option>
          {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.tenantName}
        <select value={form.tenantId ?? ""} onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}>
          <option value="">—</option>
          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>)}
        </select>
      </label>
      <label>
        {copy.lease}
        <select value={form.leaseId ?? ""} onChange={(event) => setForm((current) => ({ ...current, leaseId: event.target.value }))}>
          <option value="">—</option>
          {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.title || lease.unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.inspectionTitle}
        <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label>
        {copy.status}
        <select value={form.status ?? "SCHEDULED"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PmsInspectionPayload["status"] }))}>
          {(["SCHEDULED", "COMPLETED", "NEEDS_ACTION", "CANCELLED"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label>
        {copy.scheduledFor}
        <input type="date" value={form.scheduledFor ?? ""} onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} />
      </label>
      <label>
        {copy.rating}
        <input type="number" min="1" max="5" value={form.rating ?? ""} onChange={(event) => setForm((current) => ({ ...current, rating: numberOrNull(event.target.value) }))} />
      </label>
      <label className="pms-form-grid__wide">
        {copy.feedback}
        <textarea value={form.feedback ?? ""} onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.value }))} />
      </label>
    </div>
  );
}

function PmsRentReceiptPanel({
  copy,
  receipt,
  language,
}: {
  copy: PmsCopy;
  receipt: PmsRentReceipt;
  language: "en" | "ar";
}) {
  return (
    <section className="pms-next-actions pms-receipt-panel">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.printableReceipt}</p>
        <h2>{receipt.receiptNumber || copy.printableReceipt}</h2>
      </div>
      <div className="pms-detail-list">
        <span>{copy.tenantName}: <strong>{receipt.tenant?.fullName || "—"}</strong></span>
        <span>{copy.propertyName}: <strong>{receipt.property.name}</strong></span>
        <span>{copy.unitNumber}: <strong>{receipt.unit.unitNumber}</strong></span>
        <span>{copy.amount}: <strong>{receipt.amount} {receipt.currency}</strong></span>
        <span>{copy.paymentMethod}: <strong>{receipt.method}</strong></span>
        <span>{copy.paymentReference}: <strong>{receipt.referenceNumber || receipt.providerReference || "—"}</strong></span>
        <span>{copy.dueDate}: <strong>{formatDate(receipt.rentDueItem.dueDate, language)}</strong></span>
      </div>
      <button className="button-link button-link--secondary" type="button" onClick={() => window.print()}>
        {copy.printReceipt}
      </button>
    </section>
  );
}

function RentDueTable({
  copy,
  items,
  language,
  canCollect,
  saving,
  onMarkPaid,
}: {
  copy: PmsCopy;
  items: PmsRentDueItem[];
  language: "en" | "ar";
  canCollect: boolean;
  saving: boolean;
  onMarkPaid: (item: PmsRentDueItem) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.accounting}</p>
        <h2>{copy.rentCollection}</h2>
      </div>
      {items.length === 0 ? <p>{copy.emptyRentDue}</p> : null}
      {items.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.dueDate}</th>
                <th>{copy.tenantName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.amount}</th>
                <th>{copy.paidAmount}</th>
                <th>{copy.status}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.dueDate, language)}</td>
                  <td>{item.tenant.fullName}</td>
                  <td>{item.unit.unitNumber}</td>
                  <td>{item.amount} {item.currency}</td>
                  <td>{item.paidAmount} {item.currency}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={!canCollect || saving || item.status === "PAID"}
                      onClick={() => void onMarkPaid(item)}
                    >
                      {copy.markPaid}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
