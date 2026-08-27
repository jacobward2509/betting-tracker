# Attach Incomplete Workflow State to Jira

> Guard: only trigger this workflow when the user has just chosen **"Abandon and overwrite"** in response to the "incomplete workflow in progress" conflict check (see `clinerules.md`'s "Starting a new workflow instance", and the guards in `test-plan-generation.md` / `run-existing-spec.md`). Never trigger this for a workflow that is already `stage: "done"` — that case is handled by `attach-workflow-state-to-jira.md` instead, automatically, as soon as `done` is reached.

## Trigger

This workflow triggers **automatically**, immediately after the user confirms they want to abandon and overwrite an in-progress `.ai/workflow-state.json` (any `stage` other than `"done"`, or `"done"` with `remainingRepairs` > 0) in favor of a new workflow instance (a different ticket/endpoint for `api-test-generation`, or a different `specFile`/`scope` for `api-test-execution`).

It is **not** a standalone trigger phrase — it only ever fires as a follow-on step of the existing conflict-check, and only on the "abandon and overwrite" branch. If the user instead chooses to finish the existing workflow first, this workflow does not run and the existing state file is left untouched.

## Steps

1. Ask the user:

   > **Before this in-progress workflow state is overwritten, would you like it attached to a Jira ticket?** (Yes / No)
   - If **No** — do nothing further; proceed straight to overwriting `.ai/workflow-state.json` with the new workflow's initial state.
   - If **Yes**, continue to step 2.

2. **Derive a suggested ticket key**, in priority order:
   - If the (soon-to-be-overwritten) `.ai/workflow-state.json` has a non-null `ticket` field (set earlier by `jira-attach.md` for `api-test-generation` workflows), default to that ticket key.
   - Otherwise, derive a suggested key from the current git branch name by extracting the first match of `[A-Z]+-[0-9]+` (e.g. branch `API-2806-improve-api-v-2-ai-workflow` → `API-2806`). Use `git branch --show-current` if not already known from context.
   - Otherwise, do not attempt to guess a key — ask the user to provide it directly.

3. Ask the user to confirm the ticket key, offering the derived/default key as the default option alongside the ability to manually provide a different one:

   > **Shall I attach the in-progress workflow state to `<derived-ticket-key>`?**
   - Options: Confirm `<derived-ticket-key>` / Enter a different ticket key

4. Once the ticket key is confirmed, run:

   ```
   playwright/scripts/attach-workflow-state-to-jira.sh <TICKET_KEY> --allow-incomplete
   ```

   This performs two API calls:
   - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/attachments` — attaches the current (still in-progress) `.ai/workflow-state.json`
   - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/comment` — posts a comment noting what was attached:
     - `Partial workflow state attached to ticket — a new task was started before this workflow completed.` followed by `Stage: <stage> | Completed: <completed.join(", ")> | Remaining repairs: <remainingRepairs>`

   The `--allow-incomplete` flag is required — without it, the script refuses to run against a non-`done` (or unresolved-repairs) state file by design.

5. Report the result back to the user — success (with the Jira attachment and comment responses) or failure (with the error returned). As with the completed-state workflow, the script can succeed at attaching the file but fail to post the comment — report both outcomes distinctly if this occurs.

6. **Whether the attach succeeded, failed, or was declined in step 1**, proceed to overwrite `.ai/workflow-state.json` with the new workflow's initial state, per the calling workflow's own instructions (`test-plan-generation.md` or `run-existing-spec.md`). A failed or declined attach must never block starting the new workflow — the user has already chosen to abandon the old one.

See `general-rules.md` for credential handling and confirmation requirements.

### Requirements

- Never attach the in-progress workflow state file to Jira without explicit user confirmation of the exact ticket key.
- Do not attempt to guess or invent a ticket key if one cannot be derived from either the state file's `ticket` field or the current git branch — ask the user to provide it directly.
- This workflow does not write anything to the state file itself (unlike `attach-workflow-state-to-jira.md`, which sets `stateAttachedToJira`) — the file is about to be overwritten by the new workflow's own initialization step regardless of the outcome here.
- Do not confuse this with `attach-workflow-state-to-jira.md` — that workflow is for a **completed** workflow state (`stage: "done"`, `remainingRepairs: 0`) and does not pass `--allow-incomplete`. This workflow is exclusively for the abandon/overwrite path on an **incomplete** workflow.
