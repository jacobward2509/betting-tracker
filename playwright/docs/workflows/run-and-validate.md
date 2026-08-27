# Run and Validate Playwright Tests

> Guard: if `.ai/api-workflow-state.json` shows `stage: "done"` for this endpoint with no failures recorded, don't re-run automatically — confirm with the user first.

Immediately after Playwright test code has been generated for an endpoint (as part of the **Generate Playwright Tests** workflow), always ask the user:

> **Would you like to run the newly created tests now?** (Yes / No)

- If **No** — do nothing further and continue as normal (state stays at `stage: "run"` until the user is ready).
- If **Yes**, ask the following two questions (both required before running anything):
  1. **Which environment should the tests run against?**
     - Options: `dev` / `sit`
  2. **What should be run?**
     - Options: `Just the new operationId describe block` / `Full spec file`

## Execution

Once the environment and scope are confirmed, run the tests from the `playwright/` directory:

- **Scoped run** (just the new `operationId` describe block):
  ```
  cd playwright && ENV=<env> npx playwright test <spec-file> --grep "<operationId>"
  ```
- **Full spec file run**:
  ```
  cd playwright && ENV=<env> npx playwright test <spec-file>
  ```

Where `<env>` is `dev` or `sit`, `<spec-file>` is the relative path under `tests/` (e.g. `api/customer-endpoints-v2.spec.ts`), and `<operationId>` is the describe block name used for the endpoint (e.g. `update-customer-us`).

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

This script:

- Recursively walks the JSON report's suite tree, building a breadcrumb per test (e.g. `Customer endpoints-V2 > update-customer-us > US > 400 - Bad Request > Missing Mandatory Data`)
- Buckets every test into passed / failed / flaky / skipped
- Prints a clean summary to stdout:
  - A header with total / passed / failed / flaky / skipped counts and total duration
  - A condensed **✅ Passed** section, grouped by breadcrumb with counts (not test-by-test)
  - A detailed **❌ Failed** section — the anomaly summary — listing each failure individually with its breadcrumb, test title, file:line location, and first error message line
  - **⚠️ Flaky** and **⏭️ Skipped** sections if applicable

Relay the output of this script directly back to the user in chat as the final summary of the test run. Do not fabricate or paraphrase pass/fail counts — always use the script's actual output.

### Requirements

- Never run tests against an environment without the user explicitly confirming both the environment and the run scope first.
- Do not skip the summarization step — always run `summarize-test-results.js` after the test run and present its output, even if all tests passed.
- This workflow is only triggered automatically as a follow-on step after generating Playwright tests (V2). It does not apply to V1/Postman collection generation.

---

## Workflow State Checkpoint (after summarization)

- If there are **no failures**: update `.ai/api-workflow-state.json` — append `"run"` to `completed`, set `stage: "done"`.
- If there **are failures**: update `.ai/api-workflow-state.json`:
  - Append `"run"` to `completed`, set `stage: "repair"`.
  - Populate `failures` with one entry per failure from the summary, in the order presented: `{ "id": <1-based index>, "title": <test title>, "breadcrumb": <describe hierarchy>, "decision": null, "status": "undecided" }`.
  - Set `remainingRepairs` to `failures.length` (all undecided at this point, so all unresolved).
  - Set `task` to a short description of what's next, e.g. `"Awaiting triage decisions for N failures"`.

## Handling Failures

Immediately after relaying the `summarize-test-results.js` output, **if there are any failures**, present each failure as a numbered list (breadcrumb, test title, `file:line`, first error line) and work through them **one at a time**, asking the user how they want to handle each one:

> **How would you like to handle failure [N] — `<test title>`?**
>
> - **Self heal** — investigate and fix the test code
> - **Raise a Jira bug** — the API behaviour is wrong; raise a dedicated bug ticket
> - **Skip** — do nothing for now

Process each failure individually in order. If the user says "all self heal" or "all raise bugs", still confirm each one individually before acting — do not batch-apply without per-failure confirmation.

Full detail for this two-phase process (collect decisions + apply fixes, then a single re-run, then finalize bug tickets) lives in **`self-heal.md`** — follow that file's "Handling Failures (multi-failure triage)" section from this point on. Each failure's `decision` and `status` get updated in `.ai/api-workflow-state.json`'s `failures` array as it's resolved; `remainingRepairs` is recomputed from that array each time, and when it reaches `0`, `stage` moves to `"done"`.
