import type { CrmContactIdentityType, Prisma } from '@prisma/client';

import { AppError } from '../../../utils/http';

export function normalizeCrmEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizeCrmPhone(value?: string | null) {
  const normalized = value?.replace(/[^+\d]/g, '').trim();
  return normalized || null;
}

export function normalizeCrmName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ');
}

export async function syncCrmContactIdentities(
  tx: Prisma.TransactionClient,
  contact: { id: string; workspaceId: string; email?: string | null; phone?: string | null }
) {
  const values: Array<{ type: CrmContactIdentityType; normalizedValue: string; rawValue: string }> = [];
  const email = normalizeCrmEmail(contact.email);
  const phone = normalizeCrmPhone(contact.phone);
  if (email && contact.email) values.push({ type: 'EMAIL', normalizedValue: email, rawValue: contact.email });
  if (phone && contact.phone) values.push({ type: 'PHONE', normalizedValue: phone, rawValue: contact.phone });

  for (const identity of values) {
    const existing = await tx.crmContactIdentity.findUnique({
      where: { workspaceId_type_normalizedValue: { workspaceId: contact.workspaceId, type: identity.type, normalizedValue: identity.normalizedValue } }
    });
    if (existing && existing.contactId !== contact.id) {
      throw new AppError(409, `A CRM contact with this ${identity.type.toLowerCase()} already exists in the workspace.`);
    }
    await tx.crmContactIdentity.upsert({
      where: { workspaceId_type_normalizedValue: { workspaceId: contact.workspaceId, type: identity.type, normalizedValue: identity.normalizedValue } },
      update: { contactId: contact.id, rawValue: identity.rawValue, active: true, primary: true },
      create: { workspaceId: contact.workspaceId, contactId: contact.id, ...identity, active: true, primary: true }
    });
  }
}

export async function upsertCrmContact(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    accountId?: string | null;
    companyId?: string | null;
    ownerUserId?: string | null;
    userId?: string | null;
    pmsTenantId?: string | null;
    createdById?: string | null;
  }
) {
  const normalizedEmail = normalizeCrmEmail(input.email);
  const normalizedPhone = normalizeCrmPhone(input.phone);
  const identityLockKeys = [
    normalizedEmail ? `email:${normalizedEmail}` : null,
    normalizedPhone ? `phone:${normalizedPhone}` : null,
    input.userId ? `user:${input.userId}` : null,
    input.pmsTenantId ? `tenant:${input.pmsTenantId}` : null
  ].filter((value): value is string => Boolean(value)).sort();
  for (const key of identityLockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.workspaceId}:${key}`}))`;
  }
  const existing = await tx.crmContact.findFirst({
    where: {
      workspaceId: input.workspaceId,
      mergedIntoContactId: null,
      OR: [
        ...(normalizedEmail ? [{ normalizedEmail }] : []),
        ...(normalizedPhone ? [{ normalizedPhone }] : []),
        ...(input.userId ? [{ userId: input.userId }] : []),
        ...(input.pmsTenantId ? [{ pmsTenantId: input.pmsTenantId }] : [])
      ]
    },
    orderBy: { updatedAt: 'desc' }
  });

  const contact = existing
    ? await tx.crmContact.update({
        where: { id: existing.id },
        data: {
          fullName: input.fullName || existing.fullName,
          email: input.email ?? existing.email,
          phone: input.phone ?? existing.phone,
          normalizedEmail: normalizedEmail ?? existing.normalizedEmail,
          normalizedPhone: normalizedPhone ?? existing.normalizedPhone,
          notes: input.notes ?? existing.notes,
          accountId: input.accountId ?? existing.accountId,
          userId: input.userId ?? existing.userId,
          pmsTenantId: input.pmsTenantId ?? existing.pmsTenantId,
          archivedAt: null
        }
      })
    : await tx.crmContact.create({
        data: {
          workspaceId: input.workspaceId,
          fullName: input.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          normalizedEmail,
          normalizedPhone,
          notes: input.notes ?? null,
          accountId: input.accountId ?? null,
          companyId: input.companyId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          userId: input.userId ?? null,
          pmsTenantId: input.pmsTenantId ?? null,
          createdById: input.createdById ?? null
        }
      });
  await syncCrmContactIdentities(tx, contact);
  return contact;
}

