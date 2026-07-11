import { apiClient } from './client';
import type {
  CrmActivityPriority,
  CrmActivityStatus,
  CrmActivityType,
  CrmCommunicationDirection,
  CrmCommunicationOutcome,
  CrmLeadPriority,
  CrmLeadSource,
  CrmLeadStatus
} from '../generated/crmContract';

export type {
  CrmActivityPriority,
  CrmActivityStatus,
  CrmActivityType,
  CrmCommunicationDirection,
  CrmCommunicationOutcome,
  CrmLeadPriority,
  CrmLeadSource,
  CrmLeadStatus
} from '../generated/crmContract';

export type CrmWorkspaceAccess = {
  hasAccess: boolean;
  isAdmin: boolean;
  personalWorkspace: { enabled: boolean; canView: boolean; canManage: boolean };
  companyWorkspaces: Array<{
    workspaceId: string;
    type: 'COMPANY';
    companyId: string;
    memberId: string;
    role: string;
    nameEn: string;
    nameAr?: string | null;
    canView: boolean;
    canManage: boolean;
    canAssign?: boolean;
    canManageWorkspace?: boolean;
    propertyScope: { allProperties: boolean; propertyIds: string[] };
  }>;
  workspaces?: Array<{
    workspaceId: string;
    type: 'PERSONAL' | 'COMPANY' | 'PLATFORM';
    companyId?: string | null;
    personalOwnerUserId?: string | null;
    canView: boolean;
    canManage: boolean;
    propertyScope: { allProperties: boolean; propertyIds: string[] };
  }>;
};

export type CrmPerson = { id: string; name: string; email: string; role?: string };
export type CrmActivity = {
  id: string;
  type: CrmActivityType;
  status: CrmActivityStatus;
  priority: CrmActivityPriority;
  subject: string;
  body?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  communicationDirection?: CrmCommunicationDirection | null;
  communicationOutcome?: CrmCommunicationOutcome | null;
  templateKey?: string | null;
  assignedTo?: CrmPerson | null;
  createdBy?: CrmPerson | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmLeadIntelligence = {
  score: number;
  scoreBand: 'COLD' | 'WARM' | 'HOT';
  scoreReasons: Array<{ key: string; label: string; points: number }>;
  nextBestAction: {
    key: string;
    title: string;
    description: string;
    priority: CrmLeadPriority;
    dueAt?: string | null;
    reason: string;
  };
  signals: {
    repeatEngagementCount: number;
    completedCommunications: number;
    openTasks: number;
    overdueTasks: number;
    lastCommunicationAt?: string | null;
  };
};

export type CrmLead = {
  id: string;
  title: string;
  description?: string | null;
  status: CrmLeadStatus;
  priority: CrmLeadPriority;
  source: CrmLeadSource;
  sourceLabel?: string | null;
  expectedValue?: string | null;
  currency: string;
  nextFollowUpAt?: string | null;
  lostReason?: string | null;
  archivedAt?: string | null;
  workspaceId: string;
  companyId?: string | null;
  ownerUserId?: string | null;
  assignedToId?: string | null;
  contact: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    userId?: string | null;
    pmsTenantId?: string | null;
  };
  company?: { id: string; slug: string; nameEn: string; nameAr?: string | null } | null;
  ownerUser?: CrmPerson | null;
  assignedTo?: CrmPerson | null;
  listing?: { id: string; slug: string; title: string; titleEn?: string | null; titleAr?: string | null } | null;
  activity?: { id: string; slug: string; titleEn: string; titleAr?: string | null } | null;
  developerProject?: { id: string; slug: string; nameEn: string; nameAr?: string | null } | null;
  pmsProperty?: { id: string; name: string; code?: string | null } | null;
  inquiry?: { id: string; type: string; message: string; createdAt: string } | null;
  booking?: { id: string; status: string; scheduledDate?: string | null; preferredTime?: string | null; guests: number } | null;
  valuationRequest?: { id: string; status: string; location: string; estimateLow?: string | null; estimateHigh?: string | null } | null;
  pmsTenant?: { id: string; fullName: string; email?: string | null; phone?: string | null } | null;
  pmsVendor?: { id: string; name: string; email?: string | null; phone?: string | null; trade?: string | null } | null;
  activities?: CrmActivity[];
  _count?: { activities: number };
  intelligence?: CrmLeadIntelligence;
  createdAt: string;
  updatedAt: string;
};

export type CrmLeadFilters = {
  companyId?: string;
  workspace?: 'personal' | 'all' | 'admin';
  source?: CrmLeadSource;
  status?: CrmLeadStatus;
  priority?: CrmLeadPriority;
  assignedToId?: string;
  search?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
};

export type CrmLeadPayload = {
  title: string;
  description?: string;
  priority?: CrmLeadPriority;
  source?: CrmLeadSource;
  sourceLabel?: string;
  expectedValue?: number;
  currency?: string;
  nextFollowUpAt?: string | null;
  companyId?: string | null;
  ownerUserId?: string | null;
  assignedToId?: string | null;
  contact: { fullName: string; email?: string; phone?: string; notes?: string };
  sourceReferences?: Record<string, string | null | undefined>;
};

