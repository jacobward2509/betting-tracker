import type { Response } from 'express';
import type { ZodError } from 'zod';

export type ErrorFieldDetail = {
  field: string;
  message: string;
};

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'ACCOUNT_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * Sends a response body shaped as `{ error: { code, message, fields? } }`,
 * matching the ErrorResponse schema documented in apps/api/openapi/openapi.yaml.
 */
export const sendError = (
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  fields?: ErrorFieldDetail[],
) => {
  res.status(status).json({
    error: {
      code,
      message,
      ...(fields && fields.length > 0 ? { fields } : {}),
    },
  });
};

/**
 * Converts a Zod validation error into the field-level ErrorFieldDetail[]
 * shape used by sendError, joining nested path segments with '.'.
 */
export const zodFieldErrors = (error: ZodError): ErrorFieldDetail[] =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
