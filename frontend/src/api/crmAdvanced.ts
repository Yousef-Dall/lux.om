import { apiClient } from './client';
import type {
  CrmAccountType,
  CrmCommunicationChannel,
  CrmContactConsentStatus,
  CrmDealOutcome,
  CrmDeliveryStatus,
  CrmForecastCategory,
  CrmPipelineStageType,
  CrmScoreBand,
  CrmScoreTrend,
  CrmSourceEventType as GeneratedCrmSourceEventType
} from '../generated/crmContract';

export type CrmAccountSummary = {
  id: string;
  workspaceId: string;
  type: CrmAccountType;
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  ownerUser?: { id: string; name: string; email: string } | null;
  parentAccount?: { id: string; name: string } | null;
  archivedAt?: string | null;
  _count: { contacts: number; deals: number; activities: number };
};

export type CrmPipelineStage = {
  id: string;
  pipelineId: string;
  key: string;
  name: string;
  position: number;
  type: CrmPipelineStageType;
  defaultProbability: number;
  requiredFields?: string[] | null;
  slaHours?: number | null;
  active: boolean;
};

export type CrmPipeline = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  active: boolean;
  stages: CrmPipelineStage[];
  _count: { deals: number; leads: number };
};

export type CrmDeal = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  accountId: string;
  account: { id: string; name: string; type: CrmAccountType };
  primaryContact?: { id: string; fullName: string; email?: string | null; phone?: string | null } | null;
  sourceLead?: { id: string; title: string; status: string } | null;
  pipelineId: string;
  pipeline: { id: string; name: string };
  stageId: string;
  stage: CrmPipelineStage;
  ownerUser?: { id: string; name: string; email: string } | null;
  expectedValue?: string | null;
  currency: string;
  probability: number;
  forecastCategory: CrmForecastCategory;
  expectedCloseDate?: string | null;
  outcome: CrmDealOutcome;
  wonAt?: string | null;
  lostAt?: string | null;
  closedAt?: string | null;
  archivedAt?: string | null;
  lostReason?: string | null;
  wonReason?: string | null;
  reopenedCount: number;
  stageHistory?: Array<{
    id: string;
    fromStage?: { id: string; name: string } | null;
    toStage: { id: string; name: string };
    fromOutcome: CrmDealOutcome;
    toOutcome: CrmDealOutcome;
    reason?: string | null;
    reopened: boolean;
    changedAt: string;
    changedBy?: { id: string; name: string; email: string } | null;
  }>;
};

export type CrmContactDetail = {
  id: string;
  workspaceId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  account?: { id: string; name: string; type: CrmAccountType } | null;
  identities: Array<{ id: string; type: 'EMAIL' | 'PHONE'; normalizedValue: string; verifiedAt?: string | null }>;
  channelPreferences: Array<{
    id: string;
    channel: CrmCommunicationChannel;
    status: CrmContactConsentStatus;
    lawfulBasis?: string | null;
    preferred: boolean;
    timezone?: string | null;
  }>;
  leads: Array<{ id: string; title: string; status: string; score: number; scoreBand: CrmScoreBand }>;
  primaryDeals: Array<{ id: string; name: string; outcome: CrmDealOutcome; currency: string; expectedValue?: string | null; stage: CrmPipelineStage }>;
  suppressions?: Array<{ id: string; channel: CrmCommunicationChannel; normalizedDestination: string; reason: string; active: boolean; expiresAt?: string | null }>;
};

export type CrmDuplicateCandidate = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  reasons: string[];
};

export type CrmContactMergeField = 'fullName' | 'email' | 'phone' | 'notes' | 'accountId' | 'userId' | 'pmsTenantId';

export type CrmContactMergeParty = {
  id: string;
  workspaceId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  accountId?: string | null;
  userId?: string | null;
  pmsTenantId?: string | null;
  identities: Array<{ id: string; type: 'EMAIL' | 'PHONE'; normalizedValue: string; verifiedAt?: string | null }>;
  channelPreferences: CrmContactDetail['channelPreferences'];
  _count: {
    leads: number;
    primaryDeals: number;
    activities: number;
    sourceEvents: number;
    deliveryAttempts: number;
  };
};

export type CrmContactMergePreview = {
  primary: CrmContactMergeParty;
  duplicate: CrmContactMergeParty;
  conflicts: Array<{
    field: CrmContactMergeField;
    primary: string;
    duplicate: string;
  }>;
  movedLinks: CrmContactMergeParty['_count'];
  suggested: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    accountId?: string | null;
    userId?: string | null;
    pmsTenantId?: string | null;
  };
};

