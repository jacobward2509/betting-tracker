# Self Heal of Failures

> Before starting, read `.ai/api-workflow-state.json`. If `stage` is `"repair"` with any `failures` entries not `status: "resolved"`, resume from there instead of restarting the whole failure list — see **Resuming from state** at the bottom.

This workflow can be entered two ways:

1. **Standalone trigger** — the user says **"self heal of failures"** directly, for a single failure or a small set.
2. **From `run-and-validate.md`** — as part of the multi-failure triage immediately after a test run, where the user may mix self-heal / raise-bug / skip decisions across several failures.

**Guard:** This workflow requires a failure report already produced in this session (from the **Run and Validate Playwright Tests** → **Summarizing Results** workflow, i.e. the output of `summarize-test-results.js`). If no failure report exists in context or in `.ai/api-workflow-state.json`, ask the user to either run the tests first, or provide the path to an existing `playwright/test-results/summary.md` / `results.json` to summarize.

## Single-Failure Workflow (standalone trigger)

1. **Re-present the failures** from the most recent summary as a numbered list, each showing: breadcrumb (describe hierarchy), test title, `file:line`, and the first error line. Ask the user which failure(s) they want to self-heal:
   - Options: a specific number / a list of numbers / "all" (to go through them one-by-one)

2. **Investigate one failure at a time.** For the selected failure:
   - Read the failing test's code at its `file:line`, including its enclosing `describe` block(s), to understand the current request body, expected status code/schema assertion (e.g. `assert400Schema`, `expect(response.status()).toBe(400)`), and test title.
   - Cross-reference the actual error message/response captured in the failure report to understand what the API actually returned.

3. **Propose a concrete fix.** Based on the mismatch between expected and actual behavior, suggest a specific change — for example:

   > "This test currently expects `400` (via `assert400Schema`) but the API returned `404 Not Found`. Suggest changing the assertion to `assert404Schema` / `toBe(404)`, updating the test title to reflect a Not Found scenario, and moving it into the existing `404 - Not Found` describe block."

   Present this suggestion clearly, but **the user always has final say** — nothing is applied until the user confirms, amends, or rejects it. Never silently apply a suggested fix.

4. **Clarify placement** if not already resolved as part of the confirmed fix — confirm whether the corrected test should:
   - Stay in its current describe block,
   - Move into an existing describe block (ask which one, or suggest the most appropriate existing one), or
   - Move into a brand new describe block (ask for its name).

5. **Apply the confirmed fix** using `replace_in_file` — update the status code assertion/schema-assert helper, update the test title if it no longer matches the scenario, and move the test between describe blocks if requested.

   > **State update:** in `.ai/api-workflow-state.json`, find (or create) this failure's entry in `failures` and set `decision: "self-heal"`, `status: "fix-applied"`. Set `task` to this failure's title.

6. **Ask how to re-run the fix**, giving an explicit choice (required before running anything):
   - **Run just the fixed test in isolation**, or
   - **Run the whole enclosing describe block** — recommended when other tests in the block create shared/dependent variables (e.g. IDs created in a prior test) that the fixed test may rely on.

   Also confirm the environment (`dev` / `sit`) if not already known from the original run in this session.

7. **Execute the re-run** from the `playwright/` directory, scoped per the user's choice in step 6:

   a. **Before re-running, preserve the "before" report** so the original failure report isn't overwritten. From the `playwright/` directory:

   ```
   rm -rf playwright-report-before-fix && cp -r playwright-report playwright-report-before-fix
   ```

   b. **Run the re-run command:**
   - Isolated single test: `cd playwright && ENV=<env> npx playwright test <spec-file> --grep "<unique test title or describe>"`
   - Full describe block: `cd playwright && ENV=<env> npx playwright test <spec-file> --grep "<describe block name>"`

   This regenerates `playwright-report/` fresh, representing the "after" (fix) report.

   c. **Serve both reports simultaneously** on two different ports so the user can compare before/after side-by-side in two browser tabs:

   ```
   npx playwright show-report playwright-report-before-fix --port 9323 &
   npx playwright show-report playwright-report --port 9324 &
   ```

   Tell the user clearly which URL is which:
   - `http://localhost:9323` — **Before** (the original failing run)
   - `http://localhost:9324` — **After** (the fix re-run)

   Do this every time, not just on failure — the config's default HTML reporter behavior only auto-opens the report on failure locally (and never on CI), so this step must be run explicitly to guarantee both reports are always shown.

