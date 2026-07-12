import { DomainAuditDomain, Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { maxPmsDocumentBytes } from '../../../config/env';
import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { removePrivatePmsDocument, storePrivatePmsDocument, supportedPrivateDocumentMimeTypes } from '../../../storage/privatePmsDocumentStorage';
import { AppError } from '../../../utils/http';
import { money } from '../finance/money';
import { sendPrivatePmsDocument } from '../shared/privateDocument';
import { getUserVendorPortalAccessSummary, resolveVendorPortalAccess, serializePortalProperty } from './access';

export const vendorPortalRouter = Router();

const accessQuery = z.object({ accessId: z.string().trim().min(1).optional() });
const idParams = z.object({ id: z.string().trim().min(1) });
const quoteSchema = z.object({
  accessId: z.string().trim().min(1).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(3000).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
});
const updateSchema = z.object({
  accessId: z.string().trim().min(1).optional(),
  action: z.enum(['SCHEDULE', 'START', 'REQUEST_COMPLETION']),
  scheduledFor: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  comment: z.string().trim().min(3).max(3000),
});
const uploadFieldsSchema = z.object({
  accessId: z.string().trim().min(1).optional(),
  kind: z.enum(['BEFORE_PHOTO', 'AFTER_PHOTO', 'INVOICE', 'OTHER_DOCUMENT']),
  title: z.string().trim().min(1).max(250),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const invoiceUploadSchema = z.object({
  accessId: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1).max(200),
  externalInvoiceNumber: z.string().trim().max(200).nullable().optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  subtotalAmount: z.coerce.number().nonnegative().max(1_000_000_000),
  taxAmount: z.coerce.number().nonnegative().max(1_000_000_000).default(0),
  totalAmount: z.coerce.number().positive().max(1_000_000_000),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPmsDocumentBytes, files: 1, fields: 20 },
  fileFilter: (_req, file, callback) => {
    if (!supportedPrivateDocumentMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, 'Vendor files must be PDF, JPG, PNG, or WEBP.'));
      return;
    }
    callback(null, true);
  },
});
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) return next(new AppError(400, error.code === 'LIMIT_FILE_SIZE' ? 'Vendor file exceeds the private document size limit.' : error.message));
    next(error);
  });
}

function vendorVisibleWorkOrderDocumentsWhere(): Prisma.PmsDocumentWhereInput {
  return {
    status: { not: 'ARCHIVED' },
    OR: [
      { vendorInvoiceId: null, type: { in: ['MAINTENANCE_INVOICE', 'INSPECTION_REPORT', 'OTHER'] } },
      { vendorInvoiceId: { not: null }, type: 'MAINTENANCE_INVOICE' },
    ],
  };
}

vendorPortalRouter.get('/access', requireAuth(), async (req, res, next) => {
  try { res.json(await getUserVendorPortalAccessSummary(req.user!.id)); } catch (error) { next(error); }
});

