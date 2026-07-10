import { Router } from 'express';
import type { CrmLeadStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  assertCanCreateCrmLead,
  assertCrmWorkspaceAccess,
  assertHasAnyCrmAccess,
  buildCrmLeadScope,
  getCrmAccess
} from '../lib/crmAccess';
import { buildCrmCommunicationTemplates, calculateCrmLeadIntelligence, type CrmLeadIntelligenceInput } from '../lib/crmIntelligence';
import { prisma } from '../lib/prisma';
import { getPmsPermissionKeys } from '../lib/pmsPermissions';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const crmRouter = Router();

const leadStatuses = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'VIEWING_SCHEDULED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'ARCHIVED'
] as const;
const leadPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const leadSources = [
  'LISTING_INQUIRY',
  'PROJECT_INQUIRY',
  'DEVELOPER_PROFILE',
  'TRAVEL_AGENCY_PROFILE',
  'ACTIVITY_INQUIRY',
  'ACTIVITY_BOOKING',
  'MAP_DISCOVERY',
  'CONTACT_FORM',
  'INVESTOR_WATCHLIST',
  'VALUATION_REQUEST',
  'SAVED_SEARCH',
  'PMS_OWNER',
  'PMS_TENANT',
  'PMS_MAINTENANCE_VENDOR',
  'MANUAL',
  'ADMIN_CREATED'
] as const;
const activityTypes = ['NOTE', 'TASK', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING'] as const;
const activityStatuses = ['OPEN', 'COMPLETED', 'CANCELLED'] as const;
const activityPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const communicationDirections = ['INBOUND', 'OUTBOUND', 'INTERNAL'] as const;
const communicationOutcomes = ['DRAFT_OPENED', 'SENT_EXTERNALLY', 'NO_ANSWER', 'CONNECTED', 'REPLIED'] as const;
const pipelineGroupings = ['status', 'assignedTo', 'source', 'company'] as const;

const idParamsSchema = z.object({ id: z.string().min(1) });
const activityParamsSchema = z.object({ id: z.string().min(1), activityId: z.string().min(1) });
const nullableDateSchema = z.union([z.string().datetime(), z.null()]).optional();
const nullableIdSchema = z.union([z.string().min(1), z.null()]).optional();

const contactInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    email: z.union([z.string().trim().email().toLowerCase(), z.literal('')]).optional(),
    phone: z.union([z.string().trim().min(6).max(40), z.literal('')]).optional(),
    notes: z.string().trim().max(3000).optional(),
    userId: nullableIdSchema,
    pmsTenantId: nullableIdSchema
  })
  .strict();

const sourceReferenceSchema = z
  .object({
    inquiryId: nullableIdSchema,
    bookingId: nullableIdSchema,
    listingId: nullableIdSchema,
    activityId: nullableIdSchema,
    developerProjectId: nullableIdSchema,
    valuationRequestId: nullableIdSchema,
    savedSearchId: nullableIdSchema,
    watchlistItemId: nullableIdSchema,
    pmsTenantId: nullableIdSchema,
    pmsPropertyId: nullableIdSchema,
    pmsVendorId: nullableIdSchema
  })
  .strict();

const createLeadSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(leadPriorities).default('MEDIUM'),
    source: z.enum(leadSources).default('MANUAL'),
    sourceLabel: z.string().trim().max(240).optional(),
    expectedValue: z.coerce.number().min(0).max(1_000_000_000).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).default('OMR'),
    nextFollowUpAt: nullableDateSchema,
    companyId: nullableIdSchema,
    ownerUserId: nullableIdSchema,
    assignedToId: nullableIdSchema,
    contactId: z.string().min(1).optional(),
    contact: contactInputSchema.optional(),
    sourceReferences: sourceReferenceSchema.default({})
  })
  .strict()
  .refine((data) => Boolean(data.contactId || data.contact), {
    message: 'Choose an existing contact or provide contact details.',
    path: ['contact']
  });

const crmFilterQueryShape = {
  companyId: z.string().min(1).optional(),
  workspace: z.enum(['personal', 'all', 'admin']).optional(),
  source: z.enum(leadSources).optional(),
  status: z.enum(leadStatuses).optional(),
  priority: z.enum(leadPriorities).optional(),
  assignedToId: z.string().min(1).optional(),
  search: z.string().trim().max(160).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
};

function validateCrmDateRange(data: { from?: string; to?: string }, context: z.RefinementCtx) {
  if (data.from && data.to && new Date(data.from) > new Date(data.to)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'The CRM date range is invalid.', path: ['to'] });
  }
}

const crmFilterQuerySchema = z.object(crmFilterQueryShape).superRefine(validateCrmDateRange);
const listQuerySchema = z
  .object({
    ...crmFilterQueryShape,
    take: z.coerce.number().int().min(1).max(100).default(30),
    skip: z.coerce.number().int().min(0).default(0)
  })
  .superRefine(validateCrmDateRange);
const pipelineQuerySchema = z
  .object({
    ...crmFilterQueryShape,
    groupBy: z.enum(pipelineGroupings).default('status'),
    take: z.coerce.number().int().min(1).max(200).default(120)
  })
  .superRefine(validateCrmDateRange);
