# Playwright Setup Workflow

> This workflow scaffolds the full `playwright/` folder structure into the **current working directory** (the repo Cline is open in). Progress is tracked in `.ai/playwright-setup-state.json` — a dedicated state file separate from `.ai/workflow-state.json` — so the setup can be resumed if interrupted.

## Trigger Phrase

When the user says **"Add Playwright to my repo"** (or any close variation):

1. **Check `.ai/playwright-setup-state.json`** — if it exists and `stage` is not `"done"`, tell the user there is an incomplete Playwright setup in progress and ask:

   > **Would you like to resume the existing setup, or start fresh?**
   - If **resume** — read the `tasks` array and continue from the first task with `status !== "done"`. Do not redo completed tasks.
   - If **start fresh** — overwrite the state file and begin from task 1.

2. **Informational note** — if `.ai/workflow-state.json` also exists and is not at `stage: "done"`, mention it to the user as an FYI (the two files are independent; there is no conflict).

3. **Write the initial state file** at `.ai/playwright-setup-state.json` with all tasks `"pending"` (see schema below), then begin working through the tasks in order.

---

## State File Schema

File path: `.ai/playwright-setup-state.json`

```json
{
  "workflow": "playwright-setup",
  "stage": "setup",
  "completed": [],
  "task": "Starting setup",
  "tasks": [
    { "id": "package-json", "label": "package.json", "status": "pending" },
    { "id": "tsconfig", "label": "tsconfig.json", "status": "pending" },
    {
      "id": "playwright-config",
      "label": "playwright.config.ts",
      "status": "pending"
    },
    { "id": "gitignore", "label": ".gitignore", "status": "pending" },
    { "id": "env-example", "label": ".env.example", "status": "pending" },
    { "id": "ci-yml", "label": "api-test.gitlab-ci.yml", "status": "pending" },
    {
      "id": "tests-folder",
      "label": "tests/ + setup + example spec",
      "status": "pending"
    },
    {
      "id": "support-functions",
      "label": "support/functions/",
      "status": "pending"
    },
    {
      "id": "support-seed-data",
      "label": "support/seed-data/",
      "status": "pending"
    },
    {
      "id": "gitkeep-folders",
      "label": "support/endpoint-schema-assertions/, support/dynamic-test-data/, support/bug-descriptions/",
      "status": "pending"
    },
    {
      "id": "support-fixtures",
      "label": "support/fixtures/ (optional)",
      "status": "pending",
      "optional": true
    },
    { "id": "scripts", "label": "scripts/", "status": "pending" },
    { "id": "docs", "label": "docs/", "status": "pending" },
    { "id": "npm-install", "label": "npm install", "status": "pending" }
  ]
}
```

### State update rules

- Before starting each task: set its `status` to `"in-progress"` and update `task` to a short description (e.g. `"Creating package.json"`). Write the state file.
- After completing each task: set its `status` to `"done"` and append its `id` to `completed`. Write the state file **before** moving to the next task.
- When all tasks are `"done"`: set `stage: "done"` and `task: "Setup complete"`.

> ⚠️ **No batching — ever.** Each task must be written to the state file individually, even if the task is trivial (e.g. creating a single empty `.gitkeep`). Never update the state file for more than one task at a time, and never defer state writes until a group of tasks is finished.

---

## Task Execution

Work through each task in order. For each one, set `status: "in-progress"`, create the file(s), then set `status: "done"` and save the state file before proceeding.

---

### Task 1 — `package-json`

Create `playwright/package.json`:

```json
{
  "name": "playwright",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "playwright:ui:dev": "ENV=dev npx playwright test --ui",
    "playwright:dev": "ENV=dev npx playwright test",
    "playwright:ui:sit": "ENV=sit npx playwright test --ui",
    "playwright:sit": "ENV=sit npx playwright test",
    "playwright:ui:pre": "ENV=pre npx playwright test --ui",
    "playwright:pre": "ENV=pre npx playwright test"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@types/node": "^25.9.3",
    "tsconfig-paths": "^4.2.0",
    "ajv": "^8.20.0",
    "dotenv": "^17.4.2",
    "typescript": "^6.0.3"
  }
}
```

