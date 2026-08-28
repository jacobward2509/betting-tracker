# UI Test Plan — AuthView (Login)

## Page Information

- **URL Pattern:** `/sign-in`
- **Page Title / Heading:** `Sign In` (`<h1>`), subtext `Access your betting tracker.`
- **Description:** `AuthForm.vue` is a shared component that renders either a login form
  or a signup form depending on its `mode` prop (`"login" | "signup"`). It is rendered
  by two dedicated route-level views — `SignInView.vue` at `/sign-in` (`mode="login"`)
  and `SignUpView.vue` at `/sign-up` (`mode="signup"`) — so login and signup now live at
  distinct URLs rather than toggling client-side state at a single shared route. This
  plan covers **only** the `/sign-in` route (`login` mode). The `/sign-up` route
  (`signup` mode) is covered by
  `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`. The legacy `/auth`
  path still exists as a redirect to `/sign-in` for backwards compatibility with old
  links/bookmarks.
- **How Reached:**
  - Directly navigating to `/sign-in`.
  - Automatically redirected here by the router's `beforeEach` guard when an
    unauthenticated user attempts to visit any `requiresAuth` route (e.g. `/`, `/bets`,
    `/overall-stats`), or after signing out from an authenticated session.
  - Clicking "Already have an account? Sign in" from the `/sign-up` route.
  - Navigating to the legacy `/auth` path, which redirects here.


## Elements Under Test

