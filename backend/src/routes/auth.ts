import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { requireAuth, signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, publicUser } from '../utils/http';
import { authAbuseRateLimiters } from '../middleware/rateLimit';
import { validatePasswordPolicy } from '../utils/passwordPolicy';
import {
  createEmailVerificationChallenge,
  createPasswordResetChallenge,
  deliverEmailVerificationLink,
  deliverPasswordResetLink,
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
    role: z.enum(['USER', 'OWNER']).default('USER'),
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

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(6).max(30).or(z.literal('')).optional(),
    companyName: z.string().trim().min(2).max(120).or(z.literal('')).optional()
  })
  .strict();

const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(32).max(256)
  })
  .strict();

const googleStartSchema = z
  .object({
    role: z.enum(['USER', 'OWNER']).optional(),
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
  const frontendUrl = new URL(pathname, process.env.FRONTEND_URL || 'http://localhost:5173');

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
