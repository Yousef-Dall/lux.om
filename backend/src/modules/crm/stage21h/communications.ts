import * as nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

import { Prisma, type CrmCommunicationChannel, type CrmDeliveryProvider, type CrmDeliveryStatus, type PrismaClient } from '@prisma/client';

import { AppError } from '../../../utils/http';
import { normalizeCrmEmail, normalizeCrmPhone } from './identity';

export type CrmDeliveryAdapterInput = {
  destination: string;
  subject?: string | null;
  body: string;
};

export type CrmDeliveryAdapterResult = {
  status: 'SUBMITTED';
  providerMessageId: string;
  metadata?: Prisma.InputJsonValue;
};

export interface CrmDeliveryAdapter {
  provider: CrmDeliveryProvider;
  channel: CrmCommunicationChannel;
  submit(input: CrmDeliveryAdapterInput): Promise<CrmDeliveryAdapterResult>;
}

class VerifiedEmailAdapter implements CrmDeliveryAdapter {
  provider = 'VERIFIED_EMAIL' as const;
  channel = 'EMAIL' as const;

  async submit(input: CrmDeliveryAdapterInput): Promise<CrmDeliveryAdapterResult> {
    if (process.env.CRM_EMAIL_DELIVERY_ENABLED !== 'true') {
      throw new AppError(503, 'CRM email delivery is not enabled. Draft-only communication remains available.');
    }
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!host || !Number.isFinite(port) || !user || !pass || !from) {
      throw new AppError(503, 'Verified SMTP delivery infrastructure is not configured.');
    }
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
    const result = await transporter.sendMail({ from, to: input.destination, subject: input.subject ?? 'lux.om', text: input.body });
    const providerMessageId = typeof result.messageId === 'string' && result.messageId.trim()
      ? result.messageId
      : `smtp-${Date.now()}`;
    return { status: 'SUBMITTED', providerMessageId };
  }
}

export const crmDeliveryAdapters: Partial<Record<CrmDeliveryProvider, CrmDeliveryAdapter>> = {
  VERIFIED_EMAIL: new VerifiedEmailAdapter()
};

export function normalizeCommunicationDestination(channel: CrmCommunicationChannel, value: string) {
  if (channel === 'EMAIL') return normalizeCrmEmail(value);
  return normalizeCrmPhone(value);
}

