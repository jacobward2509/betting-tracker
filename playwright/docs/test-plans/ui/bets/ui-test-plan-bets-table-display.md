# UI Test Plan — Bets Table Display & Column Controls

## Page Information

- **Component:** `BetsView.vue` (routed page), covering only its bets table
  controls bar (rows-per-page selector, "Columns" toggle menu), the desktop
  table itself (sortable headers, rows), the pagination controls beneath it,
  and the responsive mobile card view rendered in place of the table below the
  `md` breakpoint. This is the second of several planned UI test plans for
  `BetsView.vue` — see
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`
  for the summary stats bar and filters panel (already covered, referenced not
  re-documented here), and **Out of Scope** below for the remaining sections
  covered by their own future plans.
- **URL Pattern:** `/bets`
- **Description:** Below the summary stats bar and `BetsTableControls.vue`
  filter panel (both out of scope here — see referenced plan above), and above
  the "Add Bet" button, `BetsView.vue` renders a controls bar containing a
  "Show" rows-per-page `<select>` (5/10/25/50/100, default 10) and a
  "Columns" toggle button that opens a checkbox menu for showing/hiding any of
  the table's 9 data columns (all checked/visible by default). Below that,
  `BetsView.vue` renders two mutually-exclusive views of the same
  (filtered/sorted/paginated) `bets` list: a `<table>` with sortable column
  headers (Date, Stake, Odds, Result, P/L — toggling ascending/descending on
  click, with a "▲▼"/"▲"/"▼" indicator per column) shown at the `md` breakpoint
  and above (`hidden md:block`), and a stacked set of mobile "cards" shown
  below the `md` breakpoint (`md:hidden`) containing the same per-bet data.
  Beneath both views, pagination controls (First/Previous/Page X of Y/
  Next/Last) page through the list at the current rows-per-page size.
- **How Reached:** Automatically rendered on navigating to `/bets` (default
  redirect target from `/`), directly beneath the summary stats bar and
  filters panel. No interaction is required to reach the controls bar, table,
  or pagination controls; the "Columns" menu requires clicking the "Columns"
  toggle button to open; the mobile card view requires a viewport narrower
  than the `md` breakpoint (Tailwind default: `768px`).

## Elements Under Test

### Table Controls Bar

| Element | Locator | Notes |
| --- | --- | --- |
| Rows-per-page selector | `getByTestId('bets-rows-per-page-select')` | `<select>` labelled "Show"; options `5`/`10`/`25`/`50`/`100`, in that order; defaults to `10` |
| "Columns" toggle button | `getByTestId('bets-columns-toggle-button')` | Static text "Columns"; toggles `showColumnsMenu` |
| Columns menu | `getByTestId('bets-columns-menu')` | Container `v-if="showColumnsMenu"` — absent (not merely hidden) when collapsed (default) |
| Column checkboxes (9) | `getByTestId('bets-columns-option-date')`, `-fixture`, `-bookie`, `-description`, `-stakeType`, `-stake`, `-odds`, `-result`, `-profitLoss` | Each wraps a checkbox (checked by default) and its label text ("Date", "Fixture", "Bookie", "Description", "Stake Type", "Stake (£)", "Odds", "Result", "P/L"), in that order; unchecking one hides the corresponding table column/mobile card field |

### Bets Table (desktop — visible at the `md` breakpoint and above)

| Element | Locator | Notes |
| --- | --- | --- |
| Desktop table wrapper | `getByTestId('bets-table-desktop')` | `hidden md:block` — hidden (not absent) below `md`, visible at `md` and above |
| Table headers (9) | `getByTestId('bets-table-header-date')`, `-fixture`, `-bookie`, `-description`, `-stakeType`, `-stake`, `-odds`, `-result`, `-profitLoss` | Text: "Date", "Fixture", "Bookie", "Description", "Stake Type", "Stake (£)", "Odds", "Result", "P/L", in that order; each individually hidden (its `<th>` not rendered) when its corresponding column checkbox is unchecked |
| Sort buttons (5 sortable columns) | `getByTestId('bets-table-sort-button-date')`, `-stake`, `-odds`, `-result`, `-profit` | Nested inside the Date/Stake (£)/Odds/Result/P/L headers; clicking toggles that column's sort direction |
| Sort indicators (5 sortable columns) | `getByTestId('bets-table-sort-indicator-date')`, `-stake`, `-odds`, `-result`, `-profit` | Text is "▲▼" when that column is not the active sort key (default state for all 5), "▲" when it is the active key sorted ascending, "▼" when sorted descending |
| Table rows | `getByTestId('bets-table-row')` (repeated, one per bet on the current page) | Count equals `min(pageSize, filteredBets.length)` for the current page |

### Pagination Controls

| Element | Locator | Notes |
| --- | --- | --- |
| Pagination wrapper | `getByTestId('bets-pagination')` | Always visible below the table/mobile cards |
| "First page" button | `getByTestId('bets-pagination-first-button')` | Text "<<"; disabled when `currentPage === 1` |
| "Previous page" button | `getByTestId('bets-pagination-previous-button')` | Text "<"; disabled when `currentPage === 1` |
| Page info text | `getByTestId('bets-pagination-page-info')` | Text `"Page {currentPage} of {totalPages}"` |
| "Next page" button | `getByTestId('bets-pagination-next-button')` | Text ">"; disabled when `currentPage === totalPages` |
| "Last page" button | `getByTestId('bets-pagination-last-button')` | Text ">>"; disabled when `currentPage === totalPages` |

### Mobile Card View (visible below the `md` breakpoint)

| Element | Locator | Notes |
| --- | --- | --- |
| Mobile card container | `getByTestId('bets-table-mobile')` | `md:hidden` — visible below `md`, hidden (not absent) at `md` and above |
| Mobile card | `getByTestId('bets-table-mobile-card')` (repeated, one per bet on the current page) | Count equals `min(pageSize, filteredBets.length)` for the current page; contains the same per-bet fixture/date/bookie/stake-type/result/stake/odds/P/L data as the desktop table row, laid out as a card (column visibility toggles do not apply to the mobile view — all fields always shown) |

## Test Coverage Summary

**Total Scenarios:** 12 (2 Cosmetic, 10 Functional, 0 Navigation)

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Table controls bar and desktop table render correctly by default | Navigate to `/bets` at a desktop viewport width (≥768px) with 12 seeded bets. Verify the rows-per-page selector defaults to "10" with all 5 options present in order; the "Columns" button is visible with text "Columns" and the columns menu is absent; the desktop table is visible with all 9 headers in the correct order and correct text; the 5 sortable headers each show a "▲▼" sort indicator by default; exactly 10 table rows are rendered (page 1 of a 12-bet, page-size-10 list); the pagination wrapper shows "Page 1 of 2" | Rows-per-page selector shows "10" selected with options 5/10/25/50/100 in order; "Columns" button visible, columns menu absent; all 9 table headers visible with correct text/order; all 5 sortable headers show "▲▼"; exactly 10 rows rendered; pagination text reads "Page 1 of 2"; First/Previous buttons disabled, Next/Last buttons enabled |
| 2 | Cosmetic | Mobile card view renders correctly on small viewports, desktop table hidden | With the same 12 seeded bets, resize the viewport to a mobile width (<768px) and reload `/bets` | The mobile card container is visible with exactly 10 mobile cards rendered (page 1 of 2); the desktop table wrapper is hidden (present in the DOM, not visible) |
| 3 | Functional | Columns menu hidden by default | On page load at a desktop viewport, without clicking the "Columns" toggle button, verify the columns menu is not present in the DOM | Columns menu is absent from the DOM |
| 4 | Functional | Columns menu appears with all columns checked after clicking the "Columns" toggle button | Click the "Columns" toggle button | Columns menu becomes visible; all 9 column checkboxes are visible, checked, and show the correct label text in the correct order |
| 5 | Functional | Unchecking a column hides its header and cell in the desktop table | With the columns menu open, uncheck the "Bookie" checkbox | The "Bookie" table header (`bets-table-header-bookie`) is no longer present in the desktop table; the remaining 8 headers are unaffected |
| 6 | Functional | Rows-per-page selector changes the number of rows displayed and the pagination page count | With 12 seeded bets and the desktop table showing page 1 of 2 (page size 10 per Scenario 1), select "5" from the rows-per-page selector | Exactly 5 table rows are now rendered; the pagination text updates to "Page 1 of 3" |
| 7 | Functional | Clicking a sortable header's sort button once sorts ascending and updates its indicator | With 12 seeded bets spanning distinct stake values, click the "Stake (£)" column's sort button | The "Stake (£)" sort indicator changes from "▲▼" to "▲"; the rows on the current page are ordered by ascending stake value |
| 8 | Functional | Clicking the same sortable header's sort button again sorts descending and updates its indicator | Immediately after Scenario 7, click the "Stake (£)" column's sort button a second time | The "Stake (£)" sort indicator changes from "▲" to "▼"; the rows on the current page are ordered by descending stake value |
| 9 | Functional | Pagination buttons are disabled at the first page boundary | With 12 seeded bets and page size 10 (page 1 of 2), verify the pagination controls' initial state | "First page" and "Previous page" buttons are disabled; "Next page" and "Last page" buttons are enabled |
| 10 | Functional | Pagination buttons are disabled at the last page boundary | From page 1 of 2 (Scenario 9), click the "Last page" button | Page info text reads "Page 2 of 2"; "Next page" and "Last page" buttons become disabled; "First page" and "Previous page" buttons become enabled |
| 11 | Functional | "Next"/"Last" pagination buttons navigate forward through pages | From page 1 of 2, click the "Next page" button | Page info text reads "Page 2 of 2"; the table/mobile cards now show the remaining 2 bets (the second page of a 12-bet, page-size-10 list) |
| 12 | Functional | "Previous"/"First" pagination buttons navigate backward through pages | From page 2 of 2 (Scenario 11), click the "First page" button | Page info text reads "Page 1 of 2"; the table/mobile cards show the first 10 bets again |

## Out of Scope

- **Bets summary stats bar & filters panel** (`BetsTableControls.vue`) —
  already covered by
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`;
  referenced, not re-documented here.
