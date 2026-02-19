import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type CsvRow = Record<string, string>;

type StakeType = 'NORMAL' | 'FREE';
type ResultType = 'OPEN' | 'WON' | 'LOST' | 'VOID';
type BookmakerType =
  | 'Bet365'
  | 'Betfair'
  | 'BetUK'
  | 'Ladbrokes'
  | 'PaddyPower'
  | 'SkyBet'
  | 'WilliamHill';

const REQUIRED_COLUMNS = [
  'Date',
  'Fixture',
  'Bookie',
  'Bet',
  'Bet Type',
  'Stake (£)',
  'Stake (Unit)',
  'Odds',
  'Result',
  'Cash Out Value',
] as const;

const PLAYER_PROP_MARKETS = [
  'Shots Over',
  'Shots Under',
  'SOT Over',
  'SOT Under',
  'Fouls Committed Over',
  'Fouls Won Over',
  'Tackles Over',
  'To Be Carded',
  'AGS',
] as const;

const normalize = (value: unknown) => String(value || '').trim();

const cleanCurrency = (value: string) =>
  normalize(value).replace(/£/g, '').replace(/,/g, '');

const toNumber = (value: string): number | null => {
  const parsed = Number(cleanCurrency(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeStakeType = (value: string): StakeType => {
  const v = normalize(value).toUpperCase();
  return v === 'FREE' ? 'FREE' : 'NORMAL';
};

const normalizeResult = (value: string): ResultType => {
  const v = normalize(value).toUpperCase();
  if (v === 'WIN' || v === 'WON') return 'WON';
  if (v === 'LOSS' || v === 'LOST') return 'LOST';
  if (v === 'CASHED OUT' || v === 'VOID' || v === 'CASHED_OUT') return 'VOID';
  return 'OPEN';
};

const normalizeBookmaker = (value: string): BookmakerType | null => {
  const v = normalize(value).toUpperCase().replace(/\s+/g, '');
  if (v === 'BET365') return 'Bet365';
  if (v === 'BETFAIR') return 'Betfair';
  if (v === 'BETUK') return 'BetUK';
  if (v === 'LADBROKES') return 'Ladbrokes';
  if (v === 'PADDYPOWER') return 'PaddyPower';
  if (v === 'SKYBET') return 'SkyBet';
  if (v === 'WILLIAMHILL') return 'WilliamHill';
  return null;
};

const inferBetType = (bet: string): string => {
  const v = normalize(bet).toLowerCase();
  if (
    v.includes('acca') ||
    v.includes('accumulator') ||
    v.includes(' x ') ||
    v.includes(' + ')
  ) {
    return 'Accumulator';
  }
  if (v === 'bb' || v.includes('bet builder') || v.includes('builder'))
    return 'Bet Builder';
  if (v === 'superboost') return 'Superboost';
  return 'Player Prop';
};

const inferPlayerPropMarket = (bet: string): string | null => {
  const v = normalize(bet).toLowerCase();
  if (v.includes('sot over') || (v.includes('o') && v.includes('sot')))
    return 'SOT Over';
  if (v.includes('sot under') || (v.includes('u') && v.includes('sot')))
    return 'SOT Under';
  if (v.includes('shots over') || (v.includes('o') && v.includes('shots')))
    return 'Shots Over';
  if (v.includes('shots under') || (v.includes('u') && v.includes('shots')))
    return 'Shots Under';
  if (v.includes('fouls committed')) return 'Fouls Committed Over';
  if (v.includes('fouls won')) return 'Fouls Won Over';
  if (v.includes('fouls') || v.includes('foul')) return 'Fouls Committed Over';
  if (v.includes('tackles')) return 'Tackles Over';
  if (v.includes('carded') || v.includes('to be carded')) return 'To Be Carded';
  if (v.includes('ags') || v.includes('anytime goalscorer')) return 'AGS';
  return null;
};

const calculateProfit = (
  stake: number,
  odds: number,
  result: ResultType,
  stakeType: StakeType,
  cashOutValue: number | null,
) => {
  if (result === 'WON') return stake * odds - stake;
  if (result === 'LOST') return stakeType === 'FREE' ? 0 : -stake;
  if (result === 'VOID')
    return cashOutValue == null ? null : cashOutValue - stake;
  return null;
};

const parseCsv = (csv: string): CsvRow[] => {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    return values.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
};

const getArgValue = (flag: string): string | null => {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
};

const dryRun = process.argv.includes('--dry-run');
const listUsers = process.argv.includes('--list-users');
const csvPathArg = getArgValue('--file') || 'imports/bets.csv';
const emailArg = getArgValue('--email');

const main = async () => {
  if (listUsers) {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true },
    });
    if (!users.length) {
      console.log('No users found.');
      return;
    }
    console.log('Available users:');
    for (const user of users) {
      console.log(`- ${user.email} (${user.name}) [${user.id}]`);
    }
    return;
  }

  const csvPath = path.resolve(process.cwd(), csvPathArg);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(content);

  if (!rows.length) {
    console.log('No rows found in CSV.');
    return;
  }

  for (const column of REQUIRED_COLUMNS) {
    if (!(column in rows[0])) {
      throw new Error(`Missing required column: ${column}`);
    }
  }

  let userId: string;
  if (emailArg) {
    const user = await prisma.user.findUnique({
      where: { email: emailArg.trim().toLowerCase() },
    });
    if (!user) throw new Error(`No user found for email: ${emailArg}`);
    userId = user.id;
  } else {
    const users = await prisma.user.findMany({
      take: 2,
      orderBy: { createdAt: 'asc' },
    });
    if (!users.length) {
      throw new Error(
        'No users exist. Create a user account first, then import with --email.',
      );
    }
    if (users.length > 1) {
      const knownEmails = users.map((user) => user.email).join(', ');
      throw new Error(
        `Multiple users found (${knownEmails}). Please pass --email <user-email> (or run --list-users).`,
      );
    }
    userId = users[0].id;
  }

  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2;
    const row = rows[i];

    const dateRaw = row['Date'];
    const fixture = normalize(row['Fixture']);
    const bookieRaw = row['Bookie'];
    const betRaw = normalize(row['Bet']);
    const stakeTypeRaw = row['Bet Type'];
    const stakeRaw = row['Stake (£)'];
    const oddsRaw = row['Odds'];
    const resultRaw = row['Result'];
    const cashOutRaw = row['Cash Out Value'];

    const placedAt = new Date(dateRaw);
    const bookmaker = normalizeBookmaker(bookieRaw);
    const stake = toNumber(stakeRaw);
    const odds = toNumber(oddsRaw);
    const stakeType = normalizeStakeType(stakeTypeRaw);
    const result = normalizeResult(resultRaw);
    const cashOutValue = result === 'VOID' ? toNumber(cashOutRaw) : null;

    if (!Number.isFinite(placedAt.getTime())) {
      errors.push(`Row ${rowNum}: invalid Date '${dateRaw}'`);
      continue;
    }
    if (!bookmaker) {
      errors.push(`Row ${rowNum}: unsupported Bookie '${bookieRaw}'`);
      continue;
    }
    if (!fixture) {
      errors.push(`Row ${rowNum}: empty Fixture`);
      continue;
    }
    if (!betRaw) {
      errors.push(`Row ${rowNum}: empty Bet`);
      continue;
    }
    if (stake == null || stake <= 0) {
      errors.push(`Row ${rowNum}: invalid Stake (£) '${stakeRaw}'`);
      continue;
    }
    if (odds == null || odds < 1) {
      errors.push(`Row ${rowNum}: invalid Odds '${oddsRaw}'`);
      continue;
    }

    const betType = inferBetType(betRaw);
    const playerPropMarket =
      betType === 'Player Prop' ? inferPlayerPropMarket(betRaw) : null;
    const potentialReturn = stake * odds;
    const profit = calculateProfit(
      stake,
      odds,
      result,
      stakeType,
      cashOutValue,
    );

    const normalizedSelection =
      betRaw.toLowerCase() === 'bb' ? 'Bet Builder' : betRaw;

    const data = {
      userId,
      fixture,
      selection: normalizedSelection,
      bookmaker,
      stakeType,
      betType,
      playerPropMarket,
      stake,
      odds,
      potentialReturn,
      result,
      cashOutValue,
      profit,
      placedAt: new Date(
        Date.UTC(
          placedAt.getUTCFullYear(),
          placedAt.getUTCMonth(),
          placedAt.getUTCDate(),
        ),
      ),
    };

    if (!dryRun) {
      await prisma.bet.create({ data: data as any });
    }

    imported += 1;
  }

  console.log(`Rows processed: ${rows.length}`);
  console.log(`Rows imported${dryRun ? ' (dry-run)' : ''}: ${imported}`);
  console.log(`Rows failed: ${errors.length}`);

  if (errors.length) {
    console.log('--- Errors ---');
    for (const error of errors.slice(0, 50)) {
      console.log(error);
    }
    if (errors.length > 50) {
      console.log(`...and ${errors.length - 50} more`);
    }
  }

  if (dryRun) {
    console.log('Dry-run complete. Re-run without --dry-run to write to DB.');
  }

  const unsupportedMarkets = new Set(
    rows
      .map((r) => normalize(r['Bet']))
      .filter(Boolean)
      .filter(
        (bet) =>
          inferBetType(bet) === 'Player Prop' && !inferPlayerPropMarket(bet),
      )
      .slice(0, 20),
  );

  if (unsupportedMarkets.size) {
    console.log(
      '--- Player Prop values without inferred market (first 20) ---',
    );
    for (const item of unsupportedMarkets) {
      console.log(item);
    }
    console.log(`Known markets: ${PLAYER_PROP_MARKETS.join(', ')}`);
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