const taskQuerySchema = z
  .object({
    companyId: z.string().min(1).optional(),
    workspace: z.enum(['personal', 'all', 'admin']).optional(),
    assignedToId: z.string().min(1).optional(),
    taskStatus: z.enum(activityStatuses).optional(),
    taskPriority: z.enum(activityPriorities).optional(),
    overdue: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    dueFrom: z.string().datetime().optional(),
    dueTo: z.string().datetime().optional(),
    take: z.coerce.number().int().min(1).max(100).default(50)
  })
  .superRefine((data, context) => {
    if (data.dueFrom && data.dueTo && new Date(data.dueFrom) > new Date(data.dueTo)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'The CRM task date range is invalid.', path: ['dueTo'] });
    }
  });

const updateLeadSchema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    description: z.union([z.string().trim().max(5000), z.null()]).optional(),
    status: z.enum(leadStatuses).optional(),
    priority: z.enum(leadPriorities).optional(),
    assignedToId: nullableIdSchema,
    expectedValue: z.union([z.coerce.number().min(0).max(1_000_000_000), z.null()]).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional(),
    nextFollowUpAt: nullableDateSchema,
    lostReason: z.union([z.string().trim().max(2000), z.null()]).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required.' });

const createActivitySchema = z
  .object({
    type: z.enum(activityTypes),
    status: z.enum(activityStatuses).optional(),
    priority: z.enum(activityPriorities).default('MEDIUM'),
    subject: z.string().trim().min(2).max(180),
    body: z.string().trim().max(5000).optional(),
    dueAt: nullableDateSchema,
    assignedToId: nullableIdSchema,
    communicationDirection: z.enum(communicationDirections).optional(),
    communicationOutcome: z.enum(communicationOutcomes).optional(),
    templateKey: z.string().trim().min(2).max(80).optional()
  })
  .strict();

const updateActivitySchema = z
  .object({
    status: z.enum(activityStatuses).optional(),
    priority: z.enum(activityPriorities).optional(),
    subject: z.string().trim().min(2).max(180).optional(),
    body: z.union([z.string().trim().max(5000), z.null()]).optional(),
    dueAt: nullableDateSchema,
    assignedToId: nullableIdSchema,
    communicationDirection: z.union([z.enum(communicationDirections), z.null()]).optional(),
    communicationOutcome: z.union([z.enum(communicationOutcomes), z.null()]).optional(),
    templateKey: z.union([z.string().trim().min(2).max(80), z.null()]).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required.' });

const intelligenceActivitySelect = {
  type: true,
  status: true,
  dueAt: true,
  completedAt: true,
  createdAt: true
} satisfies Prisma.CrmActivitySelect;

const leadListInclude = {
  contact: { select: { id: true, fullName: true, email: true, phone: true } },
  company: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  ownerUser: { select: { id: true, name: true, email: true, role: true } },
  listing: { select: { id: true, slug: true, title: true, titleEn: true, titleAr: true } },
  activity: { select: { id: true, slug: true, titleEn: true, titleAr: true } },
  developerProject: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
  pmsProperty: { select: { id: true, name: true, code: true } },
  inquiry: { select: { id: true, createdAt: true } },
  booking: { select: { id: true, status: true, createdAt: true, payment: { select: { status: true } } } },
  activities: {
    select: intelligenceActivitySelect,
    orderBy: { createdAt: 'desc' as const },
    take: 50
  },
  _count: { select: { activities: { where: { status: 'OPEN' } } } }
} satisfies Prisma.CrmLeadInclude;

const leadDetailInclude = {
  ...leadListInclude,
  contact: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      notes: true,
      userId: true,
      pmsTenantId: true
    }
  },
  inquiry: { select: { id: true, type: true, message: true, createdAt: true } },
  booking: { select: { id: true, status: true, scheduledDate: true, preferredTime: true, guests: true, createdAt: true, payment: { select: { status: true } } } },
  valuationRequest: { select: { id: true, status: true, location: true, estimateLow: true, estimateHigh: true } },
  savedSearch: { select: { id: true, name: true, category: true } },
  watchlistItem: { select: { id: true, targetPrice: true, notes: true } },
  pmsTenant: { select: { id: true, fullName: true, email: true, phone: true } },
  pmsVendor: { select: { id: true, name: true, email: true, phone: true, trade: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
  activities: {
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' as const }
  }
} satisfies Prisma.CrmLeadInclude;

const allowedTransitions: Record<CrmLeadStatus, readonly CrmLeadStatus[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'LOST', 'ARCHIVED'],
  CONTACTED: ['QUALIFIED', 'LOST', 'ARCHIVED'],
  QUALIFIED: ['VIEWING_SCHEDULED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'],
  VIEWING_SCHEDULED: ['QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'],
  PROPOSAL_SENT: ['NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'],
  NEGOTIATION: ['WON', 'LOST', 'ARCHIVED'],
  WON: ['ARCHIVED'],
  LOST: ['NEW', 'ARCHIVED'],
  ARCHIVED: ['NEW']
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  const normalized = value?.replace(/[^+\d]/g, '').trim();
  return normalized || null;
}

function assertStatusTransition(current: CrmLeadStatus, next: CrmLeadStatus) {
  if (current === next) return;
  if (!allowedTransitions[current].includes(next)) {
    throw new AppError(400, `Lead status cannot move from ${current} to ${next}.`);
  }
}

type CrmFilterQuery = z.infer<typeof crmFilterQuerySchema>;
type CrmAccessValue = Awaited<ReturnType<typeof getCrmAccess>>;
type IntelligenceLeadRecord = CrmLeadIntelligenceInput & { contactId: string };

function buildCrmLeadWhere(
  access: CrmAccessValue,
  query: CrmFilterQuery,
  permission: 'view' | 'manage' = 'view'
): Prisma.CrmLeadWhereInput {
  if (query.workspace === 'admin' && !access.isAdmin) {
    throw new AppError(403, 'The lux.om admin CRM workspace is restricted to administrators.');
  }
  const search = query.search?.trim();
  return {
    AND: [
      buildCrmLeadScope(access, permission),
      query.companyId ? { companyId: query.companyId } : {},
      query.workspace === 'personal' ? { ownerUserId: access.userId } : {},
      query.workspace === 'admin' ? { companyId: null, ownerUserId: null } : {},
      query.source ? { source: query.source } : {},
      query.status ? { status: query.status } : {},
      query.priority ? { priority: query.priority } : {},
      query.assignedToId ? { assignedToId: query.assignedToId } : {},
      query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {},
      search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { sourceLabel: { contains: search, mode: 'insensitive' } },
              { contact: { fullName: { contains: search, mode: 'insensitive' } } },
              { contact: { email: { contains: search, mode: 'insensitive' } } },
              { contact: { phone: { contains: search, mode: 'insensitive' } } }
            ]
          }
        : {}
    ]
  };
}

