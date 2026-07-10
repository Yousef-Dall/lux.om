import type { PmsMemberRole } from "@prisma/client";

import { AppError } from "../utils/http";

export type PmsPermissionKeyLike =
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
  | "IMPORT_EXPORT"
  | "CRM_VIEW"
  | "CRM_MANAGE";

export const DEFAULT_PMS_ROLE_PERMISSIONS: Record<PmsMemberRole, PmsPermissionKeyLike[]> = {
  PMS_OWNER: [
    "INVENTORY_VIEW",
    "INVENTORY_MANAGE",
    "TENANCY_VIEW",
    "TENANCY_MANAGE",
    "RENT_VIEW",
    "RENT_MANAGE",
    "ACCOUNTING_VIEW",
    "ACCOUNTING_MANAGE",
    "MAINTENANCE_VIEW",
    "MAINTENANCE_MANAGE",
    "REPORTS_VIEW",
    "SETTINGS_MANAGE",
    "COMMUNICATIONS_SEND",
    "DOCUMENTS_VIEW",
    "DOCUMENTS_MANAGE",
    "STAFF_MANAGE",
    "IMPORT_EXPORT",
    "CRM_VIEW",
    "CRM_MANAGE",
  ],
  PMS_MANAGER: [
    "INVENTORY_VIEW",
    "INVENTORY_MANAGE",
    "TENANCY_VIEW",
    "TENANCY_MANAGE",
    "RENT_VIEW",
    "RENT_MANAGE",
    "ACCOUNTING_VIEW",
    "ACCOUNTING_MANAGE",
    "MAINTENANCE_VIEW",
    "MAINTENANCE_MANAGE",
    "REPORTS_VIEW",
    "SETTINGS_MANAGE",
    "COMMUNICATIONS_SEND",
    "DOCUMENTS_VIEW",
    "DOCUMENTS_MANAGE",
    "IMPORT_EXPORT",
    "CRM_VIEW",
    "CRM_MANAGE",
  ],
  PMS_ACCOUNTANT: [
    "TENANCY_VIEW",
    "RENT_VIEW",
    "RENT_MANAGE",
    "ACCOUNTING_VIEW",
    "ACCOUNTING_MANAGE",
    "REPORTS_VIEW",
    "COMMUNICATIONS_SEND",
    "DOCUMENTS_VIEW",
  ],
  PMS_MAINTENANCE: [
    "MAINTENANCE_VIEW",
    "MAINTENANCE_MANAGE",
    "COMMUNICATIONS_SEND",
    "DOCUMENTS_VIEW",
  ],
  PMS_AGENT: [
    "INVENTORY_VIEW",
    "INVENTORY_MANAGE",
    "TENANCY_VIEW",
    "TENANCY_MANAGE",
    "MAINTENANCE_VIEW",
    "MAINTENANCE_MANAGE",
    "REPORTS_VIEW",
    "DOCUMENTS_VIEW",
    "CRM_VIEW",
    "CRM_MANAGE",
  ],
  PMS_VIEWER: [
    "INVENTORY_VIEW",
    "TENANCY_VIEW",
    "RENT_VIEW",
    "ACCOUNTING_VIEW",
    "MAINTENANCE_VIEW",
    "REPORTS_VIEW",
    "DOCUMENTS_VIEW",
  ],
};

export type PmsPermissionSubject =
  | PmsMemberRole
  | {
      role: PmsMemberRole;
      permissionKeys?: readonly string[];
    };

export function getDefaultPmsPermissionKeys(role: PmsMemberRole) {
  return DEFAULT_PMS_ROLE_PERMISSIONS[role];
}

export function getPmsPermissionKeys(subject: PmsPermissionSubject): readonly string[] {
  return typeof subject === "string"
    ? getDefaultPmsPermissionKeys(subject)
    : subject.permissionKeys ?? getDefaultPmsPermissionKeys(subject.role);
}

export function hasPmsPermission(
  subject: PmsPermissionSubject,
  permission: PmsPermissionKeyLike,
) {
  return getPmsPermissionKeys(subject).includes(permission);
}

export function assertHasPmsPermission(
  subject: PmsPermissionSubject,
  permission: PmsPermissionKeyLike,
  message: string,
) {
  if (!hasPmsPermission(subject, permission)) {
    throw new AppError(403, message);
  }
}


export function canViewCrm(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "CRM_VIEW");
}

export function assertCanViewCrm(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "CRM_VIEW",
    "Your workspace access cannot view CRM records.",
  );
}

export function canManageCrm(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "CRM_MANAGE");
}

export function assertCanManageCrm(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "CRM_MANAGE",
    "Your workspace access can view CRM records but cannot change them.",
  );
}

export function canManagePmsInventory(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "INVENTORY_MANAGE");
}

export function assertCanManagePmsInventory(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "INVENTORY_MANAGE",
    "Your PMS access can view inventory but cannot change it.",
  );
}

export function canManagePmsTenancies(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "TENANCY_MANAGE");
}

export function assertCanManagePmsTenancies(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "TENANCY_MANAGE",
    "Your PMS access can view tenancy records but cannot change them.",
  );
}

export function canViewPmsRent(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "RENT_VIEW");
}

export function assertCanViewPmsRent(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "RENT_VIEW",
    "Your PMS access cannot view rent collection records.",
  );
}

export function canCollectPmsRent(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "RENT_MANAGE");
}

export function assertCanCollectPmsRent(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "RENT_MANAGE",
    "Your PMS access cannot update rent collection records.",
  );
}