8. **Re-summarize** using the same summarization step as the main run workflow:

   ```
   node playwright/scripts/summarize-test-results.js playwright/test-results/results.json
   ```

   Relay the actual script output — do not fabricate or paraphrase results.

9. **Report the outcome:**
   - ✅ **Now passing** — confirm the fix worked, then ask if the corresponding test plan `.md` file (from `playwright/docs/test-plans/`) should also be updated to reflect the corrected expected status code/scenario description.
     - **State update:** set this failure's entry in `.ai/api-workflow-state.json`'s `failures` to `status: "resolved"`. Recompute `remainingRepairs` as the count of entries with `status !== "resolved"`. If it reaches `0`, append `"repair"` to `completed` and set `stage: "done"`.
   - ❌ **Still failing** — show the new error detail and ask whether to try another fix, skip this failure, or stop the self-heal session. The entry's `status` stays `"fix-applied"` (or moves to `"skip"` → `"resolved"` if the user now chooses to skip it) — it is not `"resolved"` until it actually passes or is explicitly skipped.

10. **Loop or finish** — if the user selected multiple/"all" failures in step 1, move to the next one and repeat from step 2. Otherwise, ask if they'd like to self-heal another failure from the original report.

### Requirements

- Never apply a code fix without explicit user confirmation of both the exact change and the describe-block placement.
- Always let the user choose between isolated re-run and full-describe-block re-run — do not assume based on test type.
- Always re-summarize with `summarize-test-results.js` after every individual re-run before proposing the next fix.
- Do not batch-apply fixes even in "all" mode — confirm each fix individually before applying it.
- This workflow only operates on Playwright/V2 tests (it relies on the JSON test results report), it does not apply to V1/Postman collections.

---

## Handling Failures (multi-failure triage)

When entered from `run-and-validate.md` with multiple failures decided across self-heal / raise-bug / skip, this operates in **two phases** to preserve the original failure context across all failures.

### Phase 1 — Collect decisions and apply code fixes (no re-run)

Work through every failure in order, collecting a decision for each one. **Do not re-run the suite at any point during Phase 1.**

#### If "Self heal"

Execute only **steps 2–5** of the Single-Failure Workflow above (investigate → propose fix → clarify placement → apply the code change via `replace_in_file`). Do **not** proceed to steps 6–10 (re-run, serve reports, re-summarize, outcome reporting). Once the fix is applied, move immediately to the next failure.

> **State update:** set this failure's entry in `failures` to `decision: "self-heal"`, `status: "fix-applied"`.

#### If "Raise a Jira bug"

Note this failure as **pending — bug to be raised after re-run**. Do not raise the ticket yet. Move to the next failure.

> **State update:** set this failure's entry in `failures` to `decision: "raise-bug"`, `status: "pending"`.

#### If "Skip"

Note this failure as skipped.

> **State update:** set this failure's entry in `failures` to `decision: "skip"`, `status: "resolved"` — skips are resolved immediately since there's nothing further to do for them.

Move to the next failure.

Continue until every failure has a decision and every self-heal code fix has been applied. At the end of Phase 1, recompute `remainingRepairs` as the count of entries with `status !== "resolved"` (this will be the self-heal + raise-bug entries — skips are already excluded) and set `task` to something like `"Phase 1 complete — N self-healed pending re-run, M pending bug raise"`.

**Worked example — 12 failures, 1–4 self-healed, 5–6 raise-bug, 7–12 skipped, end of Phase 1:**

```json
"stage": "repair",
"task": "Phase 1 complete — 4 self-healed pending re-run, 2 pending bug raise",
"remainingRepairs": 6,
"failures": [
  { "id": 1, "title": "...", "decision": "self-heal", "status": "fix-applied" },
  { "id": 2, "title": "...", "decision": "self-heal", "status": "fix-applied" },
  { "id": 3, "title": "...", "decision": "self-heal", "status": "fix-applied" },
  { "id": 4, "title": "...", "decision": "self-heal", "status": "fix-applied" },
  { "id": 5, "title": "...", "decision": "raise-bug", "status": "pending" },
  { "id": 6, "title": "...", "decision": "raise-bug", "status": "pending" },
  { "id": 7, "title": "...", "decision": "skip", "status": "resolved" },
  { "id": 8, "title": "...", "decision": "skip", "status": "resolved" },
  { "id": 9, "title": "...", "decision": "skip", "status": "resolved" },
  { "id": 10, "title": "...", "decision": "skip", "status": "resolved" },
  { "id": 11, "title": "...", "decision": "skip", "status": "resolved" },
  { "id": 12, "title": "...", "decision": "skip", "status": "resolved" }
]
```