vendorPortalRouter.get('/work-orders', requireAuth(), async (req, res, next) => {
  try {
    const query = accessQuery.parse(req.query);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const workOrders = await prisma.pmsWorkOrder.findMany({
      where: { companyId: access.companyId, vendorId: access.vendorId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        approvedQuoteId: true,
        scheduledFor: true,
        targetDate: true,
        resolvedAt: true,
        beforeImageUrls: true,
        afterImageUrls: true,
        notes: true,
        property: { select: { id: true, name: true, addressLine: true } },
        unit: { select: { id: true, unitNumber: true } },
        asset: { select: { id: true, assetCode: true, name: true, warrantyExpiry: true } },
        quotes: { where: { vendorId: access.vendorId }, orderBy: { createdAt: 'desc' } },
        pmsDocuments: { where: vendorVisibleWorkOrderDocumentsWhere(), select: { id: true, title: true, type: true, mimeType: true, originalFilename: true, sizeBytes: true, notes: true, createdAt: true } },
      },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({
      access: { id: access.id, company: access.company, vendor: access.vendor },
      workOrders: workOrders.map((workOrder) => ({
        ...workOrder,
        property: serializePortalProperty(workOrder.property),
      })),
    });
  } catch (error) { next(error); }
});

vendorPortalRouter.get('/work-orders/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = accessQuery.parse(req.query);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const workOrder = await prisma.pmsWorkOrder.findFirst({
      where: { id, companyId: access.companyId, vendorId: access.vendorId },
      select: {
        id: true, title: true, description: true, priority: true, status: true, approvedQuoteId: true, scheduledFor: true, targetDate: true, resolvedAt: true,
        beforeImageUrls: true, afterImageUrls: true, notes: true,
        property: { select: { id: true, name: true, addressLine: true } }, unit: { select: { id: true, unitNumber: true } }, asset: { select: { id: true, assetCode: true, name: true, manufacturer: true, model: true, serialNumber: true, warrantyExpiry: true } },
        quotes: { where: { vendorId: access.vendorId }, orderBy: { createdAt: 'desc' } },
        pmsDocuments: { where: vendorVisibleWorkOrderDocumentsWhere(), select: { id: true, title: true, type: true, mimeType: true, originalFilename: true, sizeBytes: true, notes: true, createdAt: true } },
      },
    });
    if (!workOrder) throw new AppError(404, 'Assigned vendor work order not found.');
    const history = await prisma.domainAuditEvent.findMany({ where: { companyId: access.companyId, domain: DomainAuditDomain.PMS, OR: [{ entityId: id }, { metadata: { path: ['workOrderId'], equals: id } }] }, select: { id: true, action: true, origin: true, metadata: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({
      workOrder: { ...workOrder, property: serializePortalProperty(workOrder.property) },
      history,
    });
  } catch (error) { next(error); }
});

vendorPortalRouter.post('/work-orders/:id/quotes', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = quoteSchema.parse(req.body);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: data.accessId });
    const workOrder = await prisma.pmsWorkOrder.findFirst({ where: { id, companyId: access.companyId, vendorId: access.vendorId } });
    if (!workOrder) throw new AppError(404, 'Assigned vendor work order not found.');
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(workOrder.status)) throw new AppError(409, 'This work order no longer accepts quotes.');
    const quote = await prisma.pmsMaintenanceQuote.create({ data: { companyId: access.companyId, workOrderId: id, vendorId: access.vendorId, amount: money(data.amount), currency: data.currency, description: data.description ?? null, notes: data.notes ?? null, status: 'SUBMITTED', submittedAt: new Date(), createdById: req.user!.id, updatedById: req.user!.id } });
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsMaintenanceQuote', entityId: quote.id, action: 'PMS_VENDOR_QUOTE_SUBMITTED', actorId: req.user!.id, afterMetadata: { workOrderId: id, vendorId: access.vendorId, amount: quote.amount.toString(), currency: quote.currency }, ...requestAuditContext(req) });
    res.status(201).json({ quote });
  } catch (error) { next(error); }
});

vendorPortalRouter.post('/work-orders/:id/progress', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = updateSchema.parse(req.body);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: data.accessId });
    const current = await prisma.pmsWorkOrder.findFirst({ where: { id, companyId: access.companyId, vendorId: access.vendorId } });
    if (!current) throw new AppError(404, 'Assigned vendor work order not found.');
    const transitions = {
      SCHEDULE: { allowed: ['OPEN', 'IN_PROGRESS', 'COMPLETION_REQUESTED'], status: current.status },
      START: { allowed: ['OPEN'], status: 'IN_PROGRESS' },
      REQUEST_COMPLETION: { allowed: ['IN_PROGRESS'], status: 'COMPLETION_REQUESTED' },
    } as const;
    const transition = transitions[data.action];
    if (!(transition.allowed as readonly string[]).includes(current.status)) throw new AppError(409, `Cannot ${data.action.toLowerCase()} a ${current.status} work order.`);
    if (data.action === 'SCHEDULE' && !data.scheduledFor) throw new AppError(400, 'Scheduling requires a date and time.');
    const updated = await prisma.pmsWorkOrder.update({ where: { id }, data: { status: transition.status, ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}), ...(data.targetDate !== undefined ? { targetDate: data.targetDate } : {}), notes: [current.notes, `Vendor update: ${data.comment}`].filter(Boolean).join('\n\n'), updatedById: req.user!.id } });
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsWorkOrder', entityId: id, action: `PMS_VENDOR_WORK_ORDER_${data.action}`, actorId: req.user!.id, changedFields: ['status', 'scheduledFor', 'targetDate'], metadata: { vendorId: access.vendorId, comment: data.comment, fromStatus: current.status, toStatus: updated.status }, ...requestAuditContext(req) });
    res.json({ workOrder: updated });
  } catch (error) { next(error); }
});


