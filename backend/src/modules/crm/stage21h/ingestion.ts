import type { CrmLeadSource, CrmLeadStatus, CrmSourceEventType, Prisma } from '@prisma/client';

import { ensureCompanyWorkspace, ensurePersonalWorkspace } from '../../workspaces/provisioning';
import { leadStatusToOutcome } from './constants';
import { upsertCrmContact } from './identity';
import { resolveLeadPipelineStage } from './provisioning';
import { persistCrmLeadScore } from './scoring';

const sourceMap: Record<CrmSourceEventType, CrmLeadSource> = {
  LISTING_INQUIRY: 'LISTING_INQUIRY',
  PROJECT_INQUIRY: 'PROJECT_INQUIRY',
  DEVELOPER_PROFILE_INQUIRY: 'DEVELOPER_PROFILE',
  TRAVEL_AGENCY_INQUIRY: 'TRAVEL_AGENCY_PROFILE',
  ACTIVITY_INQUIRY: 'ACTIVITY_INQUIRY',
  BOOKING_APPROVED: 'ACTIVITY_BOOKING',
  BOOKING_CONFIRMED: 'ACTIVITY_BOOKING',
  BOOKING_PAID: 'ACTIVITY_BOOKING',
  VALUATION_REQUEST: 'VALUATION_REQUEST',
  INVESTOR_WATCHLIST: 'INVESTOR_WATCHLIST',
  HIGH_INTENT_SAVED_SEARCH: 'SAVED_SEARCH',
  PMS_OWNER_ONBOARDING: 'PMS_OWNER',
  PMS_TENANT_ONBOARDING: 'PMS_TENANT',
  PMS_VENDOR_ONBOARDING: 'PMS_MAINTENANCE_VENDOR',
  MANUAL: 'MANUAL'
};

const leadProgressRank: Partial<Record<CrmLeadStatus, number>> = {
  NEW: 10,
  CONTACTED: 20,
  QUALIFIED: 30,
  VIEWING_SCHEDULED: 40,
  PROPOSAL_SENT: 50,
  NEGOTIATION: 60,
  WON: 100
};

export async function resolveIngestionWorkspace(
  tx: Prisma.TransactionClient,
  input: { companyId?: string | null; ownerUserId?: string | null }
) {
  if (input.companyId) {
    const company = await tx.developerCompany.findUniqueOrThrow({
      where: { id: input.companyId },
      select: { id: true, nameEn: true }
    });
    return ensureCompanyWorkspace(tx, company);
  }
  if (input.ownerUserId) {
    const owner = await tx.user.findUniqueOrThrow({
      where: { id: input.ownerUserId },
      select: { id: true, name: true }
    });
    return ensurePersonalWorkspace(tx, owner);
  }
  return tx.workspace.findUniqueOrThrow({ where: { platformKey: 'CRM' } });
}

