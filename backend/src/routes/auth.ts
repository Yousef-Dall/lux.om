import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { requireAuth, signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError, publicUser } from '../utils/http';

export const authRouter = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(8).max(100),
    role: z.enum(['USER', 'OWNER']).default('USER'),
    phone: z.string().trim().min(6).max(30).optional()
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(1)
  })
  .strict();

authRouter.post('/register', async (req, res, next) => {
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

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role,
        phone: data.phone?.trim() || null
      }
    });

    res.status(201).json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
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

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({
    user: req.user ? publicUser(req.user) : null
  });
});