# Generate Postman Collection (V1 only)

> Guard: if `.ai/api-workflow-state.json` shows `"generate"` already in `completed` for this endpoint, don't regenerate — ask the user if they want to explicitly redo it.

## Entry Points

This workflow starts one of two ways:

1. **Automatically**, immediately after `jira-attach.md` resolves for a V1 endpoint — no need to wait for the trigger phrase below.
2. **Trigger phrase** — the user says **"Now generate postman collection"** (or any close variation), e.g. to (re)run generation as a standalone action later in the session.

In either case, still run the workflow's own steps in full (including asking about an existing Postman collection reference in step 3 below) — automatic entry skips the trigger phrase, not the required inputs.

**Guard:** Check the conversation context / `.ai/api-workflow-state.json`. If the test plan generated in this session was for a **V2** endpoint, respond with:

> ❌ _"Postman collection generation is only available for V1 endpoints. For V2 endpoints, use 'Now generate playwright tests' instead."_

**If V1 — proceed with this workflow:**

1. **Read all files** in `playwright/docs/postman-collection-generation/` in the order defined in the README (`00-checklist.md` through `13-common-mistakes.md`). Do not skip any files.
2. **Read the test plan Markdown file** generated in this session to extract all test scenarios.
3. **Ask the user** if they would like to provide an existing Postman collection JSON for reference — to understand how similar endpoints have been covered and to reuse assertion patterns. Do not attempt to locate the file automatically.
4. **Generate the importable Postman collection** following all guidelines in `playwright/docs/postman-collection-generation/README.md`.

---

## Workflow State Checkpoint

Once the collection has been generated:

- Update `.ai/api-workflow-state.json`: append `"generate"` to `completed`, set `stage: "done"`.
- V1 has no automated run/repair loop in this workflow, so `"done"` is the terminal stage.
