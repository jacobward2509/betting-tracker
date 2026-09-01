import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.ErrorResponse in apps/api/openapi/user-config.yaml (same
// shape as apps/api/openapi/auth.yaml's ErrorResponse, duplicated per-domain YAML file
// per this repo's three-way openapi.yaml split). Used for the 400 VALIDATION_ERROR
// responses returned by PUT /api/user/config.
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

export function assertUserConfigErrorResponseSchema(body: unknown): void {
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