---

### Task 2 — `tsconfig`

Create `playwright/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "ignoreDeprecations": "6.0",
    "types": ["node", "@playwright/test"],
    "strict": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@functions": ["support/functions/index.ts"],
      "@functions/*": ["support/functions/*"],
      "@seed-data/*": ["support/seed-data/*"],
      "@schema-assertions/*": ["support/endpoint-schema-assertions/*"]
    }
  },
  "include": ["**/*.ts"]
}
```

---

### Task 3 — `playwright-config`

Create `playwright/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

const env = process.env.ENV ?? 'sit';
dotenv.config({ path: path.resolve(__dirname, `.env.${env}`) });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const API_BASE_URL = requireEnv('API_BASE_URL');

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 9 : 9,

  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],

  use: {
    video: process.env.CI ? 'retain-on-failure' : 'on',
    trace: process.env.CI ? 'retain-on-failure' : 'on',
  },

  projects: [
    // -------------------
    // API setup (fetches auth token)
    // -------------------
    {
      name: 'api-setup',
      testMatch: /api\/setup\/api\.setup\.ts/,
    },

    // -------------------
    // API tests — dev / sit / pre (full suite)
    // -------------------
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['api-setup'],
      use: {
        baseURL: process.env.API_BASE_URL,
      },
    },
  ],
});
```

---

### Task 4 — `gitignore`

Create `playwright/.gitignore`:

```
# Playwright
node_modules/
test-results/
playwright-report*/
/blob-report/
playwright/.cache/
playwright/.auth/
allure-results
allure-report
.env*
.vscode
support/dynamic-test-data/*.json
support/bug-descriptions/*.txt
```

---

### Task 5 — `env-example`

Create `playwright/.env.example` with placeholder values showing every required variable:

