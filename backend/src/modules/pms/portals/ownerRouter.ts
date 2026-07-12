import { DomainAuditDomain, Prisma, type PmsOwnerStatement } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import { sendPrivatePmsDocument } from '../shared/privateDocument';
import { resolveOwnerPortalAccess, getUserOwnerPortalAccessSummary } from './access';

export const ownerPortalRouter = Router();

const accessQuery = z.object({ accessId: z.string().trim().min(1).optional() });
const idParams = z.object({ id: z.string().trim().min(1) });
const quoteDecisionSchema = z.object({
  accessId: z.string().trim().min(1).optional(),
  decision: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().trim().min(3).max(2000),
});
const OWNER_DOCUMENT_TYPES = ['LEASE_AGREEMENT', 'RENEWAL', 'MOVE_IN_REPORT', 'MOVE_OUT_REPORT', 'DEPOSIT_RECEIPT', 'INSPECTION_REPORT', 'MAINTENANCE_INVOICE', 'POLICY_NOTICE', 'OTHER'] as const;

type PublishedStatementSummary = Pick<
  PmsOwnerStatement,
  'currency' | 'income' | 'expenses' | 'adjustments' | 'closingBalance' | 'periodStart' | 'periodEnd'
>;

function summarizePublishedStatements(statements: PublishedStatementSummary[]) {
  const latestByCurrency = new Map<string, PublishedStatementSummary>();
  for (const statement of statements) {
    if (!latestByCurrency.has(statement.currency)) latestByCurrency.set(statement.currency, statement);
  }
  return [...latestByCurrency.values()].map((statement) => ({
    currency: statement.currency,
    income: statement.income.toString(),
    expenses: statement.expenses.toString(),
    adjustments: statement.adjustments.toString(),
    net: statement.closingBalance.toString(),
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
  }));
}

ownerPortalRouter.get('/access', requireAuth(), async (req, res, next) => {
  try {
    res.json(await getUserOwnerPortalAccessSummary(req.user!.id));
  } catch (error) { next(error); }
});

