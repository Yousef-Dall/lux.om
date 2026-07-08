import type { PmsMemberRole } from "@prisma/client";

import { AppError } from "../utils/http";

export function canManagePmsInventory(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT";
}

export function assertCanManagePmsInventory(role: PmsMemberRole) {
  if (!canManagePmsInventory(role)) {
    throw new AppError(
      403,
      "Your PMS role can view inventory but cannot change it."
    );
  }
}

export function canManagePmsTenancies(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT";
}

export function assertCanManagePmsTenancies(role: PmsMemberRole) {
  if (!canManagePmsTenancies(role)) {
    throw new AppError(
      403,
      "Your PMS role can view tenancy records but cannot change them."
    );
  }
}

export function canCollectPmsRent(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT"
  );
}

export function assertCanCollectPmsRent(role: PmsMemberRole) {
  if (!canCollectPmsRent(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot update rent collection records."
    );
  }
}

export function canViewPmsAccounting(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT" ||
    role === "PMS_VIEWER"
  );
}

export function assertCanViewPmsAccounting(role: PmsMemberRole) {
  if (!canViewPmsAccounting(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot view accounting records."
    );
  }
}

export function canManagePmsAccounting(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT"
  );
}

export function assertCanManagePmsAccounting(role: PmsMemberRole) {
  if (!canManagePmsAccounting(role)) {
    throw new AppError(
      403,
      "Your PMS role can view accounting records but cannot change them."
    );
  }
}

export function canManagePmsMaintenance(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_MAINTENANCE" ||
    role === "PMS_AGENT"
  );
}

export function assertCanManagePmsMaintenance(role: PmsMemberRole) {
  if (!canManagePmsMaintenance(role)) {
    throw new AppError(
      403,
      "Your PMS role can view maintenance records but cannot change them."
    );
  }
}

export function canManagePmsOperations(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER";
}

export function assertCanManagePmsOperations(role: PmsMemberRole) {
  if (!canManagePmsOperations(role)) {
    throw new AppError(
      403,
      "Your PMS role can view operational settings but cannot change them."
    );
  }
}


export function canViewPmsDocuments(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT" ||
    role === "PMS_MAINTENANCE" ||
    role === "PMS_AGENT" ||
    role === "PMS_VIEWER"
  );
}

export function assertCanViewPmsDocuments(role: PmsMemberRole) {
  if (!canViewPmsDocuments(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot view document records."
    );
  }
}

export function canManagePmsDocuments(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER";
}

export function assertCanManagePmsDocuments(role: PmsMemberRole) {
  if (!canManagePmsDocuments(role)) {
    throw new AppError(
      403,
      "Your PMS role can view documents but cannot manage them."
    );
  }
}

export function canManagePmsMaintenanceDocuments(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_MAINTENANCE"
  );
}

export function assertCanManagePmsMaintenanceDocuments(role: PmsMemberRole) {
  if (!canManagePmsMaintenanceDocuments(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot manage maintenance documents."
    );
  }
}

export function canViewPmsCommunications(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT" ||
    role === "PMS_MAINTENANCE" ||
    role === "PMS_AGENT" ||
    role === "PMS_VIEWER"
  );
}

export function assertCanViewPmsCommunications(role: PmsMemberRole) {
  if (!canViewPmsCommunications(role)) {
    throw new AppError(403, "Your PMS role cannot view communication records.");
  }
}

export function canSendPmsCommunication(
  role: PmsMemberRole,
  context?: "rent" | "maintenance" | "general",
) {
  if (role === "PMS_OWNER" || role === "PMS_MANAGER") return true;
  if (role === "PMS_ACCOUNTANT") return context === "rent";
  if (role === "PMS_MAINTENANCE") return context === "maintenance";
  return false;
}

export function assertCanSendPmsCommunication(
  role: PmsMemberRole,
  context?: "rent" | "maintenance" | "general",
) {
  if (!canSendPmsCommunication(role, context)) {
    throw new AppError(
      403,
      "Your PMS role cannot send this communication."
    );
  }
}

export function canManagePmsImports(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER";
}

export function assertCanManagePmsImports(role: PmsMemberRole) {
  if (!canManagePmsImports(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot import bulk PMS records."
    );
  }
}

export function canExportPmsData(
  role: PmsMemberRole,
  type?: "properties" | "units" | "tenants" | "leases" | "rent_roll" | "maintenance" | "accounting",
) {
  if (role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT") return true;
  if (role === "PMS_VIEWER") return type !== "accounting";
  if (role === "PMS_ACCOUNTANT") return type === "rent_roll" || type === "accounting" || type === "leases" || type === "tenants";
  if (role === "PMS_MAINTENANCE") return type === "maintenance";
  return false;
}

export function assertCanExportPmsData(
  role: PmsMemberRole,
  type?: "properties" | "units" | "tenants" | "leases" | "rent_roll" | "maintenance" | "accounting",
) {
  if (!canExportPmsData(role, type)) {
    throw new AppError(
      403,
      "Your PMS role cannot export this data."
    );
  }
}

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
  | "IMPORT_EXPORT";

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

export function getDefaultPmsPermissionKeys(role: PmsMemberRole) {
  return DEFAULT_PMS_ROLE_PERMISSIONS[role];
}

export function canManagePmsStaff(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER";
}

export function assertCanManagePmsStaff(role: PmsMemberRole) {
  if (!canManagePmsStaff(role)) {
    throw new AppError(403, "Your PMS role cannot manage staff access.");
  }
}
