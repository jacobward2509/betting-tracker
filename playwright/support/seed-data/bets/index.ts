/**
 * Seed data for POST /api/bets (apps/api/openapi/bets.yaml -> CreateBetRequest),
 * used to give the Bets page ("/bets") deterministic Total Bets / Favourite
 * Bookie / Total P/L / filter-dropdown-option assertions to check against,
 * without depending on whatever bets happen to already exist for an account.
 *
 * Every builder here produces a single-fixture "Player Prop" bet (no `legs`
 * required) placed "now" (so it always falls in the current season, matching
 * getCurrentSeasonKey() in apps/web/src/utils/season.ts) unless overridden.
 */

export interface CreateBetRequestBody {
  fixture: string;
  selection: string;
  bookmaker: string;
  stakeType: 'NORMAL' | 'FREE' | 'NORMAL_PLUS_FREE';
  betType: string;
  stake: number;
  odds: number;
  result: 'OPEN' | 'WON' | 'LOST' | 'VOID';
  placedAt: string;
}

/**
 * Builds a single valid CreateBetRequest body, applying sane single-fixture
 * "Player Prop" defaults and letting any field be overridden.
 */
export function buildBet(overrides: Partial<CreateBetRequestBody> = {}): CreateBetRequestBody {
  return {
    fixture: 'Arsenal vs Chelsea',
    selection: 'Bukayo Saka Player Shots Over 1.5',
    bookmaker: 'Bet365',
    stakeType: 'NORMAL',
    betType: 'Player Prop',
    stake: 10,
    odds: 2,
    result: 'OPEN',
    placedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * A small, fixed set of 3 bets spanning two bookmakers (Bet365 twice, Sky Bet
 * once, so Bet365 is unambiguously the Favourite Bookie), a Win and a Loss
 * (giving a deterministic, non-zero Total P/L sign), and both NORMAL/FREE
 * stake types — enough to exercise every filter dropdown's option list
 * without needing a large data set.
 *
 * Profit is computed server-side (see apps/api/src/lib/bet-calculations.ts):
 * WON -> stake * odds - stake; LOST -> -stake. With these values:
 *   Bet 1 (WON, stake 10, odds 2)   -> profit = 10.00
 *   Bet 2 (LOST, stake 5)           -> profit = -5.00
 *   Bet 3 (LOST, stake 8, FREE)     -> profit = 0.00 (free stake never lost)
 * Total P/L = 10.00 - 5.00 + 0.00 = 5.00 (positive, so text-green-700).
 */
export function seededBetsFixture(): CreateBetRequestBody[] {
  return [
    buildBet({
      fixture: 'Arsenal vs Chelsea',
      selection: 'Bukayo Saka Player Shots Over 1.5',
      bookmaker: 'Bet365',
      stakeType: 'NORMAL',
      stake: 10,
      odds: 2,
      result: 'WON',
    }),
    buildBet({
      fixture: 'Liverpool vs Manchester City',
      selection: 'Mohamed Salah Player Shots Over 1.5',
      bookmaker: 'Bet365',
      stakeType: 'NORMAL',
      stake: 5,
      odds: 1.8,
      result: 'LOST',
    }),
    buildBet({
      fixture: 'Tottenham vs Everton',
      selection: 'Son Heung-min Player Shots Over 1.5',
      bookmaker: 'SkyBet',
      stakeType: 'FREE',
      stake: 8,
      odds: 3,
      result: 'LOST',
    }),
  ];
}
