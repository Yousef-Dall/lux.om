import type { Prisma } from '@prisma/client';

import { defaultPipelineStages, leadStatusToPipelineKey } from './constants';

export async function ensureDefaultCrmPipeline(tx: Prisma.TransactionClient, workspaceId: string) {
  const existing = await tx.crmPipeline.findFirst({
    where: { workspaceId, isDefault: true, active: true },
    include: { stages: { where: { active: true }, orderBy: { position: 'asc' } } }
  });
  if (existing && existing.stages.length > 0) return existing;

  const pipeline = existing ?? await tx.crmPipeline.create({
    data: { workspaceId, name: 'Default sales pipeline', description: 'Compatibility pipeline for existing lux.om CRM leads.', isDefault: true }
  });

  for (const stage of defaultPipelineStages) {
    await tx.crmPipelineStage.upsert({
      where: { pipelineId_key: { pipelineId: pipeline.id, key: stage.key } },
      update: {
        name: stage.name,
        position: stage.position,
        type: stage.type,
        defaultProbability: stage.defaultProbability,
        slaHours: stage.slaHours,
        active: true,
        archivedAt: null
      },
      create: {
        pipelineId: pipeline.id,
        key: stage.key,
        name: stage.name,
        position: stage.position,
        type: stage.type,
        defaultProbability: stage.defaultProbability,
        slaHours: stage.slaHours
      }
    });
  }

  return tx.crmPipeline.findUniqueOrThrow({
    where: { id: pipeline.id },
    include: { stages: { where: { active: true }, orderBy: { position: 'asc' } } }
  });
}

export async function resolveLeadPipelineStage(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  status: Parameters<typeof leadStatusToPipelineKey>[0]
) {
  const pipeline = await ensureDefaultCrmPipeline(tx, workspaceId);
  const key = leadStatusToPipelineKey(status);
  const stage = pipeline.stages.find((item) => item.key === key);
  if (!stage) throw new Error(`Default CRM pipeline is missing stage ${key}.`);
  return { pipeline, stage };
}
