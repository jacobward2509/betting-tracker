# Test Plan — POST /api/auth/signup

**Source:** `apps/api/openapi/openapi.yaml` (`operationId: signup`)
**Method / Path:** `POST /api/auth/signup`
**Auth:** None required (`security: []` — signup is intentionally public)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways. Per General Rules ("follow the exact field names and types from
the schema", "do not invent fields or rules not documented"), this plan follows what
`openapi.yaml` actually declares rather than the generic defaults:

- **No Authentication (401):** Not applicable and not included as a dedicated
  scenario. The spec declares `security: []` — signup has no auth requirement, so
  every other scenario in this plan is naturally exercised with no `Authorization`
  header present; a standalone "no auth" case would add no additional coverage.
- **Not Found (404):** Not applicable. Signup has no path/query parameters and looks
  up no existing resource by ID.
- **Unprocessable Entity (422):** Not used by this endpoint. Every validation and
  business-logic failure (missing/invalid fields, unknown fields, duplicate email) is
  documented as `400` with an `ErrorResponse` body (`{ error: { code, message,
  fields? } }`). Scenarios that the generic template would map to 422 (e.g. "extra
  field present", "duplicate unique field") are included below under `400` to match
  the real contract.
- **Internal Server Error (500):** Not included as a runnable scenario. There is no
  documented, deterministic way to trigger a `500` purely from client input (it would
  require server-side fault injection, e.g. simulating a database outage), which is
  out of scope for black-box API testing of this endpoint.
- **One endpoint-specific negative category added** (not part of the generic
  template, but explicitly documented in `openapi.yaml`'s responses for this
  endpoint): **Payload Too Large (413)**.
- Signup's `additionalProperties: false` means unknown fields (e.g. the legacy
  `preferences` payload previously sent by this endpoint) are now a `400` validation
  error, not silently ignored — covered under Invalid Data Types.
- All three request fields (`name`, `email`, `password`) are **required** — there are
  no optional fields, so the "valid request with only required fields" baseline
  scenario would be identical to "valid request with all fields" and is not
  duplicated.
- **Positive boundary scenarios are intentionally excluded.** Exact-boundary min/max
  "Accepted" cases (e.g. `name` at exactly 2/60 chars, `password` at exactly 10/72
  chars, `email` at exactly 254 chars) are not included as standalone scenarios.
  Boundary coverage is instead asserted negatively only — i.e. confirming the API
  correctly rejects one character below the minimum and one character above the
  maximum for each bounded field (see Invalid Data Types below).

## Request Schema Reference (`SignupRequest`)

| Field    | Type   | Required | Constraints                                      |
| -------- | ------ | -------- | ------------------------------------------------- |
| name     | string | Yes      | `minLength: 2`, `maxLength: 60`                    |
| email    | string | Yes      | `format: email`, `maxLength: 254`                  |
| password | string | Yes      | `minLength: 10`, `maxLength: 72`                   |

`additionalProperties: false` — unrecognized fields are rejected.

## Response Reference

| Status | Meaning                                                        |
| ------ | --------------------------------------------------------------- |
| 201    | Account created — `AuthResponse` (`{ token, user }`)             |
| 400    | Validation failure or account already exists — `ErrorResponse`  |
| 413    | Request body exceeded the size limit — `ErrorResponse`          |
| 500    | Unexpected server error — `ErrorResponse` (not covered, see above) |

## Scenario Table

| Scenario | Scenario Type                     | Use Case                                              | Description                                                                                | HTTP Return Status Code |
| -------- | ---------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------ |
| 1        | Accepted                           | Valid request with all fields                          | `name`, `email`, `password` all valid                                                        | 201                       |
| 2        | Accepted                           | Validate signup via GET request                        | After signup, call `GET /api/auth/me` with the returned token; assert `id`/`name`/`email` match the signup response | 200 (on the GET)          |
| 3        | Negative - Missing Mandatory Data | Missing request body                                    | Send an empty `{}` body                                                                      | 400                       |
| 4        | Negative - Missing Mandatory Data | Missing `name`                                          | Remove `name` from the request                                                               | 400                       |
| 5        | Negative - Missing Mandatory Data | Missing `email`                                         | Remove `email` from the request                                                               | 400                       |
| 6        | Negative - Missing Mandatory Data | Missing `password`                                      | Remove `password` from the request                                                           | 400                       |
| 7        | Negative - Invalid Data Types      | `name` is NULL                                          | Set `name` = `null`                                                                          | 400                       |
| 8        | Negative - Invalid Data Types      | `name` as an Empty String                               | Set `name` = `""`                                                                            | 400                       |
| 9        | Negative - Invalid Data Types      | `name` as a Number                                      | Set `name` = `12345` (wrong JSON type)                                                       | 400                       |
| 10       | Negative - Invalid Data Types      | `name` below minimum length                             | `name` = 1 character (min is 2)                                                              | 400                       |
| 11       | Negative - Invalid Data Types      | `name` above maximum length                             | `name` = 61 characters (max is 60)                                                           | 400                       |
| 12       | Negative - Invalid Data Types      | `email` is NULL                                         | Set `email` = `null`                                                                         | 400                       |
| 13       | Negative - Invalid Data Types      | `email` as an Empty String                               | Set `email` = `""`                                                                           | 400                       |
| 14       | Negative - Invalid Data Types      | `email` as a Number                                      | Set `email` = `12345` (wrong JSON type)                                                      | 400                       |
| 15       | Negative - Invalid Data Types      | Invalid `email` format                                   | Set `email` = `"jane.doe@example"` (no valid TLD / malformed)                                | 400                       |
| 16       | Negative - Invalid Data Types      | `email` above maximum length                             | `email` = 255 characters (max is 254)                                                        | 400                       |
| 17       | Negative - Invalid Data Types      | `password` is NULL                                       | Set `password` = `null`                                                                      | 400                       |
| 18       | Negative - Invalid Data Types      | `password` as an Empty String                            | Set `password` = `""`                                                                        | 400                       |
| 19       | Negative - Invalid Data Types      | `password` as a Number                                   | Set `password` = `12345678901` (wrong JSON type)                                             | 400                       |
| 20       | Negative - Invalid Data Types      | `password` below minimum length                          | `password` = 9 characters (min is 10)                                                        | 400                       |
| 21       | Negative - Invalid Data Types      | `password` above maximum length                          | `password` = 73 characters (max is 72)                                                       | 400                       |
| 22       | Negative - Invalid Data Types      | Unrecognized field present                                | Include an extra field not in the schema (e.g. legacy `preferences` object)                  | 400                       |
| 23       | Negative - Cross-Field Validation | Duplicate email — account already exists                 | Sign up with an email that already has a registered account                                  | 400                       |
| 24       | Negative - Cross-Field Validation | Duplicate email — case-insensitive match                 | Sign up with an email matching an existing account but different casing (e.g. `JANE@Example.com`) | 400                       |
| 25       | Negative - Payload Too Large       | Request body exceeds size limit                          | Send a request body larger than the configured 10kb limit (e.g. an oversized `password` value) | 413                       |

## Execution Notes

- Scenarios 23 and 24 require a pre-existing account with a known email — either seed
  one via a prior signup call within the same test run, or via `serial` execution
  mode chaining scenario 1's created account into these later scenarios.
- Scenario 2 depends on scenario 1's response (`token`); these two should run
  serially, with the token passed from the signup response into the follow-up
  `GET /api/auth/me` call, consistent with the "GET Validation Requests" rule for
  data-mutating endpoints in `api-test-scenarios.md`.
- For scenarios 23/24, assert on `error.code` (`ACCOUNT_EXISTS`) in addition to the
  HTTP status, since this API returns a structured `ErrorResponse` body rather than
  a plain string.