- **Row selection & bulk actions** (per-row/select-all checkboxes, bulk
  result-update bar, per-row "Edit"/"Delete" buttons, Delete confirmation
  modal) — future dedicated UI test plan for `BetsView.vue`.
- **Add Bet** (`AddBetModal.vue`) — future dedicated UI test plan.
- **Edit Bet** (`EditBetModal.vue`) — future dedicated UI test plan.
- **Persistence of table state across reloads** (rows-per-page, sort
  key/direction, and current page are persisted to `localStorage` under
  `bets-table-state`) — this plan only covers the in-session rendering and
  interactive behaviour of the controls themselves, not their persistence
  across page reloads/sessions.
- **Exact per-bet field values/formatting shown in table rows and mobile
  cards** (date formatting, odds formatting, bookmaker/stake-type/result
  badge styling) beyond what's needed to verify sort order and row/card
  counts — covered incidentally here where needed for sort assertions, but
  not exhaustively re-verified per field; any dedicated formatting coverage
  belongs to a future plan if introduced.
- **Backend/API validation** — not applicable; sorting, pagination, and
  column visibility are entirely client-side over the already-fetched `bets`
  list.
- **Shared header/tab-nav** (`TopBanner.vue`, `TabNav.vue`) — already covered
  by `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md` and
  `ui-test-plan-tab-nav.md`; referenced, not re-documented here.

