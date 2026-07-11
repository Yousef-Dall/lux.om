import type { DomainAuditDomain, DomainAuditOrigin, Prisma, PrismaClient } from '@prisma/client';
import type { Request } from 'express';

const BLOCKED_KEY = /(password|secret|token|authorization|cookie|national.?id|passport|file.?content|document.?body)/i;
const MAX_DEPTH = 5;
const MAX_STRING = 1000;

function sanitizeValue(value: unknown, depth = 0): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1) ?? null);
  }
  if (typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEY.test(key)) continue;
      const sanitized = sanitizeValue(child, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return String(value).slice(0, MAX_STRING);
}

export function sanitizeAuditMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizeValue(value);
  return sanitized === null ? undefined : sanitized;
}

export function requestAuditContext(req: Request) {
  const forwardedRequestId = req.header('x-request-id')?.trim();
  return {
    requestId: forwardedRequestId?.slice(0, 160) || undefined,
    sourceIp: req.ip?.slice(0, 120) || undefined,
    userAgent: req.header('user-agent')?.slice(0, 500) || undefined,
  };
}

export async function recordDomainAuditEvent(
  client: PrismaClient | Prisma.TransactionClient,
  input: {
    companyId?: string | null;
    domain: DomainAuditDomain;
    entityType: string;
    entityId?: string | null;
    action: string;
    actorId?: string | null;
    origin?: DomainAuditOrigin;
    changedFields?: string[];
    beforeMetadata?: unknown;
    afterMetadata?: unknown;
    metadata?: unknown;
    requestId?: string;
    sourceIp?: string;
    userAgent?: string;
  },
) {
  return client.domainAuditEvent.create({
    data: {
      companyId: input.companyId ?? null,
      domain: input.domain,
      entityType: input.entityType.slice(0, 120),
      entityId: input.entityId?.slice(0, 200) ?? null,
      action: input.action.slice(0, 160),
      actorId: input.actorId ?? null,
      origin: input.origin ?? 'MANUAL',
      changedFields: [...new Set(input.changedFields ?? [])].slice(0, 100),
      beforeMetadata: sanitizeAuditMetadata(input.beforeMetadata),
      afterMetadata: sanitizeAuditMetadata(input.afterMetadata),
      metadata: sanitizeAuditMetadata(input.metadata),
      requestId: input.requestId?.slice(0, 160),
      sourceIp: input.sourceIp?.slice(0, 120),
      userAgent: input.userAgent?.slice(0, 500),
    },
  });
}
