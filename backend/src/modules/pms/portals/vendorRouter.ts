import { DomainAuditDomain } from '@prisma/client';
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
        pmsDocuments: { where: { status: { not: 'ARCHIVED' }, type: { in: ['MAINTENANCE_INVOICE', 'INSPECTION_REPORT', 'OTHER'] } }, select: { id: true, title: true, type: true, mimeType: true, originalFilename: true, sizeBytes: true, notes: true, createdAt: true } },
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
        id: true, title: true, description: true, priority: true, status: true, scheduledFor: true, targetDate: true, resolvedAt: true,
        beforeImageUrls: true, afterImageUrls: true, notes: true,
        property: { select: { id: true, name: true, addressLine: true } }, unit: { select: { id: true, unitNumber: true } }, asset: { select: { id: true, assetCode: true, name: true, manufacturer: true, model: true, serialNumber: true, warrantyExpiry: true } },
        quotes: { where: { vendorId: access.vendorId }, orderBy: { createdAt: 'desc' } },
        pmsDocuments: { where: { status: { not: 'ARCHIVED' }, type: { in: ['MAINTENANCE_INVOICE', 'INSPECTION_REPORT', 'OTHER'] } }, select: { id: true, title: true, type: true, mimeType: true, originalFilename: true, sizeBytes: true, notes: true, createdAt: true } },
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
    const document = await prisma.pmsDocument.findFirst({ where: { id, companyId: access.companyId, status: { not: 'ARCHIVED' }, type: { in: ['MAINTENANCE_INVOICE', 'INSPECTION_REPORT', 'OTHER'] }, workOrder: { vendorId: access.vendorId } }, select: { id: true, title: true, storageDriver: true, storageKey: true, originalFilename: true, mimeType: true, scanStatus: true, type: true, workOrderId: true } });
    if (!document) throw new AppError(404, 'Vendor portal document not found.');
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsDocument', entityId: document.id, action: 'PMS_VENDOR_PORTAL_DOCUMENT_DOWNLOADED', actorId: req.user!.id, metadata: { workOrderId: document.workOrderId, vendorId: access.vendorId, type: document.type }, ...requestAuditContext(req) });
    await sendPrivatePmsDocument(res, document);
  } catch (error) { next(error); }
});
