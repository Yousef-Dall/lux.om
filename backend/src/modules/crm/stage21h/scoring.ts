import { createHash } from 'node:crypto';
import type { CrmScoreBand, CrmScoreTrend, Prisma } from '@prisma/client';

import { calculateCrmLeadIntelligence } from '../../../lib/crmIntelligence';
import { CRM_SCORING_VERSION } from './constants';

const scoringInclude = {
  contact: { select: { fullName: true, email: true, phone: true } },
  inquiry: { select: { createdAt: true } },
  booking: { select: { status: true, payment: { select: { status: true } } } },
  activities: {
    select: { type: true, status: true, dueAt: true, completedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 100
  }
} satisfies Prisma.CrmLeadInclude;

function asBand(value: 'COLD' | 'WARM' | 'HOT'): CrmScoreBand {
  return value;
}

function trend(previousScore: number | null, score: number): CrmScoreTrend {
  if (previousScore === null || previousScore === score) return 'STABLE';
  return score > previousScore ? 'RISING' : 'FALLING';
}

export async function persistCrmLeadScore(
  tx: Prisma.TransactionClient,
  leadId: string,
  options: { version?: string; forceSnapshot?: boolean; jobKey?: string } = {}
) {
  const lead = await tx.crmLead.findUnique({ where: { id: leadId }, include: scoringInclude });
  if (!lead) return null;

  const repeatEngagementCount = await tx.crmLead.count({
    where: { workspaceId: lead.workspaceId, contactId: lead.contactId }
  });
  const intelligence = calculateCrmLeadIntelligence({ ...lead, repeatEngagementCount });
  const version = options.version ?? CRM_SCORING_VERSION;
  const previous = await tx.crmScoreSnapshot.findFirst({
    where: { leadId },
    orderBy: { calculatedAt: 'desc' },
    select: { score: true, version: true, reasons: true, signals: true }
  });
  const reasons = intelligence.scoreReasons as unknown as Prisma.InputJsonValue;
  const signals = intelligence.signals as unknown as Prisma.InputJsonValue;
  const changed = !previous || previous.score !== intelligence.score || previous.version !== version ||
    JSON.stringify(previous.reasons) !== JSON.stringify(reasons) || JSON.stringify(previous.signals) !== JSON.stringify(signals);

  const calculatedAt = new Date();
  await tx.crmLead.update({
    where: { id: leadId },
    data: {
      score: intelligence.score,
      scoreBand: asBand(intelligence.scoreBand),
      scoringVersion: version,
      scoreCalculatedAt: calculatedAt
    }
  });

  const shouldSnapshot = changed || Boolean(options.forceSnapshot);
  if (shouldSnapshot) {
    const stateFingerprint = createHash('sha256')
      .update(JSON.stringify({ version, score: intelligence.score, reasons, signals }))
      .digest('hex')
      .slice(0, 20);
    const snapshotJobKey = options.jobKey ? `${options.jobKey}:${stateFingerprint}` : null;
    await tx.crmScoreSnapshot.create({
      data: {
        workspaceId: lead.workspaceId,
        leadId,
        score: intelligence.score,
        band: asBand(intelligence.scoreBand),
        version,
        reasons,
        signals,
        previousScore: previous?.score ?? null,
        trend: trend(previous?.score ?? null, intelligence.score),
        calculatedAt,
        jobKey: snapshotJobKey
      }
    });
  }

  return { intelligence, version, calculatedAt, snapshotCreated: shouldSnapshot };
}

export async function recalculateWorkspaceScores(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  options: { version?: string; jobKey?: string } = {}
) {
  const leads = await tx.crmLead.findMany({ where: { workspaceId }, select: { id: true }, orderBy: { id: 'asc' } });
  let snapshots = 0;
  for (const lead of leads) {
    const result = await persistCrmLeadScore(tx, lead.id, options);
    if (result?.snapshotCreated) snapshots += 1;
  }
  return { leads: leads.length, snapshots };
}
