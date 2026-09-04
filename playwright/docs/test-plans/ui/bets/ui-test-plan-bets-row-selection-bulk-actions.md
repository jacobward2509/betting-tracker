# UI Test Plan — Bets Row Selection & Bulk Actions

## Page Information

- **Component:** `BetsView.vue` (routed page), covering only its per-row/select-all
  checkboxes, the bulk result-update bar (desktop and mobile), the per-row
  "Edit"/"Delete" buttons (desktop and mobile), and the Delete confirmation modal.
  This is the third of several planned UI test plans for `BetsView.vue` — see
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md` (summary
  stats bar & filters panel) and `ui-test-plan-bets-table-display.md` (table controls
  bar, desktop table, pagination, mobile card view — already covered, referenced not
  re-documented here), and **Out of Scope** below for the remaining sections covered
  by their own future plans.
- **URL Pattern:** `/bets`
- **Description:** Every row of the (filtered/sorted/paginated) `bets` list — both
  the desktop `<table>` (visible at the `md` breakpoint and above) and the mobile
  card view (visible below `md`) — renders a checkbox alongside its data, plus
  "Edit"/"Delete" action buttons. A select-all checkbox sits in the desktop table's
  header row, reflecting/toggling selection across every bet on the *current page*
  only (`allPageSelected`/`somePageSelected`/`toggleSelectPage`); there is no
  select-all control in the mobile card view. Whenever `selectedBetIds` is non-empty,
  a sticky bulk-actions bar appears — one variant inside the desktop table wrapper,
  a separate but functionally identical variant inside the mobile card container —
  showing the selected count, a Result dropdown (Open/Win/Loss/Cashed Out, default
  "Open"), a conditionally-rendered Cash Out Value number input (only when "Cashed
  Out" is selected), an "Apply" button (`PATCH /api/bets/bulk-result`, which updates
  `result`/`cashOutValue`/`profit` server-side for every selected bet, clears
  selection on success, and refetches the table), and a "Clear" button (resets
  selection without any API call). Each row/card's "Edit" button opens
  `EditBetModal.vue` (out of scope — future plan); "Delete" opens a confirmation
  modal showing the bet's Fixture/Description with Cancel/× (dismiss) and
  "Yes, Delete" (calls `DELETE /api/bets/:id`, refetches the table, closes the
  modal) actions.
- **How Reached:** Automatically rendered on navigating to `/bets` (default redirect
  target from `/`), directly within the desktop table/mobile card sections
  documented in `ui-test-plan-bets-table-display.md`. No interaction is required to
  see the checkboxes or "Edit"/"Delete" buttons; the bulk-actions bar requires
  selecting at least one row/card checkbox; the Cash Out Value input additionally
  requires selecting "Cashed Out" in the bulk Result dropdown; the Delete
  confirmation modal requires clicking a row/card's "Delete" button; the mobile card
  view requires a viewport narrower than the `md` breakpoint (Tailwind default:
  `768px`).

## Elements Under Test

### Selection & Actions (desktop — visible at the `md` breakpoint and above)

| Element | Locator | Notes |
| --- | --- | --- |
| Select-all checkbox header | `getByTestId('bets-table-header-select-all')` | `<th>` wrapping the select-all checkbox, first column of the desktop table |
| Select-all checkbox | `getByTestId('bets-table-select-all-checkbox')` | Unchecked by default; reflects `allPageSelected` (checked when every bet on the current page is selected) and `somePageSelected && !allPageSelected` (indeterminate when some but not all are selected); clicking toggles selection for every bet on the current page only |
| Actions column header | `getByTestId('bets-table-header-actions')` | Static text "Actions" |
| Row checkbox | `getByTestId('bets-table-row-checkbox')` (repeated, one per row) | Unchecked by default; toggles that row's selection |
| Row "Edit" button | `getByTestId('bets-table-row-edit-button')` (repeated, one per row) | Text "Edit"; opens `EditBetModal.vue` (out of scope — future plan) |
| Row "Delete" button | `getByTestId('bets-table-row-delete-button')` (repeated, one per row) | Text "Delete"; opens the Delete confirmation modal |

### Bulk Result-Update Bar (desktop)

| Element | Locator | Notes |
| --- | --- | --- |
| Bulk bar (desktop) | `getByTestId('bets-bulk-bar-desktop')` | Container `v-if="selectedCount > 0"`, nested inside the desktop table wrapper — absent (not merely hidden) while no row is selected |
| Selected count text (desktop) | `getByTestId('bets-bulk-selected-count-desktop')` | Text `"{selectedCount} selected"` |
| Result dropdown (desktop) | `getByTestId('bets-bulk-result-select-desktop')` | Options Open/Win/Loss/Cashed Out, in that order; defaults to "Open" |
| Cash Out Value input (desktop) | `getByTestId('bets-bulk-cash-out-input-desktop')` | `v-if="bulkResult === 'Cashed Out'"` — absent unless "Cashed Out" is selected in the Result dropdown; numeric, placeholder "Cash Out Value", `min="0"` |
| "Apply" button (desktop) | `getByTestId('bets-bulk-apply-button-desktop')` | Text "Apply" (or "Applying..." while the `PATCH /api/bets/bulk-result` request is in flight); disabled while applying |
| "Clear" button (desktop) | `getByTestId('bets-bulk-clear-button-desktop')` | Text "Clear"; resets `selectedBetIds` to empty (no API call); also clears any visible bulk error message |
| Bulk error message (desktop) | `getByTestId('bets-bulk-error-desktop')` | `v-if="bulkActionError"` — absent unless a client-side validation error (missing/invalid Cash Out value) or a failed `PATCH /api/bets/bulk-result` request has occurred; rendered inline (no native browser dialog), styled `text-red-600`, mirroring the error pattern in `UserMenuDisplayName.vue`; cleared on selecting a different Result, editing the Cash Out Value, changing selection, or clicking "Clear" |


### Selection & Actions (mobile card view — visible below the `md` breakpoint)

| Element | Locator | Notes |
| --- | --- | --- |
| Mobile card checkbox | `getByTestId('bets-table-mobile-card-checkbox')` (repeated, one per card) | Unchecked by default; toggles that bet's selection; no select-all equivalent exists in the mobile view |
| Mobile card "Edit" button | `getByTestId('bets-table-mobile-card-edit-button')` (repeated, one per card) | Text "Edit"; opens `EditBetModal.vue` (out of scope — future plan) |
| Mobile card "Delete" button | `getByTestId('bets-table-mobile-card-delete-button')` (repeated, one per card) | Text "Delete"; opens the Delete confirmation modal |

### Bulk Result-Update Bar (mobile)

| Element | Locator | Notes |
| --- | --- | --- |
| Bulk bar (mobile) | `getByTestId('bets-bulk-bar-mobile')` | Container `v-if="selectedCount > 0"`, nested inside the mobile card container — absent (not merely hidden) while no card is selected; functionally identical to the desktop bar, driven by the same `selectedBetIds`/`bulkResult`/`bulkCashOutValue` state |
| Selected count text (mobile) | `getByTestId('bets-bulk-selected-count-mobile')` | Text `"{selectedCount} selected"` |
| Result dropdown (mobile) | `getByTestId('bets-bulk-result-select-mobile')` | Options Open/Win/Loss/Cashed Out, in that order; defaults to "Open" |
| Cash Out Value input (mobile) | `getByTestId('bets-bulk-cash-out-input-mobile')` | `v-if="bulkResult === 'Cashed Out'"` — absent unless "Cashed Out" is selected |
| "Apply" button (mobile) | `getByTestId('bets-bulk-apply-button-mobile')` | Text "Apply" / "Applying..."; disabled while applying |
| "Clear" button (mobile) | `getByTestId('bets-bulk-clear-button-mobile')` | Text "Clear"; also clears any visible bulk error message |
| Bulk error message (mobile) | `getByTestId('bets-bulk-error-mobile')` | `v-if="bulkActionError"` — same conditions/behaviour as the desktop bulk error message, sharing the same `bulkActionError` state |

### Delete Confirmation Modal

| Element | Locator | Notes |
| --- | --- | --- |
| Modal container | `getByTestId('bets-delete-modal')` | `v-if="showDeleteModal && deletingBet"` — absent (not merely hidden) until a "Delete" button is clicked |
| Close (×) button | `getByTestId('bets-delete-modal-close-button')` | Text "×"; closes the modal without deleting, identical to "Cancel" |
| Fixture line | `getByTestId('bets-delete-modal-fixture')` | Text `"Fixture: {deletingBet.fixture}"` |
| Description line | `getByTestId('bets-delete-modal-description')` | Text `"Description: {deletingBet.selection}"` |
| Delete error message | `getByTestId('bets-delete-modal-error')` | `v-if="deleteError"` — absent unless a failed `DELETE /api/bets/:id` request has occurred; rendered inline within the modal (no native browser dialog), styled `text-red-600`, mirroring the error pattern in `UserMenuDisplayName.vue`; the modal stays open on failure so the user can retry or cancel; cleared on opening/closing the modal |
| "Cancel" button | `getByTestId('bets-delete-modal-cancel-button')` | Text "Cancel"; closes the modal without deleting; disabled while `isDeleting` |
| "Yes, Delete" button | `getByTestId('bets-delete-modal-confirm-button')` | Text "Yes, Delete" (or "Deleting..." while the `DELETE /api/bets/:id` request is in flight); disabled while deleting |


## Test Coverage Summary

**Total Scenarios:** 19 (2 Cosmetic, 17 Functional, 0 Navigation)

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Desktop selection controls and action buttons render correctly by default | Navigate to `/bets` at a desktop viewport width (≥768px) with seeded bets. Verify the select-all checkbox and every row checkbox are present, unchecked, and not indeterminate; every row's "Edit" and "Delete" buttons are visible with correct text; the desktop bulk bar is absent from the DOM | Select-all checkbox and all row checkboxes unchecked/not indeterminate; "Edit"/"Delete" buttons visible on every row with correct text; `bets-bulk-bar-desktop` absent from the DOM |
| 2 | Cosmetic | Mobile selection controls and action buttons render correctly by default | Resize the viewport to a mobile width (<768px) and reload `/bets` with the same seeded bets. Verify every mobile card checkbox is present and unchecked; every card's "Edit" and "Delete" buttons are visible with correct text; the mobile bulk bar is absent from the DOM | All mobile card checkboxes unchecked; "Edit"/"Delete" buttons visible on every card with correct text; `bets-bulk-bar-mobile` absent from the DOM |
| 3 | Functional | Selecting a desktop row checkbox reveals the desktop bulk bar | At a desktop viewport, click a single row's checkbox | `bets-bulk-bar-desktop` becomes visible; selected count text reads "1 selected"; Result dropdown defaults to "Open"; Cash Out Value input is absent; "Apply"/"Clear" buttons are visible |
| 4 | Functional | Selecting a mobile card checkbox reveals the mobile bulk bar | At a mobile viewport, click a single card's checkbox | `bets-bulk-bar-mobile` becomes visible; selected count text reads "1 selected"; Result dropdown defaults to "Open"; Cash Out Value input is absent; "Apply"/"Clear" buttons are visible |
| 5 | Functional | Select-all checkbox selects every row on the current page (desktop) | With no rows selected, click the select-all checkbox | Every row checkbox on the current page becomes checked; the select-all checkbox itself becomes checked (not indeterminate); the desktop bulk bar shows a selected count equal to the number of rows on the current page |
| 6 | Functional | Select-all checkbox becomes indeterminate when only some rows on the page are selected | From Scenario 5 (all rows on the page selected), uncheck a single row's checkbox | The select-all checkbox becomes indeterminate (checked=false, indeterminate=true); the selected count decreases by 1 |
| 7 | Functional | Select-all checkbox deselects every row on the current page when clicked while fully selected | From Scenario 5 (all rows on the page selected), click the select-all checkbox again | Every row checkbox on the current page becomes unchecked; the select-all checkbox becomes unchecked and not indeterminate; the desktop bulk bar disappears (selected count reaches 0) |
| 8 | Functional | Selecting "Cashed Out" in the bulk Result dropdown reveals the Cash Out Value input (desktop) | With one row selected and the desktop bulk bar visible, select "Cashed Out" from the Result dropdown | `bets-bulk-cash-out-input-desktop` becomes visible, empty, with placeholder "Cash Out Value" |
| 9 | Functional | Switching away from "Cashed Out" hides the Cash Out Value input again (desktop) | From Scenario 8, select "Open" from the Result dropdown | `bets-bulk-cash-out-input-desktop` is removed from the DOM |

| 10 | Functional | Applying a bulk result with "Cashed Out" but no Cash Out Value shows an inline error, not a native dialog (desktop) | With one row selected, select "Cashed Out" from the Result dropdown, leave the Cash Out Value input empty, and click "Apply" | The `PATCH /api/bets/bulk-result` request is not sent; `bets-bulk-error-desktop` becomes visible reading "Please enter a valid Cash Out value for Cashed Out."; no native browser dialog is triggered; selection remains unchanged and the bulk bar remains visible |
| 11 | Functional | Applying a bulk "Win" result updates the selected bet and clears selection (desktop) | Select a single seeded bet (initial result "Open"), leave the Result dropdown on its default, change it to "Win", and click "Apply" | The request to `PATCH /api/bets/bulk-result` succeeds; the bet's Result badge in the table updates to "Win" and its P/L updates accordingly; the desktop bulk bar disappears (selection cleared); the select-all/row checkboxes are unchecked again |
| 12 | Functional | Applying a bulk "Cashed Out" result with a valid Cash Out Value updates the selected bet (desktop) | Select a single seeded bet, select "Cashed Out" from the Result dropdown, enter a valid non-negative Cash Out Value, and click "Apply" | The request succeeds; the bet's Result badge updates to "Cashed Out" with the entered Cash Out amount shown beneath it; the bulk bar disappears (selection cleared) |
| 13 | Functional | Applying a bulk result across multiple selected rows updates every selected bet (desktop) | Select two or more seeded bets via their row checkboxes, select "Loss" from the Result dropdown, and click "Apply" | The request succeeds with all selected bet ids; every selected bet's Result badge updates to "Loss" and its P/L updates accordingly; the bulk bar disappears (selection cleared) |
| 14 | Functional | Applying a bulk result from the mobile bulk bar updates the selected bet (mobile) | At a mobile viewport, select a single seeded bet via its card checkbox, change the Result dropdown to "Win", and click "Apply" | The request succeeds; the mobile card's Result badge updates to "Win" and its P/L updates accordingly; the mobile bulk bar disappears (selection cleared) |
| 15 | Functional | "Clear" button resets selection without applying any change | With one or more rows selected (desktop or mobile) and a non-default Result dropdown value chosen, click "Clear" | No `PATCH /api/bets/bulk-result` request is sent; all row/card checkboxes become unchecked; the bulk bar disappears; the underlying bets' results are unchanged |
| 16 | Functional | Delete confirmation modal opens with the correct bet's details and can be dismissed without deleting | Click a row's (desktop) or card's (mobile) "Delete" button, verify the modal's Fixture/Description text matches that bet, then click "Cancel" | `bets-delete-modal` becomes visible showing the correct Fixture/Description text; after clicking "Cancel", the modal is removed from the DOM and no `DELETE /api/bets/:id` request is sent; the bet remains in the table |
| 17 | Functional | Confirming deletion removes the bet from the table | Click a row's "Delete" button, then click "Yes, Delete" in the confirmation modal | The `DELETE /api/bets/:id` request succeeds; the modal closes; the deleted bet is no longer present in the table (row/card count decreases by 1; Total Bets count in the summary stats bar decreases by 1) |
| 18 | Functional | A failed bulk-apply request shows an inline error, not a native dialog, and preserves selection | With one or more rows selected and a valid Result/Cash Out Value chosen, simulate a failed `PATCH /api/bets/bulk-result` request (e.g. via route interception) and click "Apply" | `bets-bulk-error-desktop`/`-mobile` becomes visible with the returned error message (or the fallback "Failed to apply bulk result."); no native browser dialog is triggered; selection is preserved (not cleared) so the user can retry; the bulk bar remains visible |
| 19 | Functional | A failed delete request shows an inline error, not a native dialog, and keeps the modal open | Click a row's "Delete" button, then simulate a failed `DELETE /api/bets/:id` request (e.g. via route interception) and click "Yes, Delete" | `bets-delete-modal-error` becomes visible reading "Failed to delete bet. Please try again."; no native browser dialog is triggered; the modal remains open (not closed) so the user can retry or cancel; the bet remains in the table |


## Out of Scope

- **Bets summary stats bar & filters panel** (`BetsTableControls.vue`) — already
  covered by
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`;
  referenced, not re-documented here.