export type CrmContactMergeResolution = Partial<Pick<CrmContactMergePreview['suggested'], 'fullName' | 'email' | 'phone' | 'notes' | 'accountId'>>;

export type CrmContactMergeResult = {
  merge: {
    id: string;
    workspaceId: string;
    primaryContactId: string;
    duplicateContactId: string;
    status: 'PREVIEWED' | 'COMPLETED' | 'CANCELLED';
    mergedAt?: string | null;
    actorId?: string | null;
    createdAt: string;
  };
  contact: Pick<CrmContactDetail, 'id' | 'workspaceId' | 'fullName' | 'email' | 'phone' | 'notes'>;
  preview: CrmContactMergePreview;
};

export type CrmScoreSnapshot = {
  id: string;
  score: number;
  band: CrmScoreBand;
  version: string;
  previousScore?: number | null;
  trend: CrmScoreTrend;
  reasons: Array<{ key?: string; label?: string; points?: number }>;
  signals: Record<string, unknown>;
  calculatedAt: string;
};

export type CrmForecastResponse = {
  snapshot: {
    leads: { total: number; qualified: number; converted: number; leadToQualifiedRate: number; qualifiedToDealRate: number };
    deals: {
      decided: number;
      won: number;
      winRate: number;
      byCurrencyAndOutcome: Array<{ currency: string; outcome: CrmDealOutcome; _count: { _all: number }; _sum: { expectedValue?: string | null } }>;
      forecast: Array<{ currency: string; pipelineValue: number; weightedForecast: number }>;
      averageSalesCycleByCurrency: Array<{ currency: string; averageSalesCycleDays: number | null }>;
    };
    overdueFollowUps: number;
  };
  dimensions: {
    bySource: Array<{ source: string; outcome: CrmDealOutcome; _count: { _all: number } }>;
    byAssignee: Array<{ assignedToId?: string | null; outcome: CrmDealOutcome; _count: { _all: number } }>;
    byScoreBand: Array<{ scoreBand: CrmScoreBand; outcome: CrmDealOutcome; _count: { _all: number } }>;
    stages: Array<{ stageId?: string | null; outcome: CrmDealOutcome; _count: { _all: number }; stage?: { id: string; name: string; position: number } | null }>;
    timeInStage: Array<{ stageId: string; averageHours: number }>;
    stageDropOff: Array<{ fromStageId?: string | null; lostDeals: number }>;
    lostReasons: Array<{ lostReason?: string | null; _count: { _all: number } }>;
    wonReasons: Array<{ wonReason?: string | null; _count: { _all: number } }>;
  };
  rules: { currenciesCombined: false; historicalOutcomesPreservedAfterArchive: true; truncatedResultSetsUsed: false };
};

export function listCrmAccounts(token: string, workspaceId: string, search?: string) {
  return apiClient.get<{ accounts: CrmAccountSummary[]; pagination: { total: number } }>('/api/crm/accounts', {
    token,
    params: { workspaceId, search, take: 100 }
  });
}

export function createCrmAccount(token: string, payload: Record<string, unknown>) {
  return apiClient.post<{ account: CrmAccountSummary }>('/api/crm/accounts', payload, { token });
}

export function createCrmAccountContact(token: string, accountId: string, payload: Record<string, unknown>) {
  return apiClient.post<{ contact: CrmContactDetail }>(`/api/crm/accounts/${accountId}/contacts`, payload, { token });
}

export function getCrmAccount(token: string, id: string) {
  return apiClient.get<{ account: CrmAccountSummary & { contacts: CrmContactDetail[]; deals: CrmDeal[]; childAccounts: CrmAccountSummary[] } }>(`/api/crm/accounts/${id}`, { token });
}

export function getCrmContactDetail(token: string, id: string) {
  return apiClient.get<{ contact: CrmContactDetail; duplicates: CrmDuplicateCandidate[]; suppressions: CrmContactDetail['suppressions'] }>(`/api/crm/contacts/${id}`, { token });
}

export function previewCrmContactMerge(token: string, primaryContactId: string, duplicateContactId: string) {
  return apiClient.post<{ preview: CrmContactMergePreview }>(`/api/crm/contacts/${primaryContactId}/merge-preview`, { duplicateContactId }, { token });
}

