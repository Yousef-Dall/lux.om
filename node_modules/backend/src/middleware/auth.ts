import type { NextFunction, Request, Response } from 'express';
import type { Role, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/http';

type TokenPayload = {
  userId: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'lux.om'
  });
}

export function requireAuth(required = true) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        if (!required) return next();
        throw new AppError(401, 'Unauthorized');
      }

      const payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'lux.om' }) as TokenPayload;
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });

      if (!user) throw new AppError(401, 'Unauthorized');

      req.user = user;
      return next();
    } catch (error) {
      return next(error instanceof AppError ? error : new AppError(401, 'Unauthorized'));
    }
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