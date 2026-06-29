import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/http';

type GoogleOAuthState = {
  purpose: 'google_oauth';
  role: 'USER' | 'OWNER';
  returnTo: string;
  nonce: string;
};

type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
const USED_LOGIN_CODE_RETENTION_MS = 60 * 60 * 1000;

function assertGoogleOAuthEnabled() {
  if (
    !env.GOOGLE_OAUTH_ENABLED ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REDIRECT_URL
  ) {
    throw new AppError(503, 'Google login is not configured yet');
  }
}

function getGoogleClient() {
  assertGoogleOAuthEnabled();

  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URL
  );
}

function hashOauthLoginCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function createRawOauthLoginCode() {
  return crypto.randomBytes(32).toString('base64url');
}

async function cleanupOauthLoginCodes() {
  const now = new Date();
  const oldUsedCodeCutoff = new Date(Date.now() - USED_LOGIN_CODE_RETENTION_MS);

  await prisma.oauthLoginCode
    .deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now
            }
          },
          {
            usedAt: {
              not: null
            },
            createdAt: {
              lt: oldUsedCodeCutoff
            }
          }
        ]
      }
    })
    .catch((error) => {
      console.error('[lux.om] Failed to clean OAuth login codes', error);
    });
}

function sanitizeReturnTo(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/dashboard';
  }

  if (returnTo.startsWith('/login') || returnTo.startsWith('/register')) {
    return '/dashboard';
  }

  return returnTo;
}

export function createGoogleOAuthState(input: { role?: string; returnTo?: string }) {
  const role = input.role === 'OWNER' ? 'OWNER' : 'USER';

  return jwt.sign(
    {
      purpose: 'google_oauth',
      role,
      returnTo: sanitizeReturnTo(input.returnTo),
      nonce: crypto.randomBytes(16).toString('hex')
    } satisfies GoogleOAuthState,
    env.JWT_SECRET,
    {
      expiresIn: '10m',
      issuer: 'lux.om'
    }
  );
}

export function verifyGoogleOAuthState(state: string): GoogleOAuthState {
  const payload = jwt.verify(state, env.JWT_SECRET, {
    issuer: 'lux.om'
  });

  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'Invalid Google login state');
  }

  const candidate = payload as Partial<GoogleOAuthState>;

  if (
    candidate.purpose !== 'google_oauth' ||
    (candidate.role !== 'USER' && candidate.role !== 'OWNER') ||
    typeof candidate.returnTo !== 'string' ||
    typeof candidate.nonce !== 'string'
  ) {
    throw new AppError(400, 'Invalid Google login state');
  }

  return {
    purpose: 'google_oauth',
    role: candidate.role,
    returnTo: sanitizeReturnTo(candidate.returnTo),
    nonce: candidate.nonce
  };
}

export function buildGoogleAuthorizationUrl(input: { role?: string; returnTo?: string }) {
  const client = getGoogleClient();
  const state = createGoogleOAuthState(input);

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: GOOGLE_OAUTH_SCOPES,
    state
  });
}

async function getGoogleProfileFromCode(code: string): Promise<GoogleProfile> {
  const client = getGoogleClient();
  const tokenResponse = await client.getToken(code);

  if (!tokenResponse.tokens.id_token) {
    throw new AppError(400, 'Google did not return an identity token');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokenResponse.tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new AppError(400, 'Google account profile is incomplete');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0] || 'lux.om user',
    emailVerified: Boolean(payload.email_verified)
  };
}

export async function signInWithGoogleCode(input: { code: string; state: string }) {
  const state = verifyGoogleOAuthState(input.state);
  const profile = await getGoogleProfileFromCode(input.code);

  if (!profile.emailVerified) {
    throw new AppError(400, 'Google email is not verified');
  }

  const existingByGoogleId = await prisma.user.findUnique({
    where: {
      googleId: profile.googleId
    }
  });

  if (existingByGoogleId) {
    return {
      user: existingByGoogleId,
      returnTo: state.returnTo
    };
  }

  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: profile.email
    }
  });

  if (existingByEmail) {
    const linkedUser = await prisma.user.update({
      where: {
        id: existingByEmail.id
      },
      data: {
        googleId: profile.googleId,
        emailVerified: true,
        emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null
      }
    });

    return {
      user: linkedUser,
      returnTo: state.returnTo
    };
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 12);

  const createdUser = await prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      password: passwordHash,
      role: state.role as Role,
      googleId: profile.googleId,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null
    }
  });

  return {
    user: createdUser,
    returnTo: state.returnTo
  };
}

export async function createOauthLoginCode(input: { userId: string; returnTo: string }) {
  await cleanupOauthLoginCodes();

  const code = createRawOauthLoginCode();
  const expiresAt = new Date(Date.now() + GOOGLE_LOGIN_CODE_TTL_MS);

  await prisma.oauthLoginCode.create({
    data: {
      codeHash: hashOauthLoginCode(code),
      userId: input.userId,
      returnTo: sanitizeReturnTo(input.returnTo),
      expiresAt
    }
  });

  return {
    code,
    expiresAt
  };
}

export async function consumeOauthLoginCode(code: string) {
  const codeHash = hashOauthLoginCode(code);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const loginCode = await tx.oauthLoginCode.findUnique({
      where: {
        codeHash
      },
      include: {
        user: true
      }
    });

    if (!loginCode || loginCode.usedAt || loginCode.expiresAt <= now) {
      throw new AppError(400, 'Google login link is invalid or expired');
    }

    const consumed = await tx.oauthLoginCode.updateMany({
      where: {
        id: loginCode.id,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        usedAt: now
      }
    });

    if (consumed.count !== 1) {
      throw new AppError(400, 'Google login link is invalid or expired');
    }

    return {
      user: loginCode.user,
      returnTo: sanitizeReturnTo(loginCode.returnTo)
    };
  });
}

