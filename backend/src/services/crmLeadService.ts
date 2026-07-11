import type { InquiryType, Prisma } from '@prisma/client';

import {
  ingestCrmRelationshipSignal,
  resolveIngestionWorkspace
} from '../modules/crm/stage21h/ingestion';

export async function createCrmLeadForInquiry(
  tx: Prisma.TransactionClient,
  input: {
    inquiryId: string;
    type: InquiryType;
    name: string;
    email: string;
    phone?: string | null;
    message: string;
    userId?: string | null;
    listing?: {
      id: string;
      ownerId: string;
      developerId?: string | null;
      title: string;
    } | null;
    activity?: {
      id: string;
      ownerId: string;
      title: string;
    } | null;
  }
) {
  const ownerUserId = input.listing?.ownerId ?? input.activity?.ownerId ?? null;
  const companyId = input.listing?.developerId ?? null;
  const workspace = await resolveIngestionWorkspace(tx, {
    companyId,
    ownerUserId: companyId ? null : ownerUserId
  });
  const sourceType = input.listing
    ? 'LISTING_INQUIRY'
    : input.activity
      ? 'ACTIVITY_INQUIRY'
      : 'MANUAL';
  const sourceLabel = input.listing?.title ?? input.activity?.title ?? input.type.replace(/_/g, ' ');
  const result = await ingestCrmRelationshipSignal(tx, {
    workspaceId: workspace.id,
    sourceType,
    leadSource: input.listing
      ? 'LISTING_INQUIRY'
      : input.activity
        ? 'ACTIVITY_INQUIRY'
        : 'CONTACT_FORM',
    sourceRecordId: input.inquiryId,
    ruleKey: `inquiry:${input.type.toLowerCase()}`,
    contact: {
      fullName: input.name,
      email: input.email,
      phone: input.phone ?? null,
      userId: input.userId ?? null
    },
    companyId,
    ownerUserId: companyId ? null : ownerUserId,
    title: `${input.name} · ${sourceLabel}`,
    description: input.message,
    sourceLabel,
    consentStatus: 'LEGITIMATE_INTEREST',
    createLead: true,
    inquiryId: input.inquiryId,
    listingId: input.listing?.id ?? null,
    activityId: input.activity?.id ?? null,
    metadata: { inquiryType: input.type },
    actorId: input.userId ?? null
  });
  if (!result.lead) throw new Error('CRM inquiry ingestion did not create a lead.');
  return result.lead;
}
