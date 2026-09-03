import express from 'express';
import { prisma } from '../prisma';
import { asyncHandler, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  calculateProfit,
  normalizeResultValue,
  normalizeStakeTypeValue,
  sanitizeUniqueStrings,
  toNumberOrNull,
} from '../lib/bet-calculations';
import { parseFixtureTeams, parsePlayerFromSelection } from '../lib/fixture-parsing';
import { MULTI_LEG_BET_TYPES, resolveLegs, summarizeLegs } from '../lib/bet-legs';
import { computeOddsStakeAndProfit, sanitizeLineValue, sanitizeStructuredField } from '../lib/bet-write';

const router = express.Router();

const BET_LEGS_INCLUDE = {
  legs: {
    orderBy: { order: 'asc' as const },
    include: { fixtureRef: true, market: true, marketSelection: true, playerRef: true },
  },
};

// GET BETS (with basic filtering)
router.get('/bets', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const { search, bookmaker, result } = req.query;

  const bets = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
      AND: [
        search
          ? {
              OR: [
                { fixture: { contains: String(search), mode: 'insensitive' } },
                { selection: { contains: String(search), mode: 'insensitive' } },
              ],
            }
          : {},
        bookmaker ? { bookmaker: String(bookmaker) as any } : {},
        result ? { result: String(result) as any } : {},
      ],
    },
    orderBy: { placedAt: 'desc' },
    include: BET_LEGS_INCLUDE,
  });

  res.json(bets);
}));

router.get('/suggestions', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const rows = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
    },
    select: {
      fixture: true,
      betType: true,
      selection: true,
      playerPropMarket: true,
    },
    orderBy: {
      placedAt: 'desc',
    },
    take: 5000,
  });

  const teamStats = new Map<string, { name: string; count: number }>();
  const playerStats = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    const teams = parseFixtureTeams(row.fixture);
    for (const team of teams) {
      const key = team.toLowerCase();
      const existing = teamStats.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        teamStats.set(key, { name: team, count: 1 });
      }
    }

    if (String(row.betType || '') === 'Player Prop') {
      const player = parsePlayerFromSelection(row.selection, row.playerPropMarket);
      if (player) {
        const key = player.toLowerCase();
        const existing = playerStats.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          playerStats.set(key, { name: player, count: 1 });
        }
      }
    }
  }

  const teams = Array.from(teamStats.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.name);

  const players = Array.from(playerStats.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.name);

  res.json({ teams, players });
}));

router.post('/bets', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const data: Record<string, unknown> = { ...req.body };
  delete data.legs; // raw leg input array — replaced below with Prisma's nested-create shape
  data.result = normalizeResultValue(data.result);
  data.stakeType = normalizeStakeTypeValue(data.stakeType);
  data.cashOutValue = data.result === 'VOID' ? toNumberOrNull(data.cashOutValue) : null;
  data.userId = req.user?.id;

  const betType = String(data.betType || '');
  const { error: legsError, legs } = await resolveLegs(betType, (req.body as any)?.legs);
  if (legsError) {
    return res.status(422).json({ error: legsError });
  }

  // Structured-market fields are all optional/nullable — sanitize empty
  // strings (sent by the Vue <select> "unselected" state) down to null so
  // Prisma never receives an invalid FK/decimal value. For multi-leg bet
  // types these single-fixture/market/selection fields are never used —
  // the detail lives entirely in `legs` below — so they're forced to null.
  const isMultiLeg = MULTI_LEG_BET_TYPES.has(betType);
  data.marketId = sanitizeStructuredField(data.marketId, isMultiLeg, Number, null);
  data.selectionId = sanitizeStructuredField(data.selectionId, isMultiLeg, Number, null);
  data.lineValue = sanitizeLineValue(data.lineValue, isMultiLeg, null);
  data.fixtureId = sanitizeStructuredField(data.fixtureId, isMultiLeg, String, null);
  data.playerId = sanitizeStructuredField(data.playerId, isMultiLeg, String, null);

  if (isMultiLeg && legs && legs.length) {
    const summary = summarizeLegs(betType, legs);
    data.fixture = summary.fixture;
    data.selection = summary.selection;
  }

  const oddsResult = computeOddsStakeAndProfit(data);
  if ('error' in oddsResult) {
    return res.status(400).json({ error: oddsResult.error });
  }

  data.odds = oddsResult.odds;
  data.oddsBoostPercent = oddsResult.oddsBoostPercent;
  data.normalStake = oddsResult.normalStake;
  if (oddsResult.potentialReturn !== null) {
    data.potentialReturn = oddsResult.potentialReturn;
  }
  data.profit = oddsResult.profit;

  if (isMultiLeg && legs && legs.length) {
    (data as any).legs = {
      create: legs.map((leg) => ({
        order: leg.order,
        fixtureId: leg.fixtureId,
        marketId: leg.marketId,
        selectionId: leg.selectionId,
        lineValue: leg.lineValue,
        playerId: leg.playerId,
        description: leg.description,
      })),
    };
  }

  const bet = await prisma.bet.create({
    data: data as any,
    include: BET_LEGS_INCLUDE,
  });
  res.json(bet);
}));

