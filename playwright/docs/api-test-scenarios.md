# API Test Scenario Generation Prompt

## Output Format

Generate a scenario table with the following columns in this exact order:

| Scenario | Scenario Type (Accepted / Negative – subcategory) | Use Case | Description | HTTP Return Status Code |
| -------- | ------------------------------------------------- | -------- | ----------- | ----------------------- |

---

## Coverage Rules

### Negative Scenarios

These must be generated for all fields recursively, following this strict order:

**Arrays → Objects → Fields → Nested Objects → Nested Fields**

Each test type (Missing Mandatory Data, Invalid Data Types, Cross-Field Validation, No Authentication, Not Found, Unprocessable Entity) gets its own full recursive pass. After finishing one test type, restart the recursive structure from the top of the schema for the next test type.

---

## Test Categories

### 1. Missing Mandatory Data

Test the following scenarios:

- Test required arrays missing entirely
- Test required objects missing entirely
- Test required elements in arrays missing individually
- Test required fields missing individually
- Test required objects or array elements set to NULL

### 2. Invalid Data Types

For every field, based on type from schema:

#### Integer

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test alpha string i.e `"two"`
- Test numeric string i.e `1`

#### Double

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test alpha string i.e `"two"`
- Test numeric string i.e `1.1`
- Test invalid multi-decimal i.e `10.1.1`

#### String

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test numeric string i.e CustomerId is `"123456"` set as integer `123456` or `"12345A"`
- Test invalid format (regex or documented format) i.e if field is "email" set `email.co.uk`
- Test length exceeding i.e requires 8 but sent as 7 or 9

#### Boolean

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test integer i.e `1`
- Test alpha string i.e `"true"`

#### Enum Fields

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test invalid value i.e `"TEST"`

#### Date Fields

- Test NULL i.e `null`
- Test empty string i.e `""`
- Test invalid format i.e. required `dd-mm-yyyy` but sent as `yyyy-mm-dd`
- Test invalid date range i.e To date before Start, vice versa
- Dates in the future when past dates are required (or vice versa)

#### Arrays

- Test NULL i.e `null`
- Test empty array i.e `[]`

#### Objects

- Test NULL i.e `null`
- Test empty object i.e `{}`

### 3. No Authentication

- Send a valid request with no authentication → 401

### 4. Cross-Field Validation (Business Logic)

After completing all standard negative scenarios, generate cross-field validation tests for:

#### 1. Path Parameter Mismatches

- When multiple path parameters exist (e.g., country + customerID), test valid values that don't logically match (e.g., customerID from US tested with country=CA)
- Test locationID with wrong country
- Test any hierarchical relationships where parent/child IDs must align

#### 2. Conditional Field Dependencies

- When field A requires field B to have a specific value, test A with B set to incompatible values
- Test mutually exclusive fields both being present
- Test "one of" requirements where exactly one field from a set must be provided

#### 4. Ownership/Authorization

- Valid IDs that belong to different accounts/locations/customers
- Valid IDs that the authenticated user doesn't have permission to access

> **Note:** These scenarios should be added under "Negative - Cross-Field Validation" or "Negative - Invalid Data Types" depending on your API's error handling strategy. Typically use 400 for business logic validation failures, or 500 if the API returns server errors for these cases.

### 5. Not Found (404)

- Test valid format IDs that don't exist in the system (e.g., customerID, locationID, quoteID)
- Test resources that are not found at the specified location

### 6. Unprocessable Entity (422)

- Test objects that are NULL but required
- Test fields violating documented format rules

---

## General Rules

### Field Handling

- Follow the exact field names and types from the schema
- Do not invent fields or rules not documented
- Generate negative scenarios for all fields recursively, respecting field type rules above
- Generate Missing Mandatory Data and NULL value scenarios ONLY for required fields

### Request Body Construction (POST/PUT/PATCH)

**Base Request Body Strategy:**

- The base REQUEST_BODY should include **ALL fields (both required and optional)** with valid values
- This creates a comprehensive baseline for testing all API capabilities
- A minimum of two standard positive test scenarios should be created:
  1. **"Valid request with all fields"** - Uses the complete body with all optional fields populated
  2. **"Valid request with only required fields"** - Removes optional fields, keeping only mandatory ones
