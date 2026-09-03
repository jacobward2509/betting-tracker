import { prisma } from '../prisma';

// Bet types backed by a list of BetLeg rows (each sourced exclusively from
// the structured Fixture/Market/MarketSelection/Player catalog) rather than
// the single fixture/market/selection fields on Bet itself.
export const MULTI_LEG_BET_TYPES = new Set(['Accumulator', 'Bet Builder', 'Cross Match Bet Builder']);

export type ResolvedLeg = {
  order: number;
  fixtureId: string;
  marketId: number;
  selectionId: number;
  lineValue: number | null;
  playerId: string | null;
  description: string;
  _fixture: { homeTeam: string; awayTeam: string };
};

// Builds a leg's display description the same way the Add/Edit Bet UI's
// getGeneratedDescription() builds a single bet's selection string, so
// existing code that only knows how to display a flat string still gets
// something readable per leg.
export const buildLegDescription = (params: {
  marketName: string;
  requiresPlayer: boolean;
  selectionLabel: string;
  lineValue: number | null;
  playerName: string | null;
}): string => {
  const line = params.lineValue !== null && params.lineValue !== undefined ? String(params.lineValue) : '';
  const playerName = params.requiresPlayer ? params.playerName || '' : '';
  return [playerName, params.marketName, params.selectionLabel, line].filter(Boolean).join(' ');
};

// Validates and hydrates the `legs` array sent for a multi-leg bet type,
// enforcing the rule set agreed for each type:
//   - Accumulator: at least 2 distinct fixtures, exactly one leg per fixture.
//   - Bet Builder: exactly 1 fixture, at least 2 legs.
//   - Cross Match Bet Builder: at least 2 distinct fixtures, any number of
//     legs (>=1) per fixture.
// Returns a validation error message, or the fully-resolved legs (each
// carrying its generated description and the fixture it belongs to, for the
// caller to build a top-level fixture/selection summary from).
export const resolveLegs = async (
  betType: string,
  rawLegs: unknown,
): Promise<{ error?: string; legs?: ResolvedLeg[] }> => {
  if (!MULTI_LEG_BET_TYPES.has(betType)) {
    return { legs: [] };
  }

  const legsArray = Array.isArray(rawLegs) ? rawLegs : [];
  if (legsArray.length === 0) {
    return { error: `At least one leg is required for ${betType}.` };
  }

  const legInputs = legsArray.map((leg: any) => ({
    fixtureId: leg?.fixtureId ? String(leg.fixtureId) : '',
    marketId: leg?.marketId ? Number(leg.marketId) : NaN,
    selectionId: leg?.selectionId ? Number(leg.selectionId) : NaN,
    lineValue:
      leg?.lineValue !== null && leg?.lineValue !== undefined && leg?.lineValue !== ''
        ? Number(leg.lineValue)
        : null,
    playerId: leg?.playerId ? String(leg.playerId) : null,
  }));

  for (const leg of legInputs) {
    if (!leg.fixtureId || !Number.isFinite(leg.marketId) || !Number.isFinite(leg.selectionId)) {
      return { error: 'Each leg requires a fixture, market and selection.' };
    }
  }

  const distinctFixtureIds = Array.from(new Set(legInputs.map((leg) => leg.fixtureId)));

  if (betType === 'Accumulator') {
    if (distinctFixtureIds.length < 2) {
      return { error: 'An Accumulator requires at least 2 different fixtures.' };
    }
    if (distinctFixtureIds.length !== legInputs.length) {
      return { error: 'An Accumulator allows only one selection per fixture.' };
    }
  } else if (betType === 'Bet Builder') {
    if (distinctFixtureIds.length !== 1) {
      return { error: 'A Bet Builder must use a single fixture for all legs.' };
    }
    if (legInputs.length < 2) {
      return { error: 'A Bet Builder requires at least 2 legs.' };
    }
  } else if (betType === 'Cross Match Bet Builder') {
    if (distinctFixtureIds.length < 2) {
      return { error: 'A Cross Match Bet Builder requires at least 2 different fixtures.' };
    }
  }

  const [fixtures, markets, players] = await Promise.all([
    prisma.fixture.findMany({ where: { id: { in: distinctFixtureIds } } }),
    prisma.market.findMany({
      where: { id: { in: Array.from(new Set(legInputs.map((leg) => leg.marketId))) } },
      include: { selections: true },
    }),
    prisma.player.findMany({
      where: {
        id: { in: legInputs.filter((leg) => leg.playerId).map((leg) => leg.playerId as string) },
      },
    }),
  ]);

  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const marketById = new Map(markets.map((m) => [m.id, m]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  const legs: ResolvedLeg[] = [];
  for (let i = 0; i < legInputs.length; i += 1) {
    const leg = legInputs[i];
    const fixture = fixtureById.get(leg.fixtureId);
    if (!fixture) return { error: 'One or more legs reference an unknown fixture.' };

    const market = marketById.get(leg.marketId);
    if (!market) return { error: 'One or more legs reference an unknown market.' };

    const selection = market.selections.find((s) => s.id === leg.selectionId);
    if (!selection) return { error: 'One or more legs reference an unknown selection for their market.' };

    if (market.requiresPlayer && !leg.playerId) {
      return { error: 'Player is required for one or more legs.' };
    }
    const player = leg.playerId ? playerById.get(leg.playerId) : null;
    if (leg.playerId && !player) return { error: 'One or more legs reference an unknown player.' };

    legs.push({
      order: i,
      fixtureId: leg.fixtureId,
      marketId: leg.marketId,
      selectionId: leg.selectionId,
      lineValue: leg.lineValue,
      playerId: leg.playerId,
      description: buildLegDescription({
        marketName: market.name,
        requiresPlayer: market.requiresPlayer,
        selectionLabel: selection.label,
        lineValue: leg.lineValue,
        playerName: player?.name || null,
      }),
      _fixture: { homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam },
    });
  }

  return { legs };
};

// Derives the top-level (backward-compatible) fixture/selection strings for
// a multi-leg bet from its resolved legs, so any code that only reads those
// flat columns (CSV export/import, older reporting) still shows something
// meaningful.
export const summarizeLegs = (betType: string, legs: ResolvedLeg[]): { fixture: string; selection: string } => {
  if (betType === 'Bet Builder') {
    const f = legs[0]._fixture;
    return {
      fixture: `${f.homeTeam} vs ${f.awayTeam}`,
      selection: `Bet Builder: ${legs.map((leg) => leg.description).join(', ')}`,
    };
  }

  const label = betType === 'Accumulator' ? `${legs.length}-fold Accumulator` : 'Cross Match Bet Builder';
  return {
    fixture: betType,
    selection: `${label}: ${legs
      .map((leg) => `${leg._fixture.homeTeam} vs ${leg._fixture.awayTeam} (${leg.description})`)
      .join(', ')}`,
  };
};
