import { DomainAuditDomain, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import { assertCanManagePmsAccounting, assertCanViewPmsAccounting } from '../access';
import {
  assertPmsPropertyScope,
  propertyScopeWhere,
  requirePmsRouteAccess,
} from '../shared/routeAccess';
import { assertPositiveMoney, money } from './money';
import { assertFinancialPeriodOpen } from './periods';

export const pmsPayablesRouter = Router();

const idParams = z.object({ id: z.string().trim().min(1) });
const pagination = {
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
};
const listQuery = z.object({
  companyId: z.string().trim().min(1).optional(),
  ...pagination,
  search: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'NEEDS_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'VOID']).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  propertyId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'totalAmount', 'status', 'invoiceNumber']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
const invoiceSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  workOrderId: z.string().trim().min(1),
  approvedQuoteId: z.string().trim().min(1).nullable().optional(),
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
const transitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'SUBMIT_PAYMENT', 'RECORD_PAID', 'RECORD_FAILED', 'RETRY', 'VOID']),
  reason: z.string().trim().min(3).max(1000).optional(),
  approvedAmount: z.coerce.number().positive().max(1_000_000_000).optional(),
  evidenceDocumentId: z.string().trim().min(1).optional(),
  paymentReference: z.string().trim().min(1).max(300).optional(),
  paymentMethodNote: z.string().trim().min(3).max(500).optional(),
  providerConfirmed: z.boolean().optional(),
  adapter: z.enum(['MANUAL_BANK_EVIDENCE']).default('MANUAL_BANK_EVIDENCE'),
  paidAt: z.coerce.date().optional(),
});

