/**
 * Seed data for PUT /api/user/config (apps/api/openapi/user-config.yaml →
 * UpdateUserConfigRequest).
 *
 * Every field on this endpoint is optional/nullable — a client may update just one
 * preference at a time. `maximumUpdateUserConfigBody()` populates all four fields for
 * comprehensive positive testing; individual scenarios override/omit fields as needed.
 */

export type Bookmaker =
  | 'Bet365'
  | 'Betfair'
  | 'BetUK'
  | 'Ladbrokes'
  | 'PaddyPower'
  | 'SkyBet'
  | 'WilliamHill'

// Mirrors components.schemas.Bookmaker in apps/api/openapi/user-config.yaml — the 7
// tracked bookmakers, matching the Bookmaker enum in apps/api/prisma/schema.prisma.
export const BOOKMAKER_ENUM: readonly Bookmaker[] = [
  'Bet365',
  'Betfair',
  'BetUK',
  'Ladbrokes',
  'PaddyPower',
  'SkyBet',
  'WilliamHill'
]

// A tracked bet type (from the BetTypes table) distinct from the platform default
// ("Player Prop"), used to prove an update actually changed the value rather than
// coincidentally matching the pre-existing default.
export const VALID_BET_TYPE = 'Accumulator'

export interface UpdateUserConfigRequestBody {
  enabledBookmakers?: Bookmaker[] | null
  defaultBookmaker?: Bookmaker | null
  defaultBetType?: string | null
  defaultStake?: number | null
}

/**
 * A complete UpdateUserConfigRequest body with all four fields populated to valid
 * values, for comprehensive positive testing. `enabledBookmakers` is narrowed to a
 * 3-bookmaker subset (rather than all 7) so the "fully replaces the previous set"
 * behavior is observable against the platform's all-enabled default.
 */
export function maximumUpdateUserConfigBody(): UpdateUserConfigRequestBody {
  return {
    enabledBookmakers: ['Bet365', 'Betfair', 'BetUK'],
    defaultBookmaker: 'Bet365',
    defaultBetType: VALID_BET_TYPE,
    defaultStake: 25
  }
}
