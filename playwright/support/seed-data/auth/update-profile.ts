/**
 * Seed data for PATCH /api/auth/me (apps/api/openapi/auth.yaml → UpdateProfileRequest).
 *
 * Reuses the same `name` validation rule as signup (2–60 characters), so a valid
 * updated name here is any value that would also pass signup's own name field.
 */

export interface UpdateProfileRequestBody {
  name: string
}

const VALID_UPDATED_NAME = 'Cline QA Updated'

/**
 * A complete, valid UpdateProfileRequest body. `name` is the only (required) field
 * on this endpoint, so there is no separate "minimum" builder — required-only and
 * all-fields bodies are identical for this endpoint.
 */
export function maximumUpdateProfileBody(): UpdateProfileRequestBody {
  return {
    name: VALID_UPDATED_NAME
  }
}