function localMinutes(timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function isInsideQuietHours(minutes: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export async function evaluateCrmCommunicationGovernance(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    contactId: string;
    channel: CrmCommunicationChannel;
    destination: string;
    provider: CrmDeliveryProvider;
    now?: Date;
    includeQueuedInRateLimit?: boolean;
  }
) {
  const now = input.now ?? new Date();
  const normalizedDestination = normalizeCommunicationDestination(input.channel, input.destination);
  if (!normalizedDestination) throw new AppError(400, 'A valid communication destination is required.');

  const [contact, preference, suppression, policy] = await Promise.all([
    tx.crmContact.findFirst({
      where: { id: input.contactId, workspaceId: input.workspaceId, mergedIntoContactId: null },
      select: { normalizedEmail: true, normalizedPhone: true }
    }),
    tx.crmContactChannelPreference.findUnique({
      where: { contactId_channel: { contactId: input.contactId, channel: input.channel } }
    }),
    tx.crmSuppressionEntry.findUnique({
      where: {
        workspaceId_channel_normalizedDestination: {
          workspaceId: input.workspaceId,
          channel: input.channel,
          normalizedDestination
        }
      }
    }),
    tx.crmWorkspaceCommunicationPolicy.upsert({
      where: { workspaceId: input.workspaceId },
      update: {},
      create: { workspaceId: input.workspaceId }
    })
  ]);

  if (!contact) throw new AppError(404, 'CRM contact not found.');
  const expectedDestination = input.channel === 'EMAIL' ? contact.normalizedEmail : contact.normalizedPhone;
  if (!expectedDestination || expectedDestination !== normalizedDestination) {
    throw new AppError(400, 'The communication destination must match the selected CRM contact identity.');
  }

  if (suppression?.active && (!suppression.expiresAt || suppression.expiresAt > now)) {
    return { allowed: false as const, normalizedDestination, reason: `suppressed:${suppression.reason}` };
  }
  if (preference?.status === 'OPTED_OUT' || preference?.status === 'BLOCKED') {
    return { allowed: false as const, normalizedDestination, reason: `consent:${preference.status}` };
  }
  if (input.provider !== 'DRAFT_ONLY' && !['CONSENTED', 'LEGITIMATE_INTEREST'].includes(preference?.status ?? 'UNKNOWN')) {
    return { allowed: false as const, normalizedDestination, reason: 'consent:UNKNOWN' };
  }
  if (input.channel === 'WHATSAPP' && input.provider !== 'DRAFT_ONLY') {
    return { allowed: false as const, normalizedDestination, reason: 'whatsapp_adapter_not_configured' };
  }

  if (input.provider !== 'DRAFT_ONLY') {
    const timezone = preference?.timezone || policy.timezone;
    const start = preference?.quietHoursStart ?? policy.quietHoursStart;
    const end = preference?.quietHoursEnd ?? policy.quietHoursEnd;
    if (isInsideQuietHours(localMinutes(timezone, now), start, end)) {
      return { allowed: false as const, normalizedDestination, reason: 'quiet_hours' };
    }
    const recent = await tx.crmDeliveryAttempt.count({
      where: {
        workspaceId: input.workspaceId,
        attemptedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
        status: { in: input.includeQueuedInRateLimit === false
          ? ['PROCESSING', 'SUBMITTED', 'DELIVERED']
          : ['QUEUED', 'PROCESSING', 'SUBMITTED', 'DELIVERED'] }
      }
    });
    if (recent >= policy.hourlyRateLimit) {
      return { allowed: false as const, normalizedDestination, reason: 'workspace_rate_limit' };
    }
  }
  return { allowed: true as const, normalizedDestination, reason: null };
}

export async function createCrmDeliveryAttempt(
  tx: Prisma.TransactionClient,
  input: {
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
    actorId: string;
  }
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`crm-delivery:${input.workspaceId}:${input.idempotencyKey}`}))`;
  const existing = await tx.crmDeliveryAttempt.findUnique({
    where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } }
  });
  if (existing) return existing;
  const governance = await evaluateCrmCommunicationGovernance(tx, input);
  const commonData = {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    leadId: input.leadId ?? null,
    dealId: input.dealId ?? null,
    activityId: input.activityId ?? null,
    templateVersionId: input.templateVersionId ?? null,
    channel: input.channel,
    provider: input.provider,
    destination: input.destination,
    normalizedDestination: governance.normalizedDestination,
    idempotencyKey: input.idempotencyKey,
    createdById: input.actorId,
    metadata: { subject: input.subject ?? null, body: input.body }
  } satisfies Prisma.CrmDeliveryAttemptUncheckedCreateInput;

  if (!governance.allowed) {
    const deferrable = input.provider !== 'DRAFT_ONLY' && ['quiet_hours', 'workspace_rate_limit'].includes(governance.reason);
    return tx.crmDeliveryAttempt.create({
      data: {
        ...commonData,
        status: deferrable ? 'QUEUED' : 'BLOCKED',
        errorCode: deferrable ? `deferred:${governance.reason}` : governance.reason,
        blockedAt: deferrable ? null : new Date()
      }
    });
  }

  if (input.provider === 'DRAFT_ONLY') {
    return tx.crmDeliveryAttempt.create({ data: { ...commonData, status: 'DRAFT' } });
  }

  const adapter = crmDeliveryAdapters[input.provider];
  if (!adapter || adapter.channel !== input.channel) {
    throw new AppError(503, 'The requested CRM delivery adapter is not configured.');
  }

  // Real provider submission is intentionally deferred to the durable delivery worker.
  // This keeps external side effects outside the request transaction and preserves an
  // auditable QUEUED record if the API process exits after committing the request.
  return tx.crmDeliveryAttempt.create({ data: { ...commonData, status: 'QUEUED' } });
}

type ClaimedDeliveryAttempt = Awaited<ReturnType<PrismaClient['crmDeliveryAttempt']['findUniqueOrThrow']>>;

type DeliveryAttemptMetadata = {
  subject?: string | null;
  body?: string;
};

function parseDeliveryPayload(attempt: ClaimedDeliveryAttempt): CrmDeliveryAdapterInput {
  const metadata = attempt.metadata && typeof attempt.metadata === 'object' && !Array.isArray(attempt.metadata)
    ? attempt.metadata as DeliveryAttemptMetadata
    : null;
  if (!metadata || typeof metadata.body !== 'string' || !metadata.body.trim()) {
    throw new AppError(409, 'Queued CRM delivery payload is missing or has been retained-redacted.');
  }
  return {
    destination: attempt.destination,
    subject: typeof metadata.subject === 'string' ? metadata.subject : null,
    body: metadata.body
  };
}

type DeliveryClaimResult =
  | { kind: 'claimed'; attempt: ClaimedDeliveryAttempt }
  | { kind: 'blocked'; id: string; reason: string }
  | { kind: 'deferred'; id: string; reason: string }
  | null;

async function claimNextQueuedDelivery(prisma: PrismaClient): Promise<DeliveryClaimResult> {
  const claimToken = randomUUID();
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "CrmDeliveryAttempt"
      WHERE status = 'QUEUED'
      ORDER BY "attemptedAt" ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1`;
    const id = candidate[0]?.id;
    if (!id) return null;
    const attempt = await tx.crmDeliveryAttempt.findUniqueOrThrow({ where: { id } });
    const governance = await evaluateCrmCommunicationGovernance(tx, {
      workspaceId: attempt.workspaceId,
      contactId: attempt.contactId,
      channel: attempt.channel,
      provider: attempt.provider,
      destination: attempt.destination,
      includeQueuedInRateLimit: false
    });
    if (!governance.allowed) {
      const deferrable = ['quiet_hours', 'workspace_rate_limit'].includes(governance.reason);
      await tx.crmDeliveryAttempt.update({
        where: { id },
        data: {
          status: deferrable ? 'QUEUED' : 'BLOCKED',
          errorCode: deferrable ? `deferred:${governance.reason}` : governance.reason,
          blockedAt: deferrable ? null : new Date()
        }
      });
      return deferrable
        ? { kind: 'deferred' as const, id, reason: governance.reason }
        : { kind: 'blocked' as const, id, reason: governance.reason };
    }
    const claimed = await tx.crmDeliveryAttempt.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        claimedAt: new Date(),
        claimToken,
        errorCode: null,
        errorMessage: null
      }
    });
    return { kind: 'claimed' as const, attempt: claimed };
  }, { isolationLevel: 'ReadCommitted' });
}

