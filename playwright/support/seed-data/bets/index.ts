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
 *
 * `placedAt` is explicitly staggered (1s apart, strictly decreasing from bet
 * 1 to bet 3) rather than left at buildBet()'s "now" default. GET /api/bets
 * (apps/api/src/routes/bets.ts) orders results by `placedAt: 'desc'` with no
 * secondary sort key, and the frontend's filter dropdowns
 * (uniqueResults/uniqueBookmakers/uniqueStakeTypes in BetsView.vue) derive
 * their option order from first-appearance order in that list. Without
 * distinct timestamps, all three bets' default "now" values can land in the
 * same millisecond, leaving their relative order under a Postgres tie an
 * unspecified/plan-dependent detail — causing exactly the kind of
 * intermittent "Win"/"Loss" option-order flake seen in
 * tests/functional/bets-filters.spec.ts. Staggering guarantees bet 1 (WON)
 * always sorts before bet 2 (LOST) before bet 3 (LOST), matching every
 * assertion that depends on seed order.
 */
export function seededBetsFixture(): CreateBetRequestBody[] {
  const now = Date.now();
  return [
    buildBet({
      fixture: 'Arsenal vs Chelsea',
      selection: 'Bukayo Saka Player Shots Over 1.5',
      bookmaker: 'Bet365',
      stakeType: 'NORMAL',
      stake: 10,
      odds: 2,
      result: 'WON',
      placedAt: new Date(now).toISOString(),
    }),
    buildBet({
      fixture: 'Liverpool vs Manchester City',
      selection: 'Mohamed Salah Player Shots Over 1.5',
      bookmaker: 'Bet365',
      stakeType: 'NORMAL',
      stake: 5,
      odds: 1.8,
      result: 'LOST',
      placedAt: new Date(now - 1000).toISOString(),
    }),
    buildBet({
      fixture: 'Tottenham vs Everton',
      selection: 'Son Heung-min Player Shots Over 1.5',
      bookmaker: 'SkyBet',
      stakeType: 'FREE',
      stake: 8,
      odds: 3,
      result: 'LOST',
      placedAt: new Date(now - 2000).toISOString(),
    }),
  ];
}

/**
 * A larger set of 12 bets, each with a distinct stake value (£1 through
 * £12), needed to exercise the bets table's rows-per-page/pagination
 * controls (default page size 10 -> 2 pages) and to give deterministic
 * ascending/descending sort assertions on the "Stake (£)" column — see
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md.
 * All other fields use buildBet()'s defaults, so the exact fixture/
 * bookmaker/result values are not asserted against by that plan's
 * scenarios.
 *
 * `placedAt` is explicitly staggered 1s apart per bet (see the comment on
 * seededBetsFixture() above for why) — this fixture doesn't currently
 * assert on GET /api/bets's default-order result, but staggering avoids
 * baking in the same tie-breaking risk for any future scenario that does.
 */
export function seededPaginatedBetsFixture(): CreateBetRequestBody[] {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, index) =>
    buildBet({
      fixture: `Fixture ${index + 1}`,
      stake: index + 1,
      placedAt: new Date(now - index * 1000).toISOString(),
    }),
  );
}

