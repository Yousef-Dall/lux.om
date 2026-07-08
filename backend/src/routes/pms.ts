import {
  AccountSecurityEventType,
  EmailDeliveryStatus,
  NotificationType,
  PaymentScheduleFrequency,
  PmsAccountingEntryType,
  PmsAccountingSource,
  PmsCommunicationChannel,
  PmsCommunicationLogStatus,
  PmsDocumentStatus,
  PmsDocumentType,
  PmsEntitlementStatus,
  PmsInspectionStatus,
  PmsLeaseStatus,
  PmsMoveChecklistStatus,
  PmsMoveChecklistType,
  PmsMaintenancePriority,
  PmsMaintenanceQuoteStatus,
  PmsMaintenanceRecurrenceType,
  PmsMaintenanceStatus,
  PmsMemberRole,
  PmsOccupancyStatus,
  PmsPolicyCategory,
  PmsRentDueStatus,
  PmsRentPaymentMethod,
  PmsRentPaymentStatus,
  PmsReminderType,
  PmsUnitStatus,
  type Prisma,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { recordAccountSecurityEvent } from "../lib/accountSecurityEvents";
import { prisma } from "../lib/prisma";
import {
  ACTIVE_PMS_ENTITLEMENT_STATUSES,
  resolvePmsWorkspaceAccess,
} from "../lib/pmsAccess";
import {
  assertCanCollectPmsRent,
  assertCanManagePmsAccounting,
  assertCanManagePmsDocuments,
  assertCanManagePmsMaintenanceDocuments,
  assertCanManagePmsInventory,
  assertCanViewPmsAccounting,
  assertCanManagePmsMaintenance,
  assertCanManagePmsOperations,
  assertCanSendPmsCommunication,
  assertCanViewPmsCommunications,
  assertCanManagePmsTenancies,
  assertCanViewPmsDocuments,
} from "../lib/pmsPermissions";
import {
  assertCanApplyRentPayment,
  createPmsRentReceiptNumber,
  decimalToNumber as rentDecimalToNumber,
  getPaidRentStatus,
  roundMoney,
} from "../lib/pmsRentPayments";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { AppError } from "../utils/http";

export const pmsRouter = Router();

const idParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const companyParamsSchema = z.object({
  companyId: z.string().trim().min(1),
});

const pmsOverviewQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
});

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
  });

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

const pmsMaintenanceQuoteUpdateSchema = pmsMaintenanceQuoteCreateSchema
  .partial()
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
  .refine((value) => value.startsWith('/uploads/') || /^https?:\/\//i.test(value), {
    message: 'Document file must be an uploaded file path or a HTTPS URL.',
  });

const pmsDocumentListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  workOrderId: z.string().trim().min(1).optional(),
  inspectionId: z.string().trim().min(1).optional(),
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

const pmsDocumentExpiryQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
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
  type: z.nativeEnum(PmsReminderType).default(PmsReminderType.RENT_DUE_SOON),
  days: z.coerce.number().int().min(1).max(120).default(7),
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
}

function assertMaintenanceDocumentScope(input: {
  role: PmsMemberRole;
  type?: PmsDocumentType;
  workOrderId?: string | null;
  inspectionId?: string | null;
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
  },
) {
  await recordAccountSecurityEvent(prisma, {
    userId: input.targetUserId ?? input.actorId,
    actorId: input.actorId,
    type: AccountSecurityEventType.ADMIN_PMS_ACCESS_UPDATED,
    title: input.title,
    message: input.message,
    metadata: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      companyId: input.companyId,
      ...input.metadata,
    },
  });
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