| Element | Locator | Notes |
| --- | --- | --- |
| Login form | `getByTestId('auth-form')` | `<form novalidate>` — native HTML5 constraint validation is intentionally disabled; all validation is custom client-side JS. Shared with signup mode. |
| Page heading | `getByTestId('auth-heading')` | Reads "Sign In" in login mode; reads "Create Account" in signup mode (out of scope) |
| Subtext | `getByTestId('auth-subtext')` | Login-mode subtext |
| Email label | `getByTestId('email-label')` | Shared with signup mode |
| Email input | `getByTestId('email-input')` | `type="email"`, `autocomplete="email"`, trimmed (`v-model.trim`); empty by default; no placeholder text; red border + `aria-invalid="true"` when `emailError` is set; clears `emailError` on input |
| Email error | `getByTestId('email-error')` | `v-if="emailError"`; hidden by default; renders `emailError` text, e.g. "Email is required." or "Please provide a valid email address." |
| Password label | `getByTestId('password-label')` | Shared with signup mode |
| Password input | `getByTestId('password-input')` | `type="password"` by default, `autocomplete="current-password"`; empty by default; no placeholder text; red border + `aria-invalid="true"` when `passwordError` is set; clears `passwordError` on input |
| Show/hide password toggle button | `getByTestId('toggle-password-visibility-button')` | `aria-label` and icon toggle between "Show password"/"Hide password"; toggles input `type` between `password` and `text`. Shared with signup mode. |
| Password error | `getByTestId('password-error')` | `v-if="passwordError"`; hidden by default; renders `passwordError` text, e.g. "Password is required." — login has no minimum-length business rule, so there is no "too short" message in this mode |
| Password helper text | `getByTestId('password-helper-text')` | `v-else-if="mode === 'signup'"` — never rendered in login mode (signup-only), so this element is absent (not merely hidden) while in login mode |
| Auth error message | `getByTestId('auth-error-message')` | `v-if="errorMessage"`; hidden by default; renders a human-readable, top-level error message (see Test Scenarios 7–8 for the specific message and when it is triggered) |
| Submit button | `getByTestId('submit-button')` | `type="submit"`; disabled while `isSubmitting` is `true`; text reads "Sign In" by default, "Please wait..." while submitting |
| Mode toggle link | `getByTestId('toggle-mode-button')` | Clicking navigates to the `/sign-up` route. Reads "Need an account? Sign up" in login mode. |
| Signup-only elements (Name field, Betting Preferences section) | N/A | Never rendered in login mode (`v-if="mode === 'signup'"`) — absent from the DOM entirely, not merely hidden; covered by the signup test plan |
| "Add Bet" button (destination landmark) | `getByTestId('add-bet-button')` on `/bets` | Not part of this component; used only as the landmark confirming successful login navigation completed (per Out of Scope, its own behavior belongs to the Bets page's own UI test plan) |

## Test Coverage Summary

**Total Scenarios: 9**
- Cosmetic: 1
- Functional: 7
- Navigation: 1

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | Login page loads correctly | Navigate to `/sign-in`. Verify the page URL, heading, subtext, the Email and Password labels, both inputs' empty initial state (and absence of placeholder text), the submit button, and the mode toggle button; also verify the signup-only elements (Name field, Betting Preferences section, password helper text) are absent from the DOM entirely | URL is `/sign-in`; heading reads "Sign In"; subtext reads "Access your betting tracker."; Email and Password inputs are visible, empty, and enabled with no placeholder text; "Sign In" submit button is visible and enabled with correct text; "Need an account? Sign up" toggle button is visible; Name input, Betting Preferences heading, and password helper text are not present in the DOM; no field error paragraphs (`email-error`, `password-error`, `auth-error-message`) are visible |
| 2 | Functional | Password visibility toggle | On the login form, fill the Password input with a value, then click the show/hide password toggle button | Password input's `type` changes from `password` to `text` (value becomes visible) and the button's `aria-label` changes from "Show password" to "Hide password"; clicking again reverts both to their original state |
| 3 | Functional | Submit button disables and shows "Please wait..." while submitting | Fill in a valid Email and Password and click "Sign In" | Immediately after clicking, the submit button becomes disabled and its label changes to "Please wait..." until the login request resolves |
| 4 | Functional | Custom inline validation errors shown for empty required fields | Click "Sign In" with the Email and Password fields both empty | Both field-level errors become visible simultaneously: `email-error` reads "Email is required.", `password-error` reads "Password is required."; each corresponding input has `aria-invalid="true"` and a red border; no `POST /api/auth/login` request is sent |
| 5 | Functional | Custom inline validation error for invalid email format | Fill the Email field with `not-an-email` and a non-empty Password, then click "Sign In" | Only `email-error` becomes visible, reading "Please provide a valid email address."; `password-error` remains hidden; no `POST /api/auth/login` request is sent |
| 6 | Functional | Field error clears independently on input | Trigger the Email and Password errors from Scenario 4, then type a single character into the Email field only | `email-error` immediately disappears and the Email input's `aria-invalid` is removed; `password-error` remains visible and unaffected |
| 7 | Functional | Generic error shown for invalid credentials | Submit the login form with a well-formed email that has no registered account | `auth-error-message` becomes visible below the Password field showing the message "Invalid email or password."; the submit button re-enables and its text reverts to "Sign In" |
| 8 | Functional | Identical error for unknown email vs. correct email/wrong password | Submit the login form once with a well-formed but unregistered email (Scenario 7), and once with a registered email but an incorrect password | Both submissions show the exact same `auth-error-message` text, "Invalid email or password.", confirming the UI does not distinguish between the two failure modes (matching the API's anti-enumeration behavior documented in the related API test plan) |
| 9 | Navigation | Successful login navigates to the Bets page | Fill in a registered account's valid Email and Password values and click "Sign In" | The login request succeeds; URL changes to `/bets`; the "Add Bet" button on the destination page becomes visible, confirming navigation completed |

## Out of Scope

- **Signup mode** of `AuthForm.vue` at the `/sign-up` route (heading "Create Account",
  subtext "Start tracking
  your bets.", Name field, Betting Preferences section, password helper text) —
  covered by `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`.
- **"Need an account? Sign up" mode toggle navigation itself** (i.e. confirming the
  transition into signup mode and its cosmetic state) — covered by Scenario 1 of the
  signup test plan; this plan only documents the toggle button's presence/text in
  login mode (see Elements Under Test) and does not re-assert the signup-mode result.
- **Backend/API validation content** for login (exact error messages, field
  constraints, status codes, the anti-enumeration mechanism's server-side
  implementation) — covered by `playwright/docs/test-plans/api/auth/test-plan-login.md`.
  Scenarios 7–8 only assert that the UI surfaces a single, generic top-level error for
  both invalid-credential cases; they do not assert on every field/constraint
  combination the API can return — that full matrix belongs to the API test plan.
- **Successful login navigation destination content.** Scenario 9 asserts only that
  the URL changes to `/bets` and its "Add Bet" landmark becomes visible — this plan
  does not assert on any further content of the Bets page itself, which belongs to
  that page's own UI test plan.
- **Sign-out / router-guard redirect behavior** (e.g. unauthenticated users being
  redirected to `/sign-in`, or signing out returning here) — these are cross-cutting
  router/session behaviors, not part of this component's own scope; noted here only
  as a "How Reached" entry point.
- **Shared navigation bar / logout button** — not present on this page (`AuthForm` is
  rendered outside `AppShellView`), so there is no shared component to reference here.

## Automation Status

Automated by `support/pages/auth.page.ts` (`AuthPage`) and `support/pages/bets.page.ts`
(`BetsPage`).

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ✅ Automated | `tests/smoke/auth-login.spec.ts` |
| 2 | ✅ Automated | `tests/functional/auth-login-credentials.spec.ts` |
| 3 | ✅ Automated | `tests/functional/auth-login-credentials.spec.ts` |
| 4 | ✅ Automated | `tests/functional/auth-login-validation.spec.ts` |
| 5 | ✅ Automated | `tests/functional/auth-login-validation.spec.ts` |
| 6 | ✅ Automated | `tests/functional/auth-login-validation.spec.ts` |
| 7 | ✅ Automated | `tests/functional/auth-login-credentials.spec.ts` |
| 8 | ✅ Automated | `tests/functional/auth-login-credentials.spec.ts` |
| 9 | ✅ Automated | `tests/e2e/login-journey.spec.ts` |

> `AuthPage` (`support/pages/auth.page.ts`) exposes all locators/methods needed for
> this plan (`authHeading`, `authSubtext`, `emailInput`, `emailError`, `passwordInput`,
> `passwordError`, `togglePasswordVisibilityButton`, `authErrorMessage`,
> `submitButton`, `toggleModeButton`) — including `goto('login' | 'signup')` and
> `expectLoaded(mode?)`, which are now route-aware since login and signup live at
> distinct URLs (`/sign-in` and `/sign-up`).

## References

- Application source: `apps/web/src/components/AuthForm.vue`,
  `apps/web/src/views/SignInView.vue`
- Auth store: `apps/web/src/stores/auth.ts`
- Router guard: `apps/web/src/router/index.ts`

- Related API test plan: `playwright/docs/test-plans/api/auth/test-plan-login.md`
- Related UI test plan (signup mode of the same component): `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`