`remainingRepairs` is `6` — the 4 fix-applied plus the 2 pending-bug, since none of those are confirmed resolved yet. This is what lets a resumed session (or the next step in this one) know exactly which 6 entries still need Phase 2 attention, instead of just a bare count that could mean anything.

### Phase 2 — Single re-run, then finalise

Once all decisions have been collected and all self-heal code fixes applied, proceed as follows:

1. **Confirm re-run scope and environment** — ask the user (same as step 6 above):
   - **Which environment?** (`dev` / `sit`)
   - **What scope?** Run just the fixed tests in isolation, or run the full spec file?

2. **Execute the single re-run** following steps 7–8 above:
   - Preserve the before-report: `rm -rf playwright-report-before-fix && cp -r playwright-report playwright-report-before-fix`
   - Run the suite at the confirmed scope and environment.
   - Serve both reports side-by-side:
     ```
     npx playwright show-report playwright-report-before-fix --port 9323 &
     npx playwright show-report playwright-report --port 9324 &
     ```
     (`http://localhost:9323` = Before, `http://localhost:9324` = After)
   - Re-summarize: `node playwright/scripts/summarize-test-results.js playwright/test-results/results.json`

3. **Report self-heal outcomes** — for each previously self-healed test, report whether it is now ✅ passing or ❌ still failing (with the new error detail). If still failing, ask whether to try another fix, skip, or stop.

   > **State update:** for each self-heal entry now confirmed ✅ passing, set its `failures` entry to `status: "resolved"`. For each still ❌ failing, leave `status: "fix-applied"` (or update to `decision: "skip"`, `status: "resolved"` if the user chooses to stop trying). Recompute `remainingRepairs`.

