# Test Plan — PUT /api/user/config

**Source:** `apps/api/openapi/user-config.yaml` (`operationId: updateUserConfig`)
**Method / Path:** `PUT /api/user/config`
**Auth:** Required (`security: [bearerAuth]`)

## Scope Notes / Deviations from the Generic Template

This endpoint's documented contract differs from the generic scenario template in a
few deliberate ways. Per General Rules ("follow the exact field names and types from
the schema", "do not invent fields or rules not documented"), this plan follows what
`apps/api/openapi/user-config.yaml` (and the route handler / `updateUserConfigRequestSchema`
in `apps/api/src/validation.ts` / `apps/api/src/server.ts`) actually declares rather than
the generic defaults:

- **No path or query parameters.** All input arrives via the request body, scoped
  entirely to the authenticated caller (`req.user.id`) — there is no resource identifier
  to parameterize, so **Not Found (404)** does not apply.
- **Every request field is optional and nullable** — a client may update just one
  preference at a time, and any field omitted (or explicitly `null`) is left unchanged.
  Per the "Optional Fields" rule, this plan does **not** generate "missing field" or
  "field is NULL" negative scenarios for any of the four fields (both are valid,
  no-op-for-that-field requests) — negative coverage for optional fields is limited to
  invalid *type*/format/membership violations. Consequently the **Missing Mandatory
  Data** category is not applicable to this endpoint at all (there are no mandatory
  fields).
- **This API always returns `400`, never `422`, for validation-shaped rejections** —
  consistent with every other endpoint in this suite (`signup`, `login`). Both
  request-shape validation (Zod, `.strict()`) and business-logic membership checks
  (bookmaker/bet-type not in the tracked lookup tables, default not among the enabled
  set) surface as `400 VALIDATION_ERROR` with an `ErrorResponse` body — there is no
  distinct **Unprocessable Entity (422)** category for this endpoint.
- **`enabledBookmakers` fully replaces, not merges, the previous set** when provided —
  covered as a dedicated Accepted scenario, since this is a documented, easily
  overlooked behavior (a client sending a partial list will *shrink* their enabled set,
  not add to it).
- **Duplicate entries within `enabledBookmakers` are silently de-duplicated** (see
  `sanitizeUniqueStrings` in `server.ts`) rather than rejected — this is valid Accepted
  behavior, not a negative scenario.
- **`defaultBookmaker` auto-resets when no longer enabled.** If a `PUT` narrows
  `enabledBookmakers` such that the *previous* `defaultBookmaker` is no longer in the
  set, and the same request doesn't supply a new `defaultBookmaker`, the server falls
  back to the first (alphabetically) enabled bookmaker rather than leaving a stale/invalid
  default — covered as an Accepted scenario.
- **The `401` response body deviates from the shared `ErrorResponse` schema by design**,
  identically to `getUserConfig` — `{ error: "<string>" }`, not the nested
  `{ code, message, fields? }` object.
- **Service Unavailable (503) and Internal Server Error (500):** Documented but **not
  included as runnable scenarios**, for the same reason as `getUserConfig` — no
  deterministic, client-side way to trigger either purely from request input.
- **Data-mutating endpoint — GET read-back is required.** Per the "GET Validation
  Requests" rule in `api-test-scenarios.md`, this plan includes an Accepted scenario
  that performs a follow-up `GET /api/user/config` after the write to confirm the
  mutated fields actually persisted, not merely that the `PUT` call returned `200`.

## Request Schema Reference (`UpdateUserConfigRequest`)

| Field             | Type              | Required | Constraints                                                                                  |
| ------------------ | ----------------- | -------- | ----------------------------------------------------------------------------------------------- |
| enabledBookmakers | `Bookmaker[]`, nullable | No | `minItems: 1` when provided; every entry must be a tracked bookmaker; fully replaces the previous set |
| defaultBookmaker  | `Bookmaker`, nullable   | No | Must be one of the (possibly just-updated) enabled bookmakers                                |
| defaultBetType    | string, nullable        | No | `minLength: 1`; must be one of the tracked bet types (`BetTypes` table)                       |
| defaultStake      | number, nullable        | No | `exclusiveMinimum: 0`, `maximum: 10000`                                                       |

`additionalProperties: false` — unrecognized fields are rejected.

`Bookmaker` enum (7 values): `Bet365`, `Betfair`, `BetUK`, `Ladbrokes`, `PaddyPower`,
`SkyBet`, `WilliamHill`.

`BetTypes` table (as currently seeded): `Accumulator`, `Bet Builder`, `Player Prop`,
`Superboost`, `FT Result`, `Other`.

## Response Reference

| Status | Meaning                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| 200    | Updated successfully; body is `UserConfigResponse`, same shape as `GET /api/user/config`                    |
| 400    | Validation failure — invalid/empty `enabledBookmakers`, an unrecognized `defaultBookmaker`/`defaultBetType`, a `defaultBookmaker` not among the enabled set, an out-of-range `defaultStake`, or an unrecognized extra field |
| 401    | Missing, invalid, or expired session token; body is `{ error: "Unauthorized" }`                             |
| 503    | User-config Prisma models not yet migrated in (not covered — no deterministic client-side trigger)         |
| 500    | Unexpected server error (not covered — no deterministic client-side trigger)                                |

## Scenarios

| Scenario | Scenario Type | Use Case | Description | HTTP Return Status Code |
| -------- | -------------- | -------- | ----------- | ------------------------ |
| 1  | Accepted | Valid request with all fields | Call `PUT /api/user/config` with a valid bearer token and a body setting all four fields (`enabledBookmakers` to a 3-bookmaker subset, `defaultBookmaker` to one of them, `defaultBetType` to a tracked bet type, `defaultStake` to a valid value); assert `200` and full `UserConfigResponse` schema reflecting the new values | 200 |
| 2  | Accepted | Validate update via GET request | Immediately after Scenario 1's write, call `GET /api/user/config` with the same token; assert `200` and that `enabledBookmakers`, `defaults.bookmaker`, `defaults.betType`, and `defaults.stake` all match the values sent/returned by Scenario 1 | 200 |
| 3  | Accepted | Valid request with an empty body | Call `PUT /api/user/config` with body `{}`; assert `200` and that every field in the response is unchanged from the account's config immediately beforehand (fetched via a preceding `GET`) | 200 |
| 4  | Accepted | Update only `defaultStake` (single-field partial update) | Call `PUT /api/user/config` with body `{ "defaultStake": 25 }` only; assert `200`, `defaults.stake === 25`, and that `enabledBookmakers`/`defaults.bookmaker`/`defaults.betType` are unchanged from beforehand | 200 |
| 5  | Accepted | `enabledBookmakers` fully replaces the previous set | Seed a config with `enabledBookmakers` containing 5 bookmakers, then call `PUT` with `enabledBookmakers` containing 2 different bookmakers; assert `200` and that `enabledBookmakers` in the response contains exactly those 2 (not a union of old + new) | 200 |
| 6  | Accepted | Duplicate entries in `enabledBookmakers` are de-duplicated | Call `PUT` with `enabledBookmakers` containing the same valid bookmaker twice; assert `200` and that the response's `enabledBookmakers` contains that bookmaker only once | 200 |
| 7  | Accepted | `defaultBookmaker` auto-resets when no longer enabled | Set `defaultBookmaker` to `Bet365` with `enabledBookmakers` including `Bet365`, then call a second `PUT` narrowing `enabledBookmakers` to a set excluding `Bet365` without supplying a new `defaultBookmaker`; assert `200` and that `defaults.bookmaker` is now one of the newly-enabled bookmakers (not `Bet365`) | 200 |
| 8  | Negative - Invalid Data Types | `enabledBookmakers` as an Object | Set `enabledBookmakers` = `{}` | 400 |
| 9  | Negative - Invalid Data Types | `enabledBookmakers` as an Empty Array | Set `enabledBookmakers` = `[]` | 400 |
| 10 | Negative - Invalid Data Types | `enabledBookmakers` containing an untracked value | Set `enabledBookmakers` = `["NotARealBookmaker"]` | 400 |
| 11 | Negative - Invalid Data Types | `enabledBookmakers` element wrong casing | Set `enabledBookmakers` = `["bet365"]` (lowercase, not a tracked enum value) | 400 |
| 12 | Negative - Invalid Data Types | `defaultBookmaker` as a Number | Set `defaultBookmaker` = `123` | 400 |
| 13 | Negative - Invalid Data Types | `defaultBookmaker` as an Empty String | Set `defaultBookmaker` = `""` | 400 |
| 14 | Negative - Invalid Data Types | Invalid `defaultBookmaker` value | Set `defaultBookmaker` = `"NotARealBookmaker"` (not in the tracked-bookmaker list) | 400 |
| 15 | Negative - Invalid Data Types | `defaultBetType` as a Number | Set `defaultBetType` = `123` | 400 |
| 16 | Negative - Invalid Data Types | `defaultBetType` as an Empty String | Set `defaultBetType` = `""` | 400 |
| 17 | Negative - Invalid Data Types | Invalid `defaultBetType` value | Set `defaultBetType` = `"NotARealBetType"` (not in the `BetTypes` table) | 400 |
| 18 | Negative - Invalid Data Types | `defaultStake` as an Alpha String | Set `defaultStake` = `"abc"` | 400 |
| 19 | Negative - Invalid Data Types | `defaultStake` as a Multi-Decimal | Set `defaultStake` = `10.1.1` | 400 |
| 20 | Negative - Invalid Data Types | `defaultStake` at zero | Set `defaultStake` = `0` (violates `exclusiveMinimum: 0`) | 400 |
| 21 | Negative - Invalid Data Types | `defaultStake` negative | Set `defaultStake` = `-5` | 400 |
| 22 | Negative - Invalid Data Types | `defaultStake` above maximum | Set `defaultStake` = `10001` (max is `10000`) | 400 |
| 23 | Negative - Invalid Data Types | Unrecognized field present | Include an extra field not in the schema (e.g. `notch: true`) | 400 |
| 24 | Negative - No Authentication | Missing `Authorization` header | Send the request with no `Authorization` header at all | 401 |
| 25 | Negative - Cross-Field Validation | `defaultBookmaker` not among the (possibly just-updated) `enabledBookmakers` | Call `PUT` with both fields set in the same request, where `defaultBookmaker` is a valid tracked bookmaker but is excluded from the supplied `enabledBookmakers` list | 400 |
| 26 | Negative - Cross-Field Validation | `defaultBookmaker` not among the currently-enabled set (no `enabledBookmakers` in this request) | With a config already narrowed to a subset of bookmakers, call `PUT` supplying only a `defaultBookmaker` that is a valid tracked bookmaker but is not part of the current enabled set | 400 |

## Execution Notes

- Every scenario requires a pre-existing, known-good account with a known token — seed
  one via `POST /api/auth/signup` (reuse `randomSignupEmail()` / `maximumSignupBody()`)
  and use the returned `token` for the `PUT`/`GET` calls. Clean up via `deleteAccount()`
  (`support/functions/auth-cleanup.ts`) in a matching `afterEach`, per-scenario, mirroring
  the `getUserConfig` suite's pattern.
- Scenarios 1 and 2 should run **serially** against the same seeded account, with the
  `PUT` response passed into the follow-up `GET` assertion, per the "GET Validation
  Requests" rule — mirroring the `signup`/`login` read-back pairs already in
  `auth-endpoints-v2.spec.ts`.
- Scenarios 3, 4, 5, 6, and 7 each need a preceding `PUT`/`GET` call to establish a known
  starting config before asserting the change (or non-change); use the fresh account's
  auto-provisioned defaults (all 7 bookmakers enabled, `Player Prop`/`5`) as the known
  starting point rather than assuming any other implicit state.
- Reuse the `assertUserConfigSchema` schema-assertion helper already added at
  `support/endpoint-schema-assertions/user-config/get-user-config.ts` for every `200`
  scenario — it validates the same `UserConfigResponse` shape returned by both `GET` and
  `PUT`. Consider renaming/re-exporting it (or adding a thin alias) if a
  `PUT`-specific name is preferred for readability in this suite; no schema changes are
  needed since the response shape is identical.
- Scenario 24 needs no seeded account — call the endpoint with `noAuth: true` and no
  `Authorization` header, asserting the literal body `{ error: "Unauthorized" }`, per
  the same `PlainUnauthorized` pattern used by `getUserConfig`.
- For scenarios 8-23 and 25-26, assert on `error.code` (`VALIDATION_ERROR`) and the
  field-level `error.fields` entries where applicable, in addition to the HTTP status,
  since this API returns a structured `ErrorResponse` body for `400`s (not a plain
  string) — reuse `assertErrorResponseSchema` from
  `support/endpoint-schema-assertions/auth/signup.ts` if a shared error-schema helper is
  preferred over a duplicate in a new `user-config` module.
- Always reset the request body in `test.beforeEach` for this describe block, per the
  "Always Reset requestBody in beforeEach" rule in `playwright-api-test-generation.md`.



