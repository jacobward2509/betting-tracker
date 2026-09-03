export const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toOddsOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  const decimal = Number(text);
  if (Number.isFinite(decimal)) return decimal;

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!fraction) return null;

  const numerator = Number(fraction[1]);
  const denominator = Number(fraction[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  return numerator / denominator + 1;
};

export const normalizeResultValue = (value: unknown): 'OPEN' | 'WON' | 'LOST' | 'VOID' => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalized === 'WON' || normalized === 'WIN') return 'WON';
  if (normalized === 'LOST' || normalized === 'LOSS') return 'LOST';
  if (normalized === 'VOID' || normalized === 'CASHED_OUT' || normalized === 'CASHEDOUT') {
    return 'VOID';
  }
  return 'OPEN';
};

export const normalizeStakeTypeValue = (value: unknown): 'NORMAL' | 'FREE' | 'NORMAL_PLUS_FREE' => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/\+/g, '_PLUS_');

  if (normalized === 'FREE') return 'FREE';
  if (normalized === 'NORMAL_PLUS_FREE') return 'NORMAL_PLUS_FREE';
  return 'NORMAL';
};

export const calculateProfit = (input: {
  stake?: unknown;
  normalStake?: unknown;
  odds?: unknown;
  result?: unknown;
  stakeType?: unknown;
  cashOutValue?: unknown;
}): number | null => {
  const stake = toNumberOrNull(input.stake);
  const normalStakeInput = toNumberOrNull(input.normalStake);
  const odds = toOddsOrNull(input.odds);
  const cashOutValue = toNumberOrNull(input.cashOutValue);
  const result = String(input.result || '').toUpperCase();
  const stakeType = normalizeStakeTypeValue(input.stakeType);

  if (stake === null) return null;
  const effectiveStake =
    stakeType === 'FREE' ? 0 : stakeType === 'NORMAL_PLUS_FREE' ? Math.max(0, Math.min(normalStakeInput ?? stake, stake)) : stake;

  if (result === 'WON') {
    if (odds === null) return null;
    if (stakeType === 'NORMAL_PLUS_FREE') {
      // For mixed stake wins, free stake is not returned:
      // P/L = (total stake * odds) - total stake
      return stake * odds - stake;
    }
    return stake * odds - effectiveStake;
  }

  if (result === 'LOST') {
    return -effectiveStake;
  }

  if (result === 'VOID') {
    if (cashOutValue === null) return null;
    return cashOutValue - effectiveStake;
  }

  return null;
};

export const sanitizeUniqueStrings = (items: unknown[]): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
};
