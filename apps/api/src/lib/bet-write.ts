import { calculateProfit, normalizeStakeTypeValue, toNumberOrNull, toOddsOrNull } from './bet-calculations';

// Sanitizes one of the single-fixture/market/selection fields shared by
// POST /api/bets and PUT /api/bets/:id. Multi-leg bet types never use these
// (detail lives entirely in `legs` instead), so they're always forced to
// `fallbackWhenAbsent` for those. For non-multi-leg types, an empty/falsy
// incoming value also falls back to `fallbackWhenAbsent` — on create that's
// always `null`; on update it's the field's existing stored value, so an
// omitted field doesn't clobber what's already saved.
export const sanitizeStructuredField = <T>(
  value: unknown,
  isMultiLeg: boolean,
  transform: (value: unknown) => T,
  fallbackWhenAbsent: T,
): T => (!isMultiLeg && value ? transform(value) : fallbackWhenAbsent);

// Same as sanitizeStructuredField, but for lineValue specifically, since 0 is
// a meaningful value there and must not be treated as falsy/absent the way
// the other structured fields are.
export const sanitizeLineValue = (
  value: unknown,
  isMultiLeg: boolean,
  fallbackWhenAbsent: number | null,
): number | null => {
  const hasValue = value !== null && value !== undefined && value !== '';
  return !isMultiLeg && hasValue ? toNumberOrNull(value) : fallbackWhenAbsent;
};

export type OddsStakeProfitResult =
  | { error: string }
  | {
      odds: number;
      oddsBoostPercent: number | null;
      normalStake: number | null;
      potentialReturn: number | null;
      profit: number | null;
    };

// Shared odds/stake validation + profit calculation used by both POST
// /api/bets and PUT /api/bets/:id. `record` only needs to carry the raw
// (already result/cashOutValue/stakeType-normalized) fields relevant here —
// calculateProfit() re-derives numeric stake/odds/normalStake from them
// itself, so it doesn't matter whether the caller passes its "data" object
// or a full "existing + incoming" merge, as long as those normalized fields
// are present on it.
export const computeOddsStakeAndProfit = (record: {
  stake?: unknown;
  normalStake?: unknown;
  odds?: unknown;
  oddsBoostPercent?: unknown;
  result?: unknown;
  stakeType?: unknown;
  cashOutValue?: unknown;
}): OddsStakeProfitResult => {
  const stake = toNumberOrNull(record.stake);
  const normalStakeInput = toNumberOrNull(record.normalStake);
  const odds = toOddsOrNull(record.odds);
  if (odds === null || odds < 1) {
    return { error: 'Invalid odds. Use decimal (e.g. 2.5) or fractional (e.g. 3/2).' };
  }

  const oddsBoostPercent = (() => {
    const boost = toNumberOrNull(record.oddsBoostPercent);
    return boost !== null && boost > 0 ? boost : null;
  })();

  const stakeType = normalizeStakeTypeValue(record.stakeType);
  let normalStake: number | null = null;
  if (stakeType === 'NORMAL_PLUS_FREE') {
    if (stake === null || normalStakeInput === null) {
      return { error: 'Normal stake is required when Stake Type is Normal + Free.' };
    }
    if (normalStakeInput < 0 || normalStakeInput > stake) {
      return { error: 'Normal stake must be between 0 and total stake.' };
    }
    normalStake = normalStakeInput;
  }

  const potentialReturn = stake !== null ? stake * odds : null;
  const profit = calculateProfit({ ...record, normalStake });

  return { odds, oddsBoostPercent, normalStake, potentialReturn, profit };
};
