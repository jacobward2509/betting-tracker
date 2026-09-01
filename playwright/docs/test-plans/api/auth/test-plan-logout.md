# Test Plan — POST /api/auth/logout

**Source:** `apps/api/openapi/auth.yaml` (`operationId: logout`)
**Method / Path:** `POST /api/auth/logout`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways, mirroring the sibling `getCurrentUser`/`deleteCurrentAccount`
plans (`test-plan-get-current-user.md`, `test-plan-delete-current-account.md`) where
the same reasoning applies. Per General Rules ("follow the exact field names and types
from the schema", "do not invent fields or rules not documented"), this plan follows
what `apps/api/openapi/auth.yaml` (and the `requireAuth` middleware in
`apps/api/src/server.ts`) actually declares rather than the generic defaults:

- **No request body, path parameters, or query parameters:** This is a parameterless
  `POST`. The **Missing Mandatory Data**, **Invalid Data Types**, **Not Found (404)**,
  **Unprocessable Entity (422)**, and **Cross-Field Validation** categories from the
  generic template are all not applicable — there are no fields to omit, mistype, or
  cross-validate, and no resource is looked up by a client-supplied ID (the session is
  derived solely from the bearer token).
- **No Authentication (401) is the only negative category driven directly by the
  request itself.** Per `requireAuth`, any request without a valid, unexpired bearer
  session token returns `401`. Coverage here is limited to a single "missing header"
  case, consistent with the `getCurrentUser`/`deleteCurrentAccount` plans' scope
  decision — this is sufficient to prove the auth guard is in effect without
  enumerating every way a token can be invalid (malformed header, garbage token,
  expired session), which is left as a known gap rather than a covered scenario.
- **The `401` response body deviates from the shared `ErrorResponse` schema by
  design**, for the same reason noted in `test-plan-get-current-user.md` /
  `test-plan-delete-current-account.md`: `apps/api/openapi/auth.yaml` documents `401`
  on this endpoint via a dedicated `PlainUnauthorized` response —
  `{ error: "<string>" }` — matching what `requireAuth` actually returns for every
  auth-failure path. This plan asserts that actual, documented shape.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the sibling `getCurrentUser`/`deleteCurrentAccount` plans — there is no
  documented, deterministic way to trigger a `500` purely from client input.
- **Session invalidation requires read-back validation.** Per the "GET Validation
  Requests (data-mutating endpoints)" rule in `api-test-scenarios.md`, since this
  endpoint deletes the session identified by the bearer token, the plan includes an
  Accepted read-back scenario confirming the invalidation actually took effect — the
  logged-out token can no longer authenticate against `GET /api/auth/me` — rather than
  only asserting the `204` on the `POST /api/auth/logout` call itself.
- **No "valid request with only required fields" baseline:** There are no fields at
  all on this request, so only a single Accepted "invalidate the session" write
  scenario (plus its read-back pair) is needed.
- **Sequential double-logout (stale token) re-use is out of scope for this plan.** The
  spec explicitly documents that calling logout twice sequentially with the same token
  returns `401` on the second call, since `requireAuth` rejects the now-deleted session
  before the handler runs — mirroring `test-plan-delete-current-account.md`'s "re-deleting
  an already-deleted account" scenario. Per user direction, this plan does not include a
  dedicated scenario for it; the two remaining No Authentication scenarios (missing
  header, and the GET-based read-back after logout) are considered sufficient coverage
  of the auth-guard behavior for this endpoint.

## Response Reference

| Status | Meaning                                                                          |
| ------ | --------------------------------------------------------------------------------- |
| 204    | Session invalidated successfully; no response body                              |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`   |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)      |

## Scenarios

| Scenario | Scenario Type                | Use Case                                                          | Description                                                                                                                                                          | HTTP Return Status Code |
| -------- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1        | Accepted                     | Valid request invalidates the current session                     | Seed an account via `POST /api/auth/signup`, then call `POST /api/auth/logout` with its bearer token; assert `204` and no response body                             | 204                       |
| 2        | Accepted                     | Validate logout via GET request                                    | Immediately after Scenario 1's logout, call `GET /api/auth/me` using the same (now invalidated) token; assert `401` and `{ error: "Unauthorized" }`, confirming the session no longer authenticates | 401                       |
| 3        | Negative - No Authentication | Missing `Authorization` header                                     | Send `POST /api/auth/logout` with no `Authorization` header at all (no account seeded — request is rejected before any session lookup)                              | 401                       |

## Execution Notes

- **Seeding via signup is required for every scenario except Scenario 3.** All seeded
  accounts are created with `POST /api/auth/signup` using `randomSignupEmail()` /
  `maximumSignupBody()` (the same seed-data helpers already imported by the `signup`,
  `login`, `getCurrentUser`, and `deleteCurrentAccount` describe blocks in
  `auth-endpoints-v2.spec.ts`), and the returned `token` is captured for use in the
  subsequent `logout`/`GET` calls.
- Scenarios 1 and 2 should run serially against the **same** seeded account (same
  pattern as the `deleteCurrentAccount` "Valid request deletes the current user's
  account" → "Validate account deletion via GET request" pair already in
  `auth-endpoints-v2.spec.ts`): seed once via `POST /api/auth/signup`, capture the
  returned `token`, issue the `POST /api/auth/logout` in Scenario 1, then reuse that
  same token for the follow-up `GET /api/auth/me` in Scenario 2.
- Scenario 3 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiPost`'s `withAuth()` helper in
  `support/functions/request-methods.ts`, following the same pattern as
  `apiGet`/`apiDelete`), and assert both the `401` status and the literal response
  body `{ error: "Unauthorized" }`.
- **Account cleanup:** unlike `deleteCurrentAccount`, a successful logout only
  invalidates the session — the underlying account itself is not deleted, so it must
  still be cleaned up to avoid leaking rows into the environment. However, the token
  captured at signup is no longer valid once Scenario 1's logout runs, so the existing
  `deleteAccount()` helper (`support/functions/auth-cleanup.ts`) cannot be called with
  that same token. Instead, after Scenario 2's read-back assertion, re-authenticate
  with the same seeded credentials via `POST /api/auth/login` to obtain a fresh token,
  then call `deleteAccount()` with that fresh token. This re-login-then-delete step
  should run in an `afterAll` scoped to the serial `204 - Accepted` describe block
  (which owns the one seeded account shared by Scenarios 1 and 2), keeping the
  `email`/`password` captured from the original `maximumSignupBody()` call available
  for the re-login.

