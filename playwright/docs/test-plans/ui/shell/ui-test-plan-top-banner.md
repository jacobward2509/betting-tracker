# UI Test Plan — AppShellView Header & User Menu

## Page Information

- **Components:** `TopBanner.vue` (not a routed page itself, but a shared header
  component rendered on every authenticated route via `AppShellView.vue`), plus its
  three exclusively-owned child components: `UserMenuDisplayName.vue`,
  `UserMenuVisualPreferences.vue`, and `UserMenuBetPreferences.vue`. None of these
  three children are imported or rendered anywhere else in the codebase, so this plan
  is their sole canonical owner — there is no other consumer that could duplicate or
  conflict with the locators/behavior documented here.
- **URL Patterns:** `/bets`, `/overall-stats` (any current or future route nested under
  `AppShellView`'s `requiresAuth` shell).
- **Description:** `TopBanner.vue` renders the static "Bets Tracker" title/subtext and a
  user-menu toggle button (avatar initial + display name). Clicking the toggle opens a
  dropdown (`v-if="showUserMenu"`, entirely absent from the DOM when closed — not
  merely hidden) containing the signed-in email, a conditional "unsaved changes"
  warning banner, and three nested sections:
  - `UserMenuDisplayName` — view/edit the account display name (calls
    `PATCH /api/auth/me` via `authStore.updateProfile`)
  - `UserMenuVisualPreferences` — theme (Light/Dark) selection, persisted to
    `localStorage` only, no API call
  - `UserMenuBetPreferences` — odds format, enabled bookmakers, default
    bookmaker/bet-type/stake, loaded via `GET /api/user/config` and saved via
    `PUT /api/user/config`
  - A Sign Out button (`authStore.logout()` → navigate to `/sign-in`)

  Opening the menu (`toggleUserMenu`) always calls `reset()` on the display-name
  child, `loadBetPreferences()` on the bet-preferences child, and `sync()` on the
  visual-preferences child — so every reopen discards any unsaved draft and re-derives
  state fresh from the API/`localStorage`, regardless of how the menu was previously
  closed. The dropdown also closes on any outside click (`mousedown` listener), which
  removes it (and all child state) from the DOM entirely.
- **How Reached:** Automatically rendered on every authenticated page load (any route
  under `AppShellView`). The dropdown itself is reached by clicking the user-menu
  toggle button.

## Elements Under Test

### Header (always visible)

| Element | Locator | Notes |
| --- | --- | --- |
| App title | `getByTestId('top-banner')` `h1` text | Reads "Bets Tracker" |
| App subtext | `getByTestId('top-banner')` `p` text | Reads "The go-to site to track your betting Profit and Loss across all bookmakers." |
| User menu toggle button | `getByTestId('user-menu-toggle-button')` | Shows a rounded avatar with the first letter of `user.name` (falls back to `user.email`, then `"U"`) uppercased, plus `user.name` (falls back to `"User"`) as text |
| User menu dropdown | `getByTestId('user-menu-dropdown')` | `v-if="showUserMenu"` — entirely absent from the DOM (not merely hidden) when closed; closed by default on page load |

### Dropdown (once opened)

| Element | Locator | Notes |
| --- | --- | --- |
| "Signed in as" label | `getByTestId('user-menu-dropdown')` first `p` text | Static label |
| Signed-in email | `getByTestId('user-menu-dropdown')` second `p` text | Reads the authenticated user's email |
| Unsaved changes banner | Text `"You have unsaved changes. If you close this menu without saving, they will be lost."` inside the dropdown | Conditionally rendered (`v-if="hasUnsavedChanges()"`) — hidden by default; becomes visible when **either** `UserMenuBetPreferences.isDirty` or `UserMenuVisualPreferences.isDirty` is true. Discarded (hidden again) as soon as the menu is closed and reopened, since both children's state is refreshed from source on every open. |
| Sign Out button | `getByTestId('user-menu-sign-out-button')` | Navigates to `/sign-in` on click, via `authStore.logout()` |

### Display Name section (`UserMenuDisplayName.vue`)

| Element | Locator | Notes |
| --- | --- | --- |
| "Display Name" label | `getByTestId` scoped text `"Display Name"` | Static label, always visible |
| Display name (view mode) | `getByTestId('user-menu-display-name')` | Default mode; shows current `authStore.user.name` |
| Edit button | `getByTestId('user-menu-edit-display-name-button')` | Switches to edit mode |
| Display name input (edit mode) | `getByTestId('user-menu-display-name-input')` | `v-if="editingDisplayName"`, hidden until Edit is clicked; pre-filled with current name, trimmed (`v-model.trim`); red border + `aria-invalid="true"` when `displayNameError` is set; clears the error on input |
| Save button (edit mode) | `getByTestId('user-menu-save-display-name-button')` | Disabled while `isSavingDisplayName` |
| Cancel button (edit mode) | `getByTestId('user-menu-cancel-display-name-button')` | Reverts to view mode without saving, restores the input to the current saved name |
| Display name error | `getByTestId('user-menu-display-name-error')` | `v-if="editingDisplayName && displayNameError"`; hidden by default; renders e.g. "Name must be at least 2 characters long." on a too-short save attempt, or a server-returned message on API failure |

### Visual Preferences section (`UserMenuVisualPreferences.vue`)

| Element | Locator | Notes |
| --- | --- | --- |
| "Visual Preference" label | `getByTestId` scoped text `"Visual Preference"` | Static label, always visible |
| Configure/Hide toggle | `getByTestId('user-menu-visual-preferences-toggle')` | Label text toggles between "Configure" and "Hide"; section content collapsed by default |
| Theme label | Static text `"Theme"` inside the expanded section | Hidden until "Configure" is clicked |
| Theme select | `getByTestId('user-menu-theme-select')` | Options in order: `Light`, `Dark`; default selection reflects `localStorage['theme-preference']` (or the OS `prefers-color-scheme` if unset), re-synced on every menu open; hidden until "Configure" is clicked |
| Save Visual Preferences button | `getByTestId('user-menu-save-visual-preferences-button')` | Disabled while not dirty (`themeDraft === theme`) or while `isSavingVisualPreferences`; on save, applies the `dark`/`light` class to `<html>`/`<body>` and persists to `localStorage['theme-preference']` — no API call |

### Bet Preferences section (`UserMenuBetPreferences.vue`)

| Element | Locator | Notes |
| --- | --- | --- |
| "Bet Preferences" label | `getByTestId` scoped text `"Bet Preferences"` | Static label, always visible |
| Configure/Hide toggle | `getByTestId('user-menu-bet-preferences-toggle')` | Label text toggles between "Configure" and "Hide"; section content collapsed by default; clears any prior `betPreferencesError` on toggle |
| Loading text | Text `"Loading preferences..."` | Visible only while `isLoadingBetPreferences` (during `GET /api/user/config`, triggered on every menu open) |
| Odds Display label | Static text `"Odds Display"` | Hidden until "Configure" is clicked and loading has finished |
| Odds format select | `getByTestId('user-menu-odds-format-select')` | Options in order: `Decimal`, `Fractional`; default reflects `localStorage['odds-format-preference']` (defaults to `Decimal` if unset) |
| Enabled Bookmakers label | Static text `"Enabled Bookmakers"` | Hidden until "Configure" is clicked and loading has finished |
| Bookmaker checkboxes | `getByTestId('user-menu-bookmaker-checkbox-<slug>')`, e.g. `user-menu-bookmaker-checkbox-bet365` | One per tracked bookmaker, in API-returned order (typically `Bet365`, `Betfair`, `BetUK`, `Ladbrokes`, `Paddy Power`, `SkyBet`, `William Hill` per the `Bookmaker` enum in `apps/api/openapi/user-config.yaml`), labeled with the display name via `formatBookmakerLabel()`; `slug` is the bookmaker's lowercase, non-alphanumeric-stripped name (e.g. `paddypower`, `williamhill`). **The single remaining checked checkbox becomes `disabled` (in addition to staying `checked`) once it is the only enabled bookmaker**, preventing it from being unchecked at all — this was previously a bug (the checkbox visually flipped to unchecked despite the underlying state correctly staying enabled) but has now been fixed to disable the control outright, mirroring the equivalent fix already applied to the signup form's bookmaker checkboxes. |
| Default Bookmaker label | Static text `"Default Bookmaker"` | Hidden until "Configure" is clicked and loading has finished |
| Default Bookmaker select | `getByTestId('user-menu-default-bookmaker-select')` | Options = currently enabled bookmakers only (reactive to checkbox state); if the current default is disabled, auto-reassigns to the first remaining enabled bookmaker |
| Default Bet Type label | Static text `"Default Bet Type"` | Hidden until "Configure" is clicked and loading has finished |
| Default Bet Type select | `getByTestId('user-menu-default-bet-type-select')` | Fixed options, in order: `Accumulator`, `Bet Builder`, `Player Prop`, `Superboost`, `FT Result`, `Other`; default reflects the loaded config (`Player Prop` if never set) |
| Default Stake label | Static text `"Default Stake (£)"` | Hidden until "Configure" is clicked and loading has finished |
| Default Stake input | `getByTestId('user-menu-default-stake-input')` | `type="number"`, `min="0.01"`, `step="0.01"`; default reflects the loaded config (`5` if never set) |
| Bet preferences error | `getByTestId('user-menu-bet-preferences-error')` | `v-if="betPreferencesError"`; hidden by default; renders messages e.g. "At least one bookmaker must remain enabled." (guarded, but no longer reachable via checkbox click since the last one is now disabled — still reachable if `toggleBookmakerEnabled` were ever called programmatically), "Default bookmaker must be one of your enabled bookmakers.", "Default bet type is required.", "Default stake must be a positive number.", or a server-returned message |
| Save Bet Preferences button | `getByTestId('user-menu-save-bet-preferences-button')` | Disabled while not dirty or while `isSavingBetPreferences`; on save, calls `PUT /api/user/config`, persists odds format to `localStorage['odds-format-preference']`, dispatches `user-config-updated` and `odds-format-updated` events, and collapses the section back to hidden |

## Test Coverage Summary

**Total Scenarios: 16**

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Header renders correctly on page load, menu closed by default | Navigate to `/bets`. Verify the `top-banner` container, title text, subtext, and `user-menu-toggle-button` (correct avatar initial + name) are visible; verify `user-menu-dropdown` has zero elements in the DOM | Header static text is correct; toggle button shows the correct initial/name; `user-menu-dropdown` has a DOM count of `0` |
| 2 | Cosmetic | Dropdown renders all static elements correctly when opened (all sub-sections collapsed) | Click `user-menu-toggle-button`. Verify `user-menu-dropdown` is visible, containing the signed-in email, a hidden unsaved-changes banner, the Display Name section in view mode (name + Edit button), the Visual Preference and Bet Preferences sections both collapsed ("Configure" toggle text), and a visible/enabled Sign Out button | All listed elements are visible with correct text; unsaved-changes banner has a DOM count of `0`; both preference sections are collapsed |
| 3 | Functional | Clicking outside the dropdown closes it | With the dropdown open, click an element outside it (e.g. the page title). Verify `user-menu-dropdown` has zero elements in the DOM | `user-menu-dropdown` DOM count is `0` after the outside click |
| 4 | Functional | Reopening the dropdown resets Display Name edit mode and its error | Open the dropdown, click Edit, enter an invalid (1-character) name, click Save to trigger `user-menu-display-name-error`. Close the dropdown (outside click) and reopen it | On reopen, the Display Name section is back in view mode (no `user-menu-display-name-input` in the DOM) showing the original saved name; no error is shown |
| 5 | Functional | Display Name validation error on too-short input | Open the dropdown, click Edit, clear the input and type a single character, click Save | `user-menu-display-name-error` becomes visible with text "Name must be at least 2 characters long."; the name is not saved |
| 6 | Functional | Display Name saves successfully and returns to view mode | Open the dropdown, click Edit, enter a valid new name (≥2 characters), click Save | `user-menu-display-name-input` is removed from the DOM (back to view mode); `user-menu-display-name` shows the new name; `user-menu-toggle-button` text updates to the new name |
| 7 | Functional | Display Name Cancel discards the edit | Open the dropdown, click Edit, change the input value, click Cancel | Back in view mode; `user-menu-display-name` still shows the original (unsaved) name |
| 8 | Functional | Visual Preferences section expands/collapses and shows the correct default theme | Open the dropdown, click the Visual Preference "Configure" toggle. Verify the theme select becomes visible with options `Light`/`Dark` in order and the correct default selection; click "Hide" | Section content becomes visible on "Configure" with the correct default option selected; toggle label reads "Hide"; content is hidden again after clicking "Hide" |
| 9 | Functional | Visual Preferences Save button is disabled until dirty, and applies + persists the theme on save | Open Visual Preferences, verify Save is disabled by default. Select "Dark" from the theme select, verify Save becomes enabled, click Save | Save button is disabled before any change and enabled after selecting a different theme; after saving, `<html>` gains the `dark` class and `localStorage['theme-preference']` is `"dark"`; Save becomes disabled again |
| 10 | Functional | Saved theme selection persists across menu close/reopen | After Scenario 9's save, close the dropdown and reopen it, then expand Visual Preferences again | Theme select shows "Dark" as selected, matching the persisted value |
| 11 | Functional | Bet Preferences section expands and loads current config | Open the dropdown, click the Bet Preferences "Configure" toggle | "Loading preferences..." appears briefly, then all bet-preference fields (odds format select, 7 bookmaker checkboxes, default bookmaker/bet-type selects, default stake input) become visible with values matching the current config |
| 12 | Functional | Enabled Bookmakers checkboxes reflect all 7 tracked bookmakers, all enabled by default for a new account | Sign up a brand-new account and open Bet Preferences for the first time | All 7 bookmaker checkboxes (`bet365`, `betfair`, `betuk`, `ladbrokes`, `paddypower`, `skybet`, `williamhill`) are present, checked, and enabled (not disabled), since more than one bookmaker is enabled |
| 13 | Functional | Unchecking bookmakers down to the last one disables and locks it, keeping it checked | With Bet Preferences open, uncheck 6 of the 7 bookmaker checkboxes one at a time, leaving exactly one checked | After each uncheck, the remaining enabled bookmakers reflect correctly in the Default Bookmaker select; once only one bookmaker remains enabled, its checkbox is both `checked` and `disabled`, and a further click on it has no effect (checkbox stays checked, Default Bookmaker select still shows only that bookmaker) |
| 14 | Functional | Default Bookmaker auto-reassigns when the current default is disabled | With multiple bookmakers enabled and a specific one selected as default, uncheck that default bookmaker's checkbox | Default Bookmaker select automatically reassigns to the first remaining enabled bookmaker, and the disabled bookmaker no longer appears as an option |
| 15 | Functional | Unsaved bet-preference changes show the warning banner, which clears on save and on reopen without saving | With Bet Preferences open, uncheck a bookmaker (making the section dirty). Verify the unsaved-changes banner appears. Save the changes and verify the banner disappears. Separately, make a dirty change again, close the dropdown without saving, and reopen it | Banner becomes visible while dirty; disappears after a successful save; after closing/reopening without saving, the section reloads fresh from the API (collapsed, no unsaved banner, original config restored) |
| 16 | Navigation | Sign Out navigates to the sign-in page | Open the dropdown and click `user-menu-sign-out-button` | URL changes to `/sign-in`; the `Sign In` heading on the destination page is visible |

## Out of Scope

- **`TabNav.vue`** (the separate Bets/Overall Stats tab bar, a sibling of `TopBanner`
  within `AppShellView.vue`) — deliberately excluded from this plan due to zero
  coupling with `TopBanner`/the user menu (no shared state, refs, or triggering logic;
  driven purely by `route.path` and `RouterLink`). To be covered by its own, separate
  future UI test plan.
- **Backend/API validation content** for `PATCH /api/auth/me` and `GET`/`PUT
  /api/user/config` (exact error messages, field constraints, status codes) —
  covered by `playwright/docs/test-plans/api/auth/test-plan-update-profile.md` and
  `playwright/docs/test-plans/api/user-config/test-plan-{get,update}-user-config.md`.
  This plan only asserts how the UI surfaces success/error states, not the full
  validation matrix.
- **Sign-out destination page content** — Scenario 16 only asserts the URL and the
  `Sign In` heading landmark; full coverage of `/sign-in` belongs to
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-login.md`.
- **Bookmaker display-label mapping** (`formatBookmakerLabel()`'s Paddy Power/William
  Hill special-casing) — a pure frontend utility function, better suited to a unit
  test; not independently re-verified here beyond visually confirming the rendered
  labels.
- **Odds format / theme preference's downstream effects elsewhere in the app** (e.g.
  odds actually rendering in the selected format on the Bets page, or the dark theme
  applying app-wide) — this plan only covers the preference UI's own save/persist
  behavior within the user menu; consuming pages' own UI test plans should assert
  their own rendering of these preferences.
- **Future pages rendered under `AppShellView`** — any future UI test plan for a page
  reached via this shell (e.g. `BetsView`, `OverallStatsView`) must reference this
  plan for the shared header/user-menu elements rather than re-documenting their
  locators, per the "Reference Shared Components" convention.

## Resolved Issues

- **Last remaining bookmaker checkbox visually toggled off despite staying enabled —
  now fixed.** Discovered via manual exploration against the running app (Playwright
  MCP): the checkbox's underlying state correctly stayed enabled (Default Bookmaker
  kept showing it as the only option), but its visible `checked` state briefly
  flipped to unchecked on click, since the guard in `toggleBookmakerEnabled` returned
  early without ever re-confirming the `:checked` binding — the same class of bug
  previously found and fixed in the signup form's equivalent bookmaker checkboxes
  (see `ui-test-plan-auth-signup.md`'s own "Resolved Issues" note). Fixed by disabling
  the checkbox once it's the only bookmaker still enabled (`:disabled="enabledBookmakers.length
  === 1 && enabledBookmakers.includes(bookmaker)"`), which prevents the click (and the
  misleading visual flip) from occurring at all. Scenario 13 asserts the checkbox
  stays checked and becomes disabled.