4. **Process pending "raise bug" decisions** — now raise each deferred bug ticket using the updated failure details from the new run. For each one:

   a. **Derive the linked ticket key** from the current git branch name by extracting the first match of `[A-Z]+-[0-9]+` (e.g. branch `API-2806-improve-api-v-2-ai-workflow` → `API-2806`). Use `git branch --show-current` if not already known. Ask the user to confirm the key, offering the derived key as the default:

   > **Shall I link this bug to `<derived-ticket-key>`?**
   - Options: Confirm `<derived-ticket-key>` / Enter a different ticket key

   a2. **Ask whether to link a parent/epic** to the new bug ticket:

   > **Would you like to link this bug to a parent/epic?**
   - Options: Yes / No

   - If **No**, continue to step (b) with no parent/epic — the bug is created as normal (this is the default, unchanged behaviour).
   - If **Yes**, ask the user for the parent/epic ticket key (e.g. `API-2000`). Confirm the key back to the user before proceeding. There is no derivation/default for this value — unlike the linked ticket, it must always be explicitly provided by the user.

   > **State update:** once decided, record `parentEpicKey` (or `null` if the user said No) on this failure's `failures` entry.

   b. **Compose a bug summary** automatically from the failure details in the format:
   `[<HTTP method> <endpoint path>] <test title> — returns <actual status> instead of <expected status>`
   Show this to the user and ask them to confirm or amend before proceeding.

   c. **Write a description file** to `playwright/support/bug-descriptions/bug-description-<kebab-test-title>.txt` containing a structured description with the following sections derived from the failure details:
   - **Breadcrumb** (describe hierarchy)
   - **Test title**
   - **File location** (`file:line`)
   - **Error message** (from the failure report)
   - **Steps to Reproduce**
   - **Expected behaviour**
   - **Actual behaviour**
   - **Request Body** — the actual JSON payload sent, wrapped in a fenced code block (\`\`\`json ... \`\`\`). Pull this from the `request-body (...)` attachment captured by `summarize-test-results.js` for this failure (sourced from `attachRequestAndResponse()` in `support/functions/request-methods.ts`) — never reconstruct/guess this from the test source code if the captured attachment is available. If no request body was captured (e.g. a GET with no body), omit this section entirely.
   - **Response Body** — the actual response body returned by the API, wrapped in a fenced code block (\`\`\`json ... \`\`\`). Pull this from the corresponding `response-body (...)` attachment the same way. If the captured body was truncated (ends with the `...[truncated — exceeded 10KB limit]` marker), keep that marker visible in the ticket so readers know it's not the full payload.

   If the attachments aren't available at all (e.g. summarizing an older `results.json` predating this capture, or the request/response legitimately has no body), note that in the ticket instead of fabricating content, and mention it to the user when showing the draft.

   Show the user the description content and ask them to confirm or amend it before raising the ticket.

   d. **Run the script** once the summary and description are confirmed:

   ```
   playwright/scripts/raise-bug-to-jira.sh <PROJECT_KEY> "<SUMMARY>" <description-file> <LINKED_TICKET_KEY> <PARENT_EPIC_KEY>
   ```

   Where `<PROJECT_KEY>` is extracted from the linked ticket key (e.g. `API` from `API-2806`), and `<PARENT_EPIC_KEY>` is omitted entirely from the command if the user said No in step (a2).

   e. **Report the result** — on success, show the new ticket key and Jira link, and confirm the parent/epic link if one was set; on failure, show the error returned by the script. Note that a failed link step does not undo a successful ticket creation — report both outcomes distinctly if this occurs.

   > **State update:** set this failure's `failures` entry to `status: "resolved"` once the bug ticket step is fully resolved (success or reported failure) — a raised bug counts as this failure being handled, even though the test itself remains failing. Record the ticket key on the entry (e.g. `"bugTicket": "API-456"`) if raised successfully. Recompute `remainingRepairs`.

5. **Present the final summary** of what was done across both phases:
   - ✅ **Self-healed:** [list of test titles]
   - 🐛 **Bugs raised:** [list of new Jira ticket keys with links]
   - ⏭️ **Skipped:** [list of test titles]

   If there were no failures, skip this section entirely.

   > **Final state update:** by this point every entry in `failures` should be `status: "resolved"` and `remainingRepairs` should be `0`. Append `"repair"` to `completed` and set `stage: "done"` in `.ai/api-workflow-state.json`.

### Requirements

- **Never re-run the suite during Phase 1** — all code fixes must be applied before any re-run is triggered.
- **"Raise bug" actions are always deferred to Phase 2** — bug details must reflect the post-fix state of the suite.
- Never raise a bug ticket without explicit user confirmation of both the summary text and the linked ticket key.
- Always ask whether to link a parent/epic before raising the ticket — never assume Yes or No, and never invent a parent/epic key on the user's behalf; it must be explicitly provided when the user opts in.
- Never group multiple failures into one ticket unless the user explicitly requests it.
- Always write and show the description file to the user for confirmation before running the script.
- Do not attempt to guess or invent a ticket key if one cannot be derived from the branch name — ask the user to provide it directly.
- See `general-rules.md` for credential handling.

---

## Resuming from state

If `.ai/api-workflow-state.json` shows `stage: "repair"` with any `failures` entries not `status: "resolved"` at the start of a session:

1. Trust the state file's `failures` array over anything recalled from earlier in the conversation, per the Workflow State rules in `clinerules.md`. Don't re-derive progress from the conversation transcript if it's present in `failures`.
2. Group the unresolved entries by their current state and act accordingly, without re-asking anything already decided:
   - `decision: null` / `status: "undecided"` → still needs the "Self heal / Raise a Jira bug / Skip" question.
   - `status: "fix-applied"` → code fix already applied; this is a Phase 2 candidate, not something to re-investigate.
   - `status: "pending"` (i.e. `decision: "raise-bug"`) → waiting on Phase 2 to actually raise the ticket; the failure itself doesn't need re-triage.
3. If the failure report's raw details (error messages, `file:line`) aren't already in context, ask the user to re-share or point to the latest `playwright/test-results/summary.md` / `results.json` — the state file tracks _decisions and progress_, not the raw report.
4. Continue the loop (Phase 1 remainder, or straight into Phase 2 if Phase 1 is already fully decided) from wherever it left off; do not restart already-resolved failures.
