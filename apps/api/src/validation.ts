import { z } from 'zod';

// These schemas intentionally mirror the constraints documented in
// apps/api/openapi/openapi.yaml (SignupRequest / LoginRequest) so the runtime
// validation and the published API contract can't silently drift apart.

const name = z
  .string({ message: 'Name is required.' })
  .trim()
  .min(2, 'Name must be at least 2 characters long.')
  .max(60, 'Name must be at most 60 characters long.')
  .transform((value) => value.replace(/\s+/g, ' '));

const email = z
  .string({ message: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters long.')
  .email('Please provide a valid email address.');

const signupPassword = z
  .string({ message: 'Password is required.' })
  .min(10, 'Password must be at least 10 characters long.')
  .max(72, 'Password must be at most 72 characters long.');

// Login intentionally does not re-validate password strength — an existing
// account may have been created under different rules — but still bounds
// length to prevent oversized-payload hashing abuse.
const loginPassword = z
  .string({ message: 'Password is required.' })
  .min(1, 'Password is required.')
  .max(72, 'Password must be at most 72 characters long.');

export const signupRequestSchema = z
  .object({
    name,
    email,
    password: signupPassword,
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email,
    password: loginPassword,
  })
  .strict();

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
