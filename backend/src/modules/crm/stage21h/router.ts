import { Router } from 'express';
import { Prisma, type
  CrmCommunicationChannel,
  CrmContactConsentStatus,
  CrmDealOutcome,
  CrmDeliveryProvider,
  CrmForecastCategory
} from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../../../lib/prisma';
import { requireAuth } from '../../../middleware/auth';
import { getCrmAccess, assertCrmWorkspaceAccess, assertHasAnyCrmAccess } from '../../workspaces/access';
import { AppError } from '../../../utils/http';
import { crmContactConsentStatuses, crmSourceEventTypes } from '../contracts';
import { createCrmDeliveryAttempt, confirmCrmDeliveryFromProvider, normalizeCommunicationDestination } from './communications';
import { buildContactMergePreview, findCrmContactDuplicates, mergeCrmContacts, normalizeCrmEmail, normalizeCrmPhone, syncCrmContactIdentities, upsertCrmContact } from './identity';
import { ensureDefaultCrmPipeline } from './provisioning';
import { persistCrmLeadScore, recalculateWorkspaceScores } from './scoring';
import { stageTypeToOutcome } from './constants';

export const crmStage21hRouter = Router();
export const crmProviderWebhookRouter = Router();

const id = z.string().min(1);
const currency = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());
const accountTypes = ['INDIVIDUAL', 'COMPANY', 'DEVELOPER', 'TRAVEL_AGENCY', 'ACTIVITY_PROVIDER', 'PROPERTY_OWNER', 'INVESTOR', 'VENDOR', 'TENANT_ORGANIZATION', 'GOVERNMENT', 'INSTITUTIONAL_PARTNER', 'OTHER'] as const;
const dealOutcomes = ['OPEN', 'WON', 'LOST'] as const;
const forecastCategories = ['PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED'] as const;
const stageTypes = ['OPEN', 'WON', 'LOST'] as const;
const channels = ['EMAIL', 'WHATSAPP', 'PHONE'] as const;
const suppressionReasons = ['OPT_OUT', 'BOUNCE', 'COMPLAINT', 'INVALID_DESTINATION', 'MANUAL', 'LEGAL'] as const;
const deliveryProviders = ['DRAFT_ONLY', 'VERIFIED_EMAIL', 'WHATSAPP_BUSINESS'] as const;
const dealRequiredFields = ['accountId', 'primaryContactId', 'ownerUserId', 'expectedValue', 'currency', 'expectedCloseDate', 'pmsPropertyId'] as const;

function validIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function resolveWorkspaceAccess(
  user: NonNullable<Express.Request['user']>,
  workspaceId: string,
  permission: 'view' | 'manage'
) {
  const access = await getCrmAccess(user);
  assertHasAnyCrmAccess(access);
  if (access.isAdmin) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, companyId: true, personalOwnerUserId: true, type: true } });
    if (!workspace) throw new AppError(404, 'CRM workspace not found.');
    return { access, workspace };
  }
  const workspace = access.workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace || !(permission === 'view' ? workspace.canView : workspace.canManage)) {
    throw new AppError(403, 'CRM workspace is outside your access.');
  }
  return { access, workspace };
}

function assertPropertyScope(
  access: Awaited<ReturnType<typeof getCrmAccess>>,
  record: { workspaceId: string; pmsPropertyId?: string | null },
  permission: 'view' | 'manage'
) {
  assertCrmWorkspaceAccess(access, record, permission);
}

function workspaceAccessItem(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string) {
  return access.workspaces.find((item) => item.workspaceId === workspaceId);
}

function scopedPropertyIds(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string) {
  if (access.isAdmin) return null;
  const workspace = workspaceAccessItem(access, workspaceId);
  if (!workspace) throw new AppError(403, 'CRM workspace is outside your access.');
  if (workspace.type !== 'COMPANY' || workspace.propertyScope.allProperties) return null;
  return workspace.propertyScope.propertyIds;
}

function accountScopeWhere(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string): Prisma.CrmAccountWhereInput {
  const propertyIds = scopedPropertyIds(access, workspaceId);
  return { workspaceId, ...(propertyIds ? { pmsPropertyId: { in: propertyIds } } : {}) };
}

function dealScopeWhere(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string): Prisma.CrmDealWhereInput {
  const propertyIds = scopedPropertyIds(access, workspaceId);
  return { workspaceId, ...(propertyIds ? { pmsPropertyId: { in: propertyIds } } : {}) };
}

function leadScopeWhere(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string): Prisma.CrmLeadWhereInput {
  const propertyIds = scopedPropertyIds(access, workspaceId);
  return { workspaceId, ...(propertyIds ? { pmsPropertyId: { in: propertyIds } } : {}) };
}

function contactScopeWhere(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string): Prisma.CrmContactWhereInput {
  const propertyIds = scopedPropertyIds(access, workspaceId);
  if (!propertyIds) return { workspaceId };
  return {
    workspaceId,
    OR: [
      { account: { pmsPropertyId: { in: propertyIds } } },
      { leads: { some: { pmsPropertyId: { in: propertyIds } } } },
      { primaryDeals: { some: { pmsPropertyId: { in: propertyIds } } } }
    ]
  };
}

function sourceEventScopeWhere(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string): Prisma.CrmSourceEventWhereInput {
  const propertyIds = scopedPropertyIds(access, workspaceId);
  if (!propertyIds) return { workspaceId };
  return {
    workspaceId,
    OR: [
      { lead: { pmsPropertyId: { in: propertyIds } } },
      { account: { pmsPropertyId: { in: propertyIds } } },
      { deal: { pmsPropertyId: { in: propertyIds } } }
    ]
  };
}

function assertWorkspaceConfigurationAccess(access: Awaited<ReturnType<typeof getCrmAccess>>, workspaceId: string) {
  if (access.isAdmin) return;
  const workspace = workspaceAccessItem(access, workspaceId);
  if (!workspace?.canManageWorkspace) throw new AppError(403, 'Workspace-level CRM configuration requires workspace management access.');
}

async function assertAssignableWorkspaceUsers(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userIds: Array<string | null | undefined>
) {
  const requested = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
  if (!requested.length) return;
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true, personalOwnerUserId: true }
  });
  if (!workspace) throw new AppError(404, 'CRM workspace not found.');
  const [members, platformAdmins] = await Promise.all([
    tx.workspaceMember.findMany({
      where: { workspaceId, userId: { in: requested }, active: true },
      select: { userId: true }
    }),
    workspace.type === 'PLATFORM'
      ? tx.user.findMany({ where: { id: { in: requested }, role: 'ADMIN' }, select: { id: true } })
      : Promise.resolve([])
  ]);
  const allowed = new Set([
    ...members.map((member) => member.userId),
    ...platformAdmins.map((user) => user.id),
    ...(workspace.personalOwnerUserId ? [workspace.personalOwnerUserId] : [])
  ]);
  const invalid = requested.filter((userId) => !allowed.has(userId));
  if (invalid.length) throw new AppError(400, 'CRM owners and team members must belong to the selected workspace.');
}

const accountCreateSchema = z.object({
  workspaceId: id,
  type: z.enum(accountTypes).default('INDIVIDUAL'),
  name: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(240).nullable().optional(),
  registrationNumber: z.string().trim().max(120).nullable().optional(),
  taxNumber: z.string().trim().max(120).nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  email: z.string().trim().email().toLowerCase().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  parentAccountId: id.nullable().optional(),
  ownerUserId: id.nullable().optional(),
  pmsPropertyId: id.nullable().optional(),
  teamUserIds: z.array(id).max(50).default([])
}).strict().superRefine((data, ctx) => {
  if (data.type === 'INDIVIDUAL' && (data.registrationNumber || data.taxNumber)) {
    ctx.addIssue({ code: 'custom', path: ['type'], message: 'Business registration metadata is not valid for an individual CRM account.' });
  }
});

const accountContactCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  email: z.string().trim().email().toLowerCase().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).strict().superRefine((data, ctx) => {
  if (!data.email && !data.phone) ctx.addIssue({ code: 'custom', path: ['email'], message: 'An email or phone identity is required.' });
});

const dealCreateSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  accountId: id,
  primaryContactId: id.nullable().optional(),
  pipelineId: id.nullable().optional(),
  stageId: id.nullable().optional(),
  ownerUserId: id.nullable().optional(),
  teamUserIds: z.array(id).max(50).default([]),
  expectedValue: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
  currency: currency.default('OMR'),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  forecastCategory: z.enum(forecastCategories).default('PIPELINE'),
  expectedCloseDate: z.string().datetime().nullable().optional(),
  lostReason: z.string().trim().max(2000).nullable().optional(),
  wonReason: z.string().trim().max(2000).nullable().optional(),
  pmsPropertyId: id.nullable().optional()
}).strict();

const mergeResolutionSchema = z.object({
  fullName: z.string().trim().min(1).max(180).optional(),
  email: z.string().trim().email().toLowerCase().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  accountId: id.nullable().optional()
}).strict();

const pipelineCreateSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  isDefault: z.boolean().default(false),
  stages: z.array(z.object({
    key: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
    name: z.string().trim().min(2).max(120),
    position: z.coerce.number().int().min(1).max(10000),
    type: z.enum(stageTypes).default('OPEN'),
    defaultProbability: z.coerce.number().int().min(0).max(100),
    requiredFields: z.array(z.enum(dealRequiredFields)).max(dealRequiredFields.length).default([]),
    slaHours: z.coerce.number().int().min(1).max(24 * 365).nullable().optional()
  }).strict()).min(3).max(30)
}).strict().superRefine((data, ctx) => {
  for (const type of stageTypes) {
    if (!data.stages.some((stage) => stage.type === type)) {
      ctx.addIssue({ code: 'custom', path: ['stages'], message: `CRM pipeline requires at least one ${type.toLowerCase()} stage.` });
    }
  }
  const positions = new Set(data.stages.map((stage) => stage.position));
  const keys = new Set(data.stages.map((stage) => stage.key));
  if (positions.size !== data.stages.length) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'CRM pipeline stage positions must be unique.' });
  if (keys.size !== data.stages.length) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'CRM pipeline stage keys must be unique.' });
});