async function enrichCrmLeads<T extends IntelligenceLeadRecord>(
  leads: T[],
  scope: Prisma.CrmLeadWhereInput
): Promise<Array<T & { intelligence: ReturnType<typeof calculateCrmLeadIntelligence> }>> {
  if (leads.length === 0) return [];
  const contactIds = [...new Set(leads.map((lead) => lead.contactId))];
  const repeatCounts = await prisma.crmLead.groupBy({
    by: ['contactId'],
    where: { AND: [scope, { contactId: { in: contactIds } }] },
    _count: { _all: true }
  });
  const countByContact = new Map(repeatCounts.map((item) => [item.contactId, item._count._all]));

  return leads.map((lead) => ({
    ...lead,
    intelligence: calculateCrmLeadIntelligence({
      ...lead,
      repeatEngagementCount: countByContact.get(lead.contactId) ?? 1
    })
  }));
}

async function getLeadForAccess(id: string, access: CrmAccessValue, permission: 'view' | 'manage') {
  const scope = buildCrmLeadScope(access, permission);
  const lead = await prisma.crmLead.findFirst({
    where: { AND: [{ id }, scope] },
    include: leadDetailInclude
  });
  if (!lead) throw new AppError(404, 'CRM lead not found.');
  const [enriched] = await enrichCrmLeads([lead], scope);
  return enriched;
}

async function assertAssignmentAllowed(
  access: Awaited<ReturnType<typeof getCrmAccess>>,
  lead: { companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null },
  assignedToId?: string | null
) {
  if (!assignedToId) return;
  const user = await prisma.user.findFirst({
    where: { id: assignedToId, suspendedAt: null, deactivatedAt: null },
    select: { id: true, role: true }
  });
  if (!user) throw new AppError(400, 'Assigned user is not active.');

  if (
    lead.ownerUserId === assignedToId &&
    (access.isAdmin || access.userId === lead.ownerUserId)
  ) {
    return;
  }

  if (lead.companyId) {
    const member = await prisma.pmsCompanyMember.findFirst({
      where: {
        companyId: lead.companyId,
        userId: assignedToId,
        active: true,
        company: {
          pmsEntitlement: {
            is: { status: { in: ['ACTIVE', 'TRIAL'] }, disabledAt: null }
          }
        }
      },
      select: {
        role: true,
        permissions: { where: { active: true }, select: { key: true } },
        propertyAccesses: { where: { active: true }, select: { propertyId: true } }
      }
    });

    if (member) {
      const permissions = new Set([
        ...getPmsPermissionKeys(member.role),
        ...member.permissions.map((permission) => permission.key)
      ]);
      if (permissions.has('CRM_VIEW')) {
        const scopedPropertyIds = member.propertyAccesses.map((scope) => scope.propertyId);
        if (scopedPropertyIds.length === 0) return;
        if (lead.pmsPropertyId && scopedPropertyIds.includes(lead.pmsPropertyId)) return;
      }
    }

    throw new AppError(403, 'Company leads can only be assigned to CRM-enabled members inside the property scope.');
  }

  if (lead.ownerUserId) {
    if (access.isAdmin && user.role === 'ADMIN') return;
    throw new AppError(403, 'Personal leads can only be assigned to their owner or a lux.om admin.');
  }

  if (access.isAdmin && user.role === 'ADMIN') return;
  throw new AppError(403, 'Admin CRM leads can only be assigned to lux.om administrators.');
}