export function mergeCrmContacts(
  token: string,
  primaryContactId: string,
  duplicateContactId: string,
  resolutions: CrmContactMergeResolution = {}
) {
  return apiClient.post<CrmContactMergeResult>(
    `/api/crm/contacts/${primaryContactId}/merge`,
    { duplicateContactId, resolutions },
    { token }
  );
}

export function listCrmPipelines(token: string, workspaceId: string) {
  return apiClient.get<{ pipelines: CrmPipeline[] }>('/api/crm/pipelines', { token, params: { workspaceId } });
}

export function createCrmPipeline(token: string, payload: Record<string, unknown>) {
  return apiClient.post<{ pipeline: CrmPipeline }>('/api/crm/pipelines', payload, { token });
}

export function updateCrmPipelineStage(token: string, id: string, payload: Record<string, unknown>) {
  return apiClient.patch<{ stage: CrmPipelineStage }>(`/api/crm/pipeline-stages/${id}`, payload, { token });
}

export function listCrmDeals(token: string, workspaceId: string) {
  return apiClient.get<{ deals: CrmDeal[]; pagination: { total: number } }>('/api/crm/deals', { token, params: { workspaceId, take: 200 } });
}

export function createCrmDeal(token: string, payload: Record<string, unknown>) {
  return apiClient.post<{ deal: CrmDeal }>('/api/crm/deals', payload, { token });
}

export function getCrmDeal(token: string, id: string) {
  return apiClient.get<{ deal: CrmDeal }>(`/api/crm/deals/${id}`, { token });
}

export function transitionCrmDeal(token: string, id: string, stageId: string, options: { reason?: string; wonReason?: string; lostReason?: string } = {}) {
  return apiClient.post<{ deal: CrmDeal }>(`/api/crm/deals/${id}/transition`, { stageId, ...options }, { token });
}

export function archiveCrmDeal(token: string, id: string, archived: boolean) {
  return apiClient.patch<{ deal: CrmDeal }>(`/api/crm/deals/${id}/archive`, { archived }, { token });
}

export function convertCrmLead(token: string, id: string, payload: Record<string, unknown>) {
  return apiClient.post<{ account: CrmAccountSummary; deal: CrmDeal; lead: unknown }>(`/api/crm/leads/${id}/convert`, payload, { token });
}

export function getCrmLeadScoreHistory(token: string, id: string) {
  return apiClient.get<{ snapshots: CrmScoreSnapshot[] }>(`/api/crm/leads/${id}/score-history`, { token });
}

export function getCrmForecast(token: string, workspaceId: string) {
  return apiClient.get<CrmForecastResponse>('/api/crm/analytics/forecast', { token, params: { workspaceId } });
}


export type CrmSourceEventType = GeneratedCrmSourceEventType;

export type CrmSourceEvent = {
  id: string;
  workspaceId: string;
  type: CrmSourceEventType;
  sourceRecordId: string;
  ruleKey: string;
  occurredAt: string;
  consentStatus: CrmContactConsentStatus;
  metadata?: Record<string, unknown> | null;
  contact?: { id: string; fullName: string } | null;
  lead?: { id: string; title: string } | null;
  account?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
};

export type CrmSourceEventLinkedTo = 'ANY' | 'CONTACT' | 'LEAD' | 'ACCOUNT' | 'DEAL' | 'UNLINKED';

export function listCrmSourceEvents(
  token: string,
  params: {
    workspaceId: string;
    search?: string;
    type?: CrmSourceEventType;
    consentStatus?: CrmContactConsentStatus;
    linkedTo?: CrmSourceEventLinkedTo;
    sortBy?: 'occurredAt' | 'type' | 'consentStatus';
    direction?: 'asc' | 'desc';
    take?: number;
    skip?: number;
  }
) {
  return apiClient.get<{
    events: CrmSourceEvent[];
    pagination: { total: number; take: number; skip: number; count: number };
    rules: { propertyScopeApplied: true; completeCountUsed: true };
  }>('/api/crm/source-events', { token, params });
}

export function getCrmCommunicationGovernance(token: string, contactId: string) {
  return apiClient.get<{ contact: CrmContactDetail; preferences: CrmContactDetail['channelPreferences']; suppressions: unknown[] }>(`/api/crm/contacts/${contactId}/communication-governance`, { token });
}

export function updateCrmCommunicationGovernance(token: string, contactId: string, payload: Record<string, unknown>) {
  return apiClient.patch<{ preference: CrmContactDetail['channelPreferences'][number] }>(`/api/crm/contacts/${contactId}/communication-governance`, payload, { token });
}

