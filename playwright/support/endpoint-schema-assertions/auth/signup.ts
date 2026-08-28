import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.AuthResponse in apps/api/openapi/auth.yaml
const authResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['token', 'user'],
  properties: {
    token: {type: 'string'},
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

const validateAuthResponseSchema: ValidateFunction = ajv.compile(authResponseSchema)

export function assertSignupSchema(body: unknown): void {
  const valid = validateAuthResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateAuthResponseSchema.errors
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

// Mirrors components.schemas.ErrorResponse in apps/api/openapi/auth.yaml.
// The generic assert400Schema/assert401Schema helpers in
// support/functions/schema_assertions.ts check for a top-level 'details'
// string, which does not match this API's structured error shape — see the
// "Scope Notes" in playwright/docs/test-plans/auth/test-plan-signup.md.
const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: {type: 'string'},
        message: {type: 'string'},
        fields: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['field', 'message'],
            properties: {
              field: {type: 'string'},
              message: {type: 'string'}
            }
          }
        }
      }
    }
  }
}

const validateErrorResponseSchema: ValidateFunction = ajv.compile(errorResponseSchema)

export function assertErrorResponseSchema(body: unknown): void {
  const valid = validateErrorResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateErrorResponseSchema.errors
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