vendorPortalRouter.get('/invoices', requireAuth(), async (req, res, next) => {
  try {
    const query = accessQuery.parse(req.query);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const invoices = await prisma.pmsVendorInvoice.findMany({
      where: { companyId: access.companyId, vendorId: access.vendorId, status: { not: 'VOID' } },
      select: {
        id: true, invoiceNumber: true, externalInvoiceNumber: true, status: true, issueDate: true, dueDate: true,
        currency: true, subtotalAmount: true, taxAmount: true, totalAmount: true, approvedAmount: true, paidAmount: true,
        submittedAt: true, approvedAt: true, processingAt: true, paidAt: true, failureReason: true, paymentReference: true,
        property: { select: { id: true, name: true, addressLine: true } },
        workOrder: { select: { id: true, title: true, status: true } },
        approvedQuote: { select: { id: true, amount: true, currency: true } },
        documents: { where: { status: { not: 'ARCHIVED' }, type: 'MAINTENANCE_INVOICE' }, select: { id: true, title: true, type: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ invoices: invoices.map((invoice) => ({
      ...invoice,
      subtotalAmount: invoice.subtotalAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      approvedAmount: invoice.approvedAmount?.toString() ?? null,
      paidAmount: invoice.paidAmount.toString(),
      approvedQuote: invoice.approvedQuote ? { ...invoice.approvedQuote, amount: invoice.approvedQuote.amount.toString() } : null,
      property: serializePortalProperty(invoice.property),
    })) });
  } catch (error) { next(error); }
});

vendorPortalRouter.post('/work-orders/:id/invoices', requireAuth(), uploadMiddleware, async (req, res, next) => {
  let storedKey: string | null = null;
  try {
    const { id } = idParams.parse(req.params);
    const data = invoiceUploadSchema.parse(req.body);
    if (!req.file) throw new AppError(400, 'A vendor invoice file is required.');
    if (data.dueDate < data.issueDate) throw new AppError(400, 'Invoice due date cannot be before its issue date.');
    const subtotal = money(data.subtotalAmount);
    const tax = money(data.taxAmount);
    const total = money(data.totalAmount);
    if (!subtotal.plus(tax).equals(total)) throw new AppError(400, 'Invoice total must equal subtotal plus tax.');
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: data.accessId });
    const workOrder = await prisma.pmsWorkOrder.findFirst({
      where: { id, companyId: access.companyId, vendorId: access.vendorId, status: { not: 'CANCELLED' } },
      select: { id: true, propertyId: true, unitId: true, approvedQuoteId: true },
    });
    if (!workOrder) throw new AppError(404, 'Assigned vendor work order not found.');
    if (!workOrder.approvedQuoteId) throw new AppError(409, 'An approved quote is required before submitting a vendor invoice.');
    const quote = await prisma.pmsMaintenanceQuote.findFirst({
      where: { id: workOrder.approvedQuoteId, companyId: access.companyId, workOrderId: id, vendorId: access.vendorId, status: 'APPROVED' },
      select: { id: true, amount: true, currency: true },
    });
    if (!quote) throw new AppError(409, 'The work order approved quote is no longer valid.');
    if (quote.currency !== data.currency) throw new AppError(400, 'Invoice and approved quote currencies must match.');
    if (total.greaterThan(quote.amount)) throw new AppError(409, 'Invoice total cannot exceed the approved quote amount.');

    const stored = await storePrivatePmsDocument({ companyId: access.companyId, file: req.file });
    storedKey = stored.storageKey;
    const now = new Date();
    const invoice = await prisma.$transaction(async (tx) => {
      const currentWorkOrder = await tx.pmsWorkOrder.findFirst({
        where: { id, companyId: access.companyId, vendorId: access.vendorId, status: { not: 'CANCELLED' } },
        select: { id: true, propertyId: true, unitId: true, approvedQuoteId: true },
      });
      if (!currentWorkOrder?.approvedQuoteId) throw new AppError(409, 'The work order approved quote changed. Reload and retry.');
      const currentQuote = await tx.pmsMaintenanceQuote.findFirst({
        where: { id: currentWorkOrder.approvedQuoteId, companyId: access.companyId, workOrderId: id, vendorId: access.vendorId, status: 'APPROVED' },
        select: { id: true, amount: true, currency: true },
      });
      if (!currentQuote || currentQuote.currency !== data.currency || total.greaterThan(currentQuote.amount)) {
        throw new AppError(409, 'The work order approved quote changed. Reload and retry.');
      }
      const created = await tx.pmsVendorInvoice.create({
        data: {
          companyId: access.companyId,
          propertyId: currentWorkOrder.propertyId,
          vendorId: access.vendorId,
          workOrderId: id,
          approvedQuoteId: currentQuote.id,
          invoiceNumber: data.invoiceNumber,
          externalInvoiceNumber: data.externalInvoiceNumber ?? null,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          currency: data.currency,
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          notes: data.notes ?? null,
          createdById: req.user!.id,
        },
      });
      const document = await tx.pmsDocument.create({
        data: {
          companyId: access.companyId,
          propertyId: currentWorkOrder.propertyId,
          unitId: currentWorkOrder.unitId,
          workOrderId: id,
          vendorInvoiceId: created.id,
          type: 'MAINTENANCE_INVOICE',
          title: `Vendor invoice ${data.invoiceNumber}`,
          fileUrl: `private://${stored.storageKey}`,
          storageDriver: 'LOCAL_PRIVATE',
          storageKey: stored.storageKey,
          originalFilename: stored.originalFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
          scanStatus: 'NOT_CONFIGURED',
          fileUploadedAt: now,
          notes: data.notes ?? null,
          uploadedById: req.user!.id,
          updatedById: req.user!.id,
        },
      });
      const submitted = await tx.pmsVendorInvoice.update({
        where: { id: created.id },
        data: { status: 'SUBMITTED', submittedAt: now, submittedById: req.user!.id },
      });
      await recordDomainAuditEvent(tx, {
        companyId: access.companyId,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsVendorInvoice',
        entityId: submitted.id,
        action: 'PMS_VENDOR_INVOICE_SUBMITTED',
        actorId: req.user!.id,
        changedFields: ['status'],
        beforeMetadata: { status: 'DRAFT' },
        afterMetadata: { status: submitted.status, workOrderId: id, vendorId: access.vendorId, propertyId: currentWorkOrder.propertyId, invoiceNumber: data.invoiceNumber, totalAmount: total.toString(), currency: data.currency, documentId: document.id },
        ...requestAuditContext(req),
      });
      return submitted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    storedKey = null;
    res.status(201).json({ invoice: { ...invoice, subtotalAmount: invoice.subtotalAmount.toString(), taxAmount: invoice.taxAmount.toString(), totalAmount: invoice.totalAmount.toString(), approvedAmount: null, paidAmount: invoice.paidAmount.toString() } });
  } catch (error) {
    if (storedKey) await removePrivatePmsDocument(storedKey).catch(() => undefined);
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (code === 'P2034') return next(new AppError(409, 'The approved quote changed concurrently. Reload and retry.'));
      if (code === 'P2002') return next(new AppError(409, 'This invoice number has already been submitted for the vendor.'));
    }
    next(error);
  }
});

vendorPortalRouter.post('/work-orders/:id/files', requireAuth(), uploadMiddleware, async (req, res, next) => {
  let storedKey: string | null = null;
  try {
    const { id } = idParams.parse(req.params);
    const data = uploadFieldsSchema.parse(req.body);
    if (!req.file) throw new AppError(400, 'A vendor file is required.');
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: data.accessId });
    const workOrder = await prisma.pmsWorkOrder.findFirst({ where: { id, companyId: access.companyId, vendorId: access.vendorId }, select: { id: true, propertyId: true, unitId: true } });
    if (!workOrder) throw new AppError(404, 'Assigned vendor work order not found.');
    const stored = await storePrivatePmsDocument({ companyId: access.companyId, file: req.file });
    storedKey = stored.storageKey;
    const type = data.kind === 'INVOICE' ? 'MAINTENANCE_INVOICE' : 'OTHER';
    const document = await prisma.pmsDocument.create({ data: { companyId: access.companyId, propertyId: workOrder.propertyId, unitId: workOrder.unitId, workOrderId: id, type, title: data.title, fileUrl: `private://${stored.storageKey}`, storageDriver: 'LOCAL_PRIVATE', storageKey: stored.storageKey, originalFilename: stored.originalFilename, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, checksumSha256: stored.checksumSha256, scanStatus: 'NOT_CONFIGURED', fileUploadedAt: new Date(), notes: [`vendor-kind:${data.kind}`, data.notes].filter(Boolean).join('\n'), uploadedById: req.user!.id, updatedById: req.user!.id } });
    storedKey = null;
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsDocument', entityId: document.id, action: 'PMS_VENDOR_PRIVATE_FILE_UPLOADED', actorId: req.user!.id, afterMetadata: { workOrderId: id, vendorId: access.vendorId, kind: data.kind, type }, ...requestAuditContext(req) });
    res.status(201).json({ document: { id: document.id, title: document.title, type: document.type, mimeType: document.mimeType, originalFilename: document.originalFilename, sizeBytes: document.sizeBytes, notes: document.notes, createdAt: document.createdAt } });
  } catch (error) {
    if (storedKey) await removePrivatePmsDocument(storedKey).catch(() => undefined);
    next(error);
  }
});

vendorPortalRouter.get('/documents/:id/download', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = accessQuery.parse(req.query);
    const access = await resolveVendorPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const document = await prisma.pmsDocument.findFirst({ where: { id, companyId: access.companyId, ...vendorVisibleWorkOrderDocumentsWhere(), workOrder: { vendorId: access.vendorId } }, select: { id: true, title: true, storageDriver: true, storageKey: true, originalFilename: true, mimeType: true, scanStatus: true, type: true, workOrderId: true } });
    if (!document) throw new AppError(404, 'Vendor portal document not found.');
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsDocument', entityId: document.id, action: 'PMS_VENDOR_PORTAL_DOCUMENT_DOWNLOADED', actorId: req.user!.id, metadata: { workOrderId: document.workOrderId, vendorId: access.vendorId, type: document.type }, ...requestAuditContext(req) });
    await sendPrivatePmsDocument(res, document);
  } catch (error) { next(error); }
});