crmStage21hRouter.use(requireAuth());

crmStage21hRouter.get('/accounts', async (req, res, next) => {
  try {
    const query = z.object({
      workspaceId: id,
      search: z.string().trim().max(160).optional(),
      type: z.enum(accountTypes).optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).optional(),
      includeArchived: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
      sortBy: z.enum(['name', 'updatedAt', 'createdAt']).default('name'),
      direction: z.enum(['asc', 'desc']).default('asc'),
      take: z.coerce.number().int().min(1).max(100).default(50),
      skip: z.coerce.number().int().min(0).default(0)
    }).parse(req.query);
    const { access } = await resolveWorkspaceAccess(req.user!, query.workspaceId, 'view');
    const status = query.status ?? (query.includeArchived ? 'ALL' : 'ACTIVE');
    const baseWhere: Prisma.CrmAccountWhereInput = {
      ...accountScopeWhere(access, query.workspaceId),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { legalName: { contains: query.search, mode: 'insensitive' } },
          { registrationNumber: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
          { industry: { contains: query.search, mode: 'insensitive' } }
        ]
      } : {})
    };
    const where: Prisma.CrmAccountWhereInput = {
      ...baseWhere,
      ...(status === 'ACTIVE' ? { archivedAt: null } : status === 'ARCHIVED' ? { archivedAt: { not: null } } : {})
    };
    const orderBy: Prisma.CrmAccountOrderByWithRelationInput[] = query.sortBy === 'name'
      ? [{ archivedAt: 'asc' }, { name: query.direction }]
      : query.sortBy === 'updatedAt'
        ? [{ updatedAt: query.direction }, { name: 'asc' }]
        : [{ createdAt: query.direction }, { name: 'asc' }];
    const [accounts, total, active, archived] = await prisma.$transaction([
      prisma.crmAccount.findMany({
        where,
        include: {
          ownerUser: { select: { id: true, name: true, email: true } },
          parentAccount: { select: { id: true, name: true } },
          _count: { select: { contacts: true, deals: true, activities: true } }
        },
        orderBy,
        take: query.take,
        skip: query.skip
      }),
      prisma.crmAccount.count({ where }),
      prisma.crmAccount.count({ where: { ...baseWhere, archivedAt: null } }),
      prisma.crmAccount.count({ where: { ...baseWhere, archivedAt: { not: null } } })
    ]);
    res.json({
      accounts,
      summary: { total, active, archived },
      pagination: { total, take: query.take, skip: query.skip, count: accounts.length }
    });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/accounts', async (req, res, next) => {
  try {
    const data = accountCreateSchema.parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertPropertyScope(access, { workspaceId: data.workspaceId, pmsPropertyId: data.pmsPropertyId }, 'manage');
    const account = await prisma.$transaction(async (tx) => {
      await assertAssignableWorkspaceUsers(tx, data.workspaceId, [data.ownerUserId, ...data.teamUserIds]);
      if (data.parentAccountId) {
        const parent = await tx.crmAccount.findFirst({ where: { id: data.parentAccountId, ...accountScopeWhere(access, data.workspaceId) }, select: { id: true } });
        if (!parent) throw new AppError(400, 'Parent CRM account is outside this workspace or property scope.');
      }
      const created = await tx.crmAccount.create({
        data: {
          workspaceId: data.workspaceId,
          type: data.type,
          name: data.name,
          legalName: data.legalName,
          registrationNumber: data.registrationNumber,
          taxNumber: data.taxNumber,
          website: data.website,
          email: data.email,
          phone: data.phone,
          industry: data.industry,
          notes: data.notes,
          parentAccountId: data.parentAccountId,
          ownerUserId: data.ownerUserId,
          pmsPropertyId: data.pmsPropertyId,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          teamMembers: { create: data.teamUserIds.map((userId) => ({ userId })) },
          activities: { create: { workspaceId: data.workspaceId, type: 'NOTE', status: 'COMPLETED', subject: 'Account created', completedAt: new Date(), createdById: req.user!.id, updatedById: req.user!.id } }
        },
        include: { teamMembers: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { contacts: true, deals: true } } }
      });
      return created;
    });
    res.status(201).json({ account });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/accounts/:id', async (req, res, next) => {
  try {
    const accountId = id.parse(req.params.id);
    const summary = await prisma.crmAccount.findUnique({ where: { id: accountId }, select: { workspaceId: true } });
    if (!summary) throw new AppError(404, 'CRM account not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, summary.workspaceId, 'view');
    const account = await prisma.crmAccount.findFirst({
      where: { id: accountId, ...accountScopeWhere(access, summary.workspaceId) },
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
        parentAccount: { select: { id: true, name: true } },
        childAccounts: { where: accountScopeWhere(access, summary.workspaceId), select: { id: true, name: true, type: true, archivedAt: true } },
        contacts: { where: { mergedIntoContactId: null, ...contactScopeWhere(access, summary.workspaceId) }, orderBy: { fullName: 'asc' } },
        deals: { where: dealScopeWhere(access, summary.workspaceId), include: { stage: true, pipeline: { select: { id: true, name: true } }, ownerUser: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' } },
        teamMembers: { where: { active: true }, include: { user: { select: { id: true, name: true, email: true } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
        sourceEvents: { where: sourceEventScopeWhere(access, summary.workspaceId), orderBy: { occurredAt: 'desc' }, take: 100 },
        _count: { select: { contacts: true, deals: true, activities: true } }
      }
    });
    if (!account) throw new AppError(403, 'CRM account is outside your workspace or property scope.');
    res.json({ account });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/accounts/:id/archive', async (req, res, next) => {
  try {
    const accountId = id.parse(req.params.id);
    const data = z.object({
      archived: z.boolean(),
      reason: z.string().trim().min(3).max(1000)
    }).strict().parse(req.body);
    const current = await prisma.crmAccount.findUnique({ where: { id: accountId } });
    if (!current) throw new AppError(404, 'CRM account not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.workspaceId, 'manage');
    assertPropertyScope(access, current, 'manage');
    const alreadyInState = data.archived ? Boolean(current.archivedAt) : !current.archivedAt;
    const account = alreadyInState
      ? await prisma.crmAccount.findUniqueOrThrow({
          where: { id: accountId },
          include: {
            ownerUser: { select: { id: true, name: true, email: true } },
            parentAccount: { select: { id: true, name: true } },
            _count: { select: { contacts: true, deals: true, activities: true } }
          }
        })
      : await prisma.crmAccount.update({
          where: { id: accountId },
          data: {
            archivedAt: data.archived ? new Date() : null,
            updatedById: req.user!.id,
            activities: {
              create: {
                workspaceId: current.workspaceId,
                type: 'NOTE',
                status: 'COMPLETED',
                subject: data.archived ? 'Account archived' : 'Account restored',
                body: data.reason,
                completedAt: new Date(),
                createdById: req.user!.id,
                updatedById: req.user!.id
              }
            }
          },
          include: {
            ownerUser: { select: { id: true, name: true, email: true } },
            parentAccount: { select: { id: true, name: true } },
            _count: { select: { contacts: true, deals: true, activities: true } }
          }
        });
    res.json({ account, idempotent: alreadyInState });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/accounts/:id/contacts', async (req, res, next) => {
  try {
    const accountId = id.parse(req.params.id);
    const data = accountContactCreateSchema.parse(req.body);
    const summary = await prisma.crmAccount.findUnique({ where: { id: accountId }, select: { workspaceId: true } });
    if (!summary) throw new AppError(404, 'CRM account not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, summary.workspaceId, 'manage');
    const account = await prisma.crmAccount.findFirst({
      where: { id: accountId, ...accountScopeWhere(access, summary.workspaceId), archivedAt: null },
      select: { id: true, workspaceId: true }
    });
    if (!account) throw new AppError(403, 'CRM account is outside your workspace or property scope.');
    const contact = await prisma.$transaction(async (tx) => {
      const normalizedEmail = normalizeCrmEmail(data.email);
      const normalizedPhone = normalizeCrmPhone(data.phone);
      const existing = await tx.crmContact.findFirst({
        where: {
          workspaceId: account.workspaceId,
          mergedIntoContactId: null,
          OR: [
            ...(normalizedEmail ? [{ normalizedEmail }] : []),
            ...(normalizedPhone ? [{ normalizedPhone }] : [])
          ]
        },
        select: { id: true, accountId: true }
      });
      if (existing?.accountId && existing.accountId !== account.id) {
        throw new AppError(409, 'A CRM contact with this identity already belongs to another account. Review duplicate warnings before merging or moving it.');
      }
      const result = await upsertCrmContact(tx, {
        workspaceId: account.workspaceId,
        accountId: account.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        createdById: req.user!.id
      });
      await tx.crmActivity.create({
        data: {
          workspaceId: account.workspaceId,
          accountId: account.id,
          contactId: result.id,
          type: 'NOTE',
          status: 'COMPLETED',
          subject: existing ? 'Contact linked to account' : 'Contact added to account',
          completedAt: new Date(),
          createdById: req.user!.id,
          updatedById: req.user!.id
        }
      });
      return result;
    }, { isolationLevel: 'Serializable' });
    res.status(201).json({ contact });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/contacts', async (req, res, next) => {
  try {
    const query = z.object({
      workspaceId: id,
      search: z.string().trim().max(160).optional(),
      accountId: id.optional(),
      consentStatus: z.enum(crmContactConsentStatuses).optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
      sortBy: z.enum(['fullName', 'updatedAt', 'createdAt']).default('fullName'),
      direction: z.enum(['asc', 'desc']).default('asc'),
      take: z.coerce.number().int().min(1).max(200).default(50),
      skip: z.coerce.number().int().min(0).default(0)
    }).parse(req.query);
    const { access } = await resolveWorkspaceAccess(req.user!, query.workspaceId, 'view');
    const baseWhere: Prisma.CrmContactWhereInput = {
      AND: [
        contactScopeWhere(access, query.workspaceId),
        { mergedIntoContactId: null },
        ...(query.accountId ? [{ accountId: query.accountId }] : []),
        ...(query.consentStatus ? [{ channelPreferences: { some: { status: query.consentStatus } } }] : []),
        ...(query.search ? [{
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
            { notes: { contains: query.search, mode: 'insensitive' as const } },
            { account: { name: { contains: query.search, mode: 'insensitive' as const } } }
          ]
        }] : [])
      ]
    };
    const where: Prisma.CrmContactWhereInput = {
      ...baseWhere,
      ...(query.status === 'ACTIVE' ? { archivedAt: null } : query.status === 'ARCHIVED' ? { archivedAt: { not: null } } : {})
    };
    const orderBy: Prisma.CrmContactOrderByWithRelationInput[] = query.sortBy === 'fullName'
      ? [{ archivedAt: 'asc' }, { fullName: query.direction }]
      : query.sortBy === 'updatedAt'
        ? [{ updatedAt: query.direction }, { fullName: 'asc' }]
        : [{ createdAt: query.direction }, { fullName: 'asc' }];
    const selection = {
      id: true,
      workspaceId: true,
      fullName: true,
      email: true,
      phone: true,
      normalizedEmail: true,
      normalizedPhone: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      account: { select: { id: true, name: true, type: true } },
      identities: {
        where: { active: true },
        select: { id: true, type: true, normalizedValue: true, verifiedAt: true },
        orderBy: { type: 'asc' as const }
      },
      channelPreferences: {
        select: { id: true, channel: true, status: true, lawfulBasis: true, preferred: true, timezone: true }
      },
      _count: { select: { leads: true, primaryDeals: true, activities: true, deliveryAttempts: true } }
    } satisfies Prisma.CrmContactSelect;
    const [contacts, total, active, archived] = await prisma.$transaction([
      prisma.crmContact.findMany({ where, select: selection, orderBy, take: query.take, skip: query.skip }),
      prisma.crmContact.count({ where }),
      prisma.crmContact.count({ where: { ...baseWhere, archivedAt: null } }),
      prisma.crmContact.count({ where: { ...baseWhere, archivedAt: { not: null } } })
    ]);
    res.json({
      contacts,
      summary: { total, active, archived },
      pagination: { total, take: query.take, skip: query.skip, count: contacts.length }
    });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/contacts/:id', async (req, res, next) => {
  try {
    const contactId = id.parse(req.params.id);
    const summary = await prisma.crmContact.findUnique({ where: { id: contactId }, select: { workspaceId: true } });
    if (!summary) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, summary.workspaceId, 'view');
    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, ...contactScopeWhere(access, summary.workspaceId) },
      include: {
        account: { select: { id: true, name: true, type: true } },
        identities: { where: { active: true }, orderBy: { type: 'asc' } },
        channelPreferences: true,
        leads: { where: leadScopeWhere(access, summary.workspaceId), orderBy: { updatedAt: 'desc' }, take: 100 },
        primaryDeals: { where: dealScopeWhere(access, summary.workspaceId), include: { stage: true, pipeline: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 },
        sourceEvents: { where: sourceEventScopeWhere(access, summary.workspaceId), orderBy: { occurredAt: 'desc' }, take: 100 },
        primaryMergeRecords: { orderBy: { createdAt: 'desc' } },
        duplicateMergeRecords: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!contact) throw new AppError(403, 'CRM contact is outside your workspace or property scope.');
    let duplicates = contact.mergedIntoContactId ? [] : await prisma.$transaction((tx) => findCrmContactDuplicates(tx, { workspaceId: contact.workspaceId, contactId: contact.id }));
    if (duplicates.length && scopedPropertyIds(access, contact.workspaceId)) {
      const visible = await prisma.crmContact.findMany({
        where: { id: { in: duplicates.map((candidate) => candidate.id) }, ...contactScopeWhere(access, contact.workspaceId) },
        select: { id: true }
      });
      const visibleIds = new Set(visible.map((candidate) => candidate.id));
      duplicates = duplicates.filter((candidate) => visibleIds.has(candidate.id));
    }
    const destinations = [contact.normalizedEmail, contact.normalizedPhone].filter((value): value is string => Boolean(value));
    const suppressions = destinations.length
      ? await prisma.crmSuppressionEntry.findMany({ where: { workspaceId: contact.workspaceId, normalizedDestination: { in: destinations }, active: true } })
      : [];
    res.json({ contact, duplicates, suppressions });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/contacts/:id/archive', async (req, res, next) => {
  try {
    const contactId = id.parse(req.params.id);
    const data = z.object({
      archived: z.boolean(),
      reason: z.string().trim().min(3).max(1000)
    }).strict().parse(req.body);
    const current = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (!current) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.workspaceId, 'manage');
    const scoped = await prisma.crmContact.findFirst({
      where: { id: contactId, ...contactScopeWhere(access, current.workspaceId) },
      select: { id: true, accountId: true, mergedIntoContactId: true, archivedAt: true }
    });
    if (!scoped) throw new AppError(403, 'CRM contact is outside your workspace or property scope.');
    if (scoped.mergedIntoContactId) throw new AppError(409, 'Merged CRM contacts cannot be archived or restored independently.');
    const alreadyInState = data.archived ? Boolean(scoped.archivedAt) : !scoped.archivedAt;
    const contact = alreadyInState
      ? await prisma.crmContact.findUniqueOrThrow({
          where: { id: contactId },
          include: {
            account: { select: { id: true, name: true, type: true } },
            identities: { where: { active: true }, orderBy: { type: 'asc' } },
            channelPreferences: true,
            _count: { select: { leads: true, primaryDeals: true, activities: true, deliveryAttempts: true } }
          }
        })
      : await prisma.crmContact.update({
          where: { id: contactId },
          data: {
            archivedAt: data.archived ? new Date() : null,
            activities: {
              create: {
                workspaceId: current.workspaceId,
                accountId: scoped.accountId,
                type: 'NOTE',
                status: 'COMPLETED',
                subject: data.archived ? 'Contact archived' : 'Contact restored',
                body: data.reason,
                completedAt: new Date(),
                createdById: req.user!.id,
                updatedById: req.user!.id
              }
            }
          },
          include: {
            account: { select: { id: true, name: true, type: true } },
            identities: { where: { active: true }, orderBy: { type: 'asc' } },
            channelPreferences: true,
            _count: { select: { leads: true, primaryDeals: true, activities: true, deliveryAttempts: true } }
          }
        });
    res.json({ contact, idempotent: alreadyInState });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/contacts/:id/merge-preview', async (req, res, next) => {
  try {
    const primaryContactId = id.parse(req.params.id);
    const duplicateContactId = z.object({ duplicateContactId: id }).parse(req.body).duplicateContactId;
    const primary = await prisma.crmContact.findUnique({ where: { id: primaryContactId }, select: { workspaceId: true } });
    if (!primary) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, primary.workspaceId, 'manage');
    const accessible = await prisma.crmContact.count({ where: { id: { in: [primaryContactId, duplicateContactId] }, ...contactScopeWhere(access, primary.workspaceId) } });
    if (accessible !== 2) throw new AppError(403, 'Both CRM contacts must be inside your property scope.');
    const preview = await prisma.$transaction((tx) => buildContactMergePreview(tx, primary.workspaceId, primaryContactId, duplicateContactId));
    res.json({ preview });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/contacts/:id/merge', async (req, res, next) => {
  try {
    const primaryContactId = id.parse(req.params.id);
    const data = z.object({ duplicateContactId: id, resolutions: mergeResolutionSchema.optional() }).strict().parse(req.body);
    const primary = await prisma.crmContact.findUnique({ where: { id: primaryContactId }, select: { workspaceId: true } });
    if (!primary) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, primary.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, primary.workspaceId);
    const accessible = await prisma.crmContact.count({ where: { id: { in: [primaryContactId, data.duplicateContactId] }, ...contactScopeWhere(access, primary.workspaceId) } });
    if (accessible !== 2) throw new AppError(403, 'Both CRM contacts must be inside your workspace.');
    if (data.resolutions?.accountId) {
      const account = await prisma.crmAccount.findFirst({ where: { id: data.resolutions.accountId, ...accountScopeWhere(access, primary.workspaceId) }, select: { id: true } });
      if (!account) throw new AppError(400, 'CRM merge account resolution is outside your workspace or property scope.');
    }
    const result = await prisma.$transaction((tx) => mergeCrmContacts(tx, { workspaceId: primary.workspaceId, primaryContactId, duplicateContactId: data.duplicateContactId, actorId: req.user!.id, resolutions: data.resolutions }), { isolationLevel: 'Serializable' });
    res.json(result);
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/pipelines', async (req, res, next) => {
  try {
    const workspaceId = id.parse(req.query.workspaceId);
    const { access } = await resolveWorkspaceAccess(req.user!, workspaceId, 'view');
    await prisma.$transaction((tx) => ensureDefaultCrmPipeline(tx, workspaceId));
    const propertyIds = scopedPropertyIds(access, workspaceId);
    const pipelines = await prisma.crmPipeline.findMany({
      where: { workspaceId },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });
    if (!propertyIds) {
      const [dealCounts, leadCounts] = await Promise.all([
        prisma.crmDeal.groupBy({ by: ['pipelineId'], where: { workspaceId }, _count: { _all: true } }),
        prisma.crmLead.groupBy({ by: ['pipelineId'], where: { workspaceId }, _count: { _all: true } })
      ]);
      res.json({ pipelines: pipelines.map((pipeline) => ({ ...pipeline, _count: { deals: dealCounts.find((item) => item.pipelineId === pipeline.id)?._count._all ?? 0, leads: leadCounts.find((item) => item.pipelineId === pipeline.id)?._count._all ?? 0 } })) });
      return;
    }
    const [dealCounts, leadCounts] = await Promise.all([
      prisma.crmDeal.groupBy({ by: ['pipelineId'], where: { workspaceId, pmsPropertyId: { in: propertyIds } }, _count: { _all: true } }),
      prisma.crmLead.groupBy({ by: ['pipelineId'], where: { workspaceId, pmsPropertyId: { in: propertyIds } }, _count: { _all: true } })
    ]);
    res.json({ pipelines: pipelines.map((pipeline) => ({ ...pipeline, _count: { deals: dealCounts.find((item) => item.pipelineId === pipeline.id)?._count._all ?? 0, leads: leadCounts.find((item) => item.pipelineId === pipeline.id)?._count._all ?? 0 } })) });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/pipelines', async (req, res, next) => {
  try {
    const data = pipelineCreateSchema.parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, data.workspaceId);
    const pipeline = await prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.crmPipeline.updateMany({ where: { workspaceId: data.workspaceId, isDefault: true }, data: { isDefault: false } });
      return tx.crmPipeline.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          isDefault: data.isDefault,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          stages: { create: data.stages.map((stage) => ({ ...stage, requiredFields: stage.requiredFields })) }
        },
        include: { stages: { orderBy: { position: 'asc' } } }
      });
    });
    res.status(201).json({ pipeline });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/pipeline-stages/:id', async (req, res, next) => {
  try {
    const stageId = id.parse(req.params.id);
    const data = z.object({ name: z.string().trim().min(2).max(120).optional(), position: z.coerce.number().int().min(1).max(10000).optional(), type: z.enum(stageTypes).optional(), defaultProbability: z.coerce.number().int().min(0).max(100).optional(), requiredFields: z.array(z.enum(dealRequiredFields)).max(dealRequiredFields.length).optional(), slaHours: z.coerce.number().int().min(1).max(24 * 365).nullable().optional(), active: z.boolean().optional() }).strict().parse(req.body);
    const current = await prisma.crmPipelineStage.findUnique({ where: { id: stageId }, include: { pipeline: { select: { workspaceId: true } }, _count: { select: { deals: true, leads: true } } } });
    if (!current) throw new AppError(404, 'CRM pipeline stage not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.pipeline.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, current.pipeline.workspaceId);
    const usedRecords = current._count.deals + current._count.leads;
    if (data.active === false && usedRecords > 0) throw new AppError(409, 'A used CRM stage must remain available for historical records.');
    if (data.type && data.type !== current.type && usedRecords > 0) throw new AppError(409, 'A used CRM stage classification cannot be changed because historical outcomes depend on it.');
    const stage = await prisma.$transaction(async (tx) => {
      const siblings = await tx.crmPipelineStage.findMany({ where: { pipelineId: current.pipelineId }, select: { id: true, type: true, active: true } });
      const resultingTypes = new Set(siblings.filter((item) => item.id === stageId ? data.active !== false : item.active).map((item) => item.id === stageId ? data.type ?? item.type : item.type));
      for (const requiredType of stageTypes) {
        if (!resultingTypes.has(requiredType)) throw new AppError(409, `A CRM pipeline must retain at least one active ${requiredType.toLowerCase()} stage.`);
      }
      return tx.crmPipelineStage.update({
        where: { id: stageId },
        data: { ...data, requiredFields: data.requiredFields, archivedAt: data.active === false ? new Date() : data.active === true ? null : undefined }
      });
    });
    res.json({ stage });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/deals', async (req, res, next) => {
  try {
    const query = z.object({ workspaceId: id, pipelineId: id.optional(), stageId: id.optional(), outcome: z.enum(dealOutcomes).optional(), currency: currency.optional(), ownerUserId: id.optional(), search: z.string().trim().max(160).optional(), includeArchived: z.enum(['true', 'false']).transform((v) => v === 'true').default(false), take: z.coerce.number().int().min(1).max(200).default(100), skip: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const { access } = await resolveWorkspaceAccess(req.user!, query.workspaceId, 'view');
    const where: Prisma.CrmDealWhereInput = { ...dealScopeWhere(access, query.workspaceId), ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}), ...(query.stageId ? { stageId: query.stageId } : {}), ...(query.outcome ? { outcome: query.outcome } : {}), ...(query.currency ? { currency: query.currency } : {}), ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}), ...(!query.includeArchived ? { archivedAt: null } : {}), ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { account: { name: { contains: query.search, mode: 'insensitive' } } }, { primaryContact: { fullName: { contains: query.search, mode: 'insensitive' } } }] } : {}) };
    const [deals, total] = await prisma.$transaction([
      prisma.crmDeal.findMany({ where, include: { account: { select: { id: true, name: true, type: true } }, primaryContact: { select: { id: true, fullName: true, email: true, phone: true } }, pipeline: { select: { id: true, name: true } }, stage: true, ownerUser: { select: { id: true, name: true, email: true } }, _count: { select: { activities: true, stageHistory: true } } }, orderBy: [{ archivedAt: 'asc' }, { expectedCloseDate: 'asc' }, { updatedAt: 'desc' }], take: query.take, skip: query.skip }),
      prisma.crmDeal.count({ where })
    ]);
    res.json({ deals, pagination: { total, take: query.take, skip: query.skip, count: deals.length } });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/deals', async (req, res, next) => {
  try {
    const data = dealCreateSchema.parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertPropertyScope(access, { workspaceId: data.workspaceId, pmsPropertyId: data.pmsPropertyId }, 'manage');
    const deal = await prisma.$transaction(async (tx) => {
      await assertAssignableWorkspaceUsers(tx, data.workspaceId, [data.ownerUserId, ...data.teamUserIds]);
      const account = await tx.crmAccount.findFirst({ where: { id: data.accountId, ...accountScopeWhere(access, data.workspaceId) }, select: { id: true, pmsPropertyId: true } });
      if (!account) throw new AppError(400, 'CRM account is outside this workspace or property scope.');
      if (account.pmsPropertyId && data.pmsPropertyId && account.pmsPropertyId !== data.pmsPropertyId) {
        throw new AppError(400, 'CRM deal property must match its property-scoped account.');
      }
      const pmsPropertyId = data.pmsPropertyId ?? account.pmsPropertyId;
      assertPropertyScope(access, { workspaceId: data.workspaceId, pmsPropertyId }, 'manage');
      if (data.primaryContactId) {
        const contact = await tx.crmContact.findFirst({ where: { id: data.primaryContactId, ...contactScopeWhere(access, data.workspaceId), mergedIntoContactId: null }, select: { id: true } });
        if (!contact) throw new AppError(400, 'Primary CRM contact is outside this workspace or property scope.');
      }
      const defaultPipeline = await ensureDefaultCrmPipeline(tx, data.workspaceId);
      const pipelineId = data.pipelineId ?? defaultPipeline.id;
      const pipeline = await tx.crmPipeline.findFirst({ where: { id: pipelineId, workspaceId: data.workspaceId, active: true, archivedAt: null }, select: { id: true } });
      if (!pipeline) throw new AppError(400, 'CRM deal pipeline is outside this workspace or inactive.');
      const stage = data.stageId
        ? await tx.crmPipelineStage.findFirst({ where: { id: data.stageId, pipelineId, active: true } })
        : await tx.crmPipelineStage.findFirst({ where: { pipelineId, active: true, type: 'OPEN' }, orderBy: { position: 'asc' } });
      if (!stage) throw new AppError(400, 'CRM deal stage is invalid.');
      const outcome = stageTypeToOutcome(stage.type);
      if (outcome === 'LOST' && !data.lostReason?.trim()) throw new AppError(400, 'A lost reason is required for a lost deal.');
      const now = new Date();
      const created = await tx.crmDeal.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          accountId: data.accountId,
          primaryContactId: data.primaryContactId,
          pipelineId,
          stageId: stage.id,
          ownerUserId: data.ownerUserId,
          expectedValue: data.expectedValue,
          currency: data.currency,
          probability: data.probability ?? stage.defaultProbability,
          forecastCategory: outcome === 'WON' ? 'CLOSED' : outcome === 'LOST' ? 'OMITTED' : data.forecastCategory,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          outcome,
          wonAt: outcome === 'WON' ? now : null,
          lostAt: outcome === 'LOST' ? now : null,
          closedAt: outcome === 'OPEN' ? null : now,
          lostReason: outcome === 'LOST' ? data.lostReason : null,
          wonReason: outcome === 'WON' ? data.wonReason ?? null : null,
          pmsPropertyId,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          teamMembers: { create: data.teamUserIds.map((userId) => ({ userId })) },
          stageHistory: { create: { workspaceId: data.workspaceId, pipelineId, toStageId: stage.id, fromOutcome: 'OPEN', toOutcome: outcome, changedById: req.user!.id, reason: 'Deal created' } },
          activities: { create: { workspaceId: data.workspaceId, type: 'STATUS_CHANGE', status: 'COMPLETED', subject: `Deal entered ${stage.name}`, completedAt: now, createdById: req.user!.id, updatedById: req.user!.id, contactId: data.primaryContactId } }
        },
        include: { account: true, primaryContact: true, pipeline: true, stage: true, stageHistory: true, teamMembers: { include: { user: { select: { id: true, name: true, email: true } } } } }
      });
      return created;
    });
    res.status(201).json({ deal });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/deals/:id', async (req, res, next) => {
  try {
    const deal = await prisma.crmDeal.findUnique({ where: { id: id.parse(req.params.id) }, include: { account: true, primaryContact: true, pipeline: true, stage: true, ownerUser: { select: { id: true, name: true, email: true } }, teamMembers: { where: { active: true }, include: { user: { select: { id: true, name: true, email: true } } } }, stageHistory: { include: { fromStage: true, toStage: true, changedBy: { select: { id: true, name: true, email: true } } }, orderBy: { changedAt: 'asc' } }, activities: { orderBy: { createdAt: 'desc' }, take: 200 }, scoreSnapshots: { orderBy: { calculatedAt: 'desc' }, take: 100 }, sourceEvents: { orderBy: { occurredAt: 'desc' }, take: 100 } } });
    if (!deal) throw new AppError(404, 'CRM deal not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, deal.workspaceId, 'view');
    assertPropertyScope(access, deal, 'view');
    res.json({ deal });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/deals/:id/transition', async (req, res, next) => {
  try {
    const dealId = id.parse(req.params.id);
    const data = z.object({ stageId: id, reason: z.string().trim().max(2000).nullable().optional(), lostReason: z.string().trim().max(2000).nullable().optional(), wonReason: z.string().trim().max(2000).nullable().optional() }).strict().parse(req.body);
    const current = await prisma.crmDeal.findUnique({ where: { id: dealId }, include: { stage: true } });
    if (!current) throw new AppError(404, 'CRM deal not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.workspaceId, 'manage');
    assertPropertyScope(access, current, 'manage');
    const deal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CrmDeal" WHERE id = ${dealId} FOR UPDATE`;
      const locked = await tx.crmDeal.findUniqueOrThrow({ where: { id: dealId }, include: { stage: true } });
      if (locked.archivedAt) throw new AppError(409, 'Restore the archived CRM deal before changing its stage.');
      const nextStage = await tx.crmPipelineStage.findFirst({ where: { id: data.stageId, pipelineId: locked.pipelineId, active: true } });
      if (!nextStage) throw new AppError(400, 'CRM stage is outside this deal pipeline.');
      if (nextStage.id === locked.stageId) return locked;
      const requiredFields = Array.isArray(nextStage.requiredFields) ? nextStage.requiredFields.filter((value): value is string => typeof value === 'string') : [];
      const missing = requiredFields.filter((field) => !(locked as unknown as Record<string, unknown>)[field]);
      if (missing.length) throw new AppError(400, `Stage requires: ${missing.join(', ')}.`);
      const nextOutcome = stageTypeToOutcome(nextStage.type);
      if (locked.outcome !== 'OPEN' && nextOutcome !== 'OPEN' && nextOutcome !== locked.outcome) {
        throw new AppError(409, 'A closed CRM deal must be reopened before changing to a different commercial outcome.');
      }
      if (nextOutcome === 'LOST' && !data.lostReason?.trim()) throw new AppError(400, 'A lost reason is required for a lost deal.');
      const reopened = locked.outcome !== 'OPEN' && nextOutcome === 'OPEN';
      const now = new Date();
      const updated = await tx.crmDeal.update({
        where: { id: dealId },
        data: {
          stageId: nextStage.id,
          outcome: nextOutcome,
          probability: nextStage.defaultProbability,
          forecastCategory: nextOutcome === 'WON' ? 'CLOSED' : nextOutcome === 'LOST' ? 'OMITTED' : locked.forecastCategory === 'CLOSED' || locked.forecastCategory === 'OMITTED' ? 'PIPELINE' : locked.forecastCategory,
          wonAt: nextOutcome === 'WON' ? now : reopened ? null : locked.wonAt,
          lostAt: nextOutcome === 'LOST' ? now : reopened ? null : locked.lostAt,
          closedAt: nextOutcome === 'OPEN' ? null : now,
          lostReason: nextOutcome === 'LOST' ? data.lostReason : locked.lostReason,
          wonReason: nextOutcome === 'WON' ? data.wonReason ?? data.reason ?? null : locked.wonReason,
          reopenedCount: reopened ? { increment: 1 } : undefined,
          updatedById: req.user!.id,
          stageHistory: { create: { workspaceId: locked.workspaceId, pipelineId: locked.pipelineId, fromStageId: locked.stageId, toStageId: nextStage.id, fromOutcome: locked.outcome, toOutcome: nextOutcome, reason: data.reason, reopened, changedById: req.user!.id } },
          activities: { create: { workspaceId: locked.workspaceId, type: 'STATUS_CHANGE', status: 'COMPLETED', subject: `Deal moved to ${nextStage.name}`, body: data.reason, completedAt: now, createdById: req.user!.id, updatedById: req.user!.id, contactId: locked.primaryContactId } }
        },
        include: { account: true, primaryContact: true, pipeline: true, stage: true, stageHistory: { include: { fromStage: true, toStage: true }, orderBy: { changedAt: 'asc' } } }
      });
      return updated;
    }, { isolationLevel: 'Serializable' });
    res.json({ deal });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/deals/:id/archive', async (req, res, next) => {
  try {
    const dealId = id.parse(req.params.id);
    const data = z.object({ archived: z.boolean(), reason: z.string().trim().max(1000).optional() }).parse(req.body);
    const current = await prisma.crmDeal.findUnique({ where: { id: dealId } });
    if (!current) throw new AppError(404, 'CRM deal not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.workspaceId, 'manage');
    assertPropertyScope(access, current, 'manage');
    const deal = await prisma.crmDeal.update({ where: { id: dealId }, data: { archivedAt: data.archived ? new Date() : null, updatedById: req.user!.id, activities: { create: { workspaceId: current.workspaceId, type: 'NOTE', status: 'COMPLETED', subject: data.archived ? 'Deal archived' : 'Deal restored', body: data.reason, completedAt: new Date(), createdById: req.user!.id, updatedById: req.user!.id, contactId: current.primaryContactId } } } });
    res.json({ deal });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/leads/:id/convert', async (req, res, next) => {
  try {
    const leadId = id.parse(req.params.id);
    const data = z.object({ accountId: id.nullable().optional(), accountName: z.string().trim().min(2).max(180).optional(), accountType: z.enum(accountTypes).default('INDIVIDUAL'), dealName: z.string().trim().min(2).max(180).optional(), pipelineId: id.nullable().optional(), stageId: id.nullable().optional(), expectedCloseDate: z.string().datetime().nullable().optional() }).strict().parse(req.body);
    const current = await prisma.crmLead.findUnique({ where: { id: leadId }, include: { contact: true } });
    if (!current) throw new AppError(404, 'CRM lead not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, current.workspaceId, 'manage');
    assertPropertyScope(access, current, 'manage');
    if (current.convertedDealId || current.convertedAt) throw new AppError(409, 'This lead has already been converted.');
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CrmLead" WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: leadId }, include: { contact: true } });
      if (lead.convertedDealId || lead.convertedAt) throw new AppError(409, 'This lead has already been converted.');
      let account = data.accountId ? await tx.crmAccount.findFirst({ where: { id: data.accountId, ...accountScopeWhere(access, lead.workspaceId) } }) : null;
      if (data.accountId && !account) throw new AppError(400, 'CRM account is outside this workspace or property scope.');
      if (!account) {
        account = await tx.crmAccount.create({ data: { workspaceId: lead.workspaceId, type: data.accountType, name: data.accountName || lead.contact.fullName, email: lead.contact.email, phone: lead.contact.phone, ownerUserId: lead.assignedToId ?? lead.ownerUserId, pmsPropertyId: lead.pmsPropertyId, createdById: req.user!.id, updatedById: req.user!.id } });
      }
      await tx.crmContact.update({ where: { id: lead.contactId }, data: { accountId: account.id } });
      const defaultPipeline = await ensureDefaultCrmPipeline(tx, lead.workspaceId);
      const pipelineId = data.pipelineId ?? lead.pipelineId ?? defaultPipeline.id;
      const pipeline = await tx.crmPipeline.findFirst({ where: { id: pipelineId, workspaceId: lead.workspaceId, active: true, archivedAt: null }, select: { id: true } });
      if (!pipeline) throw new AppError(400, 'CRM conversion pipeline is outside this workspace or inactive.');
      let stage = data.stageId
        ? await tx.crmPipelineStage.findFirst({ where: { id: data.stageId, pipelineId, active: true } })
        : null;
      if (!stage && !data.stageId && lead.pipelineId === pipelineId && lead.stageId) {
        stage = await tx.crmPipelineStage.findFirst({ where: { id: lead.stageId, pipelineId, active: true } });
      }
      if (!stage && !data.stageId) {
        stage = await tx.crmPipelineStage.findFirst({
          where: { pipelineId, key: lead.status === 'ARCHIVED' ? 'LOST' : lead.status, active: true },
          orderBy: { position: 'asc' }
        }) ?? await tx.crmPipelineStage.findFirst({ where: { pipelineId, type: 'OPEN', active: true }, orderBy: { position: 'asc' } });
      }
      if (!stage) throw new AppError(400, 'CRM conversion stage is invalid.');
      const outcome = stageTypeToOutcome(stage.type);
      const now = new Date();
      const deal = await tx.crmDeal.create({
        data: {
          workspaceId: lead.workspaceId,
          name: data.dealName || lead.title,
          description: lead.description,
          accountId: account.id,
          primaryContactId: lead.contactId,
          sourceLeadId: lead.id,
          pipelineId,
          stageId: stage.id,
          ownerUserId: lead.assignedToId ?? lead.ownerUserId,
          expectedValue: lead.expectedValue,
          currency: lead.currency,
          probability: stage.defaultProbability,
          forecastCategory: outcome === 'WON' ? 'CLOSED' : outcome === 'LOST' ? 'OMITTED' : 'PIPELINE',
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          outcome,
          wonAt: outcome === 'WON' ? now : null,
          lostAt: outcome === 'LOST' ? now : null,
          closedAt: outcome === 'OPEN' ? null : now,
          lostReason: lead.lostReason,
          pmsPropertyId: lead.pmsPropertyId,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          stageHistory: { create: { workspaceId: lead.workspaceId, pipelineId, toStageId: stage.id, fromOutcome: 'OPEN', toOutcome: outcome, reason: 'Converted from lead', changedById: req.user!.id } },
          activities: { create: { workspaceId: lead.workspaceId, leadId: lead.id, contactId: lead.contactId, type: 'STATUS_CHANGE', status: 'COMPLETED', subject: 'Lead converted to deal', completedAt: now, createdById: req.user!.id, updatedById: req.user!.id } }
        },
        include: { account: true, primaryContact: true, pipeline: true, stage: true }
      });
      const convertedLead = await tx.crmLead.update({ where: { id: lead.id }, data: { convertedAccountId: account.id, convertedDealId: deal.id, convertedAt: now, updatedById: req.user!.id } });
      await tx.crmSourceEvent.updateMany({ where: { leadId: lead.id }, data: { accountId: account.id, dealId: deal.id } });
      return { account, deal, lead: convertedLead };
    }, { isolationLevel: 'Serializable' });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/leads/:id/score-history', async (req, res, next) => {
  try {
    const lead = await prisma.crmLead.findUnique({ where: { id: id.parse(req.params.id) }, select: { id: true, workspaceId: true, pmsPropertyId: true } });
    if (!lead) throw new AppError(404, 'CRM lead not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, lead.workspaceId, 'view');
    assertPropertyScope(access, lead, 'view');
    const snapshots = await prisma.crmScoreSnapshot.findMany({ where: { leadId: lead.id }, orderBy: { calculatedAt: 'desc' }, take: 200 });
    res.json({ snapshots });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/scores/recalculate', async (req, res, next) => {
  try {
    const data = z.object({ workspaceId: id, version: z.string().trim().min(2).max(80).optional() }).parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, data.workspaceId);
    const result = await prisma.$transaction((tx) => recalculateWorkspaceScores(tx, data.workspaceId, { version: data.version, jobKey: `manual:${req.user!.id}:${Date.now()}` }));
    res.json({ result });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/communication-policy', async (req, res, next) => {
  try {
    const workspaceId = id.parse(req.query.workspaceId);
    const { access } = await resolveWorkspaceAccess(req.user!, workspaceId, 'view');
    assertWorkspaceConfigurationAccess(access, workspaceId);
    const policy = await prisma.crmWorkspaceCommunicationPolicy.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId }
    });
    res.json({ policy });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/communication-policy', async (req, res, next) => {
  try {
    const data = z.object({
      workspaceId: id,
      timezone: z.string().trim().min(3).max(100),
      quietHoursStart: z.coerce.number().int().min(0).max(1439),
      quietHoursEnd: z.coerce.number().int().min(0).max(1439),
      hourlyRateLimit: z.coerce.number().int().min(1).max(1000),
      retentionDays: z.coerce.number().int().min(30).max(3650)
    }).strict().superRefine((value, ctx) => {
      if (!validIanaTimezone(value.timezone)) ctx.addIssue({ code: 'custom', path: ['timezone'], message: 'A valid IANA timezone is required.' });
    }).parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, data.workspaceId);
    const { workspaceId, ...policyData } = data;
    const policy = await prisma.crmWorkspaceCommunicationPolicy.upsert({
      where: { workspaceId },
      update: { ...policyData, updatedById: req.user!.id },
      create: { workspaceId, ...policyData, updatedById: req.user!.id }
    });
    res.json({ policy });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/contacts/:id/communication-governance', async (req, res, next) => {
  try {
    const contactId = id.parse(req.params.id);
    const summary = await prisma.crmContact.findUnique({ where: { id: contactId }, select: { workspaceId: true } });
    if (!summary) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, summary.workspaceId, 'view');
    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, ...contactScopeWhere(access, summary.workspaceId) },
      include: { channelPreferences: true }
    });
    if (!contact) throw new AppError(403, 'CRM contact is outside your workspace or property scope.');
    const destinations = [contact.normalizedEmail, contact.normalizedPhone].filter((value): value is string => Boolean(value));
    const suppressions = destinations.length
      ? await prisma.crmSuppressionEntry.findMany({ where: { workspaceId: contact.workspaceId, normalizedDestination: { in: destinations } } })
      : [];
    res.json({ contact, preferences: contact.channelPreferences, suppressions });
  } catch (error) { next(error); }
});

