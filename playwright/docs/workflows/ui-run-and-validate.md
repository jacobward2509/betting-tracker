# Run and Validate Playwright UI Tests

> Guard: if `.ai/ui-workflow-state.json` shows `stage: "done"` for this scope with no failures recorded, don't re-run automatically — confirm with the user first.

Immediately after Playwright UI test code has been generated for a scope (as part of the **Generate Playwright UI Tests** workflow), always ask the user:

> **Would you like to run the newly created tests now?** (Yes / No)

- If **No** — do nothing further and continue as normal (state stays at `stage: "run"` until the user is ready).
- If **Yes**, ask the following two questions (both required before running anything):
  1. **Which environment should the tests run against?**
     - Options: `dev` / `sit`
  2. **What should be run?**
     - Options: `Just the new scope's spec file(s)` / `Full tier directory (smoke/functional/e2e)`

## Environment Setup

UI tests read `WEB_BASE_URL` from `playwright/.env.<env>` (alongside the existing `API_BASE_URL`), following the same `dev`/`sit` pattern as the API workflow.

- **`dev` today** resolves to a locally-started frontend — there is no deployed dev frontend yet. `WEB_BASE_URL` should be `http://localhost:5173` (Vite's default). Before running, confirm the web dev server is actually running:
  > **Is `npm run dev:web` already running locally? If not, I can start it in the background before running the tests.**
  If the user asks you to start it, run `npm run dev:web` from the repo root in the background and wait for it to report ready before proceeding.
- **`sit`** (and any future deployed environment) should point `WEB_BASE_URL` at the real deployed frontend URL once one exists — no workflow change is needed then, only populating `playwright/.env.sit`.

## Execution

Once the environment and scope are confirmed, run the tests from the `playwright/` directory:

- **Scoped run** (just the new scope's spec file(s), from `specFiles` in `.ai/ui-workflow-state.json`):
  ```
  cd playwright && ENV=<env> npx playwright test <spec-file-1> <spec-file-2> ...
  ```
- **Full tier directory run** (e.g. every smoke test, or the entire UI suite across tiers):
  ```
  cd playwright && ENV=<env> npx playwright test tests/smoke tests/functional tests/e2e
  ```

Where `<env>` is `dev` or `sit`, and each `<spec-file>` is the relative path under `tests/` (e.g. `smoke/auth-page.spec.ts`).

This uses the existing Playwright JSON reporter output, already configured in `playwright.config.ts` to write to `playwright/test-results/results.json` — no configuration changes are needed.

Immediately after the test run completes (regardless of pass/fail), always open the HTML report from the `playwright/` directory:

```
npx playwright show-report
```

Do this every time, not just on failure — the config's default HTML reporter behavior only auto-opens the report on failure locally (and never on CI), so this step must be run explicitly to guarantee the report is always shown.

## Summarizing Results

After the Playwright run completes (regardless of pass/fail), run the summary script to parse the JSON results:

```
node playwright/scripts/summarize-test-results.js playwright/test-results/results.json
```

This is the same script used by the API workflow — it works identically regardless of whether the underlying tests are API or UI. Relay the output of this script directly back to the user in chat as the final summary of the test run. Do not fabricate or paraphrase pass/fail counts — always use the script's actual output.

### Requirements

- Never run tests against an environment without the user explicitly confirming both the environment and the run scope first.
- Do not skip the summarization step — always run `summarize-test-results.js` after the test run and present its output, even if all tests passed.
- Never assume the web dev server is running for `dev` — always confirm or offer to start it first.

---

## Workflow State Checkpoint (after summarization)

- If there are **no failures**: update `.ai/ui-workflow-state.json` — append `"run"` to `completed`, set `stage: "done"`.
- If there **are failures**: update `.ai/ui-workflow-state.json`:
  - Append `"run"` to `completed`, set `stage: "repair"`.
  - Populate `failures` with one entry per failure from the summary, in the order presented: `{ "id": <1-based index>, "title": <test title>, "breadcrumb": <describe hierarchy>, "decision": null, "status": "undecided" }`.
  - Set `remainingRepairs` to `failures.length`.
  - Set `task` to a short description of what's next, e.g. `"Awaiting triage decisions for N failures"`.

## Handling Failures

Immediately after relaying the `summarize-test-results.js` output, **if there are any failures**, present each failure as a numbered list (breadcrumb, test title, `file:line`, first error line) and work through them **one at a time**, asking the user how they want to handle each one — same three options as the API workflow (Self heal / Raise a Jira bug / Skip).

Full detail for this two-phase process lives in **`ui-self-heal.md`** — follow that file's process from this point on. Each failure's `decision` and `status` get updated in `.ai/ui-workflow-state.json`'s `failures` array as it's resolved; `remainingRepairs` is recomputed from that array each time, and when it reaches `0`, `stage` moves to `"done"`.
