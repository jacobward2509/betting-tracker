# Test Plan — POST /api/auth/login

**Source:** `apps/api/openapi/auth.yaml` (`operationId: login`)
**Method / Path:** `POST /api/auth/login`
**Auth:** None required (`security: []` — login itself is the mechanism to obtain a session)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways. Per General Rules ("follow the exact field names and types from
the schema", "do not invent fields or rules not documented"), this plan follows what
`apps/api/openapi/auth.yaml` (and the mirrored `apps/api/src/validation.ts` schema) actually declares
rather than the generic defaults:

- **No Authentication (401) as a "missing auth header" case:** Not applicable and not
  included. The spec declares `security: []` — login has no auth requirement on the
  request itself. Instead, `401` here is the **primary negative-outcome category**,
  returned for invalid credentials (see below) rather than a missing header.
- **Invalid Credentials (401):** Per the endpoint description, "invalid email and
  invalid password both return an identical, generic 401 response" — this is a
  deliberate anti-enumeration measure (the server always performs an equivalent-cost
  password comparison, even against a dummy hash, when no account is found). Both the
  "unknown email" and "correct email / wrong password" cases are covered and asserted
  to return the exact same `error.code` (`INVALID_CREDENTIALS`) and message.
- **Not Found (404):** Not applicable. Login has no path/query parameters and looks up
  no resource by ID; an unrecognized email is covered under Invalid Credentials (401),
  not 404, to avoid leaking which emails are registered.
- **Unprocessable Entity (422):** Not used by this endpoint. Every request-shape
  validation failure (missing/invalid fields, unknown fields) is documented as `400`
  with an `ErrorResponse` body (`{ error: { code, message, fields? } }`), consistent
  with the sibling `signup` endpoint's plan.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the `signup` plan — there is no documented, deterministic way to trigger a
  `500` purely from client input.
- **One endpoint-specific negative category added** (not part of the generic template,
  but explicitly documented in `apps/api/openapi/auth.yaml`'s responses for this endpoint, and shared
  with `signup`): **Payload Too Large (413)**.
- Login's `additionalProperties: false` (`.strict()` in `validation.ts`) means unknown
  fields are a `400` validation error — covered under Invalid Data Types.
- **`password` has no minimum-length business rule for login.** Unlike `signup`
  (`minLength: 10`), `validation.ts` explicitly notes login "does not re-validate
  password strength — an existing account may have been created under different
  rules" — the schema only requires `minLength: 1`. There is therefore no "password
  below minimum length" negative scenario (an empty string is the only way to violate
  the minimum, and that is already covered under "Missing Mandatory Data" / "Empty
  String").
- Both request fields (`email`, `password`) are **required** — there are no optional
  fields, so the "valid request with only required fields" baseline scenario would be
  identical to "valid request with all fields" and is not duplicated.
- **Positive boundary scenarios are intentionally excluded**, consistent with the
  `signup` plan. Boundary coverage is instead asserted negatively only — confirming the
  API correctly rejects one character above the maximum for each bounded field (there
  is no lower boundary to test for `password`, since its minimum is 1 character).
- **Case-insensitive email match on login (business logic):** `validation.ts` lowercases
  `email` server-side on both signup and login, and the stored value is the lowercased
  form — so a login attempt with a differently-cased but otherwise matching email must
  still succeed. This is covered as an Accepted / Cross-Field scenario, mirroring the
  "Duplicate email — case-insensitive match" scenario in the `signup` plan (which proves
  the same normalization from the write side).

## Request Schema Reference (`LoginRequest`)

| Field    | Type   | Required | Constraints                        |
| -------- | ------ | -------- | ----------------------------------- |
| email    | string | Yes      | `format: email`, `maxLength: 254`   |
| password | string | Yes      | `minLength: 1`, `maxLength: 72`     |

`additionalProperties: false` — unrecognized fields are rejected.

## Response Reference

| Status | Meaning                                                                 |
| ------ | ------------------------------------------------------------------------ |
| 200    | Authenticated successfully. Returns `AuthResponse` (`token`, `user`).    |
| 400    | Validation failure (malformed email or missing password).                |
| 401    | Invalid email or password. Generic/identical for both cases.             |
| 413    | Request body exceeded the maximum allowed size.                          |
| 500    | Unexpected server error. Out of scope for this plan (see notes above).   |

## Test Scenarios

| Scenario | Scenario Type (Accepted / Negative – subcategory) | Use Case | Description | HTTP Return Status Code |
| -------- | ------------------------------------------------- | -------- | ----------- | ----------------------- |
| 1 | Accepted | Valid request with all fields | Log in with a valid, registered email and correct password | 200 |
| 2 | Accepted | Validate login via GET request | After login, call `GET /api/auth/me` with the returned token and confirm the returned `user.id`/`name`/`email` match the login response | 200 |
| 3 | Accepted - Cross-Field Validation | Login succeeds with differently-cased email | Log in using an email matching a registered account but with different casing (e.g. `JANE@Example.com`) | 200 |
| 4 | Negative - Missing Mandatory Data | Missing request body | Send an empty request body | 400 |
| 5 | Negative - Missing Mandatory Data | Missing `email` field | Omit `email` entirely | 400 |
| 6 | Negative - Missing Mandatory Data | Missing `password` field | Omit `password` entirely | 400 |
| 7 | Negative - Invalid Data Types | `email` is NULL | Set `email` = `null` | 400 |
| 8 | Negative - Invalid Data Types | `email` as an Empty String | Set `email` = `""` | 400 |
| 9 | Negative - Invalid Data Types | `email` as a Number | Set `email` = `12345` (wrong JSON type) | 400 |
| 10 | Negative - Invalid Data Types | Invalid `email` format | Set `email` = `"jane.doe@example"` (no valid TLD / malformed) | 400 |
| 11 | Negative - Invalid Data Types | `email` above maximum length | `email` = 255 characters (max is 254) | 400 |
| 12 | Negative - Invalid Data Types | `password` is NULL | Set `password` = `null` | 400 |
| 13 | Negative - Invalid Data Types | `password` as an Empty String | Set `password` = `""` | 400 |
| 14 | Negative - Invalid Data Types | `password` as a Number | Set `password` = `12345678901` (wrong JSON type) | 400 |
| 15 | Negative - Invalid Data Types | `password` above maximum length | `password` = 73 characters (max is 72) | 400 |
| 16 | Negative - Invalid Data Types | Unrecognized field present | Include an extra field not in the schema (e.g. `rememberMe: true`) | 400 |
| 17 | Negative - Invalid Credentials | Unknown email | Log in with a well-formed email that has no registered account | 401 |
| 18 | Negative - Invalid Credentials | Correct email, incorrect password | Log in with a registered email but the wrong password | 401 |
| 19 | Negative - Invalid Credentials | Identical error for unknown email vs wrong password | Assert scenarios 17 and 18 return the exact same `error.code`/`error.message` | 401 |
| 20 | Negative - Payload Too Large | Request body exceeds size limit | Send a request body larger than the configured 10kb limit (e.g. an oversized `password` value) | 413 |

## Execution Notes

- Scenario 2 depends on scenario 1's response (`token`); these two should run serially,
  with the token passed from the login response into the follow-up `GET /api/auth/me`
  call, consistent with the "GET Validation Requests" rule for data-mutating endpoints
  in `api-test-scenarios.md`. (Login doesn't mutate persisted data itself, but it is the
  natural read-back check that the returned session is valid and belongs to the correct
  user.)
- Scenarios 1, 3, 17, 18, and 19 all require a pre-existing, known-good account (created
  via `POST /api/auth/signup` — reuse the `randomSignupEmail()` / `maximumSignupBody()`
  seed-data helpers already used by the `signup` spec) with a known email/password
  combination — seed this account once (e.g. in a `beforeAll`/`beforeEach`) and reuse it
  across the login scenarios in this suite.
- For scenarios 17, 18, and 19, assert on `error.code` (`INVALID_CREDENTIALS`) and
  `error.message` in addition to the HTTP status, since this API returns a structured
  `ErrorResponse` body rather than a plain string — and scenario 19 exists specifically
  to prove the two failure modes are indistinguishable to a caller (anti-enumeration).
- **Account cleanup:** the account seeded per-test in `beforeEach` (for scenarios 4-20,
  which each get their own fresh account/credentials) must be cleaned up via the
  existing `deleteAccount()` helper (`support/functions/auth-cleanup.ts`) in a matching
  `afterEach` — do not defer cleanup to a separate "dedicated delete suite" or persist
  tokens to a shared file on disk; there is no such suite in this spec file. Scenarios
  1, 2, and 3 share one account across a serial trio and therefore need their own
  `beforeAll`/`afterAll`-scoped account instead, independent of the per-test
  `beforeEach`/`afterEach` — sharing the per-test account would delete it after the
  first serial test runs, breaking the pair/trio. Mirror the `getCurrentUser` suite's
  cleanup pattern throughout.

