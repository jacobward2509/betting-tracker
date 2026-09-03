import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.Market.category (MarketCategory enum) in
// apps/api/openapi/fixtures.yaml.
const MARKET_CATEGORY_ENUM = ['MATCH', 'PLAYER']

// Mirrors components.schemas.MarketSelection in apps/api/openapi/fixtures.yaml,
// plus one field the documented schema omits but the handler's Prisma
// `include` actually returns: `marketId` (the FK back to the parent Market
// row). See the Scope Notes deviation in
// playwright/docs/test-plans/api/markets/test-plan-get-markets.md — this
// mirrors the "assert the actual, literal shape" convention already applied
// to flat error-body deviations elsewhere in this suite.
const marketSelectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'marketId', 'label', 'sortOrder'],
  properties: {
    id: {type: 'integer'},
    marketId: {type: 'integer'},
    label: {type: 'string'},
    sortOrder: {type: 'integer'}
  }
}

// Mirrors components.schemas.MarketLine in apps/api/openapi/fixtures.yaml,
// plus the same actual-but-undocumented `marketId` field as
// MarketSelection above. `value` is serialized as a string (Prisma
// Decimal), per the documented schema.
const marketLineSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'marketId', 'value', 'sortOrder'],
  properties: {
    id: {type: 'integer'},
    marketId: {type: 'integer'},
    value: {type: 'string'},
    sortOrder: {type: 'integer'}
  }
}

// Mirrors components.schemas.Market in apps/api/openapi/fixtures.yaml —
// returned as an array by GET /api/markets — plus the actual-but-undocumented
// `createdAt` field (see the deviation note above).
const marketsResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'category', 'requiresPlayer', 'sortOrder', 'createdAt', 'selections', 'lines'],
    properties: {
      id: {type: 'integer'},
      name: {type: 'string'},
      category: {type: 'string', enum: MARKET_CATEGORY_ENUM},
      requiresPlayer: {type: 'boolean'},
      sortOrder: {type: 'integer'},
      createdAt: {type: 'string'},
      selections: {type: 'array', items: marketSelectionSchema},
      lines: {type: 'array', items: marketLineSchema}
    }
  }
}

const validateMarketsResponseSchema: ValidateFunction = ajv.compile(marketsResponseSchema)

export function assertMarketsSchema(body: unknown): void {
  const valid = validateMarketsResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateMarketsResponseSchema.errors
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