export async function ingestCrmRelationshipSignal(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    sourceType: CrmSourceEventType;
    leadSource?: CrmLeadSource;
    sourceRecordId: string;
    ruleKey: string;
    occurredAt?: Date;
    contact: {
      fullName: string;
      email?: string | null;
      phone?: string | null;
      userId?: string | null;
      pmsTenantId?: string | null;
    };
    companyId?: string | null;
    ownerUserId?: string | null;
    pmsPropertyId?: string | null;
    pmsVendorId?: string | null;
    title: string;
    description?: string | null;
    sourceLabel?: string | null;
    status?: CrmLeadStatus;
    consentStatus?: 'UNKNOWN' | 'CONSENTED' | 'LEGITIMATE_INTEREST' | 'OPTED_OUT' | 'BLOCKED';
    createLead: boolean;
    bookingId?: string | null;
    inquiryId?: string | null;
    listingId?: string | null;
    activityId?: string | null;
    developerProjectId?: string | null;
    valuationRequestId?: string | null;
    savedSearchId?: string | null;
    watchlistItemId?: string | null;
    pmsTenantId?: string | null;
    metadata?: Prisma.InputJsonValue;
    actorId?: string | null;
  }
) {
  const ingestionKey = `${input.workspaceId}:${input.sourceType}:${input.sourceRecordId}:${input.ruleKey}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ingestionKey}))`;
  const existing = await tx.crmSourceEvent.findUnique({
    where: {
      workspaceId_type_sourceRecordId_ruleKey: {
        workspaceId: input.workspaceId,
        type: input.sourceType,
        sourceRecordId: input.sourceRecordId,
        ruleKey: input.ruleKey
      }
    },
    include: { contact: true, lead: true, account: true, deal: true }
  });
  if (existing) return { event: existing, contact: existing.contact, lead: existing.lead, created: false };

  const contact = await upsertCrmContact(tx, {
    workspaceId: input.workspaceId,
    fullName: input.contact.fullName,
    email: input.contact.email,
    phone: input.contact.phone,
    userId: input.contact.userId,
    pmsTenantId: input.contact.pmsTenantId ?? input.pmsTenantId,
    companyId: input.companyId,
    ownerUserId: input.ownerUserId,
    createdById: input.actorId
  });

  let lead = input.bookingId
    ? await tx.crmLead.findUnique({ where: { bookingId: input.bookingId } })
    : input.inquiryId
      ? await tx.crmLead.findUnique({ where: { inquiryId: input.inquiryId } })
      : null;

  if (input.createLead && !lead) {
    const status = input.status ?? 'NEW';
    const { pipeline, stage } = await resolveLeadPipelineStage(tx, input.workspaceId, status);
    const now = new Date();
    const outcome = leadStatusToOutcome(status);
    lead = await tx.crmLead.create({
      data: {
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description ?? null,
        status,
        outcome,
        wonAt: outcome === 'WON' ? now : null,
        lostAt: outcome === 'LOST' ? now : null,
        closedAt: outcome === 'OPEN' ? null : now,
        pipelineId: pipeline.id,
        stageId: stage.id,
        priority: status === 'WON' ? 'HIGH' : 'MEDIUM',
        source: input.leadSource ?? sourceMap[input.sourceType],
        sourceLabel: input.sourceLabel ?? null,
        contactId: contact.id,
        companyId: input.companyId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        assignedToId: input.ownerUserId ?? null,
        createdById: input.actorId ?? null,
        updatedById: input.actorId ?? null,
        bookingId: input.bookingId ?? null,
        inquiryId: input.inquiryId ?? null,
        listingId: input.listingId ?? null,
        activityId: input.activityId ?? null,
        developerProjectId: input.developerProjectId ?? null,
        valuationRequestId: input.valuationRequestId ?? null,
        savedSearchId: input.savedSearchId ?? null,
        watchlistItemId: input.watchlistItemId ?? null,
        pmsTenantId: input.pmsTenantId ?? null,
        pmsPropertyId: input.pmsPropertyId ?? null,
        pmsVendorId: input.pmsVendorId ?? null,
        activities: {
          create: {
            workspaceId: input.workspaceId,
            type: 'SYSTEM_NOTIFICATION',
            status: 'COMPLETED',
            subject: 'CRM source ingested',
            body: `${input.sourceType} · ${input.ruleKey}`,
            completedAt: now,
            createdById: input.actorId ?? null,
            updatedById: input.actorId ?? null,
            contactId: contact.id
          }
        }
      }
    });
    await persistCrmLeadScore(tx, lead.id, { forceSnapshot: true, jobKey: `ingest:${input.sourceType}:${input.sourceRecordId}` });
  }

  if (input.createLead && lead) {
    const desiredStatus = input.status ?? 'NEW';
    const currentRank = leadProgressRank[lead.status] ?? -1;
    const desiredRank = leadProgressRank[desiredStatus] ?? -1;
    if (lead.outcome === 'OPEN' && desiredRank > currentRank) {
      const { pipeline, stage } = await resolveLeadPipelineStage(tx, input.workspaceId, desiredStatus);
      const now = new Date();
      const outcome = leadStatusToOutcome(desiredStatus);
      lead = await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          status: desiredStatus,
          pipelineId: pipeline.id,
          stageId: stage.id,
          outcome,
          wonAt: outcome === 'WON' ? now : null,
          lostAt: outcome === 'LOST' ? now : null,
          closedAt: outcome === 'OPEN' ? null : now,
          updatedById: input.actorId ?? null,
          activities: {
            create: {
              workspaceId: input.workspaceId,
              contactId: lead.contactId,
              type: 'SYSTEM_NOTIFICATION',
              status: 'COMPLETED',
              subject: `CRM source advanced lead to ${desiredStatus}`,
              body: `${input.sourceType} · ${input.ruleKey}`,
              completedAt: now,
              createdById: input.actorId ?? null,
              updatedById: input.actorId ?? null
            }
          }
        }
      });
    }
    await persistCrmLeadScore(tx, lead.id, { jobKey: `ingest:${input.sourceType}:${input.sourceRecordId}:${input.ruleKey}` });
  }

  const event = await tx.crmSourceEvent.create({
    data: {
      workspaceId: input.workspaceId,
      type: input.sourceType,
      sourceRecordId: input.sourceRecordId,
      ruleKey: input.ruleKey,
      occurredAt: input.occurredAt ?? new Date(),
      consentStatus: input.consentStatus ?? 'UNKNOWN',
      contactId: contact.id,
      leadId: lead?.id ?? null,
      metadata: input.metadata
    },
    include: { contact: true, lead: true, account: true, deal: true }
  });
  return { event, contact, lead, created: true };
}

