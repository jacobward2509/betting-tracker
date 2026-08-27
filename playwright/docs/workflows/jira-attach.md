# Attach Test Plan to Jira

> Guard: if `.ai/workflow-state.json` shows `stage` is already past `"jira"` for this ticket/endpoint (i.e. `"jira"` is in `completed`), do not re-run this workflow — it has already been resolved (attached or explicitly skipped).

Immediately after a test plan markdown file has been generated and saved (whether V1 or V2), always ask the user:

> **Would you like this test plan attached to a Jira ticket?** (Yes / No)

- If **No** — do nothing further, update the workflow state (see below), and continue as normal.
- If **Yes**:
  1. Derive a suggested ticket key from the current git branch name by extracting the first match of `[A-Z]+-[0-9]+` (e.g. branch `API-2806-improve-api-v-2-ai-workflow` → `API-2806`). Use `git branch --show-current` if the branch name is not already known from context.
  2. Ask the user to confirm the ticket key, offering the derived key as the default option alongside the ability to manually provide a different ticket key:
     > **Shall I attach this to `<derived-ticket-key>`?**
     - Options: Confirm `<derived-ticket-key>` / Enter a different ticket key
  3. Ask the user for the **operation-ID** to reference in the Jira comment. Do not silently auto-derive this — always ask, though you may suggest a default derived from the test plan filename (e.g. `test-plan-update-customer-us.md` → `update-customer-us`) that the user can accept or override:
     > **What operation-ID should be referenced in the Jira comment?** (suggested: `<derived-operation-id>`)
  4. Once the ticket key and operation-ID are confirmed, run the following command to attach the test plan file and post a comment noting the attachment:
     ```
     playwright/scripts/attach-test-plan-to-jira.sh <TICKET_KEY> <path-to-generated-test-plan.md> <OPERATION_ID>
     ```
     This performs two API calls:
     - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/attachments` — attaches the file
     - `POST {JIRA_BASE_URL}/rest/api/3/issue/{TICKET_KEY}/comment` — posts a comment reading: `Test plan for <OPERATION_ID> attached to ticket`
  5. Report the result back to the user — success (with the Jira attachment and comment responses) or failure (with the error returned). Note that the script can succeed at attaching the file but fail to post the comment (or vice versa is not possible, as the comment step only runs after a successful attachment) — report both outcomes distinctly if this occurs.

See `general-rules.md` for credential handling and confirmation requirements.

---

## Workflow State Checkpoint

Once the user's Yes/No decision has been resolved (attached successfully, or explicitly declined):

- Update `.ai/workflow-state.json`: set `stage: "generate"`, append `"jira"` to `completed`.
- If a ticket was confirmed and attached, set `ticket` to `<TICKET_KEY>`.

Then **automatically continue** into the appropriate generation workflow — do not wait for the user to say "Now generate postman collection" / "Now generate playwright tests"; that trigger phrase only matters if generation is being (re-)started as a standalone action later, disconnected from a jira-attach step in the same session:

- V1 → read and follow **`postman-generation.md`**
- V2 → read and follow **`playwright-api-generation.md`**
