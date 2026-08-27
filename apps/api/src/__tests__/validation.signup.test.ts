import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginRequestSchema, signupRequestSchema } from '../validation';

test('signupRequestSchema accepts a valid payload and normalizes name/email', () => {
  const result = signupRequestSchema.safeParse({
    name: '  Jane   Doe  ',
    email: '  JANE.DOE@Example.com  ',
    password: 'correct-horse-battery',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'correct-horse-battery',
    });
  }
});

test('signupRequestSchema rejects a name shorter than 2 characters', () => {
  const result = signupRequestSchema.safeParse({
    name: 'J',
    email: 'jane@example.com',
    password: 'correct-horse-battery',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const nameIssue = result.error.issues.find((issue) => issue.path[0] === 'name');
    assert.ok(nameIssue, 'expected a validation issue for name');
    assert.equal(nameIssue?.message, 'Name must be at least 2 characters long.');
  }
});

test('signupRequestSchema rejects a name longer than 60 characters', () => {
  const result = signupRequestSchema.safeParse({
    name: 'a'.repeat(61),
    email: 'jane@example.com',
    password: 'correct-horse-battery',
  });

  assert.equal(result.success, false);
});

test('signupRequestSchema rejects a malformed email', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'not-an-email',
    password: 'correct-horse-battery',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email');
    assert.equal(emailIssue?.message, 'Please provide a valid email address.');
  }
});

test('signupRequestSchema rejects an email longer than 254 characters', () => {
  const longLocalPart = 'a'.repeat(250);
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: `${longLocalPart}@example.com`,
    password: 'correct-horse-battery',
  });

  assert.equal(result.success, false);
});

test('signupRequestSchema rejects a password shorter than 10 characters', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'short1',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password');
    assert.equal(passwordIssue?.message, 'Password must be at least 10 characters long.');
  }
});

test('signupRequestSchema rejects a password longer than 72 characters', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'a'.repeat(73),
  });

  assert.equal(result.success, false);
});

test('signupRequestSchema accepts a password at exactly the 72 character boundary', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'a'.repeat(72),
  });

  assert.equal(result.success, true);
});

test('signupRequestSchema rejects unknown/extra fields (e.g. legacy preferences)', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'correct-horse-battery',
    preferences: { defaultStake: 5 },
  });

  assert.equal(result.success, false);
});

test('signupRequestSchema rejects a missing password', () => {
  const result = signupRequestSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
  });

  assert.equal(result.success, false);
});