ownerPortalRouter.get('/overview', requireAuth(), async (req, res, next) => {
  try {
    const query = accessQuery.parse(req.query);
    const access = await resolveOwnerPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const now = new Date();
    const [unitCounts, activeLeases, statements, workOrders, payouts, quotes] = await Promise.all([
      prisma.pmsUnit.groupBy({ by: ['status'], where: { propertyId: access.propertyId }, _count: { _all: true } }),
      prisma.pmsLease.count({ where: { propertyId: access.propertyId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } } }),
      prisma.pmsOwnerStatement.findMany({ where: { companyId: access.companyId, propertyId: access.propertyId, status: 'PUBLISHED' }, select: { id: true, status: true, periodStart: true, periodEnd: true, currency: true, openingBalance: true, income: true, expenses: true, adjustments: true, closingBalance: true, publishedAt: true, revision: true, documents: { where: { status: { not: 'ARCHIVED' } }, select: { id: true, title: true, type: true, mimeType: true, originalFilename: true } } }, orderBy: { periodEnd: 'desc' }, take: 24 }),
      prisma.pmsWorkOrder.findMany({ where: { companyId: access.companyId, propertyId: access.propertyId }, select: { id: true, title: true, priority: true, status: true, cost: access.canViewMaintenanceCosts, currency: true, scheduledFor: true, targetDate: true, resolvedAt: true, asset: { select: { id: true, assetCode: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.pmsOwnerPayoutBatch.findMany({ where: { companyId: access.companyId, ownerUserId: req.user!.id, status: { in: ['APPROVED', 'PROCESSING', 'PAID_MANUAL', 'FAILED'] }, lines: { some: { propertyId: access.propertyId } } }, select: { id: true, payoutNumber: true, status: true, currency: true, grossAmount: true, managementFeeAmount: true, reservedAmount: true, payoutAmount: true, periodStart: true, periodEnd: true, payoutReference: true, paidAt: true, failureReason: true, lines: { where: { propertyId: access.propertyId }, select: { incomeAmount: true, expenseAmount: true, managementFeeAmount: true, reservedAmount: true, netAmount: true, statementId: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      access.canApproveQuotes ? prisma.pmsMaintenanceQuote.findMany({ where: { companyId: access.companyId, workOrder: { propertyId: access.propertyId }, status: 'SUBMITTED' }, select: { id: true, amount: true, currency: true, description: true, status: true, submittedAt: true, workOrder: { select: { id: true, title: true, priority: true, vendor: { select: { id: true, name: true, trade: true } } } } }, orderBy: { submittedAt: 'desc' } }) : Promise.resolve([]),
    ]);
    const totalUnits = unitCounts.reduce((sum, row) => sum + row._count._all, 0);
    const occupied = unitCounts.find((row) => row.status === 'OCCUPIED')?._count._all ?? activeLeases;
    const propertyPayouts = payouts.map((batch) => ({
      ...batch,
      grossAmount: batch.lines.reduce((sum, line) => sum.plus(line.incomeAmount), new Prisma.Decimal(0)),
      managementFeeAmount: batch.lines.reduce((sum, line) => sum.plus(line.managementFeeAmount), new Prisma.Decimal(0)),
      reservedAmount: batch.lines.reduce((sum, line) => sum.plus(line.reservedAmount), new Prisma.Decimal(0)),
      payoutAmount: batch.lines.reduce((sum, line) => sum.plus(line.netAmount), new Prisma.Decimal(0)),
    }));
    res.json({
      access: { id: access.id, company: access.company, property: access.property, canApproveQuotes: access.canApproveQuotes, canViewMaintenanceCosts: access.canViewMaintenanceCosts },
      occupancy: { totalUnits, occupiedUnits: occupied, vacantUnits: unitCounts.find((row) => row.status === 'VACANT')?._count._all ?? Math.max(totalUnits - occupied, 0), occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 1000) / 10 : 0 },
      financialSummaries: summarizePublishedStatements(statements),
      statements,
      maintenance: workOrders,
      payouts: propertyPayouts,
      quotesAwaitingApproval: quotes,
    });
  } catch (error) { next(error); }
});

ownerPortalRouter.get('/documents', requireAuth(), async (req, res, next) => {
  try {
    const query = accessQuery.parse(req.query);
    const access = await resolveOwnerPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const documents = await prisma.pmsDocument.findMany({ where: { companyId: access.companyId, propertyId: access.propertyId, status: { not: 'ARCHIVED' }, type: { in: [...OWNER_DOCUMENT_TYPES] }, OR: [{ tenantId: null }, { statement: { status: 'PUBLISHED' } }] }, select: { id: true, title: true, type: true, status: true, expiryDate: true, mimeType: true, originalFilename: true, sizeBytes: true, fileVersion: true, statementId: true, workOrderId: true, assetId: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    res.json({ documents });
  } catch (error) { next(error); }
});

ownerPortalRouter.get('/documents/:id/download', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = accessQuery.parse(req.query);
    const access = await resolveOwnerPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const document = await prisma.pmsDocument.findFirst({ where: { id, companyId: access.companyId, propertyId: access.propertyId, status: { not: 'ARCHIVED' }, type: { in: [...OWNER_DOCUMENT_TYPES] }, OR: [{ tenantId: null }, { statement: { status: 'PUBLISHED' } }] }, select: { id: true, title: true, storageDriver: true, storageKey: true, originalFilename: true, mimeType: true, scanStatus: true, type: true, statementId: true } });
    if (!document) throw new AppError(404, 'Owner portal document not found.');
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsDocument', entityId: document.id, action: 'PMS_OWNER_PORTAL_DOCUMENT_DOWNLOADED', actorId: req.user!.id, metadata: { propertyId: access.propertyId, type: document.type, statementId: document.statementId }, ...requestAuditContext(req) });
    await sendPrivatePmsDocument(res, document);
  } catch (error) { next(error); }
});

ownerPortalRouter.post('/quotes/:id/decision', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = quoteDecisionSchema.parse(req.body);
    const access = await resolveOwnerPortalAccess({ userId: req.user!.id, accessId: data.accessId });
    if (!access.canApproveQuotes) throw new AppError(403, 'Quote approval is not enabled for this owner access.');
    const quote = await prisma.pmsMaintenanceQuote.findFirst({ where: { id, companyId: access.companyId, status: 'SUBMITTED', workOrder: { propertyId: access.propertyId } }, include: { workOrder: true } });
    if (!quote) throw new AppError(404, 'Submitted quote not found for this property.');
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.pmsMaintenanceQuote.update({ where: { id }, data: data.decision === 'APPROVE' ? { status: 'APPROVED', approvedAt: now, approvedById: req.user!.id, notes: data.comment } : { status: 'REJECTED', rejectedAt: now, notes: data.comment, updatedById: req.user!.id } });
      if (data.decision === 'APPROVE') await tx.pmsWorkOrder.update({ where: { id: quote.workOrderId }, data: { approvedQuoteId: quote.id, cost: quote.amount, currency: quote.currency, updatedById: req.user!.id } });
      return result;
    });
    await recordDomainAuditEvent(prisma, { companyId: access.companyId, domain: DomainAuditDomain.PMS, entityType: 'PmsMaintenanceQuote', entityId: id, action: data.decision === 'APPROVE' ? 'PMS_OWNER_QUOTE_APPROVED' : 'PMS_OWNER_QUOTE_REJECTED', actorId: req.user!.id, metadata: { propertyId: access.propertyId, workOrderId: quote.workOrderId, comment: data.comment }, ...requestAuditContext(req) });
    res.json({ quote: updated });
  } catch (error) { next(error); }
});

ownerPortalRouter.get('/history', requireAuth(), async (req, res, next) => {
  try {
    const query = accessQuery.parse(req.query);
    const access = await resolveOwnerPortalAccess({ userId: req.user!.id, accessId: query.accessId });
    const events = await prisma.domainAuditEvent.findMany({ where: { companyId: access.companyId, domain: DomainAuditDomain.PMS, OR: [{ metadata: { path: ['propertyId'], equals: access.propertyId } }, { entityType: { in: ['PmsOwnerStatement', 'PmsOwnerPayoutBatch', 'PmsMaintenanceQuote'] } }] }, select: { id: true, entityType: true, entityId: true, action: true, origin: true, metadata: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ events });
  } catch (error) { next(error); }
});
