import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.League in apps/api/openapi/fixtures.yaml — the 11
// tracked football competitions (6 domestic leagues + 5 cup competitions).
const LEAGUE_ENUM = [
  'PREMIER_LEAGUE',
  'CHAMPIONSHIP',
  'LA_LIGA',
  'BUNDESLIGA',
  'LIGUE_1',
  'SERIE_A',
  'EFL_CUP',
  'FA_CUP',
  'CHAMPIONS_LEAGUE',
  'EUROPA_LEAGUE',
  'CONFERENCE_LEAGUE'
]

// Mirrors components.schemas.Fixture in apps/api/openapi/fixtures.yaml —
// returned as an array (possibly empty) by GET /api/fixtures/today. An empty
// array trivially satisfies this schema (there are no items to check against
// the `items` sub-schema), so this same schema correctly covers the "no
// fixtures cached for today" case without any special-casing.
const fixturesResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'league', 'homeTeam', 'awayTeam', 'kickoffAt', 'venue'],
    properties: {
      id: {type: 'string'},
      league: {type: 'string', enum: LEAGUE_ENUM},
      homeTeam: {type: 'string'},
      awayTeam: {type: 'string'},
      kickoffAt: {type: 'string'},
      venue: {type: ['string', 'null']}
    }
  }
}

const validateFixturesResponseSchema: ValidateFunction = ajv.compile(fixturesResponseSchema)

export function assertFixturesSchema(body: unknown): void {
  const valid = validateFixturesResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validateFixturesResponseSchema.errors
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
