import { z } from 'zod';

// These schemas intentionally mirror the constraints documented in
// apps/api/openapi/auth.yaml (SignupRequest / LoginRequest / UpdateProfileRequest)
// and apps/api/openapi/user-config.yaml (UpdateUserConfigRequest) so the runtime
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

// Reuses the same `name` field validator as signup, so a display-name update
// after account creation can't accept values signup itself would reject
// (e.g. no upper bound was previously enforced here — see server.ts PATCH
// /api/auth/me).
export const updateProfileRequestSchema = z
  .object({
    name,
  })
  .strict();

// Maximum sane default stake — bounds what silently pre-fills the "Stake"
// field on every new bet via the frontend's Add Bet modal. Positivity alone
// was previously the only bound enforced.
const MAX_DEFAULT_STAKE = 10000;

// All fields are optional on PUT /api/user/config (a client may update just
// one preference at a time), so `.partial()` on the whole object is not
// applicable — each field is independently optional/nullable to match what
// server.ts already accepts. Bookmaker/bet-type membership (i.e. whether a
// given value is one of the user's *available* bookmakers/bet types) is
// still validated against the Bookmakers/BetTypes tables in server.ts, since
// that requires a database lookup this schema can't perform.
export const updateUserConfigRequestSchema = z
  .object({
    enabledBookmakers: z.array(z.string().trim().min(1)).optional().nullable(),
    defaultBookmaker: z.string().trim().min(1).optional().nullable(),
    defaultBetType: z.string().trim().min(1).optional().nullable(),
    defaultStake: z
      .number()
      .positive('Default stake must be a positive number.')
      .max(MAX_DEFAULT_STAKE, `Default stake must be at most ${MAX_DEFAULT_STAKE}.`)
      .optional()
      .nullable(),
  })
  .strict();

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateUserConfigRequest = z.infer<typeof updateUserConfigRequestSchema>;

