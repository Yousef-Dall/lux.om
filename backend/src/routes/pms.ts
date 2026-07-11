import {
  AccountSecurityEventType,
  EmailDeliveryStatus,
  NotificationType,
  PaymentScheduleFrequency,
  PmsAccountingEntryType,
  PmsAccountingSource,
  PmsCommunicationChannel,
  PmsCommunicationLogStatus,
  PmsDocumentScanStatus,
  PmsDocumentStatus,
  PmsDocumentStorageDriver,
  PmsDocumentType,
  PmsEntitlementStatus,
  PmsImportStatus,
  PmsImportType,
  PmsInspectionStatus,
  PmsLeaseStatus,
  PmsOwnerStatementStatus,
  PmsMoveChecklistStatus,
  PmsMoveChecklistType,
  PmsMaintenancePriority,
  PmsMaintenanceQuoteStatus,
  PmsMaintenanceRecurrenceType,
  PmsMaintenanceStatus,
  PmsMemberRole,
  PmsPermissionKey,
  PmsOccupancyStatus,
  PmsPolicyCategory,
  PmsRentDueStatus,
  PmsRentPaymentMethod,
  PmsRentPaymentStatus,
  PmsUnitOperationalStatus,
  PmsUnitStatus,
  DomainAuditDomain,
  DomainAuditOrigin,
  Prisma,
} from "@prisma/client";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";

import { recordAccountSecurityEvent } from "../lib/accountSecurityEvents";
import { prisma } from "../lib/prisma";
import {
  ACTIVE_PMS_ENTITLEMENT_STATUSES,
  resolvePmsWorkspaceAccess,
  type PmsWorkspaceAccess,
} from "../modules/pms/access";
import {
  assertCanCollectPmsRent,
  assertCanViewPmsRent,
  assertCanManagePmsAccounting,
  assertCanExportPmsData,
  assertCanManagePmsDocuments,
  assertCanManagePmsImports,
  assertCanManagePmsStaff,
  getDefaultPmsPermissionKeys,
  assertCanManagePmsMaintenanceDocuments,
  assertCanManagePmsInventory,
  assertCanViewPmsAccounting,
  assertCanViewPmsReports,
  assertCanManagePmsMaintenance,
  assertCanViewPmsMaintenance,
  assertCanManagePmsOperations,
  assertCanSendPmsCommunication,
  canSendPmsCommunication,
  assertCanViewPmsCommunications,
  assertCanManagePmsTenancies,
  assertCanViewPmsDocuments,
  canViewPmsSensitiveData,
  assertCanViewPmsSensitiveData,
  assertCanExportPmsSensitiveData,
} from "../modules/pms/access";
import {
  assertCanApplyRentPayment,
  createPmsRentReceiptNumber,
  decimalToNumber as rentDecimalToNumber,
  getPaidRentStatus,
  roundMoney,
} from "../lib/pmsRentPayments";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { AppError } from "../utils/http";
import { env, maxPmsDocumentBytes } from "../config/env";
import { recordDomainAuditEvent, requestAuditContext } from "../lib/domainAudit";
import { getLocalUploadDirectory } from "../storage/imageStorage";
import {
  importLegacyLocalPmsDocument,
  readPrivatePmsDocument,
  removePrivatePmsDocument,
  restoreLegacyLocalPmsDocument,
  storePrivatePmsDocument,
  supportedPrivateDocumentMimeTypes,
} from "../storage/privatePmsDocumentStorage";
import { pmsFinanceRouter } from "../modules/pms/finance/router";
import { pmsAssetsRouter } from "../modules/pms/assets/router";
import { pmsPreventiveMaintenanceRouter } from "../modules/pms/maintenance/router";
import { pmsStructuredInspectionsRouter } from "../modules/pms/inspections/router";
import { pmsPortalAccessRouter } from "../modules/pms/portals/managementRouter";
import { assertFinancialPeriodOpen } from "../modules/pms/finance/periods";
import {
  allocateLegacyRentPayment,
  ensureLeaseSecurityDepositAccount,
  ensureRentDueStructuredCharge,
} from "../modules/pms/finance/compatibility";
import {
  averageHealthScore,
  buildHealthSignal,
  documentRiskScore,
  leaseExpiryRiskScore,
  maintenanceRiskScore,
  priorityFromScore,
  priorityRank,
  rentRiskScore,
  type PmsCommandPriority,
} from "../lib/pmsOperationalIntelligence";

export const pmsRouter = Router();

pmsRouter.use("/accounting", pmsFinanceRouter);
pmsRouter.use("/assets", pmsAssetsRouter);
pmsRouter.use("/preventive-maintenance", pmsPreventiveMaintenanceRouter);
pmsRouter.use("/structured-inspections", pmsStructuredInspectionsRouter);
pmsRouter.use("/portal-access", pmsPortalAccessRouter);

function isPrismaErrorCode(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

const PMS_ACCOUNTING_INCOME_ENTRY_TYPES = new Set<PmsAccountingEntryType>([
  PmsAccountingEntryType.INCOME,
  PmsAccountingEntryType.LATE_FEE,
  PmsAccountingEntryType.DEPOSIT,
  PmsAccountingEntryType.ADJUSTMENT,
]);

const PMS_ACCOUNTING_EXPENSE_ENTRY_TYPES = new Set<PmsAccountingEntryType>([
  PmsAccountingEntryType.EXPENSE,
  PmsAccountingEntryType.REFUND,
]);

const PMS_OWNER_STATEMENT_REVIEW_STATUSES = new Set<PmsOwnerStatementStatus>([
  PmsOwnerStatementStatus.DRAFT,
  PmsOwnerStatementStatus.GENERATED,
  PmsOwnerStatementStatus.NEEDS_REVIEW,
]);

const privatePmsDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPmsDocumentBytes, files: 1, fields: 30 },
  fileFilter: (_req, file, callback) => {
    if (!supportedPrivateDocumentMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, "Private PMS documents must be PDF, JPG, PNG, or WEBP."));
      return;
    }
    callback(null, true);
  },
});

function privatePmsDocumentUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  privatePmsDocumentUpload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(400, `Private PMS document exceeds the ${env.MAX_PMS_DOCUMENT_MB}MB limit.`));
        return;
      }
      next(new AppError(400, error.message));
      return;
    }
    next(error);
  });
}

const idParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const companyParamsSchema = z.object({
  companyId: z.string().trim().min(1),
});

const pmsOverviewQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
});

const pmsDomainAuditQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  domain: z.enum(["ALL", ...Object.values(DomainAuditDomain)] as ["ALL", ...DomainAuditDomain[]]).default(DomainAuditDomain.PMS),
  entityType: z.string().trim().max(120).optional(),
  entityId: z.string().trim().max(200).optional(),
  action: z.string().trim().max(160).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsCommandPrioritySchema = z.enum(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const pmsCommandStatusSchema = z.enum(["ALL", "OPEN", "OVERDUE", "UPCOMING", "NEEDS_REVIEW"]);
const pmsAutomationTypeSchema = z.enum([
  "RENT_DUE_SOON",
  "OVERDUE_RENT",
  "LEASE_EXPIRY",
  "MAINTENANCE_STATUS",
  "DOCUMENT_EXPIRY",
]);

const pmsCommandCenterQuerySchema = z
  .object({
    companyId: z.string().trim().min(1).optional(),
    propertyId: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    riskWindowDays: z.coerce.number().int().min(7).max(180).default(60),
    status: pmsCommandStatusSchema.default("ALL"),
    priority: pmsCommandPrioritySchema.default("ALL"),
    take: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: "dateFrom must be before or equal to dateTo.",
    path: ["dateTo"],
  });

const pmsAutomationRunSchema = z
  .object({
    companyId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1).optional(),
    type: pmsAutomationTypeSchema,
    days: z.coerce.number().int().min(1).max(180).default(30),
    take: z.coerce.number().int().min(1).max(50).default(25),
    dryRun: z.boolean().default(true),
  })
  .strict();

const pmsPropertyListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "name", "city", "active"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsUnitListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsUnitStatus)] as [
      "ALL",
      ...PmsUnitStatus[],
    ])
    .default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "unitNumber", "status", "rentAmount", "areaSqm"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const queryBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return value;
}, z.boolean());

const pmsOccupancyReconciliationQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  apply: queryBoolean.default(false),
});

const pmsPropertyParamsSchema = z.object({
  propertyId: z.string().trim().min(1),
});

const pmsUnitParamsSchema = z.object({
  unitId: z.string().trim().min(1),
});

const nullableTrimmedString = (max = 500) =>
  z.string().trim().max(max).optional().nullable();
const nullableId = z.string().trim().min(1).optional().nullable();
const nullableLatitude = z.coerce
  .number()
  .min(-90)
  .max(90)
  .optional()
  .nullable();
const nullableLongitude = z.coerce
  .number()
  .min(-180)
  .max(180)
  .optional()
  .nullable();

const pmsPropertyCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    name: z.string().trim().min(2).max(180),
    code: nullableTrimmedString(80),
    propertyType: nullableTrimmedString(80),
    description: nullableTrimmedString(2000),
    addressLine: nullableTrimmedString(240),
    city: nullableTrimmedString(120),
    area: nullableTrimmedString(120),
    notes: nullableTrimmedString(2000),
    active: z.boolean().default(true),
    mapPlaceLabel: nullableTrimmedString(180),
    mapAddress: nullableTrimmedString(260),
    mapGoogleUrl: nullableTrimmedString(600),
    latitude: nullableLatitude,
    longitude: nullableLongitude,
    developerProjectId: nullableId,
    publicListingId: nullableId,
  })
  .strict();

const pmsPropertyUpdateSchema = pmsPropertyCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS property field is required.",
  });

const pmsUnitCreateSchema = z
  .object({
    unitNumber: z.string().trim().min(1).max(80),
    unitName: nullableTrimmedString(160),
    floor: nullableTrimmedString(40),
    bedrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
    bathrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
    areaSqm: z.coerce.number().int().min(0).max(200000).optional().nullable(),
    status: z.nativeEnum(PmsUnitStatus).default(PmsUnitStatus.VACANT),
    occupancyStatus: z.nativeEnum(PmsOccupancyStatus).optional().nullable(),
    operationalStatus: z.nativeEnum(PmsUnitOperationalStatus).optional(),
    rentAmount: z.coerce.number().min(0).max(100000000).optional().nullable(),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    notes: nullableTrimmedString(2000),
    developerProjectId: nullableId,
    publicListingId: nullableId,
  })
  .strict();

const pmsUnitUpdateSchema = pmsUnitCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS unit field is required.",
  });

const pmsTenantListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "fullName", "active"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsLeaseListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsLeaseStatus)] as [
      "ALL",
      ...PmsLeaseStatus[],
    ])
    .default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "startDate", "endDate", "rentAmount", "status"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsRentDueListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsRentDueStatus)] as [
      "ALL",
      ...PmsRentDueStatus[],
    ])
    .default("ALL"),
  sortBy: z.enum(["dueDate", "updatedAt", "createdAt", "amount", "paidAmount", "status"]).optional(),
  direction: z.enum(["asc", "desc"]).default("asc"),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsTenantParamsSchema = z.object({
  tenantId: z.string().trim().min(1),
});

const pmsLeaseParamsSchema = z.object({
  leaseId: z.string().trim().min(1),
});

const pmsRentDueParamsSchema = z.object({
  rentDueItemId: z.string().trim().min(1),
});

const pmsRentPaymentParamsSchema = z.object({
  rentPaymentId: z.string().trim().min(1),
});

const pmsAccountingLedgerParamsSchema = z.object({
  ledgerEntryId: z.string().trim().min(1),
});

const pmsAccountingQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  rentDueItemId: z.string().trim().min(1).optional(),
  workOrderId: z.string().trim().min(1).optional(),
  type: z.enum(["ALL", ...Object.values(PmsAccountingEntryType)] as [
    "ALL",
    ...PmsAccountingEntryType[],
  ]).default("ALL"),
  category: z.string().trim().max(120).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["transactionDate", "createdAt", "updatedAt", "amount", "type", "category"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsAccountingStatementQuerySchema = pmsAccountingQuerySchema
  .pick({ companyId: true, propertyId: true, unitId: true, dateFrom: true, dateTo: true })
  .extend({
    month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
  });

const pmsOwnerStatementParamsSchema = z.object({
  statementId: z.string().trim().min(1),
});

const pmsOwnerStatementListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  status: z.enum(["ALL", ...Object.values(PmsOwnerStatementStatus)] as ["ALL", ...PmsOwnerStatementStatus[]]).default("ALL"),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsOwnerStatementCreateSchema = z.object({
  companyId: z.string().trim().min(1),
  propertyId: z.string().trim().min(1),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  currency: z.string().trim().length(3).toUpperCase(),
  ownerReference: nullableTrimmedString(180),
  revisionOfId: nullableId,
}).strict().refine((data) => Boolean(data.month || (data.dateFrom && data.dateTo)), {
  message: "Provide a month or both dateFrom and dateTo.",
}).refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
  message: "dateFrom must be before dateTo.",
  path: ["dateTo"],
});

const pmsOwnerStatementTransitionSchema = z.object({
  status: z.nativeEnum(PmsOwnerStatementStatus),
}).strict();

const pmsAccountingLedgerEntrySchema = z
  .object({
    companyId: z.string().trim().min(1),
    propertyId: nullableId,
    unitId: nullableId,
    tenantId: nullableId,
    leaseId: nullableId,
    rentDueItemId: nullableId,
    workOrderId: nullableId,
    type: z.nativeEnum(PmsAccountingEntryType),
    category: z.string().trim().min(2).max(120),
    amount: z.coerce.number().min(0.001).max(100000000),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    transactionDate: z.coerce.date(),
    referenceNumber: nullableTrimmedString(180),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsAccountingLedgerEntryUpdateSchema = pmsAccountingLedgerEntrySchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one accounting ledger field is required.",
  });

const pmsWorkOrderListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  overdue: z.enum(["ALL", "OVERDUE", "NOT_OVERDUE"]).default("ALL"),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsMaintenanceStatus)] as [
      "ALL",
      ...PmsMaintenanceStatus[],
    ])
    .default("ALL"),
  priority: z
    .enum(["ALL", ...Object.values(PmsMaintenancePriority)] as [
      "ALL",
      ...PmsMaintenancePriority[],
    ])
    .default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "scheduledFor", "resolvedAt", "targetDate", "priority", "status", "title", "cost"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsWorkOrderParamsSchema = z.object({
  workOrderId: z.string().trim().min(1),
});

const pmsVendorListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  trade: z.string().trim().max(120).optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "name", "trade", "active"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsVendorParamsSchema = z.object({
  vendorId: z.string().trim().min(1),
});

const pmsVendorCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    name: z.string().trim().min(2).max(180),
    phone: nullableTrimmedString(80),
    email: z.string().trim().email().optional().nullable(),
    trade: nullableTrimmedString(120),
    notes: nullableTrimmedString(2000),
    active: z.boolean().default(true),
  })
  .strict();

const pmsVendorUpdateSchema = pmsVendorCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one vendor field is required.",
  });

const pmsMaintenanceQuoteParamsSchema = z.object({
  quoteId: z.string().trim().min(1),
});

const pmsMaintenanceQuoteCreateSchema = z
  .object({
    vendorId: nullableId,
    amount: z.coerce.number().min(0).max(100000000).default(0),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    description: nullableTrimmedString(4000),
    status: z.nativeEnum(PmsMaintenanceQuoteStatus).default(PmsMaintenanceQuoteStatus.REQUESTED),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsMaintenanceQuoteUpdateSchema = z
  .object({
    vendorId: nullableId.optional(),
    amount: z.coerce.number().min(0).max(100000000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    description: nullableTrimmedString(4000).optional(),
    status: z.nativeEnum(PmsMaintenanceQuoteStatus).optional(),
    notes: nullableTrimmedString(2000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one maintenance quote field is required.",
  });

const pmsCommunicationTemplateListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  channel: z
    .enum(["ALL", ...Object.values(PmsCommunicationChannel)] as [
      "ALL",
      ...PmsCommunicationChannel[],
    ])
    .default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "name", "channel", "active"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsCommunicationTemplateParamsSchema = z.object({
  templateId: z.string().trim().min(1),
});

const pmsPolicyListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  category: z
    .enum(["ALL", ...Object.values(PmsPolicyCategory)] as [
      "ALL",
      ...PmsPolicyCategory[],
    ])
    .default("ALL"),
  sortBy: z.enum(["updatedAt", "createdAt", "title", "category", "active"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsPolicyParamsSchema = z.object({
  policyId: z.string().trim().min(1),
});

const pmsInspectionListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsInspectionStatus)] as [
      "ALL",
      ...PmsInspectionStatus[],
    ])
    .default("ALL"),
  sortBy: z.enum(["scheduledFor", "updatedAt", "createdAt", "title", "status", "rating"]).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsInspectionParamsSchema = z.object({
  inspectionId: z.string().trim().min(1),
});

const pmsDocumentParamsSchema = z.object({
  documentId: z.string().trim().min(1),
});

const pmsChecklistItemParamsSchema = z.object({
  checklistItemId: z.string().trim().min(1),
});

const pmsDocumentFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => value.startsWith('/uploads/'), {
    message: 'Legacy document creation only accepts a local /uploads path; use the private document upload endpoint for new files.',
  });

const pmsDocumentListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  workOrderId: z.string().trim().min(1).optional(),
  inspectionId: z.string().trim().min(1).optional(),
  chargeId: z.string().trim().min(1).optional(),
  securityDepositTransactionId: z.string().trim().min(1).optional(),
  ownerPayoutBatchId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  statementId: z.string().trim().min(1).optional(),
  inspectionDefectId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  type: z.enum(['ALL', ...Object.values(PmsDocumentType)] as ['ALL', ...PmsDocumentType[]]).default('ALL'),
  status: z.enum(['ALL', ...Object.values(PmsDocumentStatus)] as ['ALL', ...PmsDocumentStatus[]]).default('ALL'),
  expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'expiryDate', 'title', 'type', 'status']).optional(),
  direction: z.enum(['asc', 'desc']).default('desc'),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsDocumentCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    propertyId: nullableId,
    unitId: nullableId,
    tenantId: nullableId,
    leaseId: nullableId,
    workOrderId: nullableId,
    inspectionId: nullableId,
    chargeId: nullableId,
    securityDepositTransactionId: nullableId,
    ownerPayoutBatchId: nullableId,
    assetId: nullableId,
    statementId: nullableId,
    inspectionDefectId: nullableId,
    type: z.nativeEnum(PmsDocumentType),
    title: z.string().trim().min(2).max(180),
    fileUrl: pmsDocumentFileSchema,
    status: z.nativeEnum(PmsDocumentStatus).default(PmsDocumentStatus.ACTIVE),
    expiryDate: z.coerce.date().optional().nullable(),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsDocumentUpdateSchema = pmsDocumentCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one PMS document field is required.',
  });

const pmsDocumentUploadMetadataSchema = pmsDocumentCreateSchema.omit({ fileUrl: true });

const pmsDocumentExpiryQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
});

const pmsImportBodySchema = z
  .object({
    companyId: z.string().trim().min(1),
    type: z.nativeEnum(PmsImportType),
    filename: nullableTrimmedString(240),
    csvText: z.string().min(1).max(2_000_000),
  })
  .strict();

const pmsImportBatchListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  type: z.enum(["ALL", ...Object.values(PmsImportType)] as ["ALL", ...PmsImportType[]]).default("ALL"),
  status: z.enum(["ALL", ...Object.values(PmsImportStatus)] as ["ALL", ...PmsImportStatus[]]).default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsImportTypeParamsSchema = z.object({
  type: z.nativeEnum(PmsImportType),
});

const pmsExportTypeParamsSchema = z.object({
  type: z.enum([
    "properties",
    "units",
    "tenants",
    "leases",
    "rent-roll",
    "maintenance",
    "accounting-summary",
  ]),
});

const pmsExportQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  includeSensitive: queryBoolean.default(false),
  sensitiveExportConfirmation: z.string().trim().max(80).optional(),
});

const pmsLeaseRenewalDraftSchema = z
  .object({
    title: nullableTrimmedString(180),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    rentAmount: z.coerce.number().min(0).max(100000000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    securityDeposit: z.coerce.number().min(0).max(100000000).optional().nullable(),
    dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    notes: nullableTrimmedString(2000),
  })
  .strict()
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'Renewal end date must be after the start date.',
  });

const pmsChecklistCreateSchema = z
  .object({
    type: z.nativeEnum(PmsMoveChecklistType),
    title: z.string().trim().min(2).max(180),
    description: nullableTrimmedString(2000),
    status: z.nativeEnum(PmsMoveChecklistStatus).default(PmsMoveChecklistStatus.PENDING),
    completedAt: z.coerce.date().optional().nullable(),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsChecklistUpdateSchema = pmsChecklistCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one move checklist field is required.',
  });

const pmsTenantCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    fullName: z.string().trim().min(2).max(180),
    phone: nullableTrimmedString(80),
    email: z.string().trim().email().optional().nullable(),
    nationality: nullableTrimmedString(120),
    nationalId: nullableTrimmedString(120),
    passportNumber: nullableTrimmedString(120),
    emergencyContactName: nullableTrimmedString(180),
    emergencyContactPhone: nullableTrimmedString(80),
    emergencyContactEmail: z.string().trim().email().optional().nullable(),
    notes: nullableTrimmedString(2000),
    active: z.boolean().default(true),
  })
  .strict();

const pmsTenantUpdateSchema = pmsTenantCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS tenant field is required.",
  });

const pmsTenantPortalAccessUpsertSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    active: z.boolean().default(true),
  })
  .strict()
  .refine((data) => Boolean(data.userId || data.email), {
    path: ["userId"],
    message: "Provide a user id or email for tenant portal access.",
  });

const pmsLeaseCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    tenantId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1),
    unitId: z.string().trim().min(1),
    title: nullableTrimmedString(180),
    status: z.nativeEnum(PmsLeaseStatus).default(PmsLeaseStatus.ACTIVE),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    rentFrequency: z
      .nativeEnum(PaymentScheduleFrequency)
      .default(PaymentScheduleFrequency.MONTHLY),
    rentAmount: z.coerce.number().min(0).max(100000000),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    securityDeposit: z.coerce
      .number()
      .min(0)
      .max(100000000)
      .optional()
      .nullable(),
    dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    contractDraftId: nullableId,
    notes: nullableTrimmedString(2000),
    generateRentDueItems: z.boolean().default(true),
  })
  .strict()
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "Lease end date must be after the start date.",
  });

const pmsLeaseUpdateSchema = z
  .object({
    title: nullableTrimmedString(180),
    status: z.nativeEnum(PmsLeaseStatus).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    rentFrequency: z.nativeEnum(PaymentScheduleFrequency).optional(),
    rentAmount: z.coerce.number().min(0).max(100000000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    securityDeposit: z.coerce
      .number()
      .min(0)
      .max(100000000)
      .optional()
      .nullable(),
    dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    contractDraftId: nullableId,
    notes: nullableTrimmedString(2000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS lease field is required.",
  });

const pmsRentDueUpdateSchema = z
  .object({
    status: z.nativeEnum(PmsRentDueStatus).optional(),
    paidAmount: z.coerce.number().min(0).max(100000000).optional(),
    paidAt: z.coerce.date().optional().nullable(),
    notes: nullableTrimmedString(2000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one rent due item field is required.",
  });

const pmsManualRentPaymentSchema = z
  .object({
    amount: z.coerce.number().min(0.001).max(100000000),
    method: z
      .enum([
        PmsRentPaymentMethod.CASH,
        PmsRentPaymentMethod.BANK_TRANSFER,
        PmsRentPaymentMethod.CHEQUE,
        PmsRentPaymentMethod.CARD_MANUAL,
        PmsRentPaymentMethod.OTHER,
      ] as const)
      .default(PmsRentPaymentMethod.BANK_TRANSFER),
    referenceNumber: nullableTrimmedString(180),
    notes: nullableTrimmedString(2000),
    paidAt: z.coerce.date().optional(),
  })
  .strict();

const nullableUrlList = z
  .array(z.string().trim().url().max(1000))
  .max(20)
  .optional();

const pmsWorkOrderCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1),
    unitId: nullableId,
    tenantId: nullableId,
    vendorId: nullableId,
    title: z.string().trim().min(2).max(180),
    description: nullableTrimmedString(4000),
    priority: z.nativeEnum(PmsMaintenancePriority).default(PmsMaintenancePriority.MEDIUM),
    status: z.nativeEnum(PmsMaintenanceStatus).default(PmsMaintenanceStatus.OPEN),
    assignedToText: nullableTrimmedString(180),
    vendorText: nullableTrimmedString(180),
    cost: z.coerce.number().min(0).max(100000000).optional().nullable(),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    scheduledFor: z.coerce.date().optional().nullable(),
    resolvedAt: z.coerce.date().optional().nullable(),
    targetDate: z.coerce.date().optional().nullable(),
    imageUrls: nullableUrlList,
    documentUrls: nullableUrlList,
    beforeImageUrls: nullableUrlList,
    afterImageUrls: nullableUrlList,
    beforeDocumentUrls: nullableUrlList,
    afterDocumentUrls: nullableUrlList,
    recurrenceType: z.nativeEnum(PmsMaintenanceRecurrenceType).default(PmsMaintenanceRecurrenceType.NONE),
    nextScheduledDate: z.coerce.date().optional().nullable(),
    generatedFromWorkOrderId: nullableId,
    tenantConfirmationNotes: nullableTrimmedString(1000),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsWorkOrderUpdateSchema = pmsWorkOrderCreateSchema
  .omit({ companyId: true, propertyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one work order field is required.",
  });

const pmsCommunicationTemplateCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    name: z.string().trim().min(2).max(180),
    channel: z.nativeEnum(PmsCommunicationChannel).default(PmsCommunicationChannel.EMAIL),
    type: nullableTrimmedString(120),
    subject: nullableTrimmedString(180),
    body: z.string().trim().min(2).max(5000),
    active: z.boolean().default(true),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsCommunicationTemplateUpdateSchema = pmsCommunicationTemplateCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one communication template field is required.",
  });


const pmsCommunicationLogListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(160).optional(),
  channel: z.enum(["ALL", ...Object.values(PmsCommunicationChannel)] as ["ALL", ...PmsCommunicationChannel[]]).default("ALL"),
  status: z.enum(["ALL", ...Object.values(PmsCommunicationLogStatus)] as ["ALL", ...PmsCommunicationLogStatus[]]).default("ALL"),
  tenantId: nullableId,
  leaseId: nullableId,
  rentDueItemId: nullableId,
  workOrderId: nullableId,
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsCommunicationContextSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  templateId: nullableId,
  tenantId: nullableId,
  leaseId: nullableId,
  rentDueItemId: nullableId,
  workOrderId: nullableId,
  channel: z.nativeEnum(PmsCommunicationChannel).optional(),
  subject: nullableTrimmedString(240),
  body: z.string().trim().min(1).max(8000).optional(),
  variables: z.record(z.string(), z.string()).optional(),
}).strict();

const pmsCommunicationSendSchema = pmsCommunicationContextSchema.extend({
  channel: z.nativeEnum(PmsCommunicationChannel),
  body: z.string().trim().min(1).max(8000),
  status: z.nativeEnum(PmsCommunicationLogStatus).default(PmsCommunicationLogStatus.LOGGED),
  notes: nullableTrimmedString(2000),
}).strict();

const pmsReminderCandidateQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  type: pmsAutomationTypeSchema.default("RENT_DUE_SOON"),
  days: z.coerce.number().int().min(1).max(180).default(7),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsPolicyCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(180),
    category: z.nativeEnum(PmsPolicyCategory).default(PmsPolicyCategory.GENERAL),
    body: z.string().trim().min(2).max(8000),
    active: z.boolean().default(true),
    notes: nullableTrimmedString(2000),
  })
  .strict();

const pmsPolicyUpdateSchema = pmsPolicyCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one policy field is required.",
  });

const pmsInspectionCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1),
    unitId: nullableId,
    tenantId: nullableId,
    leaseId: nullableId,
    title: z.string().trim().min(2).max(180),
    status: z.nativeEnum(PmsInspectionStatus).default(PmsInspectionStatus.SCHEDULED),
    scheduledFor: z.coerce.date().optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    notes: nullableTrimmedString(2000),
    feedback: nullableTrimmedString(4000),
    rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  })
  .strict();

const pmsInspectionUpdateSchema = pmsInspectionCreateSchema
  .omit({ companyId: true, propertyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one inspection field is required.",
  });

const adminPmsCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsEntitlementStatus)] as [
      "ALL",
      ...PmsEntitlementStatus[],
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const entitlementUpdateSchema = z
  .object({
    status: z.nativeEnum(PmsEntitlementStatus),
    notes: z.string().trim().max(1000).optional(),
    trialEndsAt: z.coerce.date().optional().nullable(),
  })
  .strict();

const memberUpsertSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    role: z.nativeEnum(PmsMemberRole),
    active: z.boolean().default(true),
  })
  .strict()
  .refine((data) => Boolean(data.userId || data.email), {
    path: ["userId"],
    message: "Provide a user id or email for the PMS member.",
  });

const memberUpdateSchema = z
  .object({
    role: z.nativeEnum(PmsMemberRole).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one member field is required.",
  });


const pmsStaffListQuerySchema = z.object({
  companyId: z.string().trim().min(1),
});

const pmsStaffInviteSchema = z
  .object({
    companyId: z.string().trim().min(1),
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    role: z.nativeEnum(PmsMemberRole),
    active: z.boolean().default(true),
    propertyIds: z.array(z.string().trim().min(1)).max(250).optional(),
    permissionKeys: z.array(z.nativeEnum(PmsPermissionKey)).max(40).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.userId || data.email), {
    path: ["userId"],
    message: "Provide a user id or email for the PMS member.",
  });

const pmsStaffUpdateSchema = z
  .object({
    role: z.nativeEnum(PmsMemberRole).optional(),
    active: z.boolean().optional(),
    propertyIds: z.array(z.string().trim().min(1)).max(250).optional(),
    permissionKeys: z.array(z.nativeEnum(PmsPermissionKey)).max(40).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one staff access field is required.",
  });

const pmsPortfolioListQuerySchema = z.object({
  companyId: z.string().trim().min(1),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
});

const pmsPortfolioCreateSchema = z.object({
  companyId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(160),
  description: nullableTrimmedString(1000),
  active: z.boolean().default(true),
  propertyIds: z.array(z.string().trim().min(1)).max(250).optional(),
}).strict();

const pmsPortfolioUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: nullableTrimmedString(1000),
  active: z.boolean().optional(),
  propertyIds: z.array(z.string().trim().min(1)).max(250).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one portfolio field is required.",
});

const pmsCompanyInclude = {
  pmsEntitlement: true,
  pmsMembers: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          suspendedAt: true,
          deactivatedAt: true,
        },
      },
      propertyAccesses: {
        where: { active: true },
        include: { property: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      permissions: {
        where: { active: true },
        orderBy: { key: "asc" as const },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  _count: {
    select: {
      listings: true,
      projects: true,
      pmsMembers: true,
      pmsProperties: true,
    },
  },
};

type PmsCompanyWithAccess = Prisma.DeveloperCompanyGetPayload<{
  include: typeof pmsCompanyInclude;
}>;

function isEntitlementEnabledStatus(status: PmsEntitlementStatus) {
  return ACTIVE_PMS_ENTITLEMENT_STATUSES.includes(status);
}

function companyName(company: { nameEn: string; nameAr?: string | null }) {
  return company.nameEn || company.nameAr || "PMS company";
}

async function recordPmsAdminAudit(input: {
  adminId: string;
  adminEmail: string;
  title: string;
  message: string;
  metadata: Prisma.InputJsonObject;
  targetUserId?: string;
}) {
  await recordAccountSecurityEvent(prisma, {
    userId: input.targetUserId ?? input.adminId,
    actorId: input.adminId,
    type: AccountSecurityEventType.ADMIN_PMS_ACCESS_UPDATED,
    title: input.title,
    message: input.message,
    metadata: {
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      ...input.metadata,
    } as Prisma.InputJsonObject,
  });
}

function pmsCompanyResponse(company: PmsCompanyWithAccess) {
  return {
    id: company.id,
    slug: company.slug,
    nameEn: company.nameEn,
    nameAr: company.nameAr,
    headquartersEn: company.headquartersEn,
    headquartersAr: company.headquartersAr,
    email: company.email,
    verified: company.verified,
    featured: company.featured,
    pmsEntitlement: company.pmsEntitlement,
    pmsMembers: company.pmsMembers.map((member) => ({
      id: member.id,
      role: member.role,
      active: member.active,
      invitedEmail: member.invitedEmail,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: member.user,
      propertyScope: {
        allProperties: member.propertyAccesses.length === 0,
        propertyIds: member.propertyAccesses.map((scope) => scope.propertyId),
        properties: member.propertyAccesses.map((scope) => scope.property),
      },
      permissionKeys: Array.from(new Set([
        ...getDefaultPmsPermissionKeys(member.role),
        ...member.permissions.map((permission) => permission.key),
      ])),
      customPermissionKeys: member.permissions.map((permission) => permission.key),
    })),
    counts: {
      listings: company._count.listings,
      projects: company._count.projects,
      pmsMembers: company._count.pmsMembers,
      pmsProperties: company._count.pmsProperties,
    },
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

function buildAdminPmsCompaniesWhere(
  input: z.infer<typeof adminPmsCompaniesQuerySchema>,
) {
  const search = input.search?.trim();
  const where: Prisma.DeveloperCompanyWhereInput = {
    ...(input.status !== "ALL"
      ? {
          pmsEntitlement: {
            is: {
              status: input.status,
            },
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              nameEn: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              nameAr: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              headquartersEn: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  return where;
}

pmsRouter.get(
  "/admin/companies",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const query = adminPmsCompaniesQuerySchema.parse(req.query);
      const where = buildAdminPmsCompaniesWhere(query);

      const [companies, total] = await prisma.$transaction([
        prisma.developerCompany.findMany({
          where,
          include: pmsCompanyInclude,
          orderBy: [
            {
              updatedAt: "desc",
            },
            {
              nameEn: "asc",
            },
          ],
          take: query.take,
          skip: query.skip,
        }),
        prisma.developerCompany.count({ where }),
      ]);

      res.json({
        companies: companies.map(pmsCompanyResponse),
        pagination: {
          take: query.take,
          skip: query.skip,
          count: companies.length,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/admin/companies/:companyId/entitlement",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = entitlementUpdateSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId,
        },
        include: {
          pmsEntitlement: true,
        },
      });

      if (!company) {
        throw new AppError(404, "Developer company not found");
      }

      const now = new Date();
      const nextEnabled = isEntitlementEnabledStatus(data.status);
      const entitlement = await prisma.pmsCompanyEntitlement.upsert({
        where: {
          companyId,
        },
        create: {
          companyId,
          status: data.status,
          notes: data.notes,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
          enabledAt: nextEnabled ? now : null,
          disabledAt: nextEnabled ? null : now,
          createdById: req.user.id,
          updatedById: req.user.id,
        },
        update: {
          status: data.status,
          notes: data.notes,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
          enabledAt:
            nextEnabled && !company.pmsEntitlement?.enabledAt
              ? now
              : company.pmsEntitlement?.enabledAt,
          disabledAt: nextEnabled ? null : now,
          updatedById: req.user.id,
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        title: "PMS entitlement updated",
        message: `${companyName(company)} PMS entitlement changed to ${data.status}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          status: data.status,
          notes: data.notes ?? null,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
        },
      });

      const refreshed = await prisma.developerCompany.findUniqueOrThrow({
        where: {
          id: companyId,
        },
        include: pmsCompanyInclude,
      });

      res.json({
        entitlement,
        company: pmsCompanyResponse(refreshed),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.post(
  "/admin/companies/:companyId/members",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = memberUpsertSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId,
        },
        include: {
          pmsEntitlement: true,
        },
      });

      if (!company) {
        throw new AppError(404, "Developer company not found");
      }

      if (!company.pmsEntitlement) {
        throw new AppError(
          400,
          "Enable PMS access for the company before adding staff.",
        );
      }

      const targetUser = await prisma.user.findFirst({
        where: data.userId
          ? {
              id: data.userId,
            }
          : {
              email: data.email,
            },
      });

      if (!targetUser) {
        throw new AppError(404, "User not found");
      }

      if (targetUser.suspendedAt || targetUser.deactivatedAt) {
        throw new AppError(
          400,
          "Suspended or deleted users cannot be added to PMS access.",
        );
      }

      const member = await prisma.pmsCompanyMember.upsert({
        where: {
          companyId_userId: {
            companyId,
            userId: targetUser.id,
          },
        },
        create: {
          companyId,
          userId: targetUser.id,
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active,
          createdById: req.user.id,
        },
        update: {
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              suspendedAt: true,
              deactivatedAt: true,
            },
          },
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: targetUser.id,
        title: "PMS workspace access updated",
        message: `Your PMS access for ${companyName(company)} was updated to ${data.role}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          memberId: member.id,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          role: data.role,
          active: data.active,
        },
      });

      res.status(201).json({
        member,
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/admin/members/:id",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { id } = idParamsSchema.parse(req.params);
      const data = memberUpdateSchema.parse(req.body);
      const existingMember = await prisma.pmsCompanyMember.findUnique({
        where: {
          id,
        },
        include: {
          company: true,
          user: true,
        },
      });

      if (!existingMember) {
        throw new AppError(404, "PMS member not found");
      }

      const member = await prisma.pmsCompanyMember.update({
        where: {
          id,
        },
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              suspendedAt: true,
              deactivatedAt: true,
            },
          },
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: existingMember.userId,
        title: "PMS workspace membership updated",
        message: `Your PMS workspace access for ${companyName(existingMember.company)} was updated.`,
        metadata: {
          companyId: existingMember.companyId,
          companyName: companyName(existingMember.company),
          memberId: existingMember.id,
          targetUserId: existingMember.userId,
          targetEmail: existingMember.user.email,
          role: member.role,
          active: member.active,
        },
      });

      res.json({
        member,
      });
    } catch (error) {
      next(error);
    }
  },
);

const pmsPropertyInclude = {
  developerProject: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      status: true,
    },
  },
  publicListing: {
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      status: true,
    },
  },
  _count: {
    select: {
      units: true,
    },
  },
};

type PmsPropertyWithRelations = Prisma.PmsPropertyGetPayload<{
  include: typeof pmsPropertyInclude;
}>;

const pmsUnitInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  developerProject: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      status: true,
    },
  },
  publicListing: {
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      status: true,
    },
  },
};

type PmsUnitWithRelations = Prisma.PmsUnitGetPayload<{
  include: typeof pmsUnitInclude;
}>;

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getPmsDocumentLifecycleStatus(input: {
  status?: PmsDocumentStatus;
  expiryDate?: Date | null;
}) {
  if (input.status === PmsDocumentStatus.ARCHIVED) return PmsDocumentStatus.ARCHIVED;
  if (!input.expiryDate) return input.status ?? PmsDocumentStatus.ACTIVE;

  const now = new Date();
  if (input.expiryDate < now) return PmsDocumentStatus.EXPIRED;

  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 30);
  if (input.expiryDate <= soon) return PmsDocumentStatus.EXPIRING;

  return input.status ?? PmsDocumentStatus.ACTIVE;
}

type PmsSortDirection = "asc" | "desc";

type PmsAuditTarget = {
  actorId: string;
  actorEmail: string;
  companyId: string;
};

function buildPmsPropertyOrderBy(
  query: z.infer<typeof pmsPropertyListQuerySchema>,
): Prisma.PmsPropertyOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "name":
      return [{ name: direction }, { updatedAt: "desc" }];
    case "city":
      return [{ city: direction }, { updatedAt: "desc" }];
    case "active":
      return [{ active: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { name: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { name: "asc" }];
  }
}

function buildPmsUnitOrderBy(
  query: z.infer<typeof pmsUnitListQuerySchema>,
  defaultScope: "portfolio" | "property",
): Prisma.PmsUnitOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "unitNumber":
      return [{ unitNumber: direction }, { updatedAt: "desc" }];
    case "status":
      return [{ status: direction }, { updatedAt: "desc" }];
    case "rentAmount":
      return [{ rentAmount: direction }, { updatedAt: "desc" }];
    case "areaSqm":
      return [{ areaSqm: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { unitNumber: "asc" }];
    case "updatedAt":
      return [{ updatedAt: direction }, { unitNumber: "asc" }];
    default:
      return defaultScope === "property"
        ? [{ unitNumber: "asc" }, { createdAt: "desc" }]
        : [{ updatedAt: direction }, { unitNumber: "asc" }];
  }
}

function buildPmsTenantOrderBy(
  query: z.infer<typeof pmsTenantListQuerySchema>,
): Prisma.PmsTenantOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "fullName":
      return [{ fullName: direction }, { updatedAt: "desc" }];
    case "active":
      return [{ active: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { fullName: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { fullName: "asc" }];
  }
}

function buildPmsLeaseOrderBy(
  query: z.infer<typeof pmsLeaseListQuerySchema>,
): Prisma.PmsLeaseOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "startDate":
      return [{ startDate: direction }, { updatedAt: "desc" }];
    case "endDate":
      return [{ endDate: direction }, { updatedAt: "desc" }];
    case "rentAmount":
      return [{ rentAmount: direction }, { updatedAt: "desc" }];
    case "status":
      return [{ status: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { startDate: "desc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { startDate: "desc" }];
  }
}

function buildPmsRentDueOrderBy(
  query: z.infer<typeof pmsRentDueListQuerySchema>,
): Prisma.PmsRentDueItemOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "amount":
      return [{ amount: direction }, { dueDate: "asc" }];
    case "paidAmount":
      return [{ paidAmount: direction }, { dueDate: "asc" }];
    case "status":
      return [{ status: direction }, { dueDate: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { dueDate: "asc" }];
    case "updatedAt":
      return [{ updatedAt: direction }, { dueDate: "asc" }];
    case "dueDate":
    default:
      return [{ dueDate: direction }, { createdAt: "asc" }];
  }
}

function buildPmsWorkOrderOrderBy(
  query: z.infer<typeof pmsWorkOrderListQuerySchema>,
): Prisma.PmsWorkOrderOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "title":
      return [{ title: direction }, { updatedAt: "desc" }];
    case "priority":
      return [{ priority: direction }, { updatedAt: "desc" }];
    case "status":
      return [{ status: direction }, { updatedAt: "desc" }];
    case "cost":
      return [{ cost: direction }, { updatedAt: "desc" }];
    case "scheduledFor":
      return [{ scheduledFor: direction }, { updatedAt: "desc" }];
    case "resolvedAt":
      return [{ resolvedAt: direction }, { updatedAt: "desc" }];
    case "targetDate":
      return [{ targetDate: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { title: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { createdAt: "desc" }];
  }
}

function buildPmsVendorOrderBy(
  query: z.infer<typeof pmsVendorListQuerySchema>,
): Prisma.PmsVendorOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;
  switch (query.sortBy) {
    case "name":
      return [{ name: direction }, { updatedAt: "desc" }];
    case "trade":
      return [{ trade: direction }, { name: "asc" }];
    case "active":
      return [{ active: direction }, { name: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { name: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { name: "asc" }];
  }
}

function buildPmsCommunicationTemplateOrderBy(
  query: z.infer<typeof pmsCommunicationTemplateListQuerySchema>,
): Prisma.PmsCommunicationTemplateOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "name":
      return [{ name: direction }, { updatedAt: "desc" }];
    case "channel":
      return [{ channel: direction }, { updatedAt: "desc" }];
    case "active":
      return [{ active: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { name: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { name: "asc" }];
  }
}

function buildPmsPolicyOrderBy(
  query: z.infer<typeof pmsPolicyListQuerySchema>,
): Prisma.PmsPolicyOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "title":
      return [{ title: direction }, { updatedAt: "desc" }];
    case "category":
      return [{ category: direction }, { updatedAt: "desc" }];
    case "active":
      return [{ active: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { title: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: direction }, { title: "asc" }];
  }
}

function buildPmsInspectionOrderBy(
  query: z.infer<typeof pmsInspectionListQuerySchema>,
): Prisma.PmsInspectionOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "title":
      return [{ title: direction }, { scheduledFor: "asc" }];
    case "status":
      return [{ status: direction }, { scheduledFor: "asc" }];
    case "rating":
      return [{ rating: direction }, { updatedAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { scheduledFor: "asc" }];
    case "updatedAt":
      return [{ updatedAt: direction }, { scheduledFor: "asc" }];
    case "scheduledFor":
    default:
      return [{ scheduledFor: direction }, { updatedAt: "desc" }];
  }
}

function buildPmsDocumentOrderBy(
  query: z.infer<typeof pmsDocumentListQuerySchema>,
): Prisma.PmsDocumentOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case 'title':
      return [{ title: direction }, { updatedAt: 'desc' }];
    case 'type':
      return [{ type: direction }, { updatedAt: 'desc' }];
    case 'status':
      return [{ status: direction }, { updatedAt: 'desc' }];
    case 'createdAt':
      return [{ createdAt: direction }, { updatedAt: 'desc' }];
    case 'expiryDate':
      return [{ expiryDate: direction }, { updatedAt: 'desc' }];
    case 'updatedAt':
    default:
      return [{ updatedAt: direction }, { createdAt: 'desc' }];
  }
}

function getPmsDocumentExpiryFilter(input: { expiringWithinDays?: number }): Prisma.DateTimeFilter | undefined {
  if (input.expiringWithinDays === undefined) return undefined;
  const now = new Date();
  const until = new Date(now);
  until.setUTCDate(until.getUTCDate() + input.expiringWithinDays);
  return { gte: now, lte: until };
}

function buildPmsRentDueDateFilter(
  query: z.infer<typeof pmsRentDueListQuerySchema>,
): Prisma.DateTimeFilter | undefined {
  if (!query.dueFrom && !query.dueTo) return undefined;

  return {
    ...(query.dueFrom ? { gte: query.dueFrom } : {}),
    ...(query.dueTo ? { lte: query.dueTo } : {}),
  };
}

function buildPmsAccountingDateFilter(input: {
  dateFrom?: Date;
  dateTo?: Date;
}): Prisma.DateTimeFilter | undefined {
  if (!input.dateFrom && !input.dateTo) return undefined;

  return {
    ...(input.dateFrom ? { gte: input.dateFrom } : {}),
    ...(input.dateTo ? { lte: input.dateTo } : {}),
  };
}

function buildPmsAccountingOrderBy(
  query: z.infer<typeof pmsAccountingQuerySchema>,
): Prisma.PmsAccountingLedgerEntryOrderByWithRelationInput[] {
  const direction = query.direction as PmsSortDirection;

  switch (query.sortBy) {
    case "amount":
      return [{ amount: direction }, { transactionDate: "desc" }];
    case "type":
      return [{ type: direction }, { transactionDate: "desc" }];
    case "category":
      return [{ category: direction }, { transactionDate: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }, { transactionDate: "desc" }];
    case "updatedAt":
      return [{ updatedAt: direction }, { transactionDate: "desc" }];
    case "transactionDate":
    default:
      return [{ transactionDate: direction }, { createdAt: "desc" }];
  }
}

function getPmsStatementRange(input: { month?: string; dateFrom?: Date; dateTo?: Date }) {
  if (input.month) {
    const [year, month] = input.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end };
  }

  return {
    start: input.dateFrom,
    end: input.dateTo,
  };
}

function sumDecimal(values: Array<Prisma.Decimal | null | undefined>) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function moneyString(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

function isPmsAccountingIncomeType(type: PmsAccountingEntryType) {
  return (
    type === PmsAccountingEntryType.INCOME ||
    type === PmsAccountingEntryType.LATE_FEE ||
    type === PmsAccountingEntryType.ADJUSTMENT ||
    type === PmsAccountingEntryType.DEPOSIT
  );
}

function isPmsAccountingExpenseType(type: PmsAccountingEntryType) {
  return type === PmsAccountingEntryType.EXPENSE || type === PmsAccountingEntryType.REFUND;
}

async function assertPmsFilterLinksBelongToCompany(input: {
  companyId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  rentDueItemId?: string | null;
  workOrderId?: string | null;
  vendorId?: string | null;
}) {
  if (input.propertyId) {
    const property = await prisma.pmsProperty.findFirst({
      where: { id: input.propertyId, companyId: input.companyId },
      select: { id: true },
    });

    if (!property) {
      throw new AppError(400, "PMS property filter must belong to this PMS company.");
    }
  }

  if (input.unitId) {
    const unit = await prisma.pmsUnit.findFirst({
      where: {
        id: input.unitId,
        companyId: input.companyId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      },
      select: { id: true },
    });

    if (!unit) {
      throw new AppError(400, "PMS unit filter must belong to this PMS company.");
    }
  }

  if (input.tenantId) {
    const tenant = await prisma.pmsTenant.findFirst({
      where: { id: input.tenantId, companyId: input.companyId },
      select: { id: true },
    });

    if (!tenant) {
      throw new AppError(400, "PMS tenant filter must belong to this PMS company.");
    }
  }

  if (input.leaseId) {
    const lease = await prisma.pmsLease.findFirst({
      where: {
        id: input.leaseId,
        companyId: input.companyId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: { id: true },
    });

    if (!lease) {
      throw new AppError(400, "PMS lease filter must belong to this PMS company.");
    }
  }

  if (input.rentDueItemId) {
    const rentDueItem = await prisma.pmsRentDueItem.findFirst({
      where: {
        id: input.rentDueItemId,
        companyId: input.companyId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.leaseId ? { leaseId: input.leaseId } : {}),
      },
      select: { id: true },
    });

    if (!rentDueItem) {
      throw new AppError(400, "PMS rent due item filter must belong to this PMS company.");
    }
  }

  if (input.workOrderId) {
    const workOrder = await prisma.pmsWorkOrder.findFirst({
      where: {
        id: input.workOrderId,
        companyId: input.companyId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: { id: true },
    });

    if (!workOrder) {
      throw new AppError(400, "PMS maintenance work order filter must belong to this PMS company.");
    }
  }

  if (input.vendorId) {
    const vendor = await prisma.pmsVendor.findFirst({
      where: { id: input.vendorId, companyId: input.companyId },
      select: { id: true },
    });

    if (!vendor) {
      throw new AppError(400, "PMS vendor filter must belong to this PMS company.");
    }
  }
}

async function assertPmsDocumentLinksBelongToCompany(input: {
  companyId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  workOrderId?: string | null;
  inspectionId?: string | null;
  chargeId?: string | null;
  securityDepositTransactionId?: string | null;
  ownerPayoutBatchId?: string | null;
  assetId?: string | null;
  statementId?: string | null;
  inspectionDefectId?: string | null;
}) {
  await assertPmsFilterLinksBelongToCompany({
    companyId: input.companyId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    leaseId: input.leaseId,
    workOrderId: input.workOrderId,
  });

  if (input.inspectionId) {
    const inspection = await prisma.pmsInspection.findFirst({
      where: {
        id: input.inspectionId,
        companyId: input.companyId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.leaseId ? { leaseId: input.leaseId } : {}),
      },
      select: { id: true },
    });

    if (!inspection) {
      throw new AppError(400, 'PMS inspection link must belong to this PMS company.');
    }
  }


  const linkedChecks: Array<Promise<unknown>> = [];
  if (input.chargeId) linkedChecks.push(prisma.pmsCharge.findFirst({ where: { id: input.chargeId, companyId: input.companyId, ...(input.propertyId ? { propertyId: input.propertyId } : {}) }, select: { id: true } }));
  if (input.securityDepositTransactionId) linkedChecks.push(prisma.pmsSecurityDepositTransaction.findFirst({ where: { id: input.securityDepositTransactionId, companyId: input.companyId, account: input.propertyId ? { propertyId: input.propertyId } : undefined }, select: { id: true } }));
  if (input.ownerPayoutBatchId) linkedChecks.push(prisma.pmsOwnerPayoutBatch.findFirst({ where: { id: input.ownerPayoutBatchId, companyId: input.companyId, ...(input.propertyId ? { lines: { some: { propertyId: input.propertyId } } } : {}) }, select: { id: true } }));
  if (input.assetId) linkedChecks.push(prisma.pmsAsset.findFirst({ where: { id: input.assetId, companyId: input.companyId, ...(input.propertyId ? { propertyId: input.propertyId } : {}) }, select: { id: true } }));
  if (input.statementId) linkedChecks.push(prisma.pmsOwnerStatement.findFirst({ where: { id: input.statementId, companyId: input.companyId, ...(input.propertyId ? { propertyId: input.propertyId } : {}) }, select: { id: true } }));
  if (input.inspectionDefectId) linkedChecks.push(prisma.pmsInspectionDefect.findFirst({ where: { id: input.inspectionDefectId, companyId: input.companyId, ...(input.propertyId ? { propertyId: input.propertyId } : {}) }, select: { id: true } }));
  if (linkedChecks.length > 0) {
    const linkedRecords = await Promise.all(linkedChecks);
    if (linkedRecords.some((record) => !record)) throw new AppError(400, 'PMS financial, asset, statement, or inspection link must belong to this PMS company and property.');
  }
}

function assertMaintenanceDocumentScope(input: {
  role: PmsMemberRole;
  type?: PmsDocumentType;
  workOrderId?: string | null;
  inspectionId?: string | null;
  chargeId?: string | null;
  securityDepositTransactionId?: string | null;
  ownerPayoutBatchId?: string | null;
  assetId?: string | null;
  statementId?: string | null;
  inspectionDefectId?: string | null;
}) {
  if (input.role !== PmsMemberRole.PMS_MAINTENANCE) return;

  const maintenanceTypeAllowed =
    input.type === undefined ||
    input.type === PmsDocumentType.MAINTENANCE_INVOICE ||
    input.type === PmsDocumentType.INSPECTION_REPORT ||
    input.type === PmsDocumentType.OTHER;

  if (!maintenanceTypeAllowed || (!input.workOrderId && !input.inspectionId)) {
    throw new AppError(403, 'Maintenance users can only manage maintenance or inspection documents.');
  }
}

async function recordPmsWorkspaceAudit(
  input: PmsAuditTarget & {
    title: string;
    message: string;
    metadata: Prisma.InputJsonObject;
    targetUserId?: string;
    request?: Parameters<typeof requestAuditContext>[0];
    origin?: DomainAuditOrigin;
  },
) {
  const action = typeof input.metadata.action === "string" ? input.metadata.action : "change";
  const entityType = typeof input.metadata.resourceType === "string" ? input.metadata.resourceType : "pmsWorkspace";
  const idEntry = Object.entries(input.metadata).find(([key, value]) => key.endsWith("Id") && typeof value === "string");
  await recordDomainAuditEvent(prisma, {
    companyId: input.companyId,
    domain: DomainAuditDomain.PMS,
    entityType,
    entityId: idEntry?.[1] as string | undefined,
    action,
    actorId: input.actorId,
    origin: input.origin ?? DomainAuditOrigin.MANUAL,
    changedFields: Array.isArray(input.metadata.changedFields)
      ? input.metadata.changedFields.filter((field): field is string => typeof field === "string")
      : [],
    metadata: { title: input.title, message: input.message, ...input.metadata },
    ...(input.request ? requestAuditContext(input.request) : {}),
  });
}

function pmsWorkspacePayload(access: PmsWorkspaceAccess) {
  return {
    company: access.company,
    member: access.member,
    entitlement: access.entitlement,
  };
}

function isPmsPropertyScopeRestricted(access: PmsWorkspaceAccess) {
  return !access.member.propertyScope.allProperties;
}

function pmsScopedPropertyWhere(access: PmsWorkspaceAccess): Prisma.PmsPropertyWhereInput {
  if (!isPmsPropertyScopeRestricted(access)) return {};
  return { id: { in: access.member.propertyScope.propertyIds } };
}

function pmsScopedPropertyIdWhere(access: PmsWorkspaceAccess): Prisma.StringFilter | undefined {
  if (!isPmsPropertyScopeRestricted(access)) return undefined;
  return { in: access.member.propertyScope.propertyIds };
}

function assertCanAccessPmsPropertyScope(access: PmsWorkspaceAccess, propertyId: string) {
  if (!isPmsPropertyScopeRestricted(access)) return;
  if (!access.member.propertyScope.propertyIds.includes(propertyId)) {
    throw new AppError(403, "Your PMS access is restricted to selected properties.");
  }
}

function assertCanAccessOptionalPmsPropertyScope(
  access: PmsWorkspaceAccess,
  propertyId: string | null | undefined,
) {
  if (!isPmsPropertyScopeRestricted(access)) return;
  if (!propertyId) {
    throw new AppError(
      403,
      "Property-scoped PMS members can only access records linked to an assigned property.",
    );
  }
  assertCanAccessPmsPropertyScope(access, propertyId);
}

function pmsRequestedOrScopedPropertyIdWhere(
  access: PmsWorkspaceAccess,
  requestedPropertyId?: string | null,
): string | Prisma.StringFilter | undefined {
  if (requestedPropertyId) {
    assertCanAccessPmsPropertyScope(access, requestedPropertyId);
    return requestedPropertyId;
  }

  return pmsScopedPropertyIdWhere(access);
}

function assertCanRunPmsBulkImport(access: PmsWorkspaceAccess) {
  if (isPmsPropertyScopeRestricted(access)) {
    throw new AppError(
      403,
      "Bulk PMS imports require workspace-wide property access.",
    );
  }
}

function assertCanAdministerPmsStaff(access: PmsWorkspaceAccess) {
  assertCanManagePmsStaff(access.member);
  if (isPmsPropertyScopeRestricted(access)) {
    throw new AppError(
      403,
      "PMS staff administration requires workspace-wide property access.",
    );
  }
}

function assertCanDelegatePmsStaffAccess(
  access: PmsWorkspaceAccess,
  input: {
    role?: PmsMemberRole;
    permissionKeys?: readonly PmsPermissionKey[];
    existingRole?: PmsMemberRole;
    existingPermissionKeys?: readonly PmsPermissionKey[];
  },
) {
  if (access.member.role === PmsMemberRole.PMS_OWNER) return;

  if (input.role === PmsMemberRole.PMS_OWNER || input.existingRole === PmsMemberRole.PMS_OWNER) {
    throw new AppError(403, "Only a PMS owner can create or change owner access.");
  }

  const delegatedRole = input.role ?? input.existingRole;
  const delegatedCustomPermissions =
    input.permissionKeys ?? input.existingPermissionKeys ?? [];
  const delegatedPermissions: readonly PmsPermissionKey[] = delegatedRole
    ? Array.from(
        new Set([
          ...getDefaultPmsPermissionKeys(delegatedRole),
          ...delegatedCustomPermissions,
        ]),
      )
    : delegatedCustomPermissions;

  if (delegatedPermissions.includes(PmsPermissionKey.STAFF_MANAGE)) {
    throw new AppError(403, "Only a PMS owner can delegate staff administration.");
  }

  const actorPermissions: readonly string[] = access.member.permissionKeys;
  const elevatedPermission = delegatedPermissions.find(
    (permission) => !actorPermissions.includes(permission),
  );
  if (elevatedPermission) {
    throw new AppError(
      403,
      `You cannot delegate the ${elevatedPermission} PMS permission.`,
    );
  }
}

async function assertPmsOwnerContinuity(input: {
  companyId: string;
  memberId: string;
  existingRole: PmsMemberRole;
  nextRole?: PmsMemberRole;
  nextActive?: boolean;
}) {
  const removesActiveOwner =
    input.existingRole === PmsMemberRole.PMS_OWNER &&
    ((input.nextRole !== undefined && input.nextRole !== PmsMemberRole.PMS_OWNER) ||
      input.nextActive === false);
  if (!removesActiveOwner) return;

  const otherActiveOwners = await prisma.pmsCompanyMember.count({
    where: {
      companyId: input.companyId,
      id: { not: input.memberId },
      role: PmsMemberRole.PMS_OWNER,
      active: true,
    },
  });
  if (otherActiveOwners === 0) {
    throw new AppError(400, "At least one active PMS owner must remain in the workspace.");
  }
}

async function assertCanAccessPmsUnitScope(
  access: PmsWorkspaceAccess,
  unitId: string,
) {
  if (!isPmsPropertyScopeRestricted(access)) return;

  const unit = await prisma.pmsUnit.findFirst({
    where: { id: unitId, companyId: access.company.id },
    select: { propertyId: true },
  });

  if (!unit) {
    throw new AppError(400, "PMS unit must belong to this PMS company.");
  }
  assertCanAccessPmsPropertyScope(access, unit.propertyId);
}

async function assertCanAccessPmsTenantScope(
  access: PmsWorkspaceAccess,
  tenantId: string,
) {
  if (!isPmsPropertyScopeRestricted(access)) return;

  const linkedLease = await prisma.pmsLease.findFirst({
    where: {
      companyId: access.company.id,
      tenantId,
      propertyId: { in: access.member.propertyScope.propertyIds },
    },
    select: { id: true },
  });

  if (!linkedLease) {
    throw new AppError(403, "Your PMS access is restricted to tenants in selected properties.");
  }
}

async function assertCanAccessPmsCommunicationScope(
  access: PmsWorkspaceAccess,
  input: {
    tenantId?: string | null;
    leaseId?: string | null;
    rentDueItemId?: string | null;
    workOrderId?: string | null;
  },
) {
  if (!isPmsPropertyScopeRestricted(access)) return;

  if (input.leaseId) {
    const lease = await prisma.pmsLease.findFirst({
      where: { id: input.leaseId, companyId: access.company.id },
      select: { propertyId: true },
    });
    if (!lease) throw new AppError(400, "PMS communication lease must belong to this company.");
    assertCanAccessPmsPropertyScope(access, lease.propertyId);
  }

  if (input.rentDueItemId) {
    const rentDueItem = await prisma.pmsRentDueItem.findFirst({
      where: { id: input.rentDueItemId, companyId: access.company.id },
      select: { propertyId: true },
    });
    if (!rentDueItem) {
      throw new AppError(400, "PMS communication rent item must belong to this company.");
    }
    assertCanAccessPmsPropertyScope(access, rentDueItem.propertyId);
  }

  if (input.workOrderId) {
    const workOrder = await prisma.pmsWorkOrder.findFirst({
      where: { id: input.workOrderId, companyId: access.company.id },
      select: { propertyId: true },
    });
    if (!workOrder) {
      throw new AppError(400, "PMS communication work order must belong to this company.");
    }
    assertCanAccessPmsPropertyScope(access, workOrder.propertyId);
  }

  if (input.tenantId) {
    await assertCanAccessPmsTenantScope(access, input.tenantId);
  }
}

async function assertPmsPropertyIdsBelongToCompany(companyId: string, propertyIds: string[]) {
  const uniqueIds = Array.from(new Set(propertyIds));
  if (uniqueIds.length === 0) return;

  const count = await prisma.pmsProperty.count({
    where: {
      id: { in: uniqueIds },
      companyId,
    },
  });

  if (count !== uniqueIds.length) {
    throw new AppError(400, "All scoped PMS properties must belong to this PMS company.");
  }
}

function effectivePmsPermissionKeys(role: PmsMemberRole, customKeys: PmsPermissionKey[]) {
  return Array.from(new Set([...getDefaultPmsPermissionKeys(role), ...customKeys]));
}

const staffMemberInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspendedAt: true,
      deactivatedAt: true,
    },
  },
  propertyAccesses: {
    where: { active: true },
    include: { property: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  permissions: {
    where: { active: true },
    orderBy: { key: "asc" as const },
  },
} satisfies Prisma.PmsCompanyMemberInclude;

type PmsStaffMemberWithRelations = Prisma.PmsCompanyMemberGetPayload<{ include: typeof staffMemberInclude }>;

function pmsStaffMemberResponse(member: PmsStaffMemberWithRelations) {
  const customPermissionKeys = member.permissions.map((permission) => permission.key);
  return {
    id: member.id,
    companyId: member.companyId,
    userId: member.userId,
    role: member.role,
    active: member.active,
    invitedEmail: member.invitedEmail,
    user: member.user,
    permissionKeys: effectivePmsPermissionKeys(member.role, customPermissionKeys),
    customPermissionKeys,
    propertyScope: {
      allProperties: member.propertyAccesses.length === 0,
      propertyIds: member.propertyAccesses.map((scope) => scope.propertyId),
      properties: member.propertyAccesses.map((scope) => scope.property),
    },
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

const pmsPortfolioInclude = {
  properties: {
    include: { property: { select: { id: true, name: true, code: true, active: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PmsPortfolioInclude;

type PmsPortfolioWithRelations = Prisma.PmsPortfolioGetPayload<{ include: typeof pmsPortfolioInclude }>;

function pmsPortfolioResponse(portfolio: PmsPortfolioWithRelations) {
  return {
    id: portfolio.id,
    companyId: portfolio.companyId,
    name: portfolio.name,
    description: portfolio.description,
    active: portfolio.active,
    propertyIds: portfolio.properties.map((item) => item.propertyId),
    properties: portfolio.properties.map((item) => item.property),
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
  };
}

async function replacePmsMemberPropertyScope(input: {
  companyId: string;
  memberId: string;
  propertyIds?: string[];
}) {
  if (input.propertyIds === undefined) return;
  const propertyIds = Array.from(new Set(input.propertyIds));
  await assertPmsPropertyIdsBelongToCompany(input.companyId, propertyIds);

  await prisma.pmsMemberPropertyAccess.deleteMany({ where: { memberId: input.memberId } });

  if (propertyIds.length > 0) {
    await prisma.pmsMemberPropertyAccess.createMany({
      data: propertyIds.map((propertyId) => ({
        companyId: input.companyId,
        memberId: input.memberId,
        propertyId,
      })),
      skipDuplicates: true,
    });
  }
}

async function replacePmsMemberPermissions(input: {
  companyId: string;
  memberId: string;
  permissionKeys?: PmsPermissionKey[];
}) {
  if (input.permissionKeys === undefined) return;
  const permissionKeys = Array.from(new Set(input.permissionKeys));
  await prisma.pmsMemberPermission.deleteMany({ where: { memberId: input.memberId } });

  if (permissionKeys.length > 0) {
    await prisma.pmsMemberPermission.createMany({
      data: permissionKeys.map((key) => ({
        companyId: input.companyId,
        memberId: input.memberId,
        key,
      })),
      skipDuplicates: true,
    });
  }
}

async function replacePmsPortfolioProperties(input: {
  companyId: string;
  portfolioId: string;
  propertyIds?: string[];
}) {
  if (input.propertyIds === undefined) return;
  const propertyIds = Array.from(new Set(input.propertyIds));
  await assertPmsPropertyIdsBelongToCompany(input.companyId, propertyIds);

  await prisma.pmsPortfolioProperty.deleteMany({ where: { portfolioId: input.portfolioId } });

  if (propertyIds.length > 0) {
    await prisma.pmsPortfolioProperty.createMany({
      data: propertyIds.map((propertyId) => ({
        companyId: input.companyId,
        portfolioId: input.portfolioId,
        propertyId,
      })),
      skipDuplicates: true,
    });
  }
}

async function notifyPmsMaintenanceRecipients(input: {
  companyId: string;
  title: string;
  message: string;
}) {
  const recipients = await prisma.pmsCompanyMember.findMany({
    where: {
      companyId: input.companyId,
      active: true,
      role: { in: [PmsMemberRole.PMS_OWNER, PmsMemberRole.PMS_MANAGER, PmsMemberRole.PMS_MAINTENANCE, PmsMemberRole.PMS_AGENT] },
      user: { suspendedAt: null, deactivatedAt: null },
    },
    select: { userId: true },
  });

  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      type: NotificationType.PMS_MAINTENANCE_REQUEST_CREATED,
      title: input.title,
      message: input.message,
    })),
  });
}

function operationalStatusFromLegacyUnitStatus(status: PmsUnitStatus) {
  if (status === PmsUnitStatus.RESERVED) return PmsUnitOperationalStatus.RESERVED;
  if (status === PmsUnitStatus.MAINTENANCE) return PmsUnitOperationalStatus.MAINTENANCE;
  if (status === PmsUnitStatus.UNAVAILABLE) return PmsUnitOperationalStatus.UNAVAILABLE;
  return PmsUnitOperationalStatus.AVAILABLE;
}

function compatibilityUnitStatus(
  operationalStatus: PmsUnitOperationalStatus,
  occupancyStatus: PmsOccupancyStatus,
) {
  if (operationalStatus === PmsUnitOperationalStatus.MAINTENANCE) return PmsUnitStatus.MAINTENANCE;
  if (operationalStatus === PmsUnitOperationalStatus.UNAVAILABLE) return PmsUnitStatus.UNAVAILABLE;
  if (occupancyStatus === PmsOccupancyStatus.OCCUPIED) return PmsUnitStatus.OCCUPIED;
  if (operationalStatus === PmsUnitOperationalStatus.RESERVED) return PmsUnitStatus.RESERVED;
  return PmsUnitStatus.VACANT;
}

async function syncPmsUnitOccupancy(
  tx: Prisma.TransactionClient,
  input: { unitId: string; occupied: boolean; userId: string },
) {
  const unit = await tx.pmsUnit.findUniqueOrThrow({
    where: { id: input.unitId },
    select: { operationalStatus: true },
  });
  const occupancyStatus = input.occupied ? PmsOccupancyStatus.OCCUPIED : PmsOccupancyStatus.VACANT;
  return tx.pmsUnit.update({
    where: { id: input.unitId },
    data: {
      occupancyStatus,
      status: compatibilityUnitStatus(unit.operationalStatus, occupancyStatus),
      updatedById: input.userId,
    },
  });
}

async function resolvePmsAccessOrThrow(input: {
  userId: string;
  companyId?: string;
}) {
  const access = await resolvePmsWorkspaceAccess(input);

  if (!access) {
    throw new AppError(403, "PMS access is not enabled for this workspace.");
  }

  return access;
}

async function assertOptionalLinksBelongToCompany(input: {
  companyId: string;
  developerProjectId?: string | null;
  publicListingId?: string | null;
}) {
  if (input.developerProjectId) {
    const project = await prisma.developerProject.findFirst({
      where: {
        id: input.developerProjectId,
        developerId: input.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new AppError(
        400,
        "Linked developer project must belong to the PMS company.",
      );
    }
  }

  if (input.publicListingId) {
    const listing = await prisma.listing.findFirst({
      where: {
        id: input.publicListingId,
        developerId: input.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!listing) {
      throw new AppError(
        400,
        "Linked public listing must belong to the PMS company.",
      );
    }
  }
}

function pmsPropertyResponse(property: PmsPropertyWithRelations) {
  return {
    id: property.id,
    companyId: property.companyId,
    name: property.name,
    code: property.code,
    propertyType: property.propertyType,
    description: property.description,
    addressLine: property.addressLine,
    city: property.city,
    area: property.area,
    notes: property.notes,
    active: property.active,
    mapPlaceLabel: property.mapPlaceLabel,
    mapAddress: property.mapAddress,
    mapGoogleUrl: property.mapGoogleUrl,
    latitude: decimalToString(property.latitude),
    longitude: decimalToString(property.longitude),
    developerProjectId: property.developerProjectId,
    developerProject: property.developerProject,
    publicListingId: property.publicListingId,
    publicListing: property.publicListing,
    counts: {
      units: property._count.units,
    },
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

function pmsUnitResponse(unit: PmsUnitWithRelations) {
  return {
    id: unit.id,
    companyId: unit.companyId,
    propertyId: unit.propertyId,
    property: unit.property,
    unitNumber: unit.unitNumber,
    unitName: unit.unitName,
    floor: unit.floor,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    areaSqm: unit.areaSqm,
    status: unit.status,
    occupancyStatus: unit.occupancyStatus,
    operationalStatus: unit.operationalStatus,
    rentAmount: decimalToString(unit.rentAmount),
    currency: unit.currency,
    notes: unit.notes,
    developerProjectId: unit.developerProjectId,
    developerProject: unit.developerProject,
    publicListingId: unit.publicListingId,
    publicListing: unit.publicListing,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

const pmsTenantPortalAccessSelect = {
  id: true,
  companyId: true,
  tenantId: true,
  userId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.PmsTenantPortalAccessSelect;

const pmsTenantInclude = {
  pmsTenantPortalAccesses: {
    select: pmsTenantPortalAccessSelect,
    orderBy: { updatedAt: "desc" as const },
  },
  _count: {
    select: {
      leases: true,
    },
  },
};

type PmsTenantWithRelations = Prisma.PmsTenantGetPayload<{
  include: typeof pmsTenantInclude;
}>;

const pmsLeaseInclude = {
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      active: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
      status: true,
      occupancyStatus: true,
    },
  },
  contractDraft: {
    select: {
      id: true,
      title: true,
      status: true,
      registrationStatus: true,
    },
  },
  previousLease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  },
  _count: {
    select: {
      rentDueItems: true,
      renewalLeases: true,
      pmsDocuments: true,
    },
  },
};

type PmsLeaseWithRelations = Prisma.PmsLeaseGetPayload<{
  include: typeof pmsLeaseInclude;
}>;

const pmsRentDueItemInclude = {
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
    },
  },
  lease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      rentFrequency: true,
    },
  },
};

type PmsRentDueItemWithRelations = Prisma.PmsRentDueItemGetPayload<{
  include: typeof pmsRentDueItemInclude;
}>;

const pmsRentPaymentInclude = {
  rentDueItem: {
    include: pmsRentDueItemInclude,
  },
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
    },
  },
  lease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      rentFrequency: true,
    },
  },
  recordedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.PmsRentPaymentInclude;

type PmsRentPaymentWithRelations = Prisma.PmsRentPaymentGetPayload<{
  include: typeof pmsRentPaymentInclude;
}>;

function maskSensitiveIdentifier(value: string | null) {
  if (!value) return null;
  const visible = value.slice(-4);
  return `${"•".repeat(Math.max(4, value.length - 4))}${visible}`;
}

function pmsTenantResponse(
  tenant: PmsTenantWithRelations,
  scopedLeaseCount?: number,
  includeSensitive = false,
) {
  const hasSensitiveIdentity = Boolean(tenant.nationalId || tenant.passportNumber);
  return {
    id: tenant.id,
    companyId: tenant.companyId,
    fullName: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    nationality: tenant.nationality,
    nationalId: includeSensitive ? tenant.nationalId : null,
    passportNumber: includeSensitive ? tenant.passportNumber : null,
    nationalIdMasked: maskSensitiveIdentifier(tenant.nationalId),
    passportNumberMasked: maskSensitiveIdentifier(tenant.passportNumber),
    sensitiveIdentityAvailable: hasSensitiveIdentity,
    sensitiveIdentityAuthorized: includeSensitive,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
    emergencyContactEmail: tenant.emergencyContactEmail,
    notes: tenant.notes,
    active: tenant.active,
    counts: { leases: scopedLeaseCount ?? tenant._count.leases },
    portalAccesses: tenant.pmsTenantPortalAccesses.map((portalAccess) => ({
      id: portalAccess.id,
      companyId: portalAccess.companyId,
      tenantId: portalAccess.tenantId,
      userId: portalAccess.userId,
      active: portalAccess.active,
      user: portalAccess.user,
      createdAt: portalAccess.createdAt,
      updatedAt: portalAccess.updatedAt,
    })),
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

function pmsLeaseResponse(lease: PmsLeaseWithRelations) {
  return {
    id: lease.id,
    companyId: lease.companyId,
    tenantId: lease.tenantId,
    tenant: lease.tenant,
    propertyId: lease.propertyId,
    property: lease.property,
    unitId: lease.unitId,
    unit: lease.unit,
    contractDraftId: lease.contractDraftId,
    contractDraft: lease.contractDraft,
    previousLeaseId: lease.previousLeaseId,
    previousLease: lease.previousLease,
    title: lease.title,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
    rentFrequency: lease.rentFrequency,
    rentAmount: decimalToString(lease.rentAmount),
    currency: lease.currency,
    securityDeposit: decimalToString(lease.securityDeposit),
    dueDayOfMonth: lease.dueDayOfMonth,
    notes: lease.notes,
    counts: {
      rentDueItems: lease._count.rentDueItems,
      renewalLeases: lease._count.renewalLeases,
      documents: lease._count.pmsDocuments,
    },
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt,
  };
}

function pmsRentDueItemResponse(item: PmsRentDueItemWithRelations) {
  return {
    id: item.id,
    companyId: item.companyId,
    leaseId: item.leaseId,
    lease: item.lease,
    tenantId: item.tenantId,
    tenant: item.tenant,
    propertyId: item.propertyId,
    property: item.property,
    unitId: item.unitId,
    unit: item.unit,
    dueDate: item.dueDate,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    amount: decimalToString(item.amount),
    paidAmount: decimalToString(item.paidAmount),
    currency: item.currency,
    status: item.status,
    paidAt: item.paidAt,
    notes: item.notes,
    balanceAmount: String(
      Math.max(
        roundMoney(rentDecimalToNumber(item.amount) - rentDecimalToNumber(item.paidAmount)),
        0,
      ),
    ),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function pmsRentPaymentResponse(payment: PmsRentPaymentWithRelations) {
  return {
    id: payment.id,
    companyId: payment.companyId,
    rentDueItemId: payment.rentDueItemId,
    rentDueItem: payment.rentDueItem ? pmsRentDueItemResponse(payment.rentDueItem) : null,
    leaseId: payment.leaseId,
    lease: payment.lease,
    tenantId: payment.tenantId,
    tenant: payment.tenant,
    propertyId: payment.propertyId,
    property: payment.property,
    unitId: payment.unitId,
    unit: payment.unit,
    amount: decimalToString(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
    paidAt: payment.paidAt,
    receiptNumber: payment.receiptNumber,
    provider: payment.provider,
    providerReference: payment.providerReference,
    providerSessionId: payment.providerSessionId,
    checkoutUrl: payment.checkoutUrl,
    confirmedAt: payment.confirmedAt,
    cancelledAt: payment.cancelledAt,
    recordedBy: payment.recordedBy,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function pmsRentReceiptResponse(payment: PmsRentPaymentWithRelations) {
  return {
    receiptNumber: payment.receiptNumber,
    paymentId: payment.id,
    rentDueItemId: payment.rentDueItemId,
    status: payment.status,
    method: payment.method,
    amount: decimalToString(payment.amount),
    currency: payment.currency,
    referenceNumber: payment.referenceNumber,
    providerReference: payment.providerReference,
    paidAt: payment.paidAt,
    confirmedAt: payment.confirmedAt,
    issuedAt: payment.updatedAt,
    tenant: payment.tenant,
    property: payment.property,
    unit: payment.unit,
    lease: payment.lease,
    rentDueItem: payment.rentDueItem ? pmsRentDueItemResponse(payment.rentDueItem) : null,
    recordedBy: payment.recordedBy,
  };
}

const pmsAccountingLedgerEntryInclude = {
  property: {
    select: { id: true, name: true, code: true },
  },
  unit: {
    select: { id: true, unitNumber: true, unitName: true },
  },
  tenant: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
  lease: {
    select: { id: true, title: true, status: true, startDate: true, endDate: true },
  },
  rentDueItem: {
    include: pmsRentDueItemInclude,
  },
  rentPayment: {
    select: { id: true, receiptNumber: true, method: true, status: true, referenceNumber: true },
  },
  workOrder: {
    select: { id: true, title: true, status: true, cost: true, currency: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  updatedBy: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.PmsAccountingLedgerEntryInclude;

type PmsAccountingLedgerEntryWithRelations = Prisma.PmsAccountingLedgerEntryGetPayload<{
  include: typeof pmsAccountingLedgerEntryInclude;
}>;

function pmsAccountingLedgerEntryResponse(entry: PmsAccountingLedgerEntryWithRelations) {
  return {
    id: entry.id,
    companyId: entry.companyId,
    propertyId: entry.propertyId,
    property: entry.property,
    unitId: entry.unitId,
    unit: entry.unit,
    tenantId: entry.tenantId,
    tenant: entry.tenant,
    leaseId: entry.leaseId,
    lease: entry.lease,
    rentDueItemId: entry.rentDueItemId,
    rentDueItem: entry.rentDueItem ? pmsRentDueItemResponse(entry.rentDueItem) : null,
    rentPaymentId: entry.rentPaymentId,
    rentPayment: entry.rentPayment,
    workOrderId: entry.workOrderId,
    workOrder: entry.workOrder
      ? {
          ...entry.workOrder,
          cost: decimalToString(entry.workOrder.cost),
        }
      : null,
    type: entry.type,
    source: entry.source,
    category: entry.category,
    amount: decimalToString(entry.amount),
    currency: entry.currency,
    transactionDate: entry.transactionDate,
    referenceNumber: entry.referenceNumber,
    notes: entry.notes,
    createdBy: entry.createdBy,
    updatedBy: entry.updatedBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}


async function syncPmsRentDueItemFromConfirmedPayments(
  tx: Prisma.TransactionClient,
  input: { rentDueItemId: string; updatedById?: string | null },
) {
  const rentDueItem = await tx.pmsRentDueItem.findUniqueOrThrow({
    where: { id: input.rentDueItemId },
    select: {
      id: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      status: true,
    },
  });

  const [aggregate, latestConfirmedPayment] = await Promise.all([
    tx.pmsRentPayment.aggregate({
      where: {
        rentDueItemId: input.rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED,
      },
      _sum: { amount: true },
    }),
    tx.pmsRentPayment.findFirst({
      where: {
        rentDueItemId: input.rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED,
      },
      orderBy: [{ paidAt: "desc" }, { updatedAt: "desc" }],
      select: { paidAt: true, confirmedAt: true, updatedAt: true },
    }),
  ]);

  const paidAmount = roundMoney(rentDecimalToNumber(aggregate._sum.amount));
  const status = getPaidRentStatus({ rentDueItem, paidAmount });

  return tx.pmsRentDueItem.update({
    where: { id: input.rentDueItemId },
    data: {
      paidAmount,
      status,
      paidAt:
        status === PmsRentDueStatus.PAID
          ? (latestConfirmedPayment?.paidAt ?? latestConfirmedPayment?.confirmedAt ?? latestConfirmedPayment?.updatedAt ?? new Date())
          : null,
      ...(input.updatedById !== undefined ? { updatedById: input.updatedById } : {}),
    },
    include: pmsRentDueItemInclude,
  });
}


const pmsVendorInclude = {
  _count: { select: { workOrders: true, quotes: true } },
} satisfies Prisma.PmsVendorInclude;

type PmsVendorWithRelations = Prisma.PmsVendorGetPayload<{
  include: typeof pmsVendorInclude;
}>;

const pmsMaintenanceQuoteInclude = {
  vendor: { select: { id: true, name: true, trade: true, phone: true, email: true, active: true } },
  approvedBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.PmsMaintenanceQuoteInclude;

type PmsMaintenanceQuoteWithRelations = Prisma.PmsMaintenanceQuoteGetPayload<{
  include: typeof pmsMaintenanceQuoteInclude;
}>;

const pmsWorkOrderInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
    },
  },
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  vendor: { select: { id: true, name: true, trade: true, phone: true, email: true, active: true } },
  quotes: {
    include: pmsMaintenanceQuoteInclude,
    orderBy: { updatedAt: "desc" as const },
    take: 5,
  },
};

type PmsWorkOrderWithRelations = Prisma.PmsWorkOrderGetPayload<{
  include: typeof pmsWorkOrderInclude;
}>;

const pmsInspectionInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
    },
  },
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  lease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  },
};

type PmsInspectionWithRelations = Prisma.PmsInspectionGetPayload<{
  include: typeof pmsInspectionInclude;
}>;


const pmsDocumentInclude = {
  property: { select: { id: true, name: true, code: true, companyId: true } },
  unit: { select: { id: true, unitNumber: true, unitName: true } },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  lease: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
  workOrder: { select: { id: true, title: true, status: true } },
  inspection: { select: { id: true, title: true, status: true, scheduledFor: true } },
  charge: { select: { id: true, chargeNumber: true, status: true } },
  securityDepositTransaction: { select: { id: true, type: true, status: true } },
  ownerPayoutBatch: { select: { id: true, payoutNumber: true, status: true } },
  asset: { select: { id: true, assetCode: true, name: true } },
  statement: { select: { id: true, status: true, periodStart: true, periodEnd: true } },
  inspectionDefect: { select: { id: true, title: true, status: true } },
  uploadedBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PmsDocumentInclude;

type PmsDocumentWithRelations = Prisma.PmsDocumentGetPayload<{
  include: typeof pmsDocumentInclude;
}>;

const pmsChecklistInclude = {
  property: { select: { id: true, name: true, code: true, companyId: true } },
  unit: { select: { id: true, unitNumber: true, unitName: true } },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  lease: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PmsMoveChecklistItemInclude;

type PmsChecklistWithRelations = Prisma.PmsMoveChecklistItemGetPayload<{
  include: typeof pmsChecklistInclude;
}>;

function pmsDocumentResponse(document: PmsDocumentWithRelations) {
  return {
    id: document.id,
    companyId: document.companyId,
    propertyId: document.propertyId,
    property: document.property,
    unitId: document.unitId,
    unit: document.unit,
    tenantId: document.tenantId,
    tenant: document.tenant,
    leaseId: document.leaseId,
    lease: document.lease,
    workOrderId: document.workOrderId,
    workOrder: document.workOrder,
    inspectionId: document.inspectionId,
    inspection: document.inspection,
    chargeId: document.chargeId,
    charge: document.charge,
    securityDepositTransactionId: document.securityDepositTransactionId,
    securityDepositTransaction: document.securityDepositTransaction,
    ownerPayoutBatchId: document.ownerPayoutBatchId,
    ownerPayoutBatch: document.ownerPayoutBatch,
    assetId: document.assetId,
    asset: document.asset,
    statementId: document.statementId,
    statement: document.statement,
    inspectionDefectId: document.inspectionDefectId,
    inspectionDefect: document.inspectionDefect,
    type: document.type,
    title: document.title,
    fileUrl: `/api/pms/documents/${document.id}/download`,
    downloadUrl: `/api/pms/documents/${document.id}/download`,
    storageDriver: document.storageDriver,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    checksumSha256: document.checksumSha256,
    scanStatus: document.scanStatus,
    fileVersion: document.fileVersion,
    fileUploadedAt: document.fileUploadedAt,
    fileReplacedAt: document.fileReplacedAt,
    legacyMigrationRequired: document.storageDriver === PmsDocumentStorageDriver.LEGACY_REFERENCE,
    status: document.status,
    expiryDate: document.expiryDate,
    notes: document.notes,
    uploadedBy: document.uploadedBy,
    updatedBy: document.updatedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function pmsChecklistResponse(item: PmsChecklistWithRelations) {
  return {
    id: item.id,
    companyId: item.companyId,
    leaseId: item.leaseId,
    lease: item.lease,
    propertyId: item.propertyId,
    property: item.property,
    unitId: item.unitId,
    unit: item.unit,
    tenantId: item.tenantId,
    tenant: item.tenant,
    type: item.type,
    title: item.title,
    description: item.description,
    status: item.status,
    completedAt: item.completedAt,
    notes: item.notes,
    createdBy: item.createdBy,
    updatedBy: item.updatedBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function pmsVendorResponse(vendor: PmsVendorWithRelations) {
  return {
    id: vendor.id,
    companyId: vendor.companyId,
    name: vendor.name,
    phone: vendor.phone,
    email: vendor.email,
    trade: vendor.trade,
    notes: vendor.notes,
    active: vendor.active,
    counts: vendor._count,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

function pmsMaintenanceQuoteResponse(quote: PmsMaintenanceQuoteWithRelations) {
  return {
    id: quote.id,
    companyId: quote.companyId,
    workOrderId: quote.workOrderId,
    vendorId: quote.vendorId,
    vendor: quote.vendor,
    amount: decimalToString(quote.amount),
    currency: quote.currency,
    description: quote.description,
    status: quote.status,
    submittedAt: quote.submittedAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    approvedBy: quote.approvedBy,
    notes: quote.notes,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function pmsWorkOrderResponse(workOrder: PmsWorkOrderWithRelations) {
  return {
    id: workOrder.id,
    companyId: workOrder.companyId,
    propertyId: workOrder.propertyId,
    property: workOrder.property,
    unitId: workOrder.unitId,
    unit: workOrder.unit,
    tenantId: workOrder.tenantId,
    tenant: workOrder.tenant,
    vendorId: workOrder.vendorId,
    vendor: workOrder.vendor,
    title: workOrder.title,
    description: workOrder.description,
    priority: workOrder.priority,
    status: workOrder.status,
    assignedToText: workOrder.assignedToText,
    vendorText: workOrder.vendorText,
    cost: decimalToString(workOrder.cost),
    currency: workOrder.currency,
    scheduledFor: workOrder.scheduledFor,
    resolvedAt: workOrder.resolvedAt,
    targetDate: workOrder.targetDate,
    imageUrls: workOrder.imageUrls,
    documentUrls: workOrder.documentUrls,
    beforeImageUrls: workOrder.beforeImageUrls,
    afterImageUrls: workOrder.afterImageUrls,
    beforeDocumentUrls: workOrder.beforeDocumentUrls,
    afterDocumentUrls: workOrder.afterDocumentUrls,
    recurrenceType: workOrder.recurrenceType,
    nextScheduledDate: workOrder.nextScheduledDate,
    generatedFromWorkOrderId: workOrder.generatedFromWorkOrderId,
    approvedQuoteId: workOrder.approvedQuoteId,
    tenantConfirmedAt: workOrder.tenantConfirmedAt,
    tenantReopenedAt: workOrder.tenantReopenedAt,
    tenantConfirmationNotes: workOrder.tenantConfirmationNotes,
    overdue: Boolean(workOrder.targetDate && workOrder.targetDate < new Date() && workOrder.status !== PmsMaintenanceStatus.RESOLVED && workOrder.status !== PmsMaintenanceStatus.CANCELLED),
    quotes: workOrder.quotes.map(pmsMaintenanceQuoteResponse),
    notes: workOrder.notes,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  };
}

function pmsCommunicationTemplateResponse(template: {
  id: string;
  companyId: string;
  name: string;
  channel: PmsCommunicationChannel;
  type: string | null;
  subject: string | null;
  body: string;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    companyId: template.companyId,
    name: template.name,
    channel: template.channel,
    type: template.type,
    subject: template.subject,
    body: template.body,
    active: template.active,
    notes: template.notes,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}


const pmsCommunicationLogInclude = {
  template: { select: { id: true, name: true, channel: true, type: true } },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  lease: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
  rentDueItem: { select: { id: true, dueDate: true, amount: true, paidAmount: true, currency: true, status: true } },
  workOrder: { select: { id: true, title: true, status: true, priority: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  sentBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.PmsCommunicationLogInclude;

type PmsCommunicationLogWithRelations = Prisma.PmsCommunicationLogGetPayload<{
  include: typeof pmsCommunicationLogInclude;
}>;

function pmsCommunicationLogResponse(log: PmsCommunicationLogWithRelations) {
  return {
    id: log.id,
    companyId: log.companyId,
    templateId: log.templateId,
    template: log.template,
    tenantId: log.tenantId,
    tenant: log.tenant,
    leaseId: log.leaseId,
    lease: log.lease,
    rentDueItemId: log.rentDueItemId,
    rentDueItem: log.rentDueItem
      ? {
          ...log.rentDueItem,
          amount: decimalToString(log.rentDueItem.amount),
          paidAmount: decimalToString(log.rentDueItem.paidAmount),
        }
      : null,
    workOrderId: log.workOrderId,
    workOrder: log.workOrder,
    channel: log.channel,
    subject: log.subject,
    body: log.body,
    status: log.status,
    deliveryMetadata: log.deliveryMetadata,
    sentAt: log.sentAt,
    notes: log.notes,
    createdBy: log.createdBy,
    sentBy: log.sentBy,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

const TEMPLATE_VARIABLE_LABELS = [
  "tenantName",
  "propertyName",
  "unitLabel",
  "dueDate",
  "amount",
  "leaseEndDate",
  "maintenanceTitle",
  "maintenanceStatus",
] as const;

function inferCommunicationContext(data: {
  rentDueItemId?: string | null;
  workOrderId?: string | null;
  leaseId?: string | null;
}): "rent" | "maintenance" | "general" {
  if (data.rentDueItemId) return "rent";
  if (data.workOrderId) return "maintenance";
  if (data.leaseId) return "general";
  return "general";
}

function renderPmsTemplate(input: string | null | undefined, variables: Record<string, string>) {
  if (!input) return input ?? null;
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "");
}

async function buildPmsCommunicationVariables(companyId: string, data: {
  tenantId?: string | null;
  leaseId?: string | null;
  rentDueItemId?: string | null;
  workOrderId?: string | null;
  variables?: Record<string, string>;
}) {
  let tenant: { fullName: string; email: string | null } | null = null;
  let property: { name: string } | null = null;
  let unit: { unitNumber: string; unitName: string | null } | null = null;
  let lease: { endDate: Date | null } | null = null;
  let rentDueItem: { dueDate: Date; amount: Prisma.Decimal; currency: string } | null = null;
  let workOrder: { title: string; status: PmsMaintenanceStatus } | null = null;

  if (data.rentDueItemId) {
    const rent = await prisma.pmsRentDueItem.findFirst({
      where: { id: data.rentDueItemId, companyId },
      include: {
        tenant: { select: { fullName: true, email: true } },
        property: { select: { name: true } },
        unit: { select: { unitNumber: true, unitName: true } },
        lease: { select: { endDate: true } },
      },
    });
    if (!rent) throw new AppError(404, "PMS rent due item not found");
    tenant = rent.tenant;
    property = rent.property;
    unit = rent.unit;
    lease = rent.lease;
    rentDueItem = { dueDate: rent.dueDate, amount: rent.amount, currency: rent.currency };
  } else if (data.workOrderId) {
    const work = await prisma.pmsWorkOrder.findFirst({
      where: { id: data.workOrderId, companyId },
      include: {
        tenant: { select: { fullName: true, email: true } },
        property: { select: { name: true } },
        unit: { select: { unitNumber: true, unitName: true } },
      },
    });
    if (!work) throw new AppError(404, "PMS work order not found");
    tenant = work.tenant;
    property = work.property;
    unit = work.unit;
    workOrder = { title: work.title, status: work.status };
  } else if (data.leaseId) {
    const existingLease = await prisma.pmsLease.findFirst({
      where: { id: data.leaseId, companyId },
      include: {
        tenant: { select: { fullName: true, email: true } },
        property: { select: { name: true } },
        unit: { select: { unitNumber: true, unitName: true } },
      },
    });
    if (!existingLease) throw new AppError(404, "PMS lease not found");
    tenant = existingLease.tenant;
    property = existingLease.property;
    unit = existingLease.unit;
    lease = { endDate: existingLease.endDate };
  } else if (data.tenantId) {
    const existingTenant = await prisma.pmsTenant.findFirst({
      where: { id: data.tenantId, companyId },
      select: { fullName: true, email: true },
    });
    if (!existingTenant) throw new AppError(404, "PMS tenant not found");
    tenant = existingTenant;
  }

  return {
    tenantName: tenant?.fullName ?? "",
    propertyName: property?.name ?? "",
    unitLabel: unit ? [unit.unitNumber, unit.unitName].filter(Boolean).join(" · ") : "",
    dueDate: rentDueItem?.dueDate ? rentDueItem.dueDate.toISOString().slice(0, 10) : "",
    amount: rentDueItem ? `${decimalToString(rentDueItem.amount)} ${rentDueItem.currency}` : "",
    leaseEndDate: lease?.endDate ? lease.endDate.toISOString().slice(0, 10) : "",
    maintenanceTitle: workOrder?.title ?? "",
    maintenanceStatus: workOrder?.status ?? "",
    ...(data.variables ?? {}),
  };
}

async function findTenantPortalNotificationUser(companyId: string, tenantId?: string | null) {
  if (!tenantId) return null;
  const access = await prisma.pmsTenantPortalAccess.findFirst({
    where: { companyId, tenantId, active: true },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });
  return access?.userId ?? null;
}

function pmsPolicyResponse(policy: {
  id: string;
  companyId: string;
  title: string;
  category: PmsPolicyCategory;
  body: string;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: policy.id,
    companyId: policy.companyId,
    title: policy.title,
    category: policy.category,
    body: policy.body,
    active: policy.active,
    notes: policy.notes,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

function pmsInspectionResponse(inspection: PmsInspectionWithRelations) {
  return {
    id: inspection.id,
    companyId: inspection.companyId,
    propertyId: inspection.propertyId,
    property: inspection.property,
    unitId: inspection.unitId,
    unit: inspection.unit,
    tenantId: inspection.tenantId,
    tenant: inspection.tenant,
    leaseId: inspection.leaseId,
    lease: inspection.lease,
    title: inspection.title,
    status: inspection.status,
    scheduledFor: inspection.scheduledFor,
    completedAt: inspection.completedAt,
    notes: inspection.notes,
    feedback: inspection.feedback,
    rating: inspection.rating,
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };
}

async function assertPmsOperationalLinksBelongToCompany(input: {
  companyId: string;
  propertyId: string;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  vendorId?: string | null;
  generatedFromWorkOrderId?: string | null;
}) {
  const property = await prisma.pmsProperty.findFirst({
    where: {
      id: input.propertyId,
      companyId: input.companyId,
    },
    select: {
      id: true,
    },
  });

  if (!property) {
    throw new AppError(400, "PMS property must belong to the PMS company.");
  }

  if (input.unitId) {
    const unit = await prisma.pmsUnit.findFirst({
      where: {
        id: input.unitId,
        companyId: input.companyId,
        propertyId: input.propertyId,
      },
      select: {
        id: true,
      },
    });

    if (!unit) {
      throw new AppError(
        400,
        "PMS unit must belong to the selected PMS property and company.",
      );
    }
  }

  if (input.tenantId) {
    const tenant = await prisma.pmsTenant.findFirst({
      where: {
        id: input.tenantId,
        companyId: input.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new AppError(400, "PMS tenant must belong to the PMS company.");
    }
  }

  if (input.leaseId) {
    const lease = await prisma.pmsLease.findFirst({
      where: {
        id: input.leaseId,
        companyId: input.companyId,
        propertyId: input.propertyId,
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!lease) {
      throw new AppError(
        400,
        "PMS lease must belong to the selected PMS company context.",
      );
    }
  }

  if (input.vendorId) {
    const vendor = await prisma.pmsVendor.findFirst({
      where: { id: input.vendorId, companyId: input.companyId },
      select: { id: true },
    });

    if (!vendor) {
      throw new AppError(400, "PMS vendor must belong to this PMS company.");
    }
  }

  if (input.generatedFromWorkOrderId) {
    const sourceWorkOrder = await prisma.pmsWorkOrder.findFirst({
      where: { id: input.generatedFromWorkOrderId, companyId: input.companyId },
      select: { id: true },
    });

    if (!sourceWorkOrder) {
      throw new AppError(400, "Source recurring PMS work order must belong to this PMS company.");
    }
  }
}

function buildPmsPropertyWriteData(
  data: z.infer<typeof pmsPropertyUpdateSchema>,
  userId: string,
): Prisma.PmsPropertyUncheckedUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.code !== undefined
      ? { code: normalizeNullableText(data.code) }
      : {}),
    ...(data.propertyType !== undefined
      ? { propertyType: normalizeNullableText(data.propertyType) }
      : {}),
    ...(data.description !== undefined
      ? { description: normalizeNullableText(data.description) }
      : {}),
    ...(data.addressLine !== undefined
      ? { addressLine: normalizeNullableText(data.addressLine) }
      : {}),
    ...(data.city !== undefined
      ? { city: normalizeNullableText(data.city) }
      : {}),
    ...(data.area !== undefined
      ? { area: normalizeNullableText(data.area) }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    ...(data.mapPlaceLabel !== undefined
      ? { mapPlaceLabel: normalizeNullableText(data.mapPlaceLabel) }
      : {}),
    ...(data.mapAddress !== undefined
      ? { mapAddress: normalizeNullableText(data.mapAddress) }
      : {}),
    ...(data.mapGoogleUrl !== undefined
      ? { mapGoogleUrl: normalizeNullableText(data.mapGoogleUrl) }
      : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
    ...(data.developerProjectId !== undefined
      ? { developerProjectId: data.developerProjectId }
      : {}),
    ...(data.publicListingId !== undefined
      ? { publicListingId: data.publicListingId }
      : {}),
    updatedById: userId,
  };
}

function buildPmsUnitWriteData(
  data: z.infer<typeof pmsUnitUpdateSchema>,
  userId: string,
): Prisma.PmsUnitUncheckedUpdateInput {
  const nextStatus = data.status;

  return {
    ...(data.unitNumber !== undefined ? { unitNumber: data.unitNumber } : {}),
    ...(data.unitName !== undefined
      ? { unitName: normalizeNullableText(data.unitName) }
      : {}),
    ...(data.floor !== undefined
      ? { floor: normalizeNullableText(data.floor) }
      : {}),
    ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
    ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
    ...(data.areaSqm !== undefined ? { areaSqm: data.areaSqm } : {}),
    ...(data.operationalStatus !== undefined ? { operationalStatus: data.operationalStatus } : {}),
    ...(nextStatus !== undefined ? { operationalStatus: operationalStatusFromLegacyUnitStatus(nextStatus) } : {}),
    ...(data.rentAmount !== undefined ? { rentAmount: data.rentAmount } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.developerProjectId !== undefined
      ? { developerProjectId: data.developerProjectId }
      : {}),
    ...(data.publicListingId !== undefined
      ? { publicListingId: data.publicListingId }
      : {}),
    updatedById: userId,
  };
}


function buildPmsTenantWriteData(
  data: z.infer<typeof pmsTenantUpdateSchema>,
  userId: string,
): Prisma.PmsTenantUncheckedUpdateInput {
  return {
    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
    ...(data.phone !== undefined
      ? { phone: normalizeNullableText(data.phone) }
      : {}),
    ...(data.email !== undefined
      ? { email: normalizeNullableText(data.email) }
      : {}),
    ...(data.nationality !== undefined
      ? { nationality: normalizeNullableText(data.nationality) }
      : {}),
    ...(data.nationalId !== undefined
      ? { nationalId: normalizeNullableText(data.nationalId) }
      : {}),
    ...(data.passportNumber !== undefined
      ? { passportNumber: normalizeNullableText(data.passportNumber) }
      : {}),
    ...(data.emergencyContactName !== undefined
      ? { emergencyContactName: normalizeNullableText(data.emergencyContactName) }
      : {}),
    ...(data.emergencyContactPhone !== undefined
      ? { emergencyContactPhone: normalizeNullableText(data.emergencyContactPhone) }
      : {}),
    ...(data.emergencyContactEmail !== undefined
      ? { emergencyContactEmail: normalizeNullableText(data.emergencyContactEmail) }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    updatedById: userId,
  };
}

function buildPmsLeaseWriteData(
  data: z.infer<typeof pmsLeaseUpdateSchema>,
  userId: string,
): Prisma.PmsLeaseUncheckedUpdateInput {
  return {
    ...(data.title !== undefined
      ? { title: normalizeNullableText(data.title) }
      : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
    ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    ...(data.rentFrequency !== undefined
      ? { rentFrequency: data.rentFrequency }
      : {}),
    ...(data.rentAmount !== undefined ? { rentAmount: data.rentAmount } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.securityDeposit !== undefined
      ? { securityDeposit: data.securityDeposit }
      : {}),
    ...(data.dueDayOfMonth !== undefined
      ? { dueDayOfMonth: data.dueDayOfMonth }
      : {}),
    ...(data.contractDraftId !== undefined
      ? { contractDraftId: data.contractDraftId }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    updatedById: userId,
  };
}

function addMonthsClamped(date: Date, months: number, preferredDay: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(preferredDay, lastDay));
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthsForFrequency(frequency: PaymentScheduleFrequency) {
  if (frequency === PaymentScheduleFrequency.QUARTERLY) return 3;
  if (frequency === PaymentScheduleFrequency.YEARLY) return 12;
  if (frequency === PaymentScheduleFrequency.ONE_TIME) return 0;
  return 1;
}

function generatePmsRentDueItems(input: {
  companyId: string;
  leaseId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: Date;
  endDate?: Date | null;
  frequency: PaymentScheduleFrequency;
  amount: number;
  currency: string;
  dueDayOfMonth?: number | null;
  createdById: string;
}): Prisma.PmsRentDueItemUncheckedCreateInput[] {
  const startDate = normalizeDateOnly(input.startDate);
  const endDate = input.endDate ? normalizeDateOnly(input.endDate) : null;
  const stepMonths = monthsForFrequency(input.frequency);
  const preferredDay = input.dueDayOfMonth ?? startDate.getUTCDate();
  const maxItems = input.frequency === PaymentScheduleFrequency.ONE_TIME ? 1 : 36;
  const items: Prisma.PmsRentDueItemUncheckedCreateInput[] = [];
  let periodStart = startDate;

  for (let index = 0; index < maxItems; index += 1) {
    const dueDate =
      input.frequency === PaymentScheduleFrequency.ONE_TIME
        ? startDate
        : addMonthsClamped(startDate, index * stepMonths, preferredDay);

    if (endDate && dueDate > endDate) break;

    const nextPeriodStart =
      input.frequency === PaymentScheduleFrequency.ONE_TIME
        ? endDate ?? startDate
        : addMonthsClamped(periodStart, stepMonths, periodStart.getUTCDate());
    const periodEnd = endDate && nextPeriodStart > endDate ? endDate : addDays(nextPeriodStart, -1);

    items.push({
      companyId: input.companyId,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      dueDate,
      periodStart,
      periodEnd,
      amount: input.amount,
      paidAmount: 0,
      currency: input.currency,
      status: PmsRentDueStatus.UNPAID,
      createdById: input.createdById,
      updatedById: input.createdById,
    });

    if (input.frequency === PaymentScheduleFrequency.ONE_TIME) break;
    periodStart = addDays(periodEnd, 1);
  }

  return items;
}

function getLeaseOccupancyStatus(status: PmsLeaseStatus) {
  return status === PmsLeaseStatus.ACTIVE || status === PmsLeaseStatus.EXPIRING;
}

pmsRouter.get("/tenants", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsTenantListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const canViewSensitiveTenants = canViewPmsSensitiveData(access.member);
    const search = query.search?.trim();
    const tenantSearchFilters: Prisma.PmsTenantWhereInput[] = search
      ? [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ]
      : [];
    if (search && canViewSensitiveTenants) {
      tenantSearchFilters.push(
        { nationalId: { contains: search, mode: "insensitive" } },
        { passportNumber: { contains: search, mode: "insensitive" } },
      );
    }
    const scopedPropertyId = pmsScopedPropertyIdWhere(access);
    const where: Prisma.PmsTenantWhereInput = {
      companyId: access.company.id,
      ...(scopedPropertyId
        ? { leases: { some: { propertyId: scopedPropertyId } } }
        : {}),
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(search
        ? {
            OR: tenantSearchFilters,
          }
        : {}),
    };

    const [tenants, total] = await prisma.$transaction([
      prisma.pmsTenant.findMany({
        where,
        include: pmsTenantInclude,
        orderBy: buildPmsTenantOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsTenant.count({ where }),
    ]);
    const scopedLeases = scopedPropertyId
      ? await prisma.pmsLease.findMany({
          where: {
            companyId: access.company.id,
            tenantId: { in: tenants.map((tenant) => tenant.id) },
            propertyId: scopedPropertyId,
          },
          select: { tenantId: true },
        })
      : [];
    const scopedLeaseCounts = scopedLeases.reduce((counts, lease) => {
      counts.set(lease.tenantId, (counts.get(lease.tenantId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenants: tenants.map((tenant) =>
        pmsTenantResponse(
          tenant,
          scopedPropertyId ? scopedLeaseCounts.get(tenant.id) ?? 0 : undefined,
          canViewSensitiveTenants,
        ),
      ),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: tenants.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/tenants", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsTenantCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: data.companyId,
    });
    assertCanManagePmsTenancies(access.member);
    if (data.nationalId !== undefined || data.passportNumber !== undefined) {
      assertCanViewPmsSensitiveData(access.member);
    }

    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: access.company.id,
        fullName: data.fullName,
        phone: normalizeNullableText(data.phone),
        email: normalizeNullableText(data.email),
        nationality: normalizeNullableText(data.nationality),
        nationalId: normalizeNullableText(data.nationalId),
        passportNumber: normalizeNullableText(data.passportNumber),
        emergencyContactName: normalizeNullableText(data.emergencyContactName),
        emergencyContactPhone: normalizeNullableText(data.emergencyContactPhone),
        emergencyContactEmail: normalizeNullableText(data.emergencyContactEmail),
        notes: normalizeNullableText(data.notes),
        active: data.active,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsTenantInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS tenant created",
      message: `${req.user.email} created PMS tenant ${tenant.fullName}.`,
      metadata: { action: "create", resourceType: "pmsTenant", tenantId: tenant.id },
    });

    res.status(201).json({ tenant: pmsTenantResponse(tenant, undefined, canViewPmsSensitiveData(access.member)) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/tenants/:tenantId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { tenantId } = pmsTenantParamsSchema.parse(req.params);
    const tenant = await prisma.pmsTenant.findUnique({
      where: { id: tenantId },
      include: pmsTenantInclude,
    });

    if (!tenant) {
      throw new AppError(404, "PMS tenant not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: tenant.companyId,
    });
    await assertCanAccessPmsTenantScope(access, tenant.id);
    const scopedLeaseCount = isPmsPropertyScopeRestricted(access)
      ? await prisma.pmsLease.count({
          where: {
            companyId: access.company.id,
            tenantId: tenant.id,
            propertyId: { in: access.member.propertyScope.propertyIds },
          },
        })
      : undefined;

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenant: pmsTenantResponse(tenant, scopedLeaseCount, canViewPmsSensitiveData(access.member)),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/tenants/:tenantId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { tenantId } = pmsTenantParamsSchema.parse(req.params);
    const data = pmsTenantUpdateSchema.parse(req.body);
    const existing = await prisma.pmsTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS tenant not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanManagePmsTenancies(access.member);
    await assertCanAccessPmsTenantScope(access, existing.id);
    if (data.nationalId !== undefined || data.passportNumber !== undefined) {
      assertCanViewPmsSensitiveData(access.member);
    }

    const tenant = await prisma.pmsTenant.update({
      where: { id: tenantId },
      data: buildPmsTenantWriteData(data, req.user.id),
      include: pmsTenantInclude,
    });
    const scopedLeaseCount = isPmsPropertyScopeRestricted(access)
      ? await prisma.pmsLease.count({
          where: {
            companyId: access.company.id,
            tenantId: tenant.id,
            propertyId: { in: access.member.propertyScope.propertyIds },
          },
        })
      : undefined;

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS tenant updated",
      message: `${req.user.email} updated PMS tenant ${tenant.fullName}.`,
      metadata: {
        action: "update",
        resourceType: "pmsTenant",
        tenantId: tenant.id,
        changedFields: Object.keys(data),
      },
    });

    res.json({ tenant: pmsTenantResponse(tenant, scopedLeaseCount, canViewPmsSensitiveData(access.member)) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/tenants/:tenantId/portal-access", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { tenantId } = pmsTenantParamsSchema.parse(req.params);
    const data = pmsTenantPortalAccessUpsertSchema.parse(req.body);
    const tenant = await prisma.pmsTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyId: true, fullName: true, email: true, active: true },
    });

    if (!tenant) {
      throw new AppError(404, "PMS tenant not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: tenant.companyId,
    });
    assertCanManagePmsTenancies(access.member);
    await assertCanAccessPmsTenantScope(access, tenant.id);

    const targetUser = await prisma.user.findFirst({
      where: data.userId ? { id: data.userId } : { email: data.email ?? '' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        suspendedAt: true,
        deactivatedAt: true,
      },
    });

    if (!targetUser) {
      throw new AppError(404, "User not found");
    }

    if (targetUser.suspendedAt || targetUser.deactivatedAt) {
      throw new AppError(400, "Suspended or deleted users cannot receive tenant portal access.");
    }

    const tenantAccess = await prisma.pmsTenantPortalAccess.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: targetUser.id,
        },
      },
      create: {
        companyId: access.company.id,
        tenantId: tenant.id,
        userId: targetUser.id,
        active: data.active,
        createdById: req.user.id,
      },
      update: {
        active: data.active,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      targetUserId: targetUser.id,
      title: "PMS tenant portal access updated",
      message: `Your tenant portal access for ${tenant.fullName} was updated.`,
      metadata: {
        action: "upsert",
        resourceType: "pmsTenantPortalAccess",
        tenantAccessId: tenantAccess.id,
        tenantId: tenant.id,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        active: tenantAccess.active,
      },
    });

    res.status(201).json({
      tenantAccess: {
        id: tenantAccess.id,
        companyId: tenantAccess.companyId,
        tenantId: tenantAccess.tenantId,
        userId: tenantAccess.userId,
        active: tenantAccess.active,
        user: tenantAccess.user,
        createdAt: tenantAccess.createdAt,
        updatedAt: tenantAccess.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsLeaseListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
    });
    const search = query.search?.trim();
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsLeaseWhereInput = {
      companyId: access.company.id,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { tenant: { fullName: { contains: search, mode: "insensitive" } } },
              { property: { name: { contains: search, mode: "insensitive" } } },
              { unit: { unitNumber: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [leases, total] = await prisma.$transaction([
      prisma.pmsLease.findMany({
        where,
        include: pmsLeaseInclude,
        orderBy: buildPmsLeaseOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsLease.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      leases: leases.map(pmsLeaseResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: leases.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/leases", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsLeaseCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: data.companyId,
    });
    assertCanManagePmsTenancies(access.member);
    assertCanAccessPmsPropertyScope(access, data.propertyId);

    const [tenant, property, unit] = await Promise.all([
      prisma.pmsTenant.findFirst({
        where: { id: data.tenantId, companyId: access.company.id, active: true },
        select: { id: true },
      }),
      prisma.pmsProperty.findFirst({
        where: { id: data.propertyId, companyId: access.company.id, active: true },
        select: { id: true },
      }),
      prisma.pmsUnit.findFirst({
        where: {
          id: data.unitId,
          propertyId: data.propertyId,
          companyId: access.company.id,
        },
        select: { id: true, status: true },
      }),
    ]);

    if (!tenant) throw new AppError(400, "PMS tenant must belong to the selected company.");
    if (!property) throw new AppError(400, "PMS property must belong to the selected company.");
    if (!unit) throw new AppError(400, "PMS unit must belong to the selected property and company.");

    if (data.contractDraftId) {
      const contractDraft = await prisma.rentalContractDraft.findFirst({
        where: {
          id: data.contractDraftId,
          OR: [
            { createdById: userId },
            { listing: { developerId: access.company.id } },
          ],
        },
        select: { id: true },
      });

      if (!contractDraft) {
        throw new AppError(400, "Linked contract draft is not available for this PMS workspace.");
      }
    }

    const lease = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PmsUnit" WHERE "id" = ${data.unitId} FOR UPDATE`);
      if (getLeaseOccupancyStatus(data.status)) {
        const existingActiveLease = await tx.pmsLease.findFirst({
          where: { unitId: data.unitId, status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] } },
          select: { id: true },
        });
        if (existingActiveLease) throw new AppError(409, "This unit already has an active PMS lease.");
      }
      const createdLease = await tx.pmsLease.create({
        data: {
          companyId: access.company.id,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          title: normalizeNullableText(data.title),
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          rentFrequency: data.rentFrequency,
          rentAmount: data.rentAmount,
          currency: data.currency,
          securityDeposit: data.securityDeposit ?? null,
          dueDayOfMonth: data.dueDayOfMonth ?? data.startDate.getUTCDate(),
          contractDraftId: data.contractDraftId ?? null,
          notes: normalizeNullableText(data.notes),
          createdById: userId,
          updatedById: userId,
        },
      });

      if (data.generateRentDueItems) {
        const dueItems = generatePmsRentDueItems({
          companyId: access.company.id,
          leaseId: createdLease.id,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          startDate: data.startDate,
          endDate: data.endDate,
          frequency: data.rentFrequency,
          amount: data.rentAmount,
          currency: data.currency,
          dueDayOfMonth: data.dueDayOfMonth ?? data.startDate.getUTCDate(),
          createdById: userId,
        });

        if (dueItems.length > 0) {
          await tx.pmsRentDueItem.createMany({ data: dueItems });
          const createdDueItems = await tx.pmsRentDueItem.findMany({
            where: { leaseId: createdLease.id },
          });
          for (const dueItem of createdDueItems) {
            await ensureRentDueStructuredCharge(tx, dueItem, userId);
          }
        }
      }

      await ensureLeaseSecurityDepositAccount(tx, {
        companyId: access.company.id,
        propertyId: createdLease.propertyId,
        unitId: createdLease.unitId,
        leaseId: createdLease.id,
        tenantId: createdLease.tenantId,
        currency: createdLease.currency,
        expectedAmount: createdLease.securityDeposit,
      });

      if (getLeaseOccupancyStatus(data.status)) {
        await syncPmsUnitOccupancy(tx, { unitId: data.unitId, occupied: true, userId });
      }

      return tx.pmsLease.findUniqueOrThrow({
        where: { id: createdLease.id },
        include: pmsLeaseInclude,
      });
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS lease created",
      message: `${req.user.email} created PMS lease ${lease.id}.`,
      metadata: {
        action: "create",
        resourceType: "pmsLease",
        leaseId: lease.id,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        status: lease.status,
      },
      request: req,
    });

    res.status(201).json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(isPrismaErrorCode(error, "P2002") ? new AppError(409, "This unit already has an active PMS lease.") : error);
  }
});

pmsRouter.get("/leases/:leaseId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      include: pmsLeaseInclude,
    });

    if (!lease) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: lease.companyId,
    });
    assertCanAccessPmsPropertyScope(access, lease.propertyId);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      lease: pmsLeaseResponse(lease),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/leases/:leaseId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const data = pmsLeaseUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true, propertyId: true, unitId: true, startDate: true, endDate: true, status: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: existing.companyId,
    });
    assertCanManagePmsTenancies(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);

    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }
    if (data.startDate && !data.endDate && existing.endDate && existing.endDate < data.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }
    if (data.endDate && !data.startDate && data.endDate < existing.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }

    const lease = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PmsUnit" WHERE "id" = ${existing.unitId} FOR UPDATE`);
      const nextStatus = data.status ?? existing.status;
      if (getLeaseOccupancyStatus(nextStatus)) {
        const conflictingLease = await tx.pmsLease.findFirst({
          where: { id: { not: leaseId }, unitId: existing.unitId, status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] } },
          select: { id: true },
        });
        if (conflictingLease) throw new AppError(409, "This unit already has an active PMS lease.");
      }
      const updated = await tx.pmsLease.update({
        where: { id: leaseId },
        data: buildPmsLeaseWriteData(data, userId),
        include: pmsLeaseInclude,
      });

      if (data.status) {
        if (getLeaseOccupancyStatus(data.status)) {
          await syncPmsUnitOccupancy(tx, { unitId: existing.unitId, occupied: true, userId });
        } else if (
          data.status === PmsLeaseStatus.ENDED ||
          data.status === PmsLeaseStatus.TERMINATED
        ) {
          const otherActiveLease = await tx.pmsLease.findFirst({
            where: {
              id: { not: leaseId },
              unitId: existing.unitId,
              status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
            },
            select: { id: true },
          });

          if (!otherActiveLease) {
            await syncPmsUnitOccupancy(tx, { unitId: existing.unitId, occupied: false, userId });
          }
        }
      }

      return updated;
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS lease updated",
      message: `${req.user.email} updated PMS lease ${lease.id}.`,
      metadata: {
        action: "update",
        resourceType: "pmsLease",
        leaseId: lease.id,
        status: lease.status,
        changedFields: Object.keys(data),
      },
      request: req,
    });

    res.json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(isPrismaErrorCode(error, "P2002") ? new AppError(409, "This unit already has an active PMS lease.") : error);
  }
});

pmsRouter.post("/leases/:leaseId/renewal-draft", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const data = pmsLeaseRenewalDraftSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      include: pmsLeaseInclude,
    });

    if (!existing) throw new AppError(404, "PMS lease not found");

    const access = await resolvePmsAccessOrThrow({ userId, companyId: existing.companyId });
    assertCanManagePmsTenancies(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);

    const renewal = await prisma.pmsLease.create({
      data: {
        companyId: existing.companyId,
        tenantId: existing.tenantId,
        propertyId: existing.propertyId,
        unitId: existing.unitId,
        previousLeaseId: existing.id,
        title: normalizeNullableText(data.title) ?? `Renewal for ${existing.title ?? existing.unit.unitNumber}`,
        status: PmsLeaseStatus.DRAFT,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        rentFrequency: existing.rentFrequency,
        rentAmount: data.rentAmount ?? existing.rentAmount,
        currency: data.currency ?? existing.currency,
        securityDeposit: data.securityDeposit ?? existing.securityDeposit,
        dueDayOfMonth: data.dueDayOfMonth ?? existing.dueDayOfMonth,
        contractDraftId: existing.contractDraftId,
        notes: normalizeNullableText(data.notes),
        createdById: userId,
        updatedById: userId,
      },
      include: pmsLeaseInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS lease renewal draft created",
      message: `${req.user.email} created a PMS renewal draft for lease ${existing.id}.`,
      metadata: {
        action: "renewal_draft",
        resourceType: "pmsLease",
        leaseId: renewal.id,
        previousLeaseId: existing.id,
      },
    });

    res.status(201).json({ lease: pmsLeaseResponse(renewal) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases/:leaseId/checklists", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true, propertyId: true },
    });
    if (!lease) throw new AppError(404, "PMS lease not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: lease.companyId });
    assertCanViewPmsDocuments(access.member);
    assertCanAccessPmsPropertyScope(access, lease.propertyId);

    const checklistItems = await prisma.pmsMoveChecklistItem.findMany({
      where: { companyId: access.company.id, leaseId },
      include: pmsChecklistInclude,
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      checklistItems: checklistItems.map(pmsChecklistResponse),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/leases/:leaseId/checklists", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const data = pmsChecklistCreateSchema.parse(req.body);
    const userId = req.user.id;
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true, propertyId: true, unitId: true, tenantId: true },
    });
    if (!lease) throw new AppError(404, "PMS lease not found");

    const access = await resolvePmsAccessOrThrow({ userId, companyId: lease.companyId });
    assertCanManagePmsTenancies(access.member);
    assertCanAccessPmsPropertyScope(access, lease.propertyId);

    const checklistItem = await prisma.pmsMoveChecklistItem.create({
      data: {
        companyId: lease.companyId,
        leaseId: lease.id,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        tenantId: lease.tenantId,
        type: data.type,
        title: data.title,
        description: normalizeNullableText(data.description),
        status: data.status,
        completedAt: data.completedAt ?? (data.status === PmsMoveChecklistStatus.COMPLETED ? new Date() : null),
        notes: normalizeNullableText(data.notes),
        createdById: userId,
        updatedById: userId,
      },
      include: pmsChecklistInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS move checklist item created",
      message: `${req.user.email} created PMS ${checklistItem.type.toLowerCase().replace('_', '-')} checklist item ${checklistItem.title}.`,
      metadata: { action: "create", resourceType: "pmsMoveChecklistItem", checklistItemId: checklistItem.id, leaseId },
    });

    res.status(201).json({ checklistItem: pmsChecklistResponse(checklistItem) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/lease-checklists/:checklistItemId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { checklistItemId } = pmsChecklistItemParamsSchema.parse(req.params);
    const data = pmsChecklistUpdateSchema.parse(req.body);
    const existing = await prisma.pmsMoveChecklistItem.findUnique({ where: { id: checklistItemId } });
    if (!existing) throw new AppError(404, "PMS move checklist item not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsTenancies(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);

    const checklistItem = await prisma.pmsMoveChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: normalizeNullableText(data.description) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.completedAt !== undefined
          ? { completedAt: data.completedAt }
          : data.status === PmsMoveChecklistStatus.COMPLETED && !existing.completedAt
            ? { completedAt: new Date() }
            : {}),
        ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
        updatedById: req.user.id,
      },
      include: pmsChecklistInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS move checklist item updated",
      message: `${req.user.email} updated PMS move checklist item ${checklistItem.title}.`,
      metadata: { action: "update", resourceType: "pmsMoveChecklistItem", checklistItemId: checklistItem.id, changedFields: Object.keys(data) },
    });

    res.json({ checklistItem: pmsChecklistResponse(checklistItem) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases/:leaseId/rent-due", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const query = pmsRentDueListQuerySchema.omit({ leaseId: true }).parse(req.query);
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true, propertyId: true },
    });

    if (!lease) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: lease.companyId,
    });
    assertCanViewPmsRent(access.member);
    assertCanAccessPmsPropertyScope(access, lease.propertyId);
    const dueDate = buildPmsRentDueDateFilter(query);
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      leaseId,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(dueDate ? { dueDate } : {}),
    };

    const [rentDueItems, total] = await prisma.$transaction([
      prisma.pmsRentDueItem.findMany({
        where,
        include: pmsRentDueItemInclude,
        orderBy: buildPmsRentDueOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsRentDueItem.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      rentDueItems: rentDueItems.map(pmsRentDueItemResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: rentDueItems.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/rent-due", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsRentDueListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    assertCanViewPmsRent(access.member);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      leaseId: query.leaseId,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
    });
    const dueDate = buildPmsRentDueDateFilter(query);
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(dueDate ? { dueDate } : {}),
    };

    const [rentDueItems, total] = await prisma.$transaction([
      prisma.pmsRentDueItem.findMany({
        where,
        include: pmsRentDueItemInclude,
        orderBy: buildPmsRentDueOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsRentDueItem.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      rentDueItems: rentDueItems.map(pmsRentDueItemResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: rentDueItems.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/rent-due/:rentDueItemId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { rentDueItemId } = pmsRentDueParamsSchema.parse(req.params);
    const data = pmsRentDueUpdateSchema.parse(req.body);
    const existing = await prisma.pmsRentDueItem.findUnique({
      where: { id: rentDueItemId },
      select: { id: true, companyId: true, propertyId: true, amount: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS rent due item not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanCollectPmsRent(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);

    const paidAmount = data.paidAmount;
    const amountNumber = Number(existing.amount);
    const inferredStatus =
      paidAmount !== undefined
        ? paidAmount >= amountNumber
          ? PmsRentDueStatus.PAID
          : paidAmount > 0
            ? PmsRentDueStatus.PARTIALLY_PAID
            : PmsRentDueStatus.UNPAID
        : undefined;
    const nextStatus = data.status ?? inferredStatus;

    const rentDueItem = await prisma.pmsRentDueItem.update({
      where: { id: rentDueItemId },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(paidAmount !== undefined ? { paidAmount } : {}),
        ...(data.paidAt !== undefined
          ? { paidAt: data.paidAt }
          : nextStatus === PmsRentDueStatus.PAID
            ? { paidAt: new Date() }
            : {}),
        ...(data.notes !== undefined
          ? { notes: normalizeNullableText(data.notes) }
          : {}),
        updatedById: req.user.id,
      },
      include: pmsRentDueItemInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS rent due item updated",
      message: `${req.user.email} updated PMS rent due item ${rentDueItem.id}.`,
      metadata: {
        action: "update",
        resourceType: "pmsRentDueItem",
        rentDueItemId: rentDueItem.id,
        leaseId: rentDueItem.leaseId,
        status: rentDueItem.status,
        changedFields: Object.keys(data),
      },
    });

    res.json({ rentDueItem: pmsRentDueItemResponse(rentDueItem) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/rent-due/:rentDueItemId/payments", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { rentDueItemId } = pmsRentDueParamsSchema.parse(req.params);
    const rentDueItem = await prisma.pmsRentDueItem.findUnique({
      where: { id: rentDueItemId },
      include: pmsRentDueItemInclude,
    });

    if (!rentDueItem) {
      throw new AppError(404, "PMS rent due item not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: rentDueItem.companyId,
    });
    assertCanViewPmsRent(access.member);
    assertCanAccessPmsPropertyScope(access, rentDueItem.propertyId);

    const payments = await prisma.pmsRentPayment.findMany({
      where: { companyId: access.company.id, rentDueItemId },
      include: pmsRentPaymentInclude,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      rentDueItem: pmsRentDueItemResponse(rentDueItem),
      payments: payments.map(pmsRentPaymentResponse),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/rent-due/:rentDueItemId/payments", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { rentDueItemId } = pmsRentDueParamsSchema.parse(req.params);
    const data = pmsManualRentPaymentSchema.parse(req.body);
    const rentDueItem = await prisma.pmsRentDueItem.findUnique({
      where: { id: rentDueItemId },
      include: pmsRentDueItemInclude,
    });

    if (!rentDueItem) {
      throw new AppError(404, "PMS rent due item not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: rentDueItem.companyId,
    });
    assertCanCollectPmsRent(access.member);
    assertCanAccessPmsPropertyScope(access, rentDueItem.propertyId);

    const paymentDate = data.paidAt ?? new Date();
    await assertFinancialPeriodOpen(prisma, {
      companyId: access.company.id,
      propertyId: rentDueItem.propertyId,
      currency: rentDueItem.currency,
      transactionDate: paymentDate,
    });

    const confirmedAggregate = await prisma.pmsRentPayment.aggregate({
      where: {
        rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED,
      },
      _sum: { amount: true },
    });
    const confirmedAmount = roundMoney(rentDecimalToNumber(confirmedAggregate._sum.amount));
    assertCanApplyRentPayment({
      rentDueItem,
      paymentAmount: data.amount,
      existingConfirmedAmount: confirmedAmount,
    });

    const { payment, updatedRentDueItem } = await prisma.$transaction(async (tx) => {
      const structuredCharge = await ensureRentDueStructuredCharge(tx, rentDueItem, req.user!.id);
      const createdPayment = await tx.pmsRentPayment.create({
        data: {
          companyId: access.company.id,
          rentDueItemId: rentDueItem.id,
          leaseId: rentDueItem.leaseId,
          tenantId: rentDueItem.tenantId,
          propertyId: rentDueItem.propertyId,
          unitId: rentDueItem.unitId,
          amount: data.amount,
          currency: rentDueItem.currency,
          method: data.method,
          status: PmsRentPaymentStatus.CONFIRMED,
          referenceNumber: normalizeNullableText(data.referenceNumber),
          notes: normalizeNullableText(data.notes),
          paidAt: paymentDate,
          confirmedAt: new Date(),
          receiptNumber: createPmsRentReceiptNumber(),
          recordedById: req.user!.id,
        },
        include: pmsRentPaymentInclude,
      });
      await allocateLegacyRentPayment(tx, {
        payment: createdPayment,
        chargeId: structuredCharge.id,
        actorId: req.user!.id,
      });
      await tx.pmsAccountingLedgerEntry.create({
        data: {
          companyId: access.company.id,
          chargeId: structuredCharge.id,
          rentDueItemId: rentDueItem.id,
          rentPaymentId: createdPayment.id,
          leaseId: rentDueItem.leaseId,
          tenantId: rentDueItem.tenantId,
          propertyId: rentDueItem.propertyId,
          unitId: rentDueItem.unitId,
          type: PmsAccountingEntryType.INCOME,
          source: PmsAccountingSource.RENT_PAYMENT,
          category: "Rent payment",
          amount: data.amount,
          currency: rentDueItem.currency,
          transactionDate: createdPayment.paidAt ?? createdPayment.confirmedAt ?? new Date(),
          referenceNumber: createdPayment.receiptNumber ?? createdPayment.referenceNumber,
          notes: normalizeNullableText(data.notes),
          createdById: req.user!.id,
          updatedById: req.user!.id,
        },
      });
      const refreshedRentDueItem = await syncPmsRentDueItemFromConfirmedPayments(tx, {
        rentDueItemId,
        updatedById: req.user!.id,
      });

      return { payment: createdPayment, updatedRentDueItem: refreshedRentDueItem };
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS rent payment recorded",
      message: `${req.user.email} recorded ${payment.amount.toString()} ${payment.currency} rent payment.`,
      metadata: {
        action: "create",
        resourceType: "pmsRentPayment",
        rentPaymentId: payment.id,
        rentDueItemId: payment.rentDueItemId,
        tenantId: payment.tenantId,
        method: payment.method,
        status: payment.status,
      },
    });

    res.status(201).json({
      rentDueItem: pmsRentDueItemResponse(updatedRentDueItem),
      payment: pmsRentPaymentResponse(payment),
      receipt: pmsRentReceiptResponse(payment),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/rent-payments/:rentPaymentId/receipt", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { rentPaymentId } = pmsRentPaymentParamsSchema.parse(req.params);
    const payment = await prisma.pmsRentPayment.findUnique({
      where: { id: rentPaymentId },
      include: pmsRentPaymentInclude,
    });

    if (!payment) {
      throw new AppError(404, "PMS rent payment receipt not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: payment.companyId,
    });
    assertCanViewPmsRent(access.member);
    assertCanAccessPmsPropertyScope(access, payment.propertyId);

    if (payment.status !== PmsRentPaymentStatus.CONFIRMED) {
      throw new AppError(400, "Only confirmed rent payments have printable receipts.");
    }

    res.json({ receipt: pmsRentReceiptResponse(payment) });
  } catch (error) {
    next(error);
  }
});


function buildPmsWorkOrderUpdateData(
  data: z.infer<typeof pmsWorkOrderUpdateSchema>,
  userId: string,
): Prisma.PmsWorkOrderUncheckedUpdateInput {
  return {
    ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
    ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
    ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined
      ? { description: normalizeNullableText(data.description) }
      : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.assignedToText !== undefined
      ? { assignedToText: normalizeNullableText(data.assignedToText) }
      : {}),
    ...(data.vendorText !== undefined
      ? { vendorText: normalizeNullableText(data.vendorText) }
      : {}),
    ...(data.cost !== undefined ? { cost: data.cost } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
    ...(data.resolvedAt !== undefined ? { resolvedAt: data.resolvedAt } : {}),
    ...(data.targetDate !== undefined ? { targetDate: data.targetDate } : {}),
    ...(data.imageUrls !== undefined ? { imageUrls: data.imageUrls } : {}),
    ...(data.documentUrls !== undefined ? { documentUrls: data.documentUrls } : {}),
    ...(data.beforeImageUrls !== undefined ? { beforeImageUrls: data.beforeImageUrls } : {}),
    ...(data.afterImageUrls !== undefined ? { afterImageUrls: data.afterImageUrls } : {}),
    ...(data.beforeDocumentUrls !== undefined ? { beforeDocumentUrls: data.beforeDocumentUrls } : {}),
    ...(data.afterDocumentUrls !== undefined ? { afterDocumentUrls: data.afterDocumentUrls } : {}),
    ...(data.recurrenceType !== undefined ? { recurrenceType: data.recurrenceType } : {}),
    ...(data.nextScheduledDate !== undefined ? { nextScheduledDate: data.nextScheduledDate } : {}),
    ...(data.generatedFromWorkOrderId !== undefined ? { generatedFromWorkOrderId: data.generatedFromWorkOrderId } : {}),
    ...(data.tenantConfirmationNotes !== undefined ? { tenantConfirmationNotes: normalizeNullableText(data.tenantConfirmationNotes) } : {}),
    ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
    updatedById: userId,
  };
}

function buildPmsCommunicationTemplateUpdateData(
  data: z.infer<typeof pmsCommunicationTemplateUpdateSchema>,
  userId: string,
): Prisma.PmsCommunicationTemplateUncheckedUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.channel !== undefined ? { channel: data.channel } : {}),
    ...(data.type !== undefined ? { type: normalizeNullableText(data.type) } : {}),
    ...(data.subject !== undefined
      ? { subject: normalizeNullableText(data.subject) }
      : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
    updatedById: userId,
  };
}

function buildPmsPolicyUpdateData(
  data: z.infer<typeof pmsPolicyUpdateSchema>,
  userId: string,
): Prisma.PmsPolicyUncheckedUpdateInput {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
    updatedById: userId,
  };
}

function buildPmsInspectionUpdateData(
  data: z.infer<typeof pmsInspectionUpdateSchema>,
  userId: string,
): Prisma.PmsInspectionUncheckedUpdateInput {
  return {
    ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
    ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
    ...(data.leaseId !== undefined ? { leaseId: data.leaseId } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
    ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
    ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
    ...(data.feedback !== undefined
      ? { feedback: normalizeNullableText(data.feedback) }
      : {}),
    ...(data.rating !== undefined ? { rating: data.rating } : {}),
    updatedById: userId,
  };
}

type PmsCurrencyTotals = {
  currency: string;
  incomeCollected: number;
  outstandingRent: number;
  overdueRent: number;
  expenses: number;
  maintenanceCosts: number;
};

function currencyState(currencies: Iterable<string>) {
  const values = [...new Set([...currencies].filter(Boolean).map((value) => value.toUpperCase()))].sort();
  return {
    status: values.length === 0 ? "EMPTY" : values.length === 1 ? "SINGLE" : "MIXED",
    currencies: values,
    canCombine: values.length <= 1,
    displayCurrency: values.length === 1 ? values[0] : null,
    message: values.length > 1 ? "Amounts are grouped by currency and are not converted or combined." : null,
  };
}

function emptyCurrencyTotals(currency: string): PmsCurrencyTotals {
  return { currency, incomeCollected: 0, outstandingRent: 0, overdueRent: 0, expenses: 0, maintenanceCosts: 0 };
}

function serializeCurrencyTotals(value: PmsCurrencyTotals) {
  return {
    currency: value.currency,
    incomeCollected: moneyString(value.incomeCollected),
    outstandingRent: moneyString(value.outstandingRent),
    overdueRent: moneyString(value.overdueRent),
    expenses: moneyString(value.expenses),
    maintenanceCosts: moneyString(value.maintenanceCosts),
  };
}

async function buildPmsReportsSummary(
  companyId: string,
  propertyId?: Prisma.StringFilter,
) {
  const now = new Date();
  const renewalWindowEnd = new Date(now);
  renewalWindowEnd.setDate(renewalWindowEnd.getDate() + 60);
  const propertyWhere = propertyId ? { propertyId } : {};
  const overdueWhere: Prisma.PmsRentDueItemWhereInput = {
    companyId,
    ...propertyWhere,
    OR: [
      { status: PmsRentDueStatus.OVERDUE },
      {
        dueDate: { lt: now },
        status: { in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON, PmsRentDueStatus.PARTIALLY_PAID] },
      },
    ],
  };

  const [
    totalUnits,
    occupiedUnits,
    vacantUnits,
    rentPayments,
    outstandingItems,
    maintenanceRows,
    manualEntries,
    openMaintenance,
    inProgressMaintenance,
    resolvedMaintenance,
    urgentMaintenance,
    scheduledInspections,
    completedInspections,
    needsActionInspections,
    communicationTemplateCount,
    activePolicyCount,
    overdueTopList,
    expiringLeases,
  ] = await prisma.$transaction([
    prisma.pmsUnit.count({ where: { companyId, ...propertyWhere } }),
    prisma.pmsUnit.count({ where: { companyId, ...propertyWhere, occupancyStatus: PmsOccupancyStatus.OCCUPIED } }),
    prisma.pmsUnit.count({ where: { companyId, ...propertyWhere, occupancyStatus: PmsOccupancyStatus.VACANT } }),
    prisma.pmsRentPayment.findMany({
      where: { companyId, ...propertyWhere, status: PmsRentPaymentStatus.CONFIRMED },
      select: { amount: true, currency: true },
    }),
    prisma.pmsRentDueItem.findMany({
      where: { companyId, ...propertyWhere, status: { notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED] } },
      select: { amount: true, paidAmount: true, currency: true, dueDate: true, status: true },
    }),
    prisma.pmsWorkOrder.findMany({
      where: { companyId, ...propertyWhere, status: { not: PmsMaintenanceStatus.CANCELLED }, cost: { not: null } },
      select: { cost: true, currency: true },
    }),
    prisma.pmsAccountingLedgerEntry.findMany({
      where: { companyId, ...propertyWhere, source: PmsAccountingSource.MANUAL },
      select: { amount: true, currency: true, type: true },
    }),
    prisma.pmsWorkOrder.count({ where: { companyId, ...propertyWhere, status: PmsMaintenanceStatus.OPEN } }),
    prisma.pmsWorkOrder.count({ where: { companyId, ...propertyWhere, status: PmsMaintenanceStatus.IN_PROGRESS } }),
    prisma.pmsWorkOrder.count({ where: { companyId, ...propertyWhere, status: PmsMaintenanceStatus.RESOLVED } }),
    prisma.pmsWorkOrder.count({ where: { companyId, ...propertyWhere, priority: PmsMaintenancePriority.URGENT } }),
    prisma.pmsInspection.count({ where: { companyId, ...propertyWhere, status: PmsInspectionStatus.SCHEDULED } }),
    prisma.pmsInspection.count({ where: { companyId, ...propertyWhere, status: PmsInspectionStatus.COMPLETED } }),
    prisma.pmsInspection.count({ where: { companyId, ...propertyWhere, status: PmsInspectionStatus.NEEDS_ACTION } }),
    prisma.pmsCommunicationTemplate.count({ where: { companyId, active: true } }),
    prisma.pmsPolicy.count({ where: { companyId, active: true } }),
    prisma.pmsRentDueItem.findMany({ where: overdueWhere, include: pmsRentDueItemInclude, orderBy: { dueDate: "asc" }, take: 5 }),
    prisma.pmsLease.findMany({
      where: { companyId, ...propertyWhere, status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] }, endDate: { gte: now, lte: renewalWindowEnd } },
      include: pmsLeaseInclude,
      orderBy: { endDate: "asc" },
      take: 5,
    }),
  ]);

  const totals = new Map<string, PmsCurrencyTotals>();
  const get = (currency: string) => {
    const key = currency.toUpperCase();
    const current = totals.get(key) ?? emptyCurrencyTotals(key);
    totals.set(key, current);
    return current;
  };
  for (const row of rentPayments) get(row.currency).incomeCollected += Number(row.amount);
  for (const row of outstandingItems) {
    const amount = Math.max(Number(row.amount) - Number(row.paidAmount), 0);
    get(row.currency).outstandingRent += amount;
    const isOverdue = row.status === PmsRentDueStatus.OVERDUE || row.dueDate < now;
    if (isOverdue) get(row.currency).overdueRent += amount;
  }
  for (const row of maintenanceRows) {
    const amount = Number(row.cost ?? 0);
    get(row.currency).maintenanceCosts += amount;
    get(row.currency).expenses += amount;
  }

  for (const row of manualEntries) {
    const amount = Number(row.amount);
    const target = get(row.currency);
    if (PMS_ACCOUNTING_INCOME_ENTRY_TYPES.has(row.type)) {
      target.incomeCollected += amount;
    } else if (PMS_ACCOUNTING_EXPENSE_ENTRY_TYPES.has(row.type)) {
      target.expenses += amount;
    }
  }
  const totalsByCurrency = [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map(serializeCurrencyTotals);
  const state = currencyState(totals.keys());
  const single = state.status === "SINGLE" ? totalsByCurrency[0] : null;

  return {
    accounting: {
      currencyState: state,
      totalsByCurrency,
      incomeCollected: single?.incomeCollected ?? null,
      outstandingRent: single?.outstandingRent ?? null,
      overdueRent: single?.overdueRent ?? null,
      expenses: single?.expenses ?? null,
      maintenanceCosts: single?.maintenanceCosts ?? null,
      currency: single?.currency ?? null,
      lateFeeFoundationEnabled: false,
      lateFeeNote: "Late fee policy records are available, but automatic fee posting is not enabled yet.",
    },
    reports: {
      occupancy: {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0,
        sourceOfTruth: "ACTIVE_OR_EXPIRING_LEASE",
      },
      revenue: {
        currencyState: state,
        byCurrency: totalsByCurrency.map((value) => ({
          currency: value.currency,
          collected: value.incomeCollected,
          outstanding: value.outstandingRent,
          overdue: value.overdueRent,
        })),
        collected: single?.incomeCollected ?? null,
        outstanding: single?.outstandingRent ?? null,
        overdue: single?.overdueRent ?? null,
        currency: single?.currency ?? null,
      },
      overdueTopList: overdueTopList.map(pmsRentDueItemResponse),
      maintenance: {
        open: openMaintenance,
        inProgress: inProgressMaintenance,
        resolved: resolvedMaintenance,
        urgent: urgentMaintenance,
        currencyState: state,
        costsByCurrency: totalsByCurrency.map((value) => ({ currency: value.currency, amount: value.maintenanceCosts })),
        costs: single?.maintenanceCosts ?? null,
        currency: single?.currency ?? null,
      },
      leaseRenewals: expiringLeases.map(pmsLeaseResponse),
      inspections: { scheduled: scheduledInspections, completed: completedInspections, needsAction: needsActionInspections },
      communications: { activeTemplates: communicationTemplateCount },
      policies: { activePolicies: activePolicyCount },
    },
  };
}

pmsRouter.get("/vendors", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsVendorListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsMaintenance(access.member);

    const search = query.search?.trim();
    const where: Prisma.PmsVendorWhereInput = {
      companyId: access.company.id,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(query.trade ? { trade: { contains: query.trade, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { trade: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [vendors, total] = await prisma.$transaction([
      prisma.pmsVendor.findMany({
        where,
        include: pmsVendorInclude,
        orderBy: buildPmsVendorOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsVendor.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      vendors: vendors.map(pmsVendorResponse),
      pagination: { take: query.take, skip: query.skip, count: vendors.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/vendors", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsVendorCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanManagePmsMaintenance(access.member);

    const vendor = await prisma.pmsVendor.create({
      data: {
        companyId: access.company.id,
        name: data.name,
        phone: normalizeNullableText(data.phone),
        email: normalizeNullableText(data.email),
        trade: normalizeNullableText(data.trade),
        notes: normalizeNullableText(data.notes),
        active: data.active,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsVendorInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance vendor created",
      message: `${req.user.email} created PMS vendor ${vendor.name}.`,
      metadata: { action: "create", resourceType: "pmsVendor", vendorId: vendor.id },
    });

    res.status(201).json({ vendor: pmsVendorResponse(vendor) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/vendors/:vendorId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { vendorId } = pmsVendorParamsSchema.parse(req.params);
    const data = pmsVendorUpdateSchema.parse(req.body);
    const existing = await prisma.pmsVendor.findUnique({ where: { id: vendorId }, select: { id: true, companyId: true } });
    if (!existing) throw new AppError(404, "PMS vendor not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsMaintenance(access.member);

    const vendor = await prisma.pmsVendor.update({
      where: { id: vendorId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: normalizeNullableText(data.phone) } : {}),
        ...(data.email !== undefined ? { email: normalizeNullableText(data.email) } : {}),
        ...(data.trade !== undefined ? { trade: normalizeNullableText(data.trade) } : {}),
        ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        updatedById: req.user.id,
      },
      include: pmsVendorInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance vendor updated",
      message: `${req.user.email} updated PMS vendor ${vendor.name}.`,
      metadata: { action: "update", resourceType: "pmsVendor", vendorId: vendor.id, changedFields: Object.keys(data) },
    });

    res.json({ vendor: pmsVendorResponse(vendor) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/maintenance/:workOrderId/quotes", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { workOrderId } = pmsWorkOrderParamsSchema.parse(req.params);
    const workOrder = await prisma.pmsWorkOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true, propertyId: true },
    });
    if (!workOrder) throw new AppError(404, "PMS maintenance work order not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: workOrder.companyId });
    assertCanViewPmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, workOrder.propertyId);

    const quotes = await prisma.pmsMaintenanceQuote.findMany({
      where: { companyId: access.company.id, workOrderId },
      include: pmsMaintenanceQuoteInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      quotes: quotes.map(pmsMaintenanceQuoteResponse),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/maintenance/:workOrderId/quotes", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { workOrderId } = pmsWorkOrderParamsSchema.parse(req.params);
    const data = pmsMaintenanceQuoteCreateSchema.parse(req.body);
    const workOrder = await prisma.pmsWorkOrder.findUnique({ where: { id: workOrderId }, select: { id: true, companyId: true, propertyId: true, title: true, currency: true } });
    if (!workOrder) throw new AppError(404, "PMS maintenance work order not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: workOrder.companyId });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, workOrder.propertyId);
    await assertPmsOperationalLinksBelongToCompany({ companyId: access.company.id, propertyId: workOrder.propertyId, vendorId: data.vendorId });

    const quote = await prisma.pmsMaintenanceQuote.create({
      data: {
        companyId: access.company.id,
        workOrderId,
        vendorId: data.vendorId ?? null,
        amount: data.amount,
        currency: data.currency ?? workOrder.currency,
        description: normalizeNullableText(data.description),
        status: data.status,
        submittedAt: data.status === PmsMaintenanceQuoteStatus.SUBMITTED ? new Date() : null,
        notes: normalizeNullableText(data.notes),
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsMaintenanceQuoteInclude,
    });

    await notifyPmsMaintenanceRecipients({
      companyId: access.company.id,
      title: "PMS maintenance quote submitted",
      message: `${req.user.email} added a maintenance quote for ${workOrder.title}.`,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance quote created",
      message: `${req.user.email} created a PMS maintenance quote for ${workOrder.title}.`,
      metadata: { action: "create", resourceType: "pmsMaintenanceQuote", quoteId: quote.id, workOrderId },
    });

    res.status(201).json({ quote: pmsMaintenanceQuoteResponse(quote) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/maintenance/quotes/:quoteId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { quoteId } = pmsMaintenanceQuoteParamsSchema.parse(req.params);
    const data = pmsMaintenanceQuoteUpdateSchema.parse(req.body);
    const existing = await prisma.pmsMaintenanceQuote.findUnique({
      where: { id: quoteId },
      include: { workOrder: { select: { id: true, title: true, companyId: true, propertyId: true } } },
    });
    if (!existing) throw new AppError(404, "PMS maintenance quote not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, existing.workOrder.propertyId);

    if (data.status === PmsMaintenanceQuoteStatus.APPROVED) {
      assertCanManagePmsOperations(access.member);
    }
    if (data.vendorId) {
      await assertPmsOperationalLinksBelongToCompany({ companyId: existing.companyId, propertyId: existing.workOrder.propertyId, vendorId: data.vendorId });
    }

    const quote = await prisma.$transaction(async (tx) => {
      const updated = await tx.pmsMaintenanceQuote.update({
        where: { id: quoteId },
        data: {
          ...(data.vendorId !== undefined ? { vendorId: data.vendorId ?? null } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.description !== undefined ? { description: normalizeNullableText(data.description) } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.status === PmsMaintenanceQuoteStatus.SUBMITTED ? { submittedAt: new Date(), rejectedAt: null } : {}),
          ...(data.status === PmsMaintenanceQuoteStatus.REJECTED ? { rejectedAt: new Date(), approvedAt: null, approvedById: null } : {}),
          ...(data.status === PmsMaintenanceQuoteStatus.APPROVED ? { approvedAt: new Date(), approvedById: req.user!.id, rejectedAt: null } : {}),
          ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
          updatedById: req.user!.id,
        },
        include: pmsMaintenanceQuoteInclude,
      });

      if (updated.status === PmsMaintenanceQuoteStatus.APPROVED) {
        await tx.pmsMaintenanceQuote.updateMany({
          where: { workOrderId: updated.workOrderId, id: { not: updated.id }, status: PmsMaintenanceQuoteStatus.APPROVED },
          data: { status: PmsMaintenanceQuoteStatus.REJECTED, rejectedAt: new Date(), updatedById: req.user!.id },
        });
        await tx.pmsWorkOrder.update({
          where: { id: updated.workOrderId },
          data: {
            approvedQuoteId: updated.id,
            vendorId: updated.vendorId,
            cost: updated.amount,
            currency: updated.currency,
            status: PmsMaintenanceStatus.WAITING_VENDOR,
            updatedById: req.user!.id,
          },
        });
      }

      return updated;
    });

    if (quote.status === PmsMaintenanceQuoteStatus.APPROVED) {
      await notifyPmsMaintenanceRecipients({
        companyId: access.company.id,
        title: "PMS maintenance quote approved",
        message: `${req.user.email} approved a maintenance quote for ${existing.workOrder.title}.`,
      });
    }

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance quote updated",
      message: `${req.user.email} updated a PMS maintenance quote for ${existing.workOrder.title}.`,
      metadata: { action: "update", resourceType: "pmsMaintenanceQuote", quoteId: quote.id, workOrderId: quote.workOrderId, status: quote.status },
    });

    res.json({ quote: pmsMaintenanceQuoteResponse(quote) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/maintenance", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsWorkOrderListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    assertCanViewPmsMaintenance(access.member);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
      vendorId: query.vendorId,
    });
    const search = query.search?.trim();
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsWorkOrderWhereInput = {
      companyId: access.company.id,
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.overdue === "OVERDUE" ? { targetDate: { lt: new Date() }, status: { notIn: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED] } } : {}),
      ...(query.overdue === "NOT_OVERDUE" ? { OR: [{ targetDate: null }, { targetDate: { gte: new Date() } }, { status: { in: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED] } }] } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.priority !== "ALL" ? { priority: query.priority } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { assignedToText: { contains: search, mode: "insensitive" } },
              { vendorText: { contains: search, mode: "insensitive" } },
              { vendor: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [workOrders, total] = await prisma.$transaction([
      prisma.pmsWorkOrder.findMany({
        where,
        include: pmsWorkOrderInclude,
        orderBy: buildPmsWorkOrderOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsWorkOrder.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      workOrders: workOrders.map(pmsWorkOrderResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: workOrders.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/maintenance", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsWorkOrderCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: data.companyId,
    });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, data.propertyId);
    await assertPmsOperationalLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      vendorId: data.vendorId,
      generatedFromWorkOrderId: data.generatedFromWorkOrderId,
    });

    const workOrder = await prisma.pmsWorkOrder.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        tenantId: data.tenantId ?? null,
        vendorId: data.vendorId ?? null,
        title: data.title,
        description: normalizeNullableText(data.description),
        priority: data.priority,
        status: data.status,
        assignedToText: normalizeNullableText(data.assignedToText),
        vendorText: normalizeNullableText(data.vendorText),
        cost: data.cost ?? null,
        currency: data.currency,
        scheduledFor: data.scheduledFor ?? null,
        targetDate: data.targetDate ?? null,
        resolvedAt:
          data.resolvedAt ??
          (data.status === PmsMaintenanceStatus.RESOLVED ? new Date() : null),
        imageUrls: data.imageUrls ?? [],
        documentUrls: data.documentUrls ?? [],
        beforeImageUrls: data.beforeImageUrls ?? [],
        afterImageUrls: data.afterImageUrls ?? [],
        beforeDocumentUrls: data.beforeDocumentUrls ?? [],
        afterDocumentUrls: data.afterDocumentUrls ?? [],
        recurrenceType: data.recurrenceType,
        nextScheduledDate: data.nextScheduledDate ?? null,
        generatedFromWorkOrderId: data.generatedFromWorkOrderId ?? null,
        tenantConfirmationNotes: normalizeNullableText(data.tenantConfirmationNotes),
        notes: normalizeNullableText(data.notes),
        createdById: userId,
        updatedById: userId,
      },
      include: pmsWorkOrderInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance work order created",
      message: `${req.user.email} created PMS work order ${workOrder.title}.`,
      metadata: {
        action: "create",
        resourceType: "pmsWorkOrder",
        workOrderId: workOrder.id,
        status: workOrder.status,
        priority: workOrder.priority,
      },
    });

    res.status(201).json({ workOrder: pmsWorkOrderResponse(workOrder) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/maintenance/:workOrderId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { workOrderId } = pmsWorkOrderParamsSchema.parse(req.params);
    const workOrder = await prisma.pmsWorkOrder.findUnique({
      where: { id: workOrderId },
      include: pmsWorkOrderInclude,
    });

    if (!workOrder) {
      throw new AppError(404, "PMS maintenance work order not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: workOrder.companyId,
    });
    assertCanViewPmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, workOrder.propertyId);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      workOrder: pmsWorkOrderResponse(workOrder),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/maintenance/:workOrderId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { workOrderId } = pmsWorkOrderParamsSchema.parse(req.params);
    const data = pmsWorkOrderUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsWorkOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true, propertyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS maintenance work order not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: existing.companyId,
    });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);
    await assertPmsOperationalLinksBelongToCompany({
      companyId: existing.companyId,
      propertyId: existing.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      vendorId: data.vendorId,
      generatedFromWorkOrderId: data.generatedFromWorkOrderId,
    });

    const workOrder = await prisma.pmsWorkOrder.update({
      where: { id: workOrderId },
      data: {
        ...buildPmsWorkOrderUpdateData(data, userId),
        ...(data.status === PmsMaintenanceStatus.RESOLVED && !data.resolvedAt
          ? { resolvedAt: new Date() }
          : {}),
      },
      include: pmsWorkOrderInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS maintenance work order updated",
      message: `${req.user.email} updated PMS work order ${workOrder.title}.`,
      metadata: {
        action: "update",
        resourceType: "pmsWorkOrder",
        workOrderId: workOrder.id,
        status: workOrder.status,
        priority: workOrder.priority,
        changedFields: Object.keys(data),
      },
    });

    res.json({ workOrder: pmsWorkOrderResponse(workOrder) });
  } catch (error) {
    next(error);
  }
});

function buildPmsAccountingWhere(
  companyId: string,
  query: z.infer<typeof pmsAccountingQuerySchema>,
  propertyId?: string | Prisma.StringFilter,
): Prisma.PmsAccountingLedgerEntryWhereInput {
  const transactionDate = buildPmsAccountingDateFilter({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  return {
    companyId,
    ...(propertyId ? { propertyId } : {}),
    ...(query.unitId ? { unitId: query.unitId } : {}),
    ...(query.tenantId ? { tenantId: query.tenantId } : {}),
    ...(query.leaseId ? { leaseId: query.leaseId } : {}),
    ...(query.rentDueItemId ? { rentDueItemId: query.rentDueItemId } : {}),
    ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
    ...(query.type !== "ALL" ? { type: query.type } : {}),
    ...(query.category ? { category: { contains: query.category, mode: "insensitive" } } : {}),
    ...(transactionDate ? { transactionDate } : {}),
  };
}

function buildPmsAccountingLedgerData(
  input: z.infer<typeof pmsAccountingLedgerEntrySchema>,
  userId: string,
): Prisma.PmsAccountingLedgerEntryUncheckedCreateInput {
  return {
    companyId: input.companyId,
    propertyId: input.propertyId ?? null,
    unitId: input.unitId ?? null,
    tenantId: input.tenantId ?? null,
    leaseId: input.leaseId ?? null,
    rentDueItemId: input.rentDueItemId ?? null,
    workOrderId: input.workOrderId ?? null,
    type: input.type,
    source: PmsAccountingSource.MANUAL,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    transactionDate: input.transactionDate,
    referenceNumber: normalizeNullableText(input.referenceNumber),
    notes: normalizeNullableText(input.notes),
    createdById: userId,
    updatedById: userId,
  };
}

function buildPmsAccountingLedgerUpdateData(
  input: z.infer<typeof pmsAccountingLedgerEntryUpdateSchema>,
  userId: string,
): Prisma.PmsAccountingLedgerEntryUncheckedUpdateInput {
  return {
    ...(input.propertyId !== undefined ? { propertyId: input.propertyId ?? null } : {}),
    ...(input.unitId !== undefined ? { unitId: input.unitId ?? null } : {}),
    ...(input.tenantId !== undefined ? { tenantId: input.tenantId ?? null } : {}),
    ...(input.leaseId !== undefined ? { leaseId: input.leaseId ?? null } : {}),
    ...(input.rentDueItemId !== undefined ? { rentDueItemId: input.rentDueItemId ?? null } : {}),
    ...(input.workOrderId !== undefined ? { workOrderId: input.workOrderId ?? null } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.transactionDate !== undefined ? { transactionDate: input.transactionDate } : {}),
    ...(input.referenceNumber !== undefined ? { referenceNumber: normalizeNullableText(input.referenceNumber) } : {}),
    ...(input.notes !== undefined ? { notes: normalizeNullableText(input.notes) } : {}),
    updatedById: userId,
  };
}

type PmsStatementCurrencyTotal = {
  currency: string;
  rentCollected: number;
  manualIncome: number;
  adjustments: number;
  income: number;
  outstandingRent: number;
  expenses: number;
  maintenanceCosts: number;
  netAmount: number;
  depositCollected: number;
  depositHeld: number;
  depositRefunded: number;
  depositDeductions: number;
};

function emptyStatementCurrencyTotal(currency: string): PmsStatementCurrencyTotal {
  return {
    currency,
    rentCollected: 0,
    manualIncome: 0,
    adjustments: 0,
    income: 0,
    outstandingRent: 0,
    expenses: 0,
    maintenanceCosts: 0,
    netAmount: 0,
    depositCollected: 0,
    depositHeld: 0,
    depositRefunded: 0,
    depositDeductions: 0,
  };
}

function serializeStatementCurrencyTotal(total: PmsStatementCurrencyTotal) {
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [key, key === "currency" ? value : moneyString(value as number)]),
  ) as Record<keyof PmsStatementCurrencyTotal, string>;
}

async function buildPmsOwnerStatement(input: {
  companyId: string;
  propertyId?: string;
  propertyScope?: Prisma.StringFilter;
  unitId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  month?: string;
  currency?: string;
}) {
  const range = getPmsStatementRange(input);
  const closedDateFilter = buildPmsAccountingDateFilter({ dateFrom: range.start, dateTo: range.end });
  const propertyId = input.propertyId ?? input.propertyScope;
  const currencyWhere = input.currency ? { currency: input.currency } : {};
  const paymentWhere: Prisma.PmsRentPaymentWhereInput = {
    companyId: input.companyId,
    status: PmsRentPaymentStatus.CONFIRMED,
    ...currencyWhere,
    ...(propertyId ? { propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { paidAt: closedDateFilter } : {}),
  };
  const ledgerWhere: Prisma.PmsAccountingLedgerEntryWhereInput = {
    companyId: input.companyId,
    source: PmsAccountingSource.MANUAL,
    ...currencyWhere,
    ...(propertyId ? { propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { transactionDate: closedDateFilter } : {}),
  };
  const workOrderWhere: Prisma.PmsWorkOrderWhereInput = {
    companyId: input.companyId,
    status: { not: PmsMaintenanceStatus.CANCELLED },
    cost: { not: null },
    ...currencyWhere,
    ...(propertyId ? { propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { OR: [{ resolvedAt: closedDateFilter }, { resolvedAt: null, updatedAt: closedDateFilter }] } : {}),
  };
  const rentDueWhere: Prisma.PmsRentDueItemWhereInput = {
    companyId: input.companyId,
    status: { notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED] },
    ...currencyWhere,
    ...(propertyId ? { propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { dueDate: closedDateFilter } : {}),
  };
  const activeLeaseWhere: Prisma.PmsLeaseWhereInput = {
    companyId: input.companyId,
    status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
    securityDeposit: { not: null },
    ...currencyWhere,
    ...(propertyId ? { propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
  };

  const [rentPayments, manualEntries, maintenanceCosts, outstandingItems, securityDeposits] = await prisma.$transaction([
    prisma.pmsRentPayment.findMany({ where: paymentWhere, include: pmsRentPaymentInclude, orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] }),
    prisma.pmsAccountingLedgerEntry.findMany({ where: ledgerWhere, include: pmsAccountingLedgerEntryInclude, orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }] }),
    prisma.pmsWorkOrder.findMany({ where: workOrderWhere, include: pmsWorkOrderInclude, orderBy: [{ resolvedAt: "asc" }, { updatedAt: "asc" }] }),
    prisma.pmsRentDueItem.findMany({ where: rentDueWhere, include: pmsRentDueItemInclude, orderBy: { dueDate: "asc" } }),
    prisma.pmsLease.findMany({
      where: activeLeaseWhere,
      select: { id: true, title: true, securityDeposit: true, currency: true, tenant: { select: { id: true, fullName: true } }, unit: { select: { id: true, unitNumber: true } } },
    }),
  ]);

  const [property, unit] = await Promise.all([
    input.propertyId ? prisma.pmsProperty.findUnique({ where: { id: input.propertyId }, select: { id: true, name: true, code: true } }) : Promise.resolve(null),
    input.unitId ? prisma.pmsUnit.findUnique({ where: { id: input.unitId }, select: { id: true, unitNumber: true, unitName: true } }) : Promise.resolve(null),
  ]);

  const totals = new Map<string, PmsStatementCurrencyTotal>();
  const get = (currency: string) => {
    const key = currency.toUpperCase();
    const current = totals.get(key) ?? emptyStatementCurrencyTotal(key);
    totals.set(key, current);
    return current;
  };
  for (const payment of rentPayments) {
    const target = get(payment.currency);
    target.rentCollected += Number(payment.amount);
    target.income += Number(payment.amount);
  }
  for (const entry of manualEntries) {
    const target = get(entry.currency);
    const amount = Number(entry.amount);
    if (entry.type === PmsAccountingEntryType.INCOME || entry.type === PmsAccountingEntryType.LATE_FEE) {
      target.manualIncome += amount;
      target.income += amount;
    } else if (entry.type === PmsAccountingEntryType.ADJUSTMENT) {
      target.adjustments += amount;
      target.income += amount;
    } else if (entry.type === PmsAccountingEntryType.DEPOSIT && !entry.category.toLowerCase().includes("refund")) {
      target.depositCollected += amount;
      target.depositHeld += amount;
    } else if (entry.type === PmsAccountingEntryType.REFUND || (entry.type === PmsAccountingEntryType.DEPOSIT && entry.category.toLowerCase().includes("refund"))) {
      target.depositRefunded += amount;
      target.depositHeld -= amount;
      if (entry.type === PmsAccountingEntryType.REFUND) target.expenses += amount;
    } else if (entry.type === PmsAccountingEntryType.EXPENSE) {
      target.expenses += amount;
    }
  }
  for (const workOrder of maintenanceCosts) {
    const target = get(workOrder.currency);
    const amount = Number(workOrder.cost ?? 0);
    target.maintenanceCosts += amount;
    target.expenses += amount;
  }
  for (const item of outstandingItems) {
    get(item.currency).outstandingRent += Math.max(Number(item.amount) - Number(item.paidAmount), 0);
  }
  for (const lease of securityDeposits) {
    get(lease.currency).depositHeld += Number(lease.securityDeposit ?? 0);
  }
  for (const target of totals.values()) {
    target.depositHeld = Math.max(target.depositHeld, 0);
    target.netAmount = target.income - target.expenses;
  }
  const totalsByCurrency = [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map(serializeStatementCurrencyTotal);
  const state = currencyState(totals.keys());

  return {
    period: { month: input.month ?? null, from: range.start ?? null, to: range.end ?? null },
    scope: { companyId: input.companyId, propertyId: input.propertyId ?? null, unitId: input.unitId ?? null, property, unit },
    currencyState: state,
    totalsByCurrency,
    totals: state.status === "SINGLE" ? totalsByCurrency[0] : null,
    income: [
      ...rentPayments.map((payment) => ({
        source: PmsAccountingSource.RENT_PAYMENT,
        id: payment.id,
        date: payment.paidAt ?? payment.confirmedAt ?? payment.createdAt,
        category: "Rent payment",
        description: payment.receiptNumber ?? payment.referenceNumber ?? payment.id,
        amount: decimalToString(payment.amount),
        currency: payment.currency,
        tenant: payment.tenant,
        property: payment.property,
        unit: payment.unit,
      })),
      ...manualEntries.filter((entry) => isPmsAccountingIncomeType(entry.type)).map(pmsAccountingLedgerEntryResponse),
    ],
    expenses: [
      ...maintenanceCosts.map((workOrder) => ({
        source: PmsAccountingSource.MAINTENANCE_COST,
        id: workOrder.id,
        date: workOrder.resolvedAt ?? workOrder.updatedAt,
        category: "Maintenance cost",
        description: workOrder.title,
        amount: decimalToString(workOrder.cost),
        currency: workOrder.currency,
        property: workOrder.property,
        unit: workOrder.unit,
        tenant: workOrder.tenant,
      })),
      ...manualEntries.filter((entry) => isPmsAccountingExpenseType(entry.type)).map(pmsAccountingLedgerEntryResponse),
    ],
    outstanding: outstandingItems.map(pmsRentDueItemResponse),
    deposits: securityDeposits.map((lease) => ({
      leaseId: lease.id,
      title: lease.title,
      tenant: lease.tenant,
      unit: lease.unit,
      securityDeposit: decimalToString(lease.securityDeposit),
      currency: lease.currency,
    })),
    includedRecordIds: {
      rentPaymentIds: rentPayments.map((item) => item.id),
      accountingEntryIds: manualEntries.map((item) => item.id),
      maintenanceWorkOrderIds: maintenanceCosts.map((item) => item.id),
    },
  };
}

pmsRouter.get("/accounting/ledger", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
      leaseId: query.leaseId,
      rentDueItemId: query.rentDueItemId,
      workOrderId: query.workOrderId,
    });

    const where = buildPmsAccountingWhere(
      access.company.id,
      query,
      pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId),
    );
    const [ledgerEntries, total] = await prisma.$transaction([
      prisma.pmsAccountingLedgerEntry.findMany({
        where,
        include: pmsAccountingLedgerEntryInclude,
        orderBy: buildPmsAccountingOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsAccountingLedgerEntry.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      ledgerEntries: ledgerEntries.map(pmsAccountingLedgerEntryResponse),
      categories: {
        income: ["Rent payment", "Manual income", "Late fee", "Deposit collected", "Adjustment"],
        expense: ["Maintenance cost", "Repairs", "Utilities", "Management fee", "Deposit refund", "Adjustment"],
      },
      pagination: { take: query.take, skip: query.skip, count: ledgerEntries.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/accounting/ledger.csv", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingQuerySchema.parse({ ...req.query, take: 200, skip: 0 });
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member);
    assertCanExportPmsData(access.member, "accounting");
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
      leaseId: query.leaseId,
      rentDueItemId: query.rentDueItemId,
      workOrderId: query.workOrderId,
    });

    const entries = await prisma.pmsAccountingLedgerEntry.findMany({
      where: buildPmsAccountingWhere(
        access.company.id,
        query,
        pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId),
      ),
      include: pmsAccountingLedgerEntryInclude,
      orderBy: buildPmsAccountingOrderBy(query),
      take: 1000,
    });
    const rows = [
      ["date", "type", "source", "category", "amount", "currency", "property", "unit", "tenant", "reference", "notes"],
      ...entries.map((entry) => [
        entry.transactionDate.toISOString(),
        entry.type,
        entry.source,
        entry.category,
        decimalToString(entry.amount) ?? "0",
        entry.currency,
        entry.property?.name ?? "",
        entry.unit?.unitNumber ?? "",
        entry.tenant?.fullName ?? "",
        entry.referenceNumber ?? "",
        entry.notes ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="pms-accounting-ledger.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/accounting/ledger", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsAccountingLedgerEntrySchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanManagePmsAccounting(access.member);
    assertCanAccessOptionalPmsPropertyScope(access, data.propertyId);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
      rentDueItemId: data.rentDueItemId,
      workOrderId: data.workOrderId,
    });
    await assertFinancialPeriodOpen(prisma, {
      companyId: access.company.id,
      propertyId: data.propertyId ?? null,
      currency: data.currency,
      transactionDate: data.transactionDate,
    });

    const ledgerEntry = await prisma.pmsAccountingLedgerEntry.create({
      data: buildPmsAccountingLedgerData({ ...data, companyId: access.company.id }, req.user.id),
      include: pmsAccountingLedgerEntryInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS accounting ledger entry created",
      message: `${req.user.email} created PMS accounting ledger entry ${ledgerEntry.category}.`,
      metadata: { action: "create", resourceType: "pmsAccountingLedgerEntry", ledgerEntryId: ledgerEntry.id, type: ledgerEntry.type, amount: ledgerEntry.amount.toString() },
    });

    res.status(201).json({ ledgerEntry: pmsAccountingLedgerEntryResponse(ledgerEntry) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/accounting/ledger/:ledgerEntryId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { ledgerEntryId } = pmsAccountingLedgerParamsSchema.parse(req.params);
    const data = pmsAccountingLedgerEntryUpdateSchema.parse(req.body);
    const existing = await prisma.pmsAccountingLedgerEntry.findUnique({
      where: { id: ledgerEntryId },
      select: {
        id: true,
        companyId: true,
        propertyId: true,
        unitId: true,
        tenantId: true,
        leaseId: true,
        rentDueItemId: true,
        workOrderId: true,
        source: true,
        currency: true,
        transactionDate: true,
      },
    });
    if (!existing) throw new AppError(404, "PMS accounting ledger entry not found");
    if (existing.source !== PmsAccountingSource.MANUAL) {
      throw new AppError(400, "Only manual PMS accounting ledger entries can be edited.");
    }

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsAccounting(access.member);
    assertCanAccessOptionalPmsPropertyScope(access, existing.propertyId);
    const targetPropertyId =
      data.propertyId === undefined ? existing.propertyId : data.propertyId;
    assertCanAccessOptionalPmsPropertyScope(access, targetPropertyId);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: targetPropertyId,
      unitId: data.unitId === undefined ? existing.unitId : data.unitId,
      tenantId: data.tenantId === undefined ? existing.tenantId : data.tenantId,
      leaseId: data.leaseId === undefined ? existing.leaseId : data.leaseId,
      rentDueItemId:
        data.rentDueItemId === undefined
          ? existing.rentDueItemId
          : data.rentDueItemId,
      workOrderId:
        data.workOrderId === undefined ? existing.workOrderId : data.workOrderId,
    });
    await assertFinancialPeriodOpen(prisma, {
      companyId: access.company.id,
      propertyId: targetPropertyId,
      currency: data.currency ?? existing.currency,
      transactionDate: data.transactionDate ?? existing.transactionDate,
    });

    const ledgerEntry = await prisma.pmsAccountingLedgerEntry.update({
      where: { id: ledgerEntryId },
      data: buildPmsAccountingLedgerUpdateData(data, req.user.id),
      include: pmsAccountingLedgerEntryInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS accounting ledger entry updated",
      message: `${req.user.email} updated PMS accounting ledger entry ${ledgerEntry.category}.`,
      metadata: { action: "update", resourceType: "pmsAccountingLedgerEntry", ledgerEntryId: ledgerEntry.id, type: ledgerEntry.type, amount: ledgerEntry.amount.toString(), changedFields: Object.keys(data) },
    });

    res.json({ ledgerEntry: pmsAccountingLedgerEntryResponse(ledgerEntry) });
  } catch (error) {
    next(error);
  }
});

const pmsOwnerStatementInclude = {
  property: { select: { id: true, name: true, code: true } },
  generatedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
  voidedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PmsOwnerStatementInclude;

type PmsOwnerStatementWithRelations = Prisma.PmsOwnerStatementGetPayload<{
  include: typeof pmsOwnerStatementInclude;
}>;

function pmsOwnerStatementResponse(statement: PmsOwnerStatementWithRelations) {
  return {
    ...statement,
    openingBalance: decimalToString(statement.openingBalance),
    income: decimalToString(statement.income),
    expenses: decimalToString(statement.expenses),
    adjustments: decimalToString(statement.adjustments),
    closingBalance: decimalToString(statement.closingBalance),
    immutableSnapshot: statement.snapshot,
  };
}

function statementPeriod(input: z.infer<typeof pmsOwnerStatementCreateSchema>) {
  const range = getPmsStatementRange(input);
  if (!range.start || !range.end) throw new AppError(400, "A complete statement period is required.");
  const periodEnd = input.month ? new Date(range.end.getTime() - 1) : range.end;
  return { periodStart: range.start, periodEnd };
}

async function buildPersistentOwnerStatementData(input: {
  companyId: string;
  propertyId: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
}) {
  const current = await buildPmsOwnerStatement({
    companyId: input.companyId,
    propertyId: input.propertyId,
    dateFrom: input.periodStart,
    dateTo: input.periodEnd,
    currency: input.currency,
  });
  const history = await buildPmsOwnerStatement({
    companyId: input.companyId,
    propertyId: input.propertyId,
    dateTo: new Date(input.periodStart.getTime() - 1),
    currency: input.currency,
  });
  const currentTotals = current.totals as Record<string, string> | null;
  const historyTotals = history.totals as Record<string, string> | null;
  const openingBalance = Number(historyTotals?.netAmount ?? 0);
  const income = Number(currentTotals?.rentCollected ?? 0) + Number(currentTotals?.manualIncome ?? 0);
  const expenses = Number(currentTotals?.expenses ?? 0);
  const adjustments = Number(currentTotals?.adjustments ?? 0);
  const closingBalance = openingBalance + income - expenses + adjustments;
  const snapshot = JSON.parse(JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    currencyArchitecture: "GROUPED_NO_CONVERSION",
    period: { from: input.periodStart, to: input.periodEnd },
    financials: {
      openingBalance: moneyString(openingBalance),
      income: moneyString(income),
      expenses: moneyString(expenses),
      adjustments: moneyString(adjustments),
      closingBalance: moneyString(closingBalance),
    },
    statement: current,
  })) as Prisma.InputJsonValue;
  return {
    current,
    openingBalance,
    income,
    expenses,
    adjustments,
    closingBalance,
    snapshot,
  };
}

pmsRouter.get("/accounting/owner-statements", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = pmsOwnerStatementListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member);
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsOwnerStatementWhereInput = {
      companyId: access.company.id,
      ...(propertyId ? { propertyId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };
    const [statements, total] = await prisma.$transaction([
      prisma.pmsOwnerStatement.findMany({ where, include: pmsOwnerStatementInclude, orderBy: [{ periodStart: "desc" }, { revision: "desc" }], take: query.take, skip: query.skip }),
      prisma.pmsOwnerStatement.count({ where }),
    ]);
    res.json({ workspace: pmsWorkspacePayload(access), statements: statements.map(pmsOwnerStatementResponse), pagination: { take: query.take, skip: query.skip, count: statements.length, total } });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/accounting/owner-statements/:statementId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { statementId } = pmsOwnerStatementParamsSchema.parse(req.params);
    const statement = await prisma.pmsOwnerStatement.findUnique({ where: { id: statementId }, include: pmsOwnerStatementInclude });
    if (!statement) throw new AppError(404, "Owner statement not found.");
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: statement.companyId });
    assertCanViewPmsAccounting(access.member);
    assertCanAccessPmsPropertyScope(access, statement.propertyId);
    res.json({ workspace: pmsWorkspacePayload(access), statement: pmsOwnerStatementResponse(statement) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/accounting/owner-statements", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const data = pmsOwnerStatementCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanManagePmsAccounting(access.member);
    assertCanAccessPmsPropertyScope(access, data.propertyId);
    await assertPmsFilterLinksBelongToCompany({ companyId: access.company.id, propertyId: data.propertyId });
    const { periodStart, periodEnd } = statementPeriod(data);
    let revision = 1;
    if (data.revisionOfId) {
      const prior = await prisma.pmsOwnerStatement.findFirst({
        where: { id: data.revisionOfId, companyId: access.company.id, propertyId: data.propertyId, currency: data.currency, status: PmsOwnerStatementStatus.VOID },
      });
      if (!prior) throw new AppError(409, "A statement revision requires a matching void statement.");
      if (prior.periodStart.getTime() !== periodStart.getTime() || prior.periodEnd.getTime() !== periodEnd.getTime()) {
        throw new AppError(409, "A statement revision must preserve the original reporting period.");
      }
      revision = prior.revision + 1;
    }
    const activeDuplicate = await prisma.pmsOwnerStatement.findFirst({
      where: { companyId: access.company.id, propertyId: data.propertyId, periodStart, periodEnd, currency: data.currency, status: { not: PmsOwnerStatementStatus.VOID } },
      select: { id: true },
    });
    if (activeDuplicate) throw new AppError(409, "An active statement already exists for this property, period, and currency. Void it before creating a revision.");
    const generated = await buildPersistentOwnerStatementData({ companyId: access.company.id, propertyId: data.propertyId, periodStart, periodEnd, currency: data.currency });
    const statement = await prisma.$transaction(async (tx) => {
      const created = await tx.pmsOwnerStatement.create({
        data: {
          companyId: access.company.id,
          propertyId: data.propertyId,
          status: PmsOwnerStatementStatus.GENERATED,
          revision,
          revisionOfId: data.revisionOfId ?? null,
          ownerReference: normalizeNullableText(data.ownerReference),
          periodStart,
          periodEnd,
          currency: data.currency,
          includedRentPaymentIds: generated.current.includedRecordIds.rentPaymentIds,
          includedAccountingEntryIds: generated.current.includedRecordIds.accountingEntryIds,
          includedMaintenanceWorkOrderIds: generated.current.includedRecordIds.maintenanceWorkOrderIds,
          openingBalance: generated.openingBalance,
          income: generated.income,
          expenses: generated.expenses,
          adjustments: generated.adjustments,
          closingBalance: generated.closingBalance,
          snapshot: generated.snapshot,
          snapshotVersion: 1,
          generatedAt: new Date(),
          generatedById: req.user!.id,
        },
        include: pmsOwnerStatementInclude,
      });
      await recordDomainAuditEvent(tx, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: "pmsOwnerStatement",
        entityId: created.id,
        action: "generate",
        actorId: req.user!.id,
        changedFields: ["status", "snapshot"],
        metadata: { propertyId: created.propertyId, periodStart, periodEnd, currency: created.currency, revision: created.revision },
        ...requestAuditContext(req),
      });
      return created;
    });
    res.status(201).json({ statement: pmsOwnerStatementResponse(statement) });
  } catch (error) {
    next(isPrismaErrorCode(error, "P2002")
      ? new AppError(409, "An active statement already exists for this property, period, and currency. Void it before creating a revision.")
      : error);
  }
});

const ownerStatementTransitions: Partial<Record<PmsOwnerStatementStatus, PmsOwnerStatementStatus[]>> = {
  [PmsOwnerStatementStatus.DRAFT]: [PmsOwnerStatementStatus.GENERATED, PmsOwnerStatementStatus.VOID],
  [PmsOwnerStatementStatus.GENERATED]: [PmsOwnerStatementStatus.NEEDS_REVIEW, PmsOwnerStatementStatus.VOID],
  [PmsOwnerStatementStatus.NEEDS_REVIEW]: [PmsOwnerStatementStatus.APPROVED, PmsOwnerStatementStatus.VOID],
  [PmsOwnerStatementStatus.APPROVED]: [PmsOwnerStatementStatus.PUBLISHED, PmsOwnerStatementStatus.VOID],
  [PmsOwnerStatementStatus.PUBLISHED]: [PmsOwnerStatementStatus.VOID],
};

pmsRouter.post("/accounting/owner-statements/:statementId/transition", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { statementId } = pmsOwnerStatementParamsSchema.parse(req.params);
    const data = pmsOwnerStatementTransitionSchema.parse(req.body);
    const existing = await prisma.pmsOwnerStatement.findUnique({ where: { id: statementId } });
    if (!existing) throw new AppError(404, "Owner statement not found.");
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsAccounting(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);
    if (!(ownerStatementTransitions[existing.status] ?? []).includes(data.status)) {
      throw new AppError(409, `Owner statement cannot transition from ${existing.status} to ${data.status}.`);
    }
    const now = new Date();
    const statement = await prisma.$transaction(async (tx) => {
      const updated = await tx.pmsOwnerStatement.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          ...(data.status === PmsOwnerStatementStatus.APPROVED
            ? {
                reviewedAt: now,
                reviewedById: req.user!.id,
                approvedAt: now,
                approvedById: req.user!.id,
              }
            : {}),
          ...(data.status === PmsOwnerStatementStatus.PUBLISHED ? { publishedAt: now, publishedById: req.user!.id } : {}),
          ...(data.status === PmsOwnerStatementStatus.VOID ? { voidedAt: now, voidedById: req.user!.id } : {}),
        },
        include: pmsOwnerStatementInclude,
      });
      await recordDomainAuditEvent(tx, {
        companyId: existing.companyId,
        domain: DomainAuditDomain.PMS,
        entityType: "pmsOwnerStatement",
        entityId: existing.id,
        action: "status_transition",
        actorId: req.user!.id,
        changedFields: ["status"],
        beforeMetadata: { status: existing.status },
        afterMetadata: { status: updated.status },
        metadata: { propertyId: existing.propertyId, currency: existing.currency, revision: existing.revision },
        ...requestAuditContext(req),
      });
      return updated;
    });
    res.json({ statement: pmsOwnerStatementResponse(statement) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/accounting/property-summary", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingStatementQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member);
    await assertPmsFilterLinksBelongToCompany({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId });
    if (query.unitId) await assertCanAccessPmsUnitScope(access, query.unitId);
    const propertyScope = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const statement = await buildPmsOwnerStatement({
      companyId: access.company.id,
      propertyId: query.propertyId,
      propertyScope: typeof propertyScope === "string" ? undefined : propertyScope,
      unitId: query.unitId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      month: query.month,
      currency: query.currency,
    });

    res.json({ workspace: { company: access.company, member: access.member, entitlement: access.entitlement }, summary: statement.totals, statement });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/accounting/owner-statement", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingStatementQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member);
    await assertPmsFilterLinksBelongToCompany({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId });
    if (query.unitId) await assertCanAccessPmsUnitScope(access, query.unitId);
    const propertyScope = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const statement = await buildPmsOwnerStatement({
      companyId: access.company.id,
      propertyId: query.propertyId,
      propertyScope: typeof propertyScope === "string" ? undefined : propertyScope,
      unitId: query.unitId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      month: query.month,
      currency: query.currency,
    });

    res.json({ workspace: { company: access.company, member: access.member, entitlement: access.entitlement }, statement });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/reports/summary", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsOverviewQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    assertCanViewPmsReports(access.member);
    const summary = await buildPmsReportsSummary(
      access.company.id,
      pmsScopedPropertyIdWhere(access),
    );

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      ...summary,
    });
  } catch (error) {
    next(error);
  }
});


type PmsCsvRow = Record<string, string>;
type PmsImportRowPreview = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
};

type PmsImportPreview = {
  type: PmsImportType;
  headers: string[];
  totalRows: number;
  validRows: PmsImportRowPreview[];
  invalidRows: PmsImportRowPreview[];
};

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");
}

function sendPmsCsv(res: any, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}

function normalizeCsvHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(csvText: string) {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new AppError(400, "CSV file is empty.");

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normalizeCsvHeader);
  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new AppError(400, "CSV header row is required.");
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row: PmsCsvRow = {};
    headers.forEach((header, headerIndex) => {
      if (!header) return;
      row[header] = cells[headerIndex]?.trim() ?? "";
    });
    return { rowNumber: index + 2, row };
  });

  return { headers: rawHeaders, rows };
}

function csvValue(row: PmsCsvRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function parseOptionalBoolean(value: string) {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (["true", "yes", "1", "active"].includes(normalized)) return true;
  if (["false", "no", "0", "inactive"].includes(normalized)) return false;
  return undefined;
}

function parseOptionalNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRequiredDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function importRow(rowNumber: number, data: Record<string, unknown>, errors: string[]): PmsImportRowPreview {
  return { rowNumber, valid: errors.length === 0, errors, data };
}

function splitImportRows(rows: PmsImportRowPreview[]): PmsImportPreview["validRows" | "invalidRows"] {
  return rows.filter((row) => row.valid);
}

async function buildPmsImportPreview(input: {
  companyId: string;
  type: PmsImportType;
  csvText: string;
  allowSensitiveTenantData: boolean;
}): Promise<PmsImportPreview> {
  const parsed = parseCsvText(input.csvText);
  const companyId = input.companyId;

  if (input.type === PmsImportType.PROPERTIES) {
    const existingCodes = new Set(
      (await prisma.pmsProperty.findMany({
        where: { companyId, code: { not: null } },
        select: { code: true },
      })).map((property) => property.code?.toLowerCase()).filter(Boolean) as string[],
    );
    const seenCodes = new Set<string>();
    const rows = parsed.rows.map(({ rowNumber, row }) => {
      const name = csvValue(row, ["name", "propertyName", "property"]);
      const code = csvValue(row, ["code", "propertyCode"]);
      const errors: string[] = [];
      if (!name) errors.push("Property name is required.");
      if (code) {
        const codeKey = code.toLowerCase();
        if (existingCodes.has(codeKey)) errors.push("Property code already exists in this company.");
        if (seenCodes.has(codeKey)) errors.push("Duplicate property code in this CSV.");
        seenCodes.add(codeKey);
      }
      const active = parseOptionalBoolean(csvValue(row, ["active", "status"]));
      return importRow(rowNumber, {
        companyId,
        name,
        code: code || null,
        propertyType: csvValue(row, ["propertyType", "type"]) || null,
        addressLine: csvValue(row, ["address", "addressLine"]) || null,
        city: csvValue(row, ["city"]) || null,
        area: csvValue(row, ["area"]) || null,
        notes: csvValue(row, ["notes"]) || null,
        active: active ?? true,
      }, errors);
    });
    return { type: input.type, headers: parsed.headers, totalRows: rows.length, validRows: splitImportRows(rows), invalidRows: rows.filter((row) => !row.valid) };
  }

  const properties = await prisma.pmsProperty.findMany({
    where: { companyId },
    select: { id: true, name: true, code: true },
  });
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const propertyByCode = new Map(properties.filter((property) => property.code).map((property) => [property.code!.toLowerCase(), property]));
  const propertyByName = new Map(properties.map((property) => [property.name.toLowerCase(), property]));

  if (input.type === PmsImportType.UNITS) {
    const existingUnits = await prisma.pmsUnit.findMany({
      where: { companyId },
      select: { propertyId: true, unitNumber: true },
    });
    const existingUnitKeys = new Set(existingUnits.map((unit) => `${unit.propertyId}:${unit.unitNumber.toLowerCase()}`));
    const seenUnitKeys = new Set<string>();
    const rows = parsed.rows.map(({ rowNumber, row }) => {
      const propertyIdValue = csvValue(row, ["propertyId"]);
      const propertyCode = csvValue(row, ["propertyCode", "code"]);
      const propertyName = csvValue(row, ["propertyName", "property"]);
      const property = propertyById.get(propertyIdValue) || propertyByCode.get(propertyCode.toLowerCase()) || propertyByName.get(propertyName.toLowerCase());
      const unitNumber = csvValue(row, ["unitNumber", "unit", "number"]);
      const errors: string[] = [];
      if (!property) errors.push("A matching propertyId, propertyCode, or propertyName is required.");
      if (!unitNumber) errors.push("Unit number is required.");
      if (property && unitNumber) {
        const key = `${property.id}:${unitNumber.toLowerCase()}`;
        if (existingUnitKeys.has(key)) errors.push("Unit already exists for this property.");
        if (seenUnitKeys.has(key)) errors.push("Duplicate unit in this CSV.");
        seenUnitKeys.add(key);
      }
      const rentAmount = parseOptionalNumber(csvValue(row, ["rentAmount", "rent"]));
      const bedrooms = parseOptionalNumber(csvValue(row, ["bedrooms", "beds"]));
      const bathrooms = parseOptionalNumber(csvValue(row, ["bathrooms", "baths"]));
      const areaSqm = parseOptionalNumber(csvValue(row, ["areaSqm", "area"]));
      const importedStatus = Object.values(PmsUnitStatus).includes(csvValue(row, ["status"]).toUpperCase() as PmsUnitStatus)
        ? csvValue(row, ["status"]).toUpperCase() as PmsUnitStatus
        : PmsUnitStatus.VACANT;
      if (importedStatus === PmsUnitStatus.OCCUPIED) {
        errors.push("Occupied status cannot be imported directly. Occupancy is derived from active leases.");
      }
      const operationalStatus = operationalStatusFromLegacyUnitStatus(importedStatus);
      return importRow(rowNumber, {
        companyId,
        propertyId: property?.id,
        unitNumber,
        unitName: csvValue(row, ["unitName", "name"]) || null,
        floor: csvValue(row, ["floor"]) || null,
        bedrooms: bedrooms ?? null,
        bathrooms: bathrooms ?? null,
        areaSqm: areaSqm ?? null,
        status: compatibilityUnitStatus(operationalStatus, PmsOccupancyStatus.VACANT),
        occupancyStatus: PmsOccupancyStatus.VACANT,
        operationalStatus,
        rentAmount: rentAmount ?? null,
        currency: (csvValue(row, ["currency"]) || "OMR").toUpperCase(),
        notes: csvValue(row, ["notes"]) || null,
      }, errors);
    });
    return { type: input.type, headers: parsed.headers, totalRows: rows.length, validRows: splitImportRows(rows), invalidRows: rows.filter((row) => !row.valid) };
  }

  if (input.type === PmsImportType.TENANTS) {
    const existingEmails = new Set(
      (await prisma.pmsTenant.findMany({
        where: { companyId, email: { not: null } },
        select: { email: true },
      })).map((tenant) => tenant.email?.toLowerCase()).filter(Boolean) as string[],
    );
    const seenEmails = new Set<string>();
    const rows = parsed.rows.map(({ rowNumber, row }) => {
      const fullName = csvValue(row, ["fullName", "tenantName", "name"]);
      const email = csvValue(row, ["email", "tenantEmail"]);
      const nationalId = csvValue(row, ["nationalId", "idNumber"]);
      const passportNumber = csvValue(row, ["passportNumber", "passport"]);
      const errors: string[] = [];
      if (!fullName) errors.push("Tenant full name is required.");
      if (!input.allowSensitiveTenantData && (nationalId || passportNumber)) {
        errors.push("Sensitive tenant identity import requires sensitive-data access.");
      }
      if (email) {
        const key = email.toLowerCase();
        if (existingEmails.has(key)) errors.push("Tenant email already exists in this company.");
        if (seenEmails.has(key)) errors.push("Duplicate tenant email in this CSV.");
        seenEmails.add(key);
      }
      return importRow(rowNumber, {
        companyId,
        fullName,
        phone: csvValue(row, ["phone", "tenantPhone"]) || null,
        email: email || null,
        nationality: csvValue(row, ["nationality"]) || null,
        nationalId: input.allowSensitiveTenantData ? nationalId || null : null,
        passportNumber: input.allowSensitiveTenantData ? passportNumber || null : null,
        emergencyContactName: csvValue(row, ["emergencyContactName"]) || null,
        emergencyContactPhone: csvValue(row, ["emergencyContactPhone"]) || null,
        emergencyContactEmail: csvValue(row, ["emergencyContactEmail"]) || null,
        notes: csvValue(row, ["notes"]) || null,
        active: parseOptionalBoolean(csvValue(row, ["active"])) ?? true,
      }, errors);
    });
    return { type: input.type, headers: parsed.headers, totalRows: rows.length, validRows: splitImportRows(rows), invalidRows: rows.filter((row) => !row.valid) };
  }

  const tenants = await prisma.pmsTenant.findMany({
    where: { companyId },
    select: { id: true, fullName: true, email: true },
  });
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const tenantByEmail = new Map(tenants.filter((tenant) => tenant.email).map((tenant) => [tenant.email!.toLowerCase(), tenant]));
  const tenantByName = new Map(tenants.map((tenant) => [tenant.fullName.toLowerCase(), tenant]));
  const units = await prisma.pmsUnit.findMany({
    where: { companyId },
    select: { id: true, unitNumber: true, propertyId: true },
  });
  const unitByPropertyAndNumber = new Map(units.map((unit) => [`${unit.propertyId}:${unit.unitNumber.toLowerCase()}`, unit]));
  const occupiedLeaseUnits = new Set((await prisma.pmsLease.findMany({
    where: { companyId, status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] } },
    select: { unitId: true },
  })).map((lease) => lease.unitId));

  const rows = parsed.rows.map(({ rowNumber, row }) => {
    const tenantIdValue = csvValue(row, ["tenantId"]);
    const tenantEmail = csvValue(row, ["tenantEmail", "email"]);
    const tenantName = csvValue(row, ["tenantName", "fullName"]);
    const tenant = tenantById.get(tenantIdValue) || tenantByEmail.get(tenantEmail.toLowerCase()) || tenantByName.get(tenantName.toLowerCase());
    const propertyIdValue = csvValue(row, ["propertyId"]);
    const propertyCode = csvValue(row, ["propertyCode"]);
    const propertyName = csvValue(row, ["propertyName", "property"]);
    const property = propertyById.get(propertyIdValue) || propertyByCode.get(propertyCode.toLowerCase()) || propertyByName.get(propertyName.toLowerCase());
    const unitNumber = csvValue(row, ["unitNumber", "unit"]);
    const unit = property && unitNumber ? unitByPropertyAndNumber.get(`${property.id}:${unitNumber.toLowerCase()}`) : undefined;
    const startDate = parseRequiredDate(csvValue(row, ["startDate", "leaseStart"]));
    const endDateRaw = csvValue(row, ["endDate", "leaseEnd"]);
    const endDate = endDateRaw ? parseRequiredDate(endDateRaw) : null;
    const rentAmount = parseOptionalNumber(csvValue(row, ["rentAmount", "rent"]));
    const errors: string[] = [];
    if (!tenant) errors.push("A matching tenantId, tenantEmail, or tenantName is required.");
    if (!property) errors.push("A matching propertyId, propertyCode, or propertyName is required.");
    if (!unit) errors.push("A matching unitNumber under the property is required.");
    if (!startDate) errors.push("Valid startDate is required.");
    if (endDateRaw && !endDate) errors.push("endDate is invalid.");
    if (!rentAmount || rentAmount <= 0) errors.push("rentAmount must be greater than zero.");
    if (unit && occupiedLeaseUnits.has(unit.id)) errors.push("Unit already has an active or expiring lease.");
    return importRow(rowNumber, {
      companyId,
      tenantId: tenant?.id,
      propertyId: property?.id,
      unitId: unit?.id,
      title: csvValue(row, ["title", "leaseTitle"]) || null,
      status: PmsLeaseStatus.DRAFT,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      rentFrequency: Object.values(PaymentScheduleFrequency).includes(csvValue(row, ["rentFrequency", "frequency"]).toUpperCase() as PaymentScheduleFrequency)
        ? csvValue(row, ["rentFrequency", "frequency"]).toUpperCase()
        : PaymentScheduleFrequency.MONTHLY,
      rentAmount: rentAmount ?? 0,
      currency: (csvValue(row, ["currency"]) || "OMR").toUpperCase(),
      securityDeposit: parseOptionalNumber(csvValue(row, ["securityDeposit", "deposit"])) ?? null,
      dueDayOfMonth: parseOptionalNumber(csvValue(row, ["dueDayOfMonth", "dueDay"])) ?? null,
      notes: csvValue(row, ["notes"]) || null,
    }, errors);
  });
  return { type: input.type, headers: parsed.headers, totalRows: rows.length, validRows: splitImportRows(rows), invalidRows: rows.filter((row) => !row.valid) };
}

function pmsImportBatchResponse(batch: Prisma.PmsImportBatchGetPayload<{ include: { createdBy: { select: { id: true; name: true; email: true; role: true } } } }>) {
  return {
    id: batch.id,
    companyId: batch.companyId,
    type: batch.type,
    filename: batch.filename,
    status: batch.status,
    totalRows: batch.totalRows,
    successfulRows: batch.successfulRows,
    failedRows: batch.failedRows,
    metadata: batch.metadata,
    createdBy: batch.createdBy,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

const pmsImportBatchInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.PmsImportBatchInclude;

async function commitPmsImportRows(input: {
  companyId: string;
  type: PmsImportType;
  filename?: string | null;
  preview: PmsImportPreview;
  userId: string;
}) {
  const validRows = input.preview.validRows;
  const invalidRows = input.preview.invalidRows;
  return prisma.$transaction(async (tx) => {
    const batch = await tx.pmsImportBatch.create({
      data: {
        companyId: input.companyId,
        type: input.type,
        filename: input.filename || null,
        status: invalidRows.length > 0 ? PmsImportStatus.PARTIAL : PmsImportStatus.COMMITTED,
        totalRows: input.preview.totalRows,
        successfulRows: validRows.length,
        failedRows: invalidRows.length,
        createdById: input.userId,
        metadata: {
          invalidRows,
          headers: input.preview.headers,
        } as Prisma.InputJsonObject,
      },
      include: pmsImportBatchInclude,
    });

    for (const row of validRows) {
      const data = row.data as any;
      if (input.type === PmsImportType.PROPERTIES) {
        await tx.pmsProperty.create({ data: { ...data, createdById: input.userId, updatedById: input.userId } });
      } else if (input.type === PmsImportType.UNITS) {
        await tx.pmsUnit.create({ data: { ...data, createdById: input.userId, updatedById: input.userId } });
      } else if (input.type === PmsImportType.TENANTS) {
        await tx.pmsTenant.create({ data: { ...data, createdById: input.userId, updatedById: input.userId } });
      } else if (input.type === PmsImportType.LEASES) {
        await tx.pmsLease.create({ data: { ...data, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null, createdById: input.userId, updatedById: input.userId } });
      }
    }

    return batch;
  });
}

function pmsExportKey(type: string): "properties" | "units" | "tenants" | "leases" | "rent_roll" | "maintenance" | "accounting" {
  if (type === "rent-roll") return "rent_roll";
  if (type === "accounting-summary") return "accounting";
  return type as "properties" | "units" | "tenants" | "leases" | "maintenance";
}



pmsRouter.get("/import-batches", requireAuth(), async (req, res, next) => {
  try {
    const query = pmsImportBatchListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user!.id, companyId: query.companyId });
    assertCanManagePmsImports(access.member);
    assertCanRunPmsBulkImport(access);
    const where: Prisma.PmsImportBatchWhereInput = {
      companyId: access.company.id,
      ...(query.type !== "ALL" ? { type: query.type } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
    };
    const [batches, total] = await prisma.$transaction([
      prisma.pmsImportBatch.findMany({ where, include: pmsImportBatchInclude, orderBy: { createdAt: "desc" }, take: query.take, skip: query.skip }),
      prisma.pmsImportBatch.count({ where }),
    ]);
    res.json({ batches: batches.map(pmsImportBatchResponse), page: { take: query.take, skip: query.skip, count: batches.length, total } });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/imports/templates/:type.csv", requireAuth(), async (req, res, next) => {
  try {
    const { type } = pmsImportTypeParamsSchema.parse(req.params);
    const query = pmsOverviewQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user!.id, companyId: query.companyId });
    assertCanManagePmsImports(access.member);
    assertCanRunPmsBulkImport(access);
    const headersByType: Record<PmsImportType, string[]> = {
      PROPERTIES: ["name", "code", "propertyType", "address", "city", "area", "notes", "active"],
      UNITS: ["propertyCode", "propertyName", "unitNumber", "unitName", "floor", "bedrooms", "bathrooms", "areaSqm", "rentAmount", "currency", "status", "notes"],
      TENANTS: ["fullName", "phone", "email", "nationality", "nationalId", "passportNumber", "emergencyContactName", "emergencyContactPhone", "emergencyContactEmail", "notes", "active"],
      LEASES: ["tenantEmail", "tenantName", "propertyCode", "propertyName", "unitNumber", "title", "startDate", "endDate", "rentFrequency", "rentAmount", "currency", "securityDeposit", "dueDayOfMonth", "notes"],
    };
    sendPmsCsv(res, `pms-${type.toLowerCase()}-template.csv`, toCsv(headersByType[type], []));
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/imports/preview", requireAuth(), async (req, res, next) => {
  try {
    const data = pmsImportBodySchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user!.id, companyId: data.companyId });
    assertCanManagePmsImports(access.member);
    assertCanRunPmsBulkImport(access);
    const preview = await buildPmsImportPreview({
      companyId: access.company.id,
      type: data.type,
      csvText: data.csvText,
      allowSensitiveTenantData: canViewPmsSensitiveData(access.member),
    });
    res.json({ preview });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/imports/commit", requireAuth(), async (req, res, next) => {
  try {
    const data = pmsImportBodySchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user!.id, companyId: data.companyId });
    assertCanManagePmsImports(access.member);
    assertCanRunPmsBulkImport(access);
    const preview = await buildPmsImportPreview({
      companyId: access.company.id,
      type: data.type,
      csvText: data.csvText,
      allowSensitiveTenantData: canViewPmsSensitiveData(access.member),
    });
    if (preview.validRows.length === 0) {
      const batch = await prisma.pmsImportBatch.create({
        data: {
          companyId: access.company.id,
          type: data.type,
          filename: data.filename || null,
          status: PmsImportStatus.FAILED,
          totalRows: preview.totalRows,
          successfulRows: 0,
          failedRows: preview.invalidRows.length,
          createdById: req.user!.id,
          metadata: { invalidRows: preview.invalidRows, headers: preview.headers } as Prisma.InputJsonObject,
        },
        include: pmsImportBatchInclude,
      });
      res.status(400).json({ preview, batch: pmsImportBatchResponse(batch), message: "No valid rows to import." });
      return;
    }
    const batch = await commitPmsImportRows({ companyId: access.company.id, type: data.type, filename: data.filename, preview, userId: req.user!.id });
    await recordPmsWorkspaceAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      companyId: access.company.id,
      title: "PMS bulk import committed",
      message: `${req.user!.email} imported ${preview.validRows.length} ${data.type.toLowerCase()} rows.`,
      metadata: { type: data.type, batchId: batch.id, successfulRows: preview.validRows.length, failedRows: preview.invalidRows.length },
    });
    res.status(201).json({ preview, batch: pmsImportBatchResponse(batch) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/exports/:type.csv", requireAuth(), async (req, res, next) => {
  try {
    const { type } = pmsExportTypeParamsSchema.parse(req.params);
    const query = pmsExportQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user!.id, companyId: query.companyId });
    const exportKey = pmsExportKey(type);
    assertCanExportPmsData(access.member, exportKey);
    if (query.includeSensitive) {
      if (type !== "tenants") throw new AppError(400, "Sensitive export is only available for tenant exports.");
      assertCanExportPmsSensitiveData(access.member);
      if (query.sensitiveExportConfirmation !== "EXPORT_SENSITIVE_TENANT_DATA") {
        throw new AppError(400, "Confirm the sensitive tenant export explicitly.");
      }
    }
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
    });
    const companyId = access.company.id;
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    if (type === "properties") {
      const rows = await prisma.pmsProperty.findMany({
        where: {
          companyId,
          ...(propertyId ? { id: propertyId } : {}),
        },
        orderBy: { name: "asc" },
      });
      sendPmsCsv(res, "pms-properties.csv", toCsv(["id", "name", "code", "propertyType", "addressLine", "city", "area", "active", "createdAt"], rows.map((row) => [row.id, row.name, row.code, row.propertyType, row.addressLine, row.city, row.area, row.active, row.createdAt])));
      return;
    }
    if (type === "units") {
      const rows = await prisma.pmsUnit.findMany({ where: { companyId, ...(propertyId ? { propertyId } : {}) }, include: { property: { select: { name: true, code: true } } }, orderBy: [{ property: { name: "asc" } }, { unitNumber: "asc" }] });
      sendPmsCsv(res, "pms-units.csv", toCsv(["id", "property", "propertyCode", "unitNumber", "unitName", "floor", "bedrooms", "bathrooms", "areaSqm", "status", "occupancyStatus", "rentAmount", "currency"], rows.map((row) => [row.id, row.property.name, row.property.code, row.unitNumber, row.unitName, row.floor, row.bedrooms, row.bathrooms, row.areaSqm, row.status, row.occupancyStatus, row.rentAmount, row.currency])));
      return;
    }
    if (type === "tenants") {
      const rows = await prisma.pmsTenant.findMany({
        where: {
          companyId,
          ...(query.tenantId ? { id: query.tenantId } : {}),
          ...(propertyId ? { leases: { some: { propertyId } } } : {}),
        },
        orderBy: { fullName: "asc" },
      });
      const headers = ["id", "fullName", "phone", "email", "nationality", ...(query.includeSensitive ? ["nationalId", "passportNumber"] : []), "active"];
      const values = rows.map((row) => [row.id, row.fullName, row.phone, row.email, row.nationality, ...(query.includeSensitive ? [row.nationalId, row.passportNumber] : []), row.active]);
      if (query.includeSensitive) {
        await recordDomainAuditEvent(prisma, {
          companyId,
          domain: DomainAuditDomain.PMS,
          entityType: "pmsTenantExport",
          action: "sensitive_export",
          actorId: req.user!.id,
          metadata: { exportType: type, propertyFilter: query.propertyId ?? null, tenantFilter: query.tenantId ?? null, workspaceId: companyId, rowCount: rows.length },
          ...requestAuditContext(req),
        });
      }
      sendPmsCsv(res, "pms-tenants.csv", toCsv(headers, values));
      return;
    }
    if (type === "leases") {
      const rows = await prisma.pmsLease.findMany({ where: { companyId, ...(propertyId ? { propertyId } : {}), ...(query.unitId ? { unitId: query.unitId } : {}), ...(query.tenantId ? { tenantId: query.tenantId } : {}) }, include: pmsLeaseInclude, orderBy: { startDate: "desc" } });
      sendPmsCsv(res, "pms-leases.csv", toCsv(["id", "title", "tenant", "property", "unit", "status", "startDate", "endDate", "rentAmount", "currency", "securityDeposit"], rows.map((row) => [row.id, row.title, row.tenant.fullName, row.property.name, row.unit.unitNumber, row.status, row.startDate, row.endDate, row.rentAmount, row.currency, row.securityDeposit])));
      return;
    }
    if (type === "rent-roll") {
      const rows = await prisma.pmsRentDueItem.findMany({ where: { companyId, ...(propertyId ? { propertyId } : {}), ...(query.unitId ? { unitId: query.unitId } : {}), ...(query.tenantId ? { tenantId: query.tenantId } : {}) }, include: pmsRentDueItemInclude, orderBy: { dueDate: "asc" } });
      sendPmsCsv(res, "pms-rent-roll.csv", toCsv(["id", "tenant", "property", "unit", "dueDate", "amount", "paidAmount", "currency", "status"], rows.map((row) => [row.id, row.tenant.fullName, row.property.name, row.unit.unitNumber, row.dueDate, row.amount, row.paidAmount, row.currency, row.status])));
      return;
    }
    if (type === "maintenance") {
      const rows = await prisma.pmsWorkOrder.findMany({ where: { companyId, ...(propertyId ? { propertyId } : {}), ...(query.unitId ? { unitId: query.unitId } : {}), ...(query.tenantId ? { tenantId: query.tenantId } : {}) }, include: pmsWorkOrderInclude, orderBy: { updatedAt: "desc" } });
      sendPmsCsv(res, "pms-maintenance.csv", toCsv(["id", "title", "property", "unit", "tenant", "vendor", "priority", "status", "cost", "currency", "targetDate", "isOverdue"], rows.map((row) => [row.id, row.title, row.property.name, row.unit?.unitNumber, row.tenant?.fullName, row.vendor?.name, row.priority, row.status, row.cost, row.currency, row.targetDate,
        Boolean(
          row.targetDate &&
            row.targetDate < new Date() &&
            row.status !== PmsMaintenanceStatus.RESOLVED &&
            row.status !== PmsMaintenanceStatus.CANCELLED
        )])));
      return;
    }
    const where: Prisma.PmsAccountingLedgerEntryWhereInput = {
      companyId,
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.dateFrom || query.dateTo ? { transactionDate: buildPmsAccountingDateFilter({ dateFrom: query.dateFrom, dateTo: query.dateTo }) } : {}),
    };
    const rows = await prisma.pmsAccountingLedgerEntry.findMany({ where, include: pmsAccountingLedgerEntryInclude, orderBy: { transactionDate: "desc" } });
    sendPmsCsv(res, "pms-accounting-summary.csv", toCsv(["id", "type", "category", "amount", "currency", "transactionDate", "property", "unit", "tenant", "source", "referenceNumber"], rows.map((row) => [row.id, row.type, row.category, row.amount, row.currency, row.transactionDate, row.property?.name, row.unit?.unitNumber, row.tenant?.fullName, row.source, row.referenceNumber])));
  } catch (error) {
    next(error);
  }
});


pmsRouter.get("/communication-templates", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsCommunicationTemplateListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const search = query.search?.trim();
    const where: Prisma.PmsCommunicationTemplateWhereInput = {
      companyId: access.company.id,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(query.channel !== "ALL" ? { channel: query.channel } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { type: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [templates, total] = await prisma.$transaction([
      prisma.pmsCommunicationTemplate.findMany({
        where,
        orderBy: buildPmsCommunicationTemplateOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsCommunicationTemplate.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      templates: templates.map(pmsCommunicationTemplateResponse),
      pagination: { take: query.take, skip: query.skip, count: templates.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/communication-templates", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsCommunicationTemplateCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({ userId, companyId: data.companyId });
    assertCanManagePmsOperations(access.member);

    const template = await prisma.pmsCommunicationTemplate.create({
      data: {
        companyId: access.company.id,
        name: data.name,
        channel: data.channel,
        type: normalizeNullableText(data.type),
        subject: normalizeNullableText(data.subject),
        body: data.body,
        active: data.active,
        notes: normalizeNullableText(data.notes),
        createdById: userId,
        updatedById: userId,
      },
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS communication template created",
      message: `${req.user.email} created PMS communication template ${template.name}.`,
      metadata: {
        action: "create",
        resourceType: "pmsCommunicationTemplate",
        templateId: template.id,
        channel: template.channel,
      },
    });

    res.status(201).json({ template: pmsCommunicationTemplateResponse(template) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/communication-templates/:templateId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { templateId } = pmsCommunicationTemplateParamsSchema.parse(req.params);
    const data = pmsCommunicationTemplateUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsCommunicationTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS communication template not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId, companyId: existing.companyId });
    assertCanManagePmsOperations(access.member);

    const template = await prisma.pmsCommunicationTemplate.update({
      where: { id: templateId },
      data: buildPmsCommunicationTemplateUpdateData(data, userId),
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS communication template updated",
      message: `${req.user.email} updated PMS communication template ${template.name}.`,
      metadata: {
        action: "update",
        resourceType: "pmsCommunicationTemplate",
        templateId: template.id,
        channel: template.channel,
        changedFields: Object.keys(data),
      },
    });

    res.json({ template: pmsCommunicationTemplateResponse(template) });
  } catch (error) {
    next(error);
  }
});


pmsRouter.get("/communication-logs", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsCommunicationLogListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsCommunications(access.member);

    const search = query.search?.trim();
    const propertyScope = pmsScopedPropertyIdWhere(access);
    const andFilters: Prisma.PmsCommunicationLogWhereInput[] = [];
    if (propertyScope) {
      andFilters.push({
        OR: [
          { lease: { is: { propertyId: propertyScope } } },
          { rentDueItem: { is: { propertyId: propertyScope } } },
          { workOrder: { is: { propertyId: propertyScope } } },
          { tenant: { is: { leases: { some: { propertyId: propertyScope } } } } },
        ],
      });
    }
    if (search) {
      andFilters.push({
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          { body: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { tenant: { fullName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    const where: Prisma.PmsCommunicationLogWhereInput = {
      companyId: access.company.id,
      ...(query.channel !== "ALL" ? { channel: query.channel } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.rentDueItemId ? { rentDueItemId: query.rentDueItemId } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.pmsCommunicationLog.findMany({
        where,
        include: pmsCommunicationLogInclude,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsCommunicationLog.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      logs: logs.map(pmsCommunicationLogResponse),
      pagination: { take: query.take, skip: query.skip, count: logs.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/communication-templates/preview", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsCommunicationContextSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanViewPmsCommunications(access.member);
    await assertCanAccessPmsCommunicationScope(access, data);

    const template = data.templateId
      ? await prisma.pmsCommunicationTemplate.findFirst({
          where: { id: data.templateId, companyId: access.company.id },
        })
      : null;

    if (data.templateId && !template) {
      throw new AppError(404, "PMS communication template not found");
    }

    const variables = await buildPmsCommunicationVariables(access.company.id, data);
    const subjectSource = data.subject ?? template?.subject ?? null;
    const bodySource = data.body ?? template?.body ?? "";
    const channel = data.channel ?? template?.channel ?? PmsCommunicationChannel.EMAIL;

    res.json({
      channel,
      variables,
      availableVariables: TEMPLATE_VARIABLE_LABELS,
      subject: renderPmsTemplate(subjectSource, variables),
      body: renderPmsTemplate(bodySource, variables) ?? "",
      template: template ? pmsCommunicationTemplateResponse(template) : null,
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/communication-logs/send", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsCommunicationSendSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    const context = inferCommunicationContext(data);
    assertCanSendPmsCommunication(access.member, context);
    await assertCanAccessPmsCommunicationScope(access, data);

    const template = data.templateId
      ? await prisma.pmsCommunicationTemplate.findFirst({
          where: { id: data.templateId, companyId: access.company.id },
        })
      : null;
    if (data.templateId && !template) throw new AppError(404, "PMS communication template not found");

    const variables = await buildPmsCommunicationVariables(access.company.id, data);
    const subject = renderPmsTemplate(data.subject ?? template?.subject ?? null, variables);
    const body = renderPmsTemplate(data.body ?? template?.body ?? "", variables) ?? "";
    const shouldCreateNotification = data.channel === PmsCommunicationChannel.INTERNAL || data.channel === PmsCommunicationChannel.EMAIL;
    const targetUserId = shouldCreateNotification
      ? await findTenantPortalNotificationUser(access.company.id, data.tenantId)
      : null;

    const log = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.pmsCommunicationLog.create({
        data: {
          companyId: access.company.id,
          templateId: template?.id ?? null,
          tenantId: data.tenantId ?? null,
          leaseId: data.leaseId ?? null,
          rentDueItemId: data.rentDueItemId ?? null,
          workOrderId: data.workOrderId ?? null,
          channel: data.channel,
          subject,
          body,
          status: data.status === PmsCommunicationLogStatus.DRAFT ? PmsCommunicationLogStatus.LOGGED : data.status,
          notes: normalizeNullableText(data.notes),
          deliveryMetadata: {
            schedulerReady: true,
            whatsappCopyOnly: data.channel === PmsCommunicationChannel.WHATSAPP,
            smsPlaceholderOnly: data.channel === PmsCommunicationChannel.SMS,
            inAppNotificationCreated: Boolean(targetUserId),
          },
          sentAt: data.status === PmsCommunicationLogStatus.SENT ? new Date() : null,
          createdById: req.user!.id,
          sentById: req.user!.id,
        },
        include: pmsCommunicationLogInclude,
      });

      if (targetUserId) {
        await tx.notification.create({
          data: {
            userId: targetUserId,
            type: context === "maintenance"
              ? NotificationType.PMS_MAINTENANCE_REQUEST_CREATED
              : NotificationType.RENT_PAYMENT_DUE,
            title: subject || "PMS notice",
            message: body.slice(0, 500),
          },
        });
      }

      if (data.channel === PmsCommunicationChannel.EMAIL) {
        await tx.emailDeliveryEvent.create({
          data: {
            status: EmailDeliveryStatus.LOGGED,
            deliveryMode: "pms-communication-log",
            notificationType: context === "maintenance"
              ? NotificationType.PMS_MAINTENANCE_REQUEST_CREATED
              : NotificationType.RENT_PAYMENT_DUE,
            title: subject || "PMS notice",
            recipientUserId: targetUserId,
            recipientEmail: null,
            reason: "PMS email send is logged and adapter-ready; no direct SMTP dispatch is wired for PMS notices yet.",
          },
        });
      }

      return createdLog;
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS communication logged",
      message: `${req.user.email} logged a PMS ${data.channel.toLowerCase()} communication.`,
      metadata: {
        action: "sendOrLog",
        resourceType: "pmsCommunicationLog",
        logId: log.id,
        channel: log.channel,
        status: log.status,
        context,
      },
    });

    res.status(201).json({ log: pmsCommunicationLogResponse(log) });
  } catch (error) {
    next(error);
  }
});

type PmsAutomationType = z.infer<typeof pmsAutomationTypeSchema>;

function pmsAutomationCommunicationContext(
  type: PmsAutomationType,
): "rent" | "maintenance" | "general" {
  if (type === "RENT_DUE_SOON" || type === "OVERDUE_RENT") return "rent";
  if (type === "MAINTENANCE_STATUS") return "maintenance";
  return "general";
}

type PmsAutomationCandidate = {
  candidateKey: string;
  type: PmsAutomationType;
  propertyId: string | null;
  property?: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string; unitName: string | null } | null;
  tenantId?: string | null;
  tenant?: { id: string; fullName: string; email: string | null } | null;
  rentDueItemId?: string;
  leaseId?: string;
  workOrderId?: string;
  documentId?: string;
  dueDate?: Date | null;
  leaseEndDate?: Date | null;
  documentExpiryDate?: Date | null;
  amount?: string;
  paidAmount?: string;
  currency?: string;
  status?: string;
  maintenanceTitle?: string;
  maintenanceStatus?: PmsMaintenanceStatus;
  priority?: PmsMaintenancePriority;
  reminderReason?: string;
  subject: string;
  body: string;
};

async function resolvePmsAutomationPropertyId(
  access: PmsWorkspaceAccess,
  propertyId?: string,
): Promise<string | Prisma.StringFilter | undefined> {
  if (!propertyId) return pmsScopedPropertyIdWhere(access);

  assertCanAccessPmsPropertyScope(access, propertyId);
  const property = await prisma.pmsProperty.findFirst({
    where: { id: propertyId, companyId: access.company.id },
    select: { id: true },
  });
  if (!property) throw new AppError(404, "PMS property not found");
  return propertyId;
}

async function listPmsAutomationCandidates(input: {
  access: PmsWorkspaceAccess;
  type: PmsAutomationType;
  days: number;
  take: number;
  skip: number;
  propertyId?: string;
}): Promise<PmsAutomationCandidate[]> {
  const now = new Date();
  const until = new Date(now.getTime() + input.days * 86_400_000);
  const staleBefore = new Date(now.getTime() - 7 * 86_400_000);
  const propertyId = await resolvePmsAutomationPropertyId(input.access, input.propertyId);
  const propertyWhere = propertyId ? { propertyId } : {};

  if (input.type === "RENT_DUE_SOON" || input.type === "OVERDUE_RENT") {
    assertCanViewPmsRent(input.access.member);
    const items = await prisma.pmsRentDueItem.findMany({
      where: {
        companyId: input.access.company.id,
        ...propertyWhere,
        status: {
          in: input.type === "RENT_DUE_SOON"
            ? [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON, PmsRentDueStatus.PARTIALLY_PAID]
            : [PmsRentDueStatus.UNPAID, PmsRentDueStatus.OVERDUE, PmsRentDueStatus.PARTIALLY_PAID],
        },
        dueDate: input.type === "RENT_DUE_SOON"
          ? { gte: now, lte: until }
          : { lt: now },
      },
      include: {
        tenant: { select: { id: true, fullName: true, email: true } },
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true, unitName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: input.take,
      skip: input.skip,
    });

    return items.map((item) => {
      const outstanding = Math.max(Number(item.amount) - Number(item.paidAmount), 0);
      const overdue = input.type === "OVERDUE_RENT";
      return {
        candidateKey: `${input.type}:${item.id}`,
        type: input.type,
        rentDueItemId: item.id,
        tenantId: item.tenantId,
        tenant: item.tenant,
        propertyId: item.propertyId,
        property: item.property,
        unit: item.unit,
        dueDate: item.dueDate,
        amount: item.amount.toString(),
        paidAmount: item.paidAmount.toString(),
        currency: item.currency,
        status: item.status,
        subject: overdue ? "Overdue rent reminder" : "Upcoming rent reminder",
        body: `${item.tenant.fullName} has ${moneyString(outstanding)} ${item.currency} ${overdue ? "overdue" : "due soon"} for ${item.property.name} · ${item.unit.unitNumber}.`,
      };
    });
  }

  if (input.type === "LEASE_EXPIRY") {
    if (!input.access.member.permissionKeys.includes(PmsPermissionKey.TENANCY_VIEW)) {
      throw new AppError(403, "Your PMS role cannot view tenancy records.");
    }
    const leases = await prisma.pmsLease.findMany({
      where: {
        companyId: input.access.company.id,
        ...propertyWhere,
        status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
        endDate: { gte: now, lte: until },
      },
      include: {
        tenant: { select: { id: true, fullName: true, email: true } },
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true, unitName: true } },
      },
      orderBy: [{ endDate: "asc" }, { id: "asc" }],
      take: input.take,
      skip: input.skip,
    });

    return leases.map((lease) => ({
      candidateKey: `${input.type}:${lease.id}`,
      type: input.type,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      tenant: lease.tenant,
      propertyId: lease.propertyId,
      property: lease.property,
      unit: lease.unit,
      leaseEndDate: lease.endDate,
      status: lease.status,
      subject: "Lease expiry reminder",
      body: `${lease.tenant.fullName}'s lease at ${lease.property.name} · ${lease.unit.unitNumber} expires on ${lease.endDate?.toISOString().slice(0, 10) ?? "an unset date"}.`,
    }));
  }

  if (input.type === "DOCUMENT_EXPIRY") {
    assertCanViewPmsDocuments(input.access.member);
    const documents = await prisma.pmsDocument.findMany({
      where: {
        companyId: input.access.company.id,
        ...propertyWhere,
        status: { in: [PmsDocumentStatus.ACTIVE, PmsDocumentStatus.EXPIRING, PmsDocumentStatus.EXPIRED] },
        expiryDate: { not: null, lte: until },
      },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true, unitName: true } },
        tenant: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      take: input.take,
      skip: input.skip,
    });

    return documents.map((document) => ({
      candidateKey: `${input.type}:${document.id}`,
      type: input.type,
      documentId: document.id,
      tenantId: document.tenantId,
      tenant: document.tenant,
      propertyId: document.propertyId,
      property: document.property,
      unit: document.unit,
      documentExpiryDate: document.expiryDate,
      status: document.status,
      subject: "Document expiry reminder",
      body: `${document.title} ${document.expiryDate && document.expiryDate < now ? "expired" : "expires"} on ${document.expiryDate?.toISOString().slice(0, 10)}${document.property ? ` for ${document.property.name}` : ""}.`,
    }));
  }

  assertCanViewPmsMaintenance(input.access.member);
  const workOrders = await prisma.pmsWorkOrder.findMany({
    where: {
      companyId: input.access.company.id,
      ...propertyWhere,
      status: {
        in: [
          PmsMaintenanceStatus.OPEN,
          PmsMaintenanceStatus.IN_PROGRESS,
          PmsMaintenanceStatus.WAITING_VENDOR,
        ],
      },
      OR: [
        { targetDate: { lte: until } },
        { updatedAt: { lte: staleBefore } },
      ],
    },
    include: {
      tenant: { select: { id: true, fullName: true, email: true } },
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitNumber: true, unitName: true } },
      vendor: { select: { id: true, name: true, trade: true } },
    },
    orderBy: [{ targetDate: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
    take: input.take,
    skip: input.skip,
  });

  return workOrders.map((workOrder) => {
    const reminderReason = workOrder.targetDate && workOrder.targetDate < now
      ? "TARGET_OVERDUE"
      : workOrder.updatedAt <= staleBefore
        ? "STATUS_STALE"
        : "TARGET_DUE_SOON";
    return {
      candidateKey: `${input.type}:${workOrder.id}`,
      type: input.type,
      workOrderId: workOrder.id,
      tenantId: workOrder.tenantId,
      tenant: workOrder.tenant,
      propertyId: workOrder.propertyId,
      property: workOrder.property,
      unit: workOrder.unit,
      maintenanceTitle: workOrder.title,
      maintenanceStatus: workOrder.status,
      priority: workOrder.priority,
      status: workOrder.status,
      reminderReason,
      subject: "Maintenance status reminder",
      body: `${workOrder.title} at ${workOrder.property.name} requires a status update (${reminderReason.toLowerCase().replaceAll("_", " ")}).`,
    };
  });
}

pmsRouter.get("/communications/reminders", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsReminderCandidateQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsCommunications(access.member);
    const candidates = await listPmsAutomationCandidates({
      access,
      type: query.type,
      days: query.days,
      take: query.take,
      skip: query.skip,
      propertyId: query.propertyId,
    });

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      type: query.type,
      schedulerReady: true,
      candidates,
      pagination: { take: query.take, skip: query.skip, count: candidates.length },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/automations/run", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const actor = req.user;
    const data = pmsAutomationRunSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: actor.id, companyId: data.companyId });
    assertCanViewPmsCommunications(access.member);
    if (!data.dryRun) {
      assertCanSendPmsCommunication(access.member, pmsAutomationCommunicationContext(data.type));
    }

    const candidates = await listPmsAutomationCandidates({
      access,
      type: data.type,
      days: data.days,
      take: data.take,
      skip: 0,
      propertyId: data.propertyId,
    });

    if (data.dryRun) {
      res.json({
        workspace: pmsWorkspacePayload(access),
        dryRun: true,
        type: data.type,
        candidateCount: candidates.length,
        createdCount: 0,
        skippedCount: 0,
        candidates,
      });
      return;
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const recentLogs = await prisma.pmsCommunicationLog.findMany({
      where: {
        companyId: access.company.id,
        createdAt: { gte: dayStart },
        OR: [
          { rentDueItemId: { in: candidates.flatMap((candidate) => candidate.rentDueItemId ? [candidate.rentDueItemId] : []) } },
          { leaseId: { in: candidates.flatMap((candidate) => candidate.leaseId ? [candidate.leaseId] : []) } },
          { workOrderId: { in: candidates.flatMap((candidate) => candidate.workOrderId ? [candidate.workOrderId] : []) } },
          { body: { startsWith: "[PMS automation:" } },
        ],
      },
      select: { deliveryMetadata: true },
    });
    const existingKeys = new Set(
      recentLogs.flatMap((log) => {
        const metadata = log.deliveryMetadata;
        if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return [];
        const candidateKey = (metadata as Record<string, unknown>).candidateKey;
        return typeof candidateKey === "string" ? [candidateKey] : [];
      }),
    );
    const pending = candidates.filter((candidate) => !existingKeys.has(candidate.candidateKey));

    if (pending.length) {
      await prisma.pmsCommunicationLog.createMany({
        data: pending.map((candidate) => ({
          companyId: access.company.id,
          tenantId: candidate.tenantId ?? null,
          leaseId: candidate.leaseId ?? null,
          rentDueItemId: candidate.rentDueItemId ?? null,
          workOrderId: candidate.workOrderId ?? null,
          channel: PmsCommunicationChannel.INTERNAL,
          subject: candidate.subject,
          body: `[PMS automation: ${candidate.type}] ${candidate.body}`,
          status: PmsCommunicationLogStatus.LOGGED,
          deliveryMetadata: {
            source: "PMS_OPERATIONAL_AUTOMATION",
            type: candidate.type,
            candidateKey: candidate.candidateKey,
            propertyId: candidate.propertyId,
            documentId: candidate.documentId ?? null,
            generatedAt: new Date().toISOString(),
          },
          createdById: actor.id,
          sentById: actor.id,
          sentAt: new Date(),
          notes: "System-generated operational alert. External delivery is not enabled by this action.",
        })),
      });
    }

    await recordPmsWorkspaceAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      companyId: access.company.id,
      title: "PMS automation alerts generated",
      message: `${actor.email} generated ${pending.length} internal PMS automation alerts.`,
      metadata: {
        action: "runOperationalAutomation",
        resourceType: "pmsCommunicationLog",
        automationType: data.type,
        propertyId: data.propertyId ?? null,
        candidateCount: candidates.length,
        createdCount: pending.length,
        skippedCount: candidates.length - pending.length,
      },
    });

    res.status(201).json({
      workspace: pmsWorkspacePayload(access),
      dryRun: false,
      type: data.type,
      candidateCount: candidates.length,
      createdCount: pending.length,
      skippedCount: candidates.length - pending.length,
      candidates,
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/policies", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsPolicyListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    const search = query.search?.trim();
    const where: Prisma.PmsPolicyWhereInput = {
      companyId: access.company.id,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(query.category !== "ALL" ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [policies, total] = await prisma.$transaction([
      prisma.pmsPolicy.findMany({
        where,
        orderBy: buildPmsPolicyOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsPolicy.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      policies: policies.map(pmsPolicyResponse),
      pagination: { take: query.take, skip: query.skip, count: policies.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/policies", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsPolicyCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({ userId, companyId: data.companyId });
    assertCanManagePmsOperations(access.member);

    const policy = await prisma.pmsPolicy.create({
      data: {
        companyId: access.company.id,
        title: data.title,
        category: data.category,
        body: data.body,
        active: data.active,
        notes: normalizeNullableText(data.notes),
        createdById: userId,
        updatedById: userId,
      },
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS policy created",
      message: `${req.user.email} created PMS policy ${policy.title}.`,
      metadata: {
        action: "create",
        resourceType: "pmsPolicy",
        policyId: policy.id,
        category: policy.category,
      },
    });

    res.status(201).json({ policy: pmsPolicyResponse(policy) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/policies/:policyId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { policyId } = pmsPolicyParamsSchema.parse(req.params);
    const data = pmsPolicyUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsPolicy.findUnique({
      where: { id: policyId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS policy not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId, companyId: existing.companyId });
    assertCanManagePmsOperations(access.member);

    const policy = await prisma.pmsPolicy.update({
      where: { id: policyId },
      data: buildPmsPolicyUpdateData(data, userId),
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS policy updated",
      message: `${req.user.email} updated PMS policy ${policy.title}.`,
      metadata: {
        action: "update",
        resourceType: "pmsPolicy",
        policyId: policy.id,
        category: policy.category,
        changedFields: Object.keys(data),
      },
    });

    res.json({ policy: pmsPolicyResponse(policy) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/inspections", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsInspectionListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsMaintenance(access.member);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      leaseId: query.leaseId,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
    });
    const search = query.search?.trim();
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsInspectionWhereInput = {
      companyId: access.company.id,
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              { feedback: { contains: search, mode: "insensitive" } },
              { property: { name: { contains: search, mode: "insensitive" } } },
              { unit: { unitNumber: { contains: search, mode: "insensitive" } } },
              { tenant: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [inspections, total] = await prisma.$transaction([
      prisma.pmsInspection.findMany({
        where,
        include: pmsInspectionInclude,
        orderBy: buildPmsInspectionOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsInspection.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      inspections: inspections.map(pmsInspectionResponse),
      pagination: { take: query.take, skip: query.skip, count: inspections.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/inspections", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsInspectionCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({ userId, companyId: data.companyId });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, data.propertyId);
    await assertPmsOperationalLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
    });

    const inspection = await prisma.pmsInspection.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        tenantId: data.tenantId ?? null,
        leaseId: data.leaseId ?? null,
        title: data.title,
        status: data.status,
        scheduledFor: data.scheduledFor ?? null,
        completedAt:
          data.completedAt ??
          (data.status === PmsInspectionStatus.COMPLETED ? new Date() : null),
        notes: normalizeNullableText(data.notes),
        feedback: normalizeNullableText(data.feedback),
        rating: data.rating ?? null,
        createdById: userId,
        updatedById: userId,
      },
      include: pmsInspectionInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS inspection created",
      message: `${req.user.email} created PMS inspection ${inspection.title}.`,
      metadata: {
        action: "create",
        resourceType: "pmsInspection",
        inspectionId: inspection.id,
        status: inspection.status,
        propertyId: inspection.propertyId,
      },
    });

    res.status(201).json({ inspection: pmsInspectionResponse(inspection) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/inspections/:inspectionId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { inspectionId } = pmsInspectionParamsSchema.parse(req.params);
    const data = pmsInspectionUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsInspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        companyId: true,
        propertyId: true,
      },
    });

    if (!existing) {
      throw new AppError(404, "PMS inspection not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId, companyId: existing.companyId });
    assertCanManagePmsMaintenance(access.member);
    assertCanAccessPmsPropertyScope(access, existing.propertyId);
    await assertPmsOperationalLinksBelongToCompany({
      companyId: existing.companyId,
      propertyId: existing.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
    });

    const inspection = await prisma.pmsInspection.update({
      where: { id: inspectionId },
      data: {
        ...buildPmsInspectionUpdateData(data, userId),
        ...(data.status === PmsInspectionStatus.COMPLETED && !data.completedAt
          ? { completedAt: new Date() }
          : {}),
      },
      include: pmsInspectionInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS inspection updated",
      message: `${req.user.email} updated PMS inspection ${inspection.title}.`,
      metadata: {
        action: "update",
        resourceType: "pmsInspection",
        inspectionId: inspection.id,
        status: inspection.status,
        changedFields: Object.keys(data),
      },
    });

    res.json({ inspection: pmsInspectionResponse(inspection) });
  } catch (error) {
    next(error);
  }
});

function isSensitivePmsDocumentType(type: PmsDocumentType) {
  return type === PmsDocumentType.TENANT_ID || type === PmsDocumentType.PASSPORT_RESIDENCY;
}

function assertSensitiveDocumentAccess(access: PmsWorkspaceAccess, type: PmsDocumentType) {
  if (isSensitivePmsDocumentType(type)) assertCanViewPmsSensitiveData(access.member);
}

pmsRouter.post(
  "/documents/upload",
  requireAuth(),
  privatePmsDocumentUploadMiddleware,
  async (req, res, next) => {
    let storedKey: string | null = null;
    try {
      if (!req.user) throw new AppError(401, "Unauthorized");
      if (!req.file) throw new AppError(400, "A document file is required.");
      let rawMetadata: unknown = req.body;
      if (typeof req.body.metadata === "string") {
        try {
          rawMetadata = JSON.parse(req.body.metadata);
        } catch {
          throw new AppError(400, "Document metadata must be valid JSON.");
        }
      }
      const data = pmsDocumentUploadMetadataSchema.parse(rawMetadata);
      const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
      if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) assertCanManagePmsMaintenanceDocuments(access.member);
      else assertCanManagePmsDocuments(access.member);
      assertSensitiveDocumentAccess(access, data.type);
      assertMaintenanceDocumentScope({ role: access.member.role, type: data.type, workOrderId: data.workOrderId, inspectionId: data.inspectionId });
      assertCanAccessOptionalPmsPropertyScope(access, data.propertyId);
      await assertPmsDocumentLinksBelongToCompany({
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId,
        tenantId: data.tenantId,
        leaseId: data.leaseId,
        workOrderId: data.workOrderId,
        inspectionId: data.inspectionId,
        chargeId: data.chargeId,
        securityDepositTransactionId: data.securityDepositTransactionId,
        ownerPayoutBatchId: data.ownerPayoutBatchId,
        assetId: data.assetId,
        statementId: data.statementId,
        inspectionDefectId: data.inspectionDefectId,
      });
      const stored = await storePrivatePmsDocument({ companyId: access.company.id, file: req.file });
      storedKey = stored.storageKey;
      const now = new Date();
      const document = await prisma.$transaction(async (tx) => {
        const created = await tx.pmsDocument.create({
          data: {
            companyId: access.company.id,
            propertyId: data.propertyId ?? null,
            unitId: data.unitId ?? null,
            tenantId: data.tenantId ?? null,
            leaseId: data.leaseId ?? null,
            workOrderId: data.workOrderId ?? null,
            inspectionId: data.inspectionId ?? null,
            chargeId: data.chargeId ?? null,
            securityDepositTransactionId: data.securityDepositTransactionId ?? null,
            ownerPayoutBatchId: data.ownerPayoutBatchId ?? null,
            assetId: data.assetId ?? null,
            statementId: data.statementId ?? null,
            inspectionDefectId: data.inspectionDefectId ?? null,
            type: data.type,
            title: data.title,
            fileUrl: `private://${stored.storageKey}`,
            storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
            storageKey: stored.storageKey,
            originalFilename: stored.originalFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            checksumSha256: stored.checksumSha256,
            scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
            fileUploadedAt: now,
            status: getPmsDocumentLifecycleStatus({ status: data.status, expiryDate: data.expiryDate ?? null }),
            expiryDate: data.expiryDate ?? null,
            notes: normalizeNullableText(data.notes),
            uploadedById: req.user!.id,
            updatedById: req.user!.id,
          },
          include: pmsDocumentInclude,
        });
        await recordDomainAuditEvent(tx, {
          companyId: access.company.id,
          domain: DomainAuditDomain.PMS,
          entityType: "pmsDocument",
          entityId: created.id,
          action: "upload",
          actorId: req.user!.id,
          changedFields: ["file", "metadata"],
          metadata: { type: created.type, propertyId: created.propertyId, storageDriver: created.storageDriver, fileVersion: created.fileVersion },
          ...requestAuditContext(req),
        });
        return created;
      });
      storedKey = null;
      res.status(201).json({ document: pmsDocumentResponse(document) });
    } catch (error) {
      if (storedKey) await removePrivatePmsDocument(storedKey).catch(() => undefined);
      next(error);
    }
  },
);

pmsRouter.get("/documents/:documentId/download", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { documentId } = pmsDocumentParamsSchema.parse(req.params);
    let document = await prisma.pmsDocument.findUnique({ where: { id: documentId }, include: pmsDocumentInclude });
    if (!document) throw new AppError(404, "PMS document not found");
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: document.companyId });
    assertCanViewPmsDocuments(access.member);
    assertSensitiveDocumentAccess(access, document.type);
    assertCanAccessOptionalPmsPropertyScope(access, document.propertyId);
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertMaintenanceDocumentScope({ role: access.member.role, type: document.type, workOrderId: document.workOrderId, inspectionId: document.inspectionId });
    }
    if (document.scanStatus === PmsDocumentScanStatus.QUARANTINED) throw new AppError(423, "This document is quarantined and cannot be downloaded.");

    if (document.storageDriver === PmsDocumentStorageDriver.LEGACY_REFERENCE) {
      const migrated = await importLegacyLocalPmsDocument({
        companyId: document.companyId,
        fileUrl: document.fileUrl,
        publicUploadDirectory: getLocalUploadDirectory(),
      });
      try {
        document = await prisma.pmsDocument.update({
          where: { id: document.id },
          data: {
            fileUrl: `private://${migrated.storageKey}`,
            storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
            storageKey: migrated.storageKey,
            originalFilename: migrated.originalFilename,
            mimeType: migrated.mimeType,
            sizeBytes: migrated.sizeBytes,
            checksumSha256: migrated.checksumSha256,
            scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
            fileUploadedAt: new Date(),
            updatedById: req.user.id,
          },
          include: pmsDocumentInclude,
        });
      } catch (error) {
        await restoreLegacyLocalPmsDocument({
          storageKey: migrated.storageKey,
          fileUrl: document.fileUrl,
          publicUploadDirectory: getLocalUploadDirectory(),
        }).catch(() => undefined);
        throw error;
      }
    }
    if (document.storageDriver !== PmsDocumentStorageDriver.LOCAL_PRIVATE || !document.storageKey) {
      throw new AppError(501, "This private document storage adapter is not configured for downloads.");
    }
    const contents = await readPrivatePmsDocument(document.storageKey);
    await recordDomainAuditEvent(prisma, {
      companyId: document.companyId,
      domain: DomainAuditDomain.PMS,
      entityType: "pmsDocument",
      entityId: document.id,
      action: "download",
      actorId: req.user.id,
      metadata: { propertyId: document.propertyId, type: document.type, fileVersion: document.fileVersion },
      ...requestAuditContext(req),
    });
    const filename = path.basename(document.originalFilename || `${document.title}.pdf`).replace(/["\r\n]/g, "_");
    res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(contents.length));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(contents);
  } catch (error) {
    next(error);
  }
});

pmsRouter.post(
  "/documents/:documentId/file",
  requireAuth(),
  privatePmsDocumentUploadMiddleware,
  async (req, res, next) => {
    let storedKey: string | null = null;
    try {
      if (!req.user) throw new AppError(401, "Unauthorized");
      if (!req.file) throw new AppError(400, "A replacement document file is required.");
      const { documentId } = pmsDocumentParamsSchema.parse(req.params);
      const existing = await prisma.pmsDocument.findUnique({ where: { id: documentId } });
      if (!existing) throw new AppError(404, "PMS document not found");
      const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
      if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) assertCanManagePmsMaintenanceDocuments(access.member);
      else assertCanManagePmsDocuments(access.member);
      assertSensitiveDocumentAccess(access, existing.type);
      assertCanAccessOptionalPmsPropertyScope(access, existing.propertyId);
      const stored = await storePrivatePmsDocument({ companyId: existing.companyId, file: req.file });
      storedKey = stored.storageKey;
      const document = await prisma.$transaction(async (tx) => {
        const updated = await tx.pmsDocument.update({
          where: { id: existing.id },
          data: {
            fileUrl: `private://${stored.storageKey}`,
            storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
            storageKey: stored.storageKey,
            originalFilename: stored.originalFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            checksumSha256: stored.checksumSha256,
            scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
            quarantineReason: null,
            fileVersion: { increment: 1 },
            fileReplacedAt: new Date(),
            updatedById: req.user!.id,
          },
          include: pmsDocumentInclude,
        });
        await recordDomainAuditEvent(tx, {
          companyId: existing.companyId,
          domain: DomainAuditDomain.PMS,
          entityType: "pmsDocument",
          entityId: existing.id,
          action: "replace_file",
          actorId: req.user!.id,
          changedFields: ["file"],
          beforeMetadata: { storageDriver: existing.storageDriver, fileVersion: existing.fileVersion, checksumSha256: existing.checksumSha256 },
          afterMetadata: { storageDriver: updated.storageDriver, fileVersion: updated.fileVersion, checksumSha256: updated.checksumSha256 },
          ...requestAuditContext(req),
        });
        return updated;
      });
      storedKey = null;
      if (existing.storageDriver === PmsDocumentStorageDriver.LOCAL_PRIVATE) {
        await removePrivatePmsDocument(existing.storageKey).catch(() => undefined);
      }
      res.json({ document: pmsDocumentResponse(document) });
    } catch (error) {
      if (storedKey) await removePrivatePmsDocument(storedKey).catch(() => undefined);
      next(error);
    }
  },
);

pmsRouter.get("/documents", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsDocumentListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsDocuments(access.member);
    const canViewSensitiveDocuments = canViewPmsSensitiveData(access.member);
    if (query.type !== "ALL" && isSensitivePmsDocumentType(query.type)) {
      assertSensitiveDocumentAccess(access, query.type);
    }
    await assertPmsDocumentLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
      leaseId: query.leaseId,
      workOrderId: query.workOrderId,
      inspectionId: query.inspectionId,
    });

    const search = query.search?.trim();
    const maintenanceOnly = access.member.role === PmsMemberRole.PMS_MAINTENANCE;
    const propertyId = pmsRequestedOrScopedPropertyIdWhere(access, query.propertyId);
    const where: Prisma.PmsDocumentWhereInput = {
      companyId: access.company.id,
      ...(propertyId ? { propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(query.inspectionId ? { inspectionId: query.inspectionId } : {}),
        ...(query.chargeId ? { chargeId: query.chargeId } : {}),
        ...(query.securityDepositTransactionId ? { securityDepositTransactionId: query.securityDepositTransactionId } : {}),
        ...(query.ownerPayoutBatchId ? { ownerPayoutBatchId: query.ownerPayoutBatchId } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.statementId ? { statementId: query.statementId } : {}),
        ...(query.inspectionDefectId ? { inspectionDefectId: query.inspectionDefectId } : {}),
      ...(query.type !== "ALL"
        ? { type: query.type }
        : !canViewSensitiveDocuments
          ? { type: { notIn: [PmsDocumentType.TENANT_ID, PmsDocumentType.PASSPORT_RESIDENCY] } }
          : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.expiringWithinDays !== undefined ? { expiryDate: getPmsDocumentExpiryFilter({ expiringWithinDays: query.expiringWithinDays }) } : {}),
      ...(maintenanceOnly
        ? {
            OR: [
              { workOrderId: { not: null } },
              { inspectionId: { not: null } },
              { type: { in: [PmsDocumentType.MAINTENANCE_INVOICE, PmsDocumentType.INSPECTION_REPORT] } },
            ],
          }
        : search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { notes: { contains: search, mode: "insensitive" } },
                { tenant: { fullName: { contains: search, mode: "insensitive" } } },
                { property: { name: { contains: search, mode: "insensitive" } } },
                { unit: { unitNumber: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
    };

    const [documents, total] = await prisma.$transaction([
      prisma.pmsDocument.findMany({
        where,
        include: pmsDocumentInclude,
        orderBy: buildPmsDocumentOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsDocument.count({ where }),
    ]);

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      documents: documents.map(pmsDocumentResponse),
      pagination: { take: query.take, skip: query.skip, count: documents.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/documents/expiry-alerts", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsDocumentExpiryQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsDocuments(access.member);
    const canViewSensitiveDocuments = canViewPmsSensitiveData(access.member);

    const expiryDate = getPmsDocumentExpiryFilter({ expiringWithinDays: query.withinDays });
    const propertyId = pmsScopedPropertyIdWhere(access);
    const documents = await prisma.pmsDocument.findMany({
      where: {
        companyId: access.company.id,
        ...(propertyId ? { propertyId } : {}),
        ...(!canViewSensitiveDocuments
          ? { type: { notIn: [PmsDocumentType.TENANT_ID, PmsDocumentType.PASSPORT_RESIDENCY] } }
          : {}),
        status: { not: PmsDocumentStatus.ARCHIVED },
        expiryDate,
      },
      include: pmsDocumentInclude,
      orderBy: [{ expiryDate: "asc" }, { updatedAt: "desc" }],
      take: 50,
    });

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      documents: documents.map(pmsDocumentResponse),
      withinDays: query.withinDays,
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/documents", requireAuth(), async (req, res, next) => {
  let migratedKey: string | null = null;
  let migratedLegacyUrl: string | null = null;
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsDocumentCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({ userId, companyId: data.companyId });
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertCanManagePmsMaintenanceDocuments(access.member);
    } else {
      assertCanManagePmsDocuments(access.member);
    }
    assertSensitiveDocumentAccess(access, data.type);
    assertMaintenanceDocumentScope({ role: access.member.role, type: data.type, workOrderId: data.workOrderId, inspectionId: data.inspectionId });
    assertCanAccessOptionalPmsPropertyScope(access, data.propertyId);
    await assertPmsDocumentLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
      workOrderId: data.workOrderId,
      inspectionId: data.inspectionId,
      chargeId: data.chargeId,
      securityDepositTransactionId: data.securityDepositTransactionId,
      ownerPayoutBatchId: data.ownerPayoutBatchId,
      assetId: data.assetId,
      statementId: data.statementId,
      inspectionDefectId: data.inspectionDefectId,
    });

    const privateFile = await importLegacyLocalPmsDocument({
      companyId: access.company.id,
      fileUrl: data.fileUrl,
      publicUploadDirectory: getLocalUploadDirectory(),
    });
    migratedKey = privateFile.storageKey;
    migratedLegacyUrl = data.fileUrl;

    const document = await prisma.pmsDocument.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId ?? null,
        unitId: data.unitId ?? null,
        tenantId: data.tenantId ?? null,
        leaseId: data.leaseId ?? null,
        workOrderId: data.workOrderId ?? null,
        inspectionId: data.inspectionId ?? null,
        chargeId: data.chargeId ?? null,
        securityDepositTransactionId: data.securityDepositTransactionId ?? null,
        ownerPayoutBatchId: data.ownerPayoutBatchId ?? null,
        assetId: data.assetId ?? null,
        statementId: data.statementId ?? null,
        inspectionDefectId: data.inspectionDefectId ?? null,
        type: data.type,
        title: data.title,
        fileUrl: `private://${privateFile.storageKey}`,
        storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
        storageKey: privateFile.storageKey,
        originalFilename: privateFile.originalFilename,
        mimeType: privateFile.mimeType,
        sizeBytes: privateFile.sizeBytes,
        checksumSha256: privateFile.checksumSha256,
        scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
        fileUploadedAt: new Date(),
        status: getPmsDocumentLifecycleStatus({ status: data.status, expiryDate: data.expiryDate ?? null }),
        expiryDate: data.expiryDate ?? null,
        notes: normalizeNullableText(data.notes),
        uploadedById: userId,
        updatedById: userId,
      },
      include: pmsDocumentInclude,
    });
    migratedKey = null;
    migratedLegacyUrl = null;

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS document created",
      message: `${req.user.email} added PMS document ${document.title}.`,
      metadata: { action: "create", resourceType: "pmsDocument", documentId: document.id, type: document.type },
      request: req,
    });

    res.status(201).json({ document: pmsDocumentResponse(document) });
  } catch (error) {
    if (migratedKey && migratedLegacyUrl) {
      await restoreLegacyLocalPmsDocument({
        storageKey: migratedKey,
        fileUrl: migratedLegacyUrl,
        publicUploadDirectory: getLocalUploadDirectory(),
      }).catch(() => undefined);
    }
    next(error);
  }
});

pmsRouter.get("/documents/:documentId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { documentId } = pmsDocumentParamsSchema.parse(req.params);
    const document = await prisma.pmsDocument.findUnique({ where: { id: documentId }, include: pmsDocumentInclude });
    if (!document) throw new AppError(404, "PMS document not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: document.companyId });
    assertCanViewPmsDocuments(access.member);
    assertSensitiveDocumentAccess(access, document.type);
    assertCanAccessOptionalPmsPropertyScope(access, document.propertyId);
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertMaintenanceDocumentScope({ role: access.member.role, type: document.type, workOrderId: document.workOrderId, inspectionId: document.inspectionId });
    }

    res.json({
      workspace: { company: access.company, member: access.member, entitlement: access.entitlement },
      document: pmsDocumentResponse(document),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/documents/:documentId", requireAuth(), async (req, res, next) => {
  let replacementKey: string | null = null;
  let replacementLegacyUrl: string | null = null;
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { documentId } = pmsDocumentParamsSchema.parse(req.params);
    const data = pmsDocumentUpdateSchema.parse(req.body);
    const existing = await prisma.pmsDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw new AppError(404, "PMS document not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertCanManagePmsMaintenanceDocuments(access.member);
    } else {
      assertCanManagePmsDocuments(access.member);
    }
    assertSensitiveDocumentAccess(access, existing.type);
    assertSensitiveDocumentAccess(access, data.type ?? existing.type);
    assertCanAccessOptionalPmsPropertyScope(access, existing.propertyId);
    if (data.propertyId !== undefined) {
      assertCanAccessOptionalPmsPropertyScope(access, data.propertyId);
    }
    assertMaintenanceDocumentScope({
      role: access.member.role,
      type: data.type ?? existing.type,
      workOrderId: data.workOrderId ?? existing.workOrderId,
      inspectionId: data.inspectionId ?? existing.inspectionId,
      chargeId: data.chargeId ?? existing.chargeId,
      securityDepositTransactionId: data.securityDepositTransactionId ?? existing.securityDepositTransactionId,
      ownerPayoutBatchId: data.ownerPayoutBatchId ?? existing.ownerPayoutBatchId,
      assetId: data.assetId ?? existing.assetId,
      statementId: data.statementId ?? existing.statementId,
      inspectionDefectId: data.inspectionDefectId ?? existing.inspectionDefectId,
    });
    await assertPmsDocumentLinksBelongToCompany({
      companyId: existing.companyId,
      propertyId: data.propertyId ?? existing.propertyId,
      unitId: data.unitId ?? existing.unitId,
      tenantId: data.tenantId ?? existing.tenantId,
      leaseId: data.leaseId ?? existing.leaseId,
      workOrderId: data.workOrderId ?? existing.workOrderId,
      inspectionId: data.inspectionId ?? existing.inspectionId,
    });

    const expiryDate = data.expiryDate === undefined ? existing.expiryDate : data.expiryDate ?? null;
    const replacementFile = data.fileUrl
      ? await importLegacyLocalPmsDocument({
          companyId: access.company.id,
          fileUrl: data.fileUrl,
          publicUploadDirectory: getLocalUploadDirectory(),
        })
      : null;
    replacementKey = replacementFile?.storageKey ?? null;
    replacementLegacyUrl = replacementFile ? data.fileUrl ?? null : null;
    const document = await prisma.pmsDocument.update({
      where: { id: documentId },
      data: {
        ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
        ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
        ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
        ...(data.leaseId !== undefined ? { leaseId: data.leaseId } : {}),
        ...(data.workOrderId !== undefined ? { workOrderId: data.workOrderId } : {}),
        ...(data.inspectionId !== undefined ? { inspectionId: data.inspectionId } : {}),
        ...(data.chargeId !== undefined ? { chargeId: data.chargeId } : {}),
        ...(data.securityDepositTransactionId !== undefined ? { securityDepositTransactionId: data.securityDepositTransactionId } : {}),
        ...(data.ownerPayoutBatchId !== undefined ? { ownerPayoutBatchId: data.ownerPayoutBatchId } : {}),
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.statementId !== undefined ? { statementId: data.statementId } : {}),
        ...(data.inspectionDefectId !== undefined ? { inspectionDefectId: data.inspectionDefectId } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(replacementFile
          ? {
              fileUrl: `private://${replacementFile.storageKey}`,
              storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
              storageKey: replacementFile.storageKey,
              originalFilename: replacementFile.originalFilename,
              mimeType: replacementFile.mimeType,
              sizeBytes: replacementFile.sizeBytes,
              checksumSha256: replacementFile.checksumSha256,
              scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
              quarantineReason: null,
              fileVersion: { increment: 1 },
              fileReplacedAt: new Date(),
            }
          : {}),
        ...(data.status !== undefined || data.expiryDate !== undefined
          ? { status: getPmsDocumentLifecycleStatus({ status: data.status ?? existing.status, expiryDate }) }
          : {}),
        ...(data.expiryDate !== undefined ? { expiryDate } : {}),
        ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
        updatedById: req.user.id,
      },
      include: pmsDocumentInclude,
    });
    replacementKey = null;
    replacementLegacyUrl = null;

    if (replacementFile && existing.storageDriver === PmsDocumentStorageDriver.LOCAL_PRIVATE) {
      await removePrivatePmsDocument(existing.storageKey).catch(() => undefined);
    }

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS document updated",
      message: `${req.user.email} updated PMS document ${document.title}.`,
      metadata: { action: replacementFile ? "replace_file" : "update", resourceType: "pmsDocument", documentId: document.id, changedFields: Object.keys(data), fileVersion: document.fileVersion },
    });

    res.json({ document: pmsDocumentResponse(document) });
  } catch (error) {
    if (replacementKey && replacementLegacyUrl) {
      await restoreLegacyLocalPmsDocument({
        storageKey: replacementKey,
        fileUrl: replacementLegacyUrl,
        publicUploadDirectory: getLocalUploadDirectory(),
      }).catch(() => undefined);
    }
    next(error);
  }
});

pmsRouter.get("/audit-events", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = pmsDomainAuditQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    if (isPmsPropertyScopeRestricted(access)) {
      throw new AppError(403, "Property-scoped users cannot inspect workspace-wide operational audit events.");
    }
    const canInspect = access.member.permissionKeys.includes(PmsPermissionKey.SETTINGS_MANAGE)
      || access.member.permissionKeys.includes(PmsPermissionKey.STAFF_MANAGE);
    if (!canInspect) throw new AppError(403, "Your PMS access cannot inspect operational audit events.");
    if (query.domain === DomainAuditDomain.CRM && !access.member.permissionKeys.includes(PmsPermissionKey.CRM_VIEW)) {
      throw new AppError(403, "CRM access is required to inspect CRM audit events.");
    }
    const where: Prisma.DomainAuditEventWhereInput = {
      companyId: access.company.id,
      ...(query.domain !== "ALL" ? { domain: query.domain } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt: buildPmsAccountingDateFilter({ dateFrom: query.dateFrom, dateTo: query.dateTo }) } : {}),
    };
    const [events, total] = await prisma.$transaction([
      prisma.domainAuditEvent.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: query.take,
        skip: query.skip,
      }),
      prisma.domainAuditEvent.count({ where }),
    ]);
    res.json({ workspace: pmsWorkspacePayload(access), events, pagination: { take: query.take, skip: query.skip, count: events.length, total } });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/staff", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsStaffListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    assertCanAdministerPmsStaff(access);

    const [members, properties, portfolios] = await prisma.$transaction([
      prisma.pmsCompanyMember.findMany({
        where: { companyId: access.company.id },
        include: staffMemberInclude,
        orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "desc" }],
      }),
      prisma.pmsProperty.findMany({
        where: { companyId: access.company.id, active: true },
        select: { id: true, name: true, code: true, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.pmsPortfolio.findMany({
        where: { companyId: access.company.id },
        include: pmsPortfolioInclude,
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
    ]);

    res.json({
      workspace: pmsWorkspacePayload(access),
      members: members.map(pmsStaffMemberResponse),
      properties,
      portfolios: portfolios.map(pmsPortfolioResponse),
      permissionMatrix: Object.values(PmsMemberRole).map((role) => ({
        role,
        permissionKeys: getDefaultPmsPermissionKeys(role),
      })),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/staff", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsStaffInviteSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanAdministerPmsStaff(access);

    const targetUser = await prisma.user.findFirst({
      where: data.userId ? { id: data.userId } : { email: data.email },
    });

    if (!targetUser) {
      throw new AppError(404, "User not found");
    }

    if (targetUser.suspendedAt || targetUser.deactivatedAt) {
      throw new AppError(400, "Suspended or deleted users cannot be added to PMS access.");
    }

    const existingMember = await prisma.pmsCompanyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: access.company.id,
          userId: targetUser.id,
        },
      },
      select: {
        id: true,
        role: true,
        active: true,
        permissions: {
          where: { active: true },
          select: { key: true },
        },
      },
    });
    assertCanDelegatePmsStaffAccess(access, {
      role: data.role,
      permissionKeys: data.permissionKeys ?? [],
      existingRole: existingMember?.role,
      existingPermissionKeys: existingMember?.permissions.map(
        (permission) => permission.key,
      ),
    });
    if (existingMember) {
      await assertPmsOwnerContinuity({
        companyId: access.company.id,
        memberId: existingMember.id,
        existingRole: existingMember.role,
        nextRole: data.role,
        nextActive: data.active,
      });
    }
    await assertPmsPropertyIdsBelongToCompany(access.company.id, data.propertyIds ?? []);

    const member = await prisma.pmsCompanyMember.upsert({
      where: { companyId_userId: { companyId: access.company.id, userId: targetUser.id } },
      create: {
        companyId: access.company.id,
        userId: targetUser.id,
        invitedEmail: targetUser.email,
        role: data.role,
        active: data.active,
        createdById: req.user.id,
      },
      update: {
        invitedEmail: targetUser.email,
        role: data.role,
        active: data.active,
      },
      include: staffMemberInclude,
    });

    await replacePmsMemberPropertyScope({ companyId: access.company.id, memberId: member.id, propertyIds: data.propertyIds ?? [] });
    await replacePmsMemberPermissions({ companyId: access.company.id, memberId: member.id, permissionKeys: data.permissionKeys ?? [] });

    const refreshed = await prisma.pmsCompanyMember.findUniqueOrThrow({
      where: { id: member.id },
      include: staffMemberInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      targetUserId: targetUser.id,
      title: "PMS staff access updated",
      message: `${req.user.email} granted PMS ${data.role} access to ${targetUser.email}.`,
      metadata: {
        action: "staff_upsert",
        resourceType: "pmsCompanyMember",
        memberId: member.id,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        role: data.role,
        active: data.active,
        propertyIds: data.propertyIds ?? [],
        permissionKeys: data.permissionKeys ?? [],
      } as Prisma.InputJsonObject,
    });

    res.status(201).json({ member: pmsStaffMemberResponse(refreshed) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/staff/:id", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = idParamsSchema.parse(req.params);
    const data = pmsStaffUpdateSchema.parse(req.body);
    const existing = await prisma.pmsCompanyMember.findUnique({
      where: { id },
      include: {
        user: true,
        permissions: {
          where: { active: true },
          select: { key: true },
        },
      },
    });

    if (!existing) {
      throw new AppError(404, "PMS staff member not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanAdministerPmsStaff(access);
    assertCanDelegatePmsStaffAccess(access, {
      role: data.role,
      permissionKeys: data.permissionKeys,
      existingRole: existing.role,
      existingPermissionKeys: existing.permissions.map(
        (permission) => permission.key,
      ),
    });
    await assertPmsOwnerContinuity({
      companyId: existing.companyId,
      memberId: existing.id,
      existingRole: existing.role,
      nextRole: data.role,
      nextActive: data.active,
    });
    await assertPmsPropertyIdsBelongToCompany(existing.companyId, data.propertyIds ?? []);

    const member = await prisma.pmsCompanyMember.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      include: staffMemberInclude,
    });

    await replacePmsMemberPropertyScope({ companyId: existing.companyId, memberId: id, propertyIds: data.propertyIds });
    await replacePmsMemberPermissions({ companyId: existing.companyId, memberId: id, permissionKeys: data.permissionKeys });

    const refreshed = await prisma.pmsCompanyMember.findUniqueOrThrow({ where: { id }, include: staffMemberInclude });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      targetUserId: existing.userId,
      title: "PMS staff access changed",
      message: `${req.user.email} changed PMS access for ${existing.user.email}.`,
      metadata: {
        action: data.active === false ? "staff_suspended" : "staff_updated",
        memberId: id,
        targetUserId: existing.userId,
        targetEmail: existing.user.email,
        role: data.role ?? existing.role,
        active: data.active ?? existing.active,
        propertyIds: data.propertyIds ?? null,
        permissionKeys: data.permissionKeys ?? null,
      } as Prisma.InputJsonObject,
    });

    res.json({ member: pmsStaffMemberResponse(refreshed) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/portfolios", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsPortfolioListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanAdministerPmsStaff(access);

    const portfolios = await prisma.pmsPortfolio.findMany({
      where: {
        companyId: access.company.id,
        ...(query.active === "ACTIVE" ? { active: true } : {}),
        ...(query.active === "INACTIVE" ? { active: false } : {}),
      },
      include: pmsPortfolioInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    res.json({ workspace: pmsWorkspacePayload(access), portfolios: portfolios.map(pmsPortfolioResponse) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/portfolios", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsPortfolioCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: data.companyId });
    assertCanAdministerPmsStaff(access);
    await assertPmsPropertyIdsBelongToCompany(access.company.id, data.propertyIds ?? []);

    const portfolio = await prisma.pmsPortfolio.create({
      data: {
        companyId: access.company.id,
        name: data.name,
        description: normalizeNullableText(data.description),
        active: data.active,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsPortfolioInclude,
    });

    await replacePmsPortfolioProperties({ companyId: access.company.id, portfolioId: portfolio.id, propertyIds: data.propertyIds ?? [] });
    const refreshed = await prisma.pmsPortfolio.findUniqueOrThrow({ where: { id: portfolio.id }, include: pmsPortfolioInclude });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS portfolio created",
      message: `${req.user.email} created PMS portfolio ${portfolio.name}.`,
      metadata: { action: "portfolio_created", portfolioId: portfolio.id, propertyIds: data.propertyIds ?? [] } as Prisma.InputJsonObject,
    });

    res.status(201).json({ portfolio: pmsPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/portfolios/:id", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = idParamsSchema.parse(req.params);
    const data = pmsPortfolioUpdateSchema.parse(req.body);
    const existing = await prisma.pmsPortfolio.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, "PMS portfolio not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanAdministerPmsStaff(access);
    await assertPmsPropertyIdsBelongToCompany(existing.companyId, data.propertyIds ?? []);

    const portfolio = await prisma.pmsPortfolio.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: normalizeNullableText(data.description) } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        updatedById: req.user.id,
      },
      include: pmsPortfolioInclude,
    });

    await replacePmsPortfolioProperties({ companyId: existing.companyId, portfolioId: id, propertyIds: data.propertyIds });
    const refreshed = await prisma.pmsPortfolio.findUniqueOrThrow({ where: { id }, include: pmsPortfolioInclude });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS portfolio updated",
      message: `${req.user.email} updated PMS portfolio ${portfolio.name}.`,
      metadata: { action: "portfolio_updated", portfolioId: id, changedFields: Object.keys(data), propertyIds: data.propertyIds ?? null } as Prisma.InputJsonObject,
    });

    res.json({ portfolio: pmsPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/properties", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsPropertyListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const companyId = access.company.id;
    const search = query.search?.trim();
    const where: Prisma.PmsPropertyWhereInput = {
      companyId,
      ...pmsScopedPropertyWhere(access),
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { area: { contains: search, mode: "insensitive" } },
              { addressLine: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [properties, total] = await prisma.$transaction([
      prisma.pmsProperty.findMany({
        where,
        include: pmsPropertyInclude,
        orderBy: buildPmsPropertyOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsProperty.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      properties: properties.map(pmsPropertyResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: properties.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/properties", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsPropertyCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: data.companyId,
    });
    assertCanManagePmsInventory(access.member);
    if (isPmsPropertyScopeRestricted(access)) {
      throw new AppError(403, "Property-scoped PMS users cannot create new properties.");
    }
    await assertOptionalLinksBelongToCompany({
      companyId: access.company.id,
      developerProjectId: data.developerProjectId,
      publicListingId: data.publicListingId,
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: access.company.id,
        name: data.name,
        code: normalizeNullableText(data.code),
        propertyType: normalizeNullableText(data.propertyType),
        description: normalizeNullableText(data.description),
        addressLine: normalizeNullableText(data.addressLine),
        city: normalizeNullableText(data.city),
        area: normalizeNullableText(data.area),
        notes: normalizeNullableText(data.notes),
        active: data.active,
        mapPlaceLabel: normalizeNullableText(data.mapPlaceLabel),
        mapAddress: normalizeNullableText(data.mapAddress),
        mapGoogleUrl: normalizeNullableText(data.mapGoogleUrl),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        developerProjectId: data.developerProjectId ?? null,
        publicListingId: data.publicListingId ?? null,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsPropertyInclude,
    });

    res.status(201).json({
      property: pmsPropertyResponse(property),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get(
  "/properties/:propertyId",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        include: pmsPropertyInclude,
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });
      assertCanAccessPmsPropertyScope(access, property.id);

      res.json({
        workspace: {
          company: access.company,
          member: access.member,
          entitlement: access.entitlement,
        },
        property: pmsPropertyResponse(property),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/properties/:propertyId",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const data = pmsPropertyUpdateSchema.parse(req.body);
      const existing = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: { id: true, companyId: true },
      });

      if (!existing) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: existing.companyId,
      });
      assertCanAccessPmsPropertyScope(access, existing.id);
      assertCanManagePmsInventory(access.member);
      await assertOptionalLinksBelongToCompany({
        companyId: existing.companyId,
        developerProjectId: data.developerProjectId,
        publicListingId: data.publicListingId,
      });

      const property = await prisma.pmsProperty.update({
        where: { id: propertyId },
        data: buildPmsPropertyWriteData(data, req.user.id),
        include: pmsPropertyInclude,
      });

      res.json({
        property: pmsPropertyResponse(property),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.get(
  "/properties/:propertyId/units",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const query = pmsUnitListQuerySchema
        .omit({ propertyId: true })
        .parse(req.query);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: { id: true, companyId: true },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });
      assertCanAccessPmsPropertyScope(access, property.id);
      const search = query.search?.trim();
      const where: Prisma.PmsUnitWhereInput = {
        propertyId,
        companyId: access.company.id,
        ...(query.status !== "ALL" ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { unitNumber: { contains: search, mode: "insensitive" } },
                { unitName: { contains: search, mode: "insensitive" } },
                { floor: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [units, total] = await prisma.$transaction([
        prisma.pmsUnit.findMany({
          where,
          include: pmsUnitInclude,
          orderBy: buildPmsUnitOrderBy(query, "property"),
          take: query.take,
          skip: query.skip,
        }),
        prisma.pmsUnit.count({ where }),
      ]);

      res.json({
        workspace: {
          company: access.company,
          member: access.member,
          entitlement: access.entitlement,
        },
        units: units.map(pmsUnitResponse),
        pagination: {
          take: query.take,
          skip: query.skip,
          count: units.length,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.post(
  "/properties/:propertyId/units",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const data = pmsUnitCreateSchema.parse(req.body);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          companyId: true,
          developerProjectId: true,
          publicListingId: true,
        },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });
      assertCanAccessPmsPropertyScope(access, property.id);
      assertCanManagePmsInventory(access.member);

      const developerProjectId =
        data.developerProjectId ?? property.developerProjectId ?? null;
      const publicListingId =
        data.publicListingId ?? property.publicListingId ?? null;
      await assertOptionalLinksBelongToCompany({
        companyId: property.companyId,
        developerProjectId,
        publicListingId,
      });

      if (data.status === PmsUnitStatus.OCCUPIED || data.occupancyStatus === PmsOccupancyStatus.OCCUPIED) {
        throw new AppError(400, "Unit occupancy is derived from active leases; create the lease instead.");
      }

      const unit = await prisma.pmsUnit.create({
        data: {
          propertyId: property.id,
          companyId: property.companyId,
          unitNumber: data.unitNumber,
          unitName: normalizeNullableText(data.unitName),
          floor: normalizeNullableText(data.floor),
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          areaSqm: data.areaSqm ?? null,
          operationalStatus: data.operationalStatus ?? operationalStatusFromLegacyUnitStatus(data.status),
          occupancyStatus: PmsOccupancyStatus.VACANT,
          status: compatibilityUnitStatus(
            data.operationalStatus ?? operationalStatusFromLegacyUnitStatus(data.status),
            PmsOccupancyStatus.VACANT,
          ),
          rentAmount: data.rentAmount ?? null,
          currency: data.currency,
          notes: normalizeNullableText(data.notes),
          developerProjectId,
          publicListingId,
          createdById: req.user.id,
          updatedById: req.user.id,
        },
        include: pmsUnitInclude,
      });

      res.status(201).json({
        unit: pmsUnitResponse(unit),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.get("/units", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsUnitListQuerySchema.parse(req.query);
    let companyId = query.companyId;

    if (query.propertyId) {
      const property = await prisma.pmsProperty.findUnique({
        where: { id: query.propertyId },
        select: { companyId: true },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      companyId = property.companyId;
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId,
    });
    const search = query.search?.trim();
    const scopedPropertyId = pmsScopedPropertyIdWhere(access);
    if (query.propertyId) {
      assertCanAccessPmsPropertyScope(access, query.propertyId);
    }

    const where: Prisma.PmsUnitWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : scopedPropertyId ? { propertyId: scopedPropertyId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { unitNumber: { contains: search, mode: "insensitive" } },
              { unitName: { contains: search, mode: "insensitive" } },
              { floor: { contains: search, mode: "insensitive" } },
              { property: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [units, total] = await prisma.$transaction([
      prisma.pmsUnit.findMany({
        where,
        include: pmsUnitInclude,
        orderBy: buildPmsUnitOrderBy(query, "portfolio"),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsUnit.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      units: units.map(pmsUnitResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: units.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/units/:unitId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { unitId } = pmsUnitParamsSchema.parse(req.params);
    const unit = await prisma.pmsUnit.findUnique({
      where: { id: unitId },
      include: pmsUnitInclude,
    });

    if (!unit) {
      throw new AppError(404, "PMS unit not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: unit.companyId,
    });
    assertCanAccessPmsPropertyScope(access, unit.propertyId);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      unit: pmsUnitResponse(unit),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/units/:unitId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { unitId } = pmsUnitParamsSchema.parse(req.params);
    const data = pmsUnitUpdateSchema.parse(req.body);
    const existing = await prisma.pmsUnit.findUnique({
      where: { id: unitId },
      select: { id: true, companyId: true, propertyId: true, occupancyStatus: true, operationalStatus: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS unit not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanAccessPmsPropertyScope(access, existing.propertyId);
    assertCanManagePmsInventory(access.member);
    await assertOptionalLinksBelongToCompany({
      companyId: existing.companyId,
      developerProjectId: data.developerProjectId,
      publicListingId: data.publicListingId,
    });

    if (data.status === PmsUnitStatus.OCCUPIED || data.occupancyStatus === PmsOccupancyStatus.OCCUPIED) {
      throw new AppError(400, "Unit occupancy is derived from active leases and cannot be set directly.");
    }
    const operationalStatus = data.operationalStatus
      ?? (data.status ? operationalStatusFromLegacyUnitStatus(data.status) : existing.operationalStatus);
    const unit = await prisma.pmsUnit.update({
      where: { id: unitId },
      data: {
        ...buildPmsUnitWriteData(data, req.user.id),
        operationalStatus,
        occupancyStatus: existing.occupancyStatus,
        status: compatibilityUnitStatus(operationalStatus, existing.occupancyStatus),
      },
      include: pmsUnitInclude,
    });

    res.json({
      unit: pmsUnitResponse(unit),
    });
  } catch (error) {
    next(error);
  }
});


async function buildPmsOccupancyReconciliation(access: PmsWorkspaceAccess, propertyId?: string) {
  if (propertyId) assertCanAccessPmsPropertyScope(access, propertyId);
  const scopedProperty = pmsRequestedOrScopedPropertyIdWhere(access, propertyId);
  const units = await prisma.pmsUnit.findMany({
    where: { companyId: access.company.id, ...(scopedProperty ? { propertyId: scopedProperty } : {}) },
    select: {
      id: true,
      propertyId: true,
      unitNumber: true,
      occupancyStatus: true,
      operationalStatus: true,
      status: true,
      pmsLeases: {
        where: { status: { notIn: [PmsLeaseStatus.DRAFT, PmsLeaseStatus.ENDED, PmsLeaseStatus.TERMINATED] } },
        select: { id: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: [{ propertyId: "asc" }, { unitNumber: "asc" }],
  });
  const now = new Date();
  const issues: Array<Record<string, unknown>> = [];
  for (const unit of units) {
    const activeLeases = unit.pmsLeases.filter((lease) => getLeaseOccupancyStatus(lease.status));
    if (unit.occupancyStatus === PmsOccupancyStatus.OCCUPIED && activeLeases.length === 0) {
      issues.push({ type: "OCCUPIED_WITHOUT_ACTIVE_LEASE", unitId: unit.id, propertyId: unit.propertyId, unitNumber: unit.unitNumber });
    }
    if (activeLeases.length > 0 && unit.occupancyStatus !== PmsOccupancyStatus.OCCUPIED) {
      issues.push({ type: "ACTIVE_LEASE_ON_VACANT_UNIT", unitId: unit.id, propertyId: unit.propertyId, unitNumber: unit.unitNumber, leaseIds: activeLeases.map((lease) => lease.id) });
    }
    for (const lease of activeLeases) {
      if (lease.endDate && lease.endDate < now) {
        issues.push({ type: "EXPIRED_LEASE_STILL_ACTIVE", unitId: unit.id, propertyId: unit.propertyId, unitNumber: unit.unitNumber, leaseId: lease.id, endDate: lease.endDate });
      }
    }
    for (let left = 0; left < unit.pmsLeases.length; left += 1) {
      for (let right = left + 1; right < unit.pmsLeases.length; right += 1) {
        const first = unit.pmsLeases[left];
        const second = unit.pmsLeases[right];
        const firstEnd = first.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
        if (second.startDate.getTime() <= firstEnd) {
          issues.push({ type: "OVERLAPPING_LEASES", unitId: unit.id, propertyId: unit.propertyId, unitNumber: unit.unitNumber, leaseIds: [first.id, second.id] });
        }
      }
    }
  }
  return { units, issues };
}

pmsRouter.get("/occupancy/reconciliation", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = pmsOccupancyReconciliationQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    if (!access.member.permissionKeys.includes(PmsPermissionKey.INVENTORY_VIEW) || !access.member.permissionKeys.includes(PmsPermissionKey.TENANCY_VIEW)) {
      throw new AppError(403, "Inventory and tenancy access are required to inspect occupancy consistency.");
    }
    const reconciliation = await buildPmsOccupancyReconciliation(access, query.propertyId);
    res.json({
      workspace: pmsWorkspacePayload(access),
      checkedUnits: reconciliation.units.length,
      issueCount: reconciliation.issues.length,
      issues: reconciliation.issues,
      sourceOfTruth: "ACTIVE_OR_EXPIRING_LEASE",
      operationalAvailabilityField: "operationalStatus",
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/occupancy/reconciliation", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = pmsOccupancyReconciliationQuerySchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanManagePmsInventory(access.member);
    assertCanManagePmsTenancies(access.member);
    const reconciliation = await buildPmsOccupancyReconciliation(access, query.propertyId);
    let correctedUnits = 0;
    if (query.apply) {
      await prisma.$transaction(async (tx) => {
        for (const unit of reconciliation.units) {
          const occupied = unit.pmsLeases.some((lease) => getLeaseOccupancyStatus(lease.status));
          const expectedOccupancy = occupied ? PmsOccupancyStatus.OCCUPIED : PmsOccupancyStatus.VACANT;
          const expectedStatus = compatibilityUnitStatus(unit.operationalStatus, expectedOccupancy);
          if (unit.occupancyStatus !== expectedOccupancy || unit.status !== expectedStatus) {
            await tx.pmsUnit.update({
              where: { id: unit.id },
              data: { occupancyStatus: expectedOccupancy, status: expectedStatus, updatedById: req.user!.id },
            });
            correctedUnits += 1;
          }
        }
        await recordDomainAuditEvent(tx, {
          companyId: access.company.id,
          domain: DomainAuditDomain.PMS,
          entityType: "pmsOccupancyReconciliation",
          action: "apply",
          actorId: req.user!.id,
          metadata: { propertyId: query.propertyId ?? null, detectedIssues: reconciliation.issues.length, correctedUnits },
          ...requestAuditContext(req),
        });
      });
    }
    res.json({ dryRun: !query.apply, detectedIssues: reconciliation.issues.length, correctedUnits, issues: reconciliation.issues });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/command-center", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsCommandCenterQuerySchema.parse(req.query);
    const access = await resolvePmsWorkspaceAccess({
      userId: req.user.id,
      companyId: query.companyId,
    });
    if (!access) throw new AppError(403, "PMS access is not enabled for this account.");

    const scopedPropertyId = pmsScopedPropertyIdWhere(access);
    if (query.propertyId) {
      assertCanAccessPmsPropertyScope(access, query.propertyId);
      const property = await prisma.pmsProperty.findFirst({
        where: { id: query.propertyId, companyId: access.company.id },
        select: { id: true },
      });
      if (!property) throw new AppError(404, "PMS property not found");
    }

    const propertyId = query.propertyId ?? scopedPropertyId;
    const propertyWhere = propertyId ? { propertyId } : {};
    const propertyRecordWhere = propertyId ? { id: propertyId } : {};
    const accessiblePropertyWhere = pmsScopedPropertyWhere(access);
    const now = new Date();
    const periodFrom = query.dateFrom ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodTo = query.dateTo ?? now;
    if (periodTo.getTime() - periodFrom.getTime() > 366 * 86_400_000) {
      throw new AppError(400, "PMS command-center date range cannot exceed 366 days.");
    }
    const riskWindowTo = new Date(now.getTime() + query.riskWindowDays * 86_400_000);
    const staleMaintenanceBefore = new Date(now.getTime() - 7 * 86_400_000);

    const canInventory = access.member.permissionKeys.includes(PmsPermissionKey.INVENTORY_VIEW);
    const canTenancy = access.member.permissionKeys.includes(PmsPermissionKey.TENANCY_VIEW);
    const canRent = access.member.permissionKeys.includes(PmsPermissionKey.RENT_VIEW);
    const canAccounting = access.member.permissionKeys.includes(PmsPermissionKey.ACCOUNTING_VIEW);
    const canMaintenance = access.member.permissionKeys.includes(PmsPermissionKey.MAINTENANCE_VIEW);
    const canDocuments = access.member.permissionKeys.includes(PmsPermissionKey.DOCUMENTS_VIEW);
    const canRunRentAutomation = canSendPmsCommunication(access.member, "rent");
    const canRunMaintenanceAutomation = canSendPmsCommunication(access.member, "maintenance");
    const canRunGeneralAutomation = canSendPmsCommunication(access.member, "general");

    const overdueRentWhere: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      ...propertyWhere,
      OR: [
        { status: PmsRentDueStatus.OVERDUE },
        {
          dueDate: { lt: now },
          status: {
            in: [
              PmsRentDueStatus.UNPAID,
              PmsRentDueStatus.DUE_SOON,
              PmsRentDueStatus.PARTIALLY_PAID,
            ],
          },
        },
      ],
    };
    const openRentWhere: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      ...propertyWhere,
      status: { notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED] },
    };
    const activeMaintenanceWhere: Prisma.PmsWorkOrderWhereInput = {
      companyId: access.company.id,
      ...propertyWhere,
      status: { notIn: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED] },
    };
    const overdueMaintenanceWhere: Prisma.PmsWorkOrderWhereInput = {
      ...activeMaintenanceWhere,
      targetDate: { lt: now },
    };
    const activeLeaseWhere: Prisma.PmsLeaseWhereInput = {
      companyId: access.company.id,
      ...propertyWhere,
      status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
    };

    const [
      properties,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      activeTenantCount,
      activeLeaseCount,
      periodDue,
      outstandingRent,
      overdueRent,
      rentCollected,
      leasesExpiring,
      activeMaintenance,
      overdueMaintenance,
      urgentMaintenance,
      missingLeaseDocuments,
      expiringDocuments,
      expiredDocuments,
      dueInspectionsCount,
      incompletePropertyCount,
      incompleteUnitCount,
      incompleteProperties,
      incompleteUnits,
      overdueRentItems,
      overdueMaintenanceItems,
      urgentMaintenanceItems,
      expiringLeases,
      missingDocumentLeases,
      dueDocuments,
      dueInspections,
      statementRentProperties,
      statementLedgerProperties,
      tenantExperienceMaintenance,
      tenantExperienceInspections,
      dueSoonRentCount,
      maintenanceReminderCount,
      recentAutomationLogs,
    ] = await prisma.$transaction([
      prisma.pmsProperty.findMany({
        where: { companyId: access.company.id, ...accessiblePropertyWhere },
        select: { id: true, name: true, code: true, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.pmsUnit.count({ where: { companyId: access.company.id, ...propertyWhere } }),
      prisma.pmsUnit.count({
        where: { companyId: access.company.id, ...propertyWhere, occupancyStatus: PmsOccupancyStatus.OCCUPIED },
      }),
      prisma.pmsUnit.count({
        where: { companyId: access.company.id, ...propertyWhere, occupancyStatus: PmsOccupancyStatus.VACANT },
      }),
      prisma.pmsTenant.count({
        where: {
          companyId: access.company.id,
          active: true,
          ...(propertyId ? { leases: { some: { propertyId } } } : {}),
        },
      }),
      prisma.pmsLease.count({ where: activeLeaseWhere }),
      prisma.pmsRentDueItem.groupBy({
        by: ["currency"],
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { not: PmsRentDueStatus.CANCELLED },
          dueDate: { gte: periodFrom, lte: periodTo },
        },
        _sum: { amount: true, paidAmount: true },
        _count: { _all: true },
      }),
      prisma.pmsRentDueItem.groupBy({
        by: ["currency"],
        where: openRentWhere,
        _sum: { amount: true, paidAmount: true },
        _count: { _all: true },
      }),
      prisma.pmsRentDueItem.groupBy({
        by: ["currency"],
        where: overdueRentWhere,
        _sum: { amount: true, paidAmount: true },
        _count: { _all: true },
      }),
      prisma.pmsRentPayment.groupBy({
        by: ["currency"],
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: PmsRentPaymentStatus.CONFIRMED,
          paidAt: { gte: periodFrom, lte: periodTo },
        },
        _sum: { amount: true },
      }),
      prisma.pmsLease.count({
        where: { ...activeLeaseWhere, endDate: { gte: now, lte: riskWindowTo } },
      }),
      prisma.pmsWorkOrder.count({ where: activeMaintenanceWhere }),
      prisma.pmsWorkOrder.count({ where: overdueMaintenanceWhere }),
      prisma.pmsWorkOrder.count({
        where: { ...activeMaintenanceWhere, priority: PmsMaintenancePriority.URGENT },
      }),
      prisma.pmsLease.count({
        where: {
          ...activeLeaseWhere,
          pmsDocuments: {
            none: {
              type: PmsDocumentType.LEASE_AGREEMENT,
              status: { not: PmsDocumentStatus.ARCHIVED },
            },
          },
        },
      }),
      prisma.pmsDocument.count({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { in: [PmsDocumentStatus.ACTIVE, PmsDocumentStatus.EXPIRING] },
          expiryDate: { gte: now, lte: riskWindowTo },
        },
      }),
      prisma.pmsDocument.count({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { not: PmsDocumentStatus.ARCHIVED },
          expiryDate: { lt: now },
        },
      }),
      prisma.pmsInspection.count({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { in: [PmsInspectionStatus.SCHEDULED, PmsInspectionStatus.NEEDS_ACTION] },
          OR: [{ scheduledFor: { lte: riskWindowTo } }, { status: PmsInspectionStatus.NEEDS_ACTION }],
        },
      }),
      prisma.pmsProperty.count({
        where: {
          companyId: access.company.id,
          ...propertyRecordWhere,
          active: true,
          OR: [{ propertyType: null }, { addressLine: null }, { city: null }],
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          operationalStatus: { not: PmsUnitOperationalStatus.UNAVAILABLE },
          OR: [{ rentAmount: null }, { areaSqm: null }],
        },
      }),
      prisma.pmsProperty.findMany({
        where: {
          companyId: access.company.id,
          ...propertyRecordWhere,
          active: true,
          OR: [{ propertyType: null }, { addressLine: null }, { city: null }],
        },
        select: { id: true, name: true, propertyType: true, addressLine: true, city: true },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.pmsUnit.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          operationalStatus: { not: PmsUnitOperationalStatus.UNAVAILABLE },
          OR: [{ rentAmount: null }, { areaSqm: null }],
        },
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          areaSqm: true,
          propertyId: true,
          property: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.pmsRentDueItem.findMany({
        where: overdueRentWhere,
        select: {
          id: true,
          leaseId: true,
          tenantId: true,
          dueDate: true,
          amount: true,
          paidAmount: true,
          currency: true,
          propertyId: true,
          property: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          tenant: { select: { fullName: true } },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: 100,
      }),
      prisma.pmsWorkOrder.findMany({
        where: overdueMaintenanceWhere,
        select: {
          id: true,
          title: true,
          priority: true,
          targetDate: true,
          propertyId: true,
          property: { select: { name: true } },
        },
        orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        take: 30,
      }),
      prisma.pmsWorkOrder.findMany({
        where: {
          ...activeMaintenanceWhere,
          priority: PmsMaintenancePriority.URGENT,
          OR: [{ targetDate: null }, { targetDate: { gte: now } }],
        },
        select: {
          id: true,
          title: true,
          priority: true,
          targetDate: true,
          propertyId: true,
          property: { select: { name: true } },
        },
        orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        take: 30,
      }),
      prisma.pmsLease.findMany({
        where: { ...activeLeaseWhere, endDate: { gte: now, lte: riskWindowTo } },
        select: {
          id: true,
          endDate: true,
          propertyId: true,
          property: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          tenant: { select: { fullName: true } },
          pmsDocuments: {
            where: {
              type: PmsDocumentType.LEASE_AGREEMENT,
              status: { not: PmsDocumentStatus.ARCHIVED },
            },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ endDate: "asc" }, { id: "asc" }],
        take: 30,
      }),
      prisma.pmsLease.findMany({
        where: {
          ...activeLeaseWhere,
          pmsDocuments: {
            none: {
              type: PmsDocumentType.LEASE_AGREEMENT,
              status: { not: PmsDocumentStatus.ARCHIVED },
            },
          },
        },
        select: {
          id: true,
          endDate: true,
          propertyId: true,
          property: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          tenant: { select: { fullName: true } },
        },
        orderBy: [{ endDate: "asc" }, { id: "asc" }],
        take: 20,
      }),
      prisma.pmsDocument.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { in: [PmsDocumentStatus.ACTIVE, PmsDocumentStatus.EXPIRING, PmsDocumentStatus.EXPIRED] },
          expiryDate: { not: null, lte: riskWindowTo },
        },
        select: {
          id: true,
          title: true,
          status: true,
          expiryDate: true,
          propertyId: true,
          property: { select: { name: true } },
        },
        orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
        take: 30,
      }),
      prisma.pmsInspection.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { in: [PmsInspectionStatus.SCHEDULED, PmsInspectionStatus.NEEDS_ACTION] },
          OR: [{ scheduledFor: { lte: riskWindowTo } }, { status: PmsInspectionStatus.NEEDS_ACTION }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledFor: true,
          propertyId: true,
          property: { select: { name: true } },
        },
        orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
        take: 30,
      }),
      prisma.pmsRentPayment.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: PmsRentPaymentStatus.CONFIRMED,
          paidAt: { gte: periodFrom, lte: periodTo },
        },
        select: { propertyId: true },
        distinct: ["propertyId"],
      }),
      prisma.pmsAccountingLedgerEntry.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          transactionDate: { gte: periodFrom, lte: periodTo },
          propertyId: { not: null },
        },
        select: { propertyId: true },
        distinct: ["propertyId"],
      }),
      prisma.pmsWorkOrder.findMany({
        where: {
          ...activeMaintenanceWhere,
          tenantId: { not: null },
          OR: [
            { targetDate: { lt: now } },
            { priority: PmsMaintenancePriority.URGENT },
          ],
        },
        select: { tenantId: true },
        distinct: ["tenantId"],
      }),
      prisma.pmsInspection.findMany({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          tenantId: { not: null },
          OR: [
            { status: PmsInspectionStatus.NEEDS_ACTION },
            { rating: { lte: 2 } },
          ],
        },
        select: { tenantId: true },
        distinct: ["tenantId"],
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId: access.company.id,
          ...propertyWhere,
          status: { in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON, PmsRentDueStatus.PARTIALLY_PAID] },
          dueDate: { gte: now, lte: riskWindowTo },
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          ...activeMaintenanceWhere,
          OR: [
            { targetDate: { lte: riskWindowTo } },
            { updatedAt: { lte: staleMaintenanceBefore } },
          ],
        },
      }),
      prisma.pmsCommunicationLog.findMany({
        where: {
          companyId: access.company.id,
          body: { startsWith: "[PMS automation:" },
          createdAt: { gte: periodFrom, lte: periodTo },
        },
        select: { createdAt: true, deliveryMetadata: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    type CommandCurrencyTotal = {
      currency: string;
      scheduledRent: number;
      paidAgainstScheduled: number;
      outstandingRent: number;
      overdueRent: number;
      rentCollected: number;
    };
    const commandCurrencyTotals = new Map<string, CommandCurrencyTotal>();
    const commandCurrency = (currency: string) => {
      const key = currency.toUpperCase();
      const current = commandCurrencyTotals.get(key) ?? {
        currency: key,
        scheduledRent: 0,
        paidAgainstScheduled: 0,
        outstandingRent: 0,
        overdueRent: 0,
        rentCollected: 0,
      };
      commandCurrencyTotals.set(key, current);
      return current;
    };
    periodDue.forEach((row) => {
      const total = commandCurrency(row.currency);
      total.scheduledRent += Number(row._sum.amount ?? 0);
      total.paidAgainstScheduled += Number(row._sum.paidAmount ?? 0);
    });
    outstandingRent.forEach((row) => {
      commandCurrency(row.currency).outstandingRent += Math.max(
        Number(row._sum.amount ?? 0) - Number(row._sum.paidAmount ?? 0),
        0,
      );
    });
    overdueRent.forEach((row) => {
      commandCurrency(row.currency).overdueRent += Math.max(
        Number(row._sum.amount ?? 0) - Number(row._sum.paidAmount ?? 0),
        0,
      );
    });
    rentCollected.forEach((row) => {
      commandCurrency(row.currency).rentCollected += Number(row._sum.amount ?? 0);
    });
    const commandTotalsByCurrency = [...commandCurrencyTotals.values()]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map((total) => ({
        currency: total.currency,
        scheduledRent: moneyString(total.scheduledRent),
        paidAgainstScheduled: moneyString(total.paidAgainstScheduled),
        outstandingRent: moneyString(total.outstandingRent),
        overdueRent: moneyString(total.overdueRent),
        rentCollected: moneyString(total.rentCollected),
        collectionRate: total.scheduledRent > 0
          ? Math.round(Math.min((total.paidAgainstScheduled / total.scheduledRent) * 100, 100) * 10) / 10
          : null,
      }));
    const commandCurrencyState = currencyState(commandCurrencyTotals.keys());
    const commandSingleCurrency = commandCurrencyState.status === "SINGLE"
      ? commandTotalsByCurrency[0]
      : null;
    const periodScheduledAmount = commandSingleCurrency ? Number(commandSingleCurrency.scheduledRent) : 0;
    const periodPaidAgainstDue = commandSingleCurrency ? Number(commandSingleCurrency.paidAgainstScheduled) : 0;
    const outstandingRentAmount = commandSingleCurrency ? Number(commandSingleCurrency.outstandingRent) : 0;
    const overdueRentAmount = commandSingleCurrency ? Number(commandSingleCurrency.overdueRent) : 0;
    const collectionRate = commandSingleCurrency?.collectionRate ?? null;
    const overdueRentCount = overdueRent.reduce((sum, row) => sum + row._count._all, 0);
    const outstandingRentCount = outstandingRent.reduce((sum, row) => sum + row._count._all, 0);
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : null;

    const tenantRiskMap = new Map<string, {
      tenantId: string;
      tenantName: string;
      propertyId: string;
      propertyName: string;
      leaseId: string;
      oldestDueDate: Date;
      outstandingAmount: number;
      originalAmount: number;
      overdueItems: number;
      currency: string;
    }>();
    overdueRentItems.forEach((item) => {
      const riskKey = `${item.tenantId}:${item.currency.toUpperCase()}`;
      const current = tenantRiskMap.get(riskKey);
      const outstanding = Math.max(Number(item.amount) - Number(item.paidAmount), 0);
      if (!current) {
        tenantRiskMap.set(riskKey, {
          tenantId: item.tenantId,
          tenantName: item.tenant.fullName,
          propertyId: item.propertyId,
          propertyName: item.property.name,
          leaseId: item.leaseId,
          oldestDueDate: item.dueDate,
          outstandingAmount: outstanding,
          originalAmount: Number(item.amount),
          overdueItems: 1,
          currency: item.currency.toUpperCase(),
        });
        return;
      }
      current.outstandingAmount += outstanding;
      current.originalAmount += Number(item.amount);
      current.overdueItems += 1;
      if (item.dueDate < current.oldestDueDate) current.oldestDueDate = item.dueDate;
    });
    const highRiskTenants = Array.from(tenantRiskMap.values())
      .map((item) => {
        const riskScore = rentRiskScore({
          dueDate: item.oldestDueDate,
          now,
          outstandingAmount: item.outstandingAmount,
          originalAmount: item.originalAmount,
          overdueItemCount: item.overdueItems,
        });
        return {
          ...item,
          outstandingAmount: moneyString(item.outstandingAmount),
          riskScore,
          priority: priorityFromScore(riskScore),
          reasons: [
            `${item.overdueItems} overdue rent item${item.overdueItems === 1 ? "" : "s"}`,
            `${moneyString(item.outstandingAmount)} ${item.currency} outstanding`,
          ],
          href: `/pms/rentals/${item.leaseId}?companyId=${access.company.id}`,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    type CommandQueueItem = {
      id: string;
      type: string;
      status: "OPEN" | "OVERDUE" | "UPCOMING" | "NEEDS_REVIEW";
      priority: PmsCommandPriority;
      riskScore: number;
      title: string;
      detail: string;
      reasons: string[];
      propertyId: string | null;
      propertyName: string | null;
      dueAt: Date | null;
      href: string;
    };

    const queue: CommandQueueItem[] = [
      ...(canRent
        ? highRiskTenants.map((item): CommandQueueItem => ({
            id: `rent-${item.tenantId}-${item.currency}`,
            type: "OVERDUE_RENT",
            status: "OVERDUE",
            priority: item.priority,
            riskScore: item.riskScore,
            title: `Tenant account risk · ${item.tenantName}`,
            detail: `${item.outstandingAmount} ${item.currency} outstanding across ${item.overdueItems} item${item.overdueItems === 1 ? "" : "s"}`,
            reasons: item.reasons,
            propertyId: item.propertyId,
            propertyName: item.propertyName,
            dueAt: item.oldestDueDate,
            href: item.href,
          }))
        : []),
      ...(canMaintenance
        ? overdueMaintenanceItems.map((item): CommandQueueItem => {
            const riskScore = maintenanceRiskScore({
              priority: item.priority,
              targetDate: item.targetDate,
              now,
            });
            return {
              id: `maintenance-${item.id}`,
              type: "MAINTENANCE_OVERDUE",
              status: "OVERDUE",
              priority: priorityFromScore(riskScore),
              riskScore,
              title: item.title,
              detail: "Maintenance target date has passed",
              reasons: [item.priority === PmsMaintenancePriority.URGENT ? "Urgent work order" : `${item.priority.toLowerCase()} priority`, "SLA target overdue"],
              propertyId: item.propertyId,
              propertyName: item.property.name,
              dueAt: item.targetDate,
              href: `/pms/maintenance?companyId=${access.company.id}&propertyId=${item.propertyId}`,
            };
          })
        : []),
      ...(canMaintenance
        ? urgentMaintenanceItems.map((item): CommandQueueItem => {
            const riskScore = maintenanceRiskScore({
              priority: item.priority,
              targetDate: item.targetDate,
              now,
            });
            return {
              id: `maintenance-urgent-${item.id}`,
              type: "URGENT_MAINTENANCE",
              status: "OPEN",
              priority: priorityFromScore(Math.max(riskScore, 70)),
              riskScore: Math.max(riskScore, 70),
              title: item.title,
              detail: "Urgent maintenance requires operational attention",
              reasons: ["Urgent work order", item.targetDate ? "Target date is upcoming" : "No target date is set"],
              propertyId: item.propertyId,
              propertyName: item.property.name,
              dueAt: item.targetDate,
              href: `/pms/maintenance?companyId=${access.company.id}&propertyId=${item.propertyId}`,
            };
          })
        : []),
      ...(canTenancy
        ? expiringLeases.map((item): CommandQueueItem => {
            const missingDocument = item.pmsDocuments.length === 0;
            const riskScore = leaseExpiryRiskScore({
              endDate: item.endDate ?? riskWindowTo,
              now,
              missingLeaseDocument: missingDocument,
            });
            return {
              id: `lease-${item.id}`,
              type: "LEASE_EXPIRING",
              status: "UPCOMING",
              priority: priorityFromScore(riskScore),
              riskScore,
              title: `Lease expiry · ${item.tenant.fullName}`,
              detail: `${item.property.name} · ${item.unit.unitNumber}`,
              reasons: ["Lease ends inside the risk window", ...(missingDocument ? ["Lease agreement missing"] : [])],
              propertyId: item.propertyId,
              propertyName: item.property.name,
              dueAt: item.endDate,
              href: `/pms/rentals/${item.id}?companyId=${access.company.id}`,
            };
          })
        : []),
      ...(canDocuments
        ? missingDocumentLeases.map((item): CommandQueueItem => {
            const riskScore = documentRiskScore({ expiryDate: item.endDate, now, missing: true });
            return {
              id: `missing-document-${item.id}`,
              type: "MISSING_DOCUMENT",
              status: "NEEDS_REVIEW",
              priority: priorityFromScore(riskScore),
              riskScore,
              title: `Missing lease agreement · ${item.tenant.fullName}`,
              detail: `${item.property.name} · ${item.unit.unitNumber}`,
              reasons: ["Active lease has no non-archived lease agreement"],
              propertyId: item.propertyId,
              propertyName: item.property.name,
              dueAt: item.endDate,
              href: `/pms/documents?companyId=${access.company.id}&leaseId=${item.id}`,
            };
          })
        : []),
      ...(canDocuments
        ? dueDocuments.map((item): CommandQueueItem => {
            const riskScore = documentRiskScore({ expiryDate: item.expiryDate, now, missing: false });
            const expired = Boolean(item.expiryDate && item.expiryDate < now);
            return {
              id: `document-${item.id}`,
              type: expired ? "DOCUMENT_EXPIRED" : "DOCUMENT_EXPIRING",
              status: expired ? "OVERDUE" : "UPCOMING",
              priority: priorityFromScore(riskScore),
              riskScore,
              title: item.title,
              detail: expired ? "Document has expired" : "Document expiry requires review",
              reasons: [expired ? "Expiry date has passed" : "Expiry date is inside the risk window"],
              propertyId: item.propertyId,
              propertyName: item.property?.name ?? null,
              dueAt: item.expiryDate,
              href: `/pms/documents?companyId=${access.company.id}`,
            };
          })
        : []),
      ...(canMaintenance
        ? dueInspections.map((item): CommandQueueItem => {
            const needsAction = item.status === PmsInspectionStatus.NEEDS_ACTION;
            const overdue = Boolean(item.scheduledFor && item.scheduledFor < now);
            const riskScore = needsAction ? 75 : overdue ? 65 : 35;
            return {
              id: `inspection-${item.id}`,
              type: "INSPECTION_DUE",
              status: needsAction ? "NEEDS_REVIEW" : overdue ? "OVERDUE" : "UPCOMING",
              priority: priorityFromScore(riskScore),
              riskScore,
              title: item.title,
              detail: needsAction ? "Inspection needs action" : overdue ? "Inspection is overdue" : "Inspection is due soon",
              reasons: [needsAction ? "Inspection outcome requires action" : "Scheduled inside the risk window"],
              propertyId: item.propertyId,
              propertyName: item.property.name,
              dueAt: item.scheduledFor,
              href: `/pms/reports?companyId=${access.company.id}`,
            };
          })
        : []),
    ];

    const statementPropertyIds = new Set([
      ...statementRentProperties.map((item) => item.propertyId),
      ...statementLedgerProperties.flatMap((item) => item.propertyId ? [item.propertyId] : []),
    ]);
    const statementProperties = properties.filter((property) => statementPropertyIds.has(property.id));
    const ownerStatements = canAccounting && statementProperties.length > 0
      ? await prisma.pmsOwnerStatement.findMany({
          where: {
            companyId: access.company.id,
            propertyId: { in: statementProperties.map((property) => property.id) },
            status: { not: PmsOwnerStatementStatus.VOID },
            periodStart: { lte: periodTo },
            periodEnd: { gte: periodFrom },
          },
          select: { id: true, propertyId: true, status: true, currency: true, periodStart: true, periodEnd: true, revision: true },
          orderBy: [{ generatedAt: "desc" }, { revision: "desc" }],
        })
      : [];
    const latestStatementByProperty = new Map<string, (typeof ownerStatements)[number]>();
    ownerStatements.forEach((statement) => {
      if (!latestStatementByProperty.has(statement.propertyId)) latestStatementByProperty.set(statement.propertyId, statement);
    });
    const statementReadiness = statementProperties.map((property) => ({
      property,
      statement: latestStatementByProperty.get(property.id) ?? null,
    }));
    if (canAccounting) {
      statementReadiness.forEach(({ property, statement }) => {
        if (statement?.status === PmsOwnerStatementStatus.PUBLISHED) return;
        const approved = statement?.status === PmsOwnerStatementStatus.APPROVED;
        const missing = !statement;
        queue.push({
          id: `statement-${property.id}-${statement?.id ?? "missing"}`,
          type: missing ? "STATEMENT_GENERATION" : approved ? "STATEMENT_PUBLISH" : "STATEMENT_REVIEW",
          status: "NEEDS_REVIEW",
          priority: approved ? "LOW" : "MEDIUM",
          riskScore: approved ? 30 : missing ? 50 : 45,
          title: missing
            ? `Generate owner statement · ${property.name}`
            : approved
              ? `Publish approved owner statement · ${property.name}`
              : `Owner statement review · ${property.name}`,
          detail: missing
            ? "Financial activity exists but no persistent statement covers this period"
            : `${statement.status.replaceAll("_", " ")} · ${statement.currency} · revision ${statement.revision}`,
          reasons: missing
            ? ["Property has financial activity in the selected period", "No persistent statement snapshot exists"]
            : ["A persistent owner statement requires the next controlled lifecycle transition"],
          propertyId: property.id,
          propertyName: property.name,
          dueAt: periodTo,
          href: `/pms/accounting?companyId=${access.company.id}&propertyId=${property.id}`,
        });
      });
    }

    if (canInventory) {
      incompleteProperties.forEach((property) => {
        const missing = [
          !property.propertyType ? "property type" : null,
          !property.addressLine ? "address" : null,
          !property.city ? "city" : null,
        ].filter((value): value is string => Boolean(value));
        queue.push({
          id: `property-setup-${property.id}`,
          type: "SETUP_INCOMPLETE",
          status: "NEEDS_REVIEW",
          priority: "LOW",
          riskScore: 25 + missing.length * 5,
          title: `Complete property setup · ${property.name}`,
          detail: `Missing ${missing.join(", ")}`,
          reasons: missing.map((value) => `Missing ${value}`),
          propertyId: property.id,
          propertyName: property.name,
          dueAt: null,
          href: `/pms/properties/${property.id}?companyId=${access.company.id}`,
        });
      });
      incompleteUnits.forEach((unit) => {
        const missing = [
          unit.rentAmount === null ? "rent amount" : null,
          unit.areaSqm === null ? "unit area" : null,
        ].filter((value): value is string => Boolean(value));
        queue.push({
          id: `unit-setup-${unit.id}`,
          type: "SETUP_INCOMPLETE",
          status: "NEEDS_REVIEW",
          priority: "LOW",
          riskScore: 25 + missing.length * 5,
          title: `Complete unit setup · ${unit.unitNumber}`,
          detail: `Missing ${missing.join(", ")}`,
          reasons: missing.map((value) => `Missing ${value}`),
          propertyId: unit.propertyId,
          propertyName: unit.property.name,
          dueAt: null,
          href: `/pms/properties/${unit.propertyId}?companyId=${access.company.id}`,
        });
      });
    }

    const matchingQueue = queue
      .filter((item) => query.status === "ALL" || item.status === query.status)
      .filter((item) => query.priority === "ALL" || item.priority === query.priority)
      .sort((a, b) => {
        const priorityDifference = priorityRank(a.priority) - priorityRank(b.priority);
        if (priorityDifference !== 0) return priorityDifference;
        if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
        return (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
      });
    const filteredQueue = matchingQueue.slice(0, query.take);

    const tenantExperienceIds = new Set([
      ...tenantExperienceMaintenance.flatMap((item) => item.tenantId ? [item.tenantId] : []),
      ...tenantExperienceInspections.flatMap((item) => item.tenantId ? [item.tenantId] : []),
    ]);
    const complianceDenominator = activeLeaseCount + expiringDocuments + expiredDocuments;
    const occupancyHealth = canInventory
      ? buildHealthSignal({
          score: occupancyRate,
          label: "Occupancy health",
          detail: totalUnits ? `${occupiedUnits} of ${totalUnits} units occupied` : "Add units to calculate occupancy health.",
        })
      : buildHealthSignal({ score: null, label: "Occupancy health", detail: "Inventory permission is required." });
    const collectionHealth = canRent
      ? buildHealthSignal({
          score: commandCurrencyState.status === "MIXED" ? null : collectionRate,
          label: "Rent collection health",
          detail: commandCurrencyState.status === "MIXED"
            ? "Multiple currencies are present. Review collection performance by currency."
            : periodScheduledAmount > 0
              ? `${moneyString(periodPaidAgainstDue)} of ${moneyString(periodScheduledAmount)} ${commandSingleCurrency?.currency ?? ""} applied to period rent`.trim()
              : "No rent obligations fall inside the selected period.",
        })
      : buildHealthSignal({ score: null, label: "Rent collection health", detail: "Rent permission is required." });
    const arrearsHealth = canRent
      ? buildHealthSignal({
          score: commandCurrencyState.status === "MIXED"
            ? null
            : outstandingRentAmount > 0
              ? 100 - Math.min((overdueRentAmount / outstandingRentAmount) * 100, 100)
              : 100,
          label: "Arrears health",
          detail: commandCurrencyState.status === "MIXED"
            ? "Multiple currencies are present. Arrears are grouped and never combined."
            : overdueRentAmount > 0
              ? `${moneyString(overdueRentAmount)} ${commandSingleCurrency?.currency ?? ""} is overdue`.trim()
              : "No overdue rent is currently recorded.",
        })
      : buildHealthSignal({ score: null, label: "Arrears health", detail: "Rent permission is required." });
    const maintenanceHealth = canMaintenance
      ? buildHealthSignal({
          score: activeMaintenance > 0
            ? 100 - Math.min((overdueMaintenance / activeMaintenance) * 100, 100)
            : 100,
          label: "Maintenance SLA health",
          detail: activeMaintenance > 0
            ? `${overdueMaintenance} of ${activeMaintenance} active requests are overdue`
            : "No active maintenance requests.",
        })
      : buildHealthSignal({ score: null, label: "Maintenance SLA health", detail: "Maintenance permission is required." });
    const complianceHealth = canDocuments
      ? buildHealthSignal({
          score: complianceDenominator > 0
            ? 100 - Math.min(((missingLeaseDocuments + expiredDocuments) / complianceDenominator) * 100, 100)
            : null,
          label: "Document compliance",
          detail: complianceDenominator > 0
            ? `${missingLeaseDocuments} missing lease agreements and ${expiredDocuments} expired documents`
            : "Add lease or expiring documents to calculate compliance health.",
        })
      : buildHealthSignal({ score: null, label: "Document compliance", detail: "Document permission is required." });
    const tenantExperienceHealth = canMaintenance
      ? buildHealthSignal({
          score: activeTenantCount > 0
            ? 100 - Math.min((tenantExperienceIds.size / activeTenantCount) * 100, 100)
            : null,
          label: "Tenant experience",
          detail: activeTenantCount > 0
            ? `${tenantExperienceIds.size} tenant account${tenantExperienceIds.size === 1 ? "" : "s"} have urgent service signals`
            : "Add active tenants to calculate tenant experience signals.",
        })
      : buildHealthSignal({ score: null, label: "Tenant experience", detail: "Maintenance permission is required." });
    const portfolioHealthScore = averageHealthScore([
      occupancyHealth.score,
      collectionHealth.score,
      arrearsHealth.score,
      maintenanceHealth.score,
      complianceHealth.score,
      tenantExperienceHealth.score,
    ]);
    const portfolioHealth = buildHealthSignal({
      score: portfolioHealthScore,
      label: "Portfolio health",
      detail: portfolioHealthScore === null
        ? "More operational data is required before portfolio health can be calculated."
        : "Weighted from the operational health signals available to your role.",
    });

    const accessiblePropertyIds = new Set(properties.map((property) => property.id));
    const automationPropertyIds = query.propertyId
      ? new Set([query.propertyId])
      : isPmsPropertyScopeRestricted(access)
        ? accessiblePropertyIds
        : null;
    const latestAutomationByType: Partial<Record<PmsAutomationType, Date>> = {};
    recentAutomationLogs.forEach((log) => {
      const metadata = log.deliveryMetadata;
      if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return;
      const record = metadata as Record<string, unknown>;
      const type = record.type;
      const logPropertyId = typeof record.propertyId === "string" ? record.propertyId : null;
      if (automationPropertyIds && (!logPropertyId || !automationPropertyIds.has(logPropertyId))) return;
      if (!pmsAutomationTypeSchema.safeParse(type).success) return;
      const automationType = type as PmsAutomationType;
      if (!latestAutomationByType[automationType]) latestAutomationByType[automationType] = log.createdAt;
    });

    const automationItems = [
      {
        type: "OVERDUE_RENT" as const,
        label: "Overdue rent reminders",
        count: canRent ? overdueRentCount : null,
        canRun: canRent && canRunRentAutomation,
        lastGeneratedAt: latestAutomationByType.OVERDUE_RENT ?? null,
        href: `/pms/settings?companyId=${access.company.id}`,
      },
      {
        type: "RENT_DUE_SOON" as const,
        label: "Upcoming rent reminders",
        count: canRent ? dueSoonRentCount : null,
        canRun: canRent && canRunRentAutomation,
        lastGeneratedAt: latestAutomationByType.RENT_DUE_SOON ?? null,
        href: `/pms/settings?companyId=${access.company.id}`,
      },
      {
        type: "LEASE_EXPIRY" as const,
        label: "Lease expiry reminders",
        count: canTenancy ? leasesExpiring : null,
        canRun: canTenancy && canRunGeneralAutomation,
        lastGeneratedAt: latestAutomationByType.LEASE_EXPIRY ?? null,
        href: `/pms/settings?companyId=${access.company.id}`,
      },
      {
        type: "MAINTENANCE_STATUS" as const,
        label: "Maintenance status reminders",
        count: canMaintenance ? maintenanceReminderCount : null,
        canRun: canMaintenance && canRunMaintenanceAutomation,
        lastGeneratedAt: latestAutomationByType.MAINTENANCE_STATUS ?? null,
        href: `/pms/settings?companyId=${access.company.id}`,
      },
      {
        type: "DOCUMENT_EXPIRY" as const,
        label: "Document expiry reminders",
        count: canDocuments ? expiringDocuments + expiredDocuments : null,
        canRun: canDocuments && canRunGeneralAutomation,
        lastGeneratedAt: latestAutomationByType.DOCUMENT_EXPIRY ?? null,
        href: `/pms/documents?companyId=${access.company.id}`,
      },
    ];

    res.json({
      workspace: pmsWorkspacePayload(access),
      generatedAt: now,
      filters: {
        propertyId: query.propertyId ?? null,
        dateFrom: periodFrom,
        dateTo: periodTo,
        riskWindowDays: query.riskWindowDays,
        status: query.status,
        priority: query.priority,
      },
      period: { from: periodFrom, to: periodTo },
      financialArchitecture: "GROUPED_NO_CONVERSION",
      riskWindow: { from: now, to: riskWindowTo, days: query.riskWindowDays },
      properties: canInventory ? properties : [],
      health: {
        portfolio: portfolioHealth,
        occupancy: occupancyHealth,
        collection: collectionHealth,
        arrears: arrearsHealth,
        maintenance: maintenanceHealth,
        compliance: complianceHealth,
        tenantExperience: tenantExperienceHealth,
      },
      metrics: {
        totalProperties: canInventory ? (query.propertyId ? 1 : properties.length) : null,
        totalUnits: canInventory ? totalUnits : null,
        occupiedUnits: canInventory ? occupiedUnits : null,
        occupancyRate: canInventory ? Math.round((occupancyRate ?? 0) * 10) / 10 : null,
        vacantUnits: canInventory ? vacantUnits : null,
        incompleteProperties: canInventory ? incompletePropertyCount : null,
        incompleteUnits: canInventory ? incompleteUnitCount : null,
        currencyState: canRent ? commandCurrencyState : null,
        financialsByCurrency: canRent ? commandTotalsByCurrency : [],
        overdueRentItems: canRent ? overdueRentCount : null,
        overdueRentAmount: canRent ? commandSingleCurrency?.overdueRent ?? null : null,
        outstandingRentItems: canRent ? outstandingRentCount : null,
        outstandingRentAmount: canRent ? commandSingleCurrency?.outstandingRent ?? null : null,
        rentScheduledThisPeriod: canRent ? commandSingleCurrency?.scheduledRent ?? null : null,
        rentCollectedThisPeriod: canRent ? commandSingleCurrency?.rentCollected ?? null : null,
        rentCollectionRate: canRent ? commandSingleCurrency?.collectionRate ?? null : null,
        leasesExpiringSoon: canTenancy ? leasesExpiring : null,
        activeMaintenanceRequests: canMaintenance ? activeMaintenance : null,
        overdueMaintenanceRequests: canMaintenance ? overdueMaintenance : null,
        urgentMaintenanceRequests: canMaintenance ? urgentMaintenance : null,
        missingLeaseDocuments: canDocuments ? missingLeaseDocuments : null,
        expiringDocuments: canDocuments ? expiringDocuments : null,
        expiredDocuments: canDocuments ? expiredDocuments : null,
        inspectionsDue: canMaintenance ? dueInspectionsCount : null,
        ownerStatementReadyProperties: canAccounting
          ? statementReadiness.filter(({ statement }) => statement?.status === PmsOwnerStatementStatus.APPROVED).length
          : null,
        ownerStatementNeedsReviewProperties: canAccounting
          ? statementReadiness.filter(({ statement }) => statement && PMS_OWNER_STATEMENT_REVIEW_STATUSES.has(statement.status)).length
          : null,
        ownerStatementPublishedProperties: canAccounting
          ? statementReadiness.filter(({ statement }) => statement?.status === PmsOwnerStatementStatus.PUBLISHED).length
          : null,
        ownerStatementMissingProperties: canAccounting
          ? statementReadiness.filter(({ statement }) => !statement).length
          : null,
        highRiskTenantAccounts: canRent ? highRiskTenants.filter((item) => item.priority === "CRITICAL" || item.priority === "HIGH").length : null,
        tenantExperienceSignals: canMaintenance ? tenantExperienceIds.size : null,
      },
      riskSignals: {
        highRiskTenants: canRent ? highRiskTenants : [],
        incompleteSetup: canInventory
          ? {
              properties: incompletePropertyCount,
              units: incompleteUnitCount,
            }
          : null,
      },
      automation: {
        rentRemindersDue: canRent ? overdueRentCount + dueSoonRentCount : null,
        leaseExpiryRemindersDue: canTenancy ? leasesExpiring : null,
        maintenanceRemindersDue: canMaintenance ? maintenanceReminderCount : null,
        documentExpiryRemindersDue: canDocuments ? expiringDocuments + expiredDocuments : null,
        items: automationItems,
      },
      priorityQueue: filteredQueue,
      prioritySummary: {
        total: matchingQueue.length,
        critical: matchingQueue.filter((item) => item.priority === "CRITICAL").length,
        high: matchingQueue.filter((item) => item.priority === "HIGH").length,
        medium: matchingQueue.filter((item) => item.priority === "MEDIUM").length,
        low: matchingQueue.filter((item) => item.priority === "LOW").length,
      },
      emptyState: matchingQueue.length === 0
        ? "No operational risks are currently detected for the selected workspace and property scope."
        : null,
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/overview", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsOverviewQuerySchema.parse(req.query);
    const access = await resolvePmsWorkspaceAccess({
      userId: req.user.id,
      companyId: query.companyId,
    });

    if (!access) {
      throw new AppError(403, "PMS access is not enabled for this account.");
    }

    const companyId = access.company.id;
    const scopedPropertyId = pmsScopedPropertyIdWhere(access);
    const scopedPropertyWhere = pmsScopedPropertyWhere(access);
    const canInventory = access.member.permissionKeys.includes(PmsPermissionKey.INVENTORY_VIEW);
    const canTenancy = access.member.permissionKeys.includes(PmsPermissionKey.TENANCY_VIEW);
    const canRent = access.member.permissionKeys.includes(PmsPermissionKey.RENT_VIEW);
    const canMaintenance = access.member.permissionKeys.includes(PmsPermissionKey.MAINTENANCE_VIEW);
    const canSettings = access.member.permissionKeys.includes(PmsPermissionKey.SETTINGS_MANAGE);
    const now = new Date();
    const expiringWindowEnd = new Date(now);
    expiringWindowEnd.setDate(expiringWindowEnd.getDate() + 60);

    const [
      companies,
      totalListings,
      approvedListings,
      totalProjects,
      approvedProjects,
      activeRentSchedules,
      openContracts,
      pendingRentDueItems,
      overdueRentDueItems,
      activeTransactions,
      totalPmsProperties,
      totalPmsUnits,
      vacantPmsUnits,
      occupiedPmsUnits,
      maintenancePmsUnits,
      totalPmsTenants,
      activePmsLeases,
      expiringPmsLeases,
      unpaidPmsRentDueItems,
      overduePmsRentDueItems,
      partiallyPaidPmsRentDueItems,
      paidPmsRentDueItems,
      pmsRentDueAggregate,
      pmsRentCollectedAggregate,
      openPmsWorkOrders,
      inProgressPmsWorkOrders,
      urgentPmsWorkOrders,
      pmsMaintenanceCostAggregate,
      scheduledPmsInspections,
      needsActionPmsInspections,
      activePmsCommunicationTemplates,
      activePmsPolicies,
      expiringPmsLeaseAlerts,
    ] = await prisma.$transaction([
      prisma.pmsCompanyMember.findMany({
        where: {
          userId: req.user.id,
          active: true,
          company: {
            pmsEntitlement: {
              is: {
                status: {
                  in: ACTIVE_PMS_ENTITLEMENT_STATUSES,
                },
                disabledAt: null,
              },
            },
          },
        },
        select: {
          id: true,
          role: true,
          company: {
            select: {
              id: true,
              slug: true,
              nameEn: true,
              nameAr: true,
              pmsEntitlement: {
                select: {
                  status: true,
                  trialEndsAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.listing.count({
        where: {
          developerId: companyId,
        },
      }),
      prisma.listing.count({
        where: {
          developerId: companyId,
          status: "APPROVED",
        },
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId,
        },
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId,
          status: "APPROVED",
        },
      }),
      prisma.rentPaymentSchedule.count({
        where: {
          active: true,
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.rentalContractDraft.count({
        where: {
          status: {
            not: "ARCHIVED",
          },
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: {
            in: ["PENDING", "DUE_SOON"],
          },
          schedule: {
            listing: {
              developerId: companyId,
            },
          },
        },
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: "OVERDUE",
          schedule: {
            listing: {
              developerId: companyId,
            },
          },
        },
      }),
      prisma.marketplaceTransaction.count({
        where: {
          status: {
            in: ["DRAFT", "ACTIVE", "DISPUTED"],
          },
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.pmsProperty.count({
        where: {
          companyId,
          ...scopedPropertyWhere,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          occupancyStatus: PmsOccupancyStatus.VACANT,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          occupancyStatus: PmsOccupancyStatus.OCCUPIED,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          operationalStatus: PmsUnitOperationalStatus.MAINTENANCE,
        },
      }),
      prisma.pmsTenant.count({
        where: {
          companyId,
          active: true,
          ...(scopedPropertyId ? { leases: { some: { propertyId: scopedPropertyId } } } : {}),
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
          endDate: {
            gte: now,
            lte: expiringWindowEnd,
          },
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON],
          },
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          OR: [
            { status: PmsRentDueStatus.OVERDUE },
            {
              dueDate: { lt: now },
              status: {
                in: [
                  PmsRentDueStatus.UNPAID,
                  PmsRentDueStatus.DUE_SOON,
                  PmsRentDueStatus.PARTIALLY_PAID,
                ],
              },
            },
          ],
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsRentDueStatus.PARTIALLY_PAID,
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsRentDueStatus.PAID,
        },
      }),
      prisma.pmsRentDueItem.aggregate({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED],
          },
        },
        _sum: {
          amount: true,
          paidAmount: true,
        },
      }),
      prisma.pmsRentPayment.aggregate({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsRentPaymentStatus.CONFIRMED,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsMaintenanceStatus.OPEN,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsMaintenanceStatus.IN_PROGRESS,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          priority: PmsMaintenancePriority.URGENT,
          status: {
            notIn: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED],
          },
        },
      }),
      prisma.pmsWorkOrder.aggregate({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            not: PmsMaintenanceStatus.CANCELLED,
          },
        },
        _sum: {
          cost: true,
        },
      }),
      prisma.pmsInspection.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsInspectionStatus.SCHEDULED,
        },
      }),
      prisma.pmsInspection.count({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: PmsInspectionStatus.NEEDS_ACTION,
        },
      }),
      prisma.pmsCommunicationTemplate.count({
        where: {
          companyId,
          active: true,
        },
      }),
      prisma.pmsPolicy.count({
        where: {
          companyId,
          active: true,
        },
      }),
      prisma.pmsLease.findMany({
        where: {
          companyId,
          propertyId: scopedPropertyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
          endDate: {
            gte: now,
            lte: expiringWindowEnd,
          },
        },
        include: pmsLeaseInclude,
        orderBy: {
          endDate: "asc",
        },
        take: 5,
      }),
    ]);

    const overviewFinancials = await buildPmsReportsSummary(companyId, scopedPropertyId);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      companies: companies.map((member) => ({
        memberId: member.id,
        role: member.role,
        company: member.company,
      })),
      metrics: {
        totalListings,
        approvedListings,
        draftOrPendingListings: Math.max(totalListings - approvedListings, 0),
        totalProjects,
        approvedProjects,
        draftOrPendingProjects: Math.max(totalProjects - approvedProjects, 0),
        activeRentSchedules,
        openContracts,
        pendingRentDueItems,
        overdueRentDueItems,
        activeTransactions,
        totalPmsProperties: canInventory ? totalPmsProperties : null,
        totalPmsUnits: canInventory ? totalPmsUnits : null,
        vacantPmsUnits: canInventory ? vacantPmsUnits : null,
        occupiedPmsUnits: canInventory ? occupiedPmsUnits : null,
        maintenancePmsUnits: canInventory ? maintenancePmsUnits : null,
        totalPmsTenants: canTenancy ? totalPmsTenants : null,
        activePmsLeases: canTenancy ? activePmsLeases : null,
        expiringPmsLeases: canTenancy ? expiringPmsLeases : null,
        unpaidPmsRentDueItems: canRent ? unpaidPmsRentDueItems : null,
        overduePmsRentDueItems: canRent ? overduePmsRentDueItems : null,
        partiallyPaidPmsRentDueItems: canRent ? partiallyPaidPmsRentDueItems : null,
        paidPmsRentDueItems: canRent ? paidPmsRentDueItems : null,
        pmsFinancialCurrencyState: canRent ? overviewFinancials.accounting.currencyState : null,
        pmsFinancialsByCurrency: canRent ? overviewFinancials.accounting.totalsByCurrency : [],
        pmsRentDueAmount: canRent ? overviewFinancials.accounting.outstandingRent : null,
        pmsRentCollectedAmount: canRent ? overviewFinancials.accounting.incomeCollected : null,
        openPmsWorkOrders: canMaintenance ? openPmsWorkOrders : null,
        inProgressPmsWorkOrders: canMaintenance ? inProgressPmsWorkOrders : null,
        urgentPmsWorkOrders: canMaintenance ? urgentPmsWorkOrders : null,
        pmsMaintenanceCostAmount: canMaintenance
          ? overviewFinancials.accounting.maintenanceCosts
          : null,
        scheduledPmsInspections: canMaintenance ? scheduledPmsInspections : null,
        needsActionPmsInspections: canMaintenance ? needsActionPmsInspections : null,
        activePmsCommunicationTemplates: canSettings
          ? activePmsCommunicationTemplates
          : null,
        activePmsPolicies: canSettings ? activePmsPolicies : null,
        pmsOccupancyRate: canInventory
          ? totalPmsUnits > 0
            ? Math.round((occupiedPmsUnits / totalPmsUnits) * 1000) / 10
            : 0
          : null,
      },
      alerts: {
        expiringLeases: canTenancy
          ? expiringPmsLeaseAlerts.map(pmsLeaseResponse)
          : [],
      },
      emptyStates: {
        properties: canInventory ? totalPmsProperties === 0 : null,
        tenants: canTenancy ? totalPmsTenants === 0 : null,
        marketplaceListings: totalListings === 0,
        rentals: canTenancy ? activePmsLeases === 0 : null,
        contracts: openContracts === 0,
        accounting: canRent
          ? unpaidPmsRentDueItems +
              overduePmsRentDueItems +
              partiallyPaidPmsRentDueItems ===
            0
          : null,
        maintenance: canMaintenance
          ? openPmsWorkOrders + inProgressPmsWorkOrders === 0
          : null,
        settings: canSettings
          ? activePmsCommunicationTemplates + activePmsPolicies === 0
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/", requireAuth(), async (req, res, next) => {
  req.url = `/overview${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
  pmsRouter(req, res, next);
});