```
# Copy this file to .env.sit and .env.dev and populate with real values.
# Never commit .env.sit or .env.dev — they are gitignored.

# Base URL for the API under test
API_BASE_URL=https://your-api-base-url.example.com

# Auth0 / OAuth2 client credentials for obtaining a bearer token
TEST_CLIENT_ID=your-client-id
TEST_CLIENT_SECRET=your-client-secret
TEST_ACCESS_TOKEN_URL=https://your-auth-domain/oauth/token
TEST_URL_AUTH=https://your-api-audience

# Jira integration (used by scripts/ for attaching test plans and raising bugs)
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

---

### Task 6 — `ci-yml`

Create `playwright/api-test.gitlab-ci.yml`:

```yaml
.playwright_test_template:
  image: 'mcr.microsoft.com/playwright:v1.60.0-noble'

  tags:
    - $GIT_RUNNER_TAG

  environment:
    name: $BUSINESS_REGION/$ENVIRONMENT
    action: verify

  allow_failure: false

  cache:
    key:
      files:
        - playwright/package-lock.json
    paths:
      - playwright/.npm/
    policy: pull-push

  artifacts:
    when: always
    paths:
      - playwright/playwright-report/
      - playwright/test-results/
    expire_in: 7 days

  script:
    - npm --prefix ./playwright ci
    - echo "Running $ENDPOINTS_FILE in $ENV"
    - cd playwright && ENV=$ENV npx playwright test "$ENDPOINTS_FILE"

  after_script:
    - |
      # Extract JIRA ticket key from commit message (e.g. "TAP-1234: fix something" -> TAP-1234)
      JIRA_TICKET=$(echo "$CI_COMMIT_MESSAGE" | grep -oE '[A-Z]+-[0-9]+' | head -1 | tr -d '[:space:]' || true)
      echo "Ticket extracted: '$JIRA_TICKET'"
      echo "Comment URL: $JIRA_BASE_URL/rest/api/3/issue/$JIRA_TICKET/comment"

      if [ -n "$JIRA_TICKET" ]; then

        # Create a tar.gz archive of the playwright artifacts named after the spec file
        ARCHIVE_NAME="${ENDPOINTS_FILE%.spec.ts}-report.tar.gz"
        tar -czf "$ARCHIVE_NAME" playwright/playwright-report/ playwright/test-results/ || true
        echo "Archive created: $(ls -lh $ARCHIVE_NAME 2>&1)"

        # Extract test summary counts from the Playwright HTML report index
        SUMMARY=$(grep -oP '\d+ (passed|failed|skipped)' playwright/playwright-report/index.html 2>/dev/null | tr '\n' ', ' | sed 's/, $//' || echo "no summary available")

        # Determine overall job status label
        if [ "$CI_JOB_STATUS" = "failed" ]; then
          STATUS_LABEL="❌ FAILED"
        else
          STATUS_LABEL="✅ PASSED"
        fi

        # Post a comment to the JIRA ticket
        curl -s -u "$JIRA_USER:$JIRA_API_TOKEN" \
          -X POST \
          -H "Content-Type: application/json" \
          "$JIRA_BASE_URL/rest/api/3/issue/$JIRA_TICKET/comment" \
          -d "{\"body\":{\"type\":\"doc\",\"version\":1,\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"${STATUS_LABEL}\",\"marks\":[{\"type\":\"strong\"}]},{\"type\":\"text\",\"text\":\" | Spec: ${ENDPOINTS_FILE}\"},{\"type\":\"hardBreak\"},{\"type\":\"text\",\"text\":\"Results: ${SUMMARY}\"},{\"type\":\"hardBreak\"},{\"type\":\"text\",\"text\":\"Pipeline: ${CI_PIPELINE_URL}\"},{\"type\":\"hardBreak\"},{\"type\":\"text\",\"text\":\"Finished: $(date -u '+%Y-%m-%d %H:%M:%S UTC')\"}]}]}}"

        # Upload the zipped artifacts as an attachment to the JIRA ticket
        curl -D- -u "$JIRA_USER:$JIRA_API_TOKEN" \
          -X POST \
          -H "X-Atlassian-Token: nocheck" \
          -F "file=@${ARCHIVE_NAME}" \
          "$JIRA_BASE_URL/rest/api/3/issue/$JIRA_TICKET/attachments"

      else
        echo "No JIRA ticket key found in branch name '$CI_COMMIT_BRANCH' - skipping JIRA integration."
      fi

  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $CI_COMMIT_TAG == null'

