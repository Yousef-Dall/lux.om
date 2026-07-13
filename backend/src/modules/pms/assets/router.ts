import { DomainAuditDomain, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import {
  assertCanManagePmsInventory,
  assertCanManagePmsMaintenance,
  assertCanViewPmsAssets,
  canManagePmsInventory,
} from '../access';
import { assertPmsPropertyScope, assertPmsScopeLinks, propertyScopeWhere, requirePmsRouteAccess } from '../shared/routeAccess';
import { money } from '../finance/money';

export const pmsAssetsRouter = Router();

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
  unitId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'OUT_OF_SERVICE', 'RETIRED', 'DISPOSED']).optional(),
  dueOnly: queryBoolean.optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'assetCode', 'name', 'status', 'warrantyExpiry', 'nextServiceDate']).default('nextServiceDate'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
});
const idParams = z.object({ id: z.string().trim().min(1) });

function assetOrderBy(query: z.infer<typeof querySchema>): Prisma.PmsAssetOrderByWithRelationInput[] {
  const direction = query.direction;
  switch (query.sortBy) {
    case 'assetCode':
      return [{ assetCode: direction }, { name: 'asc' }];
    case 'name':
      return [{ name: direction }, { assetCode: 'asc' }];
    case 'status':
      return [{ status: direction }, { name: 'asc' }];
    case 'warrantyExpiry':
      return [{ warrantyExpiry: { sort: direction, nulls: 'last' } }, { name: 'asc' }];
    case 'nextServiceDate':
      return [{ nextServiceDate: { sort: direction, nulls: 'last' } }, { name: 'asc' }];
    case 'createdAt':
      return [{ createdAt: direction }, { name: 'asc' }];
    case 'updatedAt':
    default:
      return [{ updatedAt: direction }, { name: 'asc' }];
  }
}
const assetSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  unitId: z.string().trim().min(1).nullable().optional(),
  assetCode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(250),
  category: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(200).nullable().optional(),
  model: z.string().trim().max(200).nullable().optional(),
  serialNumber: z.string().trim().max(200).nullable().optional(),
  installationDate: z.coerce.date().nullable().optional(),
  warrantyExpiry: z.coerce.date().nullable().optional(),
  serviceIntervalDays: z.coerce.number().int().positive().max(3650).nullable().optional(),
  nextServiceDate: z.coerce.date().nullable().optional(),
  status: z.enum(['ACTIVE', 'OUT_OF_SERVICE', 'RETIRED', 'DISPOSED']).default('ACTIVE'),
  vendorId: z.string().trim().min(1).nullable().optional(),
  purchaseCost: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default('OMR'),
  notes: z.string().trim().max(3000).nullable().optional(),
});
const assetInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  vendor: { select: { id: true, name: true } },
  events: { orderBy: { occurredAt: 'desc' as const }, take: 20 },
  _count: { select: { workOrders: true, documents: true, maintenancePlans: true } },
} satisfies Prisma.PmsAssetInclude;

const eventSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  type: z.enum(['UPDATED', 'SERVICED', 'REPAIRED', 'WARRANTY_CLAIM', 'RETIRED', 'DISPOSED']),
  occurredAt: z.coerce.date().default(() => new Date()),
  cost: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  nextServiceDate: z.coerce.date().nullable().optional(),
});

pmsAssetsRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAssets(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const now = new Date();
    const search = query.search?.trim();
    const where: Prisma.PmsAssetWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueOnly ? { OR: [{ warrantyExpiry: { lte: now } }, { nextServiceDate: { lte: now } }] } : {}),
      ...(search ? {
        AND: [{
          OR: [
            { assetCode: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
            { category: { contains: search, mode: 'insensitive' as const } },
            { manufacturer: { contains: search, mode: 'insensitive' as const } },
            { model: { contains: search, mode: 'insensitive' as const } },
            { serialNumber: { contains: search, mode: 'insensitive' as const } },
            { property: { name: { contains: search, mode: 'insensitive' as const } } },
            { unit: { unitNumber: { contains: search, mode: 'insensitive' as const } } },
            { vendor: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }],
      } : {}),
    };
    const orderBy = assetOrderBy(query);
    const [assets, total] = await prisma.$transaction([
      prisma.pmsAsset.findMany({
        where,
        include: assetInclude,
        orderBy,
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsAsset.count({ where }),
    ]);
    res.json({ assets, pagination: { take: query.take, skip: query.skip, count: assets.length, total } });
  } catch (error) { next(error); }
});

pmsAssetsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = assetSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsInventory(access.member);
    await assertPmsScopeLinks({ access, propertyId: data.propertyId, unitId: data.unitId });
    if (data.vendorId) {
      const vendor = await prisma.pmsVendor.findFirst({ where: { id: data.vendorId, companyId: access.company.id } });
      if (!vendor) throw new AppError(400, 'Vendor does not belong to this PMS company.');
    }
    const asset = await prisma.pmsAsset.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        assetCode: data.assetCode,
        name: data.name,
        category: data.category,
        manufacturer: data.manufacturer ?? null,
        model: data.model ?? null,
        serialNumber: data.serialNumber ?? null,
        installationDate: data.installationDate ?? null,
        warrantyExpiry: data.warrantyExpiry ?? null,
        serviceIntervalDays: data.serviceIntervalDays ?? null,
        nextServiceDate: data.nextServiceDate ?? null,
        status: data.status,
        vendorId: data.vendorId ?? null,
        purchaseCost: data.purchaseCost == null ? null : money(data.purchaseCost),
        currency: data.currency,
        notes: data.notes ?? null,
        createdById: req.user!.id,
        updatedById: req.user!.id,
        events: { create: { companyId: access.company.id, type: 'CREATED', createdById: req.user!.id, notes: 'Asset registered.' } },
      },
      include: assetInclude,
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsAsset', entityId: asset.id, action: 'PMS_ASSET_CREATED', actorId: req.user!.id, afterMetadata: { propertyId: asset.propertyId, unitId: asset.unitId, assetCode: asset.assetCode, category: asset.category }, ...requestAuditContext(req) });
    res.status(201).json({ asset });
  } catch (error) { next(error); }
});

