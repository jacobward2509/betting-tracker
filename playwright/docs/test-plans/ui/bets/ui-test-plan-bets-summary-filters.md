# UI Test Plan — Bets Page Summary Stats & Filters

## Page Information

- **Component:** `BetsView.vue` (routed page), covering only its summary stats bar
  and the `BetsTableControls.vue` filter panel it renders. This is the first of
  several planned UI test plans for `BetsView.vue` — see **Out of Scope** below for
  the remaining sections that will be covered by their own future plans.
- **URL Pattern:** `/bets`
- **Description:** Immediately below the shared `TopBanner` header and `TabNav`
  (see `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md` and
  `ui-test-plan-tab-nav.md` — referenced, not re-documented here), `BetsView.vue`
  renders a summary stats bar showing three derived values computed from the current
  (unfiltered) `bets` list — Total Bets (count), Favourite Bookie (most frequent
  bookmaker, formatted via `formatBookmakerLabel`), and Total P/L (sum of `bet.profit`,
  formatted to 2 decimal places with a sign-dependent text colour: `text-green-700` if
  positive, `text-red-700` if negative, default gray/white if exactly zero). Beneath
  the stats bar, `BetsTableControls.vue` renders a collapsible filter panel: a
  "Filters" toggle button (▶ collapsed / ▼ expanded) showing an "N active" badge and a
  "Clear" button once any filter is set, and — once expanded — six filter controls
  (Season, Fixture, Date, Bookie, Stake Type, Result) that emit `update:filters` to
  `BetsView.vue`, which sanitizes and applies them to the (out-of-scope) bets table.
- **How Reached:** Automatically rendered on navigating to `/bets` (default redirect
  target from `/`), directly beneath the shared header/tab-nav. No interaction is
  required to reach the stats bar; the filter panel body requires clicking the
  "Filters" toggle button to expand.

## Elements Under Test

### Summary Stats Bar (always visible)

| Element | Locator | Notes |
| --- | --- | --- |
| Total Bets container | `getByTestId('bets-total-count')` | Static label "Total Bets" + value |
| Total Bets value | `getByTestId('bets-total-count-value')` | `bets.length`; verified value is data-dependent on seeded bets |
| Favourite Bookie container | `getByTestId('bets-favourite-bookie')` | Static label "Favourite Bookie" + value |
| Favourite Bookie value | `getByTestId('bets-favourite-bookie-value')` | Most frequent `bookmaker` value across `bets`, formatted via `formatBookmakerLabel` (e.g. `PADDYPOWER` → "Paddy Power"); "-" if no bets have a bookmaker set |
| Total P/L container | `getByTestId('bets-total-profit-loss')` | Static label "Total P/L" + value |
| Total P/L value | `getByTestId('bets-total-profit-loss-value')` | Sum of `bet.profit` across all bets, formatted as `£ {value.toFixed(2)}`; carries `text-green-700` class when > 0, `text-red-700` when < 0, default gray/white (`text-gray-900 dark:text-white`) when exactly 0 |

### Filters Panel (`BetsTableControls.vue`)

| Element | Locator | Notes |
| --- | --- | --- |
| Filters toggle button | `getByTestId('bets-filters-toggle-button')` | Text is "▶ Filters" when collapsed (default), "▼ Filters" when expanded; toggles `isExpanded` |
| Active-filter badge | `getByTestId('bets-filters-active-badge')` | Conditionally rendered (`v-if="hasActiveFilters"`) — absent (not merely hidden) when no filter (excluding Season) is set; shows the count of active filters among Fixture/Date/Bookie/Stake Type/Result |
| Clear button | `getByTestId('bets-filters-clear-button')` | Conditionally rendered (`v-if="hasActiveFilters"`) — absent when no filter is active; resets all six filters (including Season) to `""`, which `BetsView.vue`'s `sanitizeFilters` then re-defaults Season back to the current season label |
| Filter panel body | `getByTestId('bets-filters-panel-body')` | Container `v-if="isExpanded"` directly below the toggle row; entirely absent from the DOM (not merely hidden) when collapsed; contains all six filter controls below |
| Season dropdown | `getByTestId('bets-filter-season-select')` | Default selected option is the current season label (e.g. "2026/27", derived from `getCurrentSeasonKey()`); options are every season present in `bets` plus the current season, deduplicated, sorted descending |
| Fixture input | `getByTestId('bets-filter-fixture-input')` | Free-text input; empty by default |
| Date input | `getByTestId('bets-filter-date-input')` | Empty by default |
| Bookie dropdown | `getByTestId('bets-filter-bookie-select')` | Default selected option is "All Bookies"; followed by every unique `bookmaker` present in `bets`, formatted via `formatBookmakerLabel`, sorted alphabetically by raw value |
| Stake Type dropdown | `getByTestId('bets-filter-stake-type-select')` | Default selected option is "All Stake Types"; followed by every unique stake-type label (`Normal`/`Free`/`Normal + Free`) present in `bets` |
| Result dropdown | `getByTestId('bets-filter-result-select')` | Default selected option is "All Results"; followed by every unique result label (`Open`/`Win`/`Loss`/`Cashed Out`) present in `bets` |


## Test Coverage Summary

