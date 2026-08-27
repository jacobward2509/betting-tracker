# Run an Existing Spec File

> Guard: before starting, read `.ai/workflow-state.json`. If it tracks an **incomplete** workflow (any `stage` other than `"done"`, or `"done"` with unresolved `remainingRepairs`) for a _different_ `specFile`/`scope` (or a different `api-test-generation` endpoint) than what's being requested here, tell the user there's an incomplete workflow in progress and confirm whether to abandon/overwrite it or finish it first — same rule as `clinerules.md`'s "Starting a new workflow instance". If the user chooses to abandon and overwrite, follow `attach-incomplete-state-to-jira.md` first (offering to attach the current state to a Jira ticket) before writing the new workflow's initial state in step 4 below.

## Purpose

This workflow lets the user run an **already-generated** Playwright spec file (full file or a specific `describe` block) and go straight into the run → repair loop, without going through `plan` / `jira` / `generate` first. It's for existing coverage (e.g. `playwright/tests/api/quote-endpoints-v2.spec.ts`), not for newly authored endpoints — use `api-test-plan-generation.md` for those.

## Trigger Phrase

**"run existing tests"** (or a close variation, e.g. "run existing tests for `<spec-file>`" / "run the quote endpoints spec").

## Steps

1. **Confirm the spec file**, if not already stated by the user:

   > **Which spec file would you like to run?**

   Expect a path under `playwright/tests/api/`, e.g. `playwright/tests/api/quote-endpoints-v2.spec.ts`. Verify it exists before continuing.

2. **Confirm the scope**:

   > **What should be run?**
   - Options: `Full spec file` / `Specific describe block(s)`

   - If **specific describe block(s)**, ask the user to name the describe(s) (e.g. `insert-quote-branch-wms`, or a more specific breadcrumb like `Quote endpoints-V2 > get-quote-by-quoteid`). Multiple describes may be given as a list — in that case, build a single `--grep` pattern that matches all of them (e.g. a regex alternation), or run them as separate scoped runs if the user prefers; confirm which approach with the user if it's not obvious from their answer.

3. **Confirm the environment**, exactly as in `run-and-validate.md`:

   > **Which environment should the tests run against?**
   - Options: `dev` / `sit`

4. **Initialize `.ai/workflow-state.json`** for this run (overwriting only if the guard above has already been satisfied):

   ```json
   {
     "workflow": "api-test-execution",
     "apiVersion": "V2",
     "specFile": "playwright/tests/api/quote-endpoints-v2.spec.ts",
     "scope": "full-file",
     "stage": "run",
     "completed": [],
     "task": "Running existing spec file ahead of repair triage",
     "remainingRepairs": 0,
     "failures": []
   }
   ```

   - `scope` is either the literal string `"full-file"`, or the describe name(s)/breadcrumb(s) confirmed in step 2 (a string, or an array of strings if multiple describes were selected).
   - `ticket`, `endpoint`, and `testPlanFile` are **omitted** for this workflow — there is no single new endpoint/ticket driving this run. (A linked ticket, if needed later for raising a bug during repair, is instead derived from the current git branch per `self-heal.md`'s Phase 2 step 4a — no upfront ticket is required.)
   - `apiVersion` is always `"V2"` for this workflow — Playwright execution/repair doesn't apply to V1/Postman.

5. **Execute and summarize** — follow `run-and-validate.md`'s **Execution**, **show-report**, and **Summarizing Results** sections exactly as written, using the confirmed environment and scope from steps 2–3:
   - Full spec file run: `cd playwright && ENV=<env> npx playwright test <spec-file>`
   - Scoped run: `cd playwright && ENV=<env> npx playwright test <spec-file> --grep "<describe-name-or-pattern>"`
   - Always show the HTML report afterwards (`npx playwright show-report`), and always run `node playwright/scripts/summarize-test-results.js playwright/test-results/results.json` and relay its actual output.

6. **Apply the same Workflow State Checkpoint as `run-and-validate.md`**:
   - No failures → append `"run"` to `completed`, set `stage: "done"`.
   - Failures → append `"run"` to `completed`, set `stage: "repair"`, populate `failures[]` from the summary (`{ "id", "title", "breadcrumb", "decision": null, "status": "undecided" }`), set `remainingRepairs` to `failures.length`, and set `task` accordingly.

7. **Hand off to repair, unchanged** — if there are failures, follow `run-and-validate.md`'s **Handling Failures** section and then `self-heal.md`'s **"Handling Failures (multi-failure triage)"** section from that point on, exactly as they're already documented. Nothing about the repair mechanics (self-heal / raise-bug / skip, Phase 1/Phase 2, resuming from state) differs for this workflow — it only differs in how `run` was reached and in the state file having `scope` instead of `endpoint`.

### Requirements

- Never run tests against an environment without the user explicitly confirming both the environment and the run scope first (same rule as `run-and-validate.md`).
- Do not skip summarization — always run `summarize-test-results.js` and present its actual output, even if everything passed.
- This workflow only applies to V2 (Playwright). It has no equivalent for V1/Postman collections, since there's no run/repair loop for those.
- If `.ai/workflow-state.json` already shows `stage: "repair"` for this same `specFile`/`scope` with unresolved `failures`, resume per `self-heal.md`'s **"Resuming from state"** section instead of re-running from scratch — don't re-ask the environment/scope questions above.
