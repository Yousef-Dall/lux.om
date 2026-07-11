import { z } from 'zod';

export const crmContractVersion = '2026-07-11.stage21i-a' as const;
export const crmLeadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'VIEWING_SCHEDULED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'] as const;
export const crmLeadPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const crmLeadSources = ['LISTING_INQUIRY', 'PROJECT_INQUIRY', 'DEVELOPER_PROFILE', 'TRAVEL_AGENCY_PROFILE', 'ACTIVITY_INQUIRY', 'ACTIVITY_BOOKING', 'MAP_DISCOVERY', 'CONTACT_FORM', 'INVESTOR_WATCHLIST', 'VALUATION_REQUEST', 'SAVED_SEARCH', 'PMS_OWNER', 'PMS_TENANT', 'PMS_MAINTENANCE_VENDOR', 'MANUAL', 'ADMIN_CREATED'] as const;
export const crmActivityTypes = ['NOTE', 'TASK', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'SYSTEM_NOTIFICATION', 'STATUS_CHANGE', 'ASSIGNMENT'] as const;
export const crmActivityStatuses = ['OPEN', 'COMPLETED', 'CANCELLED'] as const;
export const crmActivityPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const crmCommunicationDirections = ['INBOUND', 'OUTBOUND', 'INTERNAL'] as const;
export const crmCommunicationOutcomes = ['DRAFT_OPENED', 'SENT_EXTERNALLY', 'NO_ANSWER', 'CONNECTED', 'REPLIED'] as const;
export const workspaceTypes = ['PERSONAL', 'COMPANY', 'PLATFORM'] as const;
export const workspacePermissionKeys = ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'] as const;
export const crmAccountTypes = ['INDIVIDUAL', 'COMPANY', 'DEVELOPER', 'TRAVEL_AGENCY', 'ACTIVITY_PROVIDER', 'PROPERTY_OWNER', 'INVESTOR', 'VENDOR', 'TENANT_ORGANIZATION', 'GOVERNMENT', 'INSTITUTIONAL_PARTNER', 'OTHER'] as const;
export const crmDealOutcomes = ['OPEN', 'WON', 'LOST'] as const;
export const crmForecastCategories = ['PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED'] as const;
export const crmPipelineStageTypes = ['OPEN', 'WON', 'LOST'] as const;
export const crmScoreBands = ['COLD', 'WARM', 'HOT'] as const;
export const crmScoreTrends = ['RISING', 'STABLE', 'FALLING'] as const;
export const crmCommunicationChannels = ['EMAIL', 'WHATSAPP', 'PHONE'] as const;
export const crmContactConsentStatuses = ['UNKNOWN', 'CONSENTED', 'LEGITIMATE_INTEREST', 'OPTED_OUT', 'BLOCKED'] as const;
export const crmDeliveryStatuses = ['DRAFT', 'QUEUED', 'PROCESSING', 'SUBMITTED', 'DELIVERED', 'FAILED', 'BOUNCED', 'BLOCKED', 'CANCELLED'] as const;

export const crmWorkspaceSummarySchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(workspaceTypes),
  companyId: z.string().nullable(),
  personalOwnerUserId: z.string().nullable(),
  canView: z.boolean(),
  canManage: z.boolean(),
  canAssign: z.boolean(),
  canManageWorkspace: z.boolean(),
  propertyScope: z.object({ allProperties: z.boolean(), propertyIds: z.array(z.string()) })
});

export const crmAccessResponseSchema = z.object({
  access: z.object({
    hasAccess: z.boolean(),
    isAdmin: z.boolean(),
    personalWorkspace: z.object({ enabled: z.boolean(), canView: z.boolean(), canManage: z.boolean(), workspaceId: z.string().optional() }),
    companyWorkspaces: z.array(crmWorkspaceSummarySchema),
    workspaces: z.array(crmWorkspaceSummarySchema)
  })
});

export type CrmWorkspaceSummaryContract = z.infer<typeof crmWorkspaceSummarySchema>;
