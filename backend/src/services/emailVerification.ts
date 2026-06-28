import { createHash, randomBytes } from 'crypto';

import { env, isProduction } from '../config/env';

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

export type EmailVerificationChallenge = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export type EmailVerificationDelivery = {
  emailSent: boolean;
  devVerificationUrl?: string;
};

export function createEmailVerificationChallenge(): EmailVerificationChallenge {
  const token = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('hex');
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  return {
    token,
    tokenHash,
    expiresAt
  };
}

export function hashEmailVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getFrontendBaseUrl() {
  const configuredUrl = process.env.FRONTEND_URL || env.CORS_ORIGIN[0] || 'http://localhost:5173';

  return configuredUrl.replace(/\/$/, '');
}

export function getEmailVerificationUrl(token: string) {
  return `${getFrontendBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function deliverEmailVerificationLink(input: {
  email: string;
  name: string;
  token: string;
}): Promise<EmailVerificationDelivery> {
  const verificationUrl = getEmailVerificationUrl(input.token);

  /*
   * Email provider integration belongs in Stage 9/launch hardening.
   * Until a provider is configured, in-app verification remains safely
   * represented as "not sent externally".
   */
  if (!isProduction) {
    console.info(
      `[lux.om] Development email verification link for ${input.email}: ${verificationUrl}`
    );

    return {
      emailSent: false,
      devVerificationUrl: verificationUrl
    };
  }

  return {
    emailSent: false
  };
}
