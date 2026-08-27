# Test Plan Generation

> Before starting, read `.ai/api-workflow-state.json` per the **Workflow State** section of `clinerules.md`. If an incomplete workflow already exists for a _different_ ticket/endpoint, confirm with the user whether to abandon/overwrite it or finish it first — same rule as `clinerules.md`'s "Starting a new workflow instance". If the user chooses to abandon and overwrite, follow `attach-incomplete-state-to-jira.md` first (offering to attach the current state to a Jira ticket) before writing the new workflow's initial state.

## Trigger Phrase

When the user says **"create a new API test plan"** (or any close variation), the **first** question to ask is always:

> **Which API version is this test plan for — V1 or V2?**

Do not ask for any other information until the version has been confirmed.

---

### If V2

Ask for the following three pieces of information before doing anything else:

1. **HTTP Method** — e.g. `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
2. **Endpoint path** — e.g. `/customers/{customerId}`
3. **YML file path** — the path to the OpenAPI spec file in the repo (e.g. `customer-openapi.yml`)

Do not proceed with any file reading or test plan generation until all three have been provided.

The user's standard V2 prompt template is:

> I want to create a test plan for an API Endpoint. Refer to the `api-test-scenarios.md` guidelines (read `playwright/docs/api-test-scenarios.md` if not already read this session) to create a test plan that follows the appropriate guidelines.
>
> Endpoint Information:
>
> YML File - `<yml-file>`
> Specific endpoint to cover - `<HTTP method> <endpoint path>`
>
> I want the test plan to include the similar scenarios as we have in the SPEC FILE, plus any additional tests relevant to fields declared in the yml file.
>
> If you need to navigate through the repo to access relevant schema documentation, please do so, this includes nested response body schemas.
>
> Ask any clarifying questions.

Once all three pieces of information are provided, proceed with the V2 Test Plan Generation Workflow below.

---

### If V1

Ask for the following single piece of information before doing anything else:

1. **Markdown file path** — the path to the Confluence page that has been converted to a Markdown file (e.g. `docs/v1/some-endpoint.md`)

Do not proceed with any file reading or test plan generation until this has been provided.

- The HTTP method for V1 endpoints is **always `POST`**.
- The endpoint path is **listed within the Markdown file** — do not ask for it separately.
- The `operationId` / category for the output file is derived from the **title of the Markdown page**.

Once the Markdown file path has been provided, proceed with the V1 Test Plan Generation Workflow below.

---

## V2 Test Plan Generation Workflow

1. **Refer to `api-test-scenarios.md`** (read `playwright/docs/api-test-scenarios.md` if not already read this session) for the full test scenario guidelines.
2. **Read the provided YML file** to extract endpoint details: path parameters, query parameters, request body schema, response codes, and any referenced schemas.
3. **Navigate nested schemas** — if the YML references `$ref` schemas, follow them through the repo to understand all fields.
4. **Cross-reference existing spec files** in `tests/api/` to identify the patterns already in use for similar endpoints.
5. **Generate the test plan** as a markdown file following the Output Format section of `api-test-scenarios.md` and the Test Plan Output Rules in `general-rules.md`.
6. **Save the output** to `playwright/docs/test-plans/<category>/test-plan-<operation-id>.md`, where:
   - `<category>` is derived from the endpoint path (e.g. `cycle-count`, `bin-log`, `lstock-location`)
   - `<operation-id>` matches the `operationId` in the YML file (kebab-case)

## V1 Test Plan Generation Workflow

1. **Refer to `api-test-scenarios.md`** (read `playwright/docs/api-test-scenarios.md` if not already read this session) for the full test scenario guidelines.
2. **Read the provided Markdown file** to extract endpoint details: the endpoint path, request body fields, and any other relevant information described in the Confluence page.
3. **Status codes** — Confluence pages do not explicitly state HTTP status codes. Always derive them from the **Error Code Mapping table** in the General Rules section of `api-test-scenarios.md`. Do not ask the user for status codes.
4. **Cross-reference existing spec files** in `tests/api/` to identify the patterns already in use for similar endpoints.
5. **Generate the test plan** as a markdown file following the Output Format section of `api-test-scenarios.md` and the Test Plan Output Rules in `general-rules.md`.
6. **Save the output** to `playwright/docs/test-plans/<category>/test-plan-<operation-id>.md`, where:
   - `<category>` is derived from the endpoint path (e.g. `cycle-count`, `bin-log`, `lstock-location`)
   - `<operation-id>` is derived from the **title of the Markdown page** (kebab-case)

---

## Workflow State Checkpoint

Immediately after the test plan file is generated and saved (V1 or V2):

- If `.ai/api-workflow-state.json` does not yet exist for this endpoint, create it with:
  `workflow: "api-test-generation"`, `apiVersion`, `endpoint` (method/path/operationId), `testPlanFile`, `stage: "jira"`, `completed: ["plan"]`.
- If it already exists for this endpoint, set `stage: "jira"` and append `"plan"` to `completed`.

Once the test plan file has been generated, saved, and the state file updated (V1 or V2), proceed to **`jira-attach.md`**.
