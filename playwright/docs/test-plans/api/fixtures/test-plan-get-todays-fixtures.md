# Test Plan — GET /api/fixtures/today

**Source:** `apps/api/openapi/fixtures.yaml` (`operationId: getTodaysFixtures`)
**Method / Path:** `GET /api/fixtures/today`
**Auth:** Not required (`security: []`)

## Scope Notes / Deviations from the Generic Template

Per General Rules ("follow the exact field names and types from the schema", "do not
invent fields or rules not documented"), this plan follows what `apps/api/openapi/fixtures.yaml` (and the
route handler in `apps/api/src/server.ts`) actually declares rather than the generic
defaults:

- **Single optional query parameter (`tzOffsetMinutes`), no request body or path
  parameters:** The **Missing Mandatory Data**, **Not Found (404)**, **Unprocessable
  Entity (422)**, and **Cross-Field Validation** categories from the generic template
  are all not applicable — `tzOffsetMinutes` is optional (defaults to `0`/UTC when
  omitted or not a valid number) and there is no resource looked up by ID. **Invalid
  Data Types** is narrowed to a single explicit scenario proving the endpoint actually
  reads `tzOffsetMinutes` to resolve "today" against the caller's local calendar day
  (see Scenario 4), rather than a full invalid-type matrix.
- **No Authentication (401) category does not apply.** This endpoint is deliberately
  `security: []` — it must remain callable with no `Authorization` header at all, since
  it powers the animated fixtures banner on the logged-out sign-in/sign-up pages. This
  plan instead includes an explicit **Accepted** scenario proving it succeeds with no
  auth header, as a regression guard against this endpoint accidentally being wrapped in
  the `requireAuth` middleware later (every other endpoint in this codebase requires
  auth, so this is the one deliberate exception).
- **This is a black-box test of whatever data is actually cached — no seeding.** This
  endpoint has no corresponding write endpoint, and the suite must not manufacture
  backend state via a side-channel (e.g. writing directly to the `Fixture` table via
  Prisma) to force a particular response shape. Coverage instead calls the endpoint as
  it stands in whatever environment it runs against, and asserts on whatever it actually
  returns:
  - An **empty array is a valid, expected response** on days with no tracked fixtures —
    the schema assertion must treat `[]` as passing, not as a failure requiring seeded
    data to avoid.
  - When the array is **non-empty**, every item is validated against the `Fixture`
    schema (correct field types/shapes, `league` is one of the 11 valid enum values,
    `kickoffAt` is a valid ISO date-time, `venue` is a string or `null`), plus a
    same-day check that every returned `kickoffAt` falls within the current UTC day —
    this is what actually proves the "today only" contract, without needing to seed a
    boundary case ourselves.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the `auth` plans — there is no documented, deterministic way to trigger a
  `500` purely from client input.
- **No GET read-back / mutating-endpoint pairing:** This endpoint has no corresponding
  write endpoint in the public API, so the "Validate via GET request" pattern used by
  `signup`/`login` does not apply here.

## Response Reference

| Status | Meaning                                                                                     |
| ------ | -------------------------------------------------------------------------------------------- |
| 200    | Always returned when the query succeeds; body is a `Fixture[]` array, possibly empty         |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)                 |

## Scenarios

| Scenario | Scenario Type | Use Case                                                              | Description                                                                                                                                                                                       | HTTP Return Status Code |
| -------- | -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1        | Accepted       | Returns a valid `Fixture[]` response, empty or populated               | Call `GET /api/fixtures/today` with no seeding/setup. Assert `200`. If the body is `[]`, that is a pass (no tracked competition has a fixture today). If the body is non-empty, assert every item matches the `Fixture` schema (`id`, `league` — one of the 11 documented enum values, `homeTeam`, `awayTeam`, `kickoffAt`, `venue`) and that every `kickoffAt` falls within the current UTC day (`>= start of today`, `< start of tomorrow`) | 200                       |
| 2        | Accepted       | Response is ordered by `kickoffAt` ascending                          | Using the same response as Scenario 1, if the body contains two or more items, assert the array is sorted by `kickoffAt` ascending (each item's `kickoffAt` is `<=` the next item's) — this scenario is a no-op assertion (trivially passes) on days with 0–1 fixtures, since ordering is unobservable with fewer than two items | 200                       |
| 3        | Accepted       | Succeeds with no `Authorization` header (endpoint is unauthenticated) | Call `GET /api/fixtures/today` with no `Authorization` header at all; assert `200` and that the body matches the `Fixture[]` schema (per Scenario 1) — proves this endpoint is reachable pre-login, unlike every other endpoint in this API | 200                       |
| 4        | Invalid Data Types | Resolves "today" against the caller-supplied `tzOffsetMinutes` rather than the server's UTC clock | Call `GET /api/fixtures/today?tzOffsetMinutes=720` (720 = UTC-12, the furthest-behind-UTC real timezone). Assert `200` and the `Fixture[]` schema (per Scenario 1). If non-empty, assert every `kickoffAt` falls within the calendar day computed by shifting "now" back 720 minutes before truncating to a day — not the plain UTC day used by Scenario 1 — proving the endpoint actually reads and applies the parameter rather than silently ignoring it | 200                       |

## Execution Notes

- **No test data is seeded or cleaned up.** Every scenario calls the live endpoint
  as-is and asserts on whatever the current cache actually contains — do not add any
  Prisma-based seeding/cleanup helpers for this suite. If the cache happens to be empty
  when the suite runs, Scenario 1's "empty array is a pass" branch covers that case
  correctly rather than treating it as a gap to fill with manufactured data.
- Add a schema-assertion helper (e.g.
  `support/endpoint-schema-assertions/fixtures/get-todays-fixtures.ts`, exporting
  `assertFixturesSchema(body)`), following the existing AJV-based pattern in
  `support/endpoint-schema-assertions/auth/signup.ts` — compiling a JSON Schema for the
  `Fixture` object (mirroring `components.schemas.Fixture` in `apps/api/openapi/fixtures.yaml`, including
  the 11-value `league` enum) and validating the response body is an array where every
  item passes that schema. This same helper covers the `[]` case automatically (an empty
  array trivially satisfies an `items` schema with no items to check).
- The same-day `kickoffAt` boundary check (today-only, per Scenario 1) and the ordering
  check (Scenario 2) should be plain `expect()` assertions in the spec file computed
  against `new Date()` at test-run time, not part of the AJV schema itself (AJV cannot
  express "must equal today's date" as a static schema rule).
- Scenario 3 needs no seeded account/token at all — call the endpoint with `noAuth: true`
  and no `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`).

