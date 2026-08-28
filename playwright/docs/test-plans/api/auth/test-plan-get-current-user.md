# Test Plan — GET /api/auth/me

**Source:** `apps/api/openapi/openapi.yaml` (`operationId: getCurrentUser`)
**Method / Path:** `GET /api/auth/me`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways. Per General Rules ("follow the exact field names and types from
the schema", "do not invent fields or rules not documented"), this plan follows what
`openapi.yaml` (and the `requireAuth` middleware in `apps/api/src/server.ts`) actually
declares rather than the generic defaults:

- **No request body, path parameters, or query parameters:** This is a parameterless
  `GET`. The **Missing Mandatory Data**, **Invalid Data Types**, **Not Found (404)**,
  **Unprocessable Entity (422)**, and **Cross-Field Validation** categories from the
  generic template are all not applicable — there are no fields to omit, mistype, or
  cross-validate, and no resource is looked up by ID.
- **No Authentication (401) is the only negative category for this endpoint.** Per
  `requireAuth`, any request without a valid, unexpired bearer session token returns
  `401`. Coverage here is limited to a single "missing header" case, at the user's
  request — this is sufficient to prove the auth guard is in effect without
  enumerating every way a token can be invalid (malformed header, garbage token,
  expired session, deleted-account token), which is left as a known gap rather than a
  covered scenario.
- **The `401` response body deviates from the documented `ErrorResponse` schema.**
  `openapi.yaml` documents `401` as `{ error: { code, message, fields? } }` (the shared
  `ErrorResponse` schema also used by `signup`/`login`), but `requireAuth` actually
  returns a plain `{ error: "Unauthorized" }` (a string, not an object) for every
  auth-failure path on this endpoint. This plan asserts the **actual** observed shape
  (consistent with "follow what the code does, not what's merely documented" for
  black-box testing), and flags the mismatch as a spec/implementation discrepancy that
  may be worth raising as a bug during self-heal/repair rather than silently treating
  the documented schema as correct.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the sibling `signup`/`login` plans — there is no documented, deterministic
  way to trigger a `500` purely from client input.
- **No "valid request with only required fields" baseline:** There are no optional
  fields (indeed no fields at all) on this request, so only a single Accepted scenario
  is needed.
- **No GET read-back scenario:** This endpoint IS the read-back target used by the
  `signup` and `login` plans' own Accepted scenarios (see
  `test-plan-signup.md` / `test-plan-login.md`, "Validate signup/login via GET
  request"), so a dedicated Accepted scenario here still exercises the endpoint
  directly (not merely as a side-effect of another suite) while avoiding duplicating
  those existing assertions.

## Response Reference

| Status | Meaning                                                                          |
| ------ | --------------------------------------------------------------------------------- |
| 200    | Authenticated successfully; body is `{ user: { id, name, email } }`               |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`   |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)      |

## Scenarios

| Scenario | Scenario Type              | Use Case                                | Description                                                                                          | HTTP Return Status Code |
| -------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1        | Accepted                    | Valid request returns the authenticated user | Call `GET /api/auth/me` with a valid bearer token; assert the returned `user.id`/`name`/`email` match the account that owns the token | 200                       |
| 2        | Negative - No Authentication | Missing `Authorization` header           | Send the request with no `Authorization` header at all                                                 | 401                       |

## Execution Notes

- Scenario 1 requires a pre-existing, known-good account with a known token — seed one
  via `POST /api/auth/signup` (reuse the `randomSignupEmail()` / `maximumSignupBody()`
  seed-data helpers already used by the `signup` and `login` specs) and use the
  returned `token`/`user.id`/`name`/`email` as the expected values to assert against.
- Clean up the seeded account afterwards via the existing `deleteAccount()` helper
  (`support/functions/auth-cleanup.ts`), scoped with a matching `beforeEach`/`afterEach`
  pair for this scenario — this is the canonical cleanup pattern for the whole file; the
  `signup`/`login` suites' own seeded accounts (per their test plans' Execution Notes)
  should follow the same pattern rather than deferring cleanup to a separate suite or
  persisting tokens to a shared file on disk.
- Scenario 2 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`), and assert both the `401` status and the
  literal response body `{ error: "Unauthorized" }`.
