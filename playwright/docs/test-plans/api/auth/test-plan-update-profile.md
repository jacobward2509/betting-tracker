# Test Plan — PATCH /api/auth/me

**Source:** `apps/api/openapi/auth.yaml` (`operationId: updateProfile`)
**Method / Path:** `PATCH /api/auth/me`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways, mirroring the sibling `signup`/`login`/`getCurrentUser`/
`deleteCurrentAccount` plans (`test-plan-signup.md`, `test-plan-login.md`,
`test-plan-get-current-user.md`, `test-plan-delete-current-account.md`) where the same
reasoning applies. Per General Rules ("follow the exact field names and types from the
schema", "do not invent fields or rules not documented"), this plan follows what
`apps/api/openapi/auth.yaml` (and the mirrored `apps/api/src/validation.ts` /
`apps/api/src/server.ts` implementation) actually declares rather than the generic
defaults:

- **No path parameters or query parameters:** The account being updated is derived
  solely from the bearer token, not from any client-supplied ID — so **Not Found
  (404)** and any ID-based **Cross-Field Validation** (path-parameter mismatches,
  ownership/authorization) are not applicable.
- **A single required field (`name`)** — there are no optional fields on
  `UpdateProfileRequest`, so the "valid request with only required fields" baseline
  scenario would be identical to "valid request with all fields" and is not
  duplicated (same reasoning as `signup`/`login`).
- **"Missing request body" and "Missing `name` field" collapse into a single
  scenario.** Unlike `signup` (three required fields, so an empty `{}` body and a
  single missing field are distinct requests) or `PUT /api/user/config` (multiple
  optional fields), `name` is the *only* field on this request — sending `{}` and
  sending a body with `name` omitted are the exact same request and would produce an
  identical, redundant test. Per "Be Deterministic" in `api-test-scenarios.md`, this
  plan includes only one scenario for this case.
- **Unprocessable Entity (422) is not used by this endpoint.** Every validation
  failure (missing/invalid/too-short/too-long `name`, or an unrecognized extra field)
  is documented as `400` with the structured `ErrorResponse` body
  (`{ error: { code, message, fields? } }`), consistent with `signup`/`login`/
  `PUT /api/user/config`.
- **`additionalProperties: false` (`.strict()` in `validation.ts`) means unknown
  fields are a `400` validation error** — covered under Invalid Data Types, mirroring
  the "Unrecognized field present" scenarios already in `signup`/`login`/
  `updateUserConfig`.
- **No format/regex/enum/date/array/object field types are present** — `name` is a
  plain, non-formatted string, so the Invalid Data Types coverage below only includes
  the string-type cases that actually apply (NULL, empty string, wrong JSON type,
  below-minimum length, above-maximum length); email-format, GUID-format, and similar
  scenarios from the generic template are not applicable to this field.
- **Positive whitespace-trimming/collapsing behavior is not asserted as a standalone
  scenario.** `apps/api/openapi/auth.yaml` documents that `name` is "trimmed and
  collapsed" server-side (same transform as `signup`'s `name`), but — consistent with
  the `signup` plan not covering this either — this plan does not add a dedicated
  positive scenario for it, to keep parity with the sibling plan's scope decision.
- **No Authentication (401) is the only negative category driven directly by missing
  credentials.** Per `requireAuth`, any request without a valid, unexpired bearer
  session token returns `401`. Coverage here is limited to a single "missing header"
  case, consistent with the `getCurrentUser`/`deleteCurrentAccount` plans' scope
  decision — this is sufficient to prove the auth guard is in effect without
  enumerating every way a token can be invalid (malformed header, garbage token,
  expired session), which is left as a known gap rather than a covered scenario.
- **The `401` response body deviates from the shared `ErrorResponse` schema by
  design**, for the same reason noted in `test-plan-get-current-user.md`:
  `apps/api/openapi/auth.yaml` documents `401` on this endpoint via a dedicated
  `PlainUnauthorized` response — `{ error: "<string>" }` — matching what
  `requireAuth` actually returns for every auth-failure path on every endpoint in this
  file.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the sibling `signup`/`login`/`getCurrentUser`/`deleteCurrentAccount` plans
  — there is no documented, deterministic way to trigger a `500` purely from client
  input.
- **Validate persistence via a GET read-back.** Per the "GET Validation Requests
  (data-mutating endpoints)" rule in `api-test-scenarios.md`, since this endpoint
  amends persisted data (the account's `name`), the plan includes an Accepted
  read-back scenario confirming the updated name actually persisted — call
  `GET /api/auth/me` after the `PATCH` and assert the returned `user.name` matches the
  value sent/returned by the `PATCH`, not merely that the `PATCH` itself returned
  `200`.

## Request Schema Reference (`UpdateProfileRequest`)

| Field | Type   | Required | Constraints                                                      |
| ----- | ------ | -------- | ------------------------------------------------------------------ |
| name  | string | Yes      | `minLength: 2`, `maxLength: 60`; whitespace trimmed and collapsed server-side |

`additionalProperties: false` — unrecognized fields are rejected.

## Response Reference

| Status | Meaning                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| 200    | Display name updated successfully — `CurrentUserResponse` (`{ user: { id, name, email } }`) |
| 400    | Validation failure (name too short, too long, missing, wrong type, or unrecognized extra fields); body is the structured `ErrorResponse` |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`          |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)             |

## Scenarios

| Scenario | Scenario Type | Use Case | Description | HTTP Return Status Code |
| -------- | -------------- | -------- | ------------ | ------------------------ |
| 1  | Accepted                          | Valid request with all fields                | Update the current user's `name` to a new valid value (2–60 characters)                                             | 200 |
| 2  | Accepted                          | Validate update via GET request              | After the `PATCH`, call `GET /api/auth/me` with the same bearer token and assert the returned `user.name` matches the value sent/returned by the `PATCH`  | 200 (on the GET) |
| 3  | Negative - Missing Mandatory Data | Missing `name` field (empty request body)    | Send an empty `{}` body — the only field is `name`, so this is equivalent to omitting it                             | 400 |
| 4  | Negative - Invalid Data Types     | `name` is NULL                                | Set `name` = `null`                                                                                                   | 400 |
| 5  | Negative - Invalid Data Types     | `name` as an Empty String                     | Set `name` = `""`                                                                                                     | 400 |
| 6  | Negative - Invalid Data Types     | `name` as a Number                            | Set `name` = `12345` (wrong JSON type)                                                                                | 400 |
| 7  | Negative - Invalid Data Types     | `name` below minimum length                   | `name` = 1 character (min is 2)                                                                                       | 400 |
| 8  | Negative - Invalid Data Types     | `name` above maximum length                   | `name` = 61 characters (max is 60)                                                                                    | 400 |
| 9  | Negative - Invalid Data Types     | Unrecognized field present                    | Include an extra field not in the schema (e.g. `role: "admin"`)                                                       | 400 |
| 10 | Negative - No Authentication      | Missing `Authorization` header                | Send `PATCH /api/auth/me` with a valid body but no `Authorization` header at all                                      | 401 |

## Execution Notes

- **Every scenario requiring a real account seeds it via `POST /api/auth/signup`
  first** (reusing the existing `randomSignupEmail()` / `maximumSignupBody()`
  seed-data helpers already used by `signup`/`login`/`getCurrentUser`/
  `deleteCurrentAccount`) — this endpoint has no other way to obtain a valid bearer
  token. The one exception is Scenario 10, which deliberately needs no seeded account
  since the request is rejected by `requireAuth` before any account lookup occurs.
- Scenarios 1 and 2 should run serially against the **same** seeded account (same
  pattern as the `signup`/`getCurrentUser` "Valid request with all fields" →
  "Validate ... via GET request" pairs already in `auth-endpoints-v2.spec.ts`): seed
  once via `POST /api/auth/signup`, capture the returned `token`, issue the `PATCH` in
  Scenario 1 with a new `name`, then reuse that same token for the follow-up `GET` in
  Scenario 2 and assert the returned `user.name` matches the new value.
- Scenarios 3–9 each need their own freshly seeded account per test (`beforeEach`) —
  mirror the `getCurrentUser` suite's `beforeEach`/`afterEach` pattern, calling the
  existing `deleteAccount()` helper (`support/functions/auth-cleanup.ts`) in
  `afterEach` to clean up.
- Scenario 10 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiPatch`'s `withAuth()` helper in
  `support/functions/request-methods.ts`, following the same pattern as `apiGet`/
  `apiDelete`), and assert both the `401` status and the literal response body
  `{ error: "Unauthorized" }`.
- For scenarios 3–9, assert on `error.code` (`VALIDATION_ERROR`) and
  `error.fields[0].message` in addition to the HTTP status, mirroring the
  `signup`/`login`/`updateUserConfig` suites' pattern for structured validation
  errors. Expected messages reuse the shared `name` validator's exact copy (see
  `apps/api/src/validation.ts`): "Name is required." (missing/NULL/wrong type),
  "Name must be at least 2 characters long." (empty string / below minimum), "Name
  must be at most 60 characters long." (above maximum).
- **Account cleanup:** every scenario that seeds an account (1/2's shared account, and
  each of 3–9's per-test account) must be cleaned up via the existing `deleteAccount()`
  helper — do not defer cleanup to a separate "dedicated delete suite" or persist
  tokens to a shared file on disk; there is no such suite in this spec file.