function defaultOccupancyForUnitStatus(status: PmsUnitStatus) {
  if (status === PmsUnitStatus.OCCUPIED) return PmsOccupancyStatus.OCCUPIED;
  if (status === PmsUnitStatus.RESERVED) return PmsOccupancyStatus.RESERVED;
  if (status === PmsUnitStatus.VACANT) return PmsOccupancyStatus.VACANT;
  return PmsOccupancyStatus.UNKNOWN;
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

function pmsTenantResponse(tenant: PmsTenantWithRelations) {
  return {
    id: tenant.id,
    companyId: tenant.companyId,
    fullName: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    nationality: tenant.nationality,
    nationalId: tenant.nationalId,
    passportNumber: tenant.passportNumber,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
    emergencyContactEmail: tenant.emergencyContactEmail,
    notes: tenant.notes,
    active: tenant.active,
    counts: {
      leases: tenant._count.leases,
    },
    portalAccesses: tenant.pmsTenantPortalAccesses.map((access) => ({
      id: access.id,
      companyId: access.companyId,
      tenantId: access.tenantId,
      userId: access.userId,
      active: access.active,
      user: access.user,
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
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
    rentDueItem: pmsRentDueItemResponse(payment.rentDueItem),
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
    rentDueItem: pmsRentDueItemResponse(payment.rentDueItem),
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
    type: document.type,
    title: document.title,
    fileUrl: document.fileUrl,
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
    ...(nextStatus !== undefined ? { status: nextStatus } : {}),
    ...(data.occupancyStatus !== undefined
      ? { occupancyStatus: data.occupancyStatus ?? PmsOccupancyStatus.UNKNOWN }
      : nextStatus !== undefined
        ? { occupancyStatus: defaultOccupancyForUnitStatus(nextStatus) }
        : {}),
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
    const search = query.search?.trim();
    const where: Prisma.PmsTenantWhereInput = {
      companyId: access.company.id,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { nationalId: { contains: search, mode: "insensitive" } },
              { passportNumber: { contains: search, mode: "insensitive" } },
            ],
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

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenants: tenants.map(pmsTenantResponse),
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
    assertCanManagePmsTenancies(access.member.role);

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

    res.status(201).json({ tenant: pmsTenantResponse(tenant) });
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

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenant: pmsTenantResponse(tenant),
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
    assertCanManagePmsTenancies(access.member.role);

    const tenant = await prisma.pmsTenant.update({
      where: { id: tenantId },
      data: buildPmsTenantWriteData(data, req.user.id),
      include: pmsTenantInclude,
    });

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

    res.json({ tenant: pmsTenantResponse(tenant) });
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
    assertCanManagePmsTenancies(access.member.role);

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
    const where: Prisma.PmsLeaseWhereInput = {
      companyId: access.company.id,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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
    assertCanManagePmsTenancies(access.member.role);

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

    const existingActiveLease = await prisma.pmsLease.findFirst({
      where: {
        unitId: data.unitId,
        status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
      },
      select: { id: true },
    });

    if (existingActiveLease && getLeaseOccupancyStatus(data.status)) {
      throw new AppError(409, "This unit already has an active PMS lease.");
    }

    const lease = await prisma.$transaction(async (tx) => {
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
        }
      }

      if (getLeaseOccupancyStatus(data.status)) {
        await tx.pmsUnit.update({
          where: { id: data.unitId },
          data: {
            status: PmsUnitStatus.OCCUPIED,
            occupancyStatus: PmsOccupancyStatus.OCCUPIED,
            updatedById: userId,
          },
        });
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
    });

    res.status(201).json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(error);
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
      select: { id: true, companyId: true, unitId: true, startDate: true, endDate: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: existing.companyId,
    });
    assertCanManagePmsTenancies(access.member.role);

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
      const updated = await tx.pmsLease.update({
        where: { id: leaseId },
        data: buildPmsLeaseWriteData(data, userId),
        include: pmsLeaseInclude,
      });

      if (data.status) {
        if (getLeaseOccupancyStatus(data.status)) {
          await tx.pmsUnit.update({
            where: { id: existing.unitId },
            data: {
              status: PmsUnitStatus.OCCUPIED,
              occupancyStatus: PmsOccupancyStatus.OCCUPIED,
              updatedById: userId,
            },
          });
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
            await tx.pmsUnit.update({
              where: { id: existing.unitId },
              data: {
                status: PmsUnitStatus.VACANT,
                occupancyStatus: PmsOccupancyStatus.VACANT,
                updatedById: userId,
              },
            });
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
    });

    res.json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(error);
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
    assertCanManagePmsTenancies(access.member.role);

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
    const lease = await prisma.pmsLease.findUnique({ where: { id: leaseId }, select: { id: true, companyId: true } });
    if (!lease) throw new AppError(404, "PMS lease not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: lease.companyId });
    assertCanViewPmsDocuments(access.member.role);

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
    assertCanManagePmsTenancies(access.member.role);

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
    assertCanManagePmsTenancies(access.member.role);

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
      select: { id: true, companyId: true },
    });

    if (!lease) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: lease.companyId,
    });
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
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      leaseId: query.leaseId,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
    });
    const dueDate = buildPmsRentDueDateFilter(query);
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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
      select: { id: true, companyId: true, amount: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS rent due item not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanCollectPmsRent(access.member.role);

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
    assertCanCollectPmsRent(access.member.role);

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
          paidAt: data.paidAt ?? new Date(),
          confirmedAt: new Date(),
          receiptNumber: createPmsRentReceiptNumber(),
          recordedById: req.user!.id,
        },
        include: pmsRentPaymentInclude,
      });
      await tx.pmsAccountingLedgerEntry.create({
        data: {
          companyId: access.company.id,
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

    await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: payment.companyId,
    });

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

async function buildPmsReportsSummary(companyId: string) {
  const now = new Date();
  const renewalWindowEnd = new Date(now);
  renewalWindowEnd.setDate(renewalWindowEnd.getDate() + 60);

  const [
    totalUnits,
    occupiedUnits,
    vacantUnits,
    rentCollected,
    outstandingRent,
    overdueRent,
    maintenanceCosts,
    manualIncomeEntries,
    manualExpenseEntries,
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
    prisma.pmsUnit.count({ where: { companyId } }),
    prisma.pmsUnit.count({ where: { companyId, status: PmsUnitStatus.OCCUPIED } }),
    prisma.pmsUnit.count({ where: { companyId, status: PmsUnitStatus.VACANT } }),
    prisma.pmsRentPayment.aggregate({
      where: {
        companyId,
        status: PmsRentPaymentStatus.CONFIRMED,
      },
      _sum: { amount: true },
    }),
    prisma.pmsRentDueItem.aggregate({
      where: {
        companyId,
        status: { notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED] },
      },
      _sum: { amount: true },
    }),
    prisma.pmsRentDueItem.aggregate({
      where: {
        companyId,
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
      _sum: { amount: true },
    }),
    prisma.pmsWorkOrder.aggregate({
      where: {
        companyId,
        status: { not: PmsMaintenanceStatus.CANCELLED },
      },
      _sum: { cost: true },
    }),
    prisma.pmsAccountingLedgerEntry.aggregate({
      where: {
        companyId,
        source: PmsAccountingSource.MANUAL,
        type: { in: [PmsAccountingEntryType.INCOME, PmsAccountingEntryType.LATE_FEE, PmsAccountingEntryType.DEPOSIT, PmsAccountingEntryType.ADJUSTMENT] },
      },
      _sum: { amount: true },
    }),
    prisma.pmsAccountingLedgerEntry.aggregate({
      where: {
        companyId,
        source: PmsAccountingSource.MANUAL,
        type: { in: [PmsAccountingEntryType.EXPENSE, PmsAccountingEntryType.REFUND] },
      },
      _sum: { amount: true },
    }),
    prisma.pmsWorkOrder.count({ where: { companyId, status: PmsMaintenanceStatus.OPEN } }),
    prisma.pmsWorkOrder.count({ where: { companyId, status: PmsMaintenanceStatus.IN_PROGRESS } }),
    prisma.pmsWorkOrder.count({ where: { companyId, status: PmsMaintenanceStatus.RESOLVED } }),
    prisma.pmsWorkOrder.count({ where: { companyId, priority: PmsMaintenancePriority.URGENT } }),
    prisma.pmsInspection.count({ where: { companyId, status: PmsInspectionStatus.SCHEDULED } }),
    prisma.pmsInspection.count({ where: { companyId, status: PmsInspectionStatus.COMPLETED } }),
    prisma.pmsInspection.count({ where: { companyId, status: PmsInspectionStatus.NEEDS_ACTION } }),
    prisma.pmsCommunicationTemplate.count({ where: { companyId, active: true } }),
    prisma.pmsPolicy.count({ where: { companyId, active: true } }),
    prisma.pmsRentDueItem.findMany({
      where: {
        companyId,
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
      include: pmsRentDueItemInclude,
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
    prisma.pmsLease.findMany({
      where: {
        companyId,
        status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
        endDate: { gte: now, lte: renewalWindowEnd },
      },
      include: pmsLeaseInclude,
      orderBy: [{ endDate: "asc" }],
      take: 5,
    }),
  ]);

  const maintenanceCost = maintenanceCosts._sum.cost;
  const incomeCollectedAmount = Number(rentCollected._sum.amount ?? 0) + Number(manualIncomeEntries._sum.amount ?? 0);
  const expenseAmount = Number(maintenanceCost ?? 0) + Number(manualExpenseEntries._sum.amount ?? 0);

  return {
    accounting: {
      incomeCollected: moneyString(incomeCollectedAmount),
      outstandingRent: decimalToString(outstandingRent._sum.amount),
      overdueRent: decimalToString(overdueRent._sum.amount),
      expenses: moneyString(expenseAmount),
      maintenanceCosts: decimalToString(maintenanceCost),
      lateFeeFoundationEnabled: false,
      lateFeeNote:
        "Late fee policy records are available, but automatic fee posting is not enabled yet.",
    },
    reports: {
      occupancy: {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate:
          totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0,
      },
      revenue: {
        collected: moneyString(incomeCollectedAmount),
        outstanding: decimalToString(outstandingRent._sum.amount),
        overdue: decimalToString(overdueRent._sum.amount),
      },
      overdueTopList: overdueTopList.map(pmsRentDueItemResponse),
      maintenance: {
        open: openMaintenance,
        inProgress: inProgressMaintenance,
        resolved: resolvedMaintenance,
        urgent: urgentMaintenance,
        costs: decimalToString(maintenanceCost),
      },
      leaseRenewals: expiringLeases.map(pmsLeaseResponse),
      inspections: {
        scheduled: scheduledInspections,
        completed: completedInspections,
        needsAction: needsActionInspections,
      },
      communications: {
        activeTemplates: communicationTemplateCount,
      },
      policies: {
        activePolicies: activePolicyCount,
      },
    },
  };
}


pmsRouter.get("/vendors", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsVendorListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanManagePmsMaintenance(access.member.role);

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
    assertCanManagePmsMaintenance(access.member.role);

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
    assertCanManagePmsMaintenance(access.member.role);

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
    const workOrder = await prisma.pmsWorkOrder.findUnique({ where: { id: workOrderId }, select: { id: true, companyId: true } });
    if (!workOrder) throw new AppError(404, "PMS maintenance work order not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: workOrder.companyId });
    assertCanManagePmsMaintenance(access.member.role);

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
    assertCanManagePmsMaintenance(access.member.role);
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
    assertCanManagePmsMaintenance(access.member.role);

    if (data.status === PmsMaintenanceQuoteStatus.APPROVED) {
      assertCanManagePmsOperations(access.member.role);
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
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
      vendorId: query.vendorId,
    });
    const search = query.search?.trim();
    const where: Prisma.PmsWorkOrderWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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
    assertCanManagePmsMaintenance(access.member.role);
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
    assertCanManagePmsMaintenance(access.member.role);
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
): Prisma.PmsAccountingLedgerEntryWhereInput {
  const transactionDate = buildPmsAccountingDateFilter({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  return {
    companyId,
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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

async function buildPmsOwnerStatement(input: {
  companyId: string;
  propertyId?: string;
  unitId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  month?: string;
}) {
  const range = getPmsStatementRange(input);
  const closedDateFilter = buildPmsAccountingDateFilter({ dateFrom: range.start, dateTo: range.end });
  const paymentWhere: Prisma.PmsRentPaymentWhereInput = {
    companyId: input.companyId,
    status: PmsRentPaymentStatus.CONFIRMED,
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { paidAt: closedDateFilter } : {}),
  };
  const ledgerWhere: Prisma.PmsAccountingLedgerEntryWhereInput = {
    companyId: input.companyId,
    source: PmsAccountingSource.MANUAL,
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { transactionDate: closedDateFilter } : {}),
  };
  const workOrderWhere: Prisma.PmsWorkOrderWhereInput = {
    companyId: input.companyId,
    status: { not: PmsMaintenanceStatus.CANCELLED },
    cost: { not: null },
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter
      ? {
          OR: [
            { resolvedAt: closedDateFilter },
            { resolvedAt: null, updatedAt: closedDateFilter },
          ],
        }
      : {}),
  };
  const rentDueWhere: Prisma.PmsRentDueItemWhereInput = {
    companyId: input.companyId,
    status: { notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED] },
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(closedDateFilter ? { dueDate: closedDateFilter } : {}),
  };
  const activeLeaseWhere: Prisma.PmsLeaseWhereInput = {
    companyId: input.companyId,
    status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
    securityDeposit: { not: null },
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
  };

  const [
    rentPayments,
    manualEntries,
    maintenanceCosts,
    outstandingItems,
    securityDeposits,
    property,
    unit,
  ] = await prisma.$transaction([
    prisma.pmsRentPayment.findMany({
      where: paymentWhere,
      include: pmsRentPaymentInclude,
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.pmsAccountingLedgerEntry.findMany({
      where: ledgerWhere,
      include: pmsAccountingLedgerEntryInclude,
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.pmsWorkOrder.findMany({
      where: workOrderWhere,
      include: pmsWorkOrderInclude,
      orderBy: [{ resolvedAt: "asc" }, { updatedAt: "asc" }],
    }),
    prisma.pmsRentDueItem.findMany({
      where: rentDueWhere,
      include: pmsRentDueItemInclude,
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.pmsLease.findMany({
      where: activeLeaseWhere,
      select: { id: true, title: true, securityDeposit: true, currency: true, tenant: { select: { id: true, fullName: true } }, unit: { select: { id: true, unitNumber: true } } },
    }),
    input.propertyId
      ? prisma.pmsProperty.findUnique({ where: { id: input.propertyId }, select: { id: true, name: true, code: true } })
      : prisma.pmsProperty.findFirst({ where: { companyId: input.companyId }, select: { id: true, name: true, code: true } }),
    input.unitId
      ? prisma.pmsUnit.findUnique({ where: { id: input.unitId }, select: { id: true, unitNumber: true, unitName: true } })
      : prisma.pmsUnit.findFirst({ where: { companyId: input.companyId }, select: { id: true, unitNumber: true, unitName: true } }),
  ]);

  const rentCollected = sumDecimal(rentPayments.map((payment) => payment.amount));
  const manualIncome = sumDecimal(manualEntries.filter((entry) => entry.type === PmsAccountingEntryType.INCOME || entry.type === PmsAccountingEntryType.LATE_FEE).map((entry) => entry.amount));
  const manualExpenses = sumDecimal(manualEntries.filter((entry) => isPmsAccountingExpenseType(entry.type)).map((entry) => entry.amount));
  const manualAdjustments = sumDecimal(manualEntries.filter((entry) => entry.type === PmsAccountingEntryType.ADJUSTMENT).map((entry) => entry.amount));
  const depositCollected = sumDecimal(manualEntries.filter((entry) => entry.type === PmsAccountingEntryType.DEPOSIT && !entry.category.toLowerCase().includes("refund")).map((entry) => entry.amount));
  const depositRefunded = sumDecimal(manualEntries.filter((entry) => entry.type === PmsAccountingEntryType.REFUND || (entry.type === PmsAccountingEntryType.DEPOSIT && entry.category.toLowerCase().includes("refund"))).map((entry) => entry.amount));
  const maintenanceTotal = sumDecimal(maintenanceCosts.map((workOrder) => workOrder.cost));
  const outstandingRent = outstandingItems.reduce((total, item) => {
    return total + Math.max(Number(item.amount) - Number(item.paidAmount), 0);
  }, 0);
  const depositHeldFoundation = sumDecimal(securityDeposits.map((lease) => lease.securityDeposit)) + depositCollected - depositRefunded;
  const income = rentCollected + manualIncome + manualAdjustments;
  const expenses = manualExpenses + maintenanceTotal;
  const netAmount = income - expenses;

  return {
    period: {
      month: input.month ?? null,
      from: range.start ?? null,
      to: range.end ?? null,
    },
    scope: {
      companyId: input.companyId,
      propertyId: input.propertyId ?? null,
      unitId: input.unitId ?? null,
      property,
      unit,
    },
    totals: {
      rentCollected: moneyString(rentCollected),
      manualIncome: moneyString(manualIncome),
      income: moneyString(income),
      outstandingRent: moneyString(outstandingRent),
      expenses: moneyString(expenses),
      maintenanceCosts: moneyString(maintenanceTotal),
      netAmount: moneyString(netAmount),
      depositCollected: moneyString(depositCollected),
      depositHeld: moneyString(Math.max(depositHeldFoundation, 0)),
      depositRefunded: moneyString(depositRefunded),
      depositDeductions: moneyString(0),
    },
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
      ...manualEntries
        .filter((entry) => isPmsAccountingIncomeType(entry.type))
        .map(pmsAccountingLedgerEntryResponse),
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
      ...manualEntries
        .filter((entry) => isPmsAccountingExpenseType(entry.type))
        .map(pmsAccountingLedgerEntryResponse),
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
  };
}

pmsRouter.get("/accounting/ledger", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member.role);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
      leaseId: query.leaseId,
      rentDueItemId: query.rentDueItemId,
      workOrderId: query.workOrderId,
    });

    const where = buildPmsAccountingWhere(access.company.id, query);
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
    assertCanViewPmsAccounting(access.member.role);
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
      where: buildPmsAccountingWhere(access.company.id, query),
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
    assertCanManagePmsAccounting(access.member.role);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
      rentDueItemId: data.rentDueItemId,
      workOrderId: data.workOrderId,
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
    const existing = await prisma.pmsAccountingLedgerEntry.findUnique({ where: { id: ledgerEntryId }, select: { id: true, companyId: true, source: true } });
    if (!existing) throw new AppError(404, "PMS accounting ledger entry not found");
    if (existing.source !== PmsAccountingSource.MANUAL) {
      throw new AppError(400, "Only manual PMS accounting ledger entries can be edited.");
    }

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    assertCanManagePmsAccounting(access.member.role);
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
      rentDueItemId: data.rentDueItemId,
      workOrderId: data.workOrderId,
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

pmsRouter.get("/accounting/property-summary", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsAccountingStatementQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsAccounting(access.member.role);
    await assertPmsFilterLinksBelongToCompany({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId });
    const statement = await buildPmsOwnerStatement({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId, dateFrom: query.dateFrom, dateTo: query.dateTo, month: query.month });

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
    assertCanViewPmsAccounting(access.member.role);
    await assertPmsFilterLinksBelongToCompany({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId });
    const statement = await buildPmsOwnerStatement({ companyId: access.company.id, propertyId: query.propertyId, unitId: query.unitId, dateFrom: query.dateFrom, dateTo: query.dateTo, month: query.month });

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
    assertCanViewPmsAccounting(access.member.role);
    const summary = await buildPmsReportsSummary(access.company.id);

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
    assertCanManagePmsOperations(access.member.role);

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
    assertCanManagePmsOperations(access.member.role);

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
    assertCanViewPmsCommunications(access.member.role);

    const search = query.search?.trim();
    const where: Prisma.PmsCommunicationLogWhereInput = {
      companyId: access.company.id,
      ...(query.channel !== "ALL" ? { channel: query.channel } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.rentDueItemId ? { rentDueItemId: query.rentDueItemId } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              { tenant: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
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
    assertCanViewPmsCommunications(access.member.role);

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
    assertCanSendPmsCommunication(access.member.role, context);

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

pmsRouter.get("/communications/reminders", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsReminderCandidateQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsCommunications(access.member.role);

    const now = new Date();
    const until = new Date(now.getTime() + query.days * 24 * 60 * 60 * 1000);
    let candidates: unknown[] = [];

    if (query.type === PmsReminderType.RENT_DUE_SOON) {
      const items = await prisma.pmsRentDueItem.findMany({
        where: {
          companyId: access.company.id,
          status: { in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON, PmsRentDueStatus.PARTIALLY_PAID] },
          dueDate: { gte: now, lte: until },
        },
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true, unitName: true } },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: query.take,
        skip: query.skip,
      });
      candidates = items.map((item) => ({
        type: query.type,
        rentDueItemId: item.id,
        tenantId: item.tenantId,
        tenant: item.tenant,
        property: item.property,
        unit: item.unit,
        dueDate: item.dueDate,
        amount: decimalToString(item.amount),
        paidAmount: decimalToString(item.paidAmount),
        currency: item.currency,
        status: item.status,
      }));
    } else if (query.type === PmsReminderType.OVERDUE_RENT) {
      const items = await prisma.pmsRentDueItem.findMany({
        where: {
          companyId: access.company.id,
          status: { in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.OVERDUE, PmsRentDueStatus.PARTIALLY_PAID] },
          dueDate: { lt: now },
        },
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true, unitName: true } },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: query.take,
        skip: query.skip,
      });
      candidates = items.map((item) => ({
        type: query.type,
        rentDueItemId: item.id,
        tenantId: item.tenantId,
        tenant: item.tenant,
        property: item.property,
        unit: item.unit,
        dueDate: item.dueDate,
        amount: decimalToString(item.amount),
        paidAmount: decimalToString(item.paidAmount),
        currency: item.currency,
        status: item.status,
      }));
    } else if (query.type === PmsReminderType.LEASE_EXPIRY) {
      const leases = await prisma.pmsLease.findMany({
        where: {
          companyId: access.company.id,
          status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
          endDate: { gte: now, lte: until },
        },
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true, unitName: true } },
        },
        orderBy: [{ endDate: "asc" }, { id: "asc" }],
        take: query.take,
        skip: query.skip,
      });
      candidates = leases.map((lease) => ({
        type: query.type,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        tenant: lease.tenant,
        property: lease.property,
        unit: lease.unit,
        leaseEndDate: lease.endDate,
        status: lease.status,
      }));
    } else {
      const workOrders = await prisma.pmsWorkOrder.findMany({
        where: {
          companyId: access.company.id,
          status: { in: [PmsMaintenanceStatus.OPEN, PmsMaintenanceStatus.IN_PROGRESS, PmsMaintenanceStatus.WAITING_VENDOR, PmsMaintenanceStatus.RESOLVED] },
        },
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true, unitName: true } },
          vendor: { select: { id: true, name: true, trade: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: query.take,
        skip: query.skip,
      });
      candidates = workOrders.map((workOrder) => ({
        type: query.type,
        workOrderId: workOrder.id,
        tenantId: workOrder.tenantId,
        tenant: workOrder.tenant,
        property: workOrder.property,
        unit: workOrder.unit,
        vendor: workOrder.vendor,
        maintenanceTitle: workOrder.title,
        maintenanceStatus: workOrder.status,
        priority: workOrder.priority,
      }));
    }

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
    assertCanManagePmsOperations(access.member.role);

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
    assertCanManagePmsOperations(access.member.role);

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
    await assertPmsFilterLinksBelongToCompany({
      companyId: access.company.id,
      leaseId: query.leaseId,
      tenantId: query.tenantId,
      propertyId: query.propertyId,
      unitId: query.unitId,
    });
    const search = query.search?.trim();
    const where: Prisma.PmsInspectionWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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
    assertCanManagePmsMaintenance(access.member.role);
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
      select: { id: true, companyId: true, propertyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS inspection not found");
    }

    const access = await resolvePmsAccessOrThrow({ userId, companyId: existing.companyId });
    assertCanManagePmsMaintenance(access.member.role);
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

pmsRouter.get("/documents", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const query = pmsDocumentListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: query.companyId });
    assertCanViewPmsDocuments(access.member.role);
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
    const where: Prisma.PmsDocumentWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(query.inspectionId ? { inspectionId: query.inspectionId } : {}),
      ...(query.type !== "ALL" ? { type: query.type } : {}),
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
    assertCanViewPmsDocuments(access.member.role);

    const expiryDate = getPmsDocumentExpiryFilter({ expiringWithinDays: query.withinDays });
    const documents = await prisma.pmsDocument.findMany({
      where: {
        companyId: access.company.id,
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
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const data = pmsDocumentCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({ userId, companyId: data.companyId });
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertCanManagePmsMaintenanceDocuments(access.member.role);
    } else {
      assertCanManagePmsDocuments(access.member.role);
    }
    assertMaintenanceDocumentScope({ role: access.member.role, type: data.type, workOrderId: data.workOrderId, inspectionId: data.inspectionId });
    await assertPmsDocumentLinksBelongToCompany({
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      tenantId: data.tenantId,
      leaseId: data.leaseId,
      workOrderId: data.workOrderId,
      inspectionId: data.inspectionId,
    });

    const document = await prisma.pmsDocument.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId ?? null,
        unitId: data.unitId ?? null,
        tenantId: data.tenantId ?? null,
        leaseId: data.leaseId ?? null,
        workOrderId: data.workOrderId ?? null,
        inspectionId: data.inspectionId ?? null,
        type: data.type,
        title: data.title,
        fileUrl: data.fileUrl,
        status: getPmsDocumentLifecycleStatus({ status: data.status, expiryDate: data.expiryDate ?? null }),
        expiryDate: data.expiryDate ?? null,
        notes: normalizeNullableText(data.notes),
        uploadedById: userId,
        updatedById: userId,
      },
      include: pmsDocumentInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS document created",
      message: `${req.user.email} added PMS document ${document.title}.`,
      metadata: { action: "create", resourceType: "pmsDocument", documentId: document.id, type: document.type },
    });

    res.status(201).json({ document: pmsDocumentResponse(document) });
  } catch (error) {
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
    assertCanViewPmsDocuments(access.member.role);
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
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { documentId } = pmsDocumentParamsSchema.parse(req.params);
    const data = pmsDocumentUpdateSchema.parse(req.body);
    const existing = await prisma.pmsDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw new AppError(404, "PMS document not found");

    const access = await resolvePmsAccessOrThrow({ userId: req.user.id, companyId: existing.companyId });
    if (access.member.role === PmsMemberRole.PMS_MAINTENANCE) {
      assertCanManagePmsMaintenanceDocuments(access.member.role);
    } else {
      assertCanManagePmsDocuments(access.member.role);
    }
    assertMaintenanceDocumentScope({
      role: access.member.role,
      type: data.type ?? existing.type,
      workOrderId: data.workOrderId ?? existing.workOrderId,
      inspectionId: data.inspectionId ?? existing.inspectionId,
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
    const document = await prisma.pmsDocument.update({
      where: { id: documentId },
      data: {
        ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
        ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
        ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
        ...(data.leaseId !== undefined ? { leaseId: data.leaseId } : {}),
        ...(data.workOrderId !== undefined ? { workOrderId: data.workOrderId } : {}),
        ...(data.inspectionId !== undefined ? { inspectionId: data.inspectionId } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.status !== undefined || data.expiryDate !== undefined
          ? { status: getPmsDocumentLifecycleStatus({ status: data.status ?? existing.status, expiryDate }) }
          : {}),
        ...(data.expiryDate !== undefined ? { expiryDate } : {}),
        ...(data.notes !== undefined ? { notes: normalizeNullableText(data.notes) } : {}),
        updatedById: req.user.id,
      },
      include: pmsDocumentInclude,
    });

    await recordPmsWorkspaceAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      companyId: access.company.id,
      title: "PMS document updated",
      message: `${req.user.email} updated PMS document ${document.title}.`,
      metadata: { action: "update", resourceType: "pmsDocument", documentId: document.id, changedFields: Object.keys(data) },
    });

    res.json({ document: pmsDocumentResponse(document) });
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
    assertCanManagePmsInventory(access.member.role);
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
      assertCanManagePmsInventory(access.member.role);
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
      assertCanManagePmsInventory(access.member.role);

      const developerProjectId =
        data.developerProjectId ?? property.developerProjectId ?? null;
      const publicListingId =
        data.publicListingId ?? property.publicListingId ?? null;
      await assertOptionalLinksBelongToCompany({
        companyId: property.companyId,
        developerProjectId,
        publicListingId,
      });

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
          status: data.status,
          occupancyStatus:
            data.occupancyStatus ?? defaultOccupancyForUnitStatus(data.status),
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
    const where: Prisma.PmsUnitWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
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
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS unit not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanManagePmsInventory(access.member.role);
    await assertOptionalLinksBelongToCompany({
      companyId: existing.companyId,
      developerProjectId: data.developerProjectId,
      publicListingId: data.publicListingId,
    });

    const unit = await prisma.pmsUnit.update({
      where: { id: unitId },
      data: buildPmsUnitWriteData(data, req.user.id),
      include: pmsUnitInclude,
    });

    res.json({
      unit: pmsUnitResponse(unit),
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
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.VACANT,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.OCCUPIED,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.MAINTENANCE,
        },
      }),
      prisma.pmsTenant.count({
        where: {
          companyId,
          active: true,
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
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
          status: {
            in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON],
          },
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
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
          status: PmsRentDueStatus.PARTIALLY_PAID,
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          status: PmsRentDueStatus.PAID,
        },
      }),
      prisma.pmsRentDueItem.aggregate({
        where: {
          companyId,
          status: {
            notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED],
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.pmsRentPayment.aggregate({
        where: {
          companyId,
          status: PmsRentPaymentStatus.CONFIRMED,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          status: PmsMaintenanceStatus.OPEN,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          status: PmsMaintenanceStatus.IN_PROGRESS,
        },
      }),
      prisma.pmsWorkOrder.count({
        where: {
          companyId,
          priority: PmsMaintenancePriority.URGENT,
          status: {
            notIn: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED],
          },
        },
      }),
      prisma.pmsWorkOrder.aggregate({
        where: {
          companyId,
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
          status: PmsInspectionStatus.SCHEDULED,
        },
      }),
      prisma.pmsInspection.count({
        where: {
          companyId,
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
        pmsRentDueAmount: decimalToString(pmsRentDueAggregate._sum.amount),
        pmsRentCollectedAmount: decimalToString(
          pmsRentCollectedAggregate._sum.amount,
        ),
        openPmsWorkOrders,
        inProgressPmsWorkOrders,
        urgentPmsWorkOrders,
        pmsMaintenanceCostAmount: decimalToString(
          pmsMaintenanceCostAggregate._sum.cost,
        ),
        scheduledPmsInspections,
        needsActionPmsInspections,
        activePmsCommunicationTemplates,
        activePmsPolicies,
        pmsOccupancyRate:
          totalPmsUnits > 0
            ? Math.round((occupiedPmsUnits / totalPmsUnits) * 1000) / 10
            : 0,
      },
      alerts: {
        expiringLeases: expiringPmsLeaseAlerts.map(pmsLeaseResponse),
      },
      emptyStates: {
        properties: totalPmsProperties === 0,
        tenants: totalPmsTenants === 0,
        marketplaceListings: totalListings === 0,
        rentals: activePmsLeases === 0,
        contracts: openContracts === 0,
        accounting:
          unpaidPmsRentDueItems + overduePmsRentDueItems + partiallyPaidPmsRentDueItems === 0,
        maintenance: openPmsWorkOrders + inProgressPmsWorkOrders === 0,
        settings: activePmsCommunicationTemplates + activePmsPolicies === 0,
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