crmStage21hRouter.patch('/contacts/:id/communication-governance', async (req, res, next) => {
  try {
    const contactId = id.parse(req.params.id);
    const data = z.object({ channel: z.enum(channels), status: z.enum(crmContactConsentStatuses), lawfulBasis: z.string().trim().max(500).nullable().optional(), preferred: z.boolean().default(false), quietHoursStart: z.coerce.number().int().min(0).max(1439).nullable().optional(), quietHoursEnd: z.coerce.number().int().min(0).max(1439).nullable().optional(), timezone: z.string().trim().min(3).max(100).nullable().optional() }).strict().superRefine((value, ctx) => {
      if (value.timezone && !validIanaTimezone(value.timezone)) ctx.addIssue({ code: 'custom', path: ['timezone'], message: 'A valid IANA timezone is required.' });
    }).parse(req.body);
    const summary = await prisma.crmContact.findUnique({ where: { id: contactId }, select: { workspaceId: true } });
    if (!summary) throw new AppError(404, 'CRM contact not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, summary.workspaceId, 'manage');
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, ...contactScopeWhere(access, summary.workspaceId) }, select: { workspaceId: true } });
    if (!contact) throw new AppError(403, 'CRM contact is outside your workspace or property scope.');
    const preference = await prisma.crmContactChannelPreference.upsert({
      where: { contactId_channel: { contactId, channel: data.channel } },
      update: { status: data.status, lawfulBasis: data.lawfulBasis, preferred: data.preferred, quietHoursStart: data.quietHoursStart, quietHoursEnd: data.quietHoursEnd, timezone: data.timezone, optedOutAt: data.status === 'OPTED_OUT' ? new Date() : null, updatedById: req.user!.id },
      create: { workspaceId: contact.workspaceId, contactId, channel: data.channel, status: data.status, lawfulBasis: data.lawfulBasis, preferred: data.preferred, quietHoursStart: data.quietHoursStart, quietHoursEnd: data.quietHoursEnd, timezone: data.timezone, optedOutAt: data.status === 'OPTED_OUT' ? new Date() : null, updatedById: req.user!.id }
    });
    res.json({ preference });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/suppressions', async (req, res, next) => {
  try {
    const workspaceId = id.parse(req.query.workspaceId);
    const { access } = await resolveWorkspaceAccess(req.user!, workspaceId, 'view');
    assertWorkspaceConfigurationAccess(access, workspaceId);
    const suppressions = await prisma.crmSuppressionEntry.findMany({ where: { workspaceId }, orderBy: { updatedAt: 'desc' }, take: 500 });
    res.json({ suppressions });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/suppressions', async (req, res, next) => {
  try {
    const data = z.object({ workspaceId: id, channel: z.enum(channels), normalizedDestination: z.string().trim().min(3).max(320), reason: z.enum(suppressionReasons), active: z.boolean().default(true), source: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(), expiresAt: z.string().datetime().nullable().optional() }).strict().parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, data.workspaceId);
    const normalizedDestination = normalizeCommunicationDestination(data.channel, data.normalizedDestination);
    if (!normalizedDestination) throw new AppError(400, 'A valid suppression destination is required.');
    const suppression = await prisma.crmSuppressionEntry.upsert({ where: { workspaceId_channel_normalizedDestination: { workspaceId: data.workspaceId, channel: data.channel, normalizedDestination } }, update: { reason: data.reason, active: data.active, source: data.source, notes: data.notes, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }, create: { ...data, normalizedDestination, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, createdById: req.user!.id } });
    res.status(201).json({ suppression });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/communication-templates', async (req, res, next) => {
  try {
    const workspaceId = id.parse(req.query.workspaceId);
    await resolveWorkspaceAccess(req.user!, workspaceId, 'view');
    const templates = await prisma.crmCommunicationTemplate.findMany({ where: { workspaceId }, include: { versions: { orderBy: { version: 'desc' } } }, orderBy: { name: 'asc' } });
    res.json({ templates });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/communication-templates', async (req, res, next) => {
  try {
    const data = z.object({ workspaceId: id, key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/), name: z.string().trim().min(2).max(160), channel: z.enum(channels), subject: z.string().trim().max(240).nullable().optional(), body: z.string().trim().min(1).max(20000) }).strict().parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, data.workspaceId);
    const template = await prisma.crmCommunicationTemplate.create({ data: { workspaceId: data.workspaceId, key: data.key, name: data.name, channel: data.channel, createdById: req.user!.id, updatedById: req.user!.id, versions: { create: { version: 1, subject: data.subject, body: data.body, createdById: req.user!.id } } }, include: { versions: true } });
    res.status(201).json({ template });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/communication-templates/:id/versions', async (req, res, next) => {
  try {
    const templateId = id.parse(req.params.id);
    const data = z.object({ subject: z.string().trim().max(240).nullable().optional(), body: z.string().trim().min(1).max(20000) }).strict().parse(req.body);
    const template = await prisma.crmCommunicationTemplate.findUnique({ where: { id: templateId }, select: { workspaceId: true } });
    if (!template) throw new AppError(404, 'CRM communication template not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, template.workspaceId, 'manage');
    assertWorkspaceConfigurationAccess(access, template.workspaceId);
    const version = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`crm-template-version:${templateId}`}))`;
      const latest = await tx.crmCommunicationTemplateVersion.aggregate({ where: { templateId }, _max: { version: true } });
      return tx.crmCommunicationTemplateVersion.create({ data: { templateId, version: (latest._max.version ?? 0) + 1, subject: data.subject, body: data.body, createdById: req.user!.id } });
    }, { isolationLevel: 'Serializable' });
    res.status(201).json({ version });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/delivery-attempts', async (req, res, next) => {
  try {
    const data = z.object({ workspaceId: id, contactId: id, leadId: id.nullable().optional(), dealId: id.nullable().optional(), activityId: id.nullable().optional(), templateVersionId: id.nullable().optional(), channel: z.enum(channels), provider: z.enum(deliveryProviders), destination: z.string().trim().min(3).max(320), subject: z.string().trim().max(240).nullable().optional(), body: z.string().trim().min(1).max(20000), idempotencyKey: z.string().trim().min(8).max(160) }).strict().parse(req.body);
    const { access } = await resolveWorkspaceAccess(req.user!, data.workspaceId, 'manage');
    const contact = await prisma.crmContact.findFirst({ where: { id: data.contactId, ...contactScopeWhere(access, data.workspaceId), mergedIntoContactId: null }, select: { id: true } });
    if (!contact) throw new AppError(400, 'CRM contact is outside this workspace or property scope.');
    if (data.leadId) {
      const lead = await prisma.crmLead.findFirst({ where: { id: data.leadId, contactId: data.contactId, ...leadScopeWhere(access, data.workspaceId) }, select: { id: true } });
      if (!lead) throw new AppError(400, 'CRM delivery lead is outside this workspace, contact, or property scope.');
    }
    if (data.dealId) {
      const deal = await prisma.crmDeal.findFirst({ where: { id: data.dealId, primaryContactId: data.contactId, ...dealScopeWhere(access, data.workspaceId) }, select: { id: true } });
      if (!deal) throw new AppError(400, 'CRM delivery deal is outside this workspace, contact, or property scope.');
    }
    if (data.activityId) {
      const activity = await prisma.crmActivity.findFirst({
        where: {
          id: data.activityId,
          workspaceId: data.workspaceId,
          OR: [
            { contactId: data.contactId },
            { lead: { contactId: data.contactId, ...leadScopeWhere(access, data.workspaceId) } },
            { deal: { primaryContactId: data.contactId, ...dealScopeWhere(access, data.workspaceId) } }
          ]
        },
        select: { id: true }
      });
      if (!activity) throw new AppError(400, 'CRM delivery activity is outside this workspace, contact, or property scope.');
    }
    if (data.templateVersionId) {
      const version = await prisma.crmCommunicationTemplateVersion.findFirst({ where: { id: data.templateVersionId, template: { workspaceId: data.workspaceId, channel: data.channel } }, select: { id: true } });
      if (!version) throw new AppError(400, 'CRM communication template version is outside this workspace or channel.');
    }
    const attempt = await prisma.$transaction((tx) => createCrmDeliveryAttempt(tx, { ...data, actorId: req.user!.id }), { isolationLevel: 'Serializable' });
    res.status(attempt.status === 'BLOCKED' ? 409 : 201).json({ attempt, deliveryConfirmed: attempt.status === 'DELIVERED' });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/delivery-attempts', async (req, res, next) => {
  try {
    const query = z.object({
      workspaceId: id,
      contactId: id.optional(),
      search: z.string().trim().max(160).optional(),
      channel: z.enum(channels).optional(),
      provider: z.enum(deliveryProviders).optional(),
      status: z.enum(['DRAFT', 'QUEUED', 'PROCESSING', 'SUBMITTED', 'DELIVERED', 'FAILED', 'BOUNCED', 'BLOCKED', 'CANCELLED']).optional(),
      sortBy: z.enum(['attemptedAt', 'status', 'channel']).default('attemptedAt'),
      direction: z.enum(['asc', 'desc']).default('desc'),
      take: z.coerce.number().int().min(1).max(200).default(25),
      skip: z.coerce.number().int().min(0).default(0)
    }).parse(req.query);
    const { access } = await resolveWorkspaceAccess(req.user!, query.workspaceId, 'view');
    const scopedContactWhere = contactScopeWhere(access, query.workspaceId);
    const where: Prisma.CrmDeliveryAttemptWhereInput = {
      AND: [
        { workspaceId: query.workspaceId, contact: scopedContactWhere },
        ...(query.contactId ? [{ contactId: query.contactId }] : []),
        ...(query.channel ? [{ channel: query.channel }] : []),
        ...(query.provider ? [{ provider: query.provider }] : []),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.search ? [{
          OR: [
            { destination: { contains: query.search, mode: 'insensitive' as const } },
            { errorCode: { contains: query.search, mode: 'insensitive' as const } },
            { errorMessage: { contains: query.search, mode: 'insensitive' as const } },
            { contact: { fullName: { contains: query.search, mode: 'insensitive' as const } } },
            { contact: { email: { contains: query.search, mode: 'insensitive' as const } } },
            { contact: { phone: { contains: query.search, mode: 'insensitive' as const } } },
            { templateVersion: { template: { name: { contains: query.search, mode: 'insensitive' as const } } } }
          ]
        }] : [])
      ]
    };
    const orderBy: Prisma.CrmDeliveryAttemptOrderByWithRelationInput = {
      [query.sortBy]: query.direction
    };
    const [attempts, total] = await prisma.$transaction([
      prisma.crmDeliveryAttempt.findMany({
        where,
        include: {
          contact: { select: { id: true, fullName: true, email: true, phone: true } },
          lead: { select: { id: true, title: true } },
          deal: { select: { id: true, name: true } },
          activity: { select: { id: true, type: true, subject: true } },
          templateVersion: {
            include: { template: { select: { id: true, key: true, name: true, channel: true } } }
          }
        },
        orderBy: [orderBy, { id: query.direction }],
        take: query.take,
        skip: query.skip
      }),
      prisma.crmDeliveryAttempt.count({ where })
    ]);
    res.json({ attempts, pagination: { total, take: query.take, skip: query.skip, count: attempts.length } });
  } catch (error) { next(error); }
});

crmStage21hRouter.post('/delivery-attempts/:id/retry', async (req, res, next) => {
  try {
    const attemptId = id.parse(req.params.id);
    const attempt = await prisma.crmDeliveryAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError(404, 'CRM delivery attempt not found.');
    const { access } = await resolveWorkspaceAccess(req.user!, attempt.workspaceId, 'manage');
    const visible = await prisma.crmContact.count({ where: { id: attempt.contactId, ...contactScopeWhere(access, attempt.workspaceId) } });
    if (!visible) throw new AppError(403, 'CRM delivery attempt is outside your property scope.');
    if (!['FAILED', 'CANCELLED'].includes(attempt.status)) throw new AppError(409, 'Only failed or cancelled CRM deliveries can be queued again.');
    if (attempt.destination === '[retention-redacted]') throw new AppError(409, 'Retained-redacted CRM delivery content cannot be retried.');
    const retried = await prisma.crmDeliveryAttempt.update({
      where: { id: attempt.id },
      data: { status: 'QUEUED', attemptedAt: new Date(), submittedAt: null, failedAt: null, blockedAt: null, errorCode: null, errorMessage: null, claimedAt: null, claimToken: null }
    });
    res.json({ attempt: retried });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/source-events', async (req, res, next) => {
  try {
    const query = z.object({
      workspaceId: id,
      search: z.string().trim().max(120).optional(),
      type: z.enum(crmSourceEventTypes).optional(),
      consentStatus: z.enum(crmContactConsentStatuses).optional(),
      linkedTo: z.enum(['ANY', 'CONTACT', 'LEAD', 'ACCOUNT', 'DEAL', 'UNLINKED']).default('ANY'),
      sortBy: z.enum(['occurredAt', 'type', 'consentStatus']).default('occurredAt'),
      direction: z.enum(['asc', 'desc']).default('desc'),
      take: z.coerce.number().int().min(1).max(200).default(100),
      skip: z.coerce.number().int().min(0).default(0)
    }).parse(req.query);
    const { access } = await resolveWorkspaceAccess(req.user!, query.workspaceId, 'view');
    const filters: Prisma.CrmSourceEventWhereInput[] = [sourceEventScopeWhere(access, query.workspaceId)];
    if (query.search) {
      filters.push({
        OR: [
          { sourceRecordId: { contains: query.search, mode: 'insensitive' } },
          { ruleKey: { contains: query.search, mode: 'insensitive' } },
          { contact: { is: { fullName: { contains: query.search, mode: 'insensitive' } } } },
          { lead: { is: { title: { contains: query.search, mode: 'insensitive' } } } },
          { account: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
          { deal: { is: { name: { contains: query.search, mode: 'insensitive' } } } }
        ]
      });
    }
    if (query.type) filters.push({ type: query.type });
    if (query.consentStatus) filters.push({ consentStatus: query.consentStatus });
    if (query.linkedTo === 'CONTACT') filters.push({ contactId: { not: null } });
    if (query.linkedTo === 'LEAD') filters.push({ leadId: { not: null } });
    if (query.linkedTo === 'ACCOUNT') filters.push({ accountId: { not: null } });
    if (query.linkedTo === 'DEAL') filters.push({ dealId: { not: null } });
    if (query.linkedTo === 'UNLINKED') {
      filters.push({ contactId: null, leadId: null, accountId: null, dealId: null });
    }
    const where: Prisma.CrmSourceEventWhereInput = { AND: filters };
    const orderBy: Prisma.CrmSourceEventOrderByWithRelationInput = query.sortBy === 'type'
      ? { type: query.direction }
      : query.sortBy === 'consentStatus'
        ? { consentStatus: query.direction }
        : { occurredAt: query.direction };
    const [events, total] = await prisma.$transaction([
      prisma.crmSourceEvent.findMany({
        where,
        include: {
          contact: { select: { id: true, fullName: true } },
          lead: { select: { id: true, title: true } },
          account: { select: { id: true, name: true } },
          deal: { select: { id: true, name: true } }
        },
        orderBy: [orderBy, { id: query.direction }],
        take: query.take,
        skip: query.skip
      }),
      prisma.crmSourceEvent.count({ where })
    ]);
    res.json({
      events,
      pagination: { total, take: query.take, skip: query.skip, count: events.length },
      rules: { propertyScopeApplied: true, completeCountUsed: true }
    });
  } catch (error) { next(error); }
});

crmStage21hRouter.get('/analytics/forecast', async (req, res, next) => {
  try {
    const workspaceId = id.parse(req.query.workspaceId);
    const { access } = await resolveWorkspaceAccess(req.user!, workspaceId, 'view');
    const leadWhere = leadScopeWhere(access, workspaceId);
    const dealWhere = dealScopeWhere(access, workspaceId);
    const currentDealWhere: Prisma.CrmDealWhereInput = { ...dealWhere, archivedAt: null };
    const propertyIds = scopedPropertyIds(access, workspaceId);
    const dealPropertySql = propertyIds
      ? Prisma.sql`AND d."pmsPropertyId" IN (${Prisma.join(propertyIds)})`
      : Prisma.empty;
    const [leadCounts, qualified, sourceCounts, assigneeCounts, scoreBandCounts, dealCounts, forecast, stageCounts, cycle, timeInStage, stageDropOff, lostReasons, wonReasons, overdueFollowUps] = await Promise.all([
      prisma.crmLead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
      prisma.crmLead.count({ where: { ...leadWhere, OR: [{ status: { in: ['QUALIFIED', 'VIEWING_SCHEDULED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'] } }, { status: 'ARCHIVED', stage: { key: { notIn: ['NEW', 'CONTACTED'] } } }] } }),
      prisma.crmLead.groupBy({ by: ['source', 'outcome'], where: leadWhere, _count: { _all: true } }),
      prisma.crmLead.groupBy({ by: ['assignedToId', 'outcome'], where: leadWhere, _count: { _all: true } }),
      prisma.crmLead.groupBy({ by: ['scoreBand', 'outcome'], where: leadWhere, _count: { _all: true } }),
      prisma.crmDeal.groupBy({ by: ['currency', 'outcome'], where: dealWhere, _count: { _all: true }, _sum: { expectedValue: true } }),
      prisma.$queryRaw<Array<{ currency: string; pipelineValue: number; weightedForecast: number }>>`
        SELECT d."currency",
               COALESCE(SUM(d."expectedValue"), 0)::float8 AS "pipelineValue",
               COALESCE(SUM(d."expectedValue" * d."probability" / 100.0), 0)::float8 AS "weightedForecast"
        FROM "CrmDeal" d
        WHERE d."workspaceId" = ${workspaceId} AND d."outcome" = 'OPEN' AND d."archivedAt" IS NULL
        ${dealPropertySql}
        GROUP BY d."currency"
        ORDER BY d."currency"`,
      prisma.crmDeal.groupBy({ by: ['stageId', 'outcome'], where: currentDealWhere, _count: { _all: true } }),
      prisma.$queryRaw<Array<{ currency: string; averageSalesCycleDays: number | null }>>`
        SELECT d."currency", AVG(EXTRACT(EPOCH FROM (d."closedAt" - d."createdAt")) / 86400.0)::float8 AS "averageSalesCycleDays"
        FROM "CrmDeal" d
        WHERE d."workspaceId" = ${workspaceId} AND d."outcome" IN ('WON', 'LOST') AND d."closedAt" IS NOT NULL
        ${dealPropertySql}
        GROUP BY d."currency" ORDER BY d."currency"`,
      prisma.$queryRaw<Array<{ stageId: string; averageHours: number }>>`
        WITH ordered AS (
          SELECT h."dealId", h."toStageId" AS "stageId", h."changedAt",
                 LEAD(h."changedAt") OVER (PARTITION BY h."dealId" ORDER BY h."changedAt") AS "nextAt",
                 d."closedAt", d."archivedAt"
          FROM "CrmStageHistory" h
          JOIN "CrmDeal" d ON d.id = h."dealId"
          WHERE h."workspaceId" = ${workspaceId}
          ${dealPropertySql}
        )
        SELECT "stageId", AVG(EXTRACT(EPOCH FROM (COALESCE("nextAt", "archivedAt", "closedAt", NOW()) - "changedAt")) / 3600.0)::float8 AS "averageHours"
        FROM ordered GROUP BY "stageId" ORDER BY "stageId"`,
      prisma.$queryRaw<Array<{ fromStageId: string | null; lostDeals: number }>>`
        SELECT h."fromStageId", COUNT(*)::int AS "lostDeals"
        FROM "CrmStageHistory" h
        JOIN "CrmDeal" d ON d.id = h."dealId"
        WHERE h."workspaceId" = ${workspaceId} AND h."toOutcome" = 'LOST'
        ${dealPropertySql}
        GROUP BY h."fromStageId"
        ORDER BY h."fromStageId"`,
      prisma.crmDeal.groupBy({ by: ['lostReason'], where: { ...dealWhere, outcome: 'LOST' }, _count: { _all: true } }),
      prisma.crmDeal.groupBy({ by: ['wonReason'], where: { ...dealWhere, outcome: 'WON' }, _count: { _all: true } }),
      prisma.crmLead.count({ where: { ...leadWhere, outcome: 'OPEN', OR: [{ nextFollowUpAt: { lt: new Date() } }, { activities: { some: { type: 'TASK', status: 'OPEN', dueAt: { lt: new Date() } } } }] } })
    ]);
    const totalLeads = leadCounts.reduce((sum, item) => sum + item._count._all, 0);
    const converted = await prisma.crmLead.count({ where: { ...leadWhere, convertedAt: { not: null } } });
    const decidedDeals = dealCounts.filter((item) => item.outcome !== 'OPEN').reduce((sum, item) => sum + item._count._all, 0);
    const wonDeals = dealCounts.filter((item) => item.outcome === 'WON').reduce((sum, item) => sum + item._count._all, 0);
    const stages = await prisma.crmPipelineStage.findMany({ where: { pipeline: { workspaceId } }, select: { id: true, name: true, position: true, pipelineId: true } });
    res.json({
      snapshot: {
        leads: { total: totalLeads, qualified, converted, leadToQualifiedRate: totalLeads ? qualified / totalLeads : 0, qualifiedToDealRate: qualified ? converted / qualified : 0 },
        deals: { decided: decidedDeals, won: wonDeals, winRate: decidedDeals ? wonDeals / decidedDeals : 0, byCurrencyAndOutcome: dealCounts, forecast, averageSalesCycleByCurrency: cycle },
        overdueFollowUps
      },
      dimensions: { bySource: sourceCounts, byAssignee: assigneeCounts, byScoreBand: scoreBandCounts, stages: stageCounts.map((item) => ({ ...item, stage: stages.find((stage) => stage.id === item.stageId) ?? null })), timeInStage, stageDropOff, lostReasons, wonReasons },
      rules: { currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false }
    });
  } catch (error) { next(error); }
});

crmProviderWebhookRouter.post('/:provider', async (req, res, next) => {
  try {
    const configuredSecret = process.env.CRM_PROVIDER_WEBHOOK_SECRET?.trim();
    const providedSecret = String(req.headers['x-crm-webhook-secret'] ?? '');
    if (!configuredSecret || providedSecret !== configuredSecret) throw new AppError(401, 'CRM provider webhook authentication failed.');
    const provider = z.enum(deliveryProviders).parse(String(req.params.provider).toUpperCase()) as CrmDeliveryProvider;
    if (provider === 'DRAFT_ONLY') throw new AppError(400, 'Draft-only communications have no provider webhook.');
    const data = z.object({ providerMessageId: z.string().min(1), status: z.enum(['DELIVERED', 'FAILED', 'BOUNCED']), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    const attempt = await prisma.$transaction((tx) => confirmCrmDeliveryFromProvider(tx, { provider, providerMessageId: data.providerMessageId, status: data.status, metadata: data.metadata as Prisma.InputJsonValue | undefined }));
    res.json({ attempt });
  } catch (error) { next(error); }
});