export async function ingestBookingCrmSignal(
  tx: Prisma.TransactionClient,
  input: {
    booking: {
      id: string;
      status: string;
      contactName: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      user: { id: string; name: string; email: string; phone: string | null };
      listing: { id: string; ownerId: string; developerId: string | null; title: string; titleEn: string | null; titleAr: string | null } | null;
      activity: { id: string; ownerId: string; titleEn: string; titleAr: string | null } | null;
      payment: { status: string } | null;
    };
    signal: 'BOOKING_APPROVED' | 'BOOKING_CONFIRMED' | 'BOOKING_PAID';
    actorId?: string | null;
  }
) {
  const companyId = input.booking.listing?.developerId ?? null;
  const ownerUserId = input.booking.listing?.ownerId ?? input.booking.activity?.ownerId ?? null;
  const workspace = await resolveIngestionWorkspace(tx, { companyId, ownerUserId: companyId ? null : ownerUserId });
  const title = input.booking.listing
    ? input.booking.listing.titleEn || input.booking.listing.titleAr || input.booking.listing.title
    : input.booking.activity?.titleEn || input.booking.activity?.titleAr || 'Booking';
  const status: CrmLeadStatus = input.signal === 'BOOKING_APPROVED' ? 'QUALIFIED' : 'WON';
  return ingestCrmRelationshipSignal(tx, {
    workspaceId: workspace.id,
    sourceType: input.signal,
    sourceRecordId: input.booking.id,
    ruleKey: input.signal.toLowerCase(),
    contact: {
      fullName: input.booking.contactName || input.booking.user.name,
      email: input.booking.contactEmail || input.booking.user.email,
      phone: input.booking.contactPhone || input.booking.user.phone,
      userId: input.booking.user.id
    },
    companyId,
    ownerUserId: companyId ? null : ownerUserId,
    title: `${input.booking.contactName || input.booking.user.name} · ${title}`,
    sourceLabel: title,
    status,
    consentStatus: 'LEGITIMATE_INTEREST',
    createLead: true,
    bookingId: input.booking.id,
    listingId: input.booking.listing?.id ?? null,
    activityId: input.booking.activity?.id ?? null,
    metadata: { bookingStatus: input.booking.status, paymentStatus: input.booking.payment?.status ?? null },
    actorId: input.actorId
  });
}

export async function ingestPmsTenantOnboarding(
  tx: Prisma.TransactionClient,
  input: { companyId: string; tenant: { id: string; fullName: string; email: string | null; phone: string | null }; actorId: string }
) {
  const workspace = await resolveIngestionWorkspace(tx, { companyId: input.companyId });
  return ingestCrmRelationshipSignal(tx, {
    workspaceId: workspace.id,
    sourceType: 'PMS_TENANT_ONBOARDING',
    sourceRecordId: input.tenant.id,
    ruleKey: 'tenant-created',
    contact: { ...input.tenant, pmsTenantId: input.tenant.id },
    companyId: input.companyId,
    title: `${input.tenant.fullName} · PMS tenant onboarding`,
    sourceLabel: 'PMS tenant',
    status: 'NEW',
    consentStatus: 'LEGITIMATE_INTEREST',
    createLead: true,
    pmsTenantId: input.tenant.id,
    actorId: input.actorId
  });
}

export async function ingestPmsVendorOnboarding(
  tx: Prisma.TransactionClient,
  input: { companyId: string; vendor: { id: string; name: string; email: string | null; phone: string | null; trade: string | null }; actorId: string }
) {
  const workspace = await resolveIngestionWorkspace(tx, { companyId: input.companyId });
  return ingestCrmRelationshipSignal(tx, {
    workspaceId: workspace.id,
    sourceType: 'PMS_VENDOR_ONBOARDING',
    sourceRecordId: input.vendor.id,
    ruleKey: 'vendor-created',
    contact: { fullName: input.vendor.name, email: input.vendor.email, phone: input.vendor.phone },
    companyId: input.companyId,
    title: `${input.vendor.name} · PMS vendor onboarding`,
    sourceLabel: input.vendor.trade || 'PMS vendor',
    status: 'NEW',
    consentStatus: 'LEGITIMATE_INTEREST',
    createLead: true,
    pmsVendorId: input.vendor.id,
    actorId: input.actorId
  });
}