pmsAssetsRouter.patch('/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = assetSchema.partial().parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsInventory(access.member);
    const current = await prisma.pmsAsset.findFirst({ where: { id, companyId: access.company.id } });
    if (!current) throw new AppError(404, 'Asset not found.');
    const propertyId = data.propertyId ?? current.propertyId;
    assertPmsPropertyScope(access, propertyId);
    await assertPmsScopeLinks({ access, propertyId, unitId: data.unitId === undefined ? current.unitId : data.unitId });
    if (data.vendorId) {
      const vendor = await prisma.pmsVendor.findFirst({ where: { id: data.vendorId, companyId: access.company.id, active: true } });
      if (!vendor) throw new AppError(400, 'Vendor does not belong to this PMS company or is inactive.');
    }
    const asset = await prisma.pmsAsset.update({
      where: { id },
      data: {
        ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
        ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
        ...(data.assetCode !== undefined ? { assetCode: data.assetCode } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}),
        ...(data.installationDate !== undefined ? { installationDate: data.installationDate } : {}),
        ...(data.warrantyExpiry !== undefined ? { warrantyExpiry: data.warrantyExpiry } : {}),
        ...(data.serviceIntervalDays !== undefined ? { serviceIntervalDays: data.serviceIntervalDays } : {}),
        ...(data.nextServiceDate !== undefined ? { nextServiceDate: data.nextServiceDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
        ...(data.purchaseCost !== undefined ? { purchaseCost: data.purchaseCost == null ? null : money(data.purchaseCost) } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        updatedById: req.user!.id,
        events: { create: { companyId: access.company.id, type: 'UPDATED', createdById: req.user!.id, notes: 'Asset details updated.' } },
      },
      include: assetInclude,
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsAsset', entityId: id, action: 'PMS_ASSET_UPDATED', actorId: req.user!.id, beforeMetadata: current, afterMetadata: asset, ...requestAuditContext(req) });
    res.json({ asset });
  } catch (error) { next(error); }
});

pmsAssetsRouter.post('/:id/events', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = eventSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    if (data.type === 'RETIRED' || data.type === 'DISPOSED') {
      assertCanManagePmsInventory(access.member);
    } else if (!canManagePmsInventory(access.member)) {
      assertCanManagePmsMaintenance(access.member);
    }
    const asset = await prisma.pmsAsset.findFirst({ where: { id, companyId: access.company.id } });
    if (!asset) throw new AppError(404, 'Asset not found.');
    assertPmsPropertyScope(access, asset.propertyId);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.pmsAssetEvent.create({ data: { companyId: access.company.id, assetId: id, type: data.type, occurredAt: data.occurredAt, cost: data.cost == null ? null : money(data.cost), currency: data.currency ?? (data.cost == null ? null : asset.currency), notes: data.notes ?? null, metadata: data.metadata as import('@prisma/client').Prisma.InputJsonValue | undefined, createdById: req.user!.id } });
      await tx.pmsAsset.update({ where: { id }, data: { ...(data.nextServiceDate !== undefined ? { nextServiceDate: data.nextServiceDate } : {}), ...(data.type === 'RETIRED' ? { status: 'RETIRED' } : {}), ...(data.type === 'DISPOSED' ? { status: 'DISPOSED' } : {}), updatedById: req.user!.id } });
      return created;
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsAssetEvent', entityId: event.id, action: `PMS_ASSET_${data.type}`, actorId: req.user!.id, afterMetadata: { assetId: id, cost: data.cost, currency: data.currency, nextServiceDate: data.nextServiceDate }, ...requestAuditContext(req) });
    res.status(201).json({ event });
  } catch (error) { next(error); }
});
