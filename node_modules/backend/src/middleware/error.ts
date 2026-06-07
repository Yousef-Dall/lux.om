import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/http';
import { isProduction } from '../config/env';

export const notFoundHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    message: 'Server error',
    ...(isProduction ? {} : { detail: error instanceof Error ? error.message : String(error) })
  });
};