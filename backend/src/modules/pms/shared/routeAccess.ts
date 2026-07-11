import type { Request } from 'express';

import { prisma } from '../../../lib/prisma';
import { resolvePmsWorkspaceAccess, type PmsWorkspaceAccess } from '../access';
import { AppError } from '../../../utils/http';

export async function requirePmsRouteAccess(req: Request, companyId?: string) {
  if (!req.user) throw new AppError(401, 'Unauthorized');
  const access = await resolvePmsWorkspaceAccess({ userId: req.user.id, companyId });
  if (!access) throw new AppError(403, 'PMS access is not enabled for this workspace.');
  return access;
}

export function assertPmsPropertyScope(access: PmsWorkspaceAccess, propertyId: string) {
  if (
    !access.member.propertyScope.allProperties &&
    !access.member.propertyScope.propertyIds.includes(propertyId)
  ) {
    throw new AppError(403, 'This property is outside your PMS access scope.');
  }
}

export function propertyScopeWhere(access: PmsWorkspaceAccess) {
  return access.member.propertyScope.allProperties
    ? {}
    : { propertyId: { in: access.member.propertyScope.propertyIds } };
}

export async function assertPmsScopedPropertyExists(
  access: PmsWorkspaceAccess,
  propertyId: string,
) {
  assertPmsPropertyScope(access, propertyId);
  const property = await prisma.pmsProperty.findFirst({
    where: { id: propertyId, companyId: access.company.id, active: true },
    select: { id: true, name: true },
  });
  if (!property) throw new AppError(404, 'PMS property not found.');
  return property;
}

export async function assertPmsScopeLinks(input: {
  access: PmsWorkspaceAccess;
  propertyId: string;
  unitId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
}) {
  await assertPmsScopedPropertyExists(input.access, input.propertyId);
  const [unit, lease, tenant] = await Promise.all([
    input.unitId
      ? prisma.pmsUnit.findFirst({
          where: {
            id: input.unitId,
            companyId: input.access.company.id,
            propertyId: input.propertyId,
          },
          select: { id: true },
        })
      : null,
    input.leaseId
      ? prisma.pmsLease.findFirst({
          where: {
            id: input.leaseId,
            companyId: input.access.company.id,
            propertyId: input.propertyId,
          },
          select: { id: true, unitId: true, tenantId: true, currency: true },
        })
      : null,
    input.tenantId
      ? prisma.pmsTenant.findFirst({
          where: { id: input.tenantId, companyId: input.access.company.id },
          select: { id: true },
        })
      : null,
  ]);
  if (input.unitId && !unit) throw new AppError(400, 'Unit must belong to the selected property.');
  if (input.leaseId && !lease) throw new AppError(400, 'Lease must belong to the selected property.');
  if (input.tenantId && !tenant) throw new AppError(400, 'Tenant must belong to the selected company.');
  if (lease && input.unitId && lease.unitId !== input.unitId) throw new AppError(400, 'Lease and unit do not match.');
  if (lease && input.tenantId && lease.tenantId !== input.tenantId) throw new AppError(400, 'Lease and tenant do not match.');
  return { unit, lease, tenant };
}
