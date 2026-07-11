import { DomainAuditDomain } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import { assertCanManagePmsMaintenance, assertCanViewPmsMaintenance } from '../access';
import { assertPmsPropertyScope, assertPmsScopeLinks, propertyScopeWhere, requirePmsRouteAccess } from '../shared/routeAccess';
import { money } from '../finance/money';
import { generateDuePreventiveWorkOrders } from './preventive';

export const pmsPreventiveMaintenanceRouter = Router();

const idParams = z.object({ id: z.string().trim().min(1) });
const querySchema = z.object({ companyId: z.string().trim().min(1).optional(), propertyId: z.string().trim().min(1).optional(), status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional() });
const planSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  unitId: z.string().trim().min(1).nullable().optional(),
  assetId: z.string().trim().min(1).nullable().optional(),
  vendorId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(250),
  description: z.string().trim().max(3000).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  intervalDays: z.coerce.number().int().positive().max(3650).nullable().optional(),
  nextServiceDate: z.coerce.date(),
  checklist: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  slaHours: z.coerce.number().int().positive().max(100000).nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  estimatedCost: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default('OMR'),
});

pmsPreventiveMaintenanceRouter.get('/plans', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsMaintenance(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const plans = await prisma.pmsMaintenancePlan.findMany({ where: { companyId: access.company.id, ...propertyScopeWhere(access), ...(query.propertyId ? { propertyId: query.propertyId } : {}), ...(query.status ? { status: query.status } : {}) }, include: { property: { select: { id: true, name: true } }, unit: { select: { id: true, unitNumber: true } }, asset: { select: { id: true, assetCode: true, name: true } }, vendor: { select: { id: true, name: true } }, workOrders: { orderBy: { createdAt: 'desc' }, take: 10 } }, orderBy: [{ nextServiceDate: 'asc' }, { title: 'asc' }] });
    res.json({ plans });
  } catch (error) { next(error); }
});

pmsPreventiveMaintenanceRouter.post('/plans', requireAuth(), async (req, res, next) => {
  try {
    const data = planSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    await assertPmsScopeLinks({ access, propertyId: data.propertyId, unitId: data.unitId });
    if (data.assetId) {
      const asset = await prisma.pmsAsset.findFirst({ where: { id: data.assetId, companyId: access.company.id, propertyId: data.propertyId } });
      if (!asset) throw new AppError(400, 'Asset must belong to the selected property.');
    }
    if (data.vendorId) {
      const vendor = await prisma.pmsVendor.findFirst({ where: { id: data.vendorId, companyId: access.company.id, active: true } });
      if (!vendor) throw new AppError(400, 'Vendor is not active in this company.');
    }
    const plan = await prisma.pmsMaintenancePlan.create({ data: { companyId: access.company.id, propertyId: data.propertyId, unitId: data.unitId ?? null, assetId: data.assetId ?? null, vendorId: data.vendorId ?? null, title: data.title, description: data.description ?? null, status: data.status, intervalDays: data.intervalDays ?? null, nextServiceDate: data.nextServiceDate, checklist: data.checklist, slaHours: data.slaHours ?? null, priority: data.priority, estimatedCost: data.estimatedCost == null ? null : money(data.estimatedCost), currency: data.currency, createdById: req.user!.id, updatedById: req.user!.id } });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsMaintenancePlan', entityId: plan.id, action: 'PMS_MAINTENANCE_PLAN_CREATED', actorId: req.user!.id, afterMetadata: { propertyId: plan.propertyId, assetId: plan.assetId, nextServiceDate: plan.nextServiceDate, intervalDays: plan.intervalDays }, ...requestAuditContext(req) });
    res.status(201).json({ plan });
  } catch (error) { next(error); }
});

pmsPreventiveMaintenanceRouter.patch('/plans/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = planSchema.partial().parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    const current = await prisma.pmsMaintenancePlan.findFirst({ where: { id, companyId: access.company.id } });
    if (!current) throw new AppError(404, 'Maintenance plan not found.');
    const propertyId = data.propertyId ?? current.propertyId;
    assertPmsPropertyScope(access, propertyId);
    const plan = await prisma.pmsMaintenancePlan.update({ where: { id }, data: { ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}), ...(data.unitId !== undefined ? { unitId: data.unitId } : {}), ...(data.assetId !== undefined ? { assetId: data.assetId } : {}), ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}), ...(data.title !== undefined ? { title: data.title } : {}), ...(data.description !== undefined ? { description: data.description } : {}), ...(data.status !== undefined ? { status: data.status } : {}), ...(data.intervalDays !== undefined ? { intervalDays: data.intervalDays } : {}), ...(data.nextServiceDate !== undefined ? { nextServiceDate: data.nextServiceDate } : {}), ...(data.checklist !== undefined ? { checklist: data.checklist } : {}), ...(data.slaHours !== undefined ? { slaHours: data.slaHours } : {}), ...(data.priority !== undefined ? { priority: data.priority } : {}), ...(data.estimatedCost !== undefined ? { estimatedCost: data.estimatedCost == null ? null : money(data.estimatedCost) } : {}), ...(data.currency !== undefined ? { currency: data.currency } : {}), updatedById: req.user!.id } });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsMaintenancePlan', entityId: id, action: 'PMS_MAINTENANCE_PLAN_UPDATED', actorId: req.user!.id, beforeMetadata: current, afterMetadata: plan, ...requestAuditContext(req) });
    res.json({ plan });
  } catch (error) { next(error); }
});

pmsPreventiveMaintenanceRouter.post('/generate-due', requireAuth(), async (req, res, next) => {
  try {
    const data = z.object({ companyId: z.string().trim().min(1).optional(), asOf: z.coerce.date().optional() }).parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Generating preventive work orders requires all-property maintenance access.');
    const generated = await generateDuePreventiveWorkOrders({ companyId: access.company.id, asOf: data.asOf, actorId: req.user!.id });
    res.json({ generated });
  } catch (error) { next(error); }
});
