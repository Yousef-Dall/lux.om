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
