import type { CrmDealOutcome, CrmLeadStatus, CrmPipelineStageType } from '@prisma/client';

export const CRM_SCORING_VERSION = 'crm-deterministic-v2';

export const defaultPipelineStages = [
  { key: 'NEW', name: 'New', position: 10, type: 'OPEN', defaultProbability: 5, slaHours: 24 },
  { key: 'CONTACTED', name: 'Contacted', position: 20, type: 'OPEN', defaultProbability: 15, slaHours: 48 },
  { key: 'QUALIFIED', name: 'Qualified', position: 30, type: 'OPEN', defaultProbability: 30, slaHours: 72 },
  { key: 'VIEWING_SCHEDULED', name: 'Viewing scheduled', position: 40, type: 'OPEN', defaultProbability: 45, slaHours: 96 },
  { key: 'PROPOSAL_SENT', name: 'Proposal sent', position: 50, type: 'OPEN', defaultProbability: 60, slaHours: 120 },
  { key: 'NEGOTIATION', name: 'Negotiation', position: 60, type: 'OPEN', defaultProbability: 75, slaHours: 168 },
  { key: 'WON', name: 'Won', position: 70, type: 'WON', defaultProbability: 100, slaHours: null },
  { key: 'LOST', name: 'Lost', position: 80, type: 'LOST', defaultProbability: 0, slaHours: null }
] as const satisfies ReadonlyArray<{
  key: CrmLeadStatus;
  name: string;
  position: number;
  type: CrmPipelineStageType;
  defaultProbability: number;
  slaHours: number | null;
}>;

export function leadStatusToPipelineKey(status: CrmLeadStatus) {
  return status === 'ARCHIVED' ? 'NEW' : status;
}

export function stageTypeToOutcome(type: CrmPipelineStageType): CrmDealOutcome {
  if (type === 'WON') return 'WON';
  if (type === 'LOST') return 'LOST';
  return 'OPEN';
}

export function leadStatusToOutcome(status: CrmLeadStatus): CrmDealOutcome {
  if (status === 'WON') return 'WON';
  if (status === 'LOST') return 'LOST';
  return 'OPEN';
}
