# UI Test Plan — AppShellView Tab Navigation

## Page Information

- **Component:** `TabNav.vue` (not a routed page itself, but a shared tab-navigation
  component rendered on every authenticated route via `AppShellView.vue`, immediately
  below the shared header — see `TopBanner.vue` in
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`). `TabNav.vue` is a
  decoupled sibling of `TopBanner.vue` within `AppShellView`, covered by its own plan
  per that plan's explicit deferral note.
- **URL Patterns:** `/bets`, `/overall-stats` (the only two routes `TabNav.vue` currently
  links to; any current or future route nested under `AppShellView`'s `requiresAuth`
  shell will render this component, but only these two tabs exist today).
- **Description:** `TabNav.vue` renders a two-tab horizontal navigation bar with a
  "Bets" tab (`RouterLink` to `/bets`) and an "Overall Stats" tab (`RouterLink` to
  `/overall-stats`). Each tab's CSS classes are computed reactively from
  `route.path`: the tab matching the current route gets the active classes
  (`border-blue-600 text-blue-600 dark:text-blue-400`), while the other tab gets the
  inactive classes (`border-transparent text-gray-600 hover:text-gray-900
  dark:text-gray-300 dark:hover:text-white`). Clicking a tab performs a client-side
  navigation (via `RouterLink`) which changes the URL and re-evaluates both tabs'
  active/inactive state accordingly.
- **How Reached:** Automatically rendered on every authenticated page load (any route
  under `AppShellView`), directly beneath the `TopBanner` header. No interaction is
  required to reach it.

## Elements Under Test

| Element | Locator | Notes |
| --- | --- | --- |
| Tab nav container | `getByTestId('tab-nav')` | Horizontal bar containing both tabs; always visible on authenticated routes |
| "Bets" tab link | `getByTestId('tab-nav-bets')` | `RouterLink` to `/bets`; text "Bets"; carries active classes (`border-blue-600 text-blue-600 dark:text-blue-400`) when `route.path === '/bets'`, otherwise inactive classes (`border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white`) |
| "Overall Stats" tab link | `getByTestId('tab-nav-overall-stats')` | `RouterLink` to `/overall-stats`; text "Overall Stats"; carries active classes when `route.path === '/overall-stats'`, otherwise inactive classes |

## Test Coverage Summary

**Total Scenarios:** 3 (1 Cosmetic, 0 Functional, 2 Navigation)

## Test Scenarios

| Scenario | Scenario Type | Use Case | Description | Expected Result |
| --- | --- | --- | --- | --- |
| 1 | Cosmetic | TabNav renders correctly on `/bets` | Navigate to `/bets` (authenticated). Verify the tab nav container, and both tab links' visibility, text, and active/inactive state | Tab nav container is visible; "Bets" tab link is visible with text "Bets" and carries the active classes (`border-blue-600 text-blue-600 dark:text-blue-400`); "Overall Stats" tab link is visible with text "Overall Stats" and carries the inactive classes (`border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white`) |
| 2 | Navigation | "Overall Stats" tab navigates to `/overall-stats` and updates active tab state | From `/bets`, click the "Overall Stats" tab link | URL changes to `/overall-stats`; the "Overall" section heading on the destination page is visible; "Overall Stats" tab link now carries the active classes; "Bets" tab link now carries the inactive classes |
| 3 | Navigation | "Bets" tab navigates back to `/bets` and updates active tab state | From `/overall-stats`, click the "Bets" tab link | URL changes to `/bets`; the "Add Bet" button on the destination page is visible; "Bets" tab link now carries the active classes; "Overall Stats" tab link now carries the inactive classes |

## Out of Scope

- **Functional/cosmetic behaviour of `BetsView` and `OverallStatsView` beyond confirming
  navigation landmark visibility** — each destination page's own content, filters, and
  data belong to their own future dedicated UI test plans, per the "Scope Tightly"
  best practice.
- **`TopBanner.vue` and its user-menu children** (`UserMenuDisplayName.vue`,
  `UserMenuVisualPreferences.vue`, `UserMenuBetPreferences.vue`) — already covered by
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`.
- **Any additional authenticated routes rendered under `AppShellView`** beyond `/bets`
  and `/overall-stats` — none currently exist; this plan will need revisiting if
  `TabNav.vue` gains further tabs.
- **Backend/API validation** — not applicable; `TabNav.vue` makes no API calls.

## Automation Status

Automated by `support/pages/tab-nav.page.ts` (`TabNavPage`), which exposes the tab-nav
container, both tab link locators, click helpers, and `expectCosmeticElements()` /
`expectActiveTab()` assertion helpers. Scenarios 2-3 additionally use the new minimal
`OverallStatsPage` (`support/pages/overall-stats.page.ts`, exposing only the "Overall"
heading landmark) and the existing `BetsPage` (`support/pages/bets.page.ts`, exposing
the "Add Bet" button landmark) to confirm destination-page navigation.

| Scenario | Status | Spec file |
| --- | --- | --- |
| 1 | ✅ Automated | `tests/smoke/tab-nav.spec.ts` |
| 2 | ✅ Automated | `tests/e2e/tab-nav-journey.spec.ts` |
| 3 | ✅ Automated | `tests/e2e/tab-nav-journey.spec.ts` |

## References

- Application source: `apps/web/src/components/TabNav.vue`,
  `apps/web/src/views/AppShellView.vue`
- Related UI test plan (shared header, decoupled sibling in the same shell):
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`
- Page Objects: `playwright/support/pages/tab-nav.page.ts`,
  `playwright/support/pages/overall-stats.page.ts`,
  `playwright/support/pages/bets.page.ts`
