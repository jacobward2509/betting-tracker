# Generate Playwright UI Tests

> Guard: if `.ai/ui-workflow-state.json` shows `"generate"` already in `completed` for this scope, don't regenerate — ask the user if they want to explicitly redo it.

## Entry Points

This workflow starts one of two ways:

1. **Automatically**, immediately after `ui-jira-attach.md` resolves — no need to wait for the trigger phrase below.
2. **Trigger phrase** — the user says **"Now generate UI tests"** (or any close variation), e.g. to (re)run generation as a standalone action later in the session.

In either case, still confirm the spec file location(s) below before doing anything else — automatic entry skips the trigger phrase, not the required inputs.

## Tier Assignment

Read the UI test plan Markdown file generated in this session. For each scenario, its `Scenario Type` column (Cosmetic / Functional / Navigation) directly maps to the tier and spec file it belongs in, per `playwright-ui-test-generation.md`'s tier definitions:

| Scenario Type | Tier | Spec file location |
| --- | --- | --- |
| Cosmetic | Smoke | `playwright/tests/smoke/<page-slug>.spec.ts` |
| Functional | Functional | `playwright/tests/functional/<feature-slug>.spec.ts` |
| Navigation | E2E (cross-page) or Functional (same-page mode toggle) | `playwright/tests/e2e/<journey-slug>.spec.ts` or `playwright/tests/functional/<feature-slug>.spec.ts` |

For a Navigation scenario, use judgement per the guide's own tier definitions: if it's a same-page state toggle (e.g. switching between login/signup mode within `AuthView`), it belongs in Functional; if it's a real cross-page journey (e.g. successful signup navigating to a different route/page), it belongs in E2E. Don't ask the user to confirm this split upfront — only ask if a specific scenario's tier is genuinely ambiguous after applying this rule.

A single generation pass may therefore write to multiple spec files across multiple tiers — this is expected and normal for one UI test plan.

**Proceed with this workflow:**

1. **Read `playwright-ui-test-generation.md`** in full for the complete guide on the Page Object Model, the Journeys layer, shared components, locator conventions, and assertion patterns.
2. **Read the UI test plan Markdown file** generated in this session to extract all scenarios and their assigned tiers (per the table above).
3. **Inspect existing Page Objects** in `playwright/support/pages/` — reuse an existing Page Object class for this page if one exists; otherwise create a new one (`support/pages/<page-name>.page.ts`) following the guide's conventions, composing any shared component classes rather than duplicating their locators.
4. **Inspect existing spec files** in each target tier directory to understand established patterns, `describe` grouping, and assertion styles that can be reused.
5. **Generate the tier-appropriate spec file(s)**, creating each one if it doesn't exist yet, covering every scenario in the test plan.

---

## Workflow State Checkpoint

Once the Playwright UI test code has been generated and saved:

- Update `.ai/ui-workflow-state.json`: append `"generate"` to `completed`, set `stage: "run"`, and record `specFiles` (the array of every spec file path written or updated in this pass).

There is no V1/V2-style fork here — always proceed to `stage: "run"`, since UI test generation always has a run/repair loop.

Then proceed to **`ui-run-and-validate.md`**.