- Further Accepted scenarios should be added if the two above does not provide full accepted coverage.

**GET Validation Requests (data-mutating endpoints):**

- For any endpoint that **creates or amends persisted data** (POST/PUT/PATCH/DELETE), always consider and include an Accepted scenario that performs a follow-up **GET (read-back) validation request** to confirm the change actually persisted.
  - Example: **"Validate update via GET request"** — after the write, call the corresponding read endpoint (e.g. `GET /customer/by-customerid/simple/{country}/{customerID}`) and assert the key mutated fields (e.g. `name`, `shortName`) on the retrieved resource match the values sent/returned by the write.
- This read-back scenario belongs in the **Accepted** group, typically placed immediately after "Valid request with all fields".
- Where the suite chains these serially (e.g. the write persists values to a shared file/variable that the GET then reads), note the shared-variable handoff and the `serial` execution mode in the test plan.
- Do not omit this scenario when creating or amending test plans for write endpoints — read-back validation confirms the write took effect, not merely that the API returned a success status.

### Do NOT Generate

- Missing field scenarios for OPTIONAL fields
- NULL value scenarios for OPTIONAL fields
- "Object is NULL" scenarios when the object itself is OPTIONAL

### Optional Fields

Optional fields may only receive:

- Invalid type scenarios (wrong type supplied)
- Invalid format scenarios (if format rules exist)

> **Important:** If an OPTIONAL field is omitted entirely, treat it as a valid request and do not create a negative test case.

> **Note:** While the base REQUEST_BODY includes all optional fields, negative tests should not test the absence of optional fields (as this is valid behavior). Optional fields are included in the base body to enable comprehensive positive testing.

### Boundary Testing

- Create separate scenarios for boundary value analysis tests, above and below required length

### Error Code Mapping

Apply error codes exactly as follows:

| Test Type                       | HTTP Status Code |
| ------------------------------- | ---------------- |
| Missing mandatory data (body)   | 400              |
| Invalid Data Types (body/query) | 400              |
| No Auth                         | 401              |
| Missing mandatory data (path)   | 403              |
| Invalid Data Types (path/enum)  | 403              |
| Not Found                       | 404              |
| Unprocessable Entity            | 422              |

### Output Requirements

- Keep scenario numbering continuous
- Output all negative scenarios in arrays → objects → fields → nested objects → nested fields order

---

## Output Order

Generate scenarios in this exact order:

1. **Accepted** (including any **GET validation / read-back** scenario for data-mutating endpoints — place it immediately after "Valid request with all fields")
2. **Negative – Missing Mandatory Data**
3. **Negative – Invalid Data Types**
4. **Negative – No Authentication**
5. **Negative – Not Found**
6. **Negative – Unprocessable Entity**
7. **Negative – Cross-Field Validation (Business Logic)**

---

## Notes

- Ensure the table is fully deterministic: anyone following this prompt with the same schema should generate the same scenario list, only field names change per endpoint

---

## Example Scenario Table