async function validateSourceReferences(
  access: Awaited<ReturnType<typeof getCrmAccess>>,
  workspace: { companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null },
  refs: z.infer<typeof sourceReferenceSchema>
) {
  if (workspace.pmsPropertyId) {
    const property = await prisma.pmsProperty.findFirst({
      where: { id: workspace.pmsPropertyId, ...(workspace.companyId ? { companyId: workspace.companyId } : {}) },
      select: { id: true, companyId: true }
    });
    if (!property) throw new AppError(400, 'PMS property does not belong to this CRM workspace.');
  }

  if (refs.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: refs.listingId }, select: { id: true, ownerId: true, developerId: true } });
    if (!listing) throw new AppError(404, 'Listing source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== listing.ownerId && (!workspace.companyId || workspace.companyId !== listing.developerId)) {
      throw new AppError(403, 'Listing source is outside this CRM workspace.');
    }
  }

  if (refs.activityId) {
    const activity = await prisma.activity.findUnique({ where: { id: refs.activityId }, select: { id: true, ownerId: true } });
    if (!activity) throw new AppError(404, 'Activity source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== activity.ownerId) throw new AppError(403, 'Activity source is outside this CRM workspace.');
  }

  if (refs.developerProjectId) {
    const project = await prisma.developerProject.findUnique({ where: { id: refs.developerProjectId }, select: { id: true, ownerId: true, developerId: true } });
    if (!project) throw new AppError(404, 'Project source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== project.ownerId && workspace.companyId !== project.developerId) {
      throw new AppError(403, 'Project source is outside this CRM workspace.');
    }
  }

  if (refs.pmsTenantId) {
    const tenant = await prisma.pmsTenant.findUnique({ where: { id: refs.pmsTenantId }, select: { id: true, companyId: true } });
    if (!tenant) throw new AppError(404, 'PMS tenant source not found.');
    if (workspace.companyId !== tenant.companyId) throw new AppError(403, 'PMS tenant source is outside this CRM workspace.');
    if (workspace.pmsPropertyId) {
      const linkedLease = await prisma.pmsLease.findFirst({
        where: { tenantId: tenant.id, propertyId: workspace.pmsPropertyId },
        select: { id: true }
      });
      if (!linkedLease) throw new AppError(403, 'PMS tenant is not linked to the selected property.');
    }
  }

  if (refs.pmsVendorId) {
    const vendor = await prisma.pmsVendor.findUnique({ where: { id: refs.pmsVendorId }, select: { id: true, companyId: true } });
    if (!vendor) throw new AppError(404, 'PMS vendor source not found.');
    if (workspace.companyId !== vendor.companyId) throw new AppError(403, 'PMS vendor source is outside this CRM workspace.');
  }

  if (refs.inquiryId) {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: refs.inquiryId },
      select: { id: true, listing: { select: { ownerId: true, developerId: true } }, activity: { select: { ownerId: true } } }
    });
    if (!inquiry) throw new AppError(404, 'Inquiry source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== inquiry.listing?.ownerId && workspace.ownerUserId !== inquiry.activity?.ownerId && workspace.companyId !== inquiry.listing?.developerId) {
      throw new AppError(403, 'Inquiry source is outside this CRM workspace.');
    }
  }

  if (refs.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: refs.bookingId },
      select: { id: true, listing: { select: { ownerId: true, developerId: true } }, activity: { select: { ownerId: true } } }
    });
    if (!booking) throw new AppError(404, 'Booking source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== booking.listing?.ownerId && workspace.ownerUserId !== booking.activity?.ownerId && workspace.companyId !== booking.listing?.developerId) {
      throw new AppError(403, 'Booking source is outside this CRM workspace.');
    }
  }

  if (refs.valuationRequestId) {
    const valuation = await prisma.valuationRequest.findUnique({
      where: { id: refs.valuationRequestId },
      select: { id: true, listing: { select: { ownerId: true, developerId: true } } }
    });
    if (!valuation) throw new AppError(404, 'Valuation source not found.');
    if (!access.isAdmin && workspace.ownerUserId !== valuation.listing?.ownerId && workspace.companyId !== valuation.listing?.developerId) {
      throw new AppError(403, 'Valuation source is outside this CRM workspace.');
    }
  }

  if ((refs.savedSearchId || refs.watchlistItemId) && !access.isAdmin) {
    throw new AppError(403, 'Saved-search and investor-watchlist signals require admin CRM access in this stage.');
  }

  if (refs.savedSearchId) {
    const savedSearch = await prisma.savedSearch.findUnique({ where: { id: refs.savedSearchId }, select: { id: true } });
    if (!savedSearch) throw new AppError(404, 'Saved-search source not found.');
  }

  if (refs.watchlistItemId) {
    const watchlistItem = await prisma.investorWatchlistItem.findUnique({ where: { id: refs.watchlistItemId }, select: { id: true } });
    if (!watchlistItem) throw new AppError(404, 'Investor-watchlist source not found.');
  }
}

