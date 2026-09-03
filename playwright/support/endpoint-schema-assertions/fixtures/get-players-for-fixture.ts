import {expect} from '@playwright/test'
import Ajv, {ValidateFunction} from 'ajv'

const ajv = new Ajv({allErrors: true, strict: false})

// Mirrors components.schemas.Player in apps/api/openapi/fixtures.yaml —
// returned nested inside the players array of GET
// /api/fixtures/{id}/players's response body.
//
// Deviation from the documented schema: the handler
// (apps/api/src/server.ts, GET /api/fixtures/:id/players) returns the raw
// Prisma Player row as-is (`teamEntries.flatMap(...cachedByTeam.get...)`),
// not a trimmed object matching the YML's { id, name, teamName, position }
// shape. This means additional DB-only columns (sportsDbId, teamSportsDbId,
// fetchedAt, createdAt) are always present on the wire too. Per this
// codebase's existing "assert actual behavior, not aspirational schema"
// convention (see get-todays-fixtures.ts and the sibling fixtures test
// plans), additionalProperties is left permissive here rather than false,
// and the extra fields are asserted to exist with their actual types.
const playerSchema = {
  type: 'object',
  required: ['id', 'name', 'teamName', 'sportsDbId', 'teamSportsDbId', 'fetchedAt', 'createdAt'],
  properties: {
    id: {type: 'string'},
    name: {type: 'string'},
    teamName: {type: 'string'},
    position: {type: ['string', 'null']},
    sportsDbId: {type: 'string'},
    teamSportsDbId: {type: 'string'},
    fetchedAt: {type: 'string'},
    createdAt: {type: 'string'}
  }
}

// Mirrors the inline 200 response schema for GET /api/fixtures/{id}/players
// in apps/api/openapi/fixtures.yaml — { homeTeam, awayTeam, players: Player[] }.
// An empty players array is a valid, expected response (a fixture whose
// teams have no cached roster yet), and trivially satisfies this schema's
// `items` sub-schema with no items to check.
const playersForFixtureResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['homeTeam', 'awayTeam', 'players'],
  properties: {
    homeTeam: {type: 'string'},
    awayTeam: {type: 'string'},
    players: {
      type: 'array',
      items: playerSchema
    }
  }
}

const validatePlayersForFixtureResponseSchema: ValidateFunction = ajv.compile(
  playersForFixtureResponseSchema
)

export function assertPlayersForFixtureSchema(body: unknown): void {
  const valid = validatePlayersForFixtureResponseSchema(body)

  if (!valid) {
    const errorDetails =
      validatePlayersForFixtureResponseSchema.errors
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
