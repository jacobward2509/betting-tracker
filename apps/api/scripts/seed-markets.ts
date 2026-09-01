// Seeds the structured market catalog (Market / MarketSelection / MarketLine)
// that replaces the manually-curated BetTypes / PlayerPropMarkets tables for
// the Add/Edit Bet UI. Idempotent — safe to re-run; uses upsert throughout so
// existing rows (and any Bet FK pointing at them) are updated in place rather
// than deleted/recreated. Run via `npm run seed:markets` from apps/api.
import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type SeedMarket = {
  name: string;
  category: 'MATCH' | 'PLAYER';
  requiresPlayer: boolean;
  selections: string[];
  lines?: number[];
};

// Curated from The Odds API's public soccer betting-markets documentation
// (https://the-odds-api.com/sports-odds-data/betting-markets.html), reshaped
// into this app's market/selection/line structure and adjusted per the
// reviewed feedback: Yes/No player markets collapsed to a single "Yes"
// selection, shots lines extended, and Player Passes removed entirely.
const MATCH_MARKETS: SeedMarket[] = [
  { name: 'Match Result', category: 'MATCH', requiresPlayer: false, selections: ['Home Win', 'Draw', 'Away Win'] },
  {
    name: 'Double Chance',
    category: 'MATCH',
    requiresPlayer: false,
    selections: ['Home or Draw', 'Draw or Away', 'Home or Away'],
  },
  { name: 'Both Teams to Score', category: 'MATCH', requiresPlayer: false, selections: ['Yes', 'No'] },
  {
    name: 'Total Goals',
    category: 'MATCH',
    requiresPlayer: false,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
  },
  {
    name: 'Handicap',
    category: 'MATCH',
    requiresPlayer: false,
    selections: ['Home', 'Away'],
    lines: [-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5],
  },
  {
    name: 'Half Time / Full Time',
    category: 'MATCH',
    requiresPlayer: false,
    selections: [
      'Home/Home',
      'Home/Draw',
      'Home/Away',
      'Draw/Home',
      'Draw/Draw',
      'Draw/Away',
      'Away/Home',
      'Away/Draw',
      'Away/Away',
    ],
  },
  {
    name: 'Total Corners',
    category: 'MATCH',
    requiresPlayer: false,
    selections: ['Over', 'Under'],
    lines: [7.5, 8.5, 9.5, 10.5, 11.5],
  },
  {
    name: 'Total Cards',
    category: 'MATCH',
    requiresPlayer: false,
    selections: ['Over', 'Under'],
    lines: [2.5, 3.5, 4.5, 5.5],
  },
  { name: 'Team to Qualify', category: 'MATCH', requiresPlayer: false, selections: ['Home', 'Away'] },
];

const PLAYER_MARKETS: SeedMarket[] = [
  {
    name: 'Player Shots',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
  },
  {
    name: 'Player Shots on Target',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5, 3.5, 4.5],
  },
  {
    name: 'Player Goals',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5],
  },
  { name: 'Anytime Goalscorer', category: 'PLAYER', requiresPlayer: true, selections: ['Yes'] },
  { name: 'First Goalscorer', category: 'PLAYER', requiresPlayer: true, selections: ['Yes'] },
  { name: 'Last Goalscorer', category: 'PLAYER', requiresPlayer: true, selections: ['Yes'] },
  {
    name: 'Player Assists',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5],
  },
  { name: 'Player to be Carded', category: 'PLAYER', requiresPlayer: true, selections: ['Yes'] },
  { name: 'Player to be Sent Off', category: 'PLAYER', requiresPlayer: true, selections: ['Yes'] },
  {
    name: 'Player Fouls Committed',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5],
  },
  {
    name: 'Player Fouls Won',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5],
  },
  {
    name: 'Player Tackles',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5, 2.5],
  },
  {
    name: 'Player Offsides',
    category: 'PLAYER',
    requiresPlayer: true,
    selections: ['Over', 'Under'],
    lines: [0.5, 1.5],
  },
];

const ALL_MARKETS = [...MATCH_MARKETS, ...PLAYER_MARKETS];

const seedMarket = async (definition: SeedMarket, sortOrder: number) => {
  const market = await prisma.market.upsert({
    where: { name: definition.name },
    create: {
      name: definition.name,
      category: definition.category,
      requiresPlayer: definition.requiresPlayer,
      sortOrder,
    },
    update: {
      category: definition.category,
      requiresPlayer: definition.requiresPlayer,
      sortOrder,
    },
  });

  for (let i = 0; i < definition.selections.length; i += 1) {
    await prisma.marketSelection.upsert({
      where: { marketId_label: { marketId: market.id, label: definition.selections[i] } },
      create: { marketId: market.id, label: definition.selections[i], sortOrder: i },
      update: { sortOrder: i },
    });
  }

  const lines = definition.lines || [];
  for (let i = 0; i < lines.length; i += 1) {
    await prisma.marketLine.upsert({
      where: { marketId_value: { marketId: market.id, value: lines[i] } },
      create: { marketId: market.id, value: lines[i], sortOrder: i },
      update: { sortOrder: i },
    });
  }

  return market;
};

const main = async () => {
  for (let i = 0; i < ALL_MARKETS.length; i += 1) {
    const market = await seedMarket(ALL_MARKETS[i], i);
    console.log(`Seeded market: ${market.name} (${market.category})`);
  }
  console.log(`Done. Seeded ${ALL_MARKETS.length} markets.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
