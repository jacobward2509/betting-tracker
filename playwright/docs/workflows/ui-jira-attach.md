# Attach UI Test Plan to Jira

> Guard: if `.ai/ui-workflow-state.json` shows `stage` is already past `"jira"` for this scope (i.e. `"jira"` is in `completed`), do not re-run this workflow — it has already been resolved (attached or explicitly skipped).

Immediately after a UI test plan markdown file has been generated and saved, always ask the user:

> **Would you like this UI test plan attached to a Jira ticket?** (Yes / No)

- If **No** — do nothing further, update the workflow state (see below), and continue as normal.
- If **Yes**:
  1. Derive a suggested ticket key from the current git branch name by extracting the first match of `[A-Z]+-[0-9]+` (e.g. branch `UI-42-auth-page-coverage` → `UI-42`). Use `git branch --show-current` if the branch name is not already known from context.
  2. Ask the user to confirm the ticket key, offering the derived key as the default option alongside the ability to manually provide a different ticket key:
     > **Shall I attach this to `<derived-ticket-key>`?**
     - Options: Confirm `<derived-ticket-key>` / Enter a different ticket key
  3. Ask the user for the **page/scope identifier** to reference in the Jira comment. Do not silently auto-derive this — always ask, though you may suggest a default derived from the test plan filename (e.g. `ui-test-plan-auth.md` → `auth`) that the user can accept or override:
     > **What page/scope identifier should be referenced in the Jira comment?** (suggested: `<derived-scope-id>`)
  4. Once the ticket key and scope identifier are confirmed, run the following command to attach the test plan file and post a comment noting the attachment:
     ```
     playwright/scripts/attach-test-plan-to-jira.sh <TICKET_KEY> <path-to-generated-ui-test-plan.md> <SCOPE_ID>
     ```
     This performs two API calls:
     - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/attachments` — attaches the file
     - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/comment` — posts a comment reading: `UI test plan for <SCOPE_ID> attached to ticket`
  5. Report the result back to the user — success (with the Jira attachment and comment responses) or failure (with the error returned). Note that the script can succeed at attaching the file but fail to post the comment (or vice versa is not possible, as the comment step only runs after a successful attachment) — report both outcomes distinctly if this occurs.

See `general-rules.md` for credential handling and confirmation requirements.

---

## Workflow State Checkpoint

Once the user's Yes/No decision has been resolved (attached successfully, or explicitly declined):

- Update `.ai/ui-workflow-state.json`: set `stage: "generate"`, append `"jira"` to `completed`.
- If a ticket was confirmed and attached, set `ticket` to `<TICKET_KEY>`.

Then **automatically continue** into `playwright-ui-generation.md` — do not wait for the user to say "Now generate UI tests"; that trigger phrase only matters if generation is being (re-)started as a standalone action later, disconnected from a ui-jira-attach step in the same session.
