import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../utils/http';

export const contractsRouter = Router();

const contractSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    landlordName: z.string().trim().min(2).max(120),
    landlordEmail: z.string().trim().email().optional(),
    landlordPhone: z.string().trim().max(40).optional(),
    tenantName: z.string().trim().min(2).max(120),
    tenantEmail: z.string().trim().email().optional(),
    tenantPhone: z.string().trim().max(40).optional(),
    propertyTitle: z.string().trim().min(2).max(160),
    propertyAddress: z.string().trim().min(2).max(300),
    propertyType: z.string().trim().max(80).optional(),
    propertyNotes: z.string().trim().max(2000).optional(),
    rentAmount: z.coerce.number().finite().min(0),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('OMR'),
    securityDeposit: z.coerce.number().finite().min(0).optional(),
    contractStartDate: z.coerce.date().optional(),
    contractEndDate: z.coerce.date().optional(),
    paymentSchedule: z.string().trim().max(300).optional(),
    utilitiesResponsibility: z.string().trim().max(1000).optional(),
    maintenanceTerms: z.string().trim().max(1000).optional(),
    noticePeriod: z.string().trim().max(300).optional(),
    additionalClauses: z.string().trim().max(3000).optional(),
    attachmentsNotes: z.string().trim().max(1000).optional(),
    listingId: z.string().trim().optional(),
    landlordUserId: z.string().trim().optional(),
    tenantUserId: z.string().trim().optional()
  })
  .strict();

const registrationSchema = z
  .object({
    registrationStatus: z.enum([
      'NOT_STARTED',
      'PREPARED_FOR_REGISTRATION',
      'DRAFT_READY_FOR_SUBMISSION',
      'SUBMITTED_EXTERNALLY',
      'REGISTERED_EXTERNALLY',
      'REJECTED',
      'NEEDS_CHANGES'
    ]),
    registrationReference: z.string().trim().max(160).optional().nullable(),
    registrationDocumentUrl: z.string().trim().max(1000).optional().nullable(),
    registrationNotes: z.string().trim().max(3000).optional().nullable(),
    adminRegistrationNotes: z.string().trim().max(3000).optional().nullable(),
    registrationChecklist: z.unknown().optional()
  })
  .strict();

const idParamsSchema = z.object({ id: z.string().trim().min(1) });

type AuthUser = {
  id: string;
  role: string;
};

function isAdmin(user: AuthUser) {
  return user.role === 'ADMIN';
}

async function assertContractDraftLinksAreAllowed(
  data: z.infer<typeof contractSchema>,
  user: AuthUser
) {
  if (isAdmin(user)) {
    if (data.listingId) {
      const listing = await prisma.listing.findUnique({
        where: {
          id: data.listingId
        },
        select: {
          id: true
        }
      });

      if (!listing) {
        throw new AppError(404, 'Listing not found');
      }
    }

    return {
      landlordUserId: data.landlordUserId,
      tenantUserId: data.tenantUserId
    };
  }

  if (data.landlordUserId && data.landlordUserId !== user.id) {
    throw new AppError(403, 'You cannot create a contract draft for another landlord');
  }

  if (data.tenantUserId) {
    throw new AppError(
      403,
      'Tenant account links require an admin-reviewed contract workflow'
    );
  }

  if (data.listingId) {
    const listing = await prisma.listing.findUnique({
      where: {
        id: data.listingId
      },
      select: {
        id: true,
        ownerId: true
      }
    });

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.ownerId !== user.id) {
      throw new AppError(403, 'You cannot create a contract draft for this listing');
    }
  }

  return {
    landlordUserId: data.landlordUserId ?? user.id,
    tenantUserId: null
  };
}

contractsRouter.post('/', requireAuth(), async (req, res, next) => {
  try {
    const data = contractSchema.parse(req.body);
    const allowedLinks = await assertContractDraftLinksAreAllowed(data, req.user!);

    const contract = await prisma.rentalContractDraft.create({
      data: {
        title: data.title,
        landlordName: data.landlordName,
        landlordEmail: data.landlordEmail,
        landlordPhone: data.landlordPhone,
        tenantName: data.tenantName,
        tenantEmail: data.tenantEmail,
        tenantPhone: data.tenantPhone,
        propertyTitle: data.propertyTitle,
        propertyAddress: data.propertyAddress,
        propertyType: data.propertyType,
        propertyNotes: data.propertyNotes,
        rentAmount: data.rentAmount.toString(),
        currency: data.currency.toUpperCase(),
        securityDeposit:
          data.securityDeposit === undefined
            ? null
            : data.securityDeposit.toString(),
        contractStartDate: data.contractStartDate,
        contractEndDate: data.contractEndDate,
        paymentSchedule: data.paymentSchedule,
        utilitiesResponsibility: data.utilitiesResponsibility,
        maintenanceTerms: data.maintenanceTerms,
        noticePeriod: data.noticePeriod,
        additionalClauses: data.additionalClauses,
        attachmentsNotes: data.attachmentsNotes,
        listingId: data.listingId,
        landlordUserId: allowedLinks.landlordUserId,
        tenantUserId: allowedLinks.tenantUserId,
        createdById: req.user!.id
      }
    });

    res.status(201).json({ contract });
  } catch (error) {
    next(error);
  }
});

contractsRouter.get('/mine', requireAuth(), async (req, res, next) => {
  try {
    const contracts = await prisma.rentalContractDraft.findMany({
      where: {
        OR: [
          { createdById: req.user!.id },
          { landlordUserId: req.user!.id },
          { tenantUserId: req.user!.id }
        ]
      },
      include: { listing: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ contracts });
  } catch (error) {
    next(error);
  }
});

contractsRouter.get('/admin/all', requireAuth(), requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const contracts = await prisma.rentalContractDraft.findMany({
      include: {
        listing: true,
        createdBy: { select: { id: true, name: true, email: true } },
        landlordUser: { select: { id: true, name: true, email: true } },
        tenantUser: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ contracts });
  } catch (error) {
    next(error);
  }
});

contractsRouter.patch('/admin/:id/registration', requireAuth(), requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = registrationSchema.parse(req.body);
    const now = new Date();

    const contract = await prisma.rentalContractDraft.update({
      where: { id },
      data: {
        registrationStatus: data.registrationStatus,
        registrationReference: data.registrationReference ?? undefined,
        registrationDocumentUrl: data.registrationDocumentUrl ?? undefined,
        registrationNotes: data.registrationNotes ?? undefined,
        adminRegistrationNotes: data.adminRegistrationNotes ?? undefined,
        registrationChecklist:
          data.registrationChecklist === undefined
            ? undefined
            : data.registrationChecklist === null
              ? Prisma.JsonNull
              : (data.registrationChecklist as Prisma.InputJsonValue),
        preparedForRegistrationAt:
          data.registrationStatus === 'PREPARED_FOR_REGISTRATION' ||
          data.registrationStatus === 'DRAFT_READY_FOR_SUBMISSION'
            ? now
            : undefined,
        submittedExternallyAt:
          data.registrationStatus === 'SUBMITTED_EXTERNALLY' ? now : undefined,
        registeredExternallyAt:
          data.registrationStatus === 'REGISTERED_EXTERNALLY' ? now : undefined
      }
    });

    res.json({ contract });
  } catch (error) {
    next(error);
  }
});