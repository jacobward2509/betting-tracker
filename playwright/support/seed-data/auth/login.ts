/**
 * Seed data for POST /api/auth/login (apps/api/openapi/auth.yaml → LoginRequest).
 *
 * Unlike signup, login has no "generate a unique value" concern — the email/password
 * pair must match an existing account. Tests are expected to create that account via
 * the signup seed-data helpers (`randomSignupEmail()` / `maximumSignupBody()`) and then
 * build the corresponding login body from the same credentials using this helper.
 */

export interface LoginRequestBody {
  email: string
  password: string
}

/**
 * Builds a LoginRequest body from a known email/password pair (e.g. the credentials
 * used to sign up an account earlier in the same test). Both fields are required by
 * the schema, so there is no separate "minimum" builder — required-only and all-fields
 * bodies are identical for this endpoint.
 */
export function maximumLoginBody(email: string, password: string): LoginRequestBody {
  return {email, password}
}
