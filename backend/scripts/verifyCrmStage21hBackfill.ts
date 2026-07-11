import { prisma } from '../src/lib/prisma';

async function main() {
  const [
    leadsWithoutPipeline,
    leadsWithoutScoreSnapshot,
    leadsPendingDurableScoreRecalculation,
    contactsWithoutIdentity,
    invalidLeadWorkspaceRelations,
    invalidDealWorkspaceRelations,
    invalidStageHistory,
    deliveredWithoutConfirmation,
    duplicateActiveEmailIdentities,
    duplicateActivePhoneIdentities,
  ] = await Promise.all([
    prisma.crmLead.count({ where: { OR: [{ pipelineId: null }, { stageId: null }, { scoreCalculatedAt: null }] } }),
    prisma.crmLead.count({ where: { scoreSnapshots: { none: {} } } }),
    prisma.crmLead.count({ where: { scoringVersion: { not: 'crm-deterministic-v2' } } }),
    prisma.crmContact.count({
      where: {
        mergedIntoContactId: null,
        OR: [
          { AND: [{ normalizedEmail: { not: null } }, { identities: { none: { type: 'EMAIL', active: true } } }] },
          { AND: [{ normalizedPhone: { not: null } }, { identities: { none: { type: 'PHONE', active: true } } }] },
        ],
      },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "CrmLead" l
      LEFT JOIN "CrmContact" c ON c.id = l."contactId"
      LEFT JOIN "CrmPipeline" p ON p.id = l."pipelineId"
      LEFT JOIN "CrmPipelineStage" s ON s.id = l."stageId"
      WHERE c."workspaceId" IS DISTINCT FROM l."workspaceId"
         OR p."workspaceId" IS DISTINCT FROM l."workspaceId"
         OR s."pipelineId" IS DISTINCT FROM l."pipelineId"`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "CrmDeal" d
      JOIN "CrmAccount" a ON a.id = d."accountId"
      JOIN "CrmPipeline" p ON p.id = d."pipelineId"
      JOIN "CrmPipelineStage" s ON s.id = d."stageId"
      LEFT JOIN "CrmContact" c ON c.id = d."primaryContactId"
      WHERE a."workspaceId" IS DISTINCT FROM d."workspaceId"
         OR p."workspaceId" IS DISTINCT FROM d."workspaceId"
         OR s."pipelineId" IS DISTINCT FROM d."pipelineId"
         OR (c.id IS NOT NULL AND c."workspaceId" IS DISTINCT FROM d."workspaceId")`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "CrmStageHistory" h
      JOIN "CrmDeal" d ON d.id = h."dealId"
      JOIN "CrmPipelineStage" s ON s.id = h."toStageId"
      WHERE d."workspaceId" IS DISTINCT FROM h."workspaceId"
         OR d."pipelineId" IS DISTINCT FROM h."pipelineId"
         OR s."pipelineId" IS DISTINCT FROM h."pipelineId"`,
    prisma.crmDeliveryAttempt.count({ where: { status: 'DELIVERED', providerConfirmedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "workspaceId", "normalizedValue"
        FROM "CrmContactIdentity" WHERE type = 'EMAIL' AND active = true
        GROUP BY "workspaceId", "normalizedValue" HAVING COUNT(*) > 1
      ) duplicates`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "workspaceId", "normalizedValue"
        FROM "CrmContactIdentity" WHERE type = 'PHONE' AND active = true
        GROUP BY "workspaceId", "normalizedValue" HAVING COUNT(*) > 1
      ) duplicates`,
  ]);

  const report = {
    failures: {
      leadsWithoutPipeline,
      leadsWithoutScoreSnapshot,
      leadsPendingDurableScoreRecalculation,
      contactsWithoutIdentity,
      invalidLeadWorkspaceRelations: Number(invalidLeadWorkspaceRelations[0]?.count ?? 0n),
      invalidDealWorkspaceRelations: Number(invalidDealWorkspaceRelations[0]?.count ?? 0n),
      invalidStageHistory: Number(invalidStageHistory[0]?.count ?? 0n),
      deliveredWithoutConfirmation,
      duplicateActiveEmailIdentities: Number(duplicateActiveEmailIdentities[0]?.count ?? 0n),
      duplicateActivePhoneIdentities: Number(duplicateActivePhoneIdentities[0]?.count ?? 0n),
    },
  };
  console.log('[lux.om] Stage 21H backfill verification', report);
  const failed = Object.entries(report.failures).filter(([, value]) => value !== 0);
  if (failed.length) throw new Error(`Stage 21H backfill verification failed: ${failed.map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log('[lux.om] Stage 21H backfill verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
