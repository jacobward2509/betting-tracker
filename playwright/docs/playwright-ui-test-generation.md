# Playwright UI Test Generation Guide

This guide explains how to write Playwright UI tests using the Page Object Model, split across three distinct test tiers: **Smoke**, **Functional**, and **E2E**. Follow it whenever you are adding test coverage for a new page, component, feature, or journey so that all coverage is organised consistently.

---

## 1. Introduction

### What This Guide Covers

This guide covers the full workflow for writing Playwright UI tests: the three test tiers and when to use each, file structure, the Page Object Model, the Journeys layer, shared components, authentication/session strategy, test organisation, locator conventions, assertion patterns, shared data and network-derived data, and best practices — finishing with a complete worked example and a quick reference section.

### The Three Test Tiers

Every UI test belongs to exactly one of three tiers. Deciding the tier first makes every other decision (file location, `describe` grouping, how much abstraction is appropriate) fall out naturally.

| Tier | Question it answers | Scope | Speed |
| --- | --- | --- | --- |
| **Smoke** | "Does every element that should render, render correctly?" | One component per test. Cosmetic only — text, visibility, dropdown options, table headers, toggle states. | Fast, many small tests |
| **Functional** | "Does this one feature work in isolation?" | A single feature (search, sort, a toggle, validation) with no dependency on a full journey. | Fast — reach the state directly where possible |
| **E2E** | "Can a user complete this real journey end-to-end?" | Multiple components/pages combined into one flow, asserting business outcomes at each step. | Slower, fewer, high-value tests |

A cosmetic check and a feature check and a journey check are never the same test. If you find yourself combining more than one of these concerns in a single `test()`, split it.

### Where Tests Live

```
tests/
├── smoke/
│   └── <component-name>.spec.ts       ← one spec per page; one test() per component within it
├── functional/
│   └── <feature-name>.spec.ts         ← one spec per isolated feature
└── e2e/
    └── <journey-name>.spec.ts         ← one spec per user journey / scenario group

support/
├── pages/
│   ├── <page-name>.page.ts            ← one Page Object class per page
│   └── shared/
│       ├── <component>.component.ts  ← shared component class (e.g. navigation bar, header)
│       └── <data-name>.ts            ← shared static data referenced by multiple page objects
└── journeys/
    └── <journey-name>.journey.ts      ← orchestration helpers spanning multiple pages (no assertions)
```

Page Objects and the Journeys layer are shared infrastructure used by all three tiers — they are not tied to any one tier.

### Prerequisites

- Node.js installed
- `npm install` run at repo root
- Run UI tests with `npx playwright test --project=ui` (or `--project=smoke` / `--project=functional` / `--project=e2e` once tier-specific projects are configured)

---


## 2. File Structure

### One Spec File Per Page (Smoke), Feature (Functional), or Journey (E2E)

Each tier has its own naming convention for spec files:

```
tests/smoke/login-page.spec.ts             ← smoke: one spec per page, containing one test() per component
tests/functional/customer-search.spec.ts   ← functional: one spec per isolated feature
tests/e2e/create-new-order.spec.ts         ← e2e: one spec per journey / scenario group
```

### One Page Object Per Page

Each page has a corresponding Page Object class in `support/pages/`, shared across all three tiers:

```
support/pages/login.page.ts       → LoginPage
support/pages/dashboard.page.ts   → DashboardPage
support/pages/settings.page.ts    → SettingsPage
```

### The Journeys Layer

Multi-step flows that span more than one page live in `support/journeys/` as plain async functions, not classes:

```
support/journeys/create-new-order.journey.ts   → goToCreateNewOrder(page, ...)
support/journeys/delivery-address.journey.ts   → goToDeliveryAddressModal(page)
```

**Journeys orchestrate; they never assert.** A journey function's job is to drive the page through a sequence of steps and return any data the caller needs (e.g. a generated customer name, a product code extracted from a network response). It must not contain `expect()` calls. This keeps a hard boundary between "get the app into state X" (journey) and "is state X correct" (test / page object). See [Section 5b: E2E Tests](#5b-e2e-tests) for how specs use journeys, and [Section 7](#7-assertion-patterns) for where the resulting assertions belong.

```typescript
// support/journeys/delivery-address.journey.ts
import { Page } from '@playwright/test';
import { ProductLineDetailsTab } from '@pages/product-line-details-tab.page';
import { OrderJourney } from '@pages/order-journey.page';
import { goToProductLineDetailsTab } from './product-line-details.journey';

/** Drives the app from the start of the wizard to the Delivery Address modal. No assertions. */
export async function goToDeliveryAddressModal(page: Page) {
  const productLineDetailsTab = new ProductLineDetailsTab(page);
  const orderJourney = new OrderJourney(page);

  const productCode = await goToProductLineDetailsTab(page);
  await productLineDetailsTab.populateProductLine('1', productCode);
  await productLineDetailsTab.confirmProductLine();
  await orderJourney.navigateForwardViaContinue();

  return productCode;
}
```

### Shared Support Files

Files shared across multiple page objects live in `support/pages/shared/`:

```
support/pages/shared/<component>.component.ts  → shared component class (e.g. AppHeaderComponent)
support/pages/shared/<data-name>.ts            → shared static data constants
```

### Import Aliases

Use path aliases (configured in `tsconfig.json`) to keep imports clean:

```typescript
import { LoginPage } from '@pages/login.page';
import { DashboardPage } from '@pages/dashboard.page';
import { AppHeaderComponent } from '@pages/shared/app-header.component';
import { SEED_DATA_CONSTANT } from '@pages/shared/seed-data';
import { goToDeliveryAddressModal } from '@journeys/delivery-address.journey';
```

The `@pages/*` alias resolves to `support/pages/*`. The `@journeys/*` alias resolves to `support/journeys/*`.

---


## 3. Page Object Model

### Class Shape

Every Page Object follows the same structure:

1. `readonly page: Page` — the Playwright `Page` instance
2. `readonly <sharedComponent>: SharedComponentClass` — any shared component present on every page (e.g. a navigation bar or header), held via composition
3. `readonly <elementName>: Locator` — one `readonly` property per element under test
4. `static readonly EXPECTED_<NAME>` — static constants for expected option lists or column headers
5. `constructor(page: Page)` — assigns `this.page`, instantiates any shared components, and defines all locators
6. Action methods — `async` methods that perform interactions (e.g. `clickSubmit()`, `selectOption()`)
7. `async expectLoaded()` — lightweight smoke check for the whole page
8. `async expectCosmeticElements()` **per component** — see [Component-Scoped Cosmetic Checks](#component-scoped-cosmetic-checks) below

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { AppHeaderComponent } from '@pages/shared/app-header.component';

export class MyPage {
  readonly page: Page;
  readonly header: AppHeaderComponent;

  readonly myButton: Locator;
  readonly myInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new AppHeaderComponent(page);

    this.myButton = page.getByRole('button', { name: 'My Button' });
    this.myInput = page.getByPlaceholder('My Input');
  }

  async clickMyButton() {
    await this.myButton.click();
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'My page URL should be /my-route').toHaveURL(/\/my-route/);
    await expect(this.myButton, 'My button should be visible').toBeVisible();
  }

  /** Exhaustive cosmetic check for the "My Button" component only. */
  async expectMyButtonCosmeticElements() {
    await expect(this.myButton, 'My button should be visible').toBeVisible();
    await expect(this.myButton, 'My button should read "My Button"').toHaveText('My Button');
    await expect(this.myButton, 'My button should be enabled').toBeEnabled();
  }
}
```

### `expectLoaded()`

A **lightweight smoke check** used to confirm that navigation to the page succeeded. It asserts:

1. The URL matches the page's route (using a regex or exact match)
2. One defining locator is visible (the most distinctive element on the page)

```typescript
/** Lightweight smoke check: URL and one defining locator. */
async expectLoaded() {
  await expect(this.page, 'My page URL should be /my-route').toHaveURL(/\/my-route/)
  await expect(this.myDefiningElement, 'My defining element should be visible').toBeVisible()
}
```

Use `expectLoaded()` in Navigation tests on the **destination** page to confirm the navigation completed, and at the start of an E2E journey step to confirm the app has reached the expected page before continuing.

### Component-Scoped Cosmetic Checks

**Cosmetic assertions must never be grouped into a single method that covers an entire page.** Every component on a page — including any shared component composed into it — gets its own `expectCosmeticElements()`-style method, scoped only to that component's own locators.

Why: a single page-level cosmetic method that checks every label, input, dropdown, and table on the page produces one giant test that is slow to read, and a failure part-way through tells you almost nothing about which component broke. Splitting by component means each Smoke test (see [Section 5: Smoke Tests](#5-smoke-tests)) is short, fast, and its failure message is immediately specific.

Naming convention: `expect<ComponentName>CosmeticElements()`, e.g. `expectOrderMethodRadioGroupCosmeticElements()`, `expectProductLineTableCosmeticElements()`. If a page genuinely has only one component (no sub-sections), a single method is correct — the rule is "one method per component," which may equal "one method per page" for the simplest pages, but must never be assumed by default.

```typescript
export class OrderTypeTab {
  readonly orderMethodsLabel: Locator;
  readonly newOrderRadio: Locator;
  readonly existingOrderRadio: Locator;
  readonly orderTypesLabel: Locator;
  readonly straightOrderRadio: Locator;
  readonly doubleBookingOrderRadio: Locator;

  static readonly EXPECTED_ORDER_METHOD_LABELS = ['Create New Order', 'Update Existing Order'];
  static readonly EXPECTED_ORDER_TYPE_LABELS = ['Straight Order', 'Double Booking'];

  /** Cosmetic check for the Order Method radio group component only. */
  async expectOrderMethodRadioGroupCosmeticElements() {
    await expect(this.orderMethodsLabel, 'Order Method label should be visible').toBeVisible();
    await expect(this.newOrderRadio, 'Create New Order radio should be checked by default').toBeChecked();
    await expect(this.existingOrderRadio, 'Update Existing Order radio should not be checked by default').not.toBeChecked();
  }

  /** Cosmetic check for the Order Type radio group component only. */
  async expectOrderTypeRadioGroupCosmeticElements() {
    await expect(this.orderTypesLabel, 'Order Type label should be visible').toBeVisible();
    await expect(this.straightOrderRadio, 'Straight Order radio should be checked by default').toBeChecked();
    await expect(this.doubleBookingOrderRadio, 'Double Booking radio should not be checked by default').not.toBeChecked();
  }
}
```

### Shared Component Pattern

When a component (e.g. a navigation bar, header, or footer) is rendered on every page, encapsulate it in a dedicated shared component class in `support/pages/shared/`. Every Page Object holds an instance of it via composition:

```typescript
readonly header: AppHeaderComponent

