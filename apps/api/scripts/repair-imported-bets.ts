import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getArgValue = (flag: string): string | null => {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
};

const emailArg = getArgValue('--email');
if (!emailArg) {
  console.error('Please pass --email <user-email>');
  process.exit(1);
}

const normalize = (value: string) => String(value || '').trim().toLowerCase();

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const inferMarketFromText = (text: string, side: 'O' | 'U'): string => {
  const normalized = normalize(text);
  if (normalized.includes('fouls won')) return 'Fouls Won Over';
  if (normalized.includes('fouls committed') || normalized.includes('fouls') || normalized.includes('foul')) {
    return 'Fouls Committed Over';
  }
  if (normalized.includes('sot')) return side === 'U' ? 'SOT Under' : 'SOT Over';
  if (normalized.includes('shots')) return side === 'U' ? 'Shots Under' : 'Shots Over';
  if (normalized.includes('tackles')) return 'Tackles Over';
  if (normalized.includes('carded')) return 'To Be Carded';
  if (normalized.includes('ags') || normalized.includes('anytime goalscorer')) return 'AGS';
  return '';
};

const canonicalMarketName = (market: string): string => {
  const value = normalize(market);
  if (!value) return '';
  if (value.includes('fouls won')) return 'Fouls Won Over';
  if (value.includes('fouls committed') || value === 'fouls' || value === 'foul') return 'Fouls Committed Over';
  if (value === 'shots over') return 'Shots Over';
  if (value === 'shots under') return 'Shots Under';
  if (value === 'sot over') return 'SOT Over';
  if (value === 'sot under') return 'SOT Under';
  if (value === 'tackles over') return 'Tackles Over';
  if (value === 'to be carded') return 'To Be Carded';
  if (value === 'ags') return 'AGS';
  return titleCase(market);
};

const main = async () => {
  const email = normalize(emailArg);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found for email: ${email}`);
  }

  const bets = await prisma.bet.findMany({
    where: { userId: user.id },
    select: { id: true, selection: true, betType: true, playerPropMarket: true },
  });

  let updatedBB = 0;
  let updatedFouls = 0;
  let updatedSelection = 0;

  for (const bet of bets) {
    const selection = normalize(bet.selection);
    const updates: Record<string, unknown> = {};

    if (selection === 'bb') {
      updates.betType = 'Bet Builder';
      updates.playerPropMarket = null;
      updates.selection = 'Bet Builder';
    }

    const mentionsFoul = selection.includes('foul');
    const mentionsFoulsWon = selection.includes('fouls won');
    if (
      (bet.betType === 'Player Prop' || updates.betType === 'Player Prop') &&
      mentionsFoul &&
      !mentionsFoulsWon
    ) {
      updates.playerPropMarket = 'Fouls Committed Over';
    }

    // Normalize legacy player-prop selection text:
    // "Sael Kumbedi O0.5 fouls won" -> "Sael Kumbedi Fouls Won Over 0.5"
    const effectiveBetType = String(updates.betType || bet.betType);
    if (effectiveBetType === 'Player Prop') {
      const rawSelection = String(bet.selection || '').trim();
      const legacyMatch = rawSelection.match(/^(.*?)\s+([OU])\s*(\d+(?:\.\d+)?)\s+(.+)$/i);

      if (legacyMatch) {
        const player = legacyMatch[1].trim();
        const side = legacyMatch[2].toUpperCase() as 'O' | 'U';
        const lineValue = Number(legacyMatch[3]);
        const legacyMarketText = legacyMatch[4].trim();
        const currentMarket = String(updates.playerPropMarket || bet.playerPropMarket || '').trim();
        const market = canonicalMarketName(currentMarket) || inferMarketFromText(legacyMarketText, side);
        const line = Number.isFinite(lineValue) ? lineValue.toFixed(1) : '';

        if (market) {
          updates.selection = [player, market, line].filter(Boolean).join(' ');
          updates.playerPropMarket = market;
        }
      }
    }

    if (Object.keys(updates).length) {
      await prisma.bet.update({ where: { id: bet.id }, data: updates as any });
      if (selection === 'bb') updatedBB += 1;
      if (mentionsFoul && !mentionsFoulsWon) updatedFouls += 1;
      if (Object.prototype.hasOwnProperty.call(updates, 'selection')) updatedSelection += 1;
    }
  }

  console.log(`Repair complete for ${email}`);
  console.log(`BB rows updated: ${updatedBB}`);
  console.log(`Fouls Committed market updates: ${updatedFouls}`);
  console.log(`Legacy player-prop selections normalized: ${updatedSelection}`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