async function findOrCreateContact(
  tx: Prisma.TransactionClient,
  actorId: string,
  workspace: { companyId?: string | null; ownerUserId?: string | null },
  contactId: string | undefined,
  input: z.infer<typeof contactInputSchema> | undefined
) {
  if (contactId) {
    const contact = await tx.crmContact.findFirst({
      where: { id: contactId, companyId: workspace.companyId ?? null, ownerUserId: workspace.ownerUserId ?? null }
    });
    if (!contact) throw new AppError(404, 'CRM contact not found in this workspace.');
    return contact;
  }

  if (!input) throw new AppError(400, 'Contact details are required.');
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const matchTerms = [
    ...(normalizedEmail ? [{ normalizedEmail }] : []),
    ...(normalizedPhone ? [{ normalizedPhone }] : [])
  ];
  const existing = matchTerms.length
    ? await tx.crmContact.findFirst({
        where: {
          companyId: workspace.companyId ?? null,
          ownerUserId: workspace.ownerUserId ?? null,
          OR: matchTerms
        },
        orderBy: { updatedAt: 'desc' }
      })
    : null;

  if (existing) {
    return tx.crmContact.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        normalizedEmail,
        normalizedPhone,
        notes: input.notes,
        userId: input.userId,
        pmsTenantId: input.pmsTenantId
      }
    });
  }

  return tx.crmContact.create({
    data: {
      fullName: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      normalizedEmail,
      normalizedPhone,
      notes: input.notes,
      companyId: workspace.companyId ?? null,
      ownerUserId: workspace.ownerUserId ?? null,
      userId: input.userId ?? null,
      pmsTenantId: input.pmsTenantId ?? null,
      createdById: actorId
    }
  });
}

crmRouter.use(requireAuth());

