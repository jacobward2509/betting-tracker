# Test Plan — GET /api/markets

**Source:** `apps/api/openapi/fixtures.yaml` (`operationId: getMarkets`)
**Method / Path:** `GET /api/markets`
**Auth:** Required (`security` inherited from the global default — no `security: []` override, unlike `getTodaysFixtures`)

## Scope Notes / Deviations from the Generic Template

Per General Rules ("follow the exact field names and types from the schema", "do not
invent fields or rules not documented"), this plan follows what
`apps/api/openapi/fixtures.yaml` (and the route handler in `apps/api/src/server.ts`, line
1340) actually declares/implements rather than the generic defaults:

- **No request body, path parameters, or query parameters:** This is a parameterless
  `GET` that returns the entire structured market catalog, unfiltered by anything the
  caller supplies. The **Missing Mandatory Data**, **Invalid Data Types**, **Not Found
  (404)**, **Unprocessable Entity (422)**, and **Cross-Field Validation** categories from
  the generic template are all not applicable — there are no fields to omit, mistype, or
  cross-validate, and no resource is looked up by ID.
- **Every request against this endpoint is identical** (no parameters to vary), so unlike
  endpoints with query/path parameters, there is only ever **one distinct Accepted
  request** possible here. Rather than splitting that single request across several
  scenario rows purely to separate out different assertions on the same response (schema
  shape, ordering, field-correlation), this plan bundles all of those assertions into one
  Accepted scenario — mirroring how `test-plan-get-user-config.md`'s Scenario 1 bundles
  several assertions on one response into a single row.
- **No Authentication (401) is the only negative category for this endpoint,** mirroring
  `test-plan-get-current-user.md`/`test-plan-get-user-config.md`. Per `requireAuth`, any
  request without a valid, unexpired bearer session token returns `401`.
- **The `401` response body deviates from the shared `ErrorResponse` schema by design.**
  `apps/api/openapi/fixtures.yaml` documents `401` on this endpoint via just a bare
  `description` (no explicit content schema), but `requireAuth` returns the same flat
  `{ error: "<string>" }` body used everywhere else in this API (see the
  `PlainUnauthorized` deviation note in `test-plan-get-current-user.md`) — this plan
  asserts that actual, literal shape.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as every other plan in this suite — there is no documented, deterministic way
  to trigger a `500` purely from client input.
- **This is a black-box test of whatever catalog data is actually seeded — no direct DB
  seeding/manufacturing by the suite itself.** The catalog is populated out-of-band by the
  idempotent `scripts/seed-markets.ts` upsert script (run once per environment, not by
  this test suite), mirroring the "no fixture seeding" approach already used by
  `test-plan-get-todays-fixtures.md`/`test-plan-get-fixtures-for-date.md`. Coverage
  instead calls the endpoint as it stands in whatever environment it runs against, and
  asserts on whatever it actually returns — an empty array would still be schema-valid,
  though in practice every environment running `seed-markets.ts` has a non-empty catalog.
- **The `requiresPlayer` ⇔ `category` correlation is asserted as a data-consistency
  check**, not merely a schema-shape check: per `seed-markets.ts`, every seeded market with
  `requiresPlayer: true` has `category: 'PLAYER'` and vice versa (`requiresPlayer: false`
  always pairs with `category: 'MATCH'`) — this is a genuine invariant of the seeded data,
  not something the OpenAPI schema itself can express structurally.
- **No GET read-back / mutating-endpoint pairing:** This endpoint has no corresponding
  write endpoint in the public API (the catalog is seeded via a standalone script, not an
  API call), so the "Validate via GET request" pattern used by `signup`/`login` does not
  apply here.
- **The actual `200` response body includes fields the documented `Market` /
  `MarketSelection` / `MarketLine` schemas omit**, because the route handler's Prisma
  query returns full model rows rather than an explicitly-shaped DTO: every `Market` item
  also has `createdAt`, and every nested `MarketSelection`/`MarketLine` item also has its
  own `marketId` FK back to the parent market. This plan follows the same "assert the
  actual, literal shape" convention already used for the flat `401` error bodies
  throughout this suite — the schema-assertion helper validates the real response
  (including these extra fields), not the narrower documented schema.

## Response Reference

| Status | Meaning                                                                                  |
| ------ | ----------------------------------------------------------------------------------------- |
| 200    | Returned successfully; body is `Market[]`, ordered by `sortOrder` ascending               |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`           |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)              |

## Scenarios

| Scenario | Scenario Type                | Use Case                                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                       | HTTP Return Status Code |
| -------- | ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1        | Accepted                      | Valid request returns the full structured market catalog | Call `GET /api/markets` with a valid bearer token. Assert `200` and the full `Market[]` schema (each item has `id`, `name`, `category` — one of `MATCH`/`PLAYER`, `requiresPlayer`, `sortOrder`, `selections[]` each with `id`/`label`/`sortOrder`, and `lines[]` each with `id`/`value`/`sortOrder`). Additionally assert: the top-level array is ordered by `sortOrder` ascending; each market's own `selections` and `lines` are each individually ordered by their own `sortOrder` ascending; and every market's `requiresPlayer` correlates with its `category` (`requiresPlayer: true` ⇔ `category: "PLAYER"`, `requiresPlayer: false` ⇔ `category: "MATCH"`) | 200                       |
| 2        | Negative - No Authentication  | Missing `Authorization` header                            | Send the request with no `Authorization` header at all; assert `401` and the literal response body `{ error: "Unauthorized" }`                                                                                                                                                                                                                                                                                                     | 401                       |

## Execution Notes

- Scenario 1 requires a pre-existing, known-good account with a known token — seed one
  via `POST /api/auth/signup` (reuse the `randomSignupEmail()` / `maximumSignupBody()`
  seed-data helpers already used by the `auth`/`user-config`/`fixtures` specs) and use the
  returned `token` to call `GET /api/markets`. Clean up via the existing `deleteAccount()`
  helper (`support/functions/auth-cleanup.ts`), scoped with a matching
  `beforeEach`/`afterEach` pair, per the existing pattern.
- Scenario 2 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`), and assert both the `401` status and the
  literal response body `{ error: "Unauthorized" }`.
- **No market data is seeded, cleaned up, or otherwise manufactured by this suite.** Every
  scenario calls the live endpoint as-is against whatever the `scripts/seed-markets.ts`
  script has already populated in the target environment.
- Add a schema-assertion helper (e.g.
  `support/endpoint-schema-assertions/markets/get-markets.ts`, exporting
  `assertMarketsSchema(body)`), following the existing AJV-based pattern in
  `support/endpoint-schema-assertions/fixtures/get-todays-fixtures.ts` — compiling a JSON
  Schema for the `Market` object (mirroring `components.schemas.Market`,
  `MarketSelection`, and `MarketLine` in `apps/api/openapi/fixtures.yaml`, including the
  `category` enum `[MATCH, PLAYER]`). The `sortOrder`-ordering and
  `requiresPlayer`/`category` correlation checks for Scenario 1 should be plain
  `expect()` assertions in the spec file (not part of the static AJV schema, which cannot
  express ordering or cross-field correlation rules).