export function canViewPmsAccounting(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "ACCOUNTING_VIEW");
}

export function assertCanViewPmsAccounting(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "ACCOUNTING_VIEW",
    "Your PMS access cannot view accounting records.",
  );
}

export function canManagePmsAccounting(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "ACCOUNTING_MANAGE");
}

export function assertCanManagePmsAccounting(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "ACCOUNTING_MANAGE",
    "Your PMS access can view accounting records but cannot change them.",
  );
}

export function canViewPmsMaintenance(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "MAINTENANCE_VIEW");
}

export function assertCanViewPmsMaintenance(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "MAINTENANCE_VIEW",
    "Your PMS access cannot view maintenance records.",
  );
}

export function canManagePmsMaintenance(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "MAINTENANCE_MANAGE");
}

export function assertCanManagePmsMaintenance(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "MAINTENANCE_MANAGE",
    "Your PMS access can view maintenance records but cannot change them.",
  );
}

export function canViewPmsReports(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "REPORTS_VIEW");
}

export function assertCanViewPmsReports(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "REPORTS_VIEW",
    "Your PMS access cannot view reports.",
  );
}

export function canManagePmsOperations(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "SETTINGS_MANAGE");
}

export function assertCanManagePmsOperations(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "SETTINGS_MANAGE",
    "Your PMS access can view operational settings but cannot change them.",
  );
}

export function canViewPmsDocuments(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "DOCUMENTS_VIEW");
}

export function assertCanViewPmsDocuments(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "DOCUMENTS_VIEW",
    "Your PMS access cannot view document records.",
  );
}

export function canManagePmsDocuments(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "DOCUMENTS_MANAGE");
}

export function assertCanManagePmsDocuments(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "DOCUMENTS_MANAGE",
    "Your PMS access can view documents but cannot manage them.",
  );
}

export function canManagePmsMaintenanceDocuments(subject: PmsPermissionSubject) {
  return (
    hasPmsPermission(subject, "MAINTENANCE_MANAGE") &&
    hasPmsPermission(subject, "DOCUMENTS_VIEW")
  );
}

export function assertCanManagePmsMaintenanceDocuments(subject: PmsPermissionSubject) {
  if (!canManagePmsMaintenanceDocuments(subject)) {
    throw new AppError(
      403,
      "Your PMS access cannot manage maintenance documents.",
    );
  }
}

export function canViewPmsCommunications(subject: PmsPermissionSubject) {
  // Communication history is workspace context, while sending is the
  // privileged action. Keep read access available to every active PMS role.
  return getPmsPermissionKeys(subject).length > 0;
}

export function assertCanViewPmsCommunications(subject: PmsPermissionSubject) {
  if (!canViewPmsCommunications(subject)) {
    throw new AppError(403, "Your PMS access cannot view communication records.");
  }
}

export function canSendPmsCommunication(
  subject: PmsPermissionSubject,
  context?: "rent" | "maintenance" | "general",
) {
  if (!hasPmsPermission(subject, "COMMUNICATIONS_SEND")) return false;

  const role = typeof subject === "string" ? subject : subject.role;
  if (role === "PMS_ACCOUNTANT") return context === "rent";
  if (role === "PMS_MAINTENANCE") return context === "maintenance";
  return true;
}

export function assertCanSendPmsCommunication(
  subject: PmsPermissionSubject,
  context?: "rent" | "maintenance" | "general",
) {
  if (!canSendPmsCommunication(subject, context)) {
    throw new AppError(403, "Your PMS access cannot send this communication.");
  }
}

export function canManagePmsImports(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "IMPORT_EXPORT");
}

export function assertCanManagePmsImports(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "IMPORT_EXPORT",
    "Your PMS access cannot import bulk PMS records.",
  );
}

export function canExportPmsData(
  subject: PmsPermissionSubject,
  type?:
    | "properties"
    | "units"
    | "tenants"
    | "leases"
    | "rent_roll"
    | "maintenance"
    | "accounting",
) {
  if (!type) return hasPmsPermission(subject, "IMPORT_EXPORT");

  const role = typeof subject === "string" ? subject : subject.role;
  if (role === "PMS_AGENT") return true;
  if (role === "PMS_VIEWER" && type === "accounting") return false;

  const requiredPermission: Record<NonNullable<typeof type>, PmsPermissionKeyLike> = {
    properties: "INVENTORY_VIEW",
    units: "INVENTORY_VIEW",
    tenants: "TENANCY_VIEW",
    leases: "TENANCY_VIEW",
    rent_roll: "RENT_VIEW",
    maintenance: "MAINTENANCE_VIEW",
    accounting: "ACCOUNTING_VIEW",
  };

  return hasPmsPermission(subject, requiredPermission[type]);
}

export function assertCanExportPmsData(
  subject: PmsPermissionSubject,
  type?:
    | "properties"
    | "units"
    | "tenants"
    | "leases"
    | "rent_roll"
    | "maintenance"
    | "accounting",
) {
  if (!canExportPmsData(subject, type)) {
    throw new AppError(403, "Your PMS access cannot export this data.");
  }
}

export function canManagePmsStaff(subject: PmsPermissionSubject) {
  return hasPmsPermission(subject, "STAFF_MANAGE");
}

export function assertCanManagePmsStaff(subject: PmsPermissionSubject) {
  assertHasPmsPermission(
    subject,
    "STAFF_MANAGE",
    "Your PMS access cannot manage staff access.",
  );
}
