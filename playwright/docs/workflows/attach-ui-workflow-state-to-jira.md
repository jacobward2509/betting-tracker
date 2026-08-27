# Attach UI Workflow State to Jira

> Guard: only trigger this workflow when `.ai/ui-workflow-state.json` shows `stage: "done"` **and** `remainingRepairs: 0`. If `stateAttachedToJira` is already `true` in the state file, do not re-offer this for the same completed state — it's already been resolved (attached or explicitly declined).

## Trigger

This workflow triggers **automatically**, immediately after any Workflow State Checkpoint sets `stage: "done"` with `remainingRepairs: 0`. This happens at either:

- `ui-run-and-validate.md` — when a test run has no failures.
- `ui-self-heal.md` — once every entry in `failures` reaches `status: "resolved"` (end of the single-failure workflow, or end of Phase 2 of the multi-failure triage).

It is **not** a standalone trigger phrase — it only ever fires as a follow-on step once the guard condition above is met.

## Steps

1. Ask the user:

   > **Would you like the completed UI workflow state attached to a Jira ticket?** (Yes / No)
   - If **No** — do nothing further, update the workflow state (see checkpoint below), and continue as normal.
   - If **Yes**, continue to step 2.

2. **Derive a suggested ticket key:**
   - If `.ai/ui-workflow-state.json` has a non-null `ticket` field (set earlier by `ui-jira-attach.md`), default to that ticket key.
   - Otherwise, derive a suggested key from the current git branch name by extracting the first match of `[A-Z]+-[0-9]+`. Use `git branch --show-current` if not already known from context.
   - Either way, do not attempt to guess a key if neither source yields one — ask the user to provide it directly.

3. Ask the user to confirm the ticket key, offering the derived/default key as the default option alongside the ability to manually provide a different one:

   > **Shall I attach the workflow state to `<derived-ticket-key>`?**
   - Options: Confirm `<derived-ticket-key>` / Enter a different ticket key

4. Once the ticket key is confirmed, run:

   ```
   playwright/scripts/attach-workflow-state-to-jira.sh <TICKET_KEY> --state-file .ai/ui-workflow-state.json
   ```

   This performs two API calls:
   - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/attachments` — attaches `.ai/ui-workflow-state.json`
   - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/comment` — posts a concise summary comment:
     - No failures: `UI workflow state attached to ticket — all tests passed, no repairs needed.`
     - With failures: `UI workflow state attached to ticket — workflow complete.` followed by `Self-healed: <n> | Bugs raised: <n> (<KEY1>, <KEY2>) | Skipped: <n>`

   The script itself refuses to run unless `stage` is `"done"` and `remainingRepairs` is `0`, as a defensive check independent of this doc's guard.

5. Report the result back to the user — success (with the Jira attachment and comment responses) or failure (with the error returned). Note that the script can succeed at attaching the file but fail to post the comment — report both outcomes distinctly if this occurs.

See `general-rules.md` for credential handling and confirmation requirements.

---

## Workflow State Checkpoint

Once the user's Yes/No decision has been resolved (attached successfully, or explicitly declined):

- Update `.ai/ui-workflow-state.json`: set `stateAttachedToJira: true`.
- If a ticket was confirmed and attached, also record `stateAttachedToJiraTicket: "<TICKET_KEY>"`.

This is the final step of the workflow — no further stage transition happens after this (`stage` remains `"done"`).

### Requirements

- Never attach the workflow state file to Jira without explicit user confirmation of the exact ticket key.
- Do not re-offer this once `stateAttachedToJira` is `true` for the current completed state.
- Do not attempt to guess or invent a ticket key if one cannot be derived from either the state file's `ticket` field or the current git branch — ask the user to provide it directly.