export async function findCrmContactDuplicates(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; contactId: string; take?: number }
) {
  const contact = await tx.crmContact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { id: true, fullName: true, normalizedEmail: true, normalizedPhone: true, userId: true, pmsTenantId: true, accountId: true }
  });
  if (!contact) throw new AppError(404, 'CRM contact not found.');
  const normalizedName = normalizeCrmName(contact.fullName);
  const candidates = await tx.crmContact.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { not: contact.id },
      mergedIntoContactId: null,
      OR: [
        ...(contact.userId ? [{ userId: contact.userId }] : []),
        ...(contact.pmsTenantId ? [{ pmsTenantId: contact.pmsTenantId }] : []),
        ...(contact.accountId ? [{ accountId: contact.accountId }] : []),
        { fullName: { contains: contact.fullName.split(/\s+/)[0] || contact.fullName, mode: 'insensitive' } }
      ]
    },
    select: { id: true, fullName: true, email: true, phone: true, accountId: true, userId: true, pmsTenantId: true, archivedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: input.take ?? 20
  });
  return candidates.map((candidate) => ({
    ...candidate,
    reasons: [
      ...(normalizeCrmName(candidate.fullName) === normalizedName ? ['same_normalized_name'] : []),
      ...(candidate.accountId && candidate.accountId === contact.accountId ? ['same_account'] : []),
      ...(candidate.userId && candidate.userId === contact.userId ? ['same_user'] : []),
      ...(candidate.pmsTenantId && candidate.pmsTenantId === contact.pmsTenantId ? ['same_pms_tenant'] : [])
    ]
  })).filter((candidate) => candidate.reasons.length > 0);
}

export async function buildContactMergePreview(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  primaryContactId: string,
  duplicateContactId: string
) {
  if (primaryContactId === duplicateContactId) throw new AppError(400, 'A contact cannot be merged into itself.');
  const contacts = await tx.crmContact.findMany({
    where: { id: { in: [primaryContactId, duplicateContactId] } },
    include: {
      _count: { select: { leads: true, primaryDeals: true, activities: true, sourceEvents: true, deliveryAttempts: true } },
      identities: { where: { active: true }, orderBy: { type: 'asc' } },
      channelPreferences: true
    }
  });
  const primary = contacts.find((item) => item.id === primaryContactId);
  const duplicate = contacts.find((item) => item.id === duplicateContactId);
  if (!primary || !duplicate) throw new AppError(404, 'One or both CRM contacts were not found.');
  if (primary.workspaceId !== workspaceId || duplicate.workspaceId !== workspaceId) {
    throw new AppError(403, 'CRM contacts cannot be merged across workspaces.');
  }
  if (primary.mergedIntoContactId || duplicate.mergedIntoContactId) throw new AppError(409, 'Merged contacts cannot be merged again.');

  const fields = ['fullName', 'email', 'phone', 'notes', 'accountId', 'userId', 'pmsTenantId'] as const;
  const conflicts = fields.flatMap((field) => primary[field] && duplicate[field] && primary[field] !== duplicate[field]
    ? [{ field, primary: primary[field], duplicate: duplicate[field] }]
    : []);
  return {
    primary,
    duplicate,
    conflicts,
    movedLinks: duplicate._count,
    suggested: {
      fullName: primary.fullName || duplicate.fullName,
      email: primary.email || duplicate.email,
      phone: primary.phone || duplicate.phone,
      notes: [primary.notes, duplicate.notes].filter(Boolean).join('\n\n') || null,
      accountId: primary.accountId || duplicate.accountId,
      userId: primary.userId || duplicate.userId,
      pmsTenantId: primary.pmsTenantId || duplicate.pmsTenantId
    }
  };
}