export type CrmDeliveryProvider = 'DRAFT_ONLY' | 'VERIFIED_EMAIL' | 'WHATSAPP_BUSINESS';

export type CrmCommunicationContact = {
  id: string;
  workspaceId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  updatedAt: string;
  account?: { id: string; name: string; type: CrmAccountType } | null;
  identities: Array<{ id: string; type: 'EMAIL' | 'PHONE'; normalizedValue: string; verifiedAt?: string | null }>;
  channelPreferences: CrmContactDetail['channelPreferences'];
};

export type CrmCommunicationTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  subject?: string | null;
  body: string;
  active: boolean;
  createdAt: string;
};

export type CrmCommunicationTemplate = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  channel: CrmCommunicationChannel;
  active: boolean;
  versions: CrmCommunicationTemplateVersion[];
  updatedAt: string;
};

export type CrmDeliveryAttempt = {
  id: string;
  workspaceId: string;
  contactId: string;
  leadId?: string | null;
  dealId?: string | null;
  activityId?: string | null;
  templateVersionId?: string | null;
  channel: CrmCommunicationChannel;
  status: CrmDeliveryStatus;
  provider: CrmDeliveryProvider;
  destination: string;
  normalizedDestination: string;
  idempotencyKey: string;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: { subject?: string | null; body?: string } | null;
  attemptedAt: string;
  submittedAt?: string | null;
  providerConfirmedAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  bouncedAt?: string | null;
  blockedAt?: string | null;
  contact?: { id: string; fullName: string; email?: string | null; phone?: string | null };
  lead?: { id: string; title: string } | null;
  deal?: { id: string; name: string } | null;
  activity?: { id: string; type: string; subject: string } | null;
  templateVersion?: (CrmCommunicationTemplateVersion & {
    template: Pick<CrmCommunicationTemplate, 'id' | 'key' | 'name' | 'channel'>;
  }) | null;
};

export type CrmCommunicationPolicy = {
  workspaceId: string;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  hourlyRateLimit: number;
  retentionDays: number;
};

export function getCrmCommunicationPolicy(token: string, workspaceId: string) {
  return apiClient.get<{ policy: CrmCommunicationPolicy }>('/api/crm/communication-policy', { token, params: { workspaceId } });
}

export function updateCrmCommunicationPolicy(token: string, payload: CrmCommunicationPolicy) {
  return apiClient.patch<{ policy: CrmCommunicationPolicy }>('/api/crm/communication-policy', payload, { token });
}

export function listCrmCommunicationContacts(
  token: string,
  params: {
    workspaceId: string;
    search?: string;
    sortBy?: 'fullName' | 'updatedAt';
    direction?: 'asc' | 'desc';
    take?: number;
    skip?: number;
  }
) {
  return apiClient.get<{
    contacts: CrmCommunicationContact[];
    pagination: { total: number; take: number; skip: number; count: number };
  }>('/api/crm/contacts', { token, params });
}

export function listCrmCommunicationTemplates(token: string, workspaceId: string) {
  return apiClient.get<{ templates: CrmCommunicationTemplate[] }>('/api/crm/communication-templates', {
    token,
    params: { workspaceId }
  });
}

export function listCrmDeliveryAttempts(
  token: string,
  params: {
    workspaceId: string;
    contactId?: string;
    search?: string;
    channel?: CrmCommunicationChannel;
    provider?: CrmDeliveryProvider;
    status?: CrmDeliveryStatus;
    sortBy?: 'attemptedAt' | 'status' | 'channel';
    direction?: 'asc' | 'desc';
    take?: number;
    skip?: number;
  }
) {
  return apiClient.get<{
    attempts: CrmDeliveryAttempt[];
    pagination: { total: number; take: number; skip: number; count: number };
  }>('/api/crm/delivery-attempts', { token, params });
}

export function createCrmDeliveryAttempt(
  token: string,
  payload: {
    workspaceId: string;
    contactId: string;
    leadId?: string | null;
    dealId?: string | null;
    activityId?: string | null;
    templateVersionId?: string | null;
    channel: CrmCommunicationChannel;
    provider: CrmDeliveryProvider;
    destination: string;
    subject?: string | null;
    body: string;
    idempotencyKey: string;
  }
) {
  return apiClient.post<{ attempt: CrmDeliveryAttempt; deliveryConfirmed: boolean }>(
    '/api/crm/delivery-attempts',
    payload,
    { token }
  );
}
