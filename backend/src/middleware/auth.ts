import type { NextFunction, Request, Response } from 'express';
import type { Role, User } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/http';

type TokenPayload = {
  userId: string;
  role: Role;
  authTokenVersion: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function isTokenPayload(payload: unknown): payload is TokenPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<TokenPayload>;

  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.authTokenVersion === 'number' &&
    Number.isInteger(candidate.authTokenVersion)
  );
}

export function signToken(user: { id: string; role: Role; authTokenVersion?: number }) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      authTokenVersion: user.authTokenVersion ?? 0
    },
    env.JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'lux.om'
    }
  );
}

export function requireAuth(required = true) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        if (!required) {
          return next();
        }

        throw new AppError(401, 'Unauthorized');
      }

      const payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'lux.om'
      });

      if (!isTokenPayload(payload)) {
        throw new AppError(401, 'Invalid token');
      }

      const user = await prisma.user.findUnique({
        where: {
          id: payload.userId
        }
      });

      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      if (payload.role !== user.role) {
        throw new AppError(401, 'Unauthorized');
      }

      if (payload.authTokenVersion !== user.authTokenVersion) {
        throw new AppError(401, 'Unauthorized');
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      return next(new AppError(401, 'Unauthorized'));
    }
  };
}

export function requireVerifiedEmail(options: { allowAdmin?: boolean } = {}) {
  const allowAdmin = options.allowAdmin ?? true;

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, 'Unauthorized'));
      return;
    }

    if (allowAdmin && req.user.role === 'ADMIN') {
      next();
      return;
    }

    if (!req.user.emailVerified) {
      next(
        new AppError(
          403,
          'Please verify your email before submitting listings or activities for review.'
        )
      );
      return;
    }

    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'Forbidden'));
      return;
    }

    next();
  };
}
