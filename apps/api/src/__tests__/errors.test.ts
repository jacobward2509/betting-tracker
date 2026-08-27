import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response } from 'express';
import { sendError, zodFieldErrors } from '../errors';
import { signupRequestSchema } from '../validation';

function createMockResponse() {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.body = body;
      return res;
    },
  } as unknown as Response;

  return { res, calls };
}

test('sendError sets the given status code and error shape without fields', () => {
  const { res, calls } = createMockResponse();

  sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');

  assert.equal(calls.status, 401);
  assert.deepEqual(calls.body, {
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    },
  });
});

test('sendError includes a fields array when provided', () => {
  const { res, calls } = createMockResponse();

  sendError(res, 400, 'VALIDATION_ERROR', 'Please correct the highlighted fields and try again.', [
    { field: 'email', message: 'Please provide a valid email address.' },
  ]);

  assert.deepEqual(calls.body, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Please correct the highlighted fields and try again.',
      fields: [{ field: 'email', message: 'Please provide a valid email address.' }],
    },
  });
});

test('sendError omits an empty fields array rather than sending fields: []', () => {
  const { res, calls } = createMockResponse();

  sendError(res, 400, 'VALIDATION_ERROR', 'Something went wrong.', []);

  assert.deepEqual(calls.body, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Something went wrong.',
    },
  });
});

test('zodFieldErrors maps every failing field with a dotted path and message', () => {
  const result = signupRequestSchema.safeParse({
    name: 'J',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  const fields = zodFieldErrors(result.error);
  const fieldNames = fields.map((detail) => detail.field).sort();

  assert.deepEqual(fieldNames, ['email', 'name', 'password']);
  fields.forEach((detail) => {
    assert.equal(typeof detail.message, 'string');
    assert.ok(detail.message.length > 0);
  });
});
