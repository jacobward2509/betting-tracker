import express from 'express';
import { prisma } from '../prisma';
import { asyncHandler, requireAuth } from '../middleware/auth';

const router = express.Router();

router.get('/bet-types', requireAuth, asyncHandler(async (_req, res) => {
  const betTypes = await prisma.betTypes.findMany({ orderBy: { betTypes: 'asc' } });
  res.json(betTypes);
}));

router.get('/player-prop-markets', requireAuth, asyncHandler(async (_req, res) => {
  const markets = await prisma.playerPropMarkets.findMany({ orderBy: { markets: 'asc' } });
  res.json(markets);
}));

// Structured market catalog (Market/MarketSelection/MarketLine) that powers
// the Add/Edit Bet dropdowns going forward. Supersedes /api/bet-types and
// /api/player-prop-markets above, which are left in place unchanged for
// backward compatibility with any historical bet data still referencing the
// old flat string tables.
router.get('/markets', requireAuth, asyncHandler(async (_req, res) => {
  const markets = await prisma.market.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      selections: { orderBy: { sortOrder: 'asc' } },
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });
  res.json(markets);
}));

export default router;