router.put('/bets/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const existing = await prisma.bet.findFirst({
    where: { id: req.params.id, userId: req.user?.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  const normalizedResult = normalizeResultValue(req.body.result ?? existing.result);
  const normalizedCashOutValue =
    normalizedResult === 'VOID'
      ? toNumberOrNull(req.body.cashOutValue ?? existing.cashOutValue)
      : null;

  const merged = {
    ...existing,
    ...req.body,
    stakeType: normalizeStakeTypeValue(req.body.stakeType ?? existing.stakeType),
    result: normalizedResult,
    cashOutValue: normalizedCashOutValue,
  };

  const data: Record<string, unknown> = { ...merged };
  delete data.legs; // raw leg input array — replaced below with Prisma's nested-write shape

  const betType = String((req.body.betType ?? existing.betType) || '');
  const isMultiLeg = MULTI_LEG_BET_TYPES.has(betType);
  // Legs are only re-resolved/replaced when the caller actually sends a
  // `legs` array — omitting it (e.g. a bulk-edit that only touches
  // result/odds) leaves any existing legs on the bet untouched.
  const rawLegs = (req.body as any)?.legs;
  let resolvedLegs: Awaited<ReturnType<typeof resolveLegs>>['legs'];
  if (isMultiLeg && rawLegs !== undefined) {
    const { error: legsError, legs } = await resolveLegs(betType, rawLegs);
    if (legsError) {
      return res.status(422).json({ error: legsError });
    }
    resolvedLegs = legs;
  }

  data.marketId = sanitizeStructuredField(data.marketId, isMultiLeg, Number, isMultiLeg ? null : existing.marketId);
  data.selectionId = sanitizeStructuredField(data.selectionId, isMultiLeg, Number, isMultiLeg ? null : existing.selectionId);
  data.lineValue = sanitizeLineValue(
    data.lineValue,
    isMultiLeg,
    isMultiLeg ? null : (toNumberOrNull(existing.lineValue) ?? null),
  );
  data.fixtureId = sanitizeStructuredField(data.fixtureId, isMultiLeg, String, isMultiLeg ? null : existing.fixtureId);
  data.playerId = sanitizeStructuredField(data.playerId, isMultiLeg, String, isMultiLeg ? null : existing.playerId);

  if (isMultiLeg && resolvedLegs && resolvedLegs.length) {
    const summary = summarizeLegs(betType, resolvedLegs);
    data.fixture = summary.fixture;
    data.selection = summary.selection;
  }

  const oddsResult = computeOddsStakeAndProfit(merged);
  if ('error' in oddsResult) {
    return res.status(400).json({ error: oddsResult.error });
  }

  data.odds = oddsResult.odds;
  data.oddsBoostPercent = oddsResult.oddsBoostPercent;
  data.normalStake = oddsResult.normalStake;
  if (oddsResult.potentialReturn !== null) {
    data.potentialReturn = oddsResult.potentialReturn;
  }
  data.profit = oddsResult.profit;

  if (resolvedLegs) {
    // Replace legs wholesale — simpler and safer than diffing individual
    // legs, and cheap given the small (typically 2-6) leg counts involved.
    (data as any).legs = {
      deleteMany: {},
      create: resolvedLegs.map((leg) => ({
        order: leg.order,
        fixtureId: leg.fixtureId,
        marketId: leg.marketId,
        selectionId: leg.selectionId,
        lineValue: leg.lineValue,
        playerId: leg.playerId,
        description: leg.description,
      })),
    };
  }

  const bet = await prisma.bet.update({
    where: { id: req.params.id },
    data: data as any,
    include: BET_LEGS_INCLUDE,
  });
  res.json(bet);
}));

router.patch('/bets/bulk-result', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? sanitizeUniqueStrings(req.body.ids) : [];
  if (!ids.length) {
    return res.status(400).json({ error: 'At least one bet id is required.' });
  }

  const normalizedResult = normalizeResultValue(req.body?.result);
  const normalizedCashOutValue =
    normalizedResult === 'VOID' ? toNumberOrNull(req.body?.cashOutValue) : null;

  if (normalizedResult === 'VOID' && (normalizedCashOutValue === null || normalizedCashOutValue < 0)) {
    return res.status(400).json({ error: 'Cash Out value is required for Cashed Out result.' });
  }

  const existingBets = await prisma.bet.findMany({
    where: {
      id: { in: ids },
      userId: req.user?.id,
    },
  });

  if (!existingBets.length) {
    return res.status(404).json({ error: 'No matching bets found.' });
  }

  await prisma.$transaction(
    existingBets.map((bet) => {
      const payload = {
        ...bet,
        result: normalizedResult,
        cashOutValue: normalizedCashOutValue,
      };
      const profit = calculateProfit(payload);
      return prisma.bet.update({
        where: { id: bet.id },
        data: {
          result: normalizedResult,
          cashOutValue: normalizedCashOutValue,
          profit,
        } as any,
      });
    }),
  );

  res.json({
    updatedCount: existingBets.length,
    ids: existingBets.map((bet) => bet.id),
  });
}));

router.delete('/bets/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const existing = await prisma.bet.findFirst({
    where: { id: req.params.id, userId: req.user?.id },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  await prisma.bet.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
}));

export default router;