constructor(page: Page) {
  this.header = new AppHeaderComponent(page)
}
```

The shared component class exposes its own locators, action methods, and its own `expectCosmeticElements()` method — this is itself just another "component" for the purposes of the rule above, and gets its own dedicated Smoke test rather than being folded into a page-level check:

```typescript
// In a Smoke spec:
test('Cosmetic - header renders with correct navigation items', async ({ page }) => {
  const myPage = new MyPage(page);
  await myPage.header.expectCosmeticElements();
});
```

Access the shared component's actions directly from the spec via the page object:

```typescript
await myPage.header.clickHome();
```

**Never re-declare locators that belong to a shared component in a Page Object.** Always delegate to the shared component class.

---



## 4. Authentication and Session Strategy

### Target State: `ui-setup` Project with `storageState`

The recommended, target authentication strategy is a dedicated `ui-setup` Playwright project that performs a login once and saves the resulting browser storage state (cookies, localStorage) to disk. All `smoke`, `functional`, and `e2e` projects then depend on `ui-setup` and reuse the saved state, avoiding a full login flow in every test:

```typescript
// playwright.config.ts (target state)
{
  name: 'ui-setup',
  testMatch: /setup\/ui\.setup\.ts/,
  use: {
    ...devices['Desktop Chrome'],
  },
},
{
  name: 'smoke',
  testMatch: /smoke\/.*\.spec\.ts/,
  dependencies: ['ui-setup'],
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'playwright/.auth/user.json',
  },
},
// functional and e2e projects follow the same pattern
```

The `ui-setup` file (`tests/setup/ui.setup.ts`) performs a login once, saves the storage state to `playwright/.auth/user.json`, and every dependent project starts directly on the authenticated page.

If tests must run across multiple browsers with isolated sessions (e.g. chromium/firefox/webkit each needing their own state to run in parallel without clashing), run `ui-setup` once per browser and write a separate storage state file per browser, then reference the matching file from each browser's `smoke`/`functional`/`e2e` project:

```typescript
{ name: 'ui-setup-chromium', testMatch: /setup\/ui\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
{ name: 'chromium', dependencies: ['ui-setup-chromium'], use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/chromium.json' } },
// repeat per browser
```

### Legacy Interim Approach (To Be Migrated)

Some repos currently use a `globalSetup` script (configured via `globalSetup` in `playwright.config.ts`) that manually signs in once per worker and writes a `storageState` file per worker (e.g. `auth/worker-0.json`, `auth/worker-1.json`, ...), consumed directly via each browser project's `use.storageState`.

**This is a legacy interim approach and should be migrated to the `ui-setup` project pattern above.** It works, but it bypasses Playwright's project-dependency model, couples the worker count to a hardcoded constant, and doesn't fit cleanly into the three-tier (`smoke`/`functional`/`e2e`) project structure this guide recommends. Do not use it as a template for new repos; treat any existing `globalSetup`-based auth as a candidate for migration.

### What This Means for Tests Without Any Setup Project Yet

If neither `ui-setup` nor a legacy `globalSetup` is configured yet, every spec file that requires a logged-in state must navigate and perform the login steps in `test.beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.clickLogin();
});
```

Once `ui-setup` is introduced, these `beforeEach` navigation steps are removed and replaced by the saved `storageState`.

---


## 5. Smoke Tests

Smoke tests answer: **"Does every element that should render, render correctly?"** They are cosmetic-only, fast, and thorough within their scope — but that scope is always a single component, never a whole page.

### One `describe` Per Page, One `test()` Per Component

```typescript
test.describe('Order Type Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Cosmetic - Order Method radio group renders with correct labels and default selection', async ({ page }) => {
    const orderTypeTab = new OrderTypeTab(page);
    await orderTypeTab.expectOrderMethodRadioGroupCosmeticElements();
  });

  test('Cosmetic - Order Type radio group renders with correct labels and default selection', async ({ page }) => {
    const orderTypeTab = new OrderTypeTab(page);
    await orderTypeTab.expectOrderTypeRadioGroupCosmeticElements();
  });
});
```

Each Smoke test must still be exhaustive **within its own component**: assert every label's text, every input's placeholder/empty-state, every button's text/visibility/enabled state, every dropdown's complete ordered option list (`toHaveText()` on the `option` locator) and default value, every table's column headers, every toggle's on/off states, and any element hidden on initial load (`toBeHidden()`). What changes from the previous single-page model is scope, not thoroughness.

### Smoke Test Naming

| Scenario | Pattern | Example |
| --- | --- | --- |
| Component cosmetic | `'Cosmetic - <component> renders with <what>'` | `'Cosmetic - Product Line table renders with correct column headers'` |
| Page load smoke check | `'Cosmetic - page loads with heading and navigation buttons visible'` | (still used for a lightweight `expectLoaded()`-only test if one is needed) |

---

## 5a. Functional Tests

Functional tests answer: **"Does this one feature work in isolation?"** — search, sort, a toggle's behavioural effect, form validation. A functional test has no bearing on, and no dependency on, completing a broader end-to-end journey.

### Reach the Required State Directly

Where possible, get to the state under test directly — via seeded data (see [Section 8a](#8a-data-seeding-and-network-derived-data)), direct navigation, or stubbing a response — rather than driving through several unrelated upstream tabs just to reach the feature. This keeps functional tests fast and decoupled from the stability of unrelated parts of the journey.

```typescript
test.describe('Customer Search', () => {
  test('Typing a partial customer name filters the typeahead results', async ({ page }) => {
    const coreOrderDetailsTab = new CoreOrderDetailsTab(page);
    await page.goto('/'); // reached directly; no need to complete prior tabs first

    await coreOrderDetailsTab.customerField.fill('Smith');

    // Inline assertion is fine here — see Section 7 for when to prefer this over a page object method
    await expect(coreOrderDetailsTab.customerResult, 'Typeahead results should only show matches containing "Smith"').toContainText('Smith');
  });
});
```

### `describe` Grouped by Feature

```typescript
test.describe('Payment Method Selection', () => { ... })
test.describe('Delivery Address Source Toggle', () => { ... })
```

---

## 5b. E2E Tests

E2E tests answer: **"Can a user complete this real journey end-to-end?"** Multiple components and pages combine into one flow, and the test asserts business outcomes at meaningful steps along the way.

### Journeys Orchestrate, Specs Assert

An E2E spec calls a journey function to reach a step, asserts the outcome of that step, then calls the next journey step (or performs the next action directly if it's simple). Journeys never contain `expect()` — see [Section 2: The Journeys Layer](#the-journeys-layer).

```typescript
test.describe('Create New Order - Straight Order with Manual Address', () => {
  test('User can create a new straight order with a manually entered delivery address', async ({ page }) => {
    const orderTypeTab = new OrderTypeTab(page);
    const deliveryModal = new DeliveryModal(page);
    const deliveryAddressTab = new DeliveryAddressTab(page);
    const summaryTab = new SummaryTab(page);

    const productCode = await goToDeliveryAddressModal(page); // journey: orchestration only

    await deliveryModal.manualAddressButton.click();
    await deliveryAddressTab.populateDeliveryAddressTab('123 Test Road', 'Brockville', 'Ottawa', 'ABC123');

    // Assertion lives in the spec — the outcome of this specific journey step
    await expect(summaryTab.deliveryAddress, 'Summary should show the manually entered delivery address').toContainText('123 Test Road');
  });
});
```

### `describe` Grouped by Journey / Scenario

```typescript
test.describe('Create New Order - Straight Order with Manual Address', () => { ... })
test.describe('Update Existing Order - Confirm Scenarios', () => { ... })
```

---


## 5c. Shared Test Organisation Rules (All Tiers)

These rules apply uniformly across Smoke, Functional, and E2E specs.

### `beforeEach` and `afterEach` for Repeatable Steps

Use `test.beforeEach` for shared setup (navigation, seeding) and `test.afterEach` for shared teardown (cleanup, deleting seeded data) whenever every test in a `describe` block repeats the same step:

```typescript
test.describe('Edit Existing Customer', () => {
  let customerId: string;

  test.beforeEach(async ({ request }) => {
    customerId = await createCustomerViaApi(request); // see Section 8a
  });

  test.afterEach(async ({ request }) => {
    await deleteCustomerViaApi(request, customerId); // cleanup, always runs even on failure
  });

  // tests use `customerId`
});
```

When tests in a spec file have **different** prerequisites (e.g. one test needs a different starting state to another), do not force a shared `beforeEach` — set up inside each individual test instead.

### Page Object and Journey Instantiation

Instantiate Page Objects **inside** each test (or `beforeEach`), not at the describe scope — the `page` fixture is scoped per-test:

```typescript
// ✅ Correct — instantiated inside the test
test('...', async ({ page }) => {
  const parentPage = new ParentPage(page);
  const subPage = new SubPage(page);
  // ...
});

