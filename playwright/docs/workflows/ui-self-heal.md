# Self Heal of UI Failures

> Before starting, read `.ai/ui-workflow-state.json`. If `stage` is `"repair"` with any `failures` entries not `status: "resolved"`, resume from there instead of restarting the whole failure list — see **Resuming from state** at the bottom.

This workflow can be entered two ways:

1. **Standalone trigger** — the user says **"self heal of UI failures"** directly, for a single failure or a small set.
2. **From `ui-run-and-validate.md`** — as part of the multi-failure triage immediately after a UI test run, where the user may mix self-heal / raise-bug / skip decisions across several failures.

**Guard:** This workflow requires a failure report already produced in this session (from the **Run and Validate Playwright UI Tests** → **Summarizing Results** workflow, i.e. the output of `summarize-test-results.js`). If no failure report exists in context or in `.ai/ui-workflow-state.json`, ask the user to either run the tests first, or provide the path to an existing `playwright/test-results/summary.md` / `results.json` to summarize.

## Single-Failure Workflow (standalone trigger)

1. **Re-present the failures** from the most recent summary as a numbered list, each showing: breadcrumb (describe hierarchy), test title, `file:line`, and the first error line. Ask the user which failure(s) they want to self-heal:
   - Options: a specific number / a list of numbers / "all" (to go through them one-by-one)

2. **Investigate one failure at a time.** For the selected failure:
   - Read the failing test's code at its `file:line`, including its enclosing `describe` block(s), to understand which Page Object method(s) it calls and what assertion failed (locator not found, text mismatch, visibility mismatch, unexpected URL after navigation, etc.).
   - Read the corresponding Page Object method (`support/pages/<page-name>.page.ts`) to see the actual locator/assertion definition being exercised.
   - Cross-reference the actual error message and, where available, the screenshot/trace captured in the failure report to understand what the page actually rendered.

3. **Propose a concrete fix.** Based on the mismatch between expected and actual behavior, suggest a specific change — for example:

   > "This test expects the preferences section's `Configure` button text to read 'Configure', but the actual page renders 'Configure preferences'. Suggest updating the Page Object's `EXPECTED_CONFIGURE_BUTTON_TEXT` constant (or the inline assertion, if not yet promoted to a page-object method) to match the real copy."

   Or, for a locator drift:

   > "This test's locator `page.getByRole('button', { name: 'Submit' })` no longer matches — the button's accessible name changed to 'Create Account' in signup mode. Suggest updating the Page Object's `submitButton` locator to be mode-aware, or adding a dedicated `signupSubmitButton` locator."

   Present this suggestion clearly, but **the user always has final say** — nothing is applied until the user confirms, amends, or rejects it. Never silently apply a suggested fix.