- **Table controls bar, desktop table headers/sorting, pagination controls, and
  mobile card layout of non-selection fields** — already covered by
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md`;
  referenced, not re-documented here.
- **Add Bet** (`AddBetModal.vue`) — future dedicated UI test plan.
- **Edit Bet** (`EditBetModal.vue`) — this plan only verifies that clicking a row's
  or card's "Edit" button is present and clickable (Scenarios 1–2); the modal's own
  contents, validation, and save behaviour belong to its own future dedicated UI
  test plan and are not exercised here.
- **Selection persistence across pagination** (i.e. whether selecting a bet on page
  1 and navigating to page 2 keeps it selected) — `selectedBetIds` is not reset by
  pagination in the source, but exercising this interaction is deferred to a future
  plan alongside pagination coverage; this plan's scenarios operate within a single
  page of results.
- **Backend/API validation of `PATCH /api/bets/bulk-result` and
  `DELETE /api/bets/:id`** (exact error messages/status codes for malformed
  requests) — belongs in a dedicated API test plan if one exists/is created; this
  plan only verifies the UI's own success-path behaviour and its one documented
  client-side guard (Cashed Out requiring a Cash Out Value, Scenario 10).
- **Shared header/tab-nav** (`TopBanner.vue`, `TabNav.vue`) — already covered by
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md` and
  `ui-test-plan-tab-nav.md`; referenced, not re-documented here.


