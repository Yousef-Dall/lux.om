import type { InquiryType, Prisma } from '@prisma/client';

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  const normalized = value?.replace(/[^+\d]/g, '').trim();
  return normalized || null;
}

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
  const source = input.listing
    ? 'LISTING_INQUIRY'
    : input.activity
      ? 'ACTIVITY_INQUIRY'
      : 'CONTACT_FORM';
  const sourceLabel = input.listing?.title ?? input.activity?.title ?? input.type.replace(/_/g, ' ');
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);

  const existingContact = await tx.crmContact.findFirst({
    where: {
      companyId,
      ownerUserId,
      OR: [
        ...(normalizedEmail ? [{ normalizedEmail }] : []),
        ...(normalizedPhone ? [{ normalizedPhone }] : [])
      ]
    },
    orderBy: { updatedAt: 'desc' }
  });

  const contact = existingContact
    ? await tx.crmContact.update({
        where: { id: existingContact.id },
        data: {
          fullName: input.name,
          email: input.email,
          phone: input.phone ?? null,
          normalizedEmail,
          normalizedPhone,
          userId: input.userId ?? existingContact.userId
        }
      })
    : await tx.crmContact.create({
        data: {
          fullName: input.name,
          email: input.email,
          phone: input.phone ?? null,
          normalizedEmail,
          normalizedPhone,
          companyId,
          ownerUserId,
          userId: input.userId ?? null,
          createdById: input.userId ?? null
        }
      });

  return tx.crmLead.create({
    data: {
      title: `${input.name} · ${sourceLabel}`,
      description: input.message,
      source,
      sourceLabel,
      contactId: contact.id,
      companyId,
      ownerUserId,
      assignedToId: ownerUserId,
      createdById: input.userId ?? null,
      updatedById: input.userId ?? null,
      inquiryId: input.inquiryId,
      listingId: input.listing?.id ?? null,
      activityId: input.activity?.id ?? null,
      activities: {
        create: {
          type: 'NOTE',
          status: 'COMPLETED',
          subject: 'Inquiry received',
          body: input.message,
          completedAt: new Date(),
          createdById: input.userId ?? null,
          updatedById: input.userId ?? null
        }
      }
    }
  });
}
