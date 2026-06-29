import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

type AuthRateLimitRule = {
  windowMs: number;
  productionLimit: number;
  developmentLimit: number;
  message: string;
};

export const authAbuseRateLimitRules = {
  login: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 8,
    developmentLimit: 80,
    message: 'Too many login attempts. Please wait before trying again.'
  },
  register: {
    windowMs: 60 * 60 * 1000,
    productionLimit: 5,
    developmentLimit: 50,
    message: 'Too many account creation attempts. Please wait before trying again.'
  },
  passwordResetRequest: {
    windowMs: 60 * 60 * 1000,
    productionLimit: 5,
    developmentLimit: 50,
    message: 'Too many password reset requests. Please wait before trying again.'
  },
  passwordReset: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 10,
    developmentLimit: 80,
    message: 'Too many password reset attempts. Please wait before trying again.'
  },
  changePassword: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 8,
    developmentLimit: 80,
    message: 'Too many password change attempts. Please wait before trying again.'
  },
  logoutAllSessions: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 6,
    developmentLimit: 60,
    message: 'Too many session logout requests. Please wait before trying again.'
  },
  verificationResend: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 3,
    developmentLimit: 30,
    message: 'Too many verification email requests. Please wait before trying again.'
  },
  verifyEmail: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 20,
    developmentLimit: 100,
    message: 'Too many email verification attempts. Please wait before trying again.'
  },
  googleStart: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 10,
    developmentLimit: 80,
    message: 'Too many Google login attempts. Please wait before trying again.'
  },
  googleCallback: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 20,
    developmentLimit: 100,
    message: 'Too many Google login callback attempts. Please wait before trying again.'
  },
  googleExchange: {
    windowMs: 15 * 60 * 1000,
    productionLimit: 12,
    developmentLimit: 80,
    message: 'Too many Google login exchange attempts. Please wait before trying again.'
  }
} satisfies Record<string, AuthRateLimitRule>;

function getLimit(rule: AuthRateLimitRule) {
  return process.env.NODE_ENV === 'development'
    ? rule.developmentLimit
    : rule.productionLimit;
}

function createAuthAbuseRateLimiter(rule: AuthRateLimitRule) {
  return rateLimit({
    windowMs: rule.windowMs,
    limit: getLimit(rule),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        message: rule.message
      });
    }
  });
}

export const authAbuseRateLimiters = {
  login: createAuthAbuseRateLimiter(authAbuseRateLimitRules.login),
  register: createAuthAbuseRateLimiter(authAbuseRateLimitRules.register),
  passwordResetRequest: createAuthAbuseRateLimiter(
    authAbuseRateLimitRules.passwordResetRequest
  ),
  passwordReset: createAuthAbuseRateLimiter(authAbuseRateLimitRules.passwordReset),
  changePassword: createAuthAbuseRateLimiter(authAbuseRateLimitRules.changePassword),
  logoutAllSessions: createAuthAbuseRateLimiter(
    authAbuseRateLimitRules.logoutAllSessions
  ),
  verificationResend: createAuthAbuseRateLimiter(
    authAbuseRateLimitRules.verificationResend
  ),
  verifyEmail: createAuthAbuseRateLimiter(authAbuseRateLimitRules.verifyEmail),
  googleStart: createAuthAbuseRateLimiter(authAbuseRateLimitRules.googleStart),
  googleCallback: createAuthAbuseRateLimiter(authAbuseRateLimitRules.googleCallback),
  googleExchange: createAuthAbuseRateLimiter(authAbuseRateLimitRules.googleExchange)
};
