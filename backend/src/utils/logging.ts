import { randomUUID } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { isProduction } from '../config/env';

const REDACTED = '[redacted]';
const MAX_LOG_STRING_LENGTH = 500;
const MAX_LOG_DEPTH = 6;
const MAX_LOG_ARRAY_ITEMS = 25;
const REQUEST_ID_HEADER = 'X-Request-Id';

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|token|secret|authorization|cookie|set-cookie|api[-_]?key|smtp|jwt|session|credential|reset|verification|emailchangetokenhash|emailverificationtokenhash/i;
const SENSITIVE_QUERY_PARAM_PATTERN =
  /token|code|state|password|secret|api[-_]?key|session|jwt/i;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

type LogContext = Record<string, unknown>;

function truncateLogString(value: string) {
  return value.length > MAX_LOG_STRING_LENGTH
    ? `${value.slice(0, MAX_LOG_STRING_LENGTH)}…`
    : value;
}

function redactSensitiveString(value: string) {
  return redactUrl(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED}`)
    .replace(/((?:password|token|secret|api[-_]?key|jwt|session)\s*[=:]\s*)[^,;\s]+/gi, `$1${REDACTED}`);
}

function shouldRedactKey(key: string) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function sanitizeRequestId(value?: string | string[]) {
  const requestId = Array.isArray(value) ? value[0] : value;

  if (requestId && SAFE_REQUEST_ID_PATTERN.test(requestId)) {
    return requestId;
  }

  return randomUUID();
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Unable to serialize log context' });
  }
}

export function redactUrl(value: string) {
  try {
    const url = new URL(value);

    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }

    return url.toString();
  } catch {
    return value.replace(/([?&][^=]*(?:token|code|state|password|secret|api[-_]?key|jwt|session)[^=]*=)[^&\s]+/gi, `$1${REDACTED}`);
  }
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > MAX_LOG_DEPTH) {
    return '[max-depth]';
  }

  if (value instanceof Error) {
    return redactErrorForLogging(value);
  }

  if (typeof value === 'string') {
    return truncateLogString(redactSensitiveString(value));
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_LOG_ARRAY_ITEMS)
      .map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      output[key] = shouldRedactKey(key)
        ? REDACTED
        : redactSensitiveData(nestedValue, depth + 1);
    }

    return output;
  }

  return String(value);
}

export function redactErrorForLogging(error: unknown) {
  if (!(error instanceof Error)) {
    return redactSensitiveData(error);
  }

  return {
    name: error.name,
    message: redactSensitiveData(error.message),
    ...(isProduction
      ? {}
      : {
          stack: redactSensitiveData(error.stack)
        })
  };
}

function writeLog(level: 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? (redactSensitiveData(context) as LogContext) : {})
  };
  const serialized = safeJsonStringify(payload);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export function logInfo(message: string, context?: LogContext) {
  writeLog('info', message, context);
}

export function logWarn(message: string, context?: LogContext) {
  writeLog('warn', message, context);
}

export function logError(message: string, error?: unknown, context?: LogContext) {
  writeLog('error', message, {
    ...(context ?? {}),
    ...(error === undefined
      ? {}
      : {
          error: redactErrorForLogging(error)
        })
  });
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const requestId = sanitizeRequestId(req.headers['x-request-id']);

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

export function requestLogger(options?: { enabled?: boolean }): RequestHandler {
  const enabled = options?.enabled ?? isProduction;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return next();
    }

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logInfo('api_request_completed', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        ip: req.ip,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']
      });
    });

    return next();
  };
}