// ❌ Wrong — instantiated at describe scope (page fixture not available there)
test.describe('My Page', () => {
  const myPage = new MyPage(page); // page is not in scope here
});
```

### Test Naming Conventions

| Scenario Type | Test Name Pattern | Example |
| --- | --- | --- |
| Smoke (component cosmetic) | `'Cosmetic - <component> renders with <what>'` | `'Cosmetic - Product Line table renders with correct column headers'` |
| Functional (hidden) | `'<Element> is hidden until <condition>'` | `'Submit button is hidden until all required fields are filled'` |
| Functional (visible) | `'<Element> becomes visible after <action>'` | `'Submit button becomes visible after completing the form'` |
| E2E (navigation) | `'<Action> navigates to the <destination> page'` | `'Login button navigates to the dashboard page'` |
| E2E (navigation, shared) | `'<NavigationElement> navigates <direction>'` | `'Home button navigates back to the landing page'` |
| E2E (navigation, tab) | `'<Tab name> tab navigates to the <sub-page> page'` | `'Settings tab navigates to the settings page'` |
| E2E (journey) | `'User can <complete the journey>'` | `'User can create a new straight order with a manually entered delivery address'` |

---


## 6. Locator Strategy

### Preferred Locator Methods

Prefer `getByTestId('...')` wherever the application exposes a dedicated test attribute (e.g. `data-testid` / `data-test-id`). It is the most resilient locator against copy changes, markup restructuring, and accessibility-tree differences, and should be the **default first choice whenever a test attribute is present** — not a fallback:

| Priority | Method | When to use |
| --- | --- | --- |
| 1 | `getByTestId('...')` | Default first choice whenever the element has a dedicated test attribute |
| 2 | `getByRole('button', { name: '...' })` | Buttons and links with accessible names, when no test attribute exists |
| 3 | `getByPlaceholder('...')` | Form inputs with placeholder text, when no test attribute exists |
| 4 | `getByLabel('...')` | Form inputs associated with a visible label, when no test attribute exists |
| 5 | `getByRole('combobox')` / `#id` | Dropdowns, when no test attribute exists (use `#id` when `getByRole` is ambiguous) |
| 6 | `locator('css-selector')` | When no test attribute, accessible role, placeholder, or label is available |
| 7 | `locator('[attribute="..."]')` | Framework-specific attributes as a last resort |