# TODO: Add your spec file matrix below.
# Example:
#
# api_tests_sit:
#   extends: .playwright_test_template
#   stage: deploy-sit
#   needs:
#     - job: deploy_sit
#   variables:
#     ENV: sit
#   parallel:
#     matrix:
#       - BUSINESS_REGION: us
#         ENVIRONMENT: sit
#         ENDPOINTS_FILE:
#           - 'your-endpoints-v2.spec.ts'
```

---

### Task 7 — `tests-folder`

Create the following three files:

**`playwright/tests/api/setup/api.setup.ts`** — copied verbatim from this repo's `playwright/tests/api/setup/api.setup.ts`:

```typescript
import { expect, test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface TokenResponse {
  access_token: string;
}

setup('authenticate', async ({ request }) => {
  const CLIENT_ID = process.env.TEST_CLIENT_ID!;
  const CLIENT_SECRET = process.env.TEST_CLIENT_SECRET!;
  const TOKEN_URL = process.env.TEST_ACCESS_TOKEN_URL!;
  const AUDIENCE = process.env.TEST_URL_AUTH!;

  const response = await request.post(TOKEN_URL, {
    form: {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: AUDIENCE,
    },
  });

  expect(response.status()).toBe(200);

  const body = (await response.json()) as TokenResponse;

  expect(typeof body.access_token).toBe('string');

  const authDir = path.join(process.cwd(), 'playwright/.auth');
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(
    path.join(authDir, 'api-token.json'),
    JSON.stringify({ access_token: body.access_token }),
  );
});
```

**`playwright/tests/api/example-endpoints-v2.spec.ts`** — a minimal example spec showing the import pattern:

```typescript
import { apiGet, assert401Schema } from '@functions/index';
import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';

// TODO: Replace this file with your own spec files.
// Each spec file covers one logical group of endpoints (e.g. customer-endpoints-v2.spec.ts).
// Import your seed data from @seed-data/<category> and schema assertions from @schema-assertions/<category>.

test.describe('Example endpoints-V2', () => {
  test.describe('example-get-by-id', () => {
    const URL_STUB = 'example/by-id';

    test.describe('200 - Accepted', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 200').toBe(200);
      });

      test('Valid request with all required parameters', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, `${URL_STUB}/example-id`);
      });
    });

    test.describe('401 - Unauthorized', () => {
      test('Request with no auth token returns 401', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const response = await apiGet(request, `${URL_STUB}/example-id`, {
          noAuth: true,
        });
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        assert401Schema(body);
      });
    });
  });
});
```

---

### Task 8 — `support-functions`

Create the following three files verbatim:

**`playwright/support/functions/index.ts`**

```typescript
export * from './request-methods';
export * from './schema_assertions';
```

**`playwright/support/functions/request-methods.ts`**

```typescript
import { APIRequestContext, APIResponse, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

type WithNoAuth<T> = T & { noAuth?: boolean };

// Attachments larger than this are truncated before being attached to the
// test report, so a single oversized payload can't bloat the HTML report
// (or, downstream, a Jira bug ticket built from it).
const MAX_ATTACHMENT_BYTES = 10 * 1024; // 10KB

function truncate(content: string): string {
  if (Buffer.byteLength(content, 'utf-8') <= MAX_ATTACHMENT_BYTES) {
    return content;
  }

  const truncated = Buffer.from(content, 'utf-8')
    .subarray(0, MAX_ATTACHMENT_BYTES)
    .toString('utf-8');

  return `${truncated}\n\n...[truncated — exceeded ${MAX_ATTACHMENT_BYTES / 1024}KB limit]`;
}

function stringifyBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body;

  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

/**
 * Attaches the outgoing request body and the actual response body to the
 * currently running Playwright test, so both are visible in the HTML report
 * (and can later be pulled into a self-heal Jira bug ticket) without needing
 * to change every call site across the spec files.
 *
 * This is best-effort: if it's called outside of a running test (e.g. from a
 * setup script) or attaching otherwise fails, it silently no-ops rather than
 * breaking the actual request/response flow.
 */
async function attachRequestAndResponse(
  method: string,
  url: string,
  requestBody: unknown,
  response: APIResponse,
): Promise<void> {
  try {
    const testInfo = test.info();

    const requestContent = stringifyBody(requestBody);
    if (requestContent !== undefined) {
      await testInfo.attach(`request-body (${method} ${url})`, {
        body: truncate(requestContent),
        contentType: 'application/json',
      });
    }

    let responseContent: string | undefined;
    try {
      responseContent = await response.text();
    } catch {
      responseContent = undefined;
    }

    if (responseContent !== undefined) {
      await testInfo.attach(
        `response-body (${response.status()} ${method} ${url})`,
        {
          body: truncate(responseContent),
          contentType: 'application/json',
        },
      );
    }
  } catch {
    // Not running inside a test, or attach() failed — never let capture
    // break the actual API call.
  }
}

let cachedToken: string | undefined;
let tokenLoaded = false;

function getAuthToken(): string | undefined {
  if (tokenLoaded) return cachedToken;

  try {
    const tokenFilePath = path.join(
      process.cwd(),
      'playwright/.auth/api-token.json',
    );
    const raw = fs.readFileSync(tokenFilePath, 'utf-8');
    cachedToken = JSON.parse(raw).access_token;
  } catch {
    cachedToken = undefined;
  }

  tokenLoaded = true;
  return cachedToken;
}

function withAuth<T extends { headers?: Record<string, string> }>(
  options?: WithNoAuth<T>,
): Omit<T, 'noAuth'> & { headers: Record<string, string> } {
  const { noAuth, ...rest } = options ?? ({} as WithNoAuth<T>);

  if (noAuth) {
    return rest as Omit<T, 'noAuth'> & { headers: Record<string, string> };
  }

  const token = getAuthToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    ...rest,
    headers: {
      ...authHeader,
      ...(rest as T).headers,
    },
  } as Omit<T, 'noAuth'> & { headers: Record<string, string> };
}