crmRouter.get('/access', async (req, res, next) => {
  try {
    const access = await getCrmAccess(req.user!);
    res.json({
      access: {
        hasAccess: access.isAdmin || access.personalWorkspace.canView || access.companyWorkspaces.some((workspace) => workspace.canView),
        isAdmin: access.isAdmin,
        personalWorkspace: access.personalWorkspace,
        companyWorkspaces: access.companyWorkspaces
      }
    });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/properties', async (req, res, next) => {
  try {
    const companyId = z.string().min(1).parse(req.query.companyId);
    const access = await getCrmAccess(req.user!);
    const workspace = access.companyWorkspaces.find((item) => item.companyId === companyId && item.canView);
    if (!access.isAdmin && !workspace) throw new AppError(403, 'Company CRM workspace is not available.');
    const properties = await prisma.pmsProperty.findMany({
      where: {
        companyId,
        active: true,
        ...(!access.isAdmin && workspace && !workspace.propertyScope.allProperties
          ? { id: { in: workspace.propertyScope.propertyIds } }
          : {})
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' }
    });
    res.json({ properties });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/assignees', async (req, res, next) => {
  try {
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const query = z
      .object({ companyId: z.string().min(1).optional(), propertyId: z.string().min(1).optional() })
      .parse(req.query);

    if (!query.companyId) {
      res.json({ assignees: [{ id: req.user!.id, name: req.user!.name, email: req.user!.email, role: req.user!.role }] });
      return;
    }

    const workspace = access.companyWorkspaces.find((item) => item.companyId === query.companyId && item.canView);
    if (!access.isAdmin && !workspace) throw new AppError(403, 'Company CRM workspace is not available.');
    if (query.propertyId) {
      const property = await prisma.pmsProperty.findFirst({
        where: { id: query.propertyId, companyId: query.companyId, active: true },
        select: { id: true }
      });
      if (!property) throw new AppError(404, 'PMS property not found in this CRM workspace.');
      if (
        !access.isAdmin &&
        workspace &&
        !workspace.propertyScope.allProperties &&
        !workspace.propertyScope.propertyIds.includes(query.propertyId)
      ) {
        throw new AppError(403, 'PMS property is outside your CRM scope.');
      }
    }

    const members = await prisma.pmsCompanyMember.findMany({
      where: { companyId: query.companyId, active: true, user: { suspendedAt: null, deactivatedAt: null } },
      select: {
        role: true,
        permissions: { where: { active: true }, select: { key: true } },
        propertyAccesses: { where: { active: true }, select: { propertyId: true } },
        user: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    const assignees = members
      .filter((member) => {
        const permissions = new Set([
          ...getPmsPermissionKeys(member.role),
          ...member.permissions.map((permission) => permission.key)
        ]);
        if (!permissions.has('CRM_VIEW')) return false;
        const scopedPropertyIds = member.propertyAccesses.map((scope) => scope.propertyId);
        return query.propertyId
          ? scopedPropertyIds.length === 0 || scopedPropertyIds.includes(query.propertyId)
          : scopedPropertyIds.length === 0;
      })
      .map((member) => member.user);
    res.json({ assignees });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/analytics', async (req, res, next) => {
  try {
    const query = crmFilterQuerySchema.parse(req.query);
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const where = buildCrmLeadWhere(access, query);
    const now = new Date();
    const closedStatuses: CrmLeadStatus[] = ['WON', 'LOST', 'ARCHIVED'];

    const [statusCounts, sourceCounts, overdueFollowUps, openTasks, overdueTasks] = await prisma.$transaction([
      prisma.crmLead.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.crmLead.groupBy({ by: ['source', 'status'], where, _count: { _all: true } }),
      prisma.crmLead.count({
        where: {
          AND: [
            where,
            { status: { notIn: closedStatuses } },
            {
              OR: [
                { nextFollowUpAt: { lt: now } },
                { activities: { some: { type: 'TASK', status: 'OPEN', dueAt: { lt: now } } } }
              ]
            }
          ]
        }
      }),
      prisma.crmActivity.count({
        where: { type: 'TASK', status: 'OPEN', lead: { is: where } }
      }),
      prisma.crmActivity.count({
        where: { type: 'TASK', status: 'OPEN', dueAt: { lt: now }, lead: { is: where } }
      })
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((item) => [item.status, item._count._all])) as Partial<Record<CrmLeadStatus, number>>;
    const total = statusCounts.reduce((sum, item) => sum + item._count._all, 0);
    const won = byStatus.WON ?? 0;
    const lost = byStatus.LOST ?? 0;
    const decided = won + lost;
    const sourceMap = new Map<string, { source: string; total: number; won: number; lost: number; open: number }>();
    for (const item of sourceCounts) {
      const current = sourceMap.get(item.source) ?? { source: item.source, total: 0, won: 0, lost: 0, open: 0 };
      current.total += item._count._all;
      if (item.status === 'WON') current.won += item._count._all;
      else if (item.status === 'LOST') current.lost += item._count._all;
      else if (item.status !== 'ARCHIVED') current.open += item._count._all;
      sourceMap.set(item.source, current);
    }

    res.json({
      analytics: {
        total,
        newLeads: byStatus.NEW ?? 0,
        openLeads: statusCounts.filter((item) => !closedStatuses.includes(item.status)).reduce((sum, item) => sum + item._count._all, 0),
        overdueFollowUps,
        openTasks,
        overdueTasks,
        won,
        lost,
        conversionRate: decided > 0 ? Number(((won / decided) * 100).toFixed(1)) : null,
        byStatus,
        bySource: [...sourceMap.values()]
          .map((item) => ({
            ...item,
            conversionRate: item.won + item.lost > 0 ? Number(((item.won / (item.won + item.lost)) * 100).toFixed(1)) : null
          }))
          .sort((left, right) => right.total - left.total || left.source.localeCompare(right.source))
      }
    });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/pipeline', async (req, res, next) => {
  try {
    const query = pipelineQuerySchema.parse(req.query);
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const where = buildCrmLeadWhere(access, query);
    const rawLeads = await prisma.crmLead.findMany({
      where,
      include: leadListInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.take
    });
    const leads = await enrichCrmLeads(rawLeads, buildCrmLeadScope(access, 'view'));
    const groups = new Map<string, { key: string; label: string; leads: typeof leads; valuesByCurrency: Record<string, number> }>();

    for (const lead of leads) {
      const group = query.groupBy === 'status'
        ? { key: lead.status, label: lead.status.replace(/_/g, ' ') }
        : query.groupBy === 'assignedTo'
          ? { key: lead.assignedTo?.id ?? 'unassigned', label: lead.assignedTo?.name ?? 'Unassigned' }
          : query.groupBy === 'source'
            ? { key: lead.source, label: lead.source.replace(/_/g, ' ') }
            : lead.company
              ? { key: `company:${lead.company.id}`, label: lead.company.nameEn }
              : lead.ownerUser
                ? { key: `personal:${lead.ownerUser.id}`, label: `${lead.ownerUser.name} · Personal` }
                : { key: 'admin', label: 'lux.om admin' };
      const bucket = groups.get(group.key) ?? { ...group, leads: [], valuesByCurrency: {} };
      bucket.leads.push(lead);
      if (lead.expectedValue !== null) {
        const amount = Number(lead.expectedValue);
        if (Number.isFinite(amount)) bucket.valuesByCurrency[lead.currency] = (bucket.valuesByCurrency[lead.currency] ?? 0) + amount;
      }
      groups.set(group.key, bucket);
    }

    const statusOrder = new Map(leadStatuses.map((status, index) => [status, index]));
    const result = [...groups.values()]
      .map((group) => ({ ...group, count: group.leads.length }))
      .sort((left, right) => query.groupBy === 'status'
        ? (statusOrder.get(left.key as CrmLeadStatus) ?? 99) - (statusOrder.get(right.key as CrmLeadStatus) ?? 99)
        : left.label.localeCompare(right.label));

    res.json({ pipeline: { groupBy: query.groupBy, groups: result, total: leads.length, limited: rawLeads.length === query.take } });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/tasks', async (req, res, next) => {
  try {
    const query = taskQuerySchema.parse(req.query);
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const leadWhere = buildCrmLeadWhere(access, { companyId: query.companyId, workspace: query.workspace });
    const now = new Date();
    const where: Prisma.CrmActivityWhereInput = {
      type: 'TASK',
      lead: { is: leadWhere },
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.taskStatus ? { status: query.taskStatus } : {}),
      ...(query.taskPriority ? { priority: query.taskPriority } : {}),
      ...(query.overdue ? { status: 'OPEN', dueAt: { lt: now } } : {}),
      ...(query.dueFrom || query.dueTo
        ? { dueAt: { ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}), ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}) } }
        : {})
    };
    const [tasks, total, overdue] = await prisma.$transaction([
      prisma.crmActivity.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              companyId: true,
              ownerUserId: true,
              pmsPropertyId: true,
              contact: { select: { id: true, fullName: true, email: true, phone: true } },
              company: { select: { id: true, nameEn: true, nameAr: true } }
            }
          }
        },
        orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        take: query.take
      }),
      prisma.crmActivity.count({ where }),
      prisma.crmActivity.count({ where: { AND: [where, { status: 'OPEN', dueAt: { lt: now } }] } })
    ]);
    res.json({ tasks, summary: { total, overdue }, limited: tasks.length === query.take });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/leads', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const where = buildCrmLeadWhere(access, query);

    const [rawLeads, total, statusCounts] = await prisma.$transaction([
      prisma.crmLead.findMany({
        where,
        include: leadListInclude,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: query.take,
        skip: query.skip
      }),
      prisma.crmLead.count({ where }),
      prisma.crmLead.groupBy({ by: ['status'], where, _count: { _all: true } })
    ]);
    const leads = await enrichCrmLeads(rawLeads, buildCrmLeadScope(access, 'view'));

    res.json({
      leads,
      summary: {
        total,
        byStatus: Object.fromEntries(statusCounts.map((item) => [item.status, item._count._all]))
      },
      pagination: { take: query.take, skip: query.skip, total, count: leads.length }
    });
  } catch (error) {
    next(error);
  }
});

