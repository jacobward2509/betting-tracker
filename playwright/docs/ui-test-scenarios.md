# UI Test Scenario Generation Prompt

## Output Format

Generate a test plan document with the following sections in this exact order:

1. **Page Information** — URL pattern, page title, description, and how the page is reached
2. **Elements Under Test** — table of every element being tested
3. **Test Coverage Summary** — total scenario count
4. **Test Scenarios** — the scenario table
5. **Out of Scope** — explicit list of what is not covered by this plan
6. **Automation Status** — which page objects cover this plan, and a per-scenario automation status table
7. **References** — links to the application and related test plans

---

## Elements Under Test Table

The Elements Under Test table must have the following columns in this exact order:

| Element | Locator | Notes |

- **Element** — human-readable name for the element (e.g. `"Submit" button`, `Username input`, `Status dropdown`)
- **Locator** — the Playwright locator expression used to target it (e.g. `getByRole('button', { name: 'Submit' })`, `getByPlaceholder('Username')`, `#statusSelect`)
- **Notes** — any relevant context: what the element does, any data attributes used to locate it, conditional visibility rules (e.g. hidden until a condition is met), navigation target, or option list

Where a page has multiple logical sections (e.g. a landing page plus sub-pages reached via tabs), split the Elements Under Test table into one sub-section per section, each with its own `###` heading.

---

## Test Scenarios Table

The scenario table must have the following columns in this exact order:

| Scenario | Scenario Type | Use Case | Description | Expected Result |

---

## Scenario Types

Every scenario must be assigned exactly one of the following types:

| Type           | When to use                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cosmetic**   | Verifying that static elements render with the correct text, labels, placeholders, options, and initial enabled/visible state — no interaction beyond navigation to the page            |
| **Functional** | Verifying interactive behaviour: conditional visibility (element shown/hidden based on state), dropdown default state and option list, element state changes driven by user interaction |
| **Navigation** | Verifying that a user action (button click, form submission) causes the correct URL change and/or the correct landmark element on the destination page becomes visible                  |

---

## Coverage Rules

### Cosmetic Scenarios

Generate one Cosmetic scenario per logical page or sub-page. A Cosmetic scenario must cover:

- Page title (if testable)
- All static heading text
- All labels (exact text)
- All input placeholders (exact text) and their empty initial state
- All buttons: visible, enabled, correct text
- All dropdowns: visible, all options present in the correct order, correct default selection
- All table column headers (exact text, exact order)
- Any elements that are present in the DOM but hidden on initial load (e.g. conditionally rendered elements) — assert hidden, not absent
- Any shared component elements present on every page (e.g. navigation bar, page heading, logout button) — reference the shared component rather than re-documenting its locators per page

> **Note:** A Cosmetic scenario is a single test that checks all static elements together. Do not split cosmetic checks into one scenario per element.

### Functional Scenarios

Generate Functional scenarios for:

- **Conditional visibility** — any element whose visibility is controlled by application state. Generate:
  1. One scenario asserting the element is hidden in its default/initial state
  2. One scenario asserting the element becomes visible after the triggering interaction
- **Dropdown default state and options** — if not already covered by the Cosmetic scenario, generate a dedicated Functional scenario verifying the default selected option and the complete ordered list of options
- **Element state changes** — any element that changes state (e.g. a tab gaining an active CSS class, a button becoming enabled) as a result of user interaction

> **Note:** If a Cosmetic scenario already exhaustively covers dropdown options and default state, do not duplicate this as a separate Functional scenario.

### Navigation Scenarios

Generate one Navigation scenario per navigable action on the page:

- Each button or link that changes the URL
- Each tab that loads a sub-view (URL change + active tab state)
- Any shared navigation element (e.g. Home button, Back link) that navigates away from the current page
- Form submission that navigates to a result page

Each Navigation scenario must assert:

1. The URL change (using a regex or exact match against the expected route)
2. At least one landmark element on the destination page becoming visible (to confirm the navigation completed)

---

## Output Order

Generate scenarios in this exact order within the scenario table:

1. **Cosmetic** — page/sub-page load checks (one per logical section, in top-to-bottom page order)
2. **Functional** — interactive/state-based checks
3. **Navigation** — click/submit actions that change the URL

> **Exception:** When a Navigation scenario is a prerequisite for a Cosmetic scenario (e.g. you must click a tab to reach a sub-page before checking its cosmetic elements), the Navigation scenario and its paired Cosmetic scenario should appear together in the order they are performed, rather than separating all Navigation scenarios to the end.

---

## General Rules

### Element Handling

- Document every interactive element on the page, including elements that are present in the DOM but conditionally hidden
- Use the exact locator expressions from the page object (see `support/pages/`) — do not invent locators
- For elements shared across all pages (e.g. navigation bar, page heading, logout button), reference the shared component class rather than re-documenting them per page

### Scope Boundaries

Each test plan covers exactly one page or one logical page group (e.g. a landing page plus its tab sub-pages). Explicitly list in **Out of Scope**:

- Functional behaviour of sub-pages when the current plan only covers cosmetic rendering
- Backend/API validation
- Pages reached after navigation (covered by their own test plans)

### Automation Status

The Automation Status section must:

1. List every page object file used, with the class name and the specific methods called
2. Include a per-scenario table with a ✅ Automated or ❌ Not Automated status for each scenario

---

## Example Scenario Table

| Scenario | Scenario Type | Use Case                                         | Description                                                                                                                                                                                                      | Expected Result                                                                                                                                                      |
| -------- | ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Cosmetic      | Page loads correctly                             | Navigate to `[PageName]`. Verify the page URL, page title, shared navigation elements, all labels, all input placeholders, all buttons (visible, enabled, correct text), and any elements hidden on initial load | URL matches `[route]`; title is `[expected title]`; all static elements are visible with correct text; any conditionally hidden elements are present but not visible |
| 2        | Functional    | Dropdown default state and options               | On page load, verify the `[DropdownName]` dropdown's default selected option is `[default option]`, and verify all expected options are present in the correct order                                             | Default option `[default option]` is selected; all `[N]` options exist as selectable options in the correct order                                                    |
| 3        | Functional    | `[ElementName]` hidden by default                | On page load, without performing any interaction, verify the `[ElementName]` is not visible                                                                                                                      | `[ElementName]` is hidden (not visible) in the default state                                                                                                         |
| 4        | Functional    | `[ElementName]` appears after `[trigger action]` | Perform `[trigger action]` (e.g. select a value from a dropdown, fill a required field)                                                                                                                          | `[ElementName]` becomes visible                                                                                                                                      |
| 5        | Navigation    | `[ActionName]` navigates to `[DestinationPage]`  | Perform `[action]` (e.g. click the `[ButtonName]` button, submit the form)                                                                                                                                       | URL changes to `[destination route]`; `[landmark element]` on the destination page is visible                                                                        |
| 6        | Navigation    | `[NavigationElement]` returns to `[OriginPage]`  | From `[PageName]`, click the `[NavigationElement]` (e.g. Home button, Back link)                                                                                                                                 | URL changes to `[origin route]`; `[landmark element]` on the origin page is visible                                                                                  |

---

## Best Practices

1. **Be Systematic:** Cover every element in the Elements Under Test table with at least one scenario
2. **Be Deterministic:** Two people using this prompt with the same page description should generate identical scenarios
3. **Be Explicit:** State exact expected text, exact URL patterns, and exact element states in the Expected Result column — avoid vague assertions like "page loads correctly"
4. **Scope Tightly:** One test plan per page or logical page group; cross-page behaviour belongs in the destination page's test plan
5. **Document Conditional Elements:** Any element with conditional rendering must appear in the Elements Under Test table with a note explaining the condition, and must have both a "hidden" and a "visible" Functional scenario
6. **Reference Shared Components:** Elements present on every page (e.g. navigation bar, page heading, logout button) should be encapsulated in a shared component class — reference it in the Elements Under Test table rather than re-listing its locators, and include it in every Cosmetic scenario's description
