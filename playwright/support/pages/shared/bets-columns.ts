/**
 * Shared static data for the Bets table's columns — the desktop table
 * headers (`BetsTableComponent`) and the Columns menu checkboxes
 * (`BetsTableControlsComponent`) both need the same ordered column key list,
 * so it lives here rather than being duplicated across those two component
 * classes, per playwright-ui-test-generation.md §2's
 * `support/pages/shared/<data-name>.ts` convention.
 */
export const BETS_COLUMN_KEYS = [
  'date',
  'fixture',
  'bookie',
  'description',
  'stakeType',
  'stake',
  'odds',
  'result',
  'profitLoss',
] as const;

export type BetsColumnKey = (typeof BETS_COLUMN_KEYS)[number];

export const BETS_SORTABLE_COLUMN_KEYS = ['date', 'stake', 'odds', 'result', 'profit'] as const;

export type BetsSortableColumnKey = (typeof BETS_SORTABLE_COLUMN_KEYS)[number];

export const BETS_COLUMN_LABELS: Record<BetsColumnKey, string> = {
  date: 'Date',
  fixture: 'Fixture',
  bookie: 'Bookie',
  description: 'Description',
  stakeType: 'Stake Type',
  stake: 'Stake (£)',
  odds: 'Odds',
  result: 'Result',
  profitLoss: 'P/L',
};
