import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginRequestSchema } from '../validation';

test('loginRequestSchema accepts a valid payload and normalizes email casing', () => {
  const result = loginRequestSchema.safeParse({
    email: '  JANE@Example.com  ',
    password: 'whatever-the-user-set',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      email: 'jane@example.com',
      password: 'whatever-the-user-set',
    });
  }
});

test('loginRequestSchema does not enforce a minimum password length beyond 1 character', () => {
  // Login must not re-validate password *strength* — an existing account may
  // have been created under older/looser rules — it only needs to bound
  // length to prevent oversized-payload hashing abuse.
  const result = loginRequestSchema.safeParse({
    email: 'jane@example.com',
    password: 'x',
  });

  assert.equal(result.success, true);
});

test('loginRequestSchema rejects an empty password', () => {
  const result = loginRequestSchema.safeParse({
    email: 'jane@example.com',
    password: '',
  });

  assert.equal(result.success, false);
});

test('loginRequestSchema rejects a password longer than 72 characters', () => {
  const result = loginRequestSchema.safeParse({
    email: 'jane@example.com',
    password: 'a'.repeat(73),
  });

  assert.equal(result.success, false);
});

test('loginRequestSchema rejects a malformed email', () => {
  const result = loginRequestSchema.safeParse({
    email: 'not-an-email',
    password: 'whatever-the-user-set',
  });

  assert.equal(result.success, false);
});

test('loginRequestSchema rejects unknown/extra fields', () => {
  const result = loginRequestSchema.safeParse({
    email: 'jane@example.com',
    password: 'whatever-the-user-set',
    rememberMe: true,
  });

  assert.equal(result.success, false);
});

test('loginRequestSchema rejects a missing email', () => {
  const result = loginRequestSchema.safeParse({
    password: 'whatever-the-user-set',
  });

  assert.equal(result.success, false);
});
