# Test Plan — GET /api/user/config

**Source:** `apps/api/openapi/user-config.yaml` (`operationId: getUserConfig`)
**Method / Path:** `GET /api/user/config`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways. Per General Rules ("follow the exact field names and types from
the schema", "do not invent fields or rules not documented"), this plan follows what
`apps/api/openapi/user-config.yaml` (and the route handler / `ensureUserBetConfig` in
`apps/api/src/server.ts`) actually declares rather than the generic defaults:

- **No request body, path parameters, or query parameters:** This is a parameterless
  `GET`, scoped entirely to the authenticated caller (`req.user.id`) — there is no
  resource identifier to parameterize. The **Missing Mandatory Data**, **Invalid Data
  Types**, **Not Found (404)**, **Unprocessable Entity (422)**, and **Cross-Field
  Validation** categories from the generic template are all not applicable — there are
  no fields to omit, mistype, or cross-validate, and no resource is looked up by ID.
- **No Authentication (401) is the only negative category for this endpoint,** mirroring
  `test-plan-get-current-user.md`. Per `requireAuth`, any request without a valid,
  unexpired bearer session token returns `401`.
- **The `401` response body deviates from the shared `ErrorResponse` schema by design.**
  `apps/api/openapi/user-config.yaml` documents `401` via the same `PlainUnauthorized`
  response used by `auth.yaml`/`fixtures.yaml` — `{ error: "<string>" }`, not the nested
  `{ code, message, fields? }` object — matching what `requireAuth` actually returns for
  every auth-failure path across every endpoint that uses it. This plan asserts that
  actual, documented shape.
- **Service Unavailable (503):** Documented (returned when the Prisma user-config models
  haven't been migrated in yet — see `supportsUserConfigModels()` in `server.ts`), but
  **not included as a runnable scenario.** There is no deterministic, client-side way to
  put a fully-migrated test environment into this state without directly manipulating
  the database/schema out-of-band, which is out of scope for black-box API testing of
  this endpoint (same treatment `500` is given below).
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as every other plan in this suite — there is no documented, deterministic way
  to trigger a `500` purely from client input.
- **First-call auto-provisioning is explicitly covered as an Accepted scenario.**
  `ensureUserBetConfig` creates a preference row with platform defaults
  (`betType: "Player Prop"`, `stake: 5`, every tracked bookmaker enabled) the first time
  a given user calls this endpoint (or signs up), rather than requiring the client to
  have called `PUT /api/user/config` first — this bootstrap behavior is a documented,
  deterministic contract worth asserting directly rather than only incidentally
  exercising it as setup for other tests.
- **No GET read-back scenario:** This endpoint IS the natural read-back target for a
  future `updateUserConfig` (`PUT /api/user/config`) test plan (mirroring how
  `getCurrentUser` serves that role for `signup`/`login`), so a dedicated Accepted
  scenario here still exercises the endpoint directly rather than only as a side-effect
  of another suite.

## Response Reference

| Status | Meaning                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------- |
| 200    | Returned successfully; body is `UserConfigResponse` — `{ bookmakers[], enabledBookmakers[], defaults }` |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`                       |
| 503    | User-config Prisma models not yet migrated in (not covered — no deterministic client-side trigger)    |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)                          |

## Response Schema Reference (`UserConfigResponse`)

| Field                  | Type                          | Notes                                                                                     |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| bookmakers              | `BookmakerAvailability[]`      | Every tracked bookmaker (7 total), each with an `enabled` boolean for the current user       |
| bookmakers[].bookmaker  | `Bookmaker` enum               | One of `Bet365`, `Betfair`, `BetUK`, `Ladbrokes`, `PaddyPower`, `SkyBet`, `WilliamHill`       |
| bookmakers[].enabled    | boolean                       |                                                                                               |
| enabledBookmakers       | `Bookmaker[]`                  | Flattened list of just the enabled bookmakers (subset of `bookmakers`)                       |
| defaults.bookmaker      | `Bookmaker` enum, nullable     | Null only if the user has zero enabled bookmakers (prevented elsewhere in normal operation)  |
| defaults.betType        | string                        | Free-form (from the `BetTypes` table); defaults to `"Player Prop"` if never set              |
| defaults.stake          | number                        | Defaults to `5` if never set; documented range `0.01`–`10000`                                |

## Scenarios

| Scenario | Scenario Type                | Use Case                                                        | Description                                                                                                                                                                                                                          | HTTP Return Status Code |
| -------- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1        | Accepted                      | Valid request returns the current user's config                    | Call `GET /api/user/config` with a valid bearer token; assert `200` and the full `UserConfigResponse` schema — `bookmakers` contains exactly the 7 tracked bookmakers each with a boolean `enabled`, `enabledBookmakers` is a subset of `bookmakers` filtered by `enabled: true`, `defaults.bookmaker` is either `null` or one of `enabledBookmakers`, `defaults.betType` is a non-empty string, and `defaults.stake` is a positive number `<= 10000` | 200                       |
| 2        | Accepted                      | First call for a brand-new user auto-provisions platform defaults  | Sign up a brand-new account (never having called `PUT /api/user/config`) and immediately call `GET /api/user/config` with its token; assert `200`, `defaults.betType === "Player Prop"`, `defaults.stake === 5`, all 7 tracked bookmakers present in `bookmakers` with `enabled: true`, and `enabledBookmakers` containing all 7 — proving `ensureUserBetConfig`'s bootstrap-on-first-call contract                                          | 200                       |
| 3        | Negative - No Authentication  | Missing `Authorization` header                                     | Send the request with no `Authorization` header at all; assert `401` and the literal response body `{ error: "Unauthorized" }`                                                                                                     | 401                       |

## Execution Notes

- Scenarios 1 and 2 each require a pre-existing, known-good account with a known
  token — seed one via `POST /api/auth/signup` (reuse the `randomSignupEmail()` /
  `maximumSignupBody()` seed-data helpers already used by the `auth` specs) and use the
  returned `token` to call `GET /api/user/config`.
- Clean up each seeded account afterwards via the existing `deleteAccount()` helper
  (`support/functions/auth-cleanup.ts`), scoped with a matching `beforeEach`/`afterEach`
  pair per scenario — the canonical cleanup pattern already used by the `auth` and
  `getCurrentUser` suites.
- Scenario 2 must use a **freshly signed-up account never previously touched** by either
  `GET` or `PUT /api/user/config`, so the "first call" bootstrap path in
  `ensureUserBetConfig` is genuinely exercised rather than reading back an
  already-provisioned row.
- Add a schema-assertion helper (e.g.
  `support/endpoint-schema-assertions/user-config/get-user-config.ts`, exporting
  `assertUserConfigSchema(body)`), following the existing AJV-based pattern in
  `support/endpoint-schema-assertions/fixtures/get-todays-fixtures.ts` — compiling a
  JSON Schema for `UserConfigResponse` (mirroring `components.schemas.UserConfigResponse`
  in `apps/api/openapi/user-config.yaml`, including the 7-value `Bookmaker` enum and the
  nullable `defaults.bookmaker`).
- Scenario 3 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`), and assert both the `401` status and the
  literal response body `{ error: "Unauthorized" }`.
