# UI Test Plan — AnimatedFixturesBanner

## Page Information

- **Component:** `AnimatedFixturesBanner.vue` — not a routed page itself, but a shared
  component rendered identically on two routes: `/sign-in` (`SignInView.vue`) and
  `/sign-up` (`SignUpView.vue`).
- **URL Patterns:** `/sign-in`, `/sign-up`
- **Description:** A fixed-to-viewport-bottom, horizontally auto-scrolling ("marquee")
  banner showing today's cached football fixtures (league, matchup, local kickoff time)
  across the 11 tracked competitions, fetched from `GET /api/fixtures/today` on mount.
  Per product requirement, the banner shows **only** actual fixtures for the current day
  — there are no placeholders, loading states, or "no fixtures today" messages. When the
  API returns an empty array (or the request fails), the component renders **no DOM at
  all** (`v-if="fixtures.length > 0"` on the root element), not an empty/hidden
  container.
- **How Reached:** Automatically rendered on page load of `/sign-in` or `/sign-up` — no
  user interaction is required to trigger it.

## Elements Under Test

| Element | Locator | Notes |
| --- | --- | --- |
| Fixtures banner container | `getByTestId('fixtures-banner')` | Root element of the component. Present in the DOM only when `fixtures.length > 0` after the `GET /api/fixtures/today` call resolves; **absent from the DOM entirely** (not merely hidden) when the array is empty or the request fails. Fixed to the bottom of the viewport (`fixed inset-x-0 bottom-0`). |
| Fixture row | `getByTestId('fixture-row')` | One per rendered fixture entry, repeated for every item in `fixtures`. Rendered **twice** per fixture (two `v-for` passes keyed `${pass}-${fixture.id}`) so the CSS `translateX(-50%)` marquee animation loops seamlessly — every fixture therefore has two matching `fixture-row` elements in the DOM at any given time (see Scenario 5). |
| Fixture league badge | `getByTestId('fixture-league-badge')` | Pill-styled label within a `fixture-row`, showing the human-readable league name (e.g. `Premier League`, `EFL Cup`) via `formatLeagueLabel()`. |
| Fixture matchup text | `getByTestId('fixture-matchup')` | Within a `fixture-row`, reads `{homeTeam} v {awayTeam}`, e.g. `Crystal Palace v Manchester City`. |
| Fixture kickoff time text | `getByTestId('fixture-kickoff-time')` | Within a `fixture-row`, browser-local time, formatted via `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` from the UTC `kickoffAt` value. |
| Marquee track | `.fixtures-marquee` (internal container, not a `data-test-id`) | Wraps all `fixture-row` elements (both passes). Out of scope to assert the animation itself (see Out of Scope). |

## Test Coverage Summary

**Total Scenarios: 5**

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Banner renders fixture content correctly when fixtures are returned | Mock `GET /api/fixtures/today` to return a fixed set of fixtures spanning at least two different `league` values. Navigate to `/sign-in`. Verify the `fixtures-banner` container is visible, and that each mocked fixture has a corresponding `fixture-row` containing a `fixture-league-badge` (correct human-readable label), `fixture-matchup` (`{homeTeam} v {awayTeam}`), and a non-empty `fixture-kickoff-time` | `fixtures-banner` is visible; every mocked fixture's `fixture-league-badge`, `fixture-matchup`, and `fixture-kickoff-time` are present and correctly matched to that fixture |
| 2 | Cosmetic | Banner is absent from the DOM when no fixtures are returned | Mock `GET /api/fixtures/today` to return `[]`. Navigate to `/sign-in`. Verify the `fixtures-banner` container has zero elements in the DOM (not merely hidden) | `fixtures-banner` has a DOM count of `0`; no placeholder text or empty container is rendered anywhere on the page |
| 3 | Functional | Banner degrades gracefully when the fixtures request fails | Mock `GET /api/fixtures/today` to return a `500` error (or abort the request). Navigate to `/sign-in`. Verify the `fixtures-banner` container has zero elements in the DOM, and that the sign-in form remains fully visible and usable (email input, password input, submit button all visible and enabled) | `fixtures-banner` has a DOM count of `0`; no error message is surfaced to the user; the auth form is unaffected and fully usable |
| 4 | Cosmetic | Banner renders identically on the sign-up page | Mock `GET /api/fixtures/today` to return the same fixed set of fixtures as Scenario 1. Navigate to `/sign-up`. Verify the `fixtures-banner` container is visible with the same `fixture-league-badge`, `fixture-matchup`, and `fixture-kickoff-time` content as Scenario 1 | `fixtures-banner` is visible on `/sign-up` with identical fixture content to Scenario 1 |
| 5 | Cosmetic | Each fixture's content is duplicated for the seamless marquee loop | Mock `GET /api/fixtures/today` to return a single fixture. Navigate to `/sign-in`. Verify that fixture's `fixture-row` (and its `fixture-matchup` text) has a DOM count of exactly `2` within the `fixtures-banner` container | `fixture-row` (and `fixture-matchup`) for the mocked fixture each have a count of exactly `2` within `fixtures-banner` |



