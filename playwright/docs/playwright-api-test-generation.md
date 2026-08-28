# Playwright API Test Generation Guide

This guide explains how to write Playwright API tests for CESAPI V2 endpoints. Follow it whenever you are adding test coverage for a new or existing endpoint so that all endpoints are covered consistently.

---

## 1. Introduction

### What This Guide Covers

This guide covers the full workflow for writing Playwright API tests: file structure, authentication, test organisation, seed data, assertions, variable handling, multi-region support, and best practices — finishing with a complete worked example and a quick reference section.

### Where Tests Live

```
tests/
└── <domain>-endpoints-v2.spec.ts   ← one file per domain (purchase, quote, customer…)

support/
├── seed-data/
│   └── <domain>/
│       ├── index.ts                ← re-exports all seed data for the domain
│       └── <operation-id>.ts       ← data + body builder functions for one endpoint
├── endpoint-schema-assertions/
│   └── <domain>/
│       ├── index.ts
│       └── <operation-id>.ts       ← AJV schema + assertion function for one endpoint
└── functions/
    ├── index.ts
    ├── request-methods.ts          ← apiGet, apiPost, apiPatch, apiPut, apiDelete (auth handled automatically)
    └── schema_assertions.ts        ← assert400Schema, assert401Schema, assert403Schema, assert404Schema
```

### Prerequisites