| Scenario | Scenario Type                     | Use Case                                  | Description                                                                        | HTTP Return Status Code |
| -------- | --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| 1        | Negative - Missing Mandatory Data | Missing [RootObject]                      | Remove the root request object                                                     | 400                     |
| 2        | Negative - Missing Mandatory Data | Missing [ArrayName] Array                 | Remove the [ArrayName] array from the request                                      | 400                     |
| 3        | Negative - Missing Mandatory Data | Missing [ObjectName] Object               | Remove the [ObjectName] object from the request                                    | 400                     |
| 4        | Negative - Missing Mandatory Data | Missing [FieldName] field                 | Remove the [FieldName] field                                                       | 400                     |
| 5        | Negative - Missing Mandatory Data | Missing [Parent.ChildField] field         | Remove nested [Parent.ChildField]                                                  | 400                     |
| 6        | Negative - Missing Mandatory Data | Missing required pair [FieldA] + [FieldB] | Remove both mutually required fields                                               | 400                     |
| 7        | Negative - Missing Mandatory Data | Missing conditional [FieldName]           | Remove [FieldName] when condition field is set                                     | 400                     |
| 8        | Negative - Invalid Data Types     | [ArrayName] Array is NULL                 | Set [ArrayName] = null                                                             | 400                     |
| 9        | Negative - Invalid Data Types     | [ArrayName] Array is Empty                | Set [ArrayName] = []                                                               | 400                     |
| 10       | Negative - Invalid Data Types     | [ObjectName] Object is NULL               | Set [ObjectName] = null                                                            | 400                     |
| 11       | Negative - Invalid Data Types     | [ObjectName] Object is Empty              | Set [ObjectName] = {}                                                              | 400                     |
| 12       | Negative - Invalid Data Types     | [ParentObject] Object is NULL             | Set [ParentObject] = null                                                          | 400                     |
| 13       | Negative - Invalid Data Types     | [StringFieldName] as a Number             | Set [StringFieldName] = 123                                                        | 400                     |
| 14       | Negative - Invalid Data Types     | [IntegerFieldName] as a String            | Set [IntegerFieldName] = "abc"                                                     | 400                     |
| 15       | Negative - Invalid Data Types     | [ObjectName] as a String                  | Set [ObjectName] = "text"                                                          | 400                     |
| 16       | Negative - Invalid Data Types     | [ArrayName] as a Object                   | Replace [ArrayName] with object                                                    | 400                     |
| 17       | Negative - Invalid Data Types     | [StringFieldName] is NULL                 | Set [StringFieldName] = null                                                       | 400                     |
| 18       | Negative - Invalid Data Types     | [StringFieldName] as a Empty String       | Set [StringFieldName] = ""                                                         | 400                     |
| 19       | Negative - Invalid Data Types     | [IntegerFieldName] is NULL                | Set [IntegerFieldName] = null                                                      | 400                     |
| 20       | Negative - Invalid Data Types     | [DecimalFieldName] is NULL                | Set [DecimalFieldName] = null                                                      | 400                     |
| 21       | Negative - Invalid Data Types     | [BooleanFieldName] is NULL                | Set [BooleanFieldName] = null                                                      | 400                     |
| 22       | Negative - Invalid Data Types     | [DateFieldName] is NULL                   | Set [DateFieldName] = null                                                         | 400                     |
| 23       | Negative - Invalid Data Types     | Invalid [EmailField] format               | Set [EmailField] = email.co.uk                                                     | 400                     |
| 24       | Negative - Invalid Data Types     | Invalid [DateFieldName] format            | Set invalid date format                                                            | 400                     |
| 25       | Negative - Invalid Data Types     | Invalid [IdFieldName] GUID format         | Set invalid GUID value                                                             | 400                     |
| 26       | Negative - Invalid Data Types     | [FieldName] fails regex                   | Break regex rule for [FieldName]                                                   | 400                     |
| 27       | Negative - Invalid Data Types     | Invalid [PhoneField] format               | Set invalid phone value                                                            | 400                     |
| 28       | Negative - Invalid Data Types     | [StringFieldName] below min length        | Value shorter than allowed                                                         | 400                     |
| 29       | Negative - Invalid Data Types     | [StringFieldName] above max length        | Value longer than allowed                                                          | 400                     |
| 30       | Negative - Invalid Data Types     | [IdFieldName] below required length       | Too short                                                                          | 400                     |
| 31       | Negative - Invalid Data Types     | [IdFieldName] above required length       | Too long                                                                           | 400                     |
| 32       | Negative - Invalid Data Types     | [ArrayName] Array exceeds max items       | Too many array elements                                                            | 400                     |
| 33       | Negative - Invalid Data Types     | [IdFieldName] not found                   | Valid format but not in system                                                     | 404                     |
| 34       | Negative - Cross-Field Validation | [IdFieldName] wrong ownership             | Belongs to another account                                                         | 400                     |
| 35       | Negative - Cross-Field Validation | [PathParam1] + [PathParam2] mismatch      | Valid values that don't logically match (e.g., customerID from US with country=CA) | 400                     |
| 36       | Negative - Cross-Field Validation | [FieldA] ≠ [FieldB] rule break            | Cross-field validation fails                                                       | 400                     |
| 37       | Negative - Cross-Field Validation | [FieldA] + [FieldB] invalid combo         | Disallowed combination                                                             | 400                     |
| 38       | Negative - Cross-Field Validation | [StartDateField] after [EndDateField]     | Date logic violation                                                               | 400                     |
| 39       | Negative - Cross-Field Validation | Mutually exclusive fields present         | Both [FieldA] and [FieldB] provided when only one allowed                          | 400                     |
| 40       | Negative - Cross-Field Validation | Missing conditional [FieldName]           | [FieldName] required when [ConditionField] is set                                  | 400                     |
| 41       | Negative - Unprocessable Entity   | Misspelled [FieldName]                    | Wrong property name                                                                | 400                     |
| 42       | Negative - Unprocessable Entity   | [IntegerFieldName] below min value        | Below numeric minimum                                                              | 422                     |
| 43       | Negative - Unprocessable Entity   | [IntegerFieldName] above max value        | Above numeric maximum                                                              | 422                     |
| 44       | Negative - Unprocessable Entity   | [DecimalFieldName] below min value        | Below decimal minimum                                                              | 422                     |
| 45       | Negative - Unprocessable Entity   | [DecimalFieldName] above max value        | Above decimal maximum                                                              | 422                     |
| 46       | Negative - Unprocessable Entity   | [IntegerFieldName] int32 overflow +       | Set = 2147483648                                                                   | 422                     |
| 47       | Negative - Unprocessable Entity   | [IntegerFieldName] int32 overflow −       | Set = -2147483649                                                                  | 422                     |
| 48       | Negative - Invalid Data Types     | [IntegerFieldName] as a Empty String      | Set = ""                                                                           | 422                     |
| 49       | Negative - Invalid Data Types     | [IntegerFieldName] as a Alpha String      | Set = "abc"                                                                        | 422                     |
| 50       | Negative - Unprocessable Entity   | [IntegerFieldName] as a Multi Decimal     | Set = 10.1.1                                                                       | 422                     |
| 51       | Negative - Unprocessable Entity   | [DecimalFieldName] as a Alpha String      | Set = "abc"                                                                        | 422                     |
| 52       | Negative - Unprocessable Entity   | [DecimalFieldName] as a Multi Decimal     | Set = 1.2.3                                                                        | 422                     |
| 53       | Negative - Unprocessable Entity   | [EnumFieldName] is NULL                   | Set enum = null                                                                    | 422                     |
| 54       | Negative - Unprocessable Entity   | [EnumFieldName] as a Empty String         | Set enum = ""                                                                      | 422                     |
| 55       | Negative - Unprocessable Entity   | Invalid [EnumFieldName] value             | Not in enum list                                                                   | 422                     |
| 56       | Negative - Unprocessable Entity   | Wrong [EnumFieldName] casing              | Incorrect casing                                                                   | 422                     |
| 57       | Negative - Unprocessable Entity   | [BooleanFieldName] as a Empty String      | Set = ""                                                                           | 422                     |
| 58       | Negative - Unprocessable Entity   | [BooleanFieldName] as a Alpha String      | Set = "yes"                                                                        | 422                     |
| 59       | Negative - Unprocessable Entity   | [BooleanFieldName] as a Number            | Set = 0 or 1                                                                       | 422                     |
| 60       | Negative - Unprocessable Entity   | Duplicate [UniqueField]                   | Duplicate unique value                                                             | 422                     |
| 61       | Negative - Unprocessable Entity   | Extra field [ExtraField] present          | Field not in schema                                                                | 422                     |
| 62       | Negative - Unprocessable Entity   | Extra nested [Parent.ExtraField]          | Nested unknown field                                                               | 422                     |
| 63       | Negative - No Auth                | Missing auth header for [Endpoint]        | No authentication provided                                                         | 403                     |
| 64       | Negative - Internal Server Error  | [metadata.localization] empty             | localization empty                                                                 | 500                     |
| 65       | Negative - Internal Server Error  | [metadata.localization] invalid           | localization invalid                                                               | 500                     |

---

## Best Practices

1. **Be Systematic:** Follow the recursive order strictly (Arrays → Objects → Fields → Nested Objects → Nested Fields)
2. **Be Deterministic:** Two people using this prompt with the same schema should generate identical scenarios
3. **Be Complete:** Cover all field types and all test categories
4. **Be Accurate:** Use exact field names from the schema
5. **Be Consistent:** Apply error codes uniformly across all scenarios
6. **Validate Persistence:** For data-mutating endpoints (POST/PUT/PATCH), include a read-back (GET) validation scenario to confirm changes persisted, not just that the write returned success
