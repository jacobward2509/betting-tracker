# Test Plan — GET /api/fixtures

**Source:** `apps/api/openapi/fixtures.yaml` (`operationId: getFixturesForDate`)
**Method / Path:** `GET /api/fixtures`
**Auth:** Required (`security` inherited from the global default — no `security: []` override, unlike `getTodaysFixtures`)

## Scope Notes / Deviations from the Generic Template

Per General Rules ("follow the exact field names and types from the schema", "do not
invent fields or rules not documented"), this plan follows what
`apps/api/openapi/fixtures.yaml` (and the route handler in `apps/api/src/server.ts`, lines
1463-1553) actually declares/implements rather than the generic defaults:

- **Three optional query parameters (`date`, `from`, `to`), no request body or path
  parameters:** The **Missing Mandatory Data** category from the generic template does
  not apply in its usual "remove a required field" sense (none of the three are
  individually `required: true` in the YML) — instead, the handler enforces at runtime
  that *either* `date` *or* both `from`/`to` must resolve to a valid date, which this
  plan covers as "all three omitted" under Missing Mandatory Data and the
  partial-range cases under Invalid Data Types/Cross-Field Validation. **Not Found
  (404)** and **Unprocessable Entity (422)** are not applicable — there is no resource
  looked up by ID, and the YML documents no `404`/`422` response for this endpoint.
- **The documented `400` response schema (`ErrorResponse`, the nested
  `{ error: { code, message, fields? } }` shape) does not match what the handler
  actually returns.** Every `400` branch in `server.ts` (lines 1481, 1484, 1489, 1494,
  1503, 1507) returns a **flat** `{ error: "<string>" }` body — the same deviation
  pattern already documented for `401` responses across this codebase (see
  `test-plan-get-current-user.md`'s `PlainUnauthorized` note). This plan asserts the
  **actual, literal** flat shape and exact message text returned by each branch, not
  the aspirational nested schema.
- **The `401` response has no documented content schema in the YML** (just a bare
  `description`), but `requireAuth` returns the same flat `{ error: "Unauthorized" }`
  body used everywhere else in this API — this plan asserts that actual, literal shape.
- **Business-logic date rules are derived from the handler, not the YML** (the YML's
  prose descriptions summarize but don't enumerate exact status codes/messages):
  `MAX_FIXTURE_LOOKAHEAD_DAYS = 7` (no `date`, and no `to`, may be more than 7 days
  ahead of today), `MAX_FIXTURE_RANGE_DAYS = 14` (inclusive span between `from`/`to`
  cannot exceed 14 days), `to` must not be before `from`, and supplying either `from`
  or `to` switches the endpoint into range mode and **ignores `date` entirely** (per
  the YML description: "If any of `from`/`to` is supplied, the range form is used and
  `date` is ignored").
- **This is a black-box test of whatever fixture data is actually cached — no direct
  DB seeding**, mirroring `test-plan-get-todays-fixtures.md`. An **empty array is a
  valid, expected response** for any date/range with no tracked-competition fixtures —
  the schema assertion must treat `[]` as passing, not as a gap requiring manufactured
  data. When non-empty, every item is validated against the `Fixture` schema and that
  its `kickoffAt` falls within the requested date/range window.
- **No dedicated "on-demand cache fill for a never-before-seen past date" scenario.**
  Deliberately excluded: a fixed historical date only genuinely exercises
  `ensurePastDateCached`'s live-fetch path once (every subsequent run against the same
  environment would just read back the now-cached row), while a randomized date per run
  would add a live, rate-limited dependency on TheSportsDB to the suite and a source of
  flakiness — neither trade-off is worth it for this plan.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as every other plan in this suite — there is no documented, deterministic way
  to trigger a `500` purely from client input.
- **No GET read-back scenario:** This is itself a read-only `GET` with no corresponding
  write endpoint, so the "validate write via GET" pattern does not apply here.

## Response Reference

| Status | Meaning                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| 200    | Cached fixtures for the given `date`/range (may be `[]`); body is a `Fixture[]` array                          |
| 400    | Missing/invalid `date(s)`, a `to` before `from`, a range spanning >14 days, or a date/`to` >7 days in the future; body is the literal flat `{ error: "<string>" }` (not the nested `ErrorResponse` schema documented in the YML) |
| 401    | Missing or invalid session; body is the literal `{ error: "Unauthorized" }`                                   |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)                                   |

## Scenarios

| Scenario | Scenario Type | Use Case | Description | HTTP Return Status Code |
| -------- | -------------- | -------- | ------------ | ------------------------ |
| 1 | Accepted | Valid request with a single `date` query parameter | Call `GET /api/fixtures?date=<YYYY-MM-DD>` (a date within today..+7 days) with a valid bearer token; assert `200`, the `Fixture[]` schema (reusing `assertFixturesSchema`), and — if non-empty — every returned `kickoffAt` falls within that single UTC calendar day | 200 |
| 2 | Accepted | Valid request with an inclusive `from`/`to` range, ordered by `kickoffAt` ascending | Call `GET /api/fixtures?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>` (a 2-day span within today..+7 days) with a valid bearer token; assert `200`, the `Fixture[]` schema, and — if non-empty — every `kickoffAt` falls within `[from 00:00 UTC, to+1 day 00:00 UTC)`; if the body contains two or more items, also assert the array is sorted by `kickoffAt` ascending (trivially passes/no-op with fewer than two items) | 200 |
| 3 | Accepted | `date` is ignored once `from`/`to` is also supplied | Call `GET /api/fixtures?date=<a date outside the from/to range>&from=<...>&to=<...>` with a valid bearer token; assert `200` and that the response matches the `from`/`to` range response (Scenario 2), proving `date` was ignored rather than used to filter/override the range | 200 |
| 4 | Negative - Missing Mandatory Data | Missing `date`, `from`, and `to` entirely | Call `GET /api/fixtures` with no query parameters at all and a valid bearer token; assert `400` and the literal body `{ error: "A valid date query parameter (YYYY-MM-DD) is required." }` | 400 |
| 5 | Negative - Invalid Data Types | `date` is an empty string | Call `GET /api/fixtures?date=` with a valid bearer token; assert `400` and the same literal body as Scenario 4 | 400 |
| 6 | Negative - Invalid Data Types | `date` has an invalid format | Call `GET /api/fixtures?date=05-09-2026` (wrong field order, not `YYYY-MM-DD`) with a valid bearer token; assert `400` and the same literal body as Scenario 4 | 400 |
| 7 | Negative - Invalid Data Types | `from` supplied without `to` | Call `GET /api/fixtures?from=<YYYY-MM-DD>` (no `to`) with a valid bearer token; assert `400` and the literal body `{ error: "Valid from and to query parameters (YYYY-MM-DD) are required." }` | 400 |
| 8 | Negative - Invalid Data Types | `to` supplied without `from` | Call `GET /api/fixtures?to=<YYYY-MM-DD>` (no `from`) with a valid bearer token; assert `400` and the same literal body as Scenario 7 | 400 |
| 9 | Negative - Invalid Data Types | `from` has an invalid format | Call `GET /api/fixtures?from=05-09-2026&to=<valid YYYY-MM-DD>` with a valid bearer token; assert `400` and the same literal body as Scenario 7 | 400 |
| 10 | Negative - Invalid Data Types | `to` has an invalid format | Call `GET /api/fixtures?from=<valid YYYY-MM-DD>&to=05-09-2026` with a valid bearer token; assert `400` and the same literal body as Scenario 7 | 400 |
| 11 | Negative - No Authentication | Missing `Authorization` header | Send `GET /api/fixtures?date=<valid YYYY-MM-DD>` with no `Authorization` header at all; assert `401` and the literal body `{ error: "Unauthorized" }` | 401 |
| 12 | Negative - Cross-Field Validation | `to` before `from` | Call `GET /api/fixtures?from=<YYYY-MM-DD>&to=<a date before from>` with a valid bearer token; assert `400` and the literal body `{ error: "to must not be before from." }` | 400 |
| 13 | Negative - Cross-Field Validation | `from`/`to` range spans more than 14 days | Call `GET /api/fixtures?from=<YYYY-MM-DD>&to=<from + 15 days>` with a valid bearer token; assert `400` and the literal body `{ error: "The from/to range cannot span more than 14 days." }` | 400 |
| 14 | Negative - Cross-Field Validation | Single `date` more than 7 days in the future | Call `GET /api/fixtures?date=<today + 8 days>` with a valid bearer token; assert `400` and the literal body `{ error: "Bets can only be logged up to 7 days in advance." }` | 400 |
| 15 | Negative - Cross-Field Validation | `to` more than 7 days in the future (range form) | Call `GET /api/fixtures?from=<today + 1 day>&to=<today + 8 days>` with a valid bearer token; assert `400` and the same literal body as Scenario 14 | 400 |


## Execution Notes

- Every scenario except Scenario 11 requires a pre-existing, known-good account with a
  known token — seed one via `POST /api/auth/signup` (reuse the `randomSignupEmail()` /
  `maximumSignupBody()` seed-data helpers already used by the `auth`/`user-config`
  specs) and use the returned `token` to call `GET /api/fixtures`. Clean up via the
  existing `deleteAccount()` helper (`support/functions/auth-cleanup.ts`), scoped with a
  matching `beforeEach`/`afterEach` pair, per-scenario or shared across the describe
  block per the existing `getUserConfig`/`getCurrentUser` pattern.
- Scenario 11 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`).
- **No fixture data is seeded or manufactured for any scenario.** Every scenario calls
  the live endpoint as-is against whatever the cache actually contains for the chosen
  date(s), per the same black-box approach used by `test-plan-get-todays-fixtures.md`.
  Compute all date literals (`today`, `today + N days`) at test-run time relative to
  `new Date()`, never hard-coded, so the suite doesn't rot as calendar time passes.
- Reuse the existing `assertFixturesSchema` helper
  (`support/endpoint-schema-assertions/fixtures/get-todays-fixtures.ts`) for the `200`
  scenarios' schema validation — it already validates the `Fixture[]` shape (including
  the 11-value `league` enum) generically and is not specific to the `/today` endpoint.
  No new schema-assertion file is needed for the `200` responses.
- All `400`/`401` scenarios assert the **literal, flat** response body
  (`{ error: "<string>" }`) rather than the nested `ErrorResponse` schema documented in
  the YML — see the Scope Notes deviation above. Match the exact message strings from
  `apps/api/src/server.ts` (lines 1481, 1484, 1489, 1494, 1503, 1507, and `requireAuth`).