Playwright's `getByTestId()` reads from the `data-testid` attribute by default. If the app under test uses a different attribute name (e.g. `data-test-id`, as in this repo), set `testIdAttribute` in `playwright.config.ts`'s `use` block so `getByTestId()` targets the app's actual attribute instead of needing manual `locator('[data-test-id="..."]')` calls:

```typescript
// playwright.config.ts
use: {
  testIdAttribute: 'data-test-id',
  // ...
},
```

Confirm the test-attribute convention exists and is applied consistently across the component before relying on it — don't mix `getByTestId()` and manually-built `locator('[data-test-id="..."]')` strings for the same attribute within one page object; once `testIdAttribute` is configured, use `getByTestId()` uniformly. Existing page objects in this repo that use `locator('[data-test-id="..."]', { hasText: ... })` are functionally equivalent and do not need an urgent rewrite, but new and updated page objects should use `getByTestId()` going forward.

### Scoping to Avoid Ambiguity

When a locator would match multiple elements on the page, scope the locator to a parent container:

```typescript
// ❌ Ambiguous — matches both the tab button and the form submit button
page.getByRole('button', { name: 'Add Item' });

// ✅ Scoped to the form — unambiguous
page.locator('form').getByRole('button', { name: 'Add Item' });
```

### Label Locators via Parent Container

```typescript
this.firstNameInput = page.getByPlaceholder('First Name');
this.firstNameLabel = page.locator('.form-group', { has: this.firstNameInput }).locator('label');
```

### Static Constants for Option Lists and Column Headers

