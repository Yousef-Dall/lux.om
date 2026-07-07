import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  AccountSecurityEventType,
  ActivityStatus,
  BookingStatus,
  ContractDraftStatus,
  DeveloperProjectStatus,
  EmailDeliveryStatus,
  ListingStatus,
  MarketplaceTransactionStatus,
  NotificationType,
  PaymentStatus,
  RentPaymentStatus,
  type Prisma
} from '@prisma/client';
import { z } from 'zod';

import { requireAdmin, requireAuth, signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { recordAccountSecurityEvent } from '../lib/accountSecurityEvents';
import { AppError, publicUser } from '../utils/http';
import { authAbuseRateLimiters } from '../middleware/rateLimit';
import { env } from '../config/env';
import { getEmailDeliveryRetentionDays } from '../services/emailDeliveryRetention';
import { validatePasswordPolicy } from '../utils/passwordPolicy';
import {
  createEmailChangeChallenge,
  createEmailVerificationChallenge,
  createPasswordResetChallenge,
  deliverEmailChangeVerificationLink,
  deliverEmailVerificationLink,
  deliverPasswordResetLink,
  hashEmailChangeToken,
  hashEmailVerificationToken,
  hashPasswordResetToken
} from '../services/emailVerification';
import {
  buildGoogleAuthorizationUrl,
  consumeOauthLoginCode,
  createOauthLoginCode,
  signInWithGoogleCode
} from '../services/googleOAuth';

export const authRouter = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(1).max(100),
    role: z.enum(['USER', 'OWNER', 'ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'DEVELOPER']).default('USER'),
    phone: z.string().trim().min(6).max(30).optional(),
    companyName: z.string().trim().min(2).max(120).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const passwordIssues = validatePasswordPolicy({
      password: data.password,
      email: data.email,
      name: data.name
    });

    for (const issue of passwordIssues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: issue.message
      });
    }
  });

const loginSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(1)
  })
  .strict();

const requestPasswordResetSchema = z
  .object({
    email: z.string().trim().email().toLowerCase()
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: z.string().min(1).max(100)
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(100).optional(),
    newPassword: z.string().min(1).max(100)
  })
  .strict();

const deactivateAccountSchema = z
  .object({
    confirmation: z.string().trim().max(32),
    currentPassword: z.string().min(1).max(100).optional()
  })
  .strict();

const requestEmailChangeSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    currentPassword: z.string().min(1).max(100).optional()
  })
  .strict();

const confirmEmailChangeSchema = z
  .object({
    token: z.string().trim().min(32).max(256)
  })
  .strict();


type AdminSystemHealthStatus = 'healthy' | 'warning' | 'critical';

function isLocalhostValue(value: string | undefined | null) {
  if (!value) return false;

  return (
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('0.0.0.0')
  );
}

function usesHttpsUrl(value: string | undefined | null) {
  if (!value) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function buildHealthCheck(
  key: string,
  label: string,
  status: AdminSystemHealthStatus,
  message: string
) {
  return {
    key,
    label,
    status,
    message
  };
}

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(6).max(30).or(z.literal('')).optional(),
    companyName: z.string().trim().min(2).max(120).or(z.literal('')).optional(),
    emailBookingUpdates: z.boolean().optional(),
    emailSavedSearchUpdates: z.boolean().optional(),
    emailMarketingUpdates: z.boolean().optional()
  })
  .strict();



const adminEmailDeliveriesQuerySchema = z
  .object({
    query: z.string().trim().max(160).optional(),
    status: z
      .enum([
        'all',
        EmailDeliveryStatus.LOGGED,
        EmailDeliveryStatus.SENT,
        EmailDeliveryStatus.SKIPPED,
        EmailDeliveryStatus.FAILED
      ])
      .default('all'),
    type: z.nativeEnum(NotificationType).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

const adminUsersQuerySchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    role: z.enum(['USER', 'OWNER', 'ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'DEVELOPER', 'ADMIN']).optional(),
    status: z
      .enum(['all', 'active', 'suspended', 'deactivated', 'verified', 'unverified'])
      .default('all'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

const adminUserSuspensionSchema = z
  .object({
    suspended: z.boolean(),
    reason: z.string().trim().min(10).max(500).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.suspended && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Suspension reason is required'
      });
    }
  });

const adminEmailVerificationSchema = z
  .object({
    emailVerified: z.boolean(),
    reason: z.string().trim().min(10).max(500)
  })
  .strict();

const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(32).max(256)
  })
  .strict();

