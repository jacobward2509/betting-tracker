# UI Test Plan Generation

> Before starting, read `.ai/ui-workflow-state.json` per the **Workflow State** section of `clinerules.md`. If an incomplete UI workflow already exists for a _different_ scope than what's requested here, confirm with the user whether to abandon/overwrite it or finish it first — same rule as `clinerules.md`'s "Starting a new workflow instance", scoped to the UI family only (an incomplete API workflow never blocks this). If the user chooses to abandon and overwrite, follow `attach-incomplete-ui-state-to-jira.md` first (offering to attach the current state to a Jira ticket) before writing the new workflow's initial state.

## Trigger Phrase

When the user says **"create a new UI test plan"** (or any close variation), the **first** question to ask is always:

> **What page, component, or user flow should this UI test plan cover?**

Unlike the API workflow, there is no V1/V2 split to ask about first — go straight to scope.

Ask for the following, structured the same way each time (mirroring the API workflow's structured intake):

1. **Page/component name** — e.g. `AuthView`, or a short descriptive name if it spans multiple components
2. **Route / URL pattern** — e.g. `/auth`
3. **Single page, or a page-group?** — if a page-group (e.g. a landing page plus sub-pages reached via tabs), name every page/sub-page included

Do not proceed with any file reading or test plan generation until all three have been provided. Do not ask for anything else at this stage — element-level detail is derived by reading the actual source file(s) in the workflow below, per `general-rules.md`'s "Information Gathering" rule.

## Workflow

1. **Refer to `ui-test-scenarios.md`** (read `playwright/docs/ui-test-scenarios.md` if not already read this session) for the full Output Format, Elements Under Test conventions, Scenario Types, and Coverage Rules.
2. **Read the actual page source file(s)** for the confirmed scope (e.g. `apps/web/src/views/<PageName>.vue`) to extract every static element, label, placeholder, button, dropdown, conditional element, and navigation action. Follow imported child components where relevant to their own source files rather than guessing at their contents.
3. **Cross-reference any shared components** (e.g. a navigation bar, page heading, logout button) already documented in other UI test plans under `playwright/docs/test-plans/ui/` — reference the shared component rather than re-documenting its locators, per the "Reference Shared Components" best practice in `ui-test-scenarios.md`.
4. **Cross-reference existing Page Objects** in `playwright/support/pages/` (if any exist yet for this page or its shared components) to stay consistent with established locator conventions — but do not require a Page Object to exist yet; note in **Automation Status** if one needs to be created.
5. **Generate the test plan** as a markdown file following the exact Output Format section of `ui-test-scenarios.md`: Page Information, Elements Under Test, Test Coverage Summary, Test Scenarios, Out of Scope, Automation Status, References — in that order.
6. **Save the output** to `playwright/docs/test-plans/ui/<category>/ui-test-plan-<page-slug>.md`, where:
   - `<category>` is derived from the page's logical area (e.g. `auth`, `bets`, `stats`)
   - `<page-slug>` is a kebab-case identifier for the page/flow (e.g. `auth` for the combined login/signup page)

## Out of Scope Reminders

- Field-level backend validation content (exact error messages returned by the API) belongs in the corresponding API test plan, not here — reference it by path in the **Out of Scope** section if one exists (e.g. `playwright/docs/test-plans/auth/test-plan-signup.md`).
- Behavior of a destination page beyond confirming navigation occurred and its landmark element is visible belongs in that destination page's own UI test plan, per the "Scope Tightly" best practice in `ui-test-scenarios.md`.

---

## Workflow State Checkpoint

Immediately after the test plan file is generated and saved:

- If `.ai/ui-workflow-state.json` does not yet exist for this scope, create it with:
  `workflow: "ui-test-generation"`, `scope` (page/route/description), `testPlanFile`, `specFiles: []`, `stage: "jira"`, `completed: ["plan"]`.
- If it already exists for this scope, set `stage: "jira"` and append `"plan"` to `completed`.

Once the test plan file has been generated, saved, and the state file updated, proceed to **`ui-jira-attach.md`**.
