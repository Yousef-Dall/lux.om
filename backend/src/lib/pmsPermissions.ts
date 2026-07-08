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
