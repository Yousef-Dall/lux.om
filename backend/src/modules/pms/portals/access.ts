import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/http';

const ownerPortalPropertySelect = { id: true, name: true, addressLine: true } satisfies Prisma.PmsPropertySelect;

export function serializePortalProperty<T extends { addressLine: string | null }>(property: T) {
  const { addressLine, ...rest } = property;
  return { ...rest, address: addressLine };
}

export async function getUserOwnerPortalAccessSummary(userId: string) {
  const accesses = await prisma.pmsOwnerPortalAccess.findMany({
    where: { userId, active: true },
    select: {
      id: true,
      canApproveQuotes: true,
      canViewMaintenanceCosts: true,
      property: { select: ownerPortalPropertySelect },
      company: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
    },
    orderBy: [{ company: { nameEn: 'asc' } }, { property: { name: 'asc' } }],
  });
  return {
    hasAccess: accesses.length > 0,
    accesses: accesses.map((access) => ({
      ...access,
      property: serializePortalProperty(access.property),
    })),
  };
}

export async function resolveOwnerPortalAccess(input: { userId: string; accessId?: string }) {
  const access = await prisma.pmsOwnerPortalAccess.findFirst({
    where: { userId: input.userId, active: true, ...(input.accessId ? { id: input.accessId } : {}) },
    include: {
      property: { select: { ...ownerPortalPropertySelect, companyId: true } },
      company: { select: { id: true, slug: true, nameEn: true, nameAr: true, logo: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!access || access.property.companyId !== access.companyId) throw new AppError(403, 'Owner portal access is not available for this property.');
  return { ...access, property: serializePortalProperty(access.property) };
}

export async function getUserVendorPortalAccessSummary(userId: string) {
  const accesses = await prisma.pmsVendorPortalAccess.findMany({
    where: { userId, active: true, vendor: { active: true } },
    select: {
      id: true,
      vendor: { select: { id: true, name: true, trade: true } },
      company: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
    },
    orderBy: [{ company: { nameEn: 'asc' } }, { vendor: { name: 'asc' } }],
  });
  return { hasAccess: accesses.length > 0, accesses };
}

export async function resolveVendorPortalAccess(input: { userId: string; accessId?: string }) {
  const access = await prisma.pmsVendorPortalAccess.findFirst({
    where: { userId: input.userId, active: true, vendor: { active: true }, ...(input.accessId ? { id: input.accessId } : {}) },
    include: {
      vendor: { select: { id: true, companyId: true, name: true, phone: true, email: true, trade: true } },
      company: { select: { id: true, slug: true, nameEn: true, nameAr: true, logo: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!access || access.vendor.companyId !== access.companyId) throw new AppError(403, 'Vendor portal access is not available.');
  return access;
}