## Automation Status

Automated by `support/pages/top-banner.page.ts` (`TopBannerPage`), which exposes the
header, toggle button, dropdown, and each of the three nested sections'
locators/helpers, composed by six spec files across the smoke, functional, and e2e
tiers.

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ✅ Automated | `tests/smoke/top-banner.spec.ts` |
| 2 | ✅ Automated | `tests/smoke/top-banner.spec.ts` |
| 3 | ✅ Automated | `tests/functional/top-banner-menu.spec.ts` |
| 4 | ✅ Automated | `tests/functional/top-banner-menu.spec.ts` |
| 5 | ✅ Automated | `tests/functional/top-banner-display-name.spec.ts` |
| 6 | ✅ Automated | `tests/functional/top-banner-display-name.spec.ts` |
| 7 | ✅ Automated | `tests/functional/top-banner-display-name.spec.ts` |
| 8 | ✅ Automated | `tests/functional/top-banner-visual-preferences.spec.ts` |
| 9 | ✅ Automated | `tests/functional/top-banner-visual-preferences.spec.ts` |
| 10 | ✅ Automated | `tests/functional/top-banner-visual-preferences.spec.ts` |
| 11 | ✅ Automated | `tests/functional/top-banner-bet-preferences.spec.ts` |
| 12 | ✅ Automated | `tests/functional/top-banner-bet-preferences.spec.ts` |
| 13 | ✅ Automated | `tests/functional/top-banner-bet-preferences.spec.ts` |
| 14 | ✅ Automated | `tests/functional/top-banner-bet-preferences.spec.ts` |
| 15 | ✅ Automated | `tests/functional/top-banner-bet-preferences.spec.ts` |
| 16 | ✅ Automated | `tests/e2e/sign-out-journey.spec.ts` |

## References

- Application source: `apps/web/src/components/TopBanner.vue`,
  `apps/web/src/components/UserMenuDisplayName.vue`,
  `apps/web/src/components/UserMenuVisualPreferences.vue`,
  `apps/web/src/components/UserMenuBetPreferences.vue`,
  `apps/web/src/views/AppShellView.vue`
- Auth store: `apps/web/src/stores/auth.ts`
- Related API test plans: `playwright/docs/test-plans/api/auth/test-plan-update-profile.md`,
  `playwright/docs/test-plans/api/user-config/test-plan-get-user-config.md`,
  `playwright/docs/test-plans/api/user-config/test-plan-update-user-config.md`
- Related UI test plan (Sign Out destination): `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-login.md`
- Related UI test plan (equivalent bookmaker-checkbox bug, previously fixed):
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`