## Out of Scope

- **The CSS marquee animation itself** (i.e. that `.fixtures-marquee` visually scrolls
  via `translateX`) — Playwright assertions on CSS keyframe animation progress are
  inherently flaky and provide little value here; Scenario 5 covers the underlying
  duplication that makes the loop possible without asserting on the animation.
- **Exact fixture data / competition coverage** (i.e. that real fixtures from the 6
  domestic leagues and 5 cup competitions are actually cached correctly for a given day)
  — that is a backend/data concern covered by
  `playwright/docs/test-plans/api/fixtures/test-plan-get-todays-fixtures.md`. This plan
  only asserts that the component correctly renders whatever `GET /api/fixtures/today`
  returns, using mocked responses rather than live/seeded data.
- **`formatLeagueLabel()`'s mapping table** (i.e. that every one of the 11 `League` enum
  values maps to its expected human-readable string) — a pure frontend utility function,
  better suited to a unit test than a Playwright UI test; not covered here.
- **Sign-in / sign-up form functionality itself** (field validation, submission,
  navigation on success) — covered by
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-login.md` and
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`. Scenario 3 only
  asserts the form remains usable when the banner's own request fails, not the form's
  own behaviour.
- **Timezone-specific kickoff time formatting** (i.e. asserting an exact clock time
  rather than "a kickoff time is present") — `toLocaleTimeString` output depends on the
  test runner's system timezone/locale, so scenarios assert presence/correct association
  with a fixture rather than an exact string match.


## Automation Status

Automated by `support/pages/fixtures-banner.page.ts` (`FixturesBannerPage`), which exposes
`bannerContainer` (`getByTestId('fixtures-banner')`), `fixtureRows`
(`getByTestId('fixture-row')`), helper methods for scoping to a specific fixture's
`fixture-league-badge` / `fixture-matchup` / `fixture-kickoff-time` locators, and mocking
helpers (`mockFixtures()` / `mockFixturesFailure()` via `page.route('**/api/fixtures/today**', ...)`
— the trailing `**` also matches the `tzOffsetMinutes` query param the component now sends)
for the fixed fixture sets used across all five scenarios.

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ✅ Automated | `tests/smoke/fixtures-banner.spec.ts` |
| 2 | ✅ Automated | `tests/smoke/fixtures-banner.spec.ts` |
| 3 | ✅ Automated | `tests/functional/fixtures-banner.spec.ts` |
| 4 | ✅ Automated | `tests/smoke/fixtures-banner.spec.ts` |
| 5 | ✅ Automated | `tests/smoke/fixtures-banner.spec.ts` |

## References

- Application source: `apps/web/src/components/AnimatedFixturesBanner.vue`,
  `apps/web/src/views/SignInView.vue`, `apps/web/src/views/SignUpView.vue`,
  `apps/web/src/utils/league.ts`
- Related API test plan: `playwright/docs/test-plans/api/fixtures/test-plan-get-todays-fixtures.md`
- Related UI test plans (host pages): `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-login.md`,
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`