crmRouter.post('/leads', async (req, res, next) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const access = await getCrmAccess(req.user!);
    const ownerUserId = data.companyId
      ? null
      : access.isAdmin
        ? data.ownerUserId ?? null
        : req.user!.id;
    if (data.companyId && data.ownerUserId) {
      throw new AppError(400, 'Company CRM leads cannot also be assigned to a personal workspace.');
    }
    if (data.contact?.pmsTenantId && data.sourceReferences.pmsTenantId && data.contact.pmsTenantId !== data.sourceReferences.pmsTenantId) {
      throw new AppError(400, 'Contact tenant and CRM source tenant must match.');
    }
    const sourceReferences = {
      ...data.sourceReferences,
      pmsTenantId: data.sourceReferences.pmsTenantId ?? data.contact?.pmsTenantId
    };
    const workspace = {
      companyId: data.companyId ?? null,
      ownerUserId,
      pmsPropertyId: sourceReferences.pmsPropertyId ?? null
    };
    assertCanCreateCrmLead(access, workspace);
    await validateSourceReferences(access, workspace, sourceReferences);
    await assertAssignmentAllowed(access, workspace, data.assignedToId ?? ownerUserId);

    const rawLead = await prisma.$transaction(async (tx) => {
      const contact = await findOrCreateContact(tx, req.user!.id, workspace, data.contactId, data.contact);
      return tx.crmLead.create({
        data: {
          title: data.title,
          description: data.description,
          priority: data.priority,
          source: data.source,
          sourceLabel: data.sourceLabel,
          expectedValue: data.expectedValue,
          currency: data.currency,
          nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
          contactId: contact.id,
          companyId: workspace.companyId,
          ownerUserId: workspace.ownerUserId,
          assignedToId: data.assignedToId ?? ownerUserId,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          inquiryId: sourceReferences.inquiryId ?? null,
          bookingId: sourceReferences.bookingId ?? null,
          listingId: sourceReferences.listingId ?? null,
          activityId: sourceReferences.activityId ?? null,
          developerProjectId: sourceReferences.developerProjectId ?? null,
          valuationRequestId: sourceReferences.valuationRequestId ?? null,
          savedSearchId: sourceReferences.savedSearchId ?? null,
          watchlistItemId: sourceReferences.watchlistItemId ?? null,
          pmsTenantId: sourceReferences.pmsTenantId ?? null,
          pmsPropertyId: sourceReferences.pmsPropertyId ?? null,
          pmsVendorId: sourceReferences.pmsVendorId ?? null,
          activities: {
            create: {
              type: 'STATUS_CHANGE',
              status: 'COMPLETED',
              subject: 'Lead created',
              body: 'Lead entered the NEW stage.',
              completedAt: new Date(),
              createdById: req.user!.id,
              updatedById: req.user!.id
            }
          }
        },
        include: leadDetailInclude
      });
    });

    const [lead] = await enrichCrmLeads([rawLead], buildCrmLeadScope(access, 'view'));
    res.status(201).json({ lead });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/leads/:id', async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const access = await getCrmAccess(req.user!);
    assertHasAnyCrmAccess(access);
    const lead = await getLeadForAccess(id, access, 'view');
    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

crmRouter.get('/leads/:id/communication-templates', async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const access = await getCrmAccess(req.user!);
    const lead = await getLeadForAccess(id, access, 'view');
    const templates = buildCrmCommunicationTemplates(lead);
    res.json({
      templates,
      delivery: {
        email: 'draft_only',
        whatsapp: 'draft_only',
        note: 'lux.om opens a prefilled draft. Delivery is not performed or confirmed by this endpoint.'
      }
    });
  } catch (error) {
    next(error);
  }
});

