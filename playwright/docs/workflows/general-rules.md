# General Rules

These apply across every workflow in `playwright/docs/workflows/`.

## Information Gathering

- Do not ask for information that can be derived from the YML file or existing repo files.
- Always navigate the repo to find referenced schemas rather than making assumptions.
- Ask clarifying questions only when genuinely ambiguous.

## Jira Credentials

- The Jira scripts (`attach-test-plan-to-jira.sh`, `raise-bug-to-jira.sh`) read `JIRA_BASE_URL`, `JIRA_USER`, and `JIRA_API_TOKEN` from `playwright/.env.sit` (falling back to `playwright/.env.dev`).
- These must be populated by the user themselves — do not ask the user for these credentials in chat, and never print their values.

## Confirmation Requirements

- Never attach a file to Jira, raise a bug ticket, or apply a code fix without explicit user confirmation of the exact action being taken.
- Do not attempt to guess or invent a ticket key if one cannot be derived from the current git branch (`git branch --show-current`, extracting `[A-Z]+-[0-9]+`) — ask the user to provide it directly.
- Never batch-apply actions (fixes, bug tickets) without per-item confirmation, even when the user says "all" / "do them all".

## Test Plan Output Rules

- Always include the scenario table with columns: `Scenario | Scenario Type | Use Case | Description | HTTP Return Status Code`
- Cover all scenario types: Accepted, Negative – Missing Mandatory Data, Negative – Invalid Data Types, Negative – No Authentication, Negative – Internal Server Error
- Include tests for every required and optional field declared in the YML schema
- Include tests for every path parameter, query parameter, and request body field
- Follow the Coverage Rules section of `api-test-scenarios.md`
- Follow the Output Order section of `api-test-scenarios.md`