export async function mergeCrmContacts(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; primaryContactId: string; duplicateContactId: string; actorId: string; resolutions?: Record<string, unknown> }
) {
  await tx.$queryRaw`SELECT id FROM "CrmContact" WHERE id IN (${input.primaryContactId}, ${input.duplicateContactId}) FOR UPDATE`;
  const preview = await buildContactMergePreview(tx, input.workspaceId, input.primaryContactId, input.duplicateContactId);
  const suggested = { ...preview.suggested, ...(input.resolutions ?? {}) } as typeof preview.suggested;

  await tx.crmLead.updateMany({ where: { contactId: input.duplicateContactId }, data: { contactId: input.primaryContactId } });
  await tx.crmDeal.updateMany({ where: { primaryContactId: input.duplicateContactId }, data: { primaryContactId: input.primaryContactId } });
  await tx.crmActivity.updateMany({ where: { contactId: input.duplicateContactId }, data: { contactId: input.primaryContactId } });
  await tx.crmSourceEvent.updateMany({ where: { contactId: input.duplicateContactId }, data: { contactId: input.primaryContactId } });
  await tx.crmDeliveryAttempt.updateMany({ where: { contactId: input.duplicateContactId }, data: { contactId: input.primaryContactId } });

  const duplicatePreferences = await tx.crmContactChannelPreference.findMany({ where: { contactId: input.duplicateContactId } });
  for (const preference of duplicatePreferences) {
    await tx.crmContactChannelPreference.upsert({
      where: { contactId_channel: { contactId: input.primaryContactId, channel: preference.channel } },
      update: preference.status === 'OPTED_OUT' || preference.status === 'BLOCKED'
        ? { status: preference.status, optedOutAt: preference.optedOutAt, lawfulBasis: preference.lawfulBasis }
        : {},
      create: {
        workspaceId: input.workspaceId,
        contactId: input.primaryContactId,
        channel: preference.channel,
        status: preference.status,
        lawfulBasis: preference.lawfulBasis,
        preferred: preference.preferred,
        quietHoursStart: preference.quietHoursStart,
        quietHoursEnd: preference.quietHoursEnd,
        timezone: preference.timezone,
        optedOutAt: preference.optedOutAt,
        updatedById: input.actorId
      }
    });
  }
  await tx.crmContactChannelPreference.deleteMany({ where: { contactId: input.duplicateContactId } });
  await tx.crmContactIdentity.updateMany({ where: { contactId: input.duplicateContactId }, data: { contactId: input.primaryContactId } });

  const primary = await tx.crmContact.update({
    where: { id: input.primaryContactId },
    data: {
      fullName: String(suggested.fullName),
      email: suggested.email as string | null,
      phone: suggested.phone as string | null,
      normalizedEmail: normalizeCrmEmail(suggested.email as string | null),
      normalizedPhone: normalizeCrmPhone(suggested.phone as string | null),
      notes: suggested.notes as string | null,
      accountId: suggested.accountId as string | null,
      userId: suggested.userId as string | null,
      pmsTenantId: suggested.pmsTenantId as string | null
    }
  });
  await tx.crmContact.update({
    where: { id: input.duplicateContactId },
    data: { mergedIntoContactId: input.primaryContactId, archivedAt: new Date(), normalizedEmail: null, normalizedPhone: null }
  });
  await syncCrmContactIdentities(tx, primary);

  const merge = await tx.crmContactMerge.create({
    data: {
      workspaceId: input.workspaceId,
      primaryContactId: input.primaryContactId,
      duplicateContactId: input.duplicateContactId,
      status: 'COMPLETED',
      preview: preview as unknown as Prisma.InputJsonValue,
      conflicts: preview.conflicts as unknown as Prisma.InputJsonValue,
      mergedAt: new Date(),
      actorId: input.actorId
    }
  });
  return { merge, contact: primary, preview };
}
