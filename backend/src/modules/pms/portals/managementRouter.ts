import { DomainAuditDomain } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import { assertCanManagePmsStaff } from '../access';
import { assertPmsPropertyScope, requirePmsRouteAccess } from '../shared/routeAccess';

export const pmsPortalAccessRouter = Router();

const ownerSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  active: z.boolean().default(true),
  canApproveQuotes: z.boolean().default(false),
  canViewMaintenanceCosts: z.boolean().default(true),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const vendorSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  active: z.boolean().default(true),
});
const companyQuery = z.object({ companyId: z.string().trim().min(1).optional() });

pmsPortalAccessRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanManagePmsStaff(access.member);
    const [owners, vendors] = await Promise.all([
      prisma.pmsOwnerPortalAccess.findMany({ where: { companyId: access.company.id }, include: { property: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.pmsVendorPortalAccess.findMany({ where: { companyId: access.company.id }, include: { vendor: { select: { id: true, name: true, trade: true } }, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ ownerAccesses: owners, vendorAccesses: vendors });
  } catch (error) { next(error); }
});

pmsPortalAccessRouter.post('/owners', requireAuth(), async (req, res, next) => {
  try {
    const data = ownerSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsStaff(access.member);
    assertPmsPropertyScope(access, data.propertyId);
    const [property, user] = await Promise.all([
      prisma.pmsProperty.findFirst({ where: { id: data.propertyId, companyId: access.company.id } }),
      prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, role: true, deactivatedAt: true, suspendedAt: true } }),
    ]);
    if (!property) throw new AppError(404, 'Property not found.');
    if (!user || user.deactivatedAt || user.suspendedAt) throw new AppError(400, 'Owner portal user is unavailable.');
    const portalAccess = await prisma.pmsOwnerPortalAccess.upsert({
      where: { propertyId_userId: { propertyId: data.propertyId, userId: data.userId } },
      update: { active: data.active, canApproveQuotes: data.canApproveQuotes, canViewMaintenanceCosts: data.canViewMaintenanceCosts, notes: data.notes ?? null },
      create: { companyId: access.company.id, propertyId: data.propertyId, userId: data.userId, active: data.active, canApproveQuotes: data.canApproveQuotes, canViewMaintenanceCosts: data.canViewMaintenanceCosts, notes: data.notes ?? null, createdById: req.user!.id },
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsOwnerPortalAccess', entityId: portalAccess.id, action: 'PMS_OWNER_PORTAL_ACCESS_UPSERTED', actorId: req.user!.id, afterMetadata: { propertyId: data.propertyId, userId: data.userId, active: data.active, canApproveQuotes: data.canApproveQuotes }, ...requestAuditContext(req) });
    res.status(201).json({ access: portalAccess });
  } catch (error) { next(error); }
});

pmsPortalAccessRouter.post('/vendors', requireAuth(), async (req, res, next) => {
  try {
    const data = vendorSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsStaff(access.member);
    const [vendor, user] = await Promise.all([
      prisma.pmsVendor.findFirst({ where: { id: data.vendorId, companyId: access.company.id, active: true } }),
      prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, deactivatedAt: true, suspendedAt: true } }),
    ]);
    if (!vendor) throw new AppError(404, 'Vendor not found.');
    if (!user || user.deactivatedAt || user.suspendedAt) throw new AppError(400, 'Vendor portal user is unavailable.');
    const portalAccess = await prisma.pmsVendorPortalAccess.upsert({
      where: { vendorId_userId: { vendorId: data.vendorId, userId: data.userId } },
      update: { active: data.active },
      create: { companyId: access.company.id, vendorId: data.vendorId, userId: data.userId, active: data.active, createdById: req.user!.id },
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsVendorPortalAccess', entityId: portalAccess.id, action: 'PMS_VENDOR_PORTAL_ACCESS_UPSERTED', actorId: req.user!.id, afterMetadata: { vendorId: data.vendorId, userId: data.userId, active: data.active }, ...requestAuditContext(req) });
    res.status(201).json({ access: portalAccess });
  } catch (error) { next(error); }
});