4. **Clarify placement** if not already resolved as part of the confirmed fix — confirm whether the corrected test should:
   - Stay in its current spec file/tier,
   - Move into a different tier (e.g. a test miscategorized as Functional that's actually purely Cosmetic should move to `smoke/`) — ask which tier, or suggest the most appropriate one, or
   - Move into a brand new spec file (ask for its name).

5. **Apply the confirmed fix** using `replace_in_file` — update the Page Object locator/assertion/constant, update the test title if it no longer matches the scenario, and move the test between spec files/tiers if requested.

   > **State update:** in `.ai/ui-workflow-state.json`, find (or create) this failure's entry in `failures` and set `decision: "self-heal"`, `status: "fix-applied"`. Set `task` to this failure's title.

6. **Ask how to re-run the fix**, giving an explicit choice (required before running anything):
   - **Run just the fixed test in isolation**, or
   - **Run the whole enclosing describe block** — recommended when other tests in the block share Page Object state or ordering dependencies.

   Also confirm the environment (`dev` / `sit`) and, for `dev`, that the web dev server is running (per `ui-run-and-validate.md`'s Environment Setup section) if not already known from the original run in this session.

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
   - ✅ **Now passing** — confirm the fix worked, then ask if the corresponding test plan `.md` file (from `playwright/docs/test-plans/ui/`) should also be updated to reflect the corrected expected element/behavior.
     - **State update:** set this failure's entry in `.ai/ui-workflow-state.json`'s `failures` to `status: "resolved"`. Recompute `remainingRepairs` as the count of entries with `status !== "resolved"`. If it reaches `0`, append `"repair"` to `completed` and set `stage: "done"`.
   - ❌ **Still failing** — show the new error detail and ask whether to try another fix, skip this failure, or stop the self-heal session. The entry's `status` stays `"fix-applied"` (or moves to `"skip"` → `"resolved"` if the user now chooses to skip it) — it is not `"resolved"` until it actually passes or is explicitly skipped.

10. **Loop or finish** — if the user selected multiple/"all" failures in step 1, move to the next one and repeat from step 2. Otherwise, ask if they'd like to self-heal another failure from the original report.

### Requirements

- Never apply a code fix without explicit user confirmation of both the exact change and the spec-file/tier placement.
- Always let the user choose between isolated re-run and full-describe-block re-run — do not assume based on test type.
- Always re-summarize with `summarize-test-results.js` after every individual re-run before proposing the next fix.
- Do not batch-apply fixes even in "all" mode — confirm each fix individually before applying it.
- This workflow only operates on Playwright UI tests — it relies on the JSON test results report and Page Object source files.

---


## Handling Failures (multi-failure triage)

When entered from `ui-run-and-validate.md` with multiple failures decided across self-heal / raise-bug / skip, this operates in **two phases** to preserve the original failure context across all failures — identical structure to the API workflow's `self-heal.md`, retargeted at UI state and UI-specific investigation/fix details (Page Object methods and locators, not request/response schemas).

### Phase 1 — Collect decisions and apply fixes (no re-run yet)

1. For each failure in order, ask:

   > **How would you like to handle failure [N] — `<test title>`?**
   >
   > - **Self heal** — investigate and fix the test/Page Object code
   > - **Raise a Jira bug** — the application's actual UI behaviour is wrong; raise a dedicated bug ticket
   > - **Skip** — do nothing for now

2. For **Self heal** decisions, follow the **Single-Failure Workflow** steps 2–5 above (investigate, propose, clarify placement, apply) — but do **not** re-run yet. Set `decision: "self-heal"`, `status: "fix-applied"` on the failure's entry immediately after the fix is applied.

3. For **Skip** decisions, set `decision: "skip"`, `status: "resolved"` immediately — nothing further is needed for this failure.

4. For **Raise a Jira bug** decisions, set `decision: "raise-bug"`, `status: "pending"` for now — do not raise the ticket yet; this is deferred to Phase 2 (step 4 below) so the ticket reflects the post-fix state of the suite.

Recompute `remainingRepairs` after every individual decision.

### Phase 2 — Single combined re-run, then finalize

1. Once every failure has a decision recorded (no `status: "undecided"` entries remain), ask the user to confirm a single combined re-run covering every fixed test together — same "isolated tests" vs. "full describe block(s)" choice as the single-failure workflow, generalized to cover every entry with `status: "fix-applied"`.

2. Execute the re-run exactly as in the **Single-Failure Workflow** step 7 (preserve before-report, run, serve both reports on ports 9323/9324), scoped to the combined set of fixed tests/describe blocks.

3. Re-summarize (`node playwright/scripts/summarize-test-results.js playwright/test-results/results.json`) and relay the actual output.

4. For each entry that was `status: "fix-applied"`:
   - **Now passing** → set `status: "resolved"`.
   - **Still failing** → ask the user whether to try another fix (loop back into Phase 1 investigation for just this failure) or skip it (`decision: "skip"`, `status: "resolved"`).


5. For each entry with `decision: "raise-bug"` (`status: "pending"`), raise the ticket now:

   a. Ask whether to link this bug to a parent/epic ticket:
      > **Should this bug be linked to a parent/epic ticket?** (Yes / No)
      If Yes, ask for the epic key directly — never invent one.

   b. Draft a bug summary and description covering: the page/route affected, the expected vs. actual UI behavior, the test title and breadcrumb, and — where available — the screenshot/trace attachment path captured by the failed run. Show this draft to the user for confirmation before raising anything.

   c. Write the confirmed description to a temporary file, then run:

   ```
   playwright/scripts/raise-bug-to-jira.sh <PROJECT_KEY> "<SUMMARY>" <description-file> <LINKED_TICKET_KEY> <PARENT_EPIC_KEY>
   ```

   Where `<PROJECT_KEY>` is extracted from the linked ticket key, and `<PARENT_EPIC_KEY>` is omitted entirely from the command if the user said No in step (a).

   d. **Report the result** — on success, show the new ticket key and Jira link; on failure, show the error returned by the script.

   > **State update:** set this failure's `failures` entry to `status: "resolved"` once the bug ticket step is fully resolved (success or reported failure). Record the ticket key on the entry (e.g. `"bugTicket": "UI-99"`) if raised successfully. Recompute `remainingRepairs`.

6. **Present the final summary** of what was done across both phases:
   - ✅ **Self-healed:** [list of test titles]
   - 🐛 **Bugs raised:** [list of new Jira ticket keys with links]
   - ⏭️ **Skipped:** [list of test titles]

   If there were no failures, skip this section entirely.

   > **Final state update:** by this point every entry in `failures` should be `status: "resolved"` and `remainingRepairs` should be `0`. Append `"repair"` to `completed` and set `stage: "done"` in `.ai/ui-workflow-state.json`.

### Requirements

- **Never re-run the suite during Phase 1** — all code fixes must be applied before any re-run is triggered.
- **"Raise bug" actions are always deferred to Phase 2** — bug details must reflect the post-fix state of the suite.
- Never raise a bug ticket without explicit user confirmation of both the summary text and the linked ticket key.
- Always ask whether to link a parent/epic before raising the ticket — never assume Yes or No, and never invent a parent/epic key on the user's behalf.
- Never group multiple failures into one ticket unless the user explicitly requests it.
- Always write and show the description file to the user for confirmation before running the script.
- Do not attempt to guess or invent a ticket key if one cannot be derived from the branch name — ask the user to provide it directly.
- See `general-rules.md` for credential handling.

---

## Resuming from state

If `.ai/ui-workflow-state.json` shows `stage: "repair"` with any `failures` entries not `status: "resolved"` at the start of a session:

1. Trust the state file's `failures` array over anything recalled from earlier in the conversation. Don't re-derive progress from the conversation transcript if it's present in `failures`.
2. Group the unresolved entries by their current state and act accordingly, without re-asking anything already decided:
   - `decision: null` / `status: "undecided"` → still needs the "Self heal / Raise a Jira bug / Skip" question.
   - `status: "fix-applied"` → code fix already applied; this is a Phase 2 candidate, not something to re-investigate.
   - `status: "pending"` (i.e. `decision: "raise-bug"`) → waiting on Phase 2 to actually raise the ticket; the failure itself doesn't need re-triage.
3. If the failure report's raw details (error messages, `file:line`, screenshots) aren't already in context, ask the user to re-share or point to the latest `playwright/test-results/summary.md` / `results.json` — the state file tracks _decisions and progress_, not the raw report.
4. Continue the loop (Phase 1 remainder, or straight into Phase 2 if Phase 1 is already fully decided) from wherever it left off; do not restart already-resolved failures.

