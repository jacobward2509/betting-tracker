# Generate Playwright Tests (V2 only)

> Guard: if `.ai/api-workflow-state.json` shows `"generate"` already in `completed` for this endpoint, don't regenerate — ask the user if they want to explicitly redo it.

## Entry Points

This workflow starts one of two ways:

1. **Automatically**, immediately after `jira-attach.md` resolves for a V2 endpoint — no need to wait for the trigger phrase below.
2. **Trigger phrase** — the user says **"Now generate playwright tests"** (or any close variation), e.g. to (re)run generation as a standalone action later in the session.

In either case, still ask the two questions below before doing anything else — automatic entry skips the trigger phrase, not the required inputs.

**Guard:** Check the conversation context / `.ai/api-workflow-state.json`. If the test plan generated in this session was for a **V1** endpoint, respond with:

> ❌ _"Playwright test generation is only available for V2 endpoints. For V1 endpoints, use 'Now generate postman collection' instead."_

**If V2 — ask for the following before doing anything else:**

1. **Spec file path** — the path to the existing spec file where the describe block lives (e.g. `playwright/tests/api/cycle-count-endpoints-v2.spec.ts`)
2. **Describe block name** — the name of the empty describe block created for this endpoint

**Then proceed with this workflow:**

1. **Read `playwright-api-test-generation.md`** in full for the complete guide on writing Playwright API tests.
2. **Read the test plan Markdown file** generated in this session to extract all test scenarios.
3. **Inspect the provided spec file** to understand existing patterns, coverage levels, and assertion styles that can be reused for similar request types.
4. **Generate the endpoint coverage** into the specified describe block, covering all scenarios in the test plan.

---

## Workflow State Checkpoint

Once the Playwright test code has been generated and saved into the spec file:

- Update `.ai/api-workflow-state.json`: append `"generate"` to `completed`, set `stage: "run"`, and record `specFile` (the spec file path used).

Then proceed to **`run-and-validate.md`**.