Declare expected option lists and column headers as `static readonly` class properties so they are accessible without instantiating the page object, and never hardcoded in a spec file (see [Section 8](#8-shared-data)):

```typescript
static readonly EXPECTED_STATUS_OPTIONS = ['-- Select --', 'Active', 'Inactive', 'Pending']
static readonly EXPECTED_COLUMN_HEADERS = ['Name', 'Email', 'Status', 'Actions']
```

When the same data is referenced by multiple page objects, centralise it in `support/pages/shared/`.

---


## 7. Assertion Patterns

### Assertion Messages Are Mandatory — Zero Exceptions, Across All Three Tiers

**Every `expect(...)` call must include a descriptive message as its second argument.** This applies uniformly to web-first/locator assertions (`toBeVisible`, `toHaveText`, `toHaveURL`, etc.) and generic value assertions (`toBe`, `toBeTruthy`, etc.), and it applies identically whether the assertion lives in a Smoke, Functional, or E2E test, inline in a spec, or inside a page object method. There is no exception to this rule anywhere in the suite.

```typescript
await expect(locator, 'Dashboard page heading should be visible').toBeVisible();
expect(value, 'ExportCustomers response should contain an export ID').toBeTruthy();
```

Guidelines for writing the message:

- Phrase it as a plain-English statement of what should be true, in the form `'<Subject> should <expected state>'`.
- Reference the page or component name for page-level/component-level checks so the failure is unambiguous across spec files.
- Keep it short and specific enough to identify the failing assertion from the test report alone.
- Inside a loop, build the message dynamically from the loop variable:

```typescript
for (const [index, item] of topLevelItems.entries()) {
  const itemText = MyNavComponent.EXPECTED_TOP_LEVEL_ITEM_TEXT[index];
  await expect(item, `"${itemText}" nav item should be visible`).toBeVisible();
}
```

### Inline Assertions vs. Page Object Assertion Methods — Readability First

**Default to inline assertions in the spec whenever they make the test easier to read.** The tests need to be understood end-to-end by anyone on the team — QA and engineers of any experience level — without needing to jump into page object internals to see what's actually being checked. Do not create abstraction for the sake of it.

The rule for when to promote an assertion into a page-object `expect*()` method is **reuse, not location**:

- If an assertion (or a small group of related assertions) is used in **two or more places**, promote it to a page-object method so the check and its wording stay consistent everywhere it's used. This is exactly the [Component-Scoped Cosmetic Checks](#component-scoped-cosmetic-checks) pattern — cosmetic checks are reused across Smoke tests by definition, so they belong on the page object.
- If an assertion is genuinely used **once** — a one-off dynamic comparison in an E2E journey step, a spot-check on a captured network response, a functional test's specific behavioural check — write it inline in the spec with a clear message. Do not create a single-use page object method just to house it.

```typescript
// ✅ Correct — reused across multiple Smoke tests, belongs on the page object
await orderTypeTab.expectOrderMethodRadioGroupCosmeticElements();

// ✅ Correct — one-off inline assertion in an E2E test, more readable in context
const nameBefore = await customerManagementPage.customerTableNames.first().textContent();
await customerManagementPage.clickSortByNameAndWaitForResponse();
const nameAfter = await customerManagementPage.customerTableNames.first().textContent();
expect(nameAfter, 'First row name should change after reversing the sort order').not.toBe(nameBefore);

// ✅ Correct — one-off inline assertion in a functional test
await coreOrderDetailsTab.customerField.fill('Smith');
await expect(coreOrderDetailsTab.customerResult, 'Typeahead results should only show matches containing "Smith"').toContainText('Smith');
```

The one constraint that still applies regardless of where the assertion lives: **the locator or value being asserted must come from a page-object-exposed locator, action, or response wrapper** — never a new, undeclared locator built inline in the spec (e.g. `page.getByTestId(...)` invented on the spot). This keeps locator ownership with the page object even when the assertion itself is inline.

```typescript
// ❌ Wrong — introduces a new, undeclared locator inline in the spec
const imsValues = await page.getByTestId('customer-table-ims').allTextContents();

// ✅ Correct — the locator is owned by the page object; the spec asserts on it directly
await expect(customerManagementPage.customerTableIms, 'All IMS numbers should start with "multi"').toContainText('multi');
```

---


## 7a. Assertion Type Reference

### URL Assertions

```typescript
await expect(this.page, 'Dashboard page URL should be /dashboard').toHaveURL(/\/dashboard/);
```

### Visibility Assertions

```typescript
await expect(this.myButton, 'My button should be visible').toBeVisible();
await expect(this.conditionalElement, 'Conditional element should be hidden').toBeHidden();
```

### Text Assertions

```typescript
await expect(this.myButton, 'My button should read "Submit"').toHaveText('Submit');
await expect(this.page, 'Page title should be "My Application"').toHaveTitle('My Application');
```

### State Assertions

```typescript
await expect(this.myButton, 'My button should be enabled').toBeEnabled();
await expect(this.myInput, 'My input should be empty by default').toBeEmpty();
await expect(this.myInput, 'My input should have the correct placeholder').toHaveAttribute('placeholder', 'Enter your name');
await expect(this.activeTab, 'Active tab should have active styling').toHaveClass(/active/);
```

### Dropdown Assertions

```typescript
await expect(this.statusDropdown.locator('option'), 'Status dropdown should list all expected options in order').toHaveText(MyPage.EXPECTED_STATUS_OPTIONS);
await expect(this.statusDropdown, 'Status dropdown should default to no selection').toHaveValue('');
```

### Table Assertions

```typescript
await expect(this.tableHeaders, 'Table should show the expected column headers in order').toHaveText(MyPage.EXPECTED_COLUMN_HEADERS);
const rowCount = await this.tableRows.count();
expect(rowCount, 'Table rows should be present').toBeGreaterThan(0);
await expect(this.actionButtons, 'Action buttons should appear once per table row').toHaveCount(rowCount);
```

### Dynamic Text Assertions

```typescript
await expect(this.page.getByText(`Welcome back, ${userName}!`), "Welcome message should include the signed-in user's name").toBeVisible();
```

---


## 8. Shared Data

### When to Create a Shared Data File

Create a file in `support/pages/shared/` when the same values are referenced by two or more page objects, or represent static application data that must stay in sync across pages.

```typescript
// support/pages/shared/seed-data.ts
export const SEED_ITEM_NAMES = ['Item A', 'Item B', 'Item C'] as const;
```

### Never Hardcode Expected Values in Spec Files

All expected option lists, column headers, and static text must come from a page object's `static readonly` properties or from `support/pages/shared/` — never hardcoded directly in a spec file.

```typescript
// ✅ Correct
await expect(this.tableHeaders, '...').toHaveText(MyPage.EXPECTED_COLUMN_HEADERS);

// ❌ Wrong — hardcoded in the spec
await expect(this.tableHeaders, '...').toHaveText(['Name', 'Email', 'Status', 'Actions']);
```

---

## 8a. Data Seeding and Network-Derived Data

### Extracting Real Data via Network Inspection

Do not hardcode names, codes, or IDs that may differ per environment. Instead, intercept the network response that reveals real data and extract the value from it. This is the standard pattern for getting environment-real values:

```typescript
export async function goToCoreOrderDetails(page: Page) {
  const getCustomerPromise = waitForResponse(page, 'GET', '/api/customers/search');

  await page.goto('/');

  // Intercepts and waits for the customer search response before extracting real data from it
  const response = await getCustomerPromise;
  const body = await response.json();
  const customerName: string = body.options[0].value;

  return customerName;
}
```

Always register the `waitForResponse` listener **before** the action that triggers the request, not after — otherwise the response may resolve before the listener attaches. Comment this ordering explicitly (see [Section 9: Comment Non-Obvious Interactions](#comment-non-obvious-interactions)).

### Seeding and Cleaning Up via API

For tests that need pre-existing data (e.g. an edit flow that requires an existing record), seed that data via the application's create endpoint directly through Playwright's `request` fixture, rather than driving the UI through a create flow first. Clean up via the corresponding delete endpoint in `test.afterEach`, so seeded data doesn't leak between runs or environments regardless of test outcome:

```typescript
test.describe('Edit Existing Customer', () => {
  let customerId: string;

  test.beforeEach(async ({ request }) => {
    // TODO: replace with the real create-customer endpoint and payload shape for this app
    const response = await request.post('/api/TODO-create-endpoint', { data: { /* TODO: seed payload */ } });
    const body = await response.json();
    customerId = body.id;
  });

  test.afterEach(async ({ request }) => {
    // TODO: replace with the real delete-customer endpoint for this app
    await request.delete(`/api/TODO-delete-endpoint/${customerId}`);
  });

  test('User can edit an existing customer\'s details', async ({ page }) => {
    // ... test uses customerId to navigate to the seeded record
  });
});
```

**This section is intentionally a placeholder pattern.** The exact create/delete endpoint paths, payload shapes, and any auth requirements differ per entity and per app. Before writing a real seeding helper for a given entity, confirm the endpoint details with the API owner or the relevant Postman collection/API docs — do not guess at payload shapes.

---


## 9. Best Practices

### Always Use `expectLoaded()` After Navigation

```typescript
// ✅ Correct
await loginPage.clickLogin();
await dashboardPage.expectLoaded();

// ❌ Wrong — no confirmation that navigation completed
await loginPage.clickLogin();
await dashboardPage.expectSomeComponentCosmeticElements(); // may run before navigation finishes
```

### Keep `expectLoaded()` Lightweight

`expectLoaded()` should assert only the URL and one defining locator — it is a smoke check for the page as a whole, not a component cosmetic check.

### One Cosmetic Method Per Component, Never Per Page

Reconfirming [Section 3](#component-scoped-cosmetic-checks): do not write a single `expectCosmeticElements()` that checks every component on a page. Split by component, and give each Smoke test one component to check.

### Comment Non-Obvious Interactions

Add a short comment above any interaction whose purpose or timing isn't obvious from the code alone — comment **why**, not **what**. This is especially important for:

- Listener ordering (`waitForResponse` registered before the triggering action)
- Conditional branches based on runtime state (e.g. "will call" vs. manual address)
- Any workaround such as a forced click (`{ force: true }`)

```typescript
// ✅ Correct — explains why the listener is registered first
// Register listener BEFORE the typeahead selection triggers the customer search
const getCustomerPromise = waitForResponse(page, 'GET', '/api/customers/search');
await typeIntoTypeaheadField(coreOrderDetailsTab.customerBranchField, branchName, coreOrderDetailsTab.customerBranchResult);
const response = await getCustomerPromise;

// ❌ Wrong — no explanation for the force click; a future reader can't tell if it's masking a bug
await this.signOutButton.click({ force: true });

// ✅ Correct
// Force click: the sign-out button sits under a tooltip overlay that Playwright's
// actionability checks otherwise block on — this is a known, accepted UI quirk.
await this.signOutButton.click({ force: true });
```

### Assertion Messages Are Mandatory, Not Optional

See [Section 7](#7-assertion-patterns) for the full rule — it applies with zero exceptions across all three tiers, inline or inside a page object method.

### Never Hardcode Expected Values in Spec Files

See [Section 8](#8-shared-data).

### Compose, Don't Duplicate

Use shared component classes via composition in every page object. Never copy-paste locators that belong to a shared component into a page object.

### Don't Abstract for the Sake of It

Per [Section 7](#7-assertion-patterns), only promote an assertion to a page-object method once it is genuinely reused. A page object method that exists to house a single assertion used in exactly one test adds a layer of indirection a reader has to open a second file to understand, with no corresponding benefit — prefer the inline assertion in that case.

---


## 10. Complete Example

This is a full worked example for a generic `[PageName]` page with two components (`Item Dropdown` and `Submit Button`), showing every file involved across all three tiers.

### 1. Shared Data File

`support/pages/shared/seed-data.ts`

```typescript
export const SEED_ITEM_NAMES = ['Item A', 'Item B', 'Item C'] as const;
```

### 2. Page Object File

`support/pages/my-page.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { SEED_ITEM_NAMES } from '@pages/shared/seed-data';

export class MyPage {
  readonly page: Page;

  readonly itemDropdown: Locator;
  readonly itemLabel: Locator;
  readonly submitButton: Locator;
  readonly conditionalElement: Locator;

  static readonly EXPECTED_DROPDOWN_OPTIONS = ['-- Select --', ...SEED_ITEM_NAMES];

  constructor(page: Page) {
    this.page = page;

    this.itemDropdown = page.locator('#itemSelect');
    this.itemLabel = page.locator('.form-group', { has: this.itemDropdown }).locator('label');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.conditionalElement = page.getByRole('button', { name: 'Confirm' });
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'My page URL should be /my-route').toHaveURL(/\/my-route/);
    await expect(this.itemDropdown, 'Item dropdown should be visible').toBeVisible();
  }

  /** Cosmetic check for the Item Dropdown component only. */
  async expectItemDropdownCosmeticElements() {
    await expect(this.itemLabel, 'Item label should be visible').toBeVisible();
    await expect(this.itemLabel, 'Item label should read "Select Item"').toHaveText('Select Item');
    await expect(this.itemDropdown, 'Item dropdown should be visible').toBeVisible();
    await expect(this.itemDropdown.locator('option'), 'Item dropdown should list all expected options in order').toHaveText(MyPage.EXPECTED_DROPDOWN_OPTIONS);
    await expect(this.itemDropdown, 'Item dropdown should default to no selection').toHaveValue('');
  }

  /** Cosmetic check for the Submit Button component only. */
  async expectSubmitButtonCosmeticElements() {
    await expect(this.submitButton, 'Submit button should be visible').toBeVisible();
    await expect(this.submitButton, 'Submit button should read "Submit"').toHaveText('Submit');
    await expect(this.submitButton, 'Submit button should be enabled').toBeEnabled();
    await expect(this.conditionalElement, 'Conditional element should be hidden').toBeHidden();
  }

  async selectItem(name: string) {
    await this.itemDropdown.selectOption({ label: name });
  }

  async clickSubmit() {
    await this.submitButton.click();
  }
}
```

### 3. Smoke Spec

`tests/smoke/my-page.spec.ts`

```typescript
import { test } from '@playwright/test';
import { MyPage } from '@pages/my-page.page';

test.describe('My Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-route');
  });

  test('Cosmetic - Item dropdown renders with all expected options', async ({ page }) => {
    const myPage = new MyPage(page);
    await myPage.expectItemDropdownCosmeticElements();
  });

  test('Cosmetic - Submit button renders correctly and Confirm button is hidden by default', async ({ page }) => {
    const myPage = new MyPage(page);
    await myPage.expectSubmitButtonCosmeticElements();
  });
});
```

### 4. Functional Spec

`tests/functional/my-page-item-selection.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { MyPage } from '@pages/my-page.page';

test.describe('Item Selection', () => {
  test('Confirm button becomes visible after selecting an item', async ({ page }) => {
    const myPage = new MyPage(page);
    await page.goto('/my-route');

    await myPage.selectItem('Item A');

    // Inline — one-off check, clearer read in context than a single-use page object method
    await expect(myPage.conditionalElement, 'Conditional element should be visible after selecting an item').toBeVisible();
  });
});
```

### 5. E2E Spec

`tests/e2e/my-page-submission.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { MyPage } from '@pages/my-page.page';

test.describe('Submit Item Journey', () => {
  test('User can select an item and submit the form to reach the result page', async ({ page }) => {
    const myPage = new MyPage(page);
    await page.goto('/my-route');

    await myPage.selectItem('Item A');
    await myPage.clickSubmit();

    await expect(page, 'Result page URL should be /result').toHaveURL(/\/result/);
    await expect(page.getByRole('heading', { name: 'Success' }), 'Success heading should be visible on the result page').toBeVisible();
  });
});
```

---


## 11. Quick Reference

### Files to Create for Each New Page

| File | Path |
| --- | --- |
| Page Object | `support/pages/<page-name>.page.ts` |
| Journey (if the page participates in a multi-page flow) | `support/journeys/<journey-name>.journey.ts` |
| Smoke spec | `tests/smoke/<page-name>.spec.ts` |
| Functional spec (if applicable) | `tests/functional/<feature-name>.spec.ts` |
| E2E spec (if applicable) | `tests/e2e/<journey-name>.spec.ts` |
| Shared data (if needed) | `support/pages/shared/<data-name>.ts` |

### Deciding the Tier

1. Am I only checking that elements render correctly, with no meaningful interaction? → **Smoke**, one `test()` per component.
2. Am I checking one feature's behaviour in isolation, reachable without completing a full journey? → **Functional**.
3. Am I driving through multiple components/pages to complete a real user flow? → **E2E**, orchestrated via a Journey.

### Page Object Skeleton

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class MyPage {
  readonly page: Page;
  readonly myElement: Locator;

  static readonly EXPECTED_OPTIONS = ['Option A', 'Option B'];

  constructor(page: Page) {
    this.page = page;
    this.myElement = page.getByRole('button', { name: 'My Element' });
  }

  async clickMyElement() {
    await this.myElement.click();
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'My page URL should be /my-route').toHaveURL(/\/my-route/);
    await expect(this.myElement, 'My element should be visible').toBeVisible();
  }

  /** Cosmetic check for the My Element component only. */
  async expectMyElementCosmeticElements() {
    await expect(this.myElement, 'My element should be visible').toBeVisible();
    await expect(this.myElement, 'My element should read "My Element"').toHaveText('My Element');
    await expect(this.myElement, 'My element should be enabled').toBeEnabled();
  }
}
```

### Journey Skeleton

```typescript
import { Page } from '@playwright/test';
import { MyPage } from '@pages/my-page.page';

/** Orchestration only — no assertions. Returns any data the caller needs. */
export async function goToMyFlowStep(page: Page) {
  const myPage = new MyPage(page);
  await myPage.clickMyElement();
  // ... further steps
}
```

### Spec File Skeletons

```typescript
// tests/smoke/my-page.spec.ts
test.describe('My Page', () => {
  test('Cosmetic - My Element renders correctly', async ({ page }) => {
    const myPage = new MyPage(page);
    await page.goto('/my-route');
    await myPage.expectMyElementCosmeticElements();
  });
});

// tests/functional/my-feature.spec.ts
test.describe('My Feature', () => {
  test('<Element> becomes visible after <action>', async ({ page }) => {
    const myPage = new MyPage(page);
    await page.goto('/my-route');
    await myPage.clickMyElement();
    await expect(myPage.myElement, 'My element should ...').toBeVisible(); // inline, one-off
  });
});

// tests/e2e/my-journey.spec.ts
test.describe('My Journey', () => {
  test('User can complete <journey>', async ({ page }) => {
    await goToMyFlowStep(page); // journey: orchestration only
    // ... assertions live in the spec, using page-object locators
  });
});
```

---

## Notes

- All patterns in this guide are derived from, or intended to bring into alignment, the live spec files in `tests/` and `support/`.
- When in doubt on tier placement, ask: is this cosmetic-only (Smoke), one isolated feature (Functional), or a real multi-step user flow (E2E)?
- Assertion messages are mandatory everywhere, with no exceptions.
- Cosmetic checks are always scoped to one component, never to a whole page.
- Journeys orchestrate; they never assert.
- Prefer inline assertions for readability; promote to a page-object method only once genuinely reused.
- Seed and clean up test data via API endpoints where possible, and extract real values via network response inspection rather than hardcoding them.
- The `ui-setup` project with `storageState` is the target auth strategy; any `globalSetup`-based worker auth is a legacy pattern to be migrated.
- The `@pages/*` and `@journeys/*` path aliases are configured in `tsconfig.json` and resolve to `support/pages/*` and `support/journeys/*` respectively.

