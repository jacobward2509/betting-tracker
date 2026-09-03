# Test Plan — GET /api/fixtures/{id}/players

**Source:** `apps/api/openapi/fixtures.yaml` (`operationId: getPlayersForFixture`)
**Method / Path:** `GET /api/fixtures/{id}/players`
**Auth:** Required (`security` inherited from the global default — no `security: []` override, unlike `getTodaysFixtures`)

## Scope Notes / Deviations from the Generic Template

Per General Rules ("follow the exact field names and types from the schema", "do not
invent fields or rules not documented"), this plan follows what
`apps/api/openapi/fixtures.yaml` (and the route handler in `apps/api/src/server.ts`, lines
1667-1704) actually declares/implements rather than the generic defaults:

- **Single required path parameter (`id`, `format: uuid`), no query parameters or
  request body:** The **Missing Mandatory Data**, **Unprocessable Entity (422)**, and
  **Cross-Field Validation** categories from the generic template do not apply — there
  is only one field, it cannot be individually omitted (a request with no `id` segment
  simply doesn't match this route at all, so it never reaches this handler), and the YML
  documents no `422` response for this endpoint.
- **`id` has no format validation anywhere in the request pipeline.** Unlike request
  bodies (validated via `zod` in `apps/api/src/validation.ts`), path parameters are never
  validated for shape — the handler passes `req.params.id` straight into
  `prisma.fixture.findUnique({ where: { id: req.params.id } })`. The `Fixture.id` column
  is also plain Postgres `TEXT` (confirmed in
  `prisma/migrations/20260828140000_add_fixtures_and_league/migration.sql`), not a
  UUID-typed column that would reject malformed input at the DB layer either. Consequently
  **every malformed-`id` variant (non-UUID string, numeric string, wrong length) collapses
  onto the exact same `404 { error: "Fixture not found" }` response as a well-formed but
  non-existent UUID** — there is no `400`/`403` path possible for this field. This plan
  lists each format variant as its own **Negative - Invalid Data Types** scenario per the
  generic template's String rules, but documents the shared `404` outcome explicitly
  rather than inventing a `400`/`403` that the implementation does not produce.
- **The `401`/`404` response bodies are flat `{ error: "<string>" }`, not the nested
  `ErrorResponse` schema documented in the YML** — the same deviation pattern already
  documented for every other endpoint in this codebase (see
  `test-plan-get-current-user.md`'s `PlainUnauthorized` note, and
  `test-plan-get-fixtures-for-date.md`'s equivalent note for `400`).
- **The `players` array items do not match the documented `Player` schema — confirmed
  by running the suite against a live environment.** The handler returns the raw Prisma
  `Player` row as-is (`teamEntries.flatMap(...cachedByTeam.get(team.id)...)`), not a
  trimmed object matching the YML's `{ id, name, teamName, position }` shape. Every
  returned player also includes `sportsDbId`, `teamSportsDbId`, `fetchedAt`, and
  `createdAt` — internal DB columns never stripped before serialization. This plan's
  schema assertion (`assertPlayersForFixtureSchema`) validates the **actual** shape,
  including these extra fields with their real types, rather than enforcing
  `additionalProperties: false` against the aspirational YML schema.
- **Internal Server Error (500):** Not included as a runnable scenario, for the same
  reason as the sibling `fixtures` plans — there is no documented, deterministic way to
  trigger a `500` purely from client input.
- **This is a black-box test against whatever fixture/player data is actually cached —
  no direct DB seeding.** A real fixture `id` is sourced via a preceding
  `GET /api/fixtures` call (today..+7 days) rather than manufactured, mirroring the
  approach in `test-plan-get-fixtures-for-date.md`. `players` may legitimately be an
  empty array (a fixture whose teams have no cached roster yet) — this is a pass, not a
  gap requiring manufactured data.
- **No assertions on the background player-cache reconciliation
  (`reconcilePlayersForTeamInBackground`).** The handler responds with whatever is
  already cached immediately, then — fire-and-forget, after the response has already
  been sent — reconciles against a live TheSportsDB call in the background (skipped
  entirely if the cache is fresher than `PLAYER_CACHE_FRESHNESS_MS`, and any error there
  is swallowed and never surfaced to the client). This is non-deterministic in timing and
  depends on a live third-party API, so it is explicitly out of scope for this suite;
  every scenario asserts only on the immediate, synchronous response body.
- **No GET read-back / mutating-endpoint pairing:** This endpoint has no corresponding
  write endpoint, so the "Validate via GET request" pattern does not apply here.

## Response Reference

| Status | Meaning                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------- |
| 200    | Fixture found; body is `{ homeTeam, awayTeam, players: Player[] }` (`players` may be empty)       |
| 401    | Missing or invalid session; body is `{ error: "Unauthorized" }`                                   |
| 404    | No fixture matches the given `id` (malformed, well-formed-but-unknown, or otherwise); body is `{ error: "Fixture not found" }` |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)                      |

## Scenarios

| Scenario | Scenario Type | Use Case | Description | HTTP Return Status Code |
| -------- | -------------- | -------- | ------------ | ------------------------ |
| 1 | Accepted | Valid request returns the fixture's combined roster | Call `GET /api/fixtures/{id}/players` with a real, currently-cached fixture `id` and a valid bearer token. Assert `200`; `homeTeam`/`awayTeam` match the fixture record; `players` is an array (possibly empty) where every item matches the `Player` schema (`id`, `name`, `teamName`, `position` — string or null); and every `players[].teamName` equals either the returned `homeTeam` or `awayTeam` (proving the "combined roster for both teams only" contract) | 200 |
| 2 | Negative - Invalid Data Types | `id` is a malformed, non-UUID string | Call with `id = "not-a-valid-uuid"` and a valid bearer token. Since no fixture's `id` matches this string, assert `404` and the literal body `{ error: "Fixture not found" }` | 404 |
| 3 | Negative - Invalid Data Types | `id` is a numeric string | Call with `id = "123456"` and a valid bearer token; assert `404` and the same literal body as Scenario 2 | 404 |
| 4 | Negative - Invalid Data Types | `id` is below the standard UUID length | Call with a truncated UUID (e.g. the first 8 characters of a real UUID) and a valid bearer token; assert `404` and the same literal body as Scenario 2 | 404 |
| 5 | Negative - Invalid Data Types | `id` is above the standard UUID length | Call with a well-formed UUID plus trailing extra characters (e.g. `<uuid>-extra`) and a valid bearer token; assert `404` and the same literal body as Scenario 2 | 404 |
| 6 | Negative - No Authentication | Missing `Authorization` header | Call `GET /api/fixtures/{id}/players` (any `id`) with no `Authorization` header at all; assert `401` and the literal body `{ error: "Unauthorized" }` | 401 |
| 7 | Negative - Not Found | Syntactically valid but non-existent UUID | Call with a well-formed UUID (e.g. via `crypto.randomUUID()`) that does not correspond to any row in the `Fixture` table, and a valid bearer token; assert `404` and the same literal body as Scenario 2 — distinct from Scenarios 2-5 in that this exercises the genuine "not found" branch on well-formed input rather than the format-collapse case | 404 |

## Execution Notes

- Every scenario except Scenario 6 requires a pre-existing, known-good account with a
  known token — seed one via `POST /api/auth/signup` (reuse the `randomSignupEmail()` /
  `maximumSignupBody()` seed-data helpers already used by the `auth`/`fixtures` specs)
  and use the returned `token` to call `GET /api/fixtures/{id}/players`. Clean up via the
  existing `deleteAccount()` helper (`support/functions/auth-cleanup.ts`), scoped with a
  matching `beforeEach`/`afterEach` pair, per the existing `getFixturesForDate` pattern.
- Scenario 6 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header (see `apiGet`'s `withAuth()` helper in
  `support/functions/request-methods.ts`).
- **Sourcing a real fixture `id` for Scenario 1:** call
  `GET /api/fixtures?from=<today>&to=<today + 7 days>` (reusing the existing
  `toDateOnly()` helper already used in `fixtures-endpoints-v2.spec.ts`) and take the
  first fixture's `id` from the response. If that range genuinely returns zero cached
  fixtures in the environment under test, `test.skip()` Scenario 1 with a clear reason
  rather than manufacturing a fixture via direct DB writes — this suite is black-box, per
  the Scope Notes above, and must not create backend state through a side channel.
  Scenarios 2-5 and 7 only need *a* valid token, not a real fixture — their `id` values
  are deliberately invented/random.
- No fixture data is seeded or cleaned up for any scenario — every scenario calls the
  live endpoint as-is against whatever the cache actually contains.
- Add a new schema-assertion helper (e.g.
  `support/endpoint-schema-assertions/fixtures/get-players-for-fixture.ts`, exporting
  `assertPlayersForFixtureSchema(body)`), following the existing AJV-based pattern in
  `support/endpoint-schema-assertions/fixtures/get-todays-fixtures.ts` — compiling a JSON
  Schema for the `{ homeTeam, awayTeam, players: Player[] }` response shape (mirroring
  `components.schemas.Player` in `apps/api/openapi/fixtures.yaml`) and validating the
  response body as a whole. Export it from
  `support/endpoint-schema-assertions/fixtures/index.ts` alongside the existing
  `assertFixturesSchema` export.
- The "every player's `teamName` matches `homeTeam`/`awayTeam`" check (Scenario 1) should
  be a plain `expect()` assertion in the spec file, not part of the AJV schema itself
  (AJV cannot express a cross-field equality rule against sibling response fields).
- All `401`/`404` scenarios assert the **literal, flat** response body
  (`{ error: "<string>" }`) rather than the nested `ErrorResponse` schema documented in
  the YML — see the Scope Notes deviation above. Match the exact message strings from
  `apps/api/src/server.ts` (line 1670, and `requireAuth`).



