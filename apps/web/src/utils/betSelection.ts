// Shared helper for condensing the flat `selection` string generated
// server-side (see `summarizeLegs()` in apps/api/src/server.ts) for
// multi-leg bet types -- Accumulator, Bet Builder and Cross Match Bet
// Builder. Every one of those three follows the same
// "<Label>: <leg1>, <leg2>, ..." shape (e.g.
// "5-fold Accumulator: Man City vs Chelsea (Over 2.5), Arsenal vs Spurs
// (BTTS Yes), ..."), so a single generic parser covers all three rather
// than needing a per-type implementation.
//
// Used to keep the Bets table's Description column (and the Edit Bet modal
// title) visually compact for bets with many legs, while still exposing the
// untouched full text via a tooltip (`title` attribute) so nothing is lost.
export const MULTI_LEG_BET_TYPES = new Set([
  "Accumulator",
  "Bet Builder",
  "Cross Match Bet Builder",
]);

export const isMultiLegBetType = (betType: unknown): boolean =>
  MULTI_LEG_BET_TYPES.has(String(betType || ""));

export type CondensedSelection = {
  /** Text to actually render -- shortened for multi-leg bets with more than `maxLegs` legs. */
  display: string;
  /** The untouched original string, always suitable for a `title` tooltip. */
  full: string;
  /** Whether `display` differs from `full` (i.e. some legs were collapsed). */
  isCondensed: boolean;
};

/**
 * Condenses a multi-leg bet's flat selection string down to its first
 * `maxLegs` legs plus a "+N more" suffix, leaving non-multi-leg bet types
 * (Player Prop, Match, etc.) and short accumulators/builders (at or under
 * `maxLegs` legs) completely untouched.
 */
export const getCondensedSelection = (
  betType: unknown,
  selection: unknown,
  maxLegs = 1,
): CondensedSelection => {
  const full = String(selection || "").trim();

  if (!isMultiLegBetType(betType) || !full) {
    return { display: full, full, isCondensed: false };
  }

  // Every multi-leg selection string is "<Label>: <leg1>, <leg2>, ..." --
  // split on the first ": " to separate the label from the leg list.
  const separatorIndex = full.indexOf(": ");
  if (separatorIndex === -1) {
    return { display: full, full, isCondensed: false };
  }

  const label = full.slice(0, separatorIndex);
  const legsText = full.slice(separatorIndex + 2);
  // Individual leg descriptions/fixture summaries never contain a literal
  // ", " themselves (see buildLegDescription()/summarizeLegs() in
  // server.ts), so splitting on it is safe.
  const legEntries = legsText.split(", ").filter(Boolean);

  if (legEntries.length <= maxLegs) {
    return { display: full, full, isCondensed: false };
  }

  const shown = legEntries.slice(0, maxLegs).join(", ");
  const remaining = legEntries.length - maxLegs;
  return {
    display: `${label}: ${shown} +${remaining} more`,
    full,
    isCondensed: true,
  };
};
