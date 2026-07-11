import { DomainAuditDomain } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { AppError } from '../../../utils/http';
import { assertCanManagePmsMaintenance, assertCanViewPmsMaintenance } from '../access';
import { assertPmsPropertyScope, assertPmsScopeLinks, propertyScopeWhere, requirePmsRouteAccess } from '../shared/routeAccess';

export const pmsStructuredInspectionsRouter = Router();

const idParams = z.object({ id: z.string().trim().min(1) });
const querySchema = z.object({ companyId: z.string().trim().min(1).optional(), propertyId: z.string().trim().min(1).optional() });
const templateSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(250),
  description: z.string().trim().max(3000).nullable().optional(),
  type: z.enum(['GENERAL', 'MOVE_IN', 'MOVE_OUT', 'PERIODIC', 'SAFETY']).default('GENERAL'),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(250),
    description: z.string().trim().max(2000).nullable().optional(),
    items: z.array(z.object({
      label: z.string().trim().min(1).max(300),
      instructions: z.string().trim().max(2000).nullable().optional(),
      required: z.boolean().default(true),
      requiresPhotoOnFailure: z.boolean().default(false),
    })).min(1).max(200),
  })).min(1).max(50),
});
const runSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  templateId: z.string().trim().min(1),
  propertyId: z.string().trim().min(1),
  unitId: z.string().trim().min(1).nullable().optional(),
  leaseId: z.string().trim().min(1).nullable().optional(),
  tenantId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(250),
  scheduledFor: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
});
const resultSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  acknowledgement: z.record(z.string(), z.unknown()).nullable().optional(),
  results: z.array(z.object({
    templateItemId: z.string().trim().min(1),
    result: z.enum(['PASS', 'FAIL', 'NOT_APPLICABLE', 'OBSERVATION']),
    valueText: z.string().trim().max(1000).nullable().optional(),
    notes: z.string().trim().max(3000).nullable().optional(),
    photoUrls: z.array(z.string().trim().url()).max(20).default([]),
    acknowledgedByName: z.string().trim().max(200).nullable().optional(),
    defect: z.object({
      title: z.string().trim().min(1).max(250),
      description: z.string().trim().max(3000).nullable().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      photoUrls: z.array(z.string().trim().url()).max(20).default([]),
    }).nullable().optional(),
  })).min(1).max(1000),
});
const conversionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).nullable().optional(),
  assetId: z.string().trim().min(1).nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
});