## Automation Status

To be automated by extending `support/pages/bets.page.ts` (`BetsPage`) with
locators/helpers for the table controls bar, desktop table (headers, sort
buttons/indicators, rows), pagination controls, and mobile card view (all
exposed via the new `data-test-id` attributes added to `BetsView.vue`
specifically for this plan — see **Elements Under Test** above), composed by
one new smoke spec and one new functional spec.

Seeding will extend the existing `seedBets()`/`seededBetsFixture()` pattern
(`support/functions/bet-seeding.ts` / `support/seed-data/bets/index.ts`) with
a new fixture of 12 bets with distinct stake values (needed to exercise
2-page pagination at the default page size of 10, and deterministic
ascending/descending sort assertions on the "Stake (£)" column). Account
creation/cleanup follows the same `signUp()`/`deleteAccount()` pattern already
used by `tests/functional/top-banner-bet-preferences.spec.ts` and the existing
bets specs.

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ❌ Not Automated | *(to be created)* |
| 2 | ❌ Not Automated | *(to be created)* |
| 3 | ❌ Not Automated | *(to be created)* |
| 4 | ❌ Not Automated | *(to be created)* |
| 5 | ❌ Not Automated | *(to be created)* |
| 6 | ❌ Not Automated | *(to be created)* |
| 7 | ❌ Not Automated | *(to be created)* |
| 8 | ❌ Not Automated | *(to be created)* |
| 9 | ❌ Not Automated | *(to be created)* |
| 10 | ❌ Not Automated | *(to be created)* |
| 11 | ❌ Not Automated | *(to be created)* |
| 12 | ❌ Not Automated | *(to be created)* |

## References

- Application source: `apps/web/src/views/BetsView.vue` (updated with
  `data-test-id` attributes for this plan's Elements Under Test)
- Related UI test plans: `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`
  (summary stats bar & filters panel, referenced not re-documented),
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`,
  `playwright/docs/test-plans/ui/shell/ui-test-plan-tab-nav.md` (shared shell,
  referenced not re-documented)
- Seeding/cleanup pattern reference:
  `playwright/tests/functional/top-banner-bet-preferences.spec.ts`,
  `playwright/support/seed-data/bets/index.ts`,
  `playwright/support/functions/bet-seeding.ts`
- Page Objects: `playwright/support/pages/bets.page.ts` (to be extended)


