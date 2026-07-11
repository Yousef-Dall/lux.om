import { DomainAuditDomain, Prisma } from '@prisma/client';

import { recordDomainAuditEvent } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';

function generationKey(planId: string, serviceDate: Date) {
  return `preventive:${planId}:${serviceDate.toISOString().slice(0, 10)}`;
}

export async function generateDuePreventiveWorkOrders(input: {
  asOf?: Date;
  companyId?: string;
  actorId?: string | null;
}) {
  const asOf = input.asOf ?? new Date();
  const plans = await prisma.pmsMaintenancePlan.findMany({
    where: {
      status: 'ACTIVE',
      nextServiceDate: { lte: asOf },
      ...(input.companyId ? { companyId: input.companyId } : {}),
    },
    orderBy: [{ nextServiceDate: 'asc' }, { id: 'asc' }],
  });

  const results: Array<{ planId: string; workOrderId: string; idempotent: boolean }> = [];
  for (const plan of plans) {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "PmsMaintenancePlan" WHERE id = ${plan.id} FOR UPDATE`;
        const locked = await tx.pmsMaintenancePlan.findUniqueOrThrow({ where: { id: plan.id } });
        if (locked.status !== 'ACTIVE' || locked.nextServiceDate > asOf) return null;
        const key = generationKey(locked.id, locked.nextServiceDate);
        const existing = await tx.pmsWorkOrder.findUnique({ where: { preventiveGenerationKey: key } });
        if (existing) {
          return { planId: locked.id, workOrderId: existing.id, idempotent: true };
        }
        const workOrder = await tx.pmsWorkOrder.create({
          data: {
            companyId: locked.companyId,
            propertyId: locked.propertyId,
            unitId: locked.unitId,
            vendorId: locked.vendorId,
            assetId: locked.assetId,
            maintenancePlanId: locked.id,
            title: locked.title,
            description: locked.description,
            priority: locked.priority,
            status: 'OPEN',
            targetDate: locked.nextServiceDate,
            scheduledFor: locked.nextServiceDate,
            assignedToText: locked.vendorId ? 'Assigned vendor' : null,
            recurrenceType: 'NONE',
            preventiveGenerationKey: key,
            notes: locked.checklist.length > 0 ? `Checklist:\n${locked.checklist.map((item) => `- ${item}`).join('\n')}` : null,
            currency: locked.currency,
            cost: locked.estimatedCost,
            createdById: input.actorId ?? locked.createdById,
            updatedById: input.actorId ?? locked.updatedById,
          },
        });
        const nextServiceDate = locked.intervalDays
          ? new Date(locked.nextServiceDate.getTime() + locked.intervalDays * 86_400_000)
          : locked.nextServiceDate;
        await tx.pmsMaintenancePlan.update({
          where: { id: locked.id },
          data: {
            lastGeneratedAt: new Date(),
            ...(locked.intervalDays ? { nextServiceDate } : { status: 'COMPLETED' }),
          },
        });
        await recordDomainAuditEvent(tx, {
          companyId: locked.companyId,
          domain: DomainAuditDomain.PMS,
          entityType: 'PmsWorkOrder',
          entityId: workOrder.id,
          action: 'PMS_PREVENTIVE_WORK_ORDER_GENERATED',
          actorId: input.actorId ?? null,
          origin: 'AUTOMATION',
          metadata: { maintenancePlanId: locked.id, preventiveGenerationKey: key, scheduledFor: locked.nextServiceDate },
        });
        return { planId: locked.id, workOrderId: workOrder.id, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result) results.push(result);
  }
  return results;
}
