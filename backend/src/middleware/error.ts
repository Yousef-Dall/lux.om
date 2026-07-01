import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { isProduction } from '../config/env';
import { AppError } from '../utils/http';
import { logError } from '../utils/logging';

type RequestBodyError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

function getRequestBodyErrorStatus(error: RequestBodyError) {
  return error.statusCode ?? error.status;
}

function isRequestBodyError(error: unknown): error is RequestBodyError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as RequestBodyError;
  const statusCode = getRequestBodyErrorStatus(candidate);

  return (
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500 &&
    typeof candidate.type === 'string'
  );
}

function getSafeRequestBodyError(error: RequestBodyError) {
  switch (error.type) {
    case 'entity.parse.failed':
      return {
        statusCode: 400,
        message: 'Malformed JSON request body'
      };
    case 'entity.too.large':
      return {
        statusCode: 413,
        message: 'Request body is too large'
      };
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return {
        statusCode: 415,
        message: 'Unsupported request body encoding'
      };
    default:
      return {
        statusCode: getRequestBodyErrorStatus(error) ?? 400,
        message: 'Invalid request body'
      };
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (!res.getHeader('X-Request-Id') && req.requestId) {
    res.setHeader('X-Request-Id', req.requestId);
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message
    });
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

  if (isRequestBodyError(error)) {
    const safeError = getSafeRequestBodyError(error);

    res.status(safeError.statusCode).json({
      message: safeError.message
    });
    return;
  }

  logError('Unhandled API error', error, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: 500
  });

  res.status(500).json({
    message: 'Server error',
    ...(isProduction
      ? {}
      : {
          detail: error instanceof Error ? error.message : String(error)
        })
  });
};