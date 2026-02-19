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

const apply = process.argv.includes('--apply');

const normalize = (value: unknown) => String(value || '').trim();
const lower = (value: unknown) => normalize(value).toLowerCase();

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const canonicalizeBetType = (value: string): string | null => {
  const v = lower(value);
  if (!v) return null;
  if (v === 'accumulator' || v === 'acca') return 'Accumulator';
  if (v === 'bet builder' || v === 'bb' || v === 'builder') return 'Bet Builder';
  if (v === 'player prop' || v === 'playerprop') return 'Player Prop';
  if (v === 'superboost' || v === 'super boost' || v === 'sb') return 'Superboost';
  if (
    v === 'ft result' ||
    v === 'full time result' ||
    v === 'full-time result' ||
    v === 'match result' ||
    v === '1x2'
  ) {
    return 'FT Result';
  }
  if (v === 'other') return 'Other';
  return null;
};

const inferBetTypeFromSelection = (selection: string): string | null => {
  const s = lower(selection);
  if (!s) return null;
  if (s === 'accumulator' || s.includes(' acca')) return 'Accumulator';
  if (s === 'bb' || s === 'bet builder') return 'Bet Builder';
  if (s.includes('superboost') || s.includes('super boost')) return 'Superboost';
  if (s.endsWith(' to win') || /\b(win|won)\b/.test(s)) return 'FT Result';
  return null;
};

const normalizeFtResultSelection = (selection: string): string => {
  const raw = normalize(selection)
    .replace(/^ft\s*result\s*[:-]?\s*/i, '')
    .replace(/^result\s*[:-]?\s*/i, '')
    .trim();

  if (!raw) return '';

  const already = raw.match(/^(.*)\s+to\s+win$/i);
  if (already) {
    return `${titleCase(already[1].trim())} to Win`;
  }

  const trailingWin = raw.match(/^(.*)\s+(win|won)$/i);
  if (trailingWin) {
    return `${titleCase(trailingWin[1].trim())} to Win`;
  }

  return `${titleCase(raw)} to Win`;
};

const main = async () => {
  const email = lower(emailArg);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found for email: ${email}`);
  }

  const bets = await prisma.bet.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      betType: true,
      selection: true,
      playerPropMarket: true,
    },
    orderBy: { placedAt: 'asc' },
  });

  let changed = 0;
  let changedBetType = 0;
  let changedSelection = 0;
  let clearedMarket = 0;

  for (const bet of bets) {
    const rawBetType = normalize(bet.betType);
    const rawSelection = normalize(bet.selection);

    const canonical = canonicalizeBetType(rawBetType);
    const inferred = inferBetTypeFromSelection(rawSelection);

    let targetBetType = canonical;

    if (!targetBetType && rawBetType) {
      // Legacy custom labels should now be represented as Bet Type = Other
      targetBetType = 'Other';
    }

    if (!targetBetType) {
      targetBetType = inferred || 'Player Prop';
    }

    const updates: Record<string, unknown> = {};

    if (targetBetType !== rawBetType) {
      updates.betType = targetBetType;
      changedBetType += 1;
    }

    if (targetBetType === 'Accumulator') {
      if (rawSelection !== 'Accumulator') {
        updates.selection = 'Accumulator';
        changedSelection += 1;
      }
      if (bet.playerPropMarket != null) {
        updates.playerPropMarket = null;
        clearedMarket += 1;
      }
    } else if (targetBetType === 'Bet Builder') {
      if (rawSelection !== 'Bet Builder') {
        updates.selection = 'Bet Builder';
        changedSelection += 1;
      }
      if (bet.playerPropMarket != null) {
        updates.playerPropMarket = null;
        clearedMarket += 1;
      }
    } else if (targetBetType === 'Superboost') {
      if (rawSelection !== 'Superboost') {
        updates.selection = 'Superboost';
        changedSelection += 1;
      }
      if (bet.playerPropMarket != null) {
        updates.playerPropMarket = null;
        clearedMarket += 1;
      }
    } else if (targetBetType === 'FT Result') {
      const normalizedSelection = normalizeFtResultSelection(rawSelection);
      if (normalizedSelection && normalizedSelection !== rawSelection) {
        updates.selection = normalizedSelection;
        changedSelection += 1;
      }
      if (bet.playerPropMarket != null) {
        updates.playerPropMarket = null;
        clearedMarket += 1;
      }
    } else if (targetBetType === 'Other') {
      if (
        (lower(rawSelection) === 'other' || !rawSelection) &&
        rawBetType &&
        !canonicalizeBetType(rawBetType)
      ) {
        updates.selection = rawBetType;
        changedSelection += 1;
      }
      if (bet.playerPropMarket != null) {
        updates.playerPropMarket = null;
        clearedMarket += 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      changed += 1;
      if (apply) {
        await prisma.bet.update({ where: { id: bet.id }, data: updates as any });
      }
    }
  }

  console.log(`${apply ? 'Applied' : 'Dry run'} retrofit for ${email}`);
  console.log(`Rows needing update: ${changed}`);
  console.log(`Bet type changes: ${changedBetType}`);
  console.log(`Selection changes: ${changedSelection}`);
  console.log(`playerPropMarket cleared: ${clearedMarket}`);
  if (!apply) {
    console.log('Re-run with --apply to persist these changes.');
  }
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
