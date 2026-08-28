import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.CurrentUserResponse in apps/api/openapi/openapi.yaml —
// returned by GET /api/auth/me on success.
const currentUserResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user'],
  properties: {
    user: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'email'],
      properties: {
        id: {type: 'string'},
        name: {type: 'string'},
        email: {type: 'string'}
      }
    }
  }
}

const validateCurrentUserResponseSchema: ValidateFunction = ajv.compile(currentUserResponseSchema)

export function assertCurrentUserSchema(body: unknown): void {
  const valid = validateCurrentUserResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateCurrentUserResponseSchema.errors
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