pmsStructuredInspectionsRouter.get('/templates', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsMaintenance(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const templates = await prisma.pmsInspectionTemplate.findMany({ where: { companyId: access.company.id, active: true, OR: [{ propertyId: null }, ...(query.propertyId ? [{ propertyId: query.propertyId }] : access.member.propertyScope.allProperties ? [] : [{ propertyId: { in: access.member.propertyScope.propertyIds } }])] }, include: { property: { select: { id: true, name: true } }, sections: { orderBy: { position: 'asc' }, include: { items: { orderBy: { position: 'asc' } } } } }, orderBy: [{ name: 'asc' }, { version: 'desc' }] });
    res.json({ templates });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.post('/templates', requireAuth(), async (req, res, next) => {
  try {
    const data = templateSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    if (data.propertyId) assertPmsPropertyScope(access, data.propertyId);
    const latest = await prisma.pmsInspectionTemplate.aggregate({ where: { companyId: access.company.id, name: data.name }, _max: { version: true } });
    const template = await prisma.pmsInspectionTemplate.create({ data: { companyId: access.company.id, propertyId: data.propertyId ?? null, name: data.name, description: data.description ?? null, type: data.type, version: (latest._max.version ?? 0) + 1, createdById: req.user!.id, updatedById: req.user!.id, sections: { create: data.sections.map((section, sectionPosition) => ({ companyId: access.company.id, title: section.title, description: section.description ?? null, position: sectionPosition, items: { create: section.items.map((item, itemPosition) => ({ companyId: access.company.id, label: item.label, instructions: item.instructions ?? null, required: item.required, requiresPhotoOnFailure: item.requiresPhotoOnFailure, position: itemPosition })) } })) } }, include: { sections: { include: { items: true } } } });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsInspectionTemplate', entityId: template.id, action: 'PMS_INSPECTION_TEMPLATE_CREATED', actorId: req.user!.id, afterMetadata: { propertyId: template.propertyId, name: template.name, type: template.type, version: template.version }, ...requestAuditContext(req) });
    res.status(201).json({ template });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.get('/runs', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.extend({ unitId: z.string().trim().min(1).optional(), type: z.enum(['GENERAL', 'MOVE_IN', 'MOVE_OUT', 'PERIODIC', 'SAFETY']).optional() }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsMaintenance(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const inspections = await prisma.pmsInspection.findMany({ where: { companyId: access.company.id, ...propertyScopeWhere(access), ...(query.propertyId ? { propertyId: query.propertyId } : {}), ...(query.unitId ? { unitId: query.unitId } : {}), ...(query.type ? { type: query.type } : {}) }, include: { property: { select: { id: true, name: true } }, unit: { select: { id: true, unitNumber: true } }, template: { select: { id: true, name: true, version: true } }, results: { include: { templateItem: { select: { id: true, label: true } }, defects: true } }, defects: true }, orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }] });
    res.json({ inspections });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.post('/runs', requireAuth(), async (req, res, next) => {
  try {
    const data = runSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    await assertPmsScopeLinks({ access, propertyId: data.propertyId, unitId: data.unitId, leaseId: data.leaseId, tenantId: data.tenantId });
    const template = await prisma.pmsInspectionTemplate.findFirst({ where: { id: data.templateId, companyId: access.company.id, active: true, OR: [{ propertyId: null }, { propertyId: data.propertyId }] } });
    if (!template) throw new AppError(400, 'Inspection template is unavailable for this property.');
    const inspection = await prisma.pmsInspection.create({ data: { companyId: access.company.id, propertyId: data.propertyId, unitId: data.unitId ?? null, leaseId: data.leaseId ?? null, tenantId: data.tenantId ?? null, templateId: template.id, type: template.type, title: data.title, scheduledFor: data.scheduledFor ?? null, notes: data.notes ?? null, createdById: req.user!.id, updatedById: req.user!.id } });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsInspection', entityId: inspection.id, action: 'PMS_STRUCTURED_INSPECTION_SCHEDULED', actorId: req.user!.id, afterMetadata: { templateId: template.id, propertyId: inspection.propertyId, unitId: inspection.unitId, type: inspection.type }, ...requestAuditContext(req) });
    res.status(201).json({ inspection });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.put('/runs/:id/results', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = resultSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    const inspection = await prisma.pmsInspection.findFirst({ where: { id, companyId: access.company.id }, include: { template: { include: { sections: { include: { items: true } } } } } });
    if (!inspection?.template) throw new AppError(404, 'Structured inspection not found.');
    if (inspection.status !== 'SCHEDULED') throw new AppError(409, 'Completed or cancelled inspections are immutable; create a new inspection or correction record.');
    assertPmsPropertyScope(access, inspection.propertyId);
    const allowedItems = new Map(inspection.template.sections.flatMap((section) => section.items).map((item) => [item.id, item]));
    const supplied = new Set(data.results.map((result) => result.templateItemId));
    for (const result of data.results) {
      const item = allowedItems.get(result.templateItemId);
      if (!item) throw new AppError(400, 'Inspection result contains an item outside the selected template.');
      if (result.result === 'FAIL' && item.requiresPhotoOnFailure && result.photoUrls.length === 0) throw new AppError(400, `A failure photo is required for ${item.label}.`);
    }
    const missingRequired = [...allowedItems.values()].filter((item) => item.required && !supplied.has(item.id));
    if (missingRequired.length > 0) throw new AppError(400, 'All required inspection items must have a result.');
    const updated = await prisma.$transaction(async (tx) => {
      for (const result of data.results) {
        const record = await tx.pmsInspectionResult.upsert({ where: { inspectionId_templateItemId: { inspectionId: id, templateItemId: result.templateItemId } }, update: { result: result.result, valueText: result.valueText ?? null, notes: result.notes ?? null, photoUrls: result.photoUrls, acknowledgedByName: result.acknowledgedByName ?? null, acknowledgedAt: result.acknowledgedByName ? new Date() : null }, create: { companyId: access.company.id, inspectionId: id, templateItemId: result.templateItemId, result: result.result, valueText: result.valueText ?? null, notes: result.notes ?? null, photoUrls: result.photoUrls, acknowledgedByName: result.acknowledgedByName ?? null, acknowledgedAt: result.acknowledgedByName ? new Date() : null } });
        if (result.defect) {
          await tx.pmsInspectionDefect.create({ data: { companyId: access.company.id, inspectionId: id, resultId: record.id, propertyId: inspection.propertyId, unitId: inspection.unitId, leaseId: inspection.leaseId, tenantId: inspection.tenantId, title: result.defect.title, description: result.defect.description ?? null, severity: result.defect.severity, photoUrls: result.defect.photoUrls } });
        }
      }
      const hasFailure = data.results.some((result) => result.result === 'FAIL' || Boolean(result.defect));
      await tx.pmsInspection.update({ where: { id }, data: { status: hasFailure ? 'NEEDS_ACTION' : 'COMPLETED', completedAt: new Date(), acknowledgement: data.acknowledgement as import('@prisma/client').Prisma.InputJsonValue | undefined, acknowledgedAt: data.acknowledgement ? new Date() : null, updatedById: req.user!.id } });
      return tx.pmsInspection.findUniqueOrThrow({ where: { id }, include: { results: { include: { defects: true } }, defects: true } });
    });
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsInspection', entityId: id, action: 'PMS_STRUCTURED_INSPECTION_COMPLETED', actorId: req.user!.id, changedFields: ['status', 'completedAt', 'acknowledgement'], afterMetadata: { status: updated.status, resultCount: updated.results.length, defectCount: updated.defects.length }, ...requestAuditContext(req) });
    res.json({ inspection: updated });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.post('/defects/:id/work-order', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = conversionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsMaintenance(access.member);
    const defect = await prisma.pmsInspectionDefect.findFirst({ where: { id, companyId: access.company.id }, include: { inspection: true } });
    if (!defect) throw new AppError(404, 'Inspection defect not found.');
    assertPmsPropertyScope(access, defect.propertyId);
    if (defect.workOrderId) {
      const existing = await prisma.pmsWorkOrder.findUnique({ where: { id: defect.workOrderId } });
      return res.json({ workOrder: existing, idempotent: true });
    }
    if (data.vendorId) {
      const vendor = await prisma.pmsVendor.findFirst({ where: { id: data.vendorId, companyId: access.company.id, active: true } });
      if (!vendor) throw new AppError(400, 'Assigned vendor is not active in this company.');
    }
    if (data.assetId) {
      const asset = await prisma.pmsAsset.findFirst({ where: { id: data.assetId, companyId: access.company.id, propertyId: defect.propertyId } });
      if (!asset) throw new AppError(400, 'Asset must belong to the defect property.');
    }
    const conversion = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PmsInspectionDefect" WHERE id = ${id} FOR UPDATE`;
      const locked = await tx.pmsInspectionDefect.findFirst({ where: { id, companyId: access.company.id } });
      if (!locked) throw new AppError(404, 'Inspection defect not found.');
      if (locked.workOrderId) {
        const existing = await tx.pmsWorkOrder.findUniqueOrThrow({ where: { id: locked.workOrderId } });
        return { workOrder: existing, idempotent: true };
      }
      const created = await tx.pmsWorkOrder.create({ data: { companyId: access.company.id, propertyId: locked.propertyId, unitId: locked.unitId, tenantId: locked.tenantId, vendorId: data.vendorId ?? null, assetId: data.assetId ?? null, title: locked.title, description: locked.description, priority: locked.severity, status: 'OPEN', scheduledFor: data.scheduledFor ?? null, targetDate: data.targetDate ?? null, imageUrls: locked.photoUrls, createdById: req.user!.id, updatedById: req.user!.id } });
      await tx.pmsInspectionDefect.update({ where: { id }, data: { status: 'WORK_ORDER_CREATED', workOrderId: created.id, convertedById: req.user!.id } });
      return { workOrder: created, idempotent: false };
    });
    const workOrder = conversion.workOrder;
    await recordDomainAuditEvent(prisma, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsInspectionDefect', entityId: id, action: 'PMS_INSPECTION_DEFECT_CONVERTED_TO_WORK_ORDER', actorId: req.user!.id, afterMetadata: { workOrderId: workOrder.id, vendorId: workOrder.vendorId, assetId: workOrder.assetId }, ...requestAuditContext(req) });
    res.status(conversion.idempotent ? 200 : 201).json({ workOrder, idempotent: conversion.idempotent });
  } catch (error) { next(error); }
});

pmsStructuredInspectionsRouter.get('/comparisons', requireAuth(), async (req, res, next) => {
  try {
    const query = querySchema.extend({ unitId: z.string().trim().min(1) }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsMaintenance(access.member);
    const unit = await prisma.pmsUnit.findFirst({ where: { id: query.unitId, companyId: access.company.id }, select: { id: true, propertyId: true } });
    if (!unit) throw new AppError(404, 'Unit not found.');
    assertPmsPropertyScope(access, unit.propertyId);
    const [moveIn, moveOut] = await Promise.all(['MOVE_IN', 'MOVE_OUT'].map((type) => prisma.pmsInspection.findFirst({ where: { companyId: access.company.id, unitId: query.unitId, type: type as 'MOVE_IN' | 'MOVE_OUT', status: { in: ['COMPLETED', 'NEEDS_ACTION'] } }, include: { results: { include: { templateItem: { select: { id: true, label: true } } } }, defects: true }, orderBy: { completedAt: 'desc' } })));
    const moveInByItem = new Map((moveIn?.results ?? []).map((result) => [result.templateItemId, result]));
    const comparison = (moveOut?.results ?? []).map((result) => ({ templateItemId: result.templateItemId, label: result.templateItem.label, moveIn: moveInByItem.get(result.templateItemId) ?? null, moveOut: result, changed: moveInByItem.get(result.templateItemId)?.result !== result.result || moveInByItem.get(result.templateItemId)?.valueText !== result.valueText }));
    res.json({ moveIn, moveOut, comparison });
  } catch (error) { next(error); }
});
