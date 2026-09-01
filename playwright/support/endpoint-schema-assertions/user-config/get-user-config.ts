import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.Bookmaker in apps/api/openapi/user-config.yaml — the 7
// tracked bookmakers, matching the Bookmaker enum in apps/api/prisma/schema.prisma.
// Wire values use the Prisma enum member names (no spaces), e.g. "PaddyPower" not
// "Paddy Power".
const BOOKMAKER_ENUM = [
  'Bet365',
  'Betfair',
  'BetUK',
  'Ladbrokes',
  'PaddyPower',
  'SkyBet',
  'WilliamHill'
]

// Mirrors components.schemas.UserConfigResponse in apps/api/openapi/user-config.yaml —
// returned by both GET /api/user/config and (on the same shape) PUT /api/user/config.
const userConfigResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['bookmakers', 'enabledBookmakers', 'defaults'],
  properties: {
    bookmakers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['bookmaker', 'enabled'],
        properties: {
          bookmaker: {type: 'string', enum: BOOKMAKER_ENUM},
          enabled: {type: 'boolean'}
        }
      }
    },
    enabledBookmakers: {
      type: 'array',
      items: {type: 'string', enum: BOOKMAKER_ENUM}
    },
    defaults: {
      type: 'object',
      additionalProperties: false,
      required: ['bookmaker', 'betType', 'stake'],
      properties: {
        bookmaker: {type: ['string', 'null'], enum: [...BOOKMAKER_ENUM, null]},
        betType: {type: 'string'},
        stake: {type: 'number'}
      }
    }
  }
}

const validateUserConfigResponseSchema: ValidateFunction = ajv.compile(userConfigResponseSchema)

export function assertUserConfigSchema(body: unknown): void {
  const valid = validateUserConfigResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateUserConfigResponseSchema.errors
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
