# UI Test Plan — AuthView (Signup)

## Page Information

- **URL Pattern:** `/auth`
- **Page Title / Heading:** `Create Account` (`<h1>`), subtext `Start tracking your bets.`
- **Description:** `AuthView.vue` is a single shared component that renders either a login
  form or a signup form at the same `/auth` route, toggled entirely client-side via a
  `mode` ref (`"login" | "signup"`) — there is no separate route or URL for signup.
  This plan covers **only** the `signup` mode of the component.
- **How Reached:**
  - Directly navigating to `/auth` (defaults to `mode = "login"`; the user must click
    the "Need an account? Sign up" toggle to reach signup mode).
  - Automatically redirected here by the router's `beforeEach` guard when an
    unauthenticated user attempts to visit any `requiresAuth` route (e.g. `/`, `/bets`,
    `/overall-stats`).

## Elements Under Test

| Element | Locator | Notes |
| --- | --- | --- |
| Signup form | `getByTestId('auth-form')` | `<form novalidate>` — native HTML5 constraint validation is intentionally disabled; all validation is custom client-side JS |
| Page heading | `getByTestId('auth-heading')` | Only shown when `mode === 'signup'`; reads "Sign In" in login mode (out of scope) |
| Subtext | `getByTestId('auth-subtext')` | Signup-mode subtext |
| Name label | `getByTestId('name-label')` | Signup-only field |
| Name input | `getByTestId('name-input')` | `type="text"`, `autocomplete="name"`, trimmed (`v-model.trim`); empty by default; red border + `aria-invalid="true"` when `nameError` is set; clears `nameError` on input |
| Name error | `getByTestId('name-error')` | `v-if="nameError"`; hidden by default; renders `nameError` text, e.g. "Name is required.", "Name must be at least 2 characters long.", or a server-returned message (e.g. "Name must be at most 60 characters long.") |
| "Betting Preferences (Optional)" heading | `getByTestId('preferences-heading')` | Section heading, always visible in signup mode |
| Preferences helper text | `getByTestId('preferences-helper-text')` | Always visible in signup mode |
| "Configure" / "Hide" toggle button | `getByTestId('toggle-preferences-button')` | Toggles `configureNow`; label text itself changes between "Configure" and "Hide" |
| Enabled Bookmakers checkboxes | `getByTestId('bookmaker-checkbox-<Name>')` (e.g. `bookmaker-checkbox-Bet365`) | One per bookmaker: `Bet365`, `Betfair`, `BetUK`, `Ladbrokes`, `Paddy Power`, `SkyBet`, `William Hill` — all checked by default; hidden until "Configure" is clicked; at least one must remain checked |
| Default Bookmaker label | `getByTestId('default-bookmaker-label')` | Hidden until "Configure" is clicked |
| Default Bookmaker select | `getByTestId('default-bookmaker-select')` | Options = currently enabled bookmakers only, in the fixed order above; default selection = `Bet365` (first in list); hidden until "Configure" is clicked |
| Default Bet Type label | `getByTestId('default-bet-type-label')` | Hidden until "Configure" is clicked |
| Default Bet Type select | `getByTestId('default-bet-type-select')` | Fixed options, in order: `Accumulator`, `Bet Builder`, `Player Prop`, `Superboost`, `FT Result`, `Other`; default selection = `Player Prop`; hidden until "Configure" is clicked |
| Default Stake label | `getByTestId('default-stake-label')` | Hidden until "Configure" is clicked |
| Default Stake input | `getByTestId('default-stake-input')` | `type="number"`, `min="0.01"`, `step="0.01"`; default value `5`; hidden until "Configure" is clicked; the `min` constraint is not enforced natively (form is `novalidate`) — a custom client-side check blocks submission instead |
| Preferences footer note | `getByTestId('preferences-footer-note')` | Always visible in signup mode, regardless of `configureNow` state |
| Email label | `getByTestId('email-label')` | |
| Email input | `getByTestId('email-input')` | `type="email"`, `autocomplete="email"`, trimmed (`v-model.trim`); empty by default; red border + `aria-invalid="true"` when `emailError` is set; clears `emailError` on input |
| Email error | `getByTestId('email-error')` | `v-if="emailError"`; hidden by default; renders `emailError` text, e.g. "Email is required." or "Please provide a valid email address." |
| Password label | `getByTestId('password-label')` | |
| Password input | `getByTestId('password-input')` | `type="password"` by default, `autocomplete="current-password"`; empty by default; red border + `aria-invalid="true"` when `passwordError` is set; clears `passwordError` on input |
| Show/hide password toggle button | `getByTestId('toggle-password-visibility-button')` | `aria-label` and icon toggle between "Show password"/"Hide password"; toggles input `type` between `password` and `text` |
| Password error | `getByTestId('password-error')` | `v-if="passwordError"`; hidden by default; renders `passwordError` text, e.g. "Password is required." or "Password must be at least 10 characters long."; when shown, replaces the password helper text below (mutually exclusive `v-if`/`v-else-if`) |
| Password helper text | `getByTestId('password-helper-text')` | `v-else-if="mode === 'signup'"` — only rendered when `passwordError` is empty; text is "Minimum 10 characters." |
| Auth error message | `getByTestId('auth-error-message')` | `v-if="errorMessage"`; hidden by default; renders a human-readable, top-level error message (see Test Scenarios 8–13 for the specific messages and when each is triggered) |
| Submit button | `getByTestId('submit-button')` | `type="submit"`; disabled while `isSubmitting` is `true`; text reads "Create Account" by default, "Please wait..." while submitting |
| Mode toggle link | `getByTestId('toggle-mode-button')` | Clicking switches `mode` back to `"login"`; this is an in-page state change only — the URL remains `/auth` |
| "Add Bet" button (destination landmark) | `getByTestId('add-bet-button')` on `/bets` | Not part of this component; used only as the landmark confirming successful signup navigation completed (per Out of Scope, its own behavior belongs to the Bets page's own UI test plan) |

## Test Coverage Summary

**Total Scenarios: 16**
- Cosmetic: 1
- Functional: 12
- Navigation: 3

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Signup page loads correctly | Navigate to `/auth`, then click the "Need an account? Sign up" toggle to enter signup mode. Verify the page URL, heading, subtext, all labels (Name, Betting Preferences, Email, Password), all input placeholders/empty initial state, the "Configure" button, the submit button, the password helper text, the preferences footer note, and that the Betting Preferences configuration sub-fields are present but not visible | URL is `/auth`; heading reads "Create Account"; subtext reads "Start tracking your bets."; Name, Email, and Password inputs are visible, empty, and enabled; "Configure" button and "Create Account" submit button are visible and enabled with correct text; "Minimum 10 characters." helper text is visible; preferences footer note is visible; Enabled Bookmakers checkboxes, Default Bookmaker select, Default Bet Type select, and Default Stake input are present in the DOM but not visible; no field error paragraphs (`name-error`, `email-error`, `password-error`, `auth-error-message`) are visible |
| 2 | Functional | Betting Preferences sub-fields hidden by default | On signup page load, without clicking "Configure", verify the Enabled Bookmakers checkboxes, Default Bookmaker select, Default Bet Type select, and Default Stake input are not visible | All four preference sub-fields are hidden (not visible) in the default state |
| 3 | Functional | Betting Preferences sub-fields appear after clicking "Configure" | Click the "Configure" button | The four preference sub-fields become visible; the button label changes to "Hide"; all 7 bookmaker checkboxes are checked; Default Bookmaker select shows `Bet365` selected with all 7 bookmakers as options in order (`Bet365`, `Betfair`, `BetUK`, `Ladbrokes`, `Paddy Power`, `SkyBet`, `William Hill`); Default Bet Type select shows `Player Prop` selected with all 6 options in order (`Accumulator`, `Bet Builder`, `Player Prop`, `Superboost`, `FT Result`, `Other`); Default Stake input shows `5` |
| 4 | Functional | Unchecking a bookmaker removes it from the Default Bookmaker options | With preferences configured (Scenario 3 state), uncheck the `Betfair` checkbox | `Betfair` checkbox becomes unchecked; `Betfair` is removed from the Default Bookmaker select's option list; the remaining 6 bookmakers stay as options in their original order |
| 5 | Functional | Last remaining bookmaker checkbox cannot be unchecked | With preferences configured, uncheck every bookmaker checkbox except one, then attempt to uncheck the final remaining checked bookmaker | The final checkbox remains checked; the Default Bookmaker select continues to show that one bookmaker as its only option |
| 6 | Functional | Password visibility toggle | On the signup form, fill the Password input with a value, then click the show/hide password toggle button | Password input's `type` changes from `password` to `text` (value becomes visible) and the button's `aria-label` changes from "Show password" to "Hide password"; clicking again reverts both to their original state |
| 7 | Functional | Submit button disables and shows "Please wait..." while submitting | Fill in valid Name, Email, and Password values and click "Create Account" | Immediately after clicking, the submit button becomes disabled and its label changes to "Please wait..." until the signup request resolves |
| 8 | Functional | Custom inline validation errors shown for empty required fields | Click "Create Account" with the Name, Email, and Password fields all empty | All three field-level errors become visible simultaneously: `name-error` reads "Name is required.", `email-error` reads "Email is required.", `password-error` reads "Password is required." (replacing the password helper text); each corresponding input has `aria-invalid="true"` and a red border; no `POST /api/auth/signup` request is sent |
| 9 | Functional | Custom inline validation errors for invalid formats | Individually submit the form with: (a) a Name of 1 character, (b) an Email of `not-an-email`, and (c) a Password of fewer than 10 characters (with the other two fields valid) | For each case, only that field's error paragraph becomes visible with the matching message ("Name must be at least 2 characters long.", "Please provide a valid email address.", "Password must be at least 10 characters long." respectively); no `POST /api/auth/signup` request is sent |
| 10 | Functional | Field error clears independently on input | Trigger the Name, Email, and Password errors from Scenario 8, then type a single character into the Name field only | `name-error` immediately disappears and the Name input's `aria-invalid` is removed; `email-error` and `password-error` remain visible and unaffected |
| 11 | Functional | Default Stake of zero or less blocks submission via a top-level error | Click "Configure", set the Default Stake input to `0`, fill in a valid Name, Email, and Password, and click "Create Account" | `auth-error-message` becomes visible reading "Default stake must be a positive number."; no `POST /api/auth/signup` request is sent; the submit button is not disabled/does not show "Please wait..." |
| 12 | Functional | Error message shown on failed signup | Submit the signup form with data that causes the signup request to fail (e.g. an email that already has a registered account) | `auth-error-message` becomes visible below the Password field showing the clean, human-readable message "An account with this email already exists."; the submit button re-enables and its text reverts to "Create Account" |
| 13 | Functional | Server-side field validation errors surface inline | Submit the signup form with a value that passes client-side validation but fails the API's own validation (e.g. a Name of 61+ characters, which exceeds the server's `maxLength` but not the client's minimum-length-only check) | `auth-error-message` becomes visible reading "Please correct the highlighted fields and try again."; `name-error` becomes visible showing the server-returned field message (e.g. "Name must be at most 60 characters long.") |
| 14 | Navigation | "Already have an account? Sign in" toggles back to login mode | From the signup form, click the "Already have an account? Sign in" button | The URL remains `/auth` (no route change); the page heading changes to "Sign In" and the signup-only fields (Name, Betting Preferences section, password helper text) become hidden, confirming the component switched to login mode |
| 15 | Navigation | Successful signup with default preferences navigates to the Bets page | Fill in valid Name, Email, and Password values (leaving Betting Preferences unconfigured) and click "Create Account" | The signup request succeeds; URL changes to `/bets`; the "Add Bet" button on the destination page becomes visible, confirming navigation completed |
| 16 | Navigation | Successful signup with configured preferences navigates to the Bets page | Click "Configure", adjust the Betting Preferences sub-fields (e.g. uncheck a bookmaker, change the Default Bet Type), then fill in valid Name, Email, and Password values and click "Create Account" | The signup request succeeds, followed by a preferences-save request; URL changes to `/bets`; the "Add Bet" button on the destination page becomes visible, confirming navigation completed |

## Out of Scope

- **Login mode** of `AuthView.vue` (heading "Sign In", subtext "Access your betting
  tracker.", no Name field, no Betting Preferences section, no password helper text) —
  to be covered by its own dedicated UI test plan.
- **Backend/API validation content** for signup (exact error messages, field
  constraints, duplicate-email handling, status codes) — covered by
  `playwright/docs/test-plans/auth/test-plan-signup.md`. Scenario 13 only asserts that
  a server-side field error surfaces inline in the UI; it does not assert on every
  field/constraint combination the API can return — that full matrix belongs to the
  API test plan.
- **Successful signup navigation destination content.** Scenarios 15–16 assert only
  that the URL changes to `/bets` and its "Add Bet" landmark becomes visible — this
  plan does not assert on any further content of the Bets page itself, which belongs
  to that page's own UI test plan.
- **Preference save side effects** (`PUT /api/user/config`) beyond confirming the
  configuration UI's own default/interactive state — the effect of these preferences
  elsewhere in the app (e.g. defaults pre-filled on the Add Bet modal) belongs to that
  feature's own UI test plan.
- **Shared navigation bar / logout button** — not present on this page (`AuthView` is
  rendered outside `AppShellView`), so there is no shared component to reference here.

## Resolved Issues

- **Error message previously rendered as a raw stringified object — now fixed.**
  Confirmed via manual exploration against the running app (Playwright MCP): the
  duplicate-email error now correctly displays the clean message "An account with
  this email already exists." (Scenario 12), no longer the raw stringified API error
  object `{ "code": "ACCOUNT_EXISTS", "message": "..." }` observed in an earlier
  version of this plan. `AuthView.vue`'s `extractErrorMessage` helper now correctly
  reads `error?.response?.data?.error?.message` rather than the whole `error` object.
  Documented here for traceability only — no further action needed.

## Automation Status

No Playwright Page Object currently exists for `AuthView`. A `support/pages/AuthPage.ts`
(or similar) page object needs to be created before any of the scenarios below can be
automated, encapsulating the `data-test-id`-based locators listed in **Elements Under
Test** above (e.g. `nameInput`, `nameError`, `emailInput`, `emailError`,
`passwordInput`, `passwordError`, `passwordHelperText`, `authErrorMessage`,
`toggleConfigureButton`, `bookmakerCheckbox(name)`, `defaultBookmakerSelect`,
`defaultBetTypeSelect`, `defaultStakeInput`, `togglePasswordVisibilityButton`,
`submitButton`, `toggleModeButton`).

| Scenario | Status |
| --- | --- |
| 1 | ❌ Not Automated |
| 2 | ❌ Not Automated |
| 3 | ❌ Not Automated |
| 4 | ❌ Not Automated |
| 5 | ❌ Not Automated |
| 6 | ❌ Not Automated |
| 7 | ❌ Not Automated |
| 8 | ❌ Not Automated |
| 9 | ❌ Not Automated |
| 10 | ❌ Not Automated |
| 11 | ❌ Not Automated |
| 12 | ❌ Not Automated |
| 13 | ❌ Not Automated |
| 14 | ❌ Not Automated |
| 15 | ❌ Not Automated |
| 16 | ❌ Not Automated |

## References

- Application source: `apps/web/src/views/AuthView.vue`
- Auth store: `apps/web/src/stores/auth.ts`
- Router guard: `apps/web/src/router/index.ts`
- Related API test plan: `playwright/docs/test-plans/auth/test-plan-signup.md`