## Automation Status

Automated by extending `support/pages/bets.page.ts` (`BetsPage`) with
locators/helpers for the select-all/row/mobile-card checkboxes, the desktop and
mobile bulk-actions bars (including their inline error messages), the row/card
"Edit"/"Delete" buttons, and the Delete confirmation modal (including its inline
error message) (all exposed via the new `data-test-id` attributes added to
`BetsView.vue` specifically for this plan — see **Elements Under Test** above),
composed by one smoke spec (Scenarios 1–2) and one functional spec
(Scenarios 3–19).

All three error paths in scope for this plan (missing Cash Out Value, failed
bulk-apply, failed delete) render inline `text-red-600` error messages driven by
dedicated `ref("")` state (`bulkActionError`, `deleteError`), following the same
pattern established by `UserMenuDisplayName.vue` — none of them trigger a native
`window.alert()` dialog, so no `page.on('dialog', ...)` handling is needed in the
generated specs (Scenarios 10, 18, 19 assert this directly by checking no dialog
event fires alongside the inline error becoming visible).

Seeding/cleanup follows the existing pattern already used by
`tests/functional/top-banner-bet-preferences.spec.ts` and the other Bets-page
specs: a fresh account is created via `signUp()` in `test.beforeEach`, bets are
seeded via `POST /api/bets` against that account using the existing `seedBets()`
helper (`support/functions/bet-seeding.ts`) and `seededBetsFixture()` seed data
(`support/seed-data/bets/index.ts`) — extended with additional fixtures/overrides
as needed for scenarios requiring multiple selectable rows with distinct initial
results (Scenario 13) — and cleanup happens via `deleteAccount()`
(`DELETE /api/auth/me`) in `test.afterEach`, which cascades and removes all bets
owned by that account (`Bet.userId` has `onDelete: Cascade` to `User` in
`apps/api/prisma/schema.prisma`). Scenario 17 (confirmed delete) additionally
relies on this cascade only as a safety net — the scenario itself asserts the bet
is removed from the table immediately via the UI, not via cleanup. Scenarios 18–19
(failed bulk-apply/delete) use Playwright route interception
(`page.route(...)`) to force the relevant API call to fail, rather than any
backend-side fault injection.