const googleStartSchema = z
  .object({
    role: z.enum(['USER', 'OWNER', 'ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'DEVELOPER']).optional(),
    returnTo: z.string().trim().max(200).optional()
  })
  .strict();

const googleCallbackSchema = z
  .object({
    code: z.string().trim().min(1),
    state: z.string().trim().min(1)
  })
  .strict();

const googleExchangeSchema = z
  .object({
    code: z.string().trim().min(32).max(256)
  })
  .strict();


function buildFrontendRedirect(pathname: string, params: Record<string, string>) {
  const frontendUrl = new URL(pathname, env.FRONTEND_URL ?? env.CORS_ORIGIN[0]);

  for (const [key, value] of Object.entries(params)) {
    frontendUrl.searchParams.set(key, value);
  }

  return frontendUrl.toString();
}

function buildGoogleAuthErrorRedirect(message: string) {
  return buildFrontendRedirect('/login', {
    googleError: message
  });
}

function adminUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  companyName?: string | null;
  googleId?: string | null;
  passwordLoginEnabled?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: Date | string | null;
  suspendedAt?: Date | string | null;
  deactivatedAt?: Date | string | null;
  deactivationReason?: string | null;
  suspendedReason?: string | null;
  suspendedById?: string | null;
  authTokenVersion?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    companyName: user.companyName ?? null,
    googleConnected: Boolean(user.googleId),
    passwordLoginEnabled: Boolean(user.passwordLoginEnabled),
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    suspendedAt: user.suspendedAt ?? null,
    deactivatedAt: user.deactivatedAt ?? null,
    deactivationReason: user.deactivationReason ?? null,
    suspendedReason: user.suspendedReason ?? null,
    suspendedById: user.suspendedById ?? null,
    accountStatus: user.deactivatedAt ? 'DEACTIVATED' : user.suspendedAt ? 'SUSPENDED' : 'ACTIVE',
    authTokenVersion: user.authTokenVersion ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getRouteParam(value: string | string[] | undefined, name: string) {
  if (!value || Array.isArray(value)) {
    throw new AppError(400, `Invalid ${name}`);
  }

  return value;
}

function getAdminUsersWhere(input: z.infer<typeof adminUsersQuerySchema>) {
  const where: Prisma.UserWhereInput = {};

  if (input.query) {
    where.OR = [
      {
        name: {
          contains: input.query,
          mode: 'insensitive'
        }
      },
      {
        email: {
          contains: input.query,
          mode: 'insensitive'
        }
      },
      {
        companyName: {
          contains: input.query,
          mode: 'insensitive'
        }
      }
    ];
  }

  if (input.role) {
    where.role = input.role;
  }

  if (input.status === 'active') {
    where.suspendedAt = null;
    where.deactivatedAt = null;
  }

  if (input.status === 'suspended') {
    where.suspendedAt = {
      not: null
    };
  }

  if (input.status === 'deactivated') {
    where.deactivatedAt = {
      not: null
    };
  }

  if (input.status === 'verified') {
    where.emailVerified = true;
  }

  if (input.status === 'unverified') {
    where.emailVerified = false;
  }

  return where;
}


const activeBookingStatuses = [
  BookingStatus.PENDING,
  BookingStatus.OWNER_APPROVED,
  BookingStatus.ADMIN_CONFIRMED,
  BookingStatus.CANCELLATION_REQUESTED
];

const activeInventoryStatuses = [ListingStatus.PENDING, ListingStatus.APPROVED];
const activeActivityStatuses = [ActivityStatus.PENDING, ActivityStatus.APPROVED];
const activeProjectStatuses = [
  DeveloperProjectStatus.PENDING,
  DeveloperProjectStatus.APPROVED
];
const activeContractStatuses = [
  ContractDraftStatus.DRAFT,
  ContractDraftStatus.READY_FOR_REVIEW,
  ContractDraftStatus.SIGNED_EXTERNALLY
];
const activeTransactionStatuses = [
  MarketplaceTransactionStatus.DRAFT,
  MarketplaceTransactionStatus.ACTIVE,
  MarketplaceTransactionStatus.DISPUTED
];

type AccountDeletionBlocker = {
  key: string;
  label: string;
  count: number;
};

function buildDeletedAccountEmail(userId: string) {
  const safeId = userId.replace(/[^a-z0-9]/gi, '').slice(0, 32) || 'account';

  return `deleted-${safeId}@deleted.lux.om`.toLowerCase();
}

function getBlockingItems(counts: Record<string, number>): AccountDeletionBlocker[] {
  const labels: Array<[string, string]> = [
    ['activeBookings', 'active bookings'],
    ['activeListings', 'active listings'],
    ['activeActivities', 'active activities'],
    ['activeProjects', 'active developer projects'],
    ['activeContracts', 'active rental contracts'],
    ['activeRentSchedules', 'active rent schedules'],
    ['activeRentDues', 'open rent payment dues'],
    ['activeTransactions', 'active marketplace transactions'],
    ['pendingLedgerEntries', 'pending payment ledger entries']
  ];

  return labels
    .map(([key, label]) => ({
      key: String(key),
      label,
      count: counts[String(key)] ?? 0
    }))
    .filter((item) => item.count > 0);
}

async function getAccountDeletionBlockers(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string
) {
  const [
    activeBookings,
    activeListings,
    activeActivities,
    activeProjects,
    activeContracts,
    activeRentSchedules,
    activeRentDues,
    activeTransactions,
    pendingLedgerEntries
  ] = await Promise.all([
    db.booking.count({
      where: {
        userId,
        status: {
          in: activeBookingStatuses
        }
      }
    }),
    db.listing.count({
      where: {
        ownerId: userId,
        status: {
          in: activeInventoryStatuses
        }
      }
    }),
    db.activity.count({
      where: {
        ownerId: userId,
        status: {
          in: activeActivityStatuses
        }
      }
    }),
    db.developerProject.count({
      where: {
        ownerId: userId,
        status: {
          in: activeProjectStatuses
        }
      }
    }),
    db.rentalContractDraft.count({
      where: {
        status: {
          in: activeContractStatuses
        },
        OR: [
          { createdById: userId },
          { landlordUserId: userId },
          { tenantUserId: userId }
        ]
      }
    }),
    db.rentPaymentSchedule.count({
      where: {
        active: true,
        OR: [
          { createdById: userId },
          { landlordUserId: userId },
          { tenantUserId: userId }
        ]
      }
    }),
    db.rentPaymentDueItem.count({
      where: {
        status: {
          in: [RentPaymentStatus.PENDING, RentPaymentStatus.DUE_SOON, RentPaymentStatus.OVERDUE]
        },
        schedule: {
          OR: [
            { createdById: userId },
            { landlordUserId: userId },
            { tenantUserId: userId }
          ]
        }
      }
    }),
    db.marketplaceTransaction.count({
      where: {
        status: {
          in: activeTransactionStatuses
        },
        OR: [
          { buyerId: userId },
          { sellerId: userId },
          { landlordId: userId },
          { tenantId: userId },
          { providerId: userId },
          { participants: { some: { userId } } }
        ]
      }
    }),
    db.marketplacePaymentLedger.count({
      where: {
        status: PaymentStatus.PENDING,
        OR: [{ payerId: userId }, { payeeId: userId }]
      }
    })
  ]);

  return getBlockingItems({
    activeBookings,
    activeListings,
    activeActivities,
    activeProjects,
    activeContracts,
    activeRentSchedules,
    activeRentDues,
    activeTransactions,
    pendingLedgerEntries
  });
}

authRouter.get('/google/start', authAbuseRateLimiters.googleStart, (req, res, next) => {
  try {
    const data = googleStartSchema.parse(req.query);
    const url = buildGoogleAuthorizationUrl({
      role: data.role,
      returnTo: data.returnTo
    });

    res.redirect(url);
  } catch (error) {
    next(error);
  }
});

authRouter.get('/google/callback', authAbuseRateLimiters.googleCallback, async (req, res) => {
  try {
    const data = googleCallbackSchema.parse(req.query);
    const result = await signInWithGoogleCode(data);
    const loginCode = await createOauthLoginCode({
      userId: result.user.id,
      returnTo: result.returnTo
    });

    res.redirect(
      buildFrontendRedirect('/auth/google/callback', {
        code: loginCode.code,
        returnTo: result.returnTo
      })
    );
  } catch (error) {
    console.error(error);

    if (error instanceof AppError) {
      res.redirect(buildGoogleAuthErrorRedirect(error.message));
      return;
    }

    res.redirect(buildGoogleAuthErrorRedirect('Google login failed. Please try again.'));
  }
});

authRouter.post('/google/exchange', authAbuseRateLimiters.googleExchange, async (req, res, next) => {
  try {
    const data = googleExchangeSchema.parse(req.body);
    const result = await consumeOauthLoginCode(data.code);

    if (result.user.suspendedAt) {
      throw new AppError(
        403,
        'Google account is suspended. Contact lux.om support if you believe this is a mistake.'
      );
    }

    if (result.user.deactivatedAt) {
      throw new AppError(403, 'This account has been deleted.');
    }

    res.json({
      user: publicUser(result.user),
      token: signToken(result.user),
      returnTo: result.returnTo
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/register', authAbuseRateLimiters.register, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email
      }
    });

    if (existingUser) {
      throw new AppError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationChallenge = createEmailVerificationChallenge();

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role,
        phone: data.phone?.trim() || null,
        companyName: data.companyName?.trim() || null,
        emailVerified: false,
        emailVerificationTokenHash: verificationChallenge.tokenHash,
        emailVerificationExpiresAt: verificationChallenge.expiresAt
      }
    });

    const verificationDelivery = await deliverEmailVerificationLink({
      email: user.email,
      name: user.name,
      token: verificationChallenge.token
    });

    res.status(201).json({
      user: publicUser(user),
      token: signToken(user),
      verification: {
        required: true,
        emailSent: verificationDelivery.emailSent,
        devVerificationUrl: verificationDelivery.devVerificationUrl ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authAbuseRateLimiters.login, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: {
        email: data.email
      }
    });

    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (user.suspendedAt) {
      throw new AppError(
        403,
        'Account is suspended. Contact lux.om support if you believe this is a mistake.'
      );
    }

    if (user.deactivatedAt) {
      throw new AppError(403, 'This account has been deleted.');
    }

    if (!user.passwordLoginEnabled) {

      throw new AppError(401, 'Invalid email or password');

    }


    const passwordMatches = await bcrypt.compare(data.password, user.password);

    if (!passwordMatches) {
      throw new AppError(401, 'Invalid credentials');
    }

    res.json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/request-password-reset', authAbuseRateLimiters.passwordResetRequest, async (req, res, next) => {
  try {
    const data = requestPasswordResetSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: {
        email: data.email
      }
    });

    let devPasswordResetUrl: string | null = null;

    if (user) {
      const resetChallenge = createPasswordResetChallenge();

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          passwordResetTokenHash: resetChallenge.tokenHash,
          passwordResetExpiresAt: resetChallenge.expiresAt,
          passwordResetUsedAt: null
        }
      });

      try {
        const delivery = await deliverPasswordResetLink({
          email: updatedUser.email,
          name: updatedUser.name,
          token: resetChallenge.token
        });

        devPasswordResetUrl = delivery.devPasswordResetUrl ?? null;
      } catch (deliveryError) {
        console.error('[lux.om] Password reset email delivery failed', deliveryError);
      }
    }

    res.json({
      ok: true,
      reset: {
        devPasswordResetUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', authAbuseRateLimiters.passwordReset, async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const tokenHash = hashPasswordResetToken(data.token);
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: now
        },
        passwordResetUsedAt: null
      }
    });

    if (!user) {
      throw new AppError(400, 'Password reset link is invalid or expired');
    }

    const passwordIssues = validatePasswordPolicy({
      password: data.password,
      email: user.email,
      name: user.name
    });

    if (passwordIssues.length > 0) {
      throw new AppError(
        400,
        `Password does not meet security requirements: ${passwordIssues
          .map((issue) => issue.message)
          .join(' ')}`
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: {
            gt: now
          },
          passwordResetUsedAt: null
        },
        data: {
          password: passwordHash,
          passwordLoginEnabled: true,
          authTokenVersion: {
            increment: 1
          },
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetUsedAt: now
        }
      });

      if (updated.count !== 1) {
        throw new AppError(400, 'Password reset link is invalid or expired');
      }

      return tx.user.findUniqueOrThrow({
        where: {
          id: user.id
        }
      });
    });

    await recordAccountSecurityEvent(prisma, {
      userId: updatedUser.id,
      type: AccountSecurityEventType.PASSWORD_RESET_COMPLETED,
      title: 'Password reset completed',
      message:
        'Your lux.om password was reset successfully. If this was not you, change your password immediately and contact support.',
      metadata: {
        email: updatedUser.email
      }
    });

    res.json({
      ok: true,
      user: publicUser(updatedUser)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/change-password',
  authAbuseRateLimiters.changePassword,
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const data = changePasswordSchema.parse(req.body);
      const user = await prisma.user.findUniqueOrThrow({
        where: {
          id: req.user.id
        }
      });

      const passwordIssues = validatePasswordPolicy({
        password: data.newPassword,
        email: user.email,
        name: user.name
      });

      if (passwordIssues.length > 0) {
        throw new AppError(
          400,
          `Password does not meet security requirements: ${passwordIssues
            .map((issue) => issue.message)
            .join(' ')}`
        );
      }

      if (user.passwordLoginEnabled) {
        if (!data.currentPassword) {
          throw new AppError(400, 'Current password is required');
        }

        const currentPasswordMatches = await bcrypt.compare(data.currentPassword, user.password);

        if (!currentPasswordMatches) {
          throw new AppError(401, 'Current password is incorrect');
        }

        const samePassword = await bcrypt.compare(data.newPassword, user.password);

        if (samePassword) {
          throw new AppError(400, 'New password must be different from your current password');
        }
      } else if (!user.googleId) {
        throw new AppError(400, 'Current password is required');
      }

      const passwordHash = await bcrypt.hash(data.newPassword, 12);

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          password: passwordHash,
          passwordLoginEnabled: true,
          authTokenVersion: {
            increment: 1
          },
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetUsedAt: null
        }
      });

      await recordAccountSecurityEvent(prisma, {
        userId: updatedUser.id,
        type: AccountSecurityEventType.PASSWORD_CHANGED,
        title: 'Password changed',
        message:
          'Your lux.om password was changed successfully. If this was not you, use password reset and contact support.',
        metadata: {
          email: updatedUser.email
        }
      });

      res.json({
        ok: true,
        user: publicUser(updatedUser),
        token: signToken(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/request-email-change',
  authAbuseRateLimiters.emailChangeRequest,
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const data = requestEmailChangeSchema.parse(req.body);
      const user = await prisma.user.findUniqueOrThrow({
        where: {
          id: req.user.id
        }
      });

      if (data.email === user.email) {
        throw new AppError(400, 'New email must be different from your current email');
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { pendingEmail: data.email }],
          NOT: {
            id: user.id
          }
        }
      });

      if (existingUser) {
        throw new AppError(409, 'Email is already in use');
      }

      if (!user.passwordLoginEnabled) {
        throw new AppError(400, 'Set a password before changing your email');
      }

      if (!data.currentPassword) {
        throw new AppError(400, 'Current password is required');
      }

      const currentPasswordMatches = await bcrypt.compare(data.currentPassword, user.password);

      if (!currentPasswordMatches) {
        throw new AppError(401, 'Current password is incorrect');
      }

      const emailChangeChallenge = createEmailChangeChallenge();

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          pendingEmail: data.email,
          emailChangeTokenHash: emailChangeChallenge.tokenHash,
          emailChangeExpiresAt: emailChangeChallenge.expiresAt
        }
      });

      const delivery = await deliverEmailChangeVerificationLink({
        email: data.email,
        name: updatedUser.name,
        oldEmail: updatedUser.email,
        token: emailChangeChallenge.token
      });

      await recordAccountSecurityEvent(prisma, {
        userId: updatedUser.id,
        type: AccountSecurityEventType.EMAIL_CHANGE_REQUESTED,
        title: 'Email change requested',
        message:
          `A request was made to change your lux.om email from ${updatedUser.email} to ${data.email}. Confirm it only if this was you.`,
        metadata: {
          currentEmail: updatedUser.email,
          pendingEmail: data.email,
          emailSent: delivery.emailSent
        }
      });

      res.json({
        ok: true,
        emailChange: {
          pendingEmail: data.email,
          emailSent: delivery.emailSent,
          devEmailChangeVerificationUrl:
            delivery.devEmailChangeVerificationUrl ?? null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/confirm-email-change',
  authAbuseRateLimiters.emailChangeConfirm,
  async (req, res, next) => {
    try {
      const data = confirmEmailChangeSchema.parse(req.body);
      const tokenHash = hashEmailChangeToken(data.token);
      const now = new Date();

      const user = await prisma.user.findFirst({
        where: {
          emailChangeTokenHash: tokenHash,
          emailChangeExpiresAt: {
            gt: now
          },
          pendingEmail: {
            not: null
          }
        }
      });

      if (!user || !user.pendingEmail) {
        throw new AppError(400, 'Email change link is invalid or expired');
      }

      const pendingEmail = user.pendingEmail;

      const existingUser = await prisma.user.findFirst({
        where: {
          email: pendingEmail,
          NOT: {
            id: user.id
          }
        }
      });

      if (existingUser) {
        throw new AppError(409, 'Email is already in use');
      }

      const updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: {
            id: user.id,
            emailChangeTokenHash: tokenHash,
            emailChangeExpiresAt: {
              gt: now
            },
            pendingEmail
          },
          data: {
            email: pendingEmail,
            emailVerified: true,
            emailVerifiedAt: now,
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
            pendingEmail: null,
            emailChangeTokenHash: null,
            emailChangeExpiresAt: null,
            authTokenVersion: {
              increment: 1
            }
          }
        });

        if (updated.count !== 1) {
          throw new AppError(400, 'Email change link is invalid or expired');
        }

        return tx.user.findUniqueOrThrow({
          where: {
            id: user.id
          }
        });
      });

      await recordAccountSecurityEvent(prisma, {
        userId: updatedUser.id,
        type: AccountSecurityEventType.EMAIL_CHANGE_CONFIRMED,
        title: 'Email changed',
        message:
          `Your lux.om account email was changed from ${user.email} to ${updatedUser.email}.`,
        metadata: {
          oldEmail: user.email,
          newEmail: updatedUser.email
        }
      });

      res.json({
        ok: true,
        user: publicUser(updatedUser),
        token: signToken(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/logout-all-sessions',
  authAbuseRateLimiters.logoutAllSessions,
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: req.user.id
        },
        data: {
          authTokenVersion: {
            increment: 1
          }
        }
      });

      await recordAccountSecurityEvent(prisma, {
        userId: updatedUser.id,
        type: AccountSecurityEventType.LOGOUT_ALL_SESSIONS,
        title: 'Other sessions logged out',
        message:
          'Older lux.om sessions on other devices and browsers were logged out successfully.',
        metadata: {
          email: updatedUser.email
        }
      });

      res.json({
        ok: true,
        user: publicUser(updatedUser),
        token: signToken(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
);




authRouter.get(
  '/admin/system-health',
  requireAuth(),
  requireAdmin(),
  async (_req, res, next) => {
    try {
      const checkedAt = new Date();
      const databaseStartedAt = Date.now();

      let databaseStatus: AdminSystemHealthStatus = 'healthy';
      let databaseMessage = 'Database readiness query succeeded.';
      let databaseLatencyMs = 0;

      try {
        await prisma.$queryRaw`SELECT 1`;
        databaseLatencyMs = Date.now() - databaseStartedAt;
      } catch {
        databaseStatus = 'critical';
        databaseMessage = 'Database readiness query failed.';
        databaseLatencyMs = Date.now() - databaseStartedAt;
      }

      let retentionDays: number | null = null;
      let retentionStatus: AdminSystemHealthStatus = 'healthy';
      let retentionMessage = 'Email delivery retention is configured safely.';

      try {
        retentionDays = getEmailDeliveryRetentionDays();
      } catch (error) {
        retentionStatus = 'critical';
        retentionMessage =
          error instanceof Error
            ? error.message
            : 'Email delivery retention configuration is invalid.';
      }

      const frontendUrlConfigured = Boolean(env.FRONTEND_URL);
      const frontendUrlUsesHttps = usesHttpsUrl(env.FRONTEND_URL);
      const frontendUrlHasLocalhost = isLocalhostValue(env.FRONTEND_URL);
      const corsOrigins = env.CORS_ORIGIN;
      const corsUsesWildcard = corsOrigins.includes('*');
      const corsHasLocalhost = corsOrigins.some((origin) => isLocalhostValue(origin));

      const smtpConfigured = Boolean(
        env.SMTP_HOST &&
          env.SMTP_PORT &&
          env.SMTP_USER &&
          env.SMTP_PASS &&
          env.MAIL_FROM
      );

      const emailModeStatus: AdminSystemHealthStatus =
        env.NODE_ENV === 'production' && env.EMAIL_DELIVERY_MODE !== 'smtp'
          ? 'critical'
          : env.EMAIL_DELIVERY_MODE === 'dev'
            ? 'warning'
            : 'healthy';

      const smtpStatus: AdminSystemHealthStatus =
        env.NODE_ENV === 'production' && !smtpConfigured
          ? 'critical'
          : smtpConfigured
            ? 'healthy'
            : 'warning';

      const frontendStatus: AdminSystemHealthStatus =
        env.NODE_ENV === 'production' &&
        (!frontendUrlConfigured || !frontendUrlUsesHttps || frontendUrlHasLocalhost)
          ? 'critical'
          : frontendUrlConfigured
            ? 'healthy'
            : 'warning';

      const corsStatus: AdminSystemHealthStatus =
        corsUsesWildcard || (env.NODE_ENV === 'production' && corsHasLocalhost)
          ? 'critical'
          : corsHasLocalhost
            ? 'warning'
            : 'healthy';

      const rateLimitStatus: AdminSystemHealthStatus =
        env.NODE_ENV === 'production' && env.RATE_LIMIT_TRUST_PROXY_HOPS < 1
          ? 'critical'
          : env.RATE_LIMIT_TRUST_PROXY_HOPS < 1
            ? 'warning'
            : 'healthy';

      const checks = [
        buildHealthCheck(
          'database',
          'Database readiness',
          databaseStatus,
          databaseMessage
        ),
        buildHealthCheck(
          'emailDeliveryMode',
          'Email delivery mode',
          emailModeStatus,
          env.EMAIL_DELIVERY_MODE === 'smtp'
            ? 'SMTP email delivery mode is active.'
            : 'Development email delivery mode is active.'
        ),
        buildHealthCheck(
          'smtpConfiguration',
          'SMTP configuration',
          smtpStatus,
          smtpConfigured
            ? 'SMTP fields are present. Secrets are not exposed in this health response.'
            : 'SMTP fields are incomplete or not configured.'
        ),
        buildHealthCheck(
          'frontendUrl',
          'Frontend URL',
          frontendStatus,
          frontendUrlConfigured
            ? 'Frontend URL is configured.'
            : 'Frontend URL is not configured.'
        ),
        buildHealthCheck(
          'corsOrigins',
          'CORS origins',
          corsStatus,
          `${corsOrigins.length} CORS origin(s) configured.`
        ),
        buildHealthCheck(
          'rateLimitProxy',
          'Rate-limit proxy hops',
          rateLimitStatus,
          `RATE_LIMIT_TRUST_PROXY_HOPS is ${env.RATE_LIMIT_TRUST_PROXY_HOPS}.`
        ),
        buildHealthCheck(
          'emailRetention',
          'Email delivery retention',
          retentionStatus,
          retentionMessage
        )
      ];

      const overallStatus: AdminSystemHealthStatus = checks.some(
        (check) => check.status === 'critical'
      )
        ? 'critical'
        : checks.some((check) => check.status === 'warning')
          ? 'warning'
          : 'healthy';

      res.json({
        checkedAt: checkedAt.toISOString(),
        overallStatus,
        environment: {
          nodeEnv: env.NODE_ENV,
          isProduction: env.NODE_ENV === 'production'
        },
        database: {
          status: databaseStatus,
          latencyMs: databaseLatencyMs
        },
        email: {
          deliveryMode: env.EMAIL_DELIVERY_MODE,
          smtpConfigured,
          smtpHostConfigured: Boolean(env.SMTP_HOST),
          smtpPortConfigured: Boolean(env.SMTP_PORT),
          smtpUserConfigured: Boolean(env.SMTP_USER),
          smtpPasswordConfigured: Boolean(env.SMTP_PASS),
          mailFromConfigured: Boolean(env.MAIL_FROM)
        },
        urls: {
          frontendUrlConfigured,
          frontendUrlUsesHttps,
          frontendUrlHasLocalhost,
          corsOriginsCount: corsOrigins.length,
          corsUsesWildcard,
          corsHasLocalhost
        },
        rateLimiting: {
          trustProxyHops: env.RATE_LIMIT_TRUST_PROXY_HOPS
        },
        retention: {
          retentionDays,
          minimumDays: 30
        },
        checks
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  '/admin/email-deliveries/summary',
  requireAuth(),
  requireAdmin(),
  async (_req, res, next) => {
    try {
      const windowDays = 7;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const where: Prisma.EmailDeliveryEventWhereInput = {
        createdAt: {
          gte: since
        }
      };

      const [statusRows, total, recentFailures] = await prisma.$transaction([
        prisma.emailDeliveryEvent.groupBy({
          by: ['status'],
          where,
          _count: {
            _all: true
          }
        }),
        prisma.emailDeliveryEvent.count({
          where
        }),
        prisma.emailDeliveryEvent.findMany({
          where: {
            status: EmailDeliveryStatus.FAILED
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        })
      ]);

      const statusCounts = {
        [EmailDeliveryStatus.LOGGED]: 0,
        [EmailDeliveryStatus.SENT]: 0,
        [EmailDeliveryStatus.SKIPPED]: 0,
        [EmailDeliveryStatus.FAILED]: 0
      };

      for (const row of statusRows) {
        statusCounts[row.status] = row._count._all;
      }

      res.json({
        windowDays,
        since: since.toISOString(),
        total,
        statusCounts,
        recentFailures
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  '/admin/email-deliveries',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const query = adminEmailDeliveriesQuerySchema.parse(req.query);
      const skip = (query.page - 1) * query.pageSize;
      const where: Prisma.EmailDeliveryEventWhereInput = {};

      if (query.status !== 'all') {
        where.status = query.status;
      }

      if (query.type) {
        where.notificationType = query.type;
      }

      if (query.query) {
        where.OR = [
          {
            title: {
              contains: query.query,
              mode: 'insensitive'
            }
          },
          {
            recipientEmail: {
              contains: query.query,
              mode: 'insensitive'
            }
          },
          {
            reason: {
              contains: query.query,
              mode: 'insensitive'
            }
          },
          {
            errorMessage: {
              contains: query.query,
              mode: 'insensitive'
            }
          }
        ];
      }

      const [records, total] = await prisma.$transaction([
        prisma.emailDeliveryEvent.findMany({
          where,
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: query.pageSize
        }),
        prisma.emailDeliveryEvent.count({
          where
        })
      ]);

      res.json({
        records,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          pageCount: Math.ceil(total / query.pageSize)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  '/admin/users',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const query = adminUsersQuerySchema.parse(req.query);
      const where = getAdminUsersWhere(query);
      const skip = (query.page - 1) * query.pageSize;

      const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          orderBy: [
            {
              suspendedAt: 'desc'
            },
            {
              createdAt: 'desc'
            }
          ],
          skip,
          take: query.pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            companyName: true,
            googleId: true,
            passwordLoginEnabled: true,
            emailVerified: true,
            emailVerifiedAt: true,
            suspendedAt: true,
            deactivatedAt: true,
            deactivationReason: true,
            suspendedReason: true,
            suspendedById: true,
            authTokenVersion: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                listings: true,
                activities: true,
                bookings: true,
                notifications: true,
                accountSecurityEvents: true
              }
            }
          }
        }),
        prisma.user.count({
          where
        })
      ]);

      res.json({
        records: users.map((user) => ({
          ...adminUserResponse(user),
          counts: user._count
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          pageCount: Math.ceil(total / query.pageSize)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  '/admin/users/:id/security',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const userId = getRouteParam(req.params.id, 'user id');

      const user = await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          companyName: true,
          googleId: true,
          passwordLoginEnabled: true,
          emailVerified: true,
          emailVerifiedAt: true,
          suspendedAt: true,
          deactivatedAt: true,
          deactivationReason: true,
          suspendedReason: true,
          suspendedById: true,
          authTokenVersion: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              listings: true,
              activities: true,
              bookings: true,
              notifications: true,
              accountSecurityEvents: true
            }
          },
          accountSecurityEvents: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25,
            select: {
              id: true,
              type: true,
              title: true,
              message: true,
              metadata: true,
              actorId: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      res.json({
        user: {
          ...adminUserResponse(user),
          counts: user._count
        },
        securityEvents: user.accountSecurityEvents
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.patch(
  '/admin/users/:id/suspension',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const data = adminUserSuspensionSchema.parse(req.body);
      const userId = getRouteParam(req.params.id, 'user id');

      const targetUser = await prisma.user.findUnique({
        where: {
          id: userId
        }
      });

      if (!targetUser) {
        throw new AppError(404, 'User not found');
      }

      if (targetUser.id === req.user.id) {
        throw new AppError(400, 'Admins cannot suspend their own account');
      }

      if (data.suspended && targetUser.role === 'ADMIN') {
        const remainingActiveAdmins = await prisma.user.count({
          where: {
            role: 'ADMIN',
            suspendedAt: null,
            deactivatedAt: null,
            NOT: {
              id: targetUser.id
            }
          }
        });

        if (remainingActiveAdmins < 1) {
          throw new AppError(400, 'Cannot suspend the last active admin account');
        }
      }

      const now = new Date();
      const reason = data.suspended
        ? data.reason ?? 'Administrative account suspension'
        : data.reason ?? 'Administrative account suspension removed';

      const updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: {
            id: targetUser.id
          },
          data: {
            suspendedAt: data.suspended ? now : null,
            suspendedReason: data.suspended ? reason : null,
            suspendedById: data.suspended ? req.user!.id : null,
            authTokenVersion: {
              increment: 1
            }
          }
        });

        await recordAccountSecurityEvent(tx, {
          userId: updated.id,
          actorId: req.user!.id,
          type: data.suspended
            ? AccountSecurityEventType.ADMIN_USER_SUSPENDED
            : AccountSecurityEventType.ADMIN_USER_UNSUSPENDED,
          title: data.suspended
            ? 'Account suspended by admin'
            : 'Account unsuspended by admin',
          message: data.suspended
            ? `Your lux.om account was suspended by an admin. Reason: ${reason}`
            : 'Your lux.om account suspension was removed by an admin.',
          metadata: {
            adminId: req.user!.id,
            adminEmail: req.user!.email,
            targetEmail: updated.email,
            reason
          }
        });

        return updated;
      });

      res.json({
        user: adminUserResponse(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.patch(
  '/admin/users/:id/email-verification',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const data = adminEmailVerificationSchema.parse(req.body);
      const targetUser = await prisma.user.findUnique({
        where: {
          id: getRouteParam(req.params.id, 'user id')
        }
      });

      if (!targetUser) {
        throw new AppError(404, 'User not found');
      }

      const now = new Date();

      const updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: {
            id: targetUser.id
          },
          data: {
            emailVerified: data.emailVerified,
            emailVerifiedAt: data.emailVerified ? now : null,
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
            authTokenVersion: {
              increment: 1
            }
          }
        });

        await recordAccountSecurityEvent(tx, {
          userId: updated.id,
          actorId: req.user!.id,
          type: data.emailVerified
            ? AccountSecurityEventType.ADMIN_EMAIL_VERIFIED
            : AccountSecurityEventType.ADMIN_EMAIL_UNVERIFIED,
          title: data.emailVerified
            ? 'Email verified by admin'
            : 'Email verification removed by admin',
          message: data.emailVerified
            ? `An admin marked ${updated.email} as verified. Reason: ${data.reason}`
            : `An admin removed email verification for ${updated.email}. Reason: ${data.reason}`,
          metadata: {
            adminId: req.user!.id,
            adminEmail: req.user!.email,
            targetEmail: updated.email,
            reason: data.reason
          }
        });

        return updated;
      });

      res.json({
        user: adminUserResponse(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({
    user: req.user ? publicUser(req.user) : null
  });
});

authRouter.patch('/me', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
        ...(data.companyName !== undefined
          ? { companyName: data.companyName.trim() || null }
          : {}),
        ...(data.emailBookingUpdates !== undefined
          ? { emailBookingUpdates: data.emailBookingUpdates }
          : {}),
        ...(data.emailSavedSearchUpdates !== undefined
          ? { emailSavedSearchUpdates: data.emailSavedSearchUpdates }
          : {}),
        ...(data.emailMarketingUpdates !== undefined
          ? { emailMarketingUpdates: data.emailMarketingUpdates }
          : {})
      }
    });

    res.json({
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/me/deactivate',
  authAbuseRateLimiters.accountDeactivation,
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const data = deactivateAccountSchema.parse(req.body);

      if (data.confirmation !== 'DELETE') {
        throw new AppError(400, 'Type DELETE to confirm account deletion');
      }

      const user = await prisma.user.findUniqueOrThrow({
        where: {
          id: req.user.id
        }
      });

      if (user.role === 'ADMIN') {
        throw new AppError(
          400,
          'Admin accounts cannot be deleted from the profile page. Transfer or suspend admin access from the admin console instead.'
        );
      }

      if (user.deactivatedAt) {
        throw new AppError(400, 'This account has already been deleted');
      }

      if (user.passwordLoginEnabled) {
        if (!data.currentPassword) {
          throw new AppError(400, 'Current password is required');
        }

        const currentPasswordMatches = await bcrypt.compare(data.currentPassword, user.password);

        if (!currentPasswordMatches) {
          throw new AppError(401, 'Current password is incorrect');
        }
      }

      const blockers = await getAccountDeletionBlockers(prisma, user.id);

      if (blockers.length > 0) {
        throw new AppError(
          409,
          `Account cannot be deleted yet because it has ${blockers
            .map((blocker) => `${blocker.count} ${blocker.label}`)
            .join(', ')}. Please close or resolve them first.`
        );
      }

      const now = new Date();
      const anonymizedEmail = buildDeletedAccountEmail(user.id);
      const disabledPasswordHash = await bcrypt.hash(
        `${user.id}:${now.toISOString()}:deactivated`,
        12
      );

      const deactivatedUser = await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.savedListing.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.savedActivity.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.savedSearch.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.investorWatchlistItem.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.notification.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.oauthLoginCode.deleteMany({
            where: {
              userId: user.id
            }
          }),
          tx.inquiry.updateMany({
            where: {
              userId: user.id
            },
            data: {
              userId: null
            }
          })
        ]);

        await tx.accountSecurityEvent.create({
          data: {
            userId: user.id,
            actorId: user.id,
            type: AccountSecurityEventType.ACCOUNT_DEACTIVATED,
            title: 'Account deleted by user',
            message:
              'This lux.om account was deleted through the profile self-service flow.',
            metadata: {
              originalEmail: user.email,
              requestedAt: now.toISOString(),
              blockersChecked: true
            }
          }
        });

        return tx.user.update({
          where: {
            id: user.id
          },
          data: {
            name: 'Deleted lux.om user',
            email: anonymizedEmail,
            password: disabledPasswordHash,
            passwordLoginEnabled: false,
            authTokenVersion: {
              increment: 1
            },
            googleId: null,
            phone: null,
            companyName: null,
            emailVerified: false,
            emailVerifiedAt: null,
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
            pendingEmail: null,
            emailChangeTokenHash: null,
            emailChangeExpiresAt: null,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            passwordResetUsedAt: null,
            emailBookingUpdates: false,
            emailSavedSearchUpdates: false,
            emailMarketingUpdates: false,
            deactivatedAt: now,
            deactivationReason: 'Self-service account deletion requested'
          }
        });
      });

      res.json({
        ok: true,
        account: {
          status: 'DEACTIVATED',
          deactivatedAt: deactivatedUser.deactivatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post('/resend-verification', authAbuseRateLimiters.verificationResend, requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    if (req.user.emailVerified) {
      res.json({
        ok: true,
        verification: {
          required: false,
          emailSent: false,
          devVerificationUrl: null
        }
      });
      return;
    }

    const verificationChallenge = createEmailVerificationChallenge();

    const user = await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        emailVerificationTokenHash: verificationChallenge.tokenHash,
        emailVerificationExpiresAt: verificationChallenge.expiresAt
      }
    });

    const verificationDelivery = await deliverEmailVerificationLink({
      email: user.email,
      name: user.name,
      token: verificationChallenge.token
    });

    res.json({
      ok: true,
      verification: {
        required: true,
        emailSent: verificationDelivery.emailSent,
        devVerificationUrl: verificationDelivery.devVerificationUrl ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-email', authAbuseRateLimiters.verifyEmail, async (req, res, next) => {
  try {
    const data = verifyEmailSchema.parse(req.body);
    const tokenHash = hashEmailVerificationToken(data.token);

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AppError(400, 'Verification link is invalid or expired');
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null
      }
    });

    res.json({
      user: publicUser(updatedUser)
    });
  } catch (error) {
    next(error);
  }
});
