import { DomainAuditDomain, Prisma } from '@prisma/client';
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
const queryBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return value;
}, z.boolean());
const querySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  dueOnly: queryBoolean.optional(),
  dueBefore: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(['nextServiceDate', 'title', 'status', 'priority', 'updatedAt', 'createdAt']).default('nextServiceDate'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
});
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
const planInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  asset: { select: { id: true, assetCode: true, name: true, propertyId: true, unitId: true } },
  vendor: { select: { id: true, name: true, trade: true, active: true } },
  workOrders: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      targetDate: true,
      scheduledFor: true,
      resolvedAt: true,
      cost: true,
      currency: true,
      preventiveGenerationKey: true,
      createdAt: true,
    },
  },
  _count: { select: { workOrders: true } },
} satisfies Prisma.PmsMaintenancePlanInclude;

function planOrderBy(query: z.infer<typeof querySchema>): Prisma.PmsMaintenancePlanOrderByWithRelationInput[] {
  const direction = query.direction;
  switch (query.sortBy) {
    case 'title':
      return [{ title: direction }, { nextServiceDate: 'asc' }];
    case 'status':
      return [{ status: direction }, { nextServiceDate: 'asc' }, { title: 'asc' }];
    case 'priority':
      return [{ priority: direction }, { nextServiceDate: 'asc' }, { title: 'asc' }];
    case 'updatedAt':
      return [{ updatedAt: direction }, { title: 'asc' }];
    case 'createdAt':
      return [{ createdAt: direction }, { title: 'asc' }];
    case 'nextServiceDate':
    default:
      return [{ nextServiceDate: direction }, { title: 'asc' }];
  }
}

async function validatePlanLinks(input: {
  companyId: string;
  propertyId: string;
  unitId?: string | null;
  assetId?: string | null;
  vendorId?: string | null;
  access: Awaited<ReturnType<typeof requirePmsRouteAccess>>;
}) {
  await assertPmsScopeLinks({ access: input.access, propertyId: input.propertyId, unitId: input.unitId });
  if (input.assetId) {
    const asset = await prisma.pmsAsset.findFirst({
      where: { id: input.assetId, companyId: input.companyId, propertyId: input.propertyId },
      select: { id: true, unitId: true },
    });
    if (!asset) throw new AppError(400, 'Asset must belong to the selected property.');
    if (input.unitId && asset.unitId && asset.unitId !== input.unitId) {
      throw new AppError(400, 'Asset and unit do not match.');
    }
  }
  if (input.vendorId) {
    const vendor = await prisma.pmsVendor.findFirst({
      where: { id: input.vendorId, companyId: input.companyId, active: true },
      select: { id: true },
    });
    if (!vendor) throw new AppError(400, 'Vendor is not active in this company.');
  }
}

pmsPreventiveMaintenanceRouter.get('/plans', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsMaintenance(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const search = query.search?.trim();
    const dueCutoff = query.dueBefore ?? (query.dueOnly ? new Date() : undefined);
    const where: Prisma.PmsMaintenancePlanWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dueCutoff ? { nextServiceDate: { lte: dueCutoff } } : {}),
      ...(search ? {
        AND: [{
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { property: { name: { contains: search, mode: 'insensitive' } } },
            { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
            { asset: { assetCode: { contains: search, mode: 'insensitive' } } },
            { asset: { name: { contains: search, mode: 'insensitive' } } },
            { vendor: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }],
      } : {}),
    };
    const [plans, total, activeTotal, dueTotal] = await prisma.$transaction([
      prisma.pmsMaintenancePlan.findMany({
        where,
        include: planInclude,
        orderBy: planOrderBy(query),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsMaintenancePlan.count({ where }),
      prisma.pmsMaintenancePlan.count({
        where: { companyId: access.company.id, ...propertyScopeWhere(access), status: 'ACTIVE' },
      }),
      prisma.pmsMaintenancePlan.count({
        where: { companyId: access.company.id, ...propertyScopeWhere(access), status: 'ACTIVE', nextServiceDate: { lte: new Date() } },
      }),
    ]);
    res.json({
      plans,
      pagination: { take: query.take, skip: query.skip, count: plans.length, total },
      summary: { active: activeTotal, due: dueTotal },
    });
  } catch (error) { next(error); }
});

pmsPreventiveMaintenanceRouter.post('/plans', requireAuth(), async (req, res, next) => {
  try {
    const data = planSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    await validatePlanLinks({
      access,
      companyId: access.company.id,
      propertyId: data.propertyId,
      unitId: data.unitId,
      assetId: data.assetId,
      vendorId: data.vendorId,
    });
    const plan = await prisma.pmsMaintenancePlan.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        assetId: data.assetId ?? null,
        vendorId: data.vendorId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        intervalDays: data.intervalDays ?? null,
        nextServiceDate: data.nextServiceDate,
        checklist: data.checklist,
        slaHours: data.slaHours ?? null,
        priority: data.priority,
        estimatedCost: data.estimatedCost == null ? null : money(data.estimatedCost),
        currency: data.currency,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
      include: planInclude,
    });
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
    const unitId = data.unitId === undefined ? current.unitId : data.unitId;
    const assetId = data.assetId === undefined ? current.assetId : data.assetId;
    const vendorId = data.vendorId === undefined ? current.vendorId : data.vendorId;
    await validatePlanLinks({ access, companyId: access.company.id, propertyId, unitId, assetId, vendorId });
    const plan = await prisma.pmsMaintenancePlan.update({
      where: { id },
      data: {
        ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
        ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.intervalDays !== undefined ? { intervalDays: data.intervalDays } : {}),
        ...(data.nextServiceDate !== undefined ? { nextServiceDate: data.nextServiceDate } : {}),
        ...(data.checklist !== undefined ? { checklist: data.checklist } : {}),
        ...(data.slaHours !== undefined ? { slaHours: data.slaHours } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.estimatedCost !== undefined ? { estimatedCost: data.estimatedCost == null ? null : money(data.estimatedCost) } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        updatedById: req.user!.id,
      },
      include: planInclude,
    });
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