Every `test.beforeEach`/mobile-viewport `page.reload()` in both spec files uses
the shared `BetsPage.expectBetsLoaded(page, action)` static helper (added during
self-heal of this plan's initial run) to wait for the resulting
`GET /api/bets` response before any selection-control interaction, avoiding a
race where `paginatedBets` is still empty when a checkbox is clicked.

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ✅ Automated | `tests/smoke/bets-row-selection.spec.ts` |
| 2 | ✅ Automated | `tests/smoke/bets-row-selection.spec.ts` |
| 3 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 4 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 5 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 6 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 7 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 8 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 9 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 10 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 11 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 12 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 13 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 14 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 15 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 16 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 17 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 18 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |
| 19 | ✅ Automated | `tests/functional/bets-bulk-actions.spec.ts` |


## References

- Application source: `apps/web/src/views/BetsView.vue` (updated with
  `data-test-id` attributes for this plan's Elements Under Test, and with
  `alert()` calls replaced by inline error state in scope for this plan —
  `bulkActionError`, `deleteError` — following the pattern in
  `UserMenuDisplayName.vue`), `apps/api/src/routes/bets.ts`
  (`PATCH /api/bets/bulk-result`, `DELETE /api/bets/:id`)
- Error-handling pattern reference: `apps/web/src/components/UserMenuDisplayName.vue`
  (inline `ref("")` error state rendered in the template, no native browser dialogs)
- Related UI test plans:
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`
  (summary stats bar & filters panel, referenced not re-documented),
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md`
  (table controls bar, desktop table, pagination, mobile card view, referenced not
  re-documented), `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`,
  `ui-test-plan-tab-nav.md` (shared shell, referenced not re-documented)
- Seeding/cleanup pattern reference:
  `playwright/tests/functional/top-banner-bet-preferences.spec.ts`,
  `playwright/support/seed-data/bets/index.ts`,
  `playwright/support/functions/bet-seeding.ts`
- Page Objects: `playwright/support/pages/bets.page.ts` (extended for this plan)

