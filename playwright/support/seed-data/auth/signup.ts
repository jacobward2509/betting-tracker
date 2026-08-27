/**
 * Seed data for POST /api/auth/signup (apps/api/openapi/openapi.yaml → SignupRequest).
 *
 * This endpoint has no region/locale concept, so — unlike the multi-region pattern
 * used elsewhere in this guide — a single flat data set is sufficient.
 */

export interface SignupRequestBody {
  name: string
  email: string
  password: string
}

const VALID_NAME = 'Cline QA Test'
const VALID_PASSWORD = 'CorrectHorseBattery1'

/**
 * Generates a unique email address per call so parallel/repeated test runs never
 * collide on an existing account (signup enforces email uniqueness).
 */
export function randomSignupEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `cline-signup-${unique}@example.com`
}

/**
 * A complete, valid SignupRequest body. All three fields are required by the
 * schema, so there is no separate "minimum" builder — required-only and
 * all-fields bodies are identical for this endpoint.
 */
export function maximumSignupBody(): SignupRequestBody {
  return {
    name: VALID_NAME,
    email: randomSignupEmail(),
    password: VALID_PASSWORD
  }
}