**Total Scenarios:** 7 (2 Cosmetic, 5 Functional, 0 Navigation)

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Summary stats bar renders correctly | Navigate to `/bets` with seeded bets. Verify all three stat labels and their computed values (Total Bets count, Favourite Bookie label, Total P/L value and its sign-dependent colour class) | "Total Bets" shows the correct count; "Favourite Bookie" shows the correctly formatted most-frequent bookmaker; "Total P/L" shows the correct `£`-formatted sum with the correct colour class for its sign |
| 2 | Cosmetic | Filters panel renders correctly in its default (collapsed) state | On the same page load, verify the "Filters" toggle button shows "▶ Filters" with no active-filter badge, no "Clear" button is visible, and the filter panel body is absent from the DOM | Toggle button text is "▶ Filters"; no "N active" badge present; "Clear" button absent; filter panel body absent from the DOM |
| 3 | Functional | Filter panel body hidden by default | On page load, without interacting with the "Filters" toggle button, verify the filter panel body (Season/Fixture/Date/Bookie/Stake Type/Result controls) is not present in the DOM | Filter panel body is absent from the DOM |
| 4 | Functional | Filter panel body appears after clicking the "Filters" toggle button | Click the "Filters" toggle button | Filter panel body becomes visible; toggle button text changes to "▼ Filters"; all six filter controls (Season, Fixture, Date, Bookie, Stake Type, Result) are visible |
| 5 | Functional | Filter dropdowns show correct default state and options | With the filter panel expanded, verify the Season dropdown defaults to the current season label with all present seasons as options (descending order); the Bookie, Stake Type, and Result dropdowns each default to their respective "All ..." option, followed by every unique value present in the seeded bets | Season dropdown shows the current season label selected, with all expected season options present in descending order; Bookie/Stake Type/Result dropdowns each show their "All ..." option selected by default, followed by the correct set of unique options |
| 6 | Functional | Active-filter badge and "Clear" button appear after setting a filter | With the filter panel expanded, select a value in the Bookie dropdown | "1 active" badge appears next to the "Filters" toggle button; "Clear" button becomes visible |
| 7 | Functional | "Clear" button resets all filters | With one or more filters active (e.g. Bookie set per Scenario 6), click the "Clear" button | All filter controls revert to their default values (Season reverts to the current season label, Bookie/Stake Type/Result revert to their "All ..." options, Fixture/Date inputs are emptied); the active-filter badge and "Clear" button both disappear |

## Out of Scope

- **Bets table display & column controls** (rows-per-page selector, "Columns" toggle
  menu, sortable table headers, pagination controls, responsive mobile card view) —
  future dedicated UI test plan for `BetsView.vue`.
- **Row selection & bulk actions** (per-row/select-all checkboxes, bulk result-update
  bar, per-row "Edit"/"Delete" buttons, Delete confirmation modal) — future dedicated
  UI test plan for `BetsView.vue`.
- **Add Bet** (`AddBetModal.vue`) — future dedicated UI test plan.
- **Edit Bet** (`EditBetModal.vue`) — future dedicated UI test plan.
- **Actual filtering behaviour of the bets table** (i.e. that selecting a filter value
  correctly narrows the rows shown) — the table itself is out of scope per the above;
  this plan only covers the filter controls' own rendering/state, not their downstream
  effect on table rows.
- **Backend/API validation** — not applicable; the filter panel makes no API calls
  (filtering is client-side over the already-fetched `bets` list).
- **Shared header/tab-nav** (`TopBanner.vue`, `TabNav.vue`) — already covered by
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md` and
  `ui-test-plan-tab-nav.md`; referenced, not re-documented here.

## Automation Status

Not yet automated. The existing `support/pages/bets.page.ts` (`BetsPage`) is a
minimal page object exposing only the `addBetButton` landmark (used by
`ui-test-plan-auth-signup.md` to confirm signup navigation) — it will need to be
extended with locators/helpers for the summary stats bar and the `BetsTableControls`
filter panel (all now exposed via `data-test-id` attributes added to
`BetsView.vue`/`BetsTableControls.vue` specifically for this plan — see **Elements
Under Test** above) before these scenarios can be automated.

Seeding/cleanup will follow the existing pattern used by
`tests/functional/top-banner-bet-preferences.spec.ts`: a fresh account is created via
`signUp()` in `test.beforeEach`, bets are seeded directly via `POST /api/bets` against
that account (a new seeding helper, to be created under `support/seed-data/bets/`,
since none currently exists), and cleanup happens via `deleteAccount()` (`DELETE
/api/auth/me`) in `test.afterEach` — which cascades and removes all bets owned by that
account (`Bet.userId` has `onDelete: Cascade` to `User` in
`apps/api/prisma/schema.prisma`). This is account-level cleanup, not the in-scope-
adjacent per-row "Delete" button (which is out of scope for this plan regardless — see
**Out of Scope**).

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ❌ Not Automated | — |
| 2 | ❌ Not Automated | — |
| 3 | ❌ Not Automated | — |
| 4 | ❌ Not Automated | — |
| 5 | ❌ Not Automated | — |
| 6 | ❌ Not Automated | — |
| 7 | ❌ Not Automated | — |


## References

- Application source: `apps/web/src/views/BetsView.vue`,
  `apps/web/src/components/BetsTableControls.vue` (both updated with `data-test-id`
  attributes for this plan's Elements Under Test)
- Supporting utils: `apps/web/src/utils/bookmaker.ts`, `apps/web/src/utils/betEnums.ts`,
  `apps/web/src/utils/season.ts`
- Related UI test plans (shared shell, referenced not re-documented):
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`,
  `playwright/docs/test-plans/ui/shell/ui-test-plan-tab-nav.md`
- Seeding/cleanup pattern reference: `playwright/tests/functional/top-banner-bet-preferences.spec.ts`
- Page Objects: `playwright/support/pages/bets.page.ts` (to be extended)