export function getCrmAccess(token: string) {
  return apiClient.get<{ access: CrmWorkspaceAccess }>('/api/crm/access', { token });
}

export function listCrmLeads(token: string, filters: CrmLeadFilters = {}) {
  return apiClient.get<{
    leads: CrmLead[];
    summary: { total: number; byStatus: Partial<Record<CrmLeadStatus, number>> };
    pagination: { take: number; skip: number; total: number; count: number };
  }>('/api/crm/leads', { token, params: filters });
}

export function getCrmLead(token: string, id: string) {
  return apiClient.get<{ lead: CrmLead }>(`/api/crm/leads/${id}`, { token });
}

export function createCrmLead(token: string, payload: CrmLeadPayload) {
  return apiClient.post<{ lead: CrmLead }>('/api/crm/leads', payload, { token });
}

export function updateCrmLead(token: string, id: string, payload: Partial<Pick<CrmLead, 'title' | 'description' | 'status' | 'priority' | 'assignedToId' | 'nextFollowUpAt' | 'lostReason'>> & { expectedValue?: number | null; currency?: string }) {
  return apiClient.patch<{ lead: CrmLead }>(`/api/crm/leads/${id}`, payload, { token });
}


export function listCrmProperties(token: string, companyId: string) {
  return apiClient.get<{ properties: Array<{ id: string; name: string; code?: string | null }> }>('/api/crm/properties', {
    token,
    params: { companyId }
  });
}

export function listCrmAssignees(token: string, companyId?: string, propertyId?: string) {
  return apiClient.get<{ assignees: CrmPerson[] }>('/api/crm/assignees', {
    token,
    params: companyId ? { companyId, propertyId } : undefined
  });
}

export function addCrmActivity(token: string, leadId: string, payload: {
  type: Exclude<CrmActivityType, 'STATUS_CHANGE' | 'ASSIGNMENT' | 'SYSTEM_NOTIFICATION'>;
  status?: CrmActivityStatus;
  priority?: CrmActivityPriority;
  subject: string;
  body?: string;
  dueAt?: string | null;
  assignedToId?: string | null;
  communicationDirection?: CrmCommunicationDirection;
  communicationOutcome?: CrmCommunicationOutcome;
  templateKey?: string;
}) {
  return apiClient.post<{ activity: CrmActivity }>(`/api/crm/leads/${leadId}/activities`, payload, { token });
}

export function updateCrmActivity(token: string, leadId: string, activityId: string, payload: Partial<Pick<CrmActivity, 'status' | 'priority' | 'subject' | 'body' | 'dueAt' | 'communicationDirection' | 'communicationOutcome' | 'templateKey'>> & { assignedToId?: string | null }) {
  return apiClient.patch<{ activity: CrmActivity }>(`/api/crm/leads/${leadId}/activities/${activityId}`, payload, { token });
}

export type CrmAnalytics = {
  total: number;
  newLeads: number;
  openLeads: number;
  overdueFollowUps: number;
  openTasks: number;
  overdueTasks: number;
  won: number;
  lost: number;
  conversionRate: number | null;
  byStatus: Partial<Record<CrmLeadStatus, number>>;
  bySource: Array<{ source: CrmLeadSource; total: number; won: number; lost: number; open: number; conversionRate: number | null }>;
};

export type CrmPipelineGroupBy = 'status' | 'assignedTo' | 'source' | 'company';
export type CrmPipelineGroup = {
  key: string;
  label: string;
  count: number;
  valuesByCurrency: Record<string, number>;
  leads: CrmLead[];
};

export type CrmCommunicationTemplate = {
  key: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  emailHref?: string | null;
  whatsappHref?: string | null;
};

export function getCrmAnalytics(token: string, filters: CrmLeadFilters = {}) {
  return apiClient.get<{ analytics: CrmAnalytics }>('/api/crm/analytics', { token, params: filters });
}

export function getCrmPipeline(token: string, filters: CrmLeadFilters & { groupBy?: CrmPipelineGroupBy; take?: number } = {}) {
  return apiClient.get<{ pipeline: { groupBy: CrmPipelineGroupBy; groups: CrmPipelineGroup[]; total: number; limited: boolean } }>('/api/crm/pipeline', { token, params: filters });
}

export function listCrmTasks(token: string, filters: {
  companyId?: string;
  workspace?: 'personal' | 'all' | 'admin';
  assignedToId?: string;
  taskStatus?: CrmActivityStatus;
  taskPriority?: CrmActivityPriority;
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  take?: number;
} = {}) {
  return apiClient.get<{
    tasks: Array<CrmActivity & { lead: Pick<CrmLead, 'id' | 'title' | 'status' | 'priority' | 'companyId' | 'ownerUserId'> & { contact: CrmLead['contact']; company?: CrmLead['company'] } }>;
    summary: { total: number; overdue: number };
    limited: boolean;
  }>('/api/crm/tasks', { token, params: filters });
}

export function getCrmCommunicationTemplates(token: string, leadId: string) {
  return apiClient.get<{
    templates: CrmCommunicationTemplate[];
    delivery: { email: 'draft_only'; whatsapp: 'draft_only'; note: string };
  }>(`/api/crm/leads/${leadId}/communication-templates`, { token });
}