const userSelect = { id: true, name: true, email: true } as const;
const invoiceInclude = {
  property: { select: { id: true, name: true, code: true } },
  vendor: { select: { id: true, name: true, trade: true, email: true } },
  workOrder: { select: { id: true, title: true, status: true, currency: true, cost: true, approvedQuoteId: true } },
  approvedQuote: { select: { id: true, amount: true, currency: true, status: true } },
  createdBy: { select: userSelect },
  submittedBy: { select: userSelect },
  reviewedBy: { select: userSelect },
  approvedBy: { select: userSelect },
  processingBy: { select: userSelect },
  paidBy: { select: userSelect },
  rejectedBy: { select: userSelect },
  voidedBy: { select: userSelect },
  documents: {
    where: { status: { not: 'ARCHIVED' as const } },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  ledgerEntry: {
    select: { id: true, type: true, source: true, amount: true, currency: true, transactionDate: true, referenceNumber: true },
  },
} satisfies Prisma.PmsVendorInvoiceInclude;

type InvoiceWithRelations = Prisma.PmsVendorInvoiceGetPayload<{ include: typeof invoiceInclude }>;

function invoiceResponse(invoice: InvoiceWithRelations) {
  return {
    ...invoice,
    subtotalAmount: invoice.subtotalAmount.toString(),
    taxAmount: invoice.taxAmount.toString(),
    totalAmount: invoice.totalAmount.toString(),
    approvedAmount: invoice.approvedAmount?.toString() ?? null,
    paidAmount: invoice.paidAmount.toString(),
    approvedQuote: invoice.approvedQuote
      ? { ...invoice.approvedQuote, amount: invoice.approvedQuote.amount.toString() }
      : null,
    workOrder: {
      ...invoice.workOrder,
      cost: invoice.workOrder.cost?.toString() ?? null,
    },
    ledgerEntries: invoice.ledgerEntry
      ? [{ ...invoice.ledgerEntry, amount: invoice.ledgerEntry.amount.toString() }]
      : [],
  };
}

function orderBy(
  sortBy: z.infer<typeof listQuery>['sortBy'],
  direction: z.infer<typeof listQuery>['direction'],
): Prisma.PmsVendorInvoiceOrderByWithRelationInput[] {
  if (sortBy === 'dueDate') return [{ dueDate: direction }, { createdAt: 'desc' }];
  if (sortBy === 'totalAmount') return [{ totalAmount: direction }, { createdAt: 'desc' }];
  if (sortBy === 'status') return [{ status: direction }, { createdAt: 'desc' }];
  if (sortBy === 'invoiceNumber') return [{ invoiceNumber: direction }];
  return [{ createdAt: direction }];
}

async function validateInvoiceLinks(input: {
  companyId: string;
  propertyId: string;
  vendorId: string;
  workOrderId: string;
  approvedQuoteId?: string | null;
  currency: string;
  totalAmount: Prisma.Decimal;
  client?: Prisma.TransactionClient;
}) {
  const client = input.client ?? prisma;
  const workOrder = await client.pmsWorkOrder.findFirst({
    where: {
      id: input.workOrderId,
      companyId: input.companyId,
      propertyId: input.propertyId,
      vendorId: input.vendorId,
      status: { not: 'CANCELLED' },
    },
    select: { id: true, approvedQuoteId: true, currency: true },
  });
  if (!workOrder) throw new AppError(400, 'Vendor invoice must reference an active work order assigned to this vendor and property.');

  if (!workOrder.approvedQuoteId) throw new AppError(409, 'An approved quote is required before creating a vendor invoice.');
  if (input.approvedQuoteId && input.approvedQuoteId !== workOrder.approvedQuoteId) {
    throw new AppError(409, 'Vendor invoice must use the work order current approved quote.');
  }
  const quoteId = workOrder.approvedQuoteId;
  const quote = await client.pmsMaintenanceQuote.findFirst({
    where: {
      id: quoteId,
      companyId: input.companyId,
      workOrderId: input.workOrderId,
      vendorId: input.vendorId,
      status: 'APPROVED',
    },
    select: { id: true, amount: true, currency: true },
  });
  if (!quote) throw new AppError(400, 'Approved quote must belong to this work order and vendor.');
  if (quote.currency !== input.currency) throw new AppError(400, 'Invoice and approved quote currencies must match.');
  if (input.totalAmount.greaterThan(quote.amount)) throw new AppError(409, 'Invoice total cannot exceed the approved quote amount.');
  return { workOrder, quote };
}

async function lockInvoice(tx: Prisma.TransactionClient, id: string, companyId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "PmsVendorInvoice" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`,
  );
  if (rows.length === 0) throw new AppError(404, 'Vendor invoice not found.');
  return tx.pmsVendorInvoice.findFirstOrThrow({ where: { id, companyId }, include: invoiceInclude });
}

async function requireInvoiceDocument(input: {
  tx: Prisma.TransactionClient;
  invoiceId: string;
  documentId?: string;
  purpose: string;
  minimumCreatedAt?: Date | null;
  evidenceType?: 'MAINTENANCE_INVOICE' | 'OTHER';
}) {
  const where: Prisma.PmsDocumentWhereInput = {
    vendorInvoiceId: input.invoiceId,
    status: { not: 'ARCHIVED' },
    scanStatus: { notIn: ['QUARANTINED', 'FAILED'] },
    ...(input.minimumCreatedAt ? { createdAt: { gte: input.minimumCreatedAt } } : {}),
    ...(input.evidenceType ? { type: input.evidenceType } : {}),
    ...(input.documentId ? { id: input.documentId } : {}),
  };
  const document = await input.tx.pmsDocument.findFirst({ where, select: { id: true, title: true, createdAt: true } });
  if (!document) {
    throw new AppError(409, `${input.purpose} requires active evidence linked to this vendor invoice at the correct workflow stage.`);
  }
  return document;
}

pmsPayablesRouter.get('/vendor-invoices', requireAuth(), async (req, res, next) => {
  try {
    const query = listQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const where: Prisma.PmsVendorInvoiceWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...((query.dueFrom || query.dueTo) ? { dueDate: { ...(query.dueFrom ? { gte: query.dueFrom } : {}), ...(query.dueTo ? { lte: query.dueTo } : {}) } } : {}),
      ...(query.search ? {
        OR: [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { externalInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { paymentReference: { contains: query.search, mode: 'insensitive' } },
          { vendor: { name: { contains: query.search, mode: 'insensitive' } } },
          { property: { name: { contains: query.search, mode: 'insensitive' } } },
          { workOrder: { title: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [invoices, total, totalsByStatus, totalsByCurrency, overdueCount, vendors, properties, workOrders] = await Promise.all([
      prisma.pmsVendorInvoice.findMany({ where, include: invoiceInclude, orderBy: orderBy(query.sortBy, query.direction), take: query.take, skip: query.skip }),
      prisma.pmsVendorInvoice.count({ where }),
      prisma.pmsVendorInvoice.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.pmsVendorInvoice.groupBy({ by: ['currency'], where, _count: { _all: true }, _sum: { totalAmount: true, approvedAmount: true, paidAmount: true } }),
      prisma.pmsVendorInvoice.count({
        where: { AND: [where, { dueDate: { lt: new Date() } }, { status: { notIn: ['PAID', 'VOID', 'REJECTED'] } }] },
      }),
      prisma.pmsVendor.findMany({
        where: {
          companyId: access.company.id,
          active: true,
          OR: [
            { workOrders: { some: { companyId: access.company.id, ...propertyScopeWhere(access) } } },
            { invoices: { some: { companyId: access.company.id, ...propertyScopeWhere(access) } } },
          ],
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.pmsProperty.findMany({
        where: {
          companyId: access.company.id,
          active: true,
          ...(access.member.propertyScope.allProperties
            ? {}
            : { id: { in: access.member.propertyScope.propertyIds } }),
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.pmsWorkOrder.findMany({
        where: {
          companyId: access.company.id,
          vendorId: { not: null },
          approvedQuoteId: { not: null },
          status: { not: 'CANCELLED' },
          ...propertyScopeWhere(access),
        },
        select: {
          id: true,
          title: true,
          status: true,
          propertyId: true,
          vendorId: true,
          currency: true,
          approvedQuoteId: true,
          property: { select: { id: true, name: true, code: true } },
          vendor: { select: { id: true, name: true } },
          quotes: {
            where: { status: 'APPROVED' },
            select: { id: true, amount: true, currency: true, status: true },
          },
        },
        orderBy: [{ property: { name: 'asc' } }, { title: 'asc' }],
      }),
    ]);
    res.json({
      invoices: invoices.map(invoiceResponse),
      pagination: { take: query.take, skip: query.skip, count: invoices.length, total },
      totalsByStatus: totalsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
      totalsByCurrency: totalsByCurrency.map((row) => ({
        currency: row.currency,
        count: row._count._all,
        totalAmount: row._sum.totalAmount?.toString() ?? '0',
        approvedAmount: row._sum.approvedAmount?.toString() ?? '0',
        paidAmount: row._sum.paidAmount?.toString() ?? '0',
      })),
      overdueCount,
      vendors,
      properties,
      workOrders: workOrders.flatMap(({ quotes, ...workOrder }) => {
        const approvedQuote = quotes.find((quote) => quote.id === workOrder.approvedQuoteId);
        if (!approvedQuote) return [];
        return [{
          ...workOrder,
          approvedQuote: { ...approvedQuote, amount: approvedQuote.amount.toString() },
        }];
      }),
    });
  } catch (error) { next(error); }
});

pmsPayablesRouter.get('/vendor-invoices/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = z.object({ companyId: z.string().trim().min(1).optional() }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const invoice = await prisma.pmsVendorInvoice.findFirst({ where: { id, companyId: access.company.id, ...propertyScopeWhere(access) }, include: invoiceInclude });
    if (!invoice) throw new AppError(404, 'Vendor invoice not found.');
    res.json({ invoice: invoiceResponse(invoice) });
  } catch (error) { next(error); }
});

pmsPayablesRouter.post('/vendor-invoices', requireAuth(), async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    assertPmsPropertyScope(access, data.propertyId);
    if (data.dueDate < data.issueDate) throw new AppError(400, 'Invoice due date cannot be before its issue date.');
    const subtotal = money(data.subtotalAmount);
    const tax = money(data.taxAmount);
    const total = money(data.totalAmount);
    assertPositiveMoney(total, 'Invoice total');
    if (!subtotal.plus(tax).equals(total)) throw new AppError(400, 'Invoice total must equal subtotal plus tax.');
    const invoice = await prisma.$transaction(async (tx) => {
      const links = await validateInvoiceLinks({ companyId: access.company.id, propertyId: data.propertyId, vendorId: data.vendorId, workOrderId: data.workOrderId, approvedQuoteId: data.approvedQuoteId, currency: data.currency, totalAmount: total, client: tx });
      const created = await tx.pmsVendorInvoice.create({
        data: {
          companyId: access.company.id,
          propertyId: data.propertyId,
          vendorId: data.vendorId,
          workOrderId: data.workOrderId,
          approvedQuoteId: links.quote.id,
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
        include: invoiceInclude,
      });
      await recordDomainAuditEvent(tx, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsVendorInvoice',
        entityId: created.id,
        action: 'PMS_VENDOR_INVOICE_CREATED',
        actorId: req.user!.id,
        afterMetadata: { propertyId: created.propertyId, vendorId: created.vendorId, workOrderId: created.workOrderId, totalAmount: created.totalAmount.toString(), currency: created.currency },
        ...requestAuditContext(req),
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(201).json({ invoice: invoiceResponse(invoice) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') return next(new AppError(409, 'The approved quote changed concurrently. Reload and retry.'));
      if (error.code === 'P2002') return next(new AppError(409, 'This vendor invoice number already exists for the selected vendor.'));
    }
    next(error);
  }
});


pmsPayablesRouter.patch('/vendor-invoices/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const partial = invoiceSchema.omit({ companyId: true }).partial().parse(req.body);
    if (Object.keys(partial).length === 0) throw new AppError(400, 'At least one vendor invoice field is required.');
    const companyId = z.object({ companyId: z.string().trim().min(1).optional() }).parse(req.body).companyId;
    const access = await requirePmsRouteAccess(req, companyId);
    assertCanManagePmsAccounting(access.member);
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await lockInvoice(tx, id, access.company.id);
      assertPmsPropertyScope(access, current.propertyId);
      if (current.status !== 'DRAFT') throw new AppError(409, 'Only draft vendor invoices can be edited.');
      const merged = invoiceSchema.parse({
        companyId: access.company.id,
        propertyId: partial.propertyId ?? current.propertyId,
        vendorId: partial.vendorId ?? current.vendorId,
        workOrderId: partial.workOrderId ?? current.workOrderId,
        approvedQuoteId: partial.approvedQuoteId === undefined ? current.approvedQuoteId : partial.approvedQuoteId,
        invoiceNumber: partial.invoiceNumber ?? current.invoiceNumber,
        externalInvoiceNumber: partial.externalInvoiceNumber === undefined ? current.externalInvoiceNumber : partial.externalInvoiceNumber,
        issueDate: partial.issueDate ?? current.issueDate,
        dueDate: partial.dueDate ?? current.dueDate,
        currency: partial.currency ?? current.currency,
        subtotalAmount: partial.subtotalAmount ?? current.subtotalAmount.toNumber(),
        taxAmount: partial.taxAmount ?? current.taxAmount.toNumber(),
        totalAmount: partial.totalAmount ?? current.totalAmount.toNumber(),
        notes: partial.notes === undefined ? current.notes : partial.notes,
      });
      assertPmsPropertyScope(access, merged.propertyId);
      if (merged.dueDate < merged.issueDate) throw new AppError(400, 'Invoice due date cannot be before its issue date.');
      const subtotal = money(merged.subtotalAmount);
      const tax = money(merged.taxAmount);
      const total = money(merged.totalAmount);
      if (!subtotal.plus(tax).equals(total)) throw new AppError(400, 'Invoice total must equal subtotal plus tax.');
      const links = await validateInvoiceLinks({ companyId: access.company.id, propertyId: merged.propertyId, vendorId: merged.vendorId, workOrderId: merged.workOrderId, approvedQuoteId: merged.approvedQuoteId, currency: merged.currency, totalAmount: total, client: tx });
      const updated = await tx.pmsVendorInvoice.update({
        where: { id },
        data: {
          propertyId: merged.propertyId,
          vendorId: merged.vendorId,
          workOrderId: merged.workOrderId,
          approvedQuoteId: links.quote?.id ?? null,
          invoiceNumber: merged.invoiceNumber,
          externalInvoiceNumber: merged.externalInvoiceNumber ?? null,
          issueDate: merged.issueDate,
          dueDate: merged.dueDate,
          currency: merged.currency,
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          notes: merged.notes ?? null,
        },
        include: invoiceInclude,
      });
      await recordDomainAuditEvent(tx, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsVendorInvoice',
        entityId: id,
        action: 'PMS_VENDOR_INVOICE_DRAFT_UPDATED',
        actorId: req.user!.id,
        beforeMetadata: { propertyId: current.propertyId, vendorId: current.vendorId, workOrderId: current.workOrderId, totalAmount: current.totalAmount.toString(), currency: current.currency },
        afterMetadata: { propertyId: updated.propertyId, vendorId: updated.vendorId, workOrderId: updated.workOrderId, totalAmount: updated.totalAmount.toString(), currency: updated.currency },
        ...requestAuditContext(req),
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ invoice: invoiceResponse(invoice) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') return next(new AppError(409, 'The vendor invoice changed concurrently. Reload and retry.'));
      if (error.code === 'P2002') return next(new AppError(409, 'This vendor invoice number already exists for the selected vendor.'));
    }
    next(error);
  }
});

pmsPayablesRouter.post('/vendor-invoices/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = transitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await lockInvoice(tx, id, access.company.id);
      assertPmsPropertyScope(access, current.propertyId);
      const now = new Date();
      const update: Prisma.PmsVendorInvoiceUncheckedUpdateInput = {};
      let evidenceDocumentId: string | null = null;

      if (data.action === 'SUBMIT') {
        if (current.status !== 'DRAFT') throw new AppError(409, `Cannot submit invoice from ${current.status}.`);
        await validateInvoiceLinks({ companyId: current.companyId, propertyId: current.propertyId, vendorId: current.vendorId, workOrderId: current.workOrderId, approvedQuoteId: current.approvedQuoteId, currency: current.currency, totalAmount: current.totalAmount, client: tx });
        const evidence = await requireInvoiceDocument({ tx, invoiceId: id, documentId: data.evidenceDocumentId, purpose: 'Invoice submission', evidenceType: 'MAINTENANCE_INVOICE' });
        evidenceDocumentId = evidence.id;
        Object.assign(update, { status: 'SUBMITTED', submittedAt: now, submittedById: req.user!.id });
      }
      if (data.action === 'REVIEW') {
        if (current.status !== 'SUBMITTED') throw new AppError(409, `Cannot review invoice from ${current.status}.`);
        Object.assign(update, { status: 'NEEDS_REVIEW', reviewedAt: now, reviewedById: req.user!.id });
      }
      if (data.action === 'APPROVE') {
        if (current.status !== 'NEEDS_REVIEW') throw new AppError(409, `Cannot approve invoice from ${current.status}.`);
        if (current.createdById === req.user!.id || current.submittedById === req.user!.id) {
          throw new AppError(409, 'The invoice creator or submitter cannot approve the same invoice.');
        }
        await validateInvoiceLinks({ companyId: current.companyId, propertyId: current.propertyId, vendorId: current.vendorId, workOrderId: current.workOrderId, approvedQuoteId: current.approvedQuoteId, currency: current.currency, totalAmount: current.totalAmount, client: tx });
        const approvalEvidence = await requireInvoiceDocument({ tx, invoiceId: id, documentId: data.evidenceDocumentId, purpose: 'Invoice approval', evidenceType: 'MAINTENANCE_INVOICE' });
        evidenceDocumentId = approvalEvidence.id;
        const approvedAmount = money(data.approvedAmount ?? current.totalAmount);
        assertPositiveMoney(approvedAmount, 'Approved invoice amount');
        if (approvedAmount.greaterThan(current.totalAmount)) throw new AppError(409, 'Approved amount cannot exceed the immutable invoice total.');
        if (current.approvedQuote && approvedAmount.greaterThan(current.approvedQuote.amount)) throw new AppError(409, 'Approved amount cannot exceed the approved maintenance quote.');
        Object.assign(update, { status: 'APPROVED', approvedAmount, approvedAt: now, approvedById: req.user!.id, failureReason: null });
      }
      if (data.action === 'REJECT') {
        if (!['SUBMITTED', 'NEEDS_REVIEW'].includes(current.status)) throw new AppError(409, `Cannot reject invoice from ${current.status}.`);
        if (!data.reason) throw new AppError(400, 'Invoice rejection requires a reason.');
        Object.assign(update, { status: 'REJECTED', rejectedAt: now, rejectedById: req.user!.id, failureReason: data.reason });
      }
      if (data.action === 'SUBMIT_PAYMENT') {
        if (current.status !== 'APPROVED') throw new AppError(409, `Cannot submit payment from ${current.status}.`);
        if (current.approvedById === req.user!.id) throw new AppError(409, 'The invoice approver cannot submit its payment.');
        if (!data.providerConfirmed || !data.paymentReference || !data.paymentMethodNote) {
          throw new AppError(400, 'Payment submission requires adapter confirmation, a payment reference, and an evidence note.');
        }
        const evidence = await requireInvoiceDocument({ tx, invoiceId: id, documentId: data.evidenceDocumentId, minimumCreatedAt: current.approvedAt, purpose: 'Vendor payment submission', evidenceType: 'OTHER' });
        evidenceDocumentId = evidence.id;
        Object.assign(update, { status: 'PROCESSING', processingAt: now, processingById: req.user!.id, paymentReference: data.paymentReference, paymentMethodNote: `[${data.adapter}] ${data.paymentMethodNote}`, failureReason: null });
      }
      if (data.action === 'RECORD_PAID') {
        if (current.status !== 'PROCESSING') throw new AppError(409, `Cannot record payment from ${current.status}.`);
        if (current.createdById === req.user!.id || current.submittedById === req.user!.id || current.processingById === req.user!.id) {
          throw new AppError(409, 'The invoice creator, submitter, or payment submitter cannot record the final paid result.');
        }
        if (!data.providerConfirmed || !data.paymentReference || !data.paymentMethodNote) {
          throw new AppError(400, 'Recording payment requires provider confirmation, the final payment reference, and an evidence note.');
        }
        const paidAt = data.paidAt ?? now;
        await assertFinancialPeriodOpen(tx, { companyId: current.companyId, propertyId: current.propertyId, currency: current.currency, transactionDate: paidAt });
        const evidence = await requireInvoiceDocument({ tx, invoiceId: id, documentId: data.evidenceDocumentId, minimumCreatedAt: current.processingAt, purpose: 'Paid vendor invoice result', evidenceType: 'OTHER' });
        evidenceDocumentId = evidence.id;
        const paidAmount = current.approvedAmount ?? current.totalAmount;
        await tx.pmsAccountingLedgerEntry.create({
          data: {
            companyId: current.companyId,
            propertyId: current.propertyId,
            workOrderId: current.workOrderId,
            vendorInvoiceId: current.id,
            type: 'EXPENSE',
            source: 'VENDOR_INVOICE',
            category: 'Vendor invoice payment',
            amount: paidAmount,
            currency: current.currency,
            transactionDate: paidAt,
            referenceNumber: data.paymentReference,
            notes: data.paymentMethodNote,
            createdById: req.user!.id,
            updatedById: req.user!.id,
          },
        });
        Object.assign(update, { status: 'PAID', paidAmount, paidAt, paidById: req.user!.id, paymentReference: data.paymentReference, paymentMethodNote: `[${data.adapter}] ${data.paymentMethodNote}`, failureReason: null });
      }
      if (data.action === 'RECORD_FAILED') {
        if (current.status !== 'PROCESSING') throw new AppError(409, `Cannot record failure from ${current.status}.`);
        if (!data.reason) throw new AppError(400, 'Payment failure requires a reason.');
        Object.assign(update, { status: 'FAILED', failedAt: now, failureReason: data.reason });
      }
      if (data.action === 'RETRY') {
        if (current.status !== 'FAILED') throw new AppError(409, `Cannot retry invoice from ${current.status}.`);
        if (!data.reason) throw new AppError(400, 'Retry requires a reason.');
        Object.assign(update, { status: 'APPROVED', approvedAt: now, processingAt: null, processingById: null, failedAt: null, paymentReference: null, paymentMethodNote: null, failureReason: null });
      }
      if (data.action === 'VOID') {
        if (!['DRAFT', 'REJECTED'].includes(current.status)) throw new AppError(409, `Cannot void invoice from ${current.status}.`);
        if (!data.reason) throw new AppError(400, 'Voiding an invoice requires a reason.');
        Object.assign(update, { status: 'VOID', voidedAt: now, voidedById: req.user!.id, failureReason: data.reason });
      }

      const updated = await tx.pmsVendorInvoice.update({ where: { id }, data: update, include: invoiceInclude });
      await recordDomainAuditEvent(tx, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsVendorInvoice',
        entityId: id,
        action: `PMS_VENDOR_INVOICE_${data.action}`,
        actorId: req.user!.id,
        changedFields: ['status'],
        beforeMetadata: { status: current.status },
        afterMetadata: { status: updated.status },
        metadata: { reason: data.reason ?? null, approvedAmount: data.approvedAmount ?? null, paymentReference: data.paymentReference ?? null, evidenceDocumentId, adapter: ['SUBMIT_PAYMENT', 'RECORD_PAID'].includes(data.action) ? data.adapter : null, providerConfirmed: data.providerConfirmed === true },
        ...requestAuditContext(req),
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ invoice: invoiceResponse(invoice) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') return next(new AppError(409, 'The vendor invoice changed concurrently. Reload and retry.'));
      if (error.code === 'P2002') return next(new AppError(409, 'This vendor invoice payment has already been posted.'));
    }
    next(error);
  }
});
