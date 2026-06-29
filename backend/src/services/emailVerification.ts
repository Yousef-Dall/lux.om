import { createHash, randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';

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
  const configuredUrl = env.FRONTEND_URL || env.CORS_ORIGIN[0] || 'http://localhost:5173';

  return configuredUrl.replace(/\/$/, '');
}

export function getEmailVerificationUrl(token: string) {
  return `${getFrontendBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function shouldUseSmtpDelivery() {
  return (
    isProduction ||
    (env.NODE_ENV === 'development' && env.EMAIL_DELIVERY_MODE === 'smtp')
  );
}

function getSmtpConfig() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) {
    throw new Error('SMTP email configuration is missing.');
  }

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    from: env.MAIL_FROM
  };
}

function buildVerificationEmail(input: {
  name: string;
  verificationUrl: string;
}) {
  const safeName = input.name.trim() || 'there';

  return {
    subject: 'Verify your lux.om email',
    text: [
      `Hi ${safeName},`,
      '',
      'Please verify your lux.om email address by opening this link:',
      input.verificationUrl,
      '',
      'This link expires in 24 hours.',
      '',
      'If you did not create a lux.om account, you can ignore this email.',
      '',
      'lux.om'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#07383e;max-width:620px">
        <p>Hi ${safeName},</p>
        <p>Please verify your lux.om email address by clicking the button below.</p>
        <p>
          <a
            href="${input.verificationUrl}"
            style="display:inline-block;background:#07383e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700"
          >
            Verify email
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;color:#38585d">${input.verificationUrl}</p>
        <p>This link expires in 24 hours.</p>
        <p>If you did not create a lux.om account, you can ignore this email.</p>
        <p>lux.om</p>
      </div>
    `
  };
}

export async function deliverEmailVerificationLink(input: {
  email: string;
  name: string;
  token: string;
}): Promise<EmailVerificationDelivery> {
  const verificationUrl = getEmailVerificationUrl(input.token);

  if (!shouldUseSmtpDelivery()) {
    console.info(
      `[lux.om] Development email verification link for ${input.email}: ${verificationUrl}`
    );

    return {
      emailSent: false,
      devVerificationUrl: verificationUrl
    };
  }

  const smtpConfig = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth
  });

  const email = buildVerificationEmail({
    name: input.name,
    verificationUrl
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to: input.email,
    subject: email.subject,
    text: email.text,
    html: email.html
  });

  return {
    emailSent: true
  };
}
