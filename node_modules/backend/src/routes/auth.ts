import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { AppError, publicUser } from '../utils/http';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(100),
  role: z.enum(['USER', 'OWNER']).default('USER'),
  phone: z.string().trim().min(6).max(30).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

    if (existingUser) throw new AppError(409, 'An account with this email already exists');

    const user = await prisma.user.create({
      data: {
        ...data,
        password: await bcrypt.hash(data.password, 12)
      }
    });

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new AppError(401, 'Invalid credentials');
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});