# Test Plan — DELETE /api/auth/me

**Source:** `apps/api/openapi/auth.yaml` (`operationId: deleteCurrentAccount`)
**Method / Path:** `DELETE /api/auth/me`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways, mirroring the sibling `getCurrentUser` plan
(`test-plan-get-current-user.md`) where the same reasoning applies. Per General Rules
("follow the exact field names and types from the schema", "do not invent fields or
rules not documented"), this plan follows what `apps/api/openapi/auth.yaml` (and the `requireAuth`
middleware in `apps/api/src/server.ts`) actually declares rather than the generic
defaults:

- **No request body, path parameters, or query parameters:** This is a parameterless
  `DELETE`. The **Missing Mandatory Data**, **Invalid Data Types**, **Not Found
  (404)**, **Unprocessable Entity (422)**, and **Cross-Field Validation** categories
  from the generic template are all not applicable — there are no fields to omit,
  mistype, or cross-validate, and no resource is looked up by a client-supplied ID
  (the account is derived solely from the bearer token).
- **No Authentication (401) is the only negative category driven directly by the
  request itself.** Per `requireAuth`, any request without a valid, unexpired bearer
  session token returns `401`. Coverage here is limited to a single "missing header"
  case, consistent with the `getCurrentUser` plan's scope decision — this is sufficient
  to prove the auth guard is in effect without enumerating every way a token can be
  invalid (malformed header, garbage token, expired session), which is left as a known
  gap rather than a covered scenario.
- **The `401` response body deviates from the shared `ErrorResponse` schema by design**,
  for the same reason noted in `test-plan-get-current-user.md`: `apps/api/openapi/auth.yaml`
  documents `401` on this endpoint via a dedicated `PlainUnauthorized` response —
  `{ error: "<string>" }` — matching what `requireAuth` actually returns for every
  auth-failure path. This plan asserts that **actual, now-documented** shape. Prior to
  the `auth.yaml` split this was a spec/implementation discrepancy; it is no longer a
  mismatch, just an intentionally different shape for this one response.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the sibling `signup`/`login`/`getCurrentUser` plans — there is no
  documented, deterministic way to trigger a `500` purely from client input.
- **Destructive, cascading side effects require read-back validation.** Per the
  "GET Validation Requests (data-mutating endpoints)" rule in `api-test-scenarios.md`,
  since this endpoint permanently deletes the account (and cascades to its sessions,
  bookmaker/bet-type preferences, and bets), the plan includes an Accepted read-back
  scenario confirming the deletion actually took effect — the deleted account's token
  can no longer authenticate against `GET /api/auth/me` — rather than only asserting
  the `204` on the `DELETE` call itself.
- **Stale-token re-use against the DELETE endpoint itself.** In addition to the
  `GET`-based read-back, a further scenario re-issues `DELETE /api/auth/me` a second
  time with the same (now deleted) account's token, confirming `deleteCurrentAccount`'s
  own auth guard rejects a token whose underlying account no longer exists — this
  exercises the endpoint under test directly rather than only its sibling `GET`.
- **No "valid request with only required fields" baseline:** There are no optional
  fields (indeed no fields at all) on this request, so only a single primary Accepted
  scenario plus its read-back companion are needed.
- **Every scenario requiring a real account seeds it via `POST /api/auth/signup`
  first** (reusing the existing `randomSignupEmail()` / `maximumSignupBody()` seed-data
  helpers already used by `signup`/`login`/`getCurrentUser`) — this endpoint has no
  other way to obtain a valid bearer token. The one exception is the missing-header
  scenario, which deliberately needs no seeded account since the request is rejected
  by `requireAuth` before any account lookup occurs. See Execution Notes below for the
  exact seeding/token reuse per scenario.

## Response Reference

| Status | Meaning                                                                          |
| ------ | --------------------------------------------------------------------------------- |
| 204    | Account deleted successfully; no response body                                   |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`  |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)     |

## Scenarios

| Scenario | Scenario Type              | Use Case                                                        | Description                                                                                                                                                          | HTTP Return Status Code |
| -------- | --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1        | Accepted                    | Valid request deletes the current user's account                | Seed an account via `POST /api/auth/signup`, then call `DELETE /api/auth/me` with its bearer token; assert `204` and no response body                              | 204                       |
| 2        | Accepted                    | Validate account deletion via GET request                       | Immediately after Scenario 1's delete, call `GET /api/auth/me` using the same (now deleted) account's token; assert `401` and `{ error: "Unauthorized" }`, confirming the account and its data no longer exist | 401                       |
| 3        | Negative - No Authentication | Missing `Authorization` header                                  | Send `DELETE /api/auth/me` with no `Authorization` header at all (no account seeded — request is rejected before any lookup)                                        | 401                       |
| 4        | Negative - No Authentication | Re-deleting an already-deleted account (stale token)             | Seed a second, independent account via `POST /api/auth/signup`, delete it once (`204`), then call `DELETE /api/auth/me` again with the same now-invalidated token; assert `401` and `{ error: "Unauthorized" }` | 401                       |

## Execution Notes

- **Seeding via signup is required for every scenario except Scenario 3.** All seeded
  accounts are created with `POST /api/auth/signup` using `randomSignupEmail()` /
  `maximumSignupBody()` (the same seed-data helpers already imported by the `signup`,
  `login`, and `getCurrentUser` describe blocks in `auth-endpoints-v2.spec.ts`), and the
  returned `token` is captured for use in the subsequent `DELETE`/`GET` calls.
- Scenarios 1 and 2 should run serially against the **same** seeded account (same
  pattern as the `signup`/`getCurrentUser` "Valid request with all fields" →
  "Validate ... via GET request" pairs already in `auth-endpoints-v2.spec.ts`): seed
  once via `POST /api/auth/signup`, capture the returned `token`, issue the `DELETE` in
  Scenario 1, then reuse that same token for the follow-up `GET` in Scenario 2. No
  `afterEach`/`afterAll` cleanup call to `deleteAccount()` is needed for this account —
  Scenario 1's own `DELETE` call under test **is** the cleanup.
- Scenario 3 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiDelete`'s `withAuth()` helper in
  `support/functions/request-methods.ts`, following the same pattern as `apiGet`), and
  assert both the `401` status and the literal response body `{ error: "Unauthorized" }`.
- Scenario 4 requires its own independently seeded account (do not reuse Scenario 1/2's
  account, since it is already deleted by the time Scenario 4 would run and test order
  should not be relied upon): seed via `POST /api/auth/signup`, call `DELETE
  /api/auth/me` once to delete it (expect `204`, not asserted further as this is setup
  rather than the scenario under test), then call `DELETE /api/auth/me` again with the
  same token and assert `401` / `{ error: "Unauthorized" }`.
- If a `deleteAccount()` helper call is needed anywhere in this suite it should follow
  the existing `support/functions/auth-cleanup.ts` pattern already used by `signup` /
  `login` / `getCurrentUser`, but note that Scenarios 1, 2, and 4 do not require it since
  their own `DELETE` calls already remove the seeded accounts.