- Node.js installed
- `npm install` run at repo root
- `.env.<ENV>` file present at the `playwright/` root (e.g. `.env.sit`) with `API_BASE_URL`, `TEST_CLIENT_ID`, `TEST_CLIENT_SECRET`, `TEST_ACCESS_TOKEN_URL`, `TEST_URL_AUTH`. The `ENV` environment variable selects which file is loaded (defaults to `sit`) — see [Section 3](#3-authentication) and [Section 7](#7-variables-strategy).
- Run tests with `npx playwright test`

---

## 2. File Structure

### One Spec File Per Domain

Each API domain (purchase, quote, customer, etc.) has a single spec file:

```
tests/purchase-endpoints-v2.spec.ts
tests/quote-endpoints-v2.spec.ts
tests/customer-endpoints-v2.spec.ts
```

All endpoints for that domain live inside the same file, each wrapped in its own `test.describe` block named with the `operationId` from the OpenAPI spec.

### Top-Level describe Structure

```typescript
test.describe('Purchase endpoints-V2', () => {
  test.describe('get-purchase-by-id', () => {
    // all tests for GET /purchase/{country}/{locationID}
  })

  test.describe('insert-warehouse-purchase-order', () => {
    // all tests for POST /purchase/warehouse-purchase-order/{country}/{locationID}
  })
})
```

The outer `test.describe` name is `'<Domain> endpoints-V2'`.
The inner `test.describe` name is the `operationId` from the OpenAPI spec.

### Status Code describe Structure

Within each `operationId` describe, nest by HTTP status code:

```typescript
test.describe('insert-warehouse-purchase-order', () => {

  test.describe('204 - Accepted', () => { ... });

  test.describe('400 - Bad Request', () => {

    test.describe('Missing Mandatory Data', () => { ... });
    test.describe('Invalid Data Types', () => { ... });

  });

  test.describe('401 - Unauthorized', () => { ... });
  test.describe('403 - Forbidden', () => {

    test.describe('Missing Mandatory Data', () => { ... });
    test.describe('Invalid Data Types', () => { ... });

  });

  test.describe('404 - Not Found', () => { ... });

});
```

### Support File Naming

Support files are named after the `operationId`:

```
support/seed-data/purchase/insert-warehouse-purchase-order.ts
support/endpoint-schema-assertions/purchase/get-purchase-by-id.ts
```

Each domain folder has an `index.ts` that re-exports everything:

```typescript
// support/seed-data/purchase/index.ts
export * from './get-purchase-by-id'
export * from './insert-warehouse-purchase-order'
```

### Import Aliases

Use path aliases (configured in `tsconfig.json`) to keep imports clean:

```typescript
import {apiGet, apiPost, assert400Schema} from '@functions/index'
import {INSERT_WAREHOUSE_PURCHASE_ORDER, maximumInsertWarehousePurchaseOrderBody} from '@seed-data/purchase'
import {assertGetPurchaseByIdSchema} from '@schema-assertions/purchase'
```

---

## 3. Authentication

### How Authentication Works

Authentication is handled automatically by a dedicated **setup project** rather than by any code in the spec files themselves.

`playwright.config.ts` defines two projects, with the `api` project depending on `api-setup`:

```typescript
projects: [
  // API setup (fetches auth token)
  {
    name: 'api-setup',
    testMatch: /api\/setup\/api\.setup\.ts/
  },

  // API tests (no browser)
  {
    name: 'api',
    testMatch: /api\/.*\.spec\.ts/,
    dependencies: ['api-setup'],
    use: {
      baseURL: process.env.API_BASE_URL
    }
  }
]
```

Before any test in the `api` project runs, Playwright first runs `tests/api/setup/api.setup.ts`, which fetches a client-credentials Bearer token and writes it to disk:

```typescript
// tests/api/setup/api.setup.ts
setup('authenticate', async ({request}) => {
  const CLIENT_ID = process.env.TEST_CLIENT_ID!
  const CLIENT_SECRET = process.env.TEST_CLIENT_SECRET!
  const TOKEN_URL = process.env.TEST_ACCESS_TOKEN_URL!
  const AUDIENCE = process.env.TEST_URL_AUTH!

  const response = await request.post(TOKEN_URL, {
    form: {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: AUDIENCE
    }
  })

  const body = await response.json()

  fs.writeFileSync(
    path.join(process.cwd(), 'playwright/.auth/api-token.json'),
    JSON.stringify({access_token: body.access_token})
  )
})
```

### The withAuth Helper

The token is never read or attached manually inside spec files. Instead, `support/functions/request-methods.ts` exports the `apiGet`, `apiPost`, `apiPatch`, `apiPut`, and `apiDelete` wrapper functions. Each wrapper calls an internal `withAuth()` helper before making the request:

```typescript
// support/functions/request-methods.ts
function withAuth(options) {
  const {noAuth, ...rest} = options ?? {}

  if (noAuth) {
    return rest // Authorization header intentionally omitted
  }

  const token = getAuthToken() // reads playwright/.auth/api-token.json (cached)

  return {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...rest.headers
    }
  }
}

export async function apiPost(request, url, options) {
  return await request.post(url, withAuth(options))
}
// apiGet, apiPatch, apiPut, apiDelete follow the same pattern
```

This means **every** `apiGet`/`apiPost`/`apiPatch`/`apiPut`/`apiDelete` call is authenticated automatically — you never need to build or pass an `Authorization` header yourself.

### Using the Token in Tests

Because authentication is injected automatically, authenticated requests need no auth-related code at all:

```typescript
response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
  data: requestBody
})
```

### 401 - Unauthorized Tests

To test the missing auth scenario, pass `noAuth: true` in the options object. This tells `withAuth()` to skip attaching the `Authorization` header entirely:

```typescript
test('Missing auth header', async ({request}: {request: APIRequestContext}) => {
  response = await apiGet(request, `${URL_STUB}/${country}/${locationID}?purchaseID=${purchaseID}`, {noAuth: true})
})
```

### Required Environment Variables

| Variable                | Description                    | Used by                                                      |
| ----------------------- | ------------------------------ | ------------------------------------------------------------ |
| `API_BASE_URL`          | Base URL of the API under test | `playwright.config.ts` (`use.baseURL` for the `api` project) |
| `TEST_CLIENT_ID`        | OAuth2 client ID               | `tests/api/setup/api.setup.ts`                               |
| `TEST_CLIENT_SECRET`    | OAuth2 client secret           | `tests/api/setup/api.setup.ts`                               |
| `TEST_ACCESS_TOKEN_URL` | Token endpoint URL             | `tests/api/setup/api.setup.ts`                               |
| `TEST_URL_AUTH`         | OAuth2 audience                | `tests/api/setup/api.setup.ts`                               |

These must be set in a `.env.<ENV>` file at the `playwright/` root (e.g. `.env.sit`, `.env.prod`), loaded via `dotenv` in `playwright.config.ts` based on the `ENV` environment variable (defaults to `sit`). See [Section 7](#7-variables-strategy) for more detail on how these variables flow into tests.

---

## 4. Test Organisation

### The afterEach Pattern

**This is the most important structural pattern.** Every status-code `describe` block should have a `test.afterEach` that:

1. Asserts the HTTP status code
2. Validates the response body schema

```typescript
test.describe('204 - Accepted', () => {
  let response: APIResponse

  test.afterEach(async () => {
    expect(response.status(), 'Request should return 204').toBe(204)
  })

  test('Valid request with all fields', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
      data: requestBody
    })
  })
})
```

The `response` variable is declared at the `describe` scope so `afterEach` can access it.

### Status Code Grouping

#### 2xx Success

```typescript
test.describe('204 - Accepted', () => {
  let response: APIResponse;
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 204').toBe(204);
  });

  test('Valid request with all fields', async ({ request }: { request: APIRequestContext }) => { ... });
  test('Valid request with only required fields', async ({ request }: { request: APIRequestContext }) => { ... });
});
```

For endpoints that return a body (e.g. 200), also assert the schema in `afterEach`:

```typescript
test.describe('200 - Accepted', () => {
  let response: APIResponse
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 200').toBe(200)
    const body = await response.json()
    assertGetPurchaseByIdSchema(body)
  })
  // ...
})
```

#### 400 - Bad Request

Always split into two sub-describes:

```typescript
test.describe('400 - Bad Request', () => {
  let response: APIResponse
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 400').toBe(400)
    const body = await response.json()
    assert400Schema(body)
  })

  test.describe('Missing Mandatory Data', () => {
    test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
      delete requestBody.stockIQOrderNumber
      response = await apiPost(/* ... */)
      const body = await response.json()
      expect(body.details, 'Error message is correct').toBe(
        "Invalid request body: data must have required property 'stockIQOrderNumber'"
      )
    })
  })

  test.describe('Invalid Data Types', () => {
    test('stockIQOrderNumber is NULL', async ({request}: {request: APIRequestContext}) => {
      requestBody.stockIQOrderNumber = null
      response = await apiPost(/* ... */)
      const body = await response.json()
      expect(body.details, 'Error message is correct').toBe(
        'Invalid request body: data/stockIQOrderNumber must be string'
      )
    })
  })
})
```

#### 401 - Unauthorized

```typescript
test.describe('401 - Unauthorized', () => {
  let response: APIResponse
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 401').toBe(401)
    const body = await response.json()
    assert401Schema(body)
  })

  test('Missing auth header', async ({request}: {request: APIRequestContext}) => {
    response = await apiGet(request, `${URL_STUB}/${country}/${locationID}`, {noAuth: true})
  })
})
```

#### 403 - Forbidden

Always split into two sub-describes:

```typescript
test.describe('403 - Forbidden', () => {
  let response: APIResponse;
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 403').toBe(403);
    const body = await response.json();
    assert403Schema(body);
  });

  test.describe('Missing Mandatory Data', () => {
    test('Missing country path parameter', async ({ request }: { request: APIRequestContext }) => { ... });
    test('Missing locationID path parameter', async ({ request }: { request: APIRequestContext }) => { ... });
  });

  test.describe('Invalid Data Types', () => {
    test('country is NULL', async ({ request }: { request: APIRequestContext }) => { ... });
    test('country as integer', async ({ request }: { request: APIRequestContext }) => { ... });
    test('country invalid enum value', async ({ request }: { request: APIRequestContext }) => { ... });
    test('country with lowercase', async ({ request }: { request: APIRequestContext }) => { ... });
    test('country with mixed case', async ({ request }: { request: APIRequestContext }) => { ... });
  });
});
```

#### 404 - Not Found

```typescript
test.describe('404 - Not Found', () => {
  let response: APIResponse;
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 404').toBe(404);
    const body = await response.json();
    assert404Schema(body);
    expect(body.details, 'Error message indicates not found').toBe('Purchase not found');
  });

  test('purchaseID not found', async ({ request }: { request: APIRequestContext }) => { ... });
});
```

### Request-Level Assertions

Add assertions **inside the `test()` body** only when you need to validate something specific to that individual test case — for example, checking a specific error message or verifying a returned ID.

```typescript
test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
  delete requestBody.stockIQOrderNumber
  response = await apiPost(/* ... */)

  const body = await response.json()
  // Request-level: validates the specific error message for THIS test
  expect(body.details, 'Error message is correct').toBe(
    "Invalid request body: data must have required property 'stockIQOrderNumber'"
  )
})
```

The `afterEach` handles the status code and schema — the `test()` body handles the specific detail.

---

## 5. Seed Data

### Purpose

Seed data is a **typed TypeScript data array** that is imported directly into the spec file, giving:

- Full TypeScript type safety
- No runtime environment variable juggling
- Multi-region support via a simple `for...of` loop

### File Location

```
support/seed-data/<domain>/<operation-id>.ts
```

Example:

```
support/seed-data/purchase/insert-warehouse-purchase-order.ts
```

### Structure of a Seed Data File

A seed data file contains three things:

#### 1. The Interface

Define a typed interface for all data the tests need:

```typescript
export interface InsertWarehousePurchaseOrderTestData {
  readonly region: 'US' | 'CA'
  readonly country: 'US' | 'CA'
  readonly locationID: string
  readonly vendorID: number
  readonly userCode: string
  readonly stockIQOrderNumber: string
  readonly stockIQStatus: string
  readonly documentType: 0 | 3
  readonly stockcode: string
  readonly quantity: number
  readonly stockIQLineNumber: number
  readonly requiredDate: string
  // Negative test data
  readonly duplicateStockIQOrderNumber: string
  readonly nonExistentLocationID: string
  readonly nonExistentVendorID: number
  readonly nonExistentStockcode: string
}
```

Include **both positive and negative test data** in the interface. Negative data (non-existent IDs, duplicate values, etc.) belongs here, not hardcoded in the spec.

#### 2. The Data Array

Export a `readonly` array with one entry per region:

```typescript
export const INSERT_WAREHOUSE_PURCHASE_ORDER: readonly InsertWarehousePurchaseOrderTestData[] = [
  {
    region: 'US',
    country: 'US',
    locationID: '780',
    vendorID: 119,
    userCode: 'JW482',
    stockIQOrderNumber: randomStockIQOrderNumber(), // dynamic — unique per run
    stockIQStatus: 'OPEN',
    documentType: randomDocumentType(),
    stockcode: '0241-6818',
    quantity: 10,
    stockIQLineNumber: 1,
    requiredDate: '2026-12-31T00:00:00',
    duplicateStockIQOrderNumber: 'WPO-US-560266',
    nonExistentLocationID: '999999999',
    nonExistentVendorID: 999999999,
    nonExistentStockcode: '0000-0000'
  },
  {
    region: 'CA',
    country: 'CA',
    locationID: '791'
    // ...
  }
]
```

#### 3. Body Builder Functions

Export `maximum` and `minimum` body builder functions.

```typescript
// All fields (required + optional)
export function maximumInsertWarehousePurchaseOrderBody(
  testData: InsertWarehousePurchaseOrderTestData,
  overrides?: Record<string, unknown>
) {
  return {
    stockIQOrderNumber: testData.stockIQOrderNumber,
    stockIQStatus: testData.stockIQStatus,
    userCode: testData.userCode,
    vendorID: testData.vendorID,
    documentType: testData.documentType,
    lines: [
      {
        quantity: testData.quantity,
        stockIQLineNumber: testData.stockIQLineNumber,
        requiredDate: testData.requiredDate,
        stockcode: testData.stockcode
      }
    ],
    comments: [
      {
        comment: 'Test purchase order comment',
        commentType: 1,
        commentID: 1
      }
    ],
    ...overrides
  }
}

// Required fields only
export function minimumInsertWarehousePurchaseOrderBody(
  testData: InsertWarehousePurchaseOrderTestData,
  overrides?: Record<string, unknown>
) {
  return {
    stockIQOrderNumber: testData.stockIQOrderNumber,
    stockIQStatus: testData.stockIQStatus,
    userCode: testData.userCode,
    vendorID: testData.vendorID,
    documentType: testData.documentType,
    lines: [
      {
        quantity: testData.quantity,
        stockIQLineNumber: testData.stockIQLineNumber,
        requiredDate: testData.requiredDate,
        stockcode: testData.stockcode
      }
    ],
    ...overrides
  }
}
```

The `overrides` parameter allows individual tests to mutate specific fields without modifying the base body.

### Dynamic Values

Use helper functions for values that must be unique per test run:

```typescript
import {randomInt} from 'crypto'

function randomLetters(length: number) {
  return Array.from({length}, () => String.fromCharCode(65 + randomInt(26))).join('')
}

function randomStockIQOrderNumber() {
  return `${randomLetters(3)}-${randomLetters(2)}-${randomInt(100000000)}`
}
```

### Using Seed Data in the Spec

```typescript
import {
  INSERT_WAREHOUSE_PURCHASE_ORDER,
  maximumInsertWarehousePurchaseOrderBody,
  minimumInsertWarehousePurchaseOrderBody
} from '@seed-data/purchase'

test.describe('insert-warehouse-purchase-order', () => {
  for (const regionData of INSERT_WAREHOUSE_PURCHASE_ORDER) {
    const {region, country, locationID, duplicateStockIQOrderNumber} = regionData

    let requestBody: any

    test.beforeEach(() => {
      // Reset to maximum body before every test
      requestBody = maximumInsertWarehousePurchaseOrderBody(regionData)
    })

    test.describe(`${region}`, () => {
      // All tests for this region go here
    })
  }
})
```

---

## 6. Test Assertions

### Two Levels of Assertions

Every test has two levels of assertions:

| Level                       | Where                                          | What it checks                        |
| --------------------------- | ---------------------------------------------- | ------------------------------------- |
| **afterEach** (block-level) | `test.afterEach` on the status-code `describe` | Status code + response body schema    |
| **Request-level**           | Inside the `test()` body                       | Specific field values, error messages |

### Assertion Messages Are Mandatory

**Every `expect(...)` call must include a descriptive message as its second argument.** This applies to every assertion in this guide — status code checks, schema validation, and error message checks alike:

```typescript
expect(response.status(), 'Request should return 204').toBe(204)
expect(body.details, 'Error message is correct').toBe('Invalid location')
expect(valid, 'Schema Validation Passed').toBeTruthy()
```

Guidelines for writing the message:

- Phrase it as a plain-English statement of what should be true, in the form `'<Subject> should <expected state>'` or a short descriptive label, e.g. `'Request should return 400'`, `'Error message is correct'`, `'Error message indicates not found'`.
- Keep it short (one line) and specific enough to identify the failing assertion from the test report alone, without needing to open the stack trace or read the assertion's arguments.
- This applies everywhere `expect(...)` is used — inside `test.afterEach` blocks, inside `test()` bodies, and inside shared schema assertion helper functions in `support/functions/schema_assertions.ts` and `support/endpoint-schema-assertions/`.

This is a hard requirement for all new and modified assertions — do not add an `expect(...)` call without a message, even when the intent seems obvious from the matcher alone.

### afterEach Assertions

#### Status Code

Always assert the status code in `afterEach` with a descriptive message:

```typescript
test.afterEach(async () => {
  expect(response.status(), 'Request should return 204').toBe(204)
})
```

#### Schema Validation (Error Responses)

For error responses, use the shared schema assertion helpers from `support/functions/schema_assertions.ts`:

```typescript
// 400
test.afterEach(async () => {
  expect(response.status(), 'Request should return 400').toBe(400)
  const body = await response.json()
  assert400Schema(body)
})

// 401
test.afterEach(async () => {
  expect(response.status(), 'Request should return 401').toBe(401)
  const body = await response.json()
  assert401Schema(body)
})

// 403
test.afterEach(async () => {
  expect(response.status(), 'Request should return 403').toBe(403)
  const body = await response.json()
  assert403Schema(body)
})

// 404
test.afterEach(async () => {
  expect(response.status(), 'Request should return 404').toBe(404)
  const body = await response.json()
  assert404Schema(body)
})
```

#### Schema Validation (Success Responses)

For success responses that return a body, use an endpoint-specific schema assertion function from `support/endpoint-schema-assertions/`:

```typescript
test.afterEach(async () => {
  expect(response.status(), 'Request should return 200').toBe(200)
  const body = await response.json()
  assertGetPurchaseByIdSchema(body)
})
```

### Shared Schema Assertion Helpers

These live in `support/functions/schema_assertions.ts` and cover all standard error shapes:

```typescript
// 400 — checks that 'details' is a string
export function assert400Schema(data: unknown): void { ... }

// 401 — checks that 'message' is 'Unauthorized'
export function assert401Schema(data: unknown): void { ... }

// 403 — checks that 'Message' or 'message' is a string (gateway deny)
export function assert403Schema(data: unknown): void { ... }

// 404 — checks that 'details', 'error', and 'ts' are present
export function assert404Schema(data: unknown): void { ... }
```

### Endpoint-Specific Schema Assertion Files

For success responses, create a dedicated file in `support/endpoint-schema-assertions/<domain>/<operation-id>.ts`.

This file:

1. Defines the full AJV schema matching the OpenAPI response schema
2. Exports a single `assertXxxSchema(body: unknown): void` function

```typescript
// support/endpoint-schema-assertions/purchase/get-purchase-by-id.ts
import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

const purchaseSchema = {
  type: 'object',
  required: ['purchaseID'],
  properties: {
    purchaseID: {type: 'integer'},
    goodsTotal: {type: ['number', 'null']}
    // ... all fields from the OpenAPI schema
  }
}

const validatePurchaseSchema: ValidateFunction = ajv.compile(purchaseSchema)

export function assertGetPurchaseByIdSchema(body: unknown): void {
  const valid = validatePurchaseSchema(body)

  if (!valid) {
    const errorDetails =
      validatePurchaseSchema.errors
        ?.map((err) => {
          const path = err.instancePath || 'root'
          const missingProperty = 'missingProperty' in err.params ? ` '${String(err.params.missingProperty)}'` : ''
          return `[${path}] ${err.message}${missingProperty}`
        })
        .join('\n') ?? 'Unknown schema validation error'

    expect(valid, `Schema validation failed:\n${errorDetails}`).toBeTruthy()
  }

  expect(valid, 'Schema Validation Passed').toBeTruthy()
}
```

### Request-Level Error Message Assertions

**CRITICAL REQUIREMENT:** Every 400 Bad Request test **MUST** include a request-level assertion that validates the **specific error message** using `.toBe()`.

```typescript
test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
  delete requestBody.stockIQOrderNumber
  response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
    data: requestBody
  })

  const body = await response.json()
  expect(body.details, 'Error message is correct').toBe(
    "Invalid request body: data must have required property 'stockIQOrderNumber'"
  )
})
```

#### Use `.toBe()` not `.toContain()`

Always use `.toBe()` for exact matching of error messages. This is stricter than a partial-match approach and catches regressions more reliably.

```typescript
// ✅ Correct — exact match
expect(body.details, 'Error message is correct').toBe('Required query parameter locationID is empty or not set.')

// ❌ Wrong — too permissive
expect(body.details).toContain('locationID')
```

#### Common Error Message Patterns

| Scenario                        | Expected `details` value                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Missing required body field     | `"Invalid request body: data must have required property 'fieldName'"`         |
| Missing nested field            | `"Invalid request body: data/lines/0 must have required property 'quantity'"`  |
| Wrong type (null for string)    | `'Invalid request body: data/fieldName must be string'`                        |
| Empty string (minLength: 1)     | `'Invalid request body: data/fieldName must NOT have fewer than 1 characters'` |
| Missing path param (locationID) | `'Required query parameter locationID is empty or not set.'`                   |
| Non-integer path param          | `'Required query parameter locationID is empty or not set.'`                   |
| locationID below minimum        | `'Required query parameter locationID is empty or not set.'`                   |
| Non-existent locationID         | `'Invalid location'`                                                           |
| Missing request body            | `'Request body is required.'`                                                  |
| Null request body               | `'Invalid request body: data must be object'`                                  |
| Duplicate unique field          | `'stockIQOrderNumber must be unique'`                                          |
| Invalid date format             | `'requiredDate must be in format yyyy-MM-ddTHH:mm:ss'`                         |

#### 404 Error Message Assertion

For 404 tests, assert the `details` message in `afterEach` (since it is the same for all 404 tests in that block):

```typescript
test.describe('404 - Not Found', () => {
  let response: APIResponse
  test.afterEach(async () => {
    expect(response.status(), 'Request should return 404').toBe(404)
    const body = await response.json()
    assert404Schema(body)
    expect(body.details, 'Error message indicates not found').toBe('Purchase not found')
  })

  test('purchaseID not found', async ({request}: {request: APIRequestContext}) => { ... })
})
```

### What NOT to Do

```typescript
// ❌ Wrong — no error message validation
test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
  delete requestBody.stockIQOrderNumber
  response = await apiPost(/* ... */)
  // Missing: no expect(body.details).toBe(...)
})

// ❌ Wrong — too loose
expect(body.details).toContain('stockIQOrderNumber')

// ❌ Wrong — checking existence only
expect(body).toHaveProperty('details')
```

---

## 7. Variables Strategy

### Sources of Variables

Variables in a spec file come from three sources:

| Source                                                     | Example                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `.env.<ENV>` file (indirectly, via `playwright.config.ts`) | `API_BASE_URL` (auth vars are consumed only by `api.setup.ts`) |
| Seed data array (destructured)                             | `region`, `country`, `locationID`, etc.                        |
| Dynamic, same-run file (see [below](#dynamic-same-run-variables-cross-test-data-passing)) | A token/ID produced by an earlier test and read back by a later one |

### Static Variables (.env.<ENV> file, guarded by playwright.config.ts)

`API_BASE_URL`, `TEST_CLIENT_ID`, `TEST_CLIENT_SECRET`, `TEST_ACCESS_TOKEN_URL`, and `TEST_URL_AUTH` are set once per environment and never change between test runs. They live in a `.env.<ENV>` file at the `playwright/` root (e.g. `.env.sit`):

```
API_BASE_URL=https://api-us.example.com
TEST_CLIENT_ID=your-client-id
TEST_CLIENT_SECRET=your-client-secret
TEST_ACCESS_TOKEN_URL=https://auth.example.com/oauth/token
TEST_URL_AUTH=https://api.example.com
```

`playwright.config.ts` loads the correct file based on the `ENV` environment variable (defaults to `sit`) and reads `API_BASE_URL` once, to configure the `api` project's `baseURL`:

```typescript
const env = process.env.ENV ?? 'sit'
dotenv.config({path: path.resolve(__dirname, `.env.${env}`)})

export default defineConfig({
  // ...
  projects: [
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['api-setup'],
      use: {
        baseURL: process.env.API_BASE_URL
      }
    }
  ]
})
```

Because `baseURL` is configured centrally, **spec files never read `process.env.API_BASE_URL` themselves** and never declare a `BASE_URL` constant — all request URLs are relative (see [URL Construction](#url-construction) below). Similarly, the auth-related variables (`TEST_CLIENT_ID`, `TEST_CLIENT_SECRET`, `TEST_ACCESS_TOKEN_URL`, `TEST_URL_AUTH`) are only ever read inside `tests/api/setup/api.setup.ts` — spec files never touch them directly (see [Section 3](#3-authentication)).

### Dynamic Variables (Seed Data)

These come from the seed data array and are destructured at the top of the `for...of` loop:

```typescript
for (const regionData of INSERT_WAREHOUSE_PURCHASE_ORDER) {
  const {
    region,
    country,
    locationID,
    vendorID,
    duplicateStockIQOrderNumber,
    nonExistentLocationID,
    nonExistentVendorID,
    nonExistentStockcode
  } = regionData

  // These constants are now available to all tests in this loop iteration
}
```

### Request Body Variable

The `requestBody` variable is:

1. Declared at the `operationId` describe scope
2. Reset to the maximum body in `test.beforeEach`
3. Mutated inside individual tests for negative scenarios

```typescript
test.describe('insert-warehouse-purchase-order', () => {
  for (const regionData of INSERT_WAREHOUSE_PURCHASE_ORDER) {
    let requestBody: any  // ← declared at describe scope

    test.beforeEach(() => {
      requestBody = maximumInsertWarehousePurchaseOrderBody(regionData)  // ← reset before each test
    })

    test.describe(`${region}`, () => {
      test.describe('400 - Bad Request', () => {
        test.describe('Missing Mandatory Data', () => {
          test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
            delete requestBody.stockIQOrderNumber  // ← mutate for this test only
            response = await apiPost(/* ... */, { data: requestBody })
          })
        })

        test.describe('Invalid Data Types', () => {
          test('stockIQOrderNumber is NULL', async ({request}: {request: APIRequestContext}) => {
            requestBody.stockIQOrderNumber = null  // ← mutate for this test only
            response = await apiPost(/* ... */, { data: requestBody })
          })
        })
      })
    })
  }
})
```

Because `beforeEach` resets `requestBody` before every test, mutations in one test never affect another.

### Dynamic, Same-Run Variables (Cross-Test Data Passing)

Some scenarios need data produced by one test to be consumed by a *later* test in the same run — most commonly a token or ID returned from a resource-creating request (e.g. a signup/login response), which a subsequent test then needs in order to validate that resource (a follow-up `GET` on it) or to perform other operations against it.

This is a **same-run, per-execution mechanism** — distinct from the static seed-data array covered above, which is fixed, typed, and known ahead of time. The pattern:

1. The producing test writes the value(s) it generated to a shared file on disk (e.g. under a dedicated dynamic-data directory), rather than trying to share an in-memory variable across tests.
2. The consuming test reads that file back and parses out the value(s) it needs.
3. The `describe` block containing both tests must use `test.describe.configure({ mode: 'serial' })`, so the producing test is guaranteed to run — and finish writing the file — before the consuming test tries to read it. Without serial mode, Playwright's default parallel execution could run the consuming test first, or have two tests write to the same file concurrently and corrupt each other's data.

```typescript
test.describe('200 - Accepted', () => {
  // Serial: the first test writes its response to a shared dynamic-data file,
  // and the second test reads it back — running serially avoids concurrent
  // writes without needing file locking.
  test.describe.configure({ mode: 'serial' });

  test('Valid request with all fields', async ({ request }: { request: APIRequestContext }) => {
    response = await apiPost(request, URL_STUB, { data: requestBody, noAuth: true });
    const body = await response.json();

    // Write whatever the follow-up test needs (e.g. a token/ID) to a shared file
    fs.writeFileSync('support/dynamic-test-data/my-variables.json', JSON.stringify({ token: body.token }));
  });

  test('Validate via a follow-up GET request', async ({ request }: { request: APIRequestContext }) => {
    const dynamicVars = JSON.parse(fs.readFileSync('support/dynamic-test-data/my-variables.json', 'utf-8'));

    response = await apiGet(request, 'my-resource/me', {
      headers: { Authorization: `Bearer ${dynamicVars.token}` },
      noAuth: true,
    });
  });
});
```

Only reach for this when a test genuinely needs a value that can only be produced by actually running another test first (e.g. a real signup response's token). If the value could instead come from static seed data or from a setup/fixture step, prefer that instead — this pattern adds ordering coupling between tests and should stay the exception, not the default.

### URL Construction

The `api` project's `baseURL` (from `API_BASE_URL`) is configured centrally in `playwright.config.ts`, so build URLs inline using **relative** template literals. Never prefix with the base URL and never hardcode full URLs:

```typescript
const URL_STUB = 'purchase/warehouse-purchase-order'

// ✅ Correct — relative path, baseURL is applied automatically by Playwright
response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, { ... })

// ✅ Correct — invalid path param test
response = await apiPost(request, `${URL_STUB}/${country}/null`, { ... })

// ❌ Wrong — hardcoded full URL
response = await apiPost(request, 'https://api-us.example.com/purchase/warehouse-purchase-order/US/780', { ... })

// ❌ Wrong — manually prefixing the base URL (baseURL is already applied by the `api` project config)
response = await apiPost(request, `${process.env.API_BASE_URL}/${URL_STUB}/${country}/${locationID}`, { ... })
```

---

## 8. Multi-Region Support

### How It Works

Every endpoint test suite runs against **all supported regions** automatically. This is achieved by wrapping all tests in a `for...of` loop over the seed data array.

```typescript
for (const regionData of INSERT_WAREHOUSE_PURCHASE_ORDER) {
  const {region, country, locationID} = regionData

  test.describe(`${region}`, () => {
    // All tests run once per region entry in the array
  })
}
```

Adding a new region is as simple as adding a new entry to the seed data array — no changes to the spec file are needed.

### Region Describe Nesting

The region name wraps all status-code describes, so test output is clearly labelled:

```
Purchase endpoints-V2
  insert-warehouse-purchase-order
    US
      204 - Accepted
        ✓ Valid request with all fields
        ✓ Valid request with only required fields
      400 - Bad Request
        Missing Mandatory Data
          ✓ Missing stockIQOrderNumber field
        ...
    CA
      204 - Accepted
        ✓ Valid request with all fields
        ...
```

### Seed Data Array Structure

Each entry in the array is a complete, self-contained set of test data for one region:

```typescript
export const INSERT_WAREHOUSE_PURCHASE_ORDER: readonly InsertWarehousePurchaseOrderTestData[] = [
  {
    region: 'US',
    country: 'US',
    locationID: '780'
    // ... all US-specific values
  },
  {
    region: 'CA',
    country: 'CA',
    locationID: '791'
    // ... all CA-specific values
  }
]
```

### Adding a New Region

1. Add a new entry to the seed data array with the correct region values
2. Run `npx playwright test` — the new region is automatically included

No changes to the spec file are required.

---

## 9. Best Practices

### Assertion Messages Are Mandatory, Not Optional

Every `expect(...)` call must include a descriptive message, even when the intent seems obvious from the matcher alone. This keeps test reports readable at a glance — see [Assertion Messages Are Mandatory](#assertion-messages-are-mandatory) in Section 6 for the full rule and style guidance.

```typescript
// ✅ Correct — every assertion has a message
expect(response.status(), 'Request should return 204').toBe(204)
expect(body.details, 'Error message is correct').toBe('Invalid location')

// ❌ Wrong — missing message, even though the matcher seems self-explanatory
expect(response.status()).toBe(204)
```

### Always Reset requestBody in beforeEach

Every POST/PUT/PATCH endpoint describe block **must** reset `requestBody` in `test.beforeEach`. This prevents test pollution where a mutation in one test bleeds into the next.

```typescript
// ✅ Correct
let requestBody: any

test.beforeEach(() => {
  requestBody = maximumInsertWarehousePurchaseOrderBody(regionData)
})

// ❌ Wrong — no reset, mutations accumulate
let requestBody = maximumInsertWarehousePurchaseOrderBody(regionData)
```

### Use delete for Missing Field Tests

To test a missing required field, use `delete` on the property. Do not set it to `undefined` or `null` — those are different scenarios.

```typescript
// ✅ Correct — field is absent from the request body
test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
  delete requestBody.stockIQOrderNumber
  // ...
})

// ❌ Wrong — field is present but null (different test case)
test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
  requestBody.stockIQOrderNumber = undefined
  // ...
})
```

### Use Assignment for Invalid Type Tests

To test an invalid type, assign the wrong value directly:

```typescript
// ✅ Correct
test('stockIQOrderNumber is NULL', async ({request}: {request: APIRequestContext}) => {
  requestBody.stockIQOrderNumber = null
})

test('stockIQOrderNumber is integer', async ({request}: {request: APIRequestContext}) => {
  requestBody.stockIQOrderNumber = 123
})

test('stockIQOrderNumber is empty string', async ({request}: {request: APIRequestContext}) => {
  requestBody.stockIQOrderNumber = ''
})
```

### Name Tests Consistently

Follow the naming conventions from the existing spec files:

| Scenario               | Test Name                                                    |
| ---------------------- | ------------------------------------------------------------ |
| All fields present     | `'Valid request with all fields'`                            |
| Required fields only   | `'Valid request with only required fields'`                  |
| Missing required field | `'Missing <fieldName> field'`                                |
| Field is null          | `'<fieldName> is NULL'`                                      |
| Field is wrong type    | `'<fieldName> is integer'` / `'<fieldName> is empty string'` |
| Field below minimum    | `'<fieldName> below minimum value'`                          |
| Duplicate value        | `'<fieldName> is a duplicate'`                               |
| Non-existent resource  | `'Valid country with non-existent locationID'`               |
| Missing path param     | `'Missing country path parameter'`                           |
| Invalid enum           | `'country invalid enum value'`                               |
| Wrong case             | `'country with lowercase'` / `'country with mixed case'`     |
| No auth                | `'Missing auth header'`                                      |
| Resource not found     | `'<resource> not found'`                                     |

### Declare response at the describe Scope

The `response` variable must be declared at the status-code `describe` scope so `afterEach` can access it:

```typescript
// ✅ Correct
test.describe('400 - Bad Request', () => {
  let response: APIResponse  // ← declared here

  test.afterEach(async () => {
    expect(response.status(), 'Request should return 400').toBe(400)  // ← accessible here
  })

  test('...', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(...)  // ← assigned here
  })
})

// ❌ Wrong — response declared inside test, afterEach can't see it
test('...', async ({request}: {request: APIRequestContext}) => {
  const response = await apiPost(...)
})
```

### Use URL_STUB for Path Segments

Define `URL_STUB` as a constant at the `operationId` describe scope. This avoids repeating the path in every test:

```typescript
test.describe('insert-warehouse-purchase-order', () => {
  const URL_STUB = 'purchase/warehouse-purchase-order'  // ← defined once

  // Used in every test:
  response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, ...)
})
```

### Cover All Required Fields in Missing Mandatory Data

Every field marked `required` in the OpenAPI schema must have a corresponding "Missing X field" test. Check the schema carefully — including nested objects like `lines[0]` and `comments[0]`.

```typescript
// For WarehousePurchaseOrderObject, required fields are:
// stockIQOrderNumber, stockIQStatus, userCode, lines, vendorID, documentType
// For WarehousePurchaseLineObject, required fields are:
// quantity, stockIQLineNumber, requiredDate, stockcode

test('Missing lines[0].quantity field', ...)
test('Missing lines[0].stockIQLineNumber field', ...)
test('Missing lines[0].requiredDate field', ...)
test('Missing lines[0].stockcode field', ...)
```

### Cover All Path Parameters in 403 Tests

Every endpoint with path parameters must have 403 tests for:

- Missing country
- Missing locationID
- country is NULL
- country as integer
- country invalid enum value
- country with lowercase
- country with mixed case

These are standard across all endpoints and should never be omitted.

### Do Not Hardcode Test Data in the Spec

All test data (IDs, codes, values) must come from the seed data interface. Never hardcode values directly in the spec:

```typescript
// ✅ Correct — from seed data
requestBody.stockIQOrderNumber = duplicateStockIQOrderNumber

// ❌ Wrong — hardcoded
requestBody.stockIQOrderNumber = 'WPO-US-560266'
```

---

## 10. Complete Example

This is a full worked example for `POST /purchase/warehouse-purchase-order/{country}/{locationID}`, showing every file that needs to be created or updated.

### 1. Seed Data File

`support/seed-data/purchase/insert-warehouse-purchase-order.ts`

```typescript
import {randomInt} from 'crypto'

function randomLetters(length: number) {
  return Array.from({length}, () => String.fromCharCode(65 + randomInt(26))).join('')
}

function randomStockIQOrderNumber() {
  return `${randomLetters(3)}-${randomLetters(2)}-${randomInt(100000000)}`
}

const documentTypes = [0, 3] as const

function randomDocumentType(): 0 | 3 {
  return documentTypes[randomInt(documentTypes.length)]
}

export interface InsertWarehousePurchaseOrderTestData {
  readonly region: 'US' | 'CA'
  readonly country: 'US' | 'CA'
  readonly locationID: string
  readonly vendorID: number
  readonly userCode: string
  readonly stockIQOrderNumber: string
  readonly stockIQStatus: string
  readonly documentType: 0 | 3
  readonly stockcode: string
  readonly quantity: number
  readonly stockIQLineNumber: number
  readonly requiredDate: string
  readonly duplicateStockIQOrderNumber: string
  readonly nonExistentLocationID: string
  readonly nonExistentVendorID: number
  readonly nonExistentStockcode: string
}

export const INSERT_WAREHOUSE_PURCHASE_ORDER: readonly InsertWarehousePurchaseOrderTestData[] = [
  {
    region: 'US',
    country: 'US',
    locationID: '780',
    vendorID: 119,
    userCode: 'JW482',
    stockIQOrderNumber: randomStockIQOrderNumber(),
    stockIQStatus: 'OPEN',
    documentType: randomDocumentType(),
    stockcode: '0241-6818',
    quantity: 10,
    stockIQLineNumber: 1,
    requiredDate: '2026-12-31T00:00:00',
    duplicateStockIQOrderNumber: 'WPO-US-560266',
    nonExistentLocationID: '999999999',
    nonExistentVendorID: 999999999,
    nonExistentStockcode: '0000-0000'
  },
  {
    region: 'CA',
    country: 'CA',
    locationID: '791',
    vendorID: 200,
    userCode: 'AL028',
    stockIQOrderNumber: randomStockIQOrderNumber(),
    stockIQStatus: 'OPEN',
    documentType: randomDocumentType(),
    stockcode: 'CA-STOCK-001',
    quantity: 5,
    stockIQLineNumber: 1,
    requiredDate: '2026-12-31T00:00:00',
    duplicateStockIQOrderNumber: 'WPO-CA-560266',
    nonExistentLocationID: '999999999',
    nonExistentVendorID: 999999999,
    nonExistentStockcode: '0000-0000'
  }
]

export function maximumInsertWarehousePurchaseOrderBody(
  testData: InsertWarehousePurchaseOrderTestData,
  overrides?: Record<string, unknown>
) {
  return {
    stockIQOrderNumber: testData.stockIQOrderNumber,
    stockIQStatus: testData.stockIQStatus,
    userCode: testData.userCode,
    vendorID: testData.vendorID,
    documentType: testData.documentType,
    lines: [
      {
        quantity: testData.quantity,
        stockIQLineNumber: testData.stockIQLineNumber,
        requiredDate: testData.requiredDate,
        stockcode: testData.stockcode
      }
    ],
    comments: [
      {
        comment: 'Test purchase order comment',
        commentType: 1,
        commentID: 1
      }
    ],
    ...overrides
  }
}

export function minimumInsertWarehousePurchaseOrderBody(
  testData: InsertWarehousePurchaseOrderTestData,
  overrides?: Record<string, unknown>
) {
  return {
    stockIQOrderNumber: testData.stockIQOrderNumber,
    stockIQStatus: testData.stockIQStatus,
    userCode: testData.userCode,
    vendorID: testData.vendorID,
    documentType: testData.documentType,
    lines: [
      {
        quantity: testData.quantity,
        stockIQLineNumber: testData.stockIQLineNumber,
        requiredDate: testData.requiredDate,
        stockcode: testData.stockcode
      }
    ],
    ...overrides
  }
}
```

### 2. Spec File (excerpt)

`tests/purchase-endpoints-v2.spec.ts`

```typescript
import {test, expect, APIResponse, APIRequestContext} from '@playwright/test'
import {apiPost, assert400Schema, assert401Schema, assert403Schema} from '@functions/index'
import {
  INSERT_WAREHOUSE_PURCHASE_ORDER,
  maximumInsertWarehousePurchaseOrderBody,
  minimumInsertWarehousePurchaseOrderBody
} from '@seed-data/purchase'

test.describe('Purchase endpoints-V2', () => {
  test.describe('insert-warehouse-purchase-order', () => {
    for (const regionData of INSERT_WAREHOUSE_PURCHASE_ORDER) {
      const {
        region,
        country,
        locationID,
        duplicateStockIQOrderNumber,
        nonExistentLocationID,
        nonExistentVendorID,
        nonExistentStockcode
      } = regionData

      const URL_STUB = 'purchase/warehouse-purchase-order'
      let requestBody: any

      test.beforeEach(() => {
        requestBody = maximumInsertWarehousePurchaseOrderBody(regionData)
      })

      test.describe(`${region}`, () => {
        // ─── 204 ────────────────────────────────────────────────────────────
        test.describe('204 - Accepted', () => {
          let response: APIResponse
          test.afterEach(async () => {
            expect(response.status(), 'Request should return 204').toBe(204)
          })

          test('Valid request with all fields', async ({request}: {request: APIRequestContext}) => {
            response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
              data: requestBody
            })
          })

          test('Valid request with only required fields', async ({request}: {request: APIRequestContext}) => {
            requestBody = minimumInsertWarehousePurchaseOrderBody(regionData)
            response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
              data: requestBody
            })
          })
        })

        // ─── 400 ────────────────────────────────────────────────────────────
        test.describe('400 - Bad Request', () => {
          let response: APIResponse
          test.afterEach(async () => {
            expect(response.status(), 'Request should return 400').toBe(400)
            const body = await response.json()
            assert400Schema(body)
          })

          test.describe('Missing Mandatory Data', () => {
            test('Missing request body', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`)
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe('Request body is required.')
            })

            test('Missing stockIQOrderNumber field', async ({request}: {request: APIRequestContext}) => {
              delete requestBody.stockIQOrderNumber
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe(
                "Invalid request body: data must have required property 'stockIQOrderNumber'"
              )
            })

            test('Missing lines[0].requiredDate field', async ({request}: {request: APIRequestContext}) => {
              delete requestBody.lines[0].requiredDate
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe(
                "Invalid request body: data/lines/0 must have required property 'requiredDate'"
              )
            })
          })

          test.describe('Invalid Data Types', () => {
            test('locationID is NULL', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/${country}/null`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe(
                'Required query parameter locationID is empty or not set.'
              )
            })

            test('stockIQOrderNumber is NULL', async ({request}: {request: APIRequestContext}) => {
              requestBody.stockIQOrderNumber = null
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe(
                'Invalid request body: data/stockIQOrderNumber must be string'
              )
            })

            test('stockIQOrderNumber is a duplicate', async ({request}: {request: APIRequestContext}) => {
              requestBody.stockIQOrderNumber = duplicateStockIQOrderNumber
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe('stockIQOrderNumber must be unique')
            })

            test('requiredDate is invalid format', async ({request}: {request: APIRequestContext}) => {
              requestBody.lines[0].requiredDate = '31-12-2026'
              response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
                data: requestBody
              })
              const body = await response.json()
              expect(body.details, 'Error message is correct').toBe(
                'requiredDate must be in format yyyy-MM-ddTHH:mm:ss'
              )
            })
          })
        })

        // ─── 401 ────────────────────────────────────────────────────────────
        test.describe('401 - Unauthorized', () => {
          let response: APIResponse
          test.afterEach(async () => {
            expect(response.status(), 'Request should return 401').toBe(401)
            const body = await response.json()
            assert401Schema(body)
          })

          test('Missing auth header', async ({request}: {request: APIRequestContext}) => {
            response = await apiPost(request, `${URL_STUB}/${country}/${locationID}`, {
              data: requestBody,
              noAuth: true
            })
          })
        })

        // ─── 403 ────────────────────────────────────────────────────────────
        test.describe('403 - Forbidden', () => {
          let response: APIResponse
          test.afterEach(async () => {
            expect(response.status(), 'Request should return 403').toBe(403)
            const body = await response.json()
            assert403Schema(body)
          })

          test.describe('Missing Mandatory Data', () => {
            test('Missing country path parameter', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}//${locationID}`, {
                data: requestBody
              })
            })

            test('Missing locationID path parameter', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/${country}/`, {
                data: requestBody
              })
            })
          })

          test.describe('Invalid Data Types', () => {
            test('country is NULL', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/null/${locationID}`, {
                data: requestBody
              })
            })

            test('country as integer', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/123/${locationID}`, {
                data: requestBody
              })
            })

            test('country invalid enum value', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/TEST/${locationID}`, {
                data: requestBody
              })
            })

            test('country with lowercase', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/${country.toLowerCase()}/${locationID}`, {
                data: requestBody
              })
            })

            test('country with mixed case', async ({request}: {request: APIRequestContext}) => {
              response = await apiPost(request, `${URL_STUB}/Us/${locationID}`, {
                data: requestBody
              })
            })
          })
        })
      })
    }
  })
})
```

---

## 11. Quick Reference

### Files to Create for Each New Endpoint

| File                            | Path                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| Seed data                       | `support/seed-data/<domain>/<operation-id>.ts`                  |
| Schema assertions (if 2xx body) | `support/endpoint-schema-assertions/<domain>/<operation-id>.ts` |
| Spec file (add describe block)  | `tests/<domain>-endpoints-v2.spec.ts`                           |

### Spec File Skeleton (POST endpoint)

```typescript
test.describe('<operation-id>', () => {
  for (const regionData of SEED_DATA_ARRAY) {
    const { region, country, locationID, /* ...negatives */ } = regionData
    const URL_STUB = '<path/stub>'
    let requestBody: any

    test.beforeEach(() => {
      requestBody = maximumBodyBuilder(regionData)
    })

    test.describe(`${region}`, () => {

      test.describe('204 - Accepted', () => {
        let response: APIResponse
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 204').toBe(204)
        })
        test('Valid request with all fields', async ({ request }: { request: APIRequestContext }) => { ... })
        test('Valid request with only required fields', async ({ request }: { request: APIRequestContext }) => { ... })
      })

      test.describe('400 - Bad Request', () => {
        let response: APIResponse
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 400').toBe(400)
          const body = await response.json()
          assert400Schema(body)
        })
        test.describe('Missing Mandatory Data', () => { ... })
        test.describe('Invalid Data Types', () => { ... })
      })

      test.describe('401 - Unauthorized', () => {
        let response: APIResponse
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 401').toBe(401)
          const body = await response.json()
          assert401Schema(body)
        })
        test('Missing auth header', async ({ request }: { request: APIRequestContext }) => { ... })
      })

      test.describe('403 - Forbidden', () => {
        let response: APIResponse
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 403').toBe(403)
          const body = await response.json()
          assert403Schema(body)
        })
        test.describe('Missing Mandatory Data', () => { ... })
        test.describe('Invalid Data Types', () => { ... })
      })

      test.describe('404 - Not Found', () => {
        let response: APIResponse
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 404').toBe(404)
          const body = await response.json()
          assert404Schema(body)
          expect(body.details, 'Error message indicates not found').toBe('<Resource> not found')
        })
        test('<resource> not found', async ({ request }: { request: APIRequestContext }) => { ... })
      })

    })
  }
})
```

### Standard 403 Tests (copy for every endpoint)

```typescript
test.describe('Missing Mandatory Data', () => {
  test('Missing country path parameter', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}//${locationID}`, { ... })
  })
  test('Missing locationID path parameter', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/${country}/`, { ... })
  })
})

test.describe('Invalid Data Types', () => {
  test('country is NULL', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/null/${locationID}`, { ... })
  })
  test('country as integer', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/123/${locationID}`, { ... })
  })
  test('country invalid enum value', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/TEST/${locationID}`, { ... })
  })
  test('country with lowercase', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/${country.toLowerCase()}/${locationID}`, { ... })
  })
  test('country with mixed case', async ({request}: {request: APIRequestContext}) => {
    response = await apiPost(request, `${URL_STUB}/Us/${locationID}`, { ... })
  })
})
```

### Common Error Messages

| Scenario                         | `body.details`                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Missing required field           | `"Invalid request body: data must have required property 'fieldName'"`         |
| Missing nested field             | `"Invalid request body: data/lines/0 must have required property 'fieldName'"` |
| Field is null (string expected)  | `'Invalid request body: data/fieldName must be string'`                        |
| Field is null (integer expected) | `'Invalid request body: data/fieldName must be integer'`                       |
| Empty string (minLength: 1)      | `'Invalid request body: data/fieldName must NOT have fewer than 1 characters'` |
| Missing path param               | `'Required query parameter locationID is empty or not set.'`                   |
| Non-integer path param           | `'Required query parameter locationID is empty or not set.'`                   |
| locationID = 0 (below minimum)   | `'Required query parameter locationID is empty or not set.'`                   |
| Non-existent locationID          | `'Invalid location'`                                                           |
| Missing request body             | `'Request body is required.'`                                                  |
| Null request body                | `'Invalid request body: data must be object'`                                  |
| Duplicate unique field           | `'stockIQOrderNumber must be unique'`                                          |
| Invalid date format              | `'requiredDate must be in format yyyy-MM-ddTHH:mm:ss'`                         |

### Assertion Cheat Sheet

```typescript
// Status code
expect(response.status(), 'Request should return 204').toBe(204)

// Error message — always use .toBe(), never .toContain()
expect(body.details, 'Error message is correct').toBe('exact error message here')

// Schema validation (error responses)
assert400Schema(body)
assert401Schema(body)
assert403Schema(body)
assert404Schema(body)

// Schema validation (success response with body)
assertMyEndpointSchema(body)
```

### Mutation Patterns

```typescript
// Missing field
delete requestBody.fieldName
delete requestBody.lines[0].fieldName

// Wrong type
requestBody.fieldName = null
requestBody.fieldName = 123
requestBody.fieldName = ''
requestBody.fieldName = true

// Invalid value
requestBody.fieldName = duplicateValue // from seed data
requestBody.lines[0].requiredDate = '31-12-2026' // wrong date format
// Invalid path param (inline in URL — relative to baseURL)
`${URL_STUB}/${country}/null` // locationID = null
`${URL_STUB}/${country}/abc` // locationID = string
`${URL_STUB}/${country}/0` // locationID below minimum
`${URL_STUB}/${country}/999999999` // non-existent locationID

// No authentication
{
  noAuth: true
} // pass as part of the options object on apiGet/apiPost/apiPatch/apiPut/apiDelete
```

### Imports

```typescript
import {test, expect, APIResponse, APIRequestContext} from '@playwright/test'
import {apiGet, apiPost, assert400Schema, assert401Schema, assert403Schema, assert404Schema} from '@functions/index'
import {SEED_DATA_ARRAY, maximumBodyBuilder, minimumBodyBuilder} from '@seed-data/<domain>'
import {assertMyEndpointSchema} from '@endpoint-schema-assertions/<domain>/<operation-id>'
```

---

## Notes

- All patterns in this guide are derived from the live spec files in `tests/` and `support/`.
- When in doubt, refer to `tests/purchase-endpoints-v2.spec.ts` as the canonical reference.