/**
 * Extracts whatever the caller passed as the request "body" from a Playwright
 * request options object, checking the most common option keys in order.
 * Only one of these is ever meaningfully set per-request in this codebase.
 */
function extractRequestBody(options?: Record<string, unknown>): unknown {
  if (!options) return undefined;
  return options.data ?? options.form ?? options.multipart ?? options.params;
}

export async function apiGet(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['get']>[1]>,
): Promise<APIResponse> {
  try {
    const response = await request.get(url, withAuth(options));
    await attachRequestAndResponse(
      'GET',
      url,
      extractRequestBody(options as Record<string, unknown>),
      response,
    );
    return response;
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `GET ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`,
    );
  }
}

export async function apiPost(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['post']>[1]>,
): Promise<APIResponse> {
  try {
    const response = await request.post(url, withAuth(options));
    await attachRequestAndResponse(
      'POST',
      url,
      extractRequestBody(options as Record<string, unknown>),
      response,
    );
    return response;
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `POST ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`,
    );
  }
}

export async function apiPatch(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['patch']>[1]>,
): Promise<APIResponse> {
  try {
    const response = await request.patch(url, withAuth(options));
    await attachRequestAndResponse(
      'PATCH',
      url,
      extractRequestBody(options as Record<string, unknown>),
      response,
    );
    return response;
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `PATCH ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`,
    );
  }
}

export async function apiPut(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['put']>[1]>,
): Promise<APIResponse> {
  try {
    const response = await request.put(url, withAuth(options));
    await attachRequestAndResponse(
      'PUT',
      url,
      extractRequestBody(options as Record<string, unknown>),
      response,
    );
    return response;
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `PUT ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`,
    );
  }
}

export async function apiDelete(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['delete']>[1]>,
): Promise<APIResponse> {
  try {
    const response = await request.delete(url, withAuth(options));
    await attachRequestAndResponse(
      'DELETE',
      url,
      extractRequestBody(options as Record<string, unknown>),
      response,
    );
    return response;
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `DELETE ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`,
    );
  }
}
```

**`playwright/support/functions/schema_assertions.ts`**

```typescript
import { expect } from '@playwright/test';

export function assert400Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  // Must have a 'details' string (both detailsOnly and standard error shapes)
  expect(typeof obj['details'], 'Expect message to be a string').toBe('string');
}

export function assert401Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  expect(typeof obj['message'], 'Expect message to be a string').toBe('string');
  expect(obj.message, 'Expect message to be Unauthorized').toBe('Unauthorized');
}

export function assert403Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  // Gateway explicit deny — either 'Message' or 'message' key
  const hasMessage =
    typeof obj['Message'] === 'string' || typeof obj['message'] === 'string';

  expect(
    hasMessage,
    '403 response must contain a Message or message string',
  ).toBe(true);
}

export function assert404Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string');
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string');
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number');
}

export function assert422Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string');
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string');
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number');
}

export function assert500Schema(data: unknown): void {
  expect(
    data !== null && typeof data === 'object',
    'Expect to be a object',
  ).toBe(true);

  const obj = data as Record<string, unknown>;

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string');
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string');
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number');
}
```

---

### Task 9 — `support-seed-data`

Create:

- `playwright/support/seed-data/.gitkeep` (empty file)
- `playwright/support/seed-data/example/index.ts` — a minimal example showing the seed data pattern:

```typescript
// TODO: Replace with your own seed data.
// Each file exports typed test data constants used by the corresponding spec file.
// Example:

export interface ExampleTestData {
  readonly region: 'US' | 'CA';
  readonly id: string;
  readonly nonExistentId: string;
}

export const EXAMPLE_DATA: readonly ExampleTestData[] = [
  {
    region: 'US',
    id: 'example-id-001',
    nonExistentId: 'example-id-999',
  },
];
```

---

### Task 10 — `gitkeep-folders`

Create the following empty placeholder files:

- `playwright/support/endpoint-schema-assertions/.gitkeep`
- `playwright/support/dynamic-test-data/.gitkeep`
- `playwright/support/bug-descriptions/.gitkeep`

---

### Task 11 — `support-fixtures` _(optional)_

Before creating this folder, ask the user:

> **Does your API return image or binary responses that you need to assert against stored fixtures?**
>
> - **Yes** — create `playwright/support/fixtures/` with a `.gitkeep` file, then mark this task `"done"`.
> - **No** — skip the folder entirely. Set this task's `status` to `"done"` in the state file and move on. Do not create the directory.

---

### Task 12 — `scripts`

Present the following message to the user, then wait for them to reply **"Okay"** before marking this task `"done"` in the state file:

> Scripts are not included in this automated setup. You'll need to contact your automation engineers to obtain the following and place them in `playwright/scripts/`:
>
> - `summarize-test-results.js`
> - `attach-test-plan-to-jira.sh`
> - `attach-workflow-state-to-jira.sh`
> - `raise-bug-to-jira.sh`
>
> Once the `.sh` files are in place, make them executable:
>
> ```
> chmod +x playwright/scripts/attach-test-plan-to-jira.sh
> chmod +x playwright/scripts/attach-workflow-state-to-jira.sh
> chmod +x playwright/scripts/raise-bug-to-jira.sh
> ```
>
> Reply **"Okay"** when you've noted this and I'll mark this task done.

---

### Task 13 — `docs`

Present the following message to the user, then wait for them to reply **"Okay"** before marking this task `"done"` in the state file:

> Workflow and documentation files are not included in this automated setup. You'll need to contact your automation engineers to obtain the following and place them in `playwright/docs/`:
>
> - `playwright/docs/workflows/` — all workflow `.md` files
> - `playwright/docs/api-test-scenarios.md`
> - `playwright/docs/playwright-api-test-generation.md`
> - `playwright/docs/workflow-diagram.md`
>
> Reply **"Okay"** when you've noted this and I'll mark this task done.

---

### Task 14 — `npm-install`

Run `npm install` from the `playwright/` directory:

```
cd playwright && npm install
```

This generates a fresh `package-lock.json`. Wait for the command to complete and confirm it exits successfully before marking this task done.

---

## Completion

Once all 14 tasks are `"done"`:

1. Update `.ai/playwright-setup-state.json`: set `stage: "done"`, `task: "Setup complete"`.
2. Present a summary to the user listing all created files/folders.
3. Tell the user:

> ✅ **Playwright setup complete!**
>
> Next steps:
>
> 1. Copy your credentials into `playwright/.env.sit` and/or `playwright/.env.dev` (use `playwright/.env.example` as a template — never commit these files).
> 2. Replace `playwright/tests/api/example-endpoints-v2.spec.ts` with your own spec files.
> 3. Add your spec file names to the matrix in `playwright/api-test.gitlab-ci.yml`.
> 4. Add your seed data under `playwright/support/seed-data/<category>/`.
> 5. Add your schema assertion helpers under `playwright/support/endpoint-schema-assertions/<category>/`.

---

## Requirements

- Always update `.ai/playwright-setup-state.json` after each task completes — never batch-write state at the end.
- Never skip a task without telling the user why.
- If a file already exists at the target path, warn the user and ask whether to overwrite before writing.
- Do not ask for any information beyond what is needed — all content is derived from this repo's existing files.