crmRouter.patch('/leads/:id', async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = updateLeadSchema.parse(req.body);
    const access = await getCrmAccess(req.user!);
    const current = await getLeadForAccess(id, access, 'manage');
    assertCrmWorkspaceAccess(access, current, 'manage');
    if (data.status) assertStatusTransition(current.status, data.status);
    await assertAssignmentAllowed(access, current, data.assignedToId);

    const rawLead = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmLead.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assignedToId: data.assignedToId,
          expectedValue: data.expectedValue,
          currency: data.currency,
          nextFollowUpAt: data.nextFollowUpAt === undefined ? undefined : data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
          lostReason: data.lostReason,
          archivedAt: data.status === 'ARCHIVED' ? new Date() : data.status ? null : undefined,
          updatedById: req.user!.id
        }
      });

      if (data.status && data.status !== current.status) {
        await tx.crmActivity.create({
          data: {
            leadId: id,
            type: 'STATUS_CHANGE',
            status: 'COMPLETED',
            subject: `Status changed to ${data.status.replace(/_/g, ' ')}`,
            body: `${current.status} → ${data.status}`,
            completedAt: new Date(),
            createdById: req.user!.id,
            updatedById: req.user!.id
          }
        });
      }

      if (data.assignedToId !== undefined && data.assignedToId !== current.assignedToId) {
        await tx.crmActivity.create({
          data: {
            leadId: id,
            type: 'ASSIGNMENT',
            status: 'COMPLETED',
            subject: data.assignedToId ? 'Lead reassigned' : 'Lead unassigned',
            completedAt: new Date(),
            createdById: req.user!.id,
            assignedToId: data.assignedToId,
            updatedById: req.user!.id
          }
        });
      }

      return tx.crmLead.findUniqueOrThrow({ where: { id: updated.id }, include: leadDetailInclude });
    });

    const [lead] = await enrichCrmLeads([rawLead], buildCrmLeadScope(access, 'view'));
    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

crmRouter.post('/leads/:id/activities', async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = createActivitySchema.parse(req.body);
    const access = await getCrmAccess(req.user!);
    const lead = await getLeadForAccess(id, access, 'manage');
    const communicationTypes = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING'] as const;
    const isCommunication = communicationTypes.includes(data.type as (typeof communicationTypes)[number]);
    if (!isCommunication && (data.communicationDirection || data.communicationOutcome || data.templateKey)) {
      throw new AppError(400, 'Communication metadata is only valid for call, email, WhatsApp, or meeting activities.');
    }
    const status = data.status ?? (data.type === 'TASK' ? 'OPEN' : 'COMPLETED');
    const assignedToId = data.assignedToId ?? (data.type === 'TASK' ? lead.assignedToId ?? req.user!.id : null);
    await assertAssignmentAllowed(access, lead, assignedToId);
    const completedAt = status === 'COMPLETED' ? new Date() : null;

    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.crmActivity.create({
        data: {
          leadId: id,
          type: data.type,
          status,
          priority: data.priority,
          subject: data.subject,
          body: data.body,
          dueAt: data.dueAt ? new Date(data.dueAt) : null,
          completedAt,
          assignedToId,
          communicationDirection: isCommunication ? data.communicationDirection ?? 'OUTBOUND' : null,
          communicationOutcome: isCommunication ? data.communicationOutcome ?? null : null,
          templateKey: isCommunication ? data.templateKey ?? null : null,
          createdById: req.user!.id,
          updatedById: req.user!.id
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      });
      await tx.crmLead.update({ where: { id }, data: { updatedById: req.user!.id } });
      return created;
    });
    res.status(201).json({ activity });
  } catch (error) {
    next(error);
  }
});

crmRouter.patch('/leads/:id/activities/:activityId', async (req, res, next) => {
  try {
    const { id, activityId } = activityParamsSchema.parse(req.params);
    const data = updateActivitySchema.parse(req.body);
    const access = await getCrmAccess(req.user!);
    const lead = await getLeadForAccess(id, access, 'manage');
    const existing = await prisma.crmActivity.findFirst({ where: { id: activityId, leadId: id } });
    if (!existing) throw new AppError(404, 'CRM activity not found.');
    const communicationTypes = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING'];
    if (!communicationTypes.includes(existing.type) && (data.communicationDirection !== undefined || data.communicationOutcome !== undefined || data.templateKey !== undefined)) {
      throw new AppError(400, 'Communication metadata is only valid for call, email, WhatsApp, or meeting activities.');
    }
    await assertAssignmentAllowed(access, lead, data.assignedToId);

    const activity = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmActivity.update({
        where: { id: activityId },
        data: {
          status: data.status,
          priority: data.priority,
          subject: data.subject,
          body: data.body,
          dueAt: data.dueAt === undefined ? undefined : data.dueAt ? new Date(data.dueAt) : null,
          completedAt: data.status === 'COMPLETED' ? existing.completedAt ?? new Date() : data.status ? null : undefined,
          assignedToId: data.assignedToId,
          communicationDirection: data.communicationDirection,
          communicationOutcome: data.communicationOutcome,
          templateKey: data.templateKey,
          updatedById: req.user!.id
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      });
      await tx.crmLead.update({ where: { id }, data: { updatedById: req.user!.id } });
      return updated;
    });
    res.json({ activity });
  } catch (error) {
    next(error);
  }
});