export async function submitQueuedCrmDeliveryAttempts(
  prisma: PrismaClient,
  options: { limit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 250);
  const results: Array<{ id: string; status: CrmDeliveryStatus; error?: string }> = [];

  for (let index = 0; index < limit; index += 1) {
    const claim = await claimNextQueuedDelivery(prisma);
    if (!claim) break;
    if (claim.kind === 'deferred') {
      results.push({ id: claim.id, status: 'QUEUED', error: claim.reason });
      break;
    }
    if (claim.kind === 'blocked') {
      results.push({ id: claim.id, status: 'BLOCKED', error: claim.reason });
      continue;
    }
    const attempt = claim.attempt;
    const adapter = crmDeliveryAdapters[attempt.provider];

    try {
      if (!adapter || adapter.channel !== attempt.channel) {
        throw new AppError(503, 'The queued CRM delivery adapter is not configured.');
      }
      const result = await adapter.submit(parseDeliveryPayload(attempt));
      const updated = await prisma.crmDeliveryAttempt.updateMany({
        where: { id: attempt.id, status: 'PROCESSING', claimToken: attempt.claimToken },
        data: {
          status: result.status,
          submittedAt: new Date(),
          providerMessageId: result.providerMessageId,
          claimedAt: null,
          claimToken: null,
          metadata: result.metadata ?? (attempt.metadata === null
            ? Prisma.JsonNull
            : attempt.metadata as Prisma.InputJsonValue)
        }
      });
      if (updated.count !== 1) throw new AppError(409, 'CRM delivery claim was lost before provider submission was recorded.');
      results.push({ id: attempt.id, status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CRM delivery failed.';
      await prisma.crmDeliveryAttempt.updateMany({
        where: { id: attempt.id, status: 'PROCESSING', claimToken: attempt.claimToken },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          claimedAt: null,
          claimToken: null,
          errorCode: error instanceof AppError ? `HTTP_${error.statusCode}` : 'PROVIDER_SUBMISSION_FAILED',
          errorMessage: message.slice(0, 1000)
        }
      });
      results.push({ id: attempt.id, status: 'FAILED', error: message });
    }
  }

  return results;
}

export async function redactExpiredCrmDeliveryContent(prisma: PrismaClient, now = new Date()) {
  const policies = await prisma.crmWorkspaceCommunicationPolicy.findMany({
    select: { workspaceId: true, retentionDays: true }
  });
  const summary: Array<{ workspaceId: string; redacted: number }> = [];
  for (const policy of policies) {
    const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.crmDeliveryAttempt.updateMany({
      where: {
        workspaceId: policy.workspaceId,
        attemptedAt: { lt: cutoff },
        status: { in: ['DRAFT', 'DELIVERED', 'FAILED', 'BOUNCED', 'BLOCKED', 'CANCELLED'] },
        NOT: { destination: '[retention-redacted]' }
      },
      data: {
        destination: '[retention-redacted]',
        normalizedDestination: '[retention-redacted]',
        metadata: Prisma.DbNull
      }
    });
    summary.push({ workspaceId: policy.workspaceId, redacted: result.count });
  }
  return summary;
}

const providerTransitions: Record<'DELIVERED' | 'FAILED' | 'BOUNCED', CrmDeliveryStatus> = {
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  BOUNCED: 'BOUNCED'
};

export async function confirmCrmDeliveryFromProvider(
  tx: Prisma.TransactionClient,
  input: { provider: CrmDeliveryProvider; providerMessageId: string; status: keyof typeof providerTransitions; metadata?: Prisma.InputJsonValue }
) {
  const attempt = await tx.crmDeliveryAttempt.findFirst({
    where: { provider: input.provider, providerMessageId: input.providerMessageId },
    orderBy: { attemptedAt: 'desc' }
  });
  if (!attempt) throw new AppError(404, 'CRM delivery attempt not found.');
  if (attempt.status === 'DELIVERED' || attempt.status === 'BOUNCED') return attempt;
  if (!['SUBMITTED', 'FAILED'].includes(attempt.status)) throw new AppError(409, 'CRM delivery is not awaiting provider confirmation.');
  const now = new Date();
  return tx.crmDeliveryAttempt.update({
    where: { id: attempt.id },
    data: {
      status: providerTransitions[input.status],
      providerConfirmedAt: now,
      deliveredAt: input.status === 'DELIVERED' ? now : null,
      failedAt: input.status === 'FAILED' ? now : attempt.failedAt,
      bouncedAt: input.status === 'BOUNCED' ? now : null,
      metadata: input.metadata ?? (attempt.metadata === null ? Prisma.JsonNull : attempt.metadata as Prisma.InputJsonValue)
    }
  });
}
