// Shared logic for combining a structured Market's Selection + Line pickers
// into a single dropdown when a market has both (e.g. "Total Goals" ->
// selections ["Over", "Under"] x lines [0.5, 1.5, 2.5, ...] becomes one
// "Over 0.5" / "Under 0.5" / "Over 1.5" / ... dropdown), purely for UX —
// selectionId and lineValue are still stored/submitted as two separate
// fields under the hood (see parseCombinedMarketOption below). Markets with
// no lines (Match Result, BTTS, Double Chance, etc.) are unaffected and
// keep their existing selection-only dropdown.
export type MarketSelectionOption = { id: number; label: string; sortOrder: number };
export type MarketLineOption = { id: number; value: string; sortOrder: number };
export type MarketLike = {
  selections: MarketSelectionOption[];
  lines: MarketLineOption[];
};

export type CombinedMarketOption = { value: string; label: string };

// True when a market's Selection and Line fields should be presented as one
// combined dropdown rather than two separate ones.
export const shouldCombineSelectionAndLine = (market: MarketLike | null | undefined): boolean =>
  Boolean(market && market.selections.length > 0 && market.lines.length > 0);

// Builds the combined dropdown's option list — selections in their existing
// sortOrder, with every line (ascending) nested under each selection, e.g.
// "Over 0.5", "Over 1.5", ..., "Under 0.5", "Under 1.5", ... Each option's
// `value` encodes both ids so the change handler can recover them without
// re-deriving anything from the label text.
export const buildCombinedMarketOptions = (market: MarketLike): CombinedMarketOption[] => {
  const options: CombinedMarketOption[] = [];
  for (const selection of market.selections) {
    for (const line of market.lines) {
      options.push({
        value: encodeCombinedMarketOption(selection.id, line.value),
        label: `${selection.label} ${line.value}`,
      });
    }
  }
  return options;
};

export const encodeCombinedMarketOption = (selectionId: number, lineValue: string | number): string =>
  `${selectionId}:${lineValue}`;

// Recovers { selectionId, lineValue } from a combined dropdown's selected
// value. Returns null if the value doesn't look like a valid combined pair
// (e.g. the placeholder "" option).
export const parseCombinedMarketOption = (
  value: string,
): { selectionId: number; lineValue: string } | null => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return null;
  const selectionId = Number(value.slice(0, separatorIndex));
  const lineValue = value.slice(separatorIndex + 1);
  if (!Number.isFinite(selectionId) || !lineValue) return null;
  return { selectionId, lineValue };
};

// Shared logic for grouping a Market list into <optgroup> sections by
// category (Match Markets / Player Markets), used anywhere a single Market
// <select> needs to offer both categories at once (currently only
// BetLegsEditor — AddBetModal/EditBetModal already scope their Market
// dropdown to one category up front based on the selected bet type).
export type MarketCategoryLike = { category: "MATCH" | "PLAYER" };

export type MarketCategoryGroup<T extends MarketCategoryLike> = {
  category: "MATCH" | "PLAYER";
  label: string;
  markets: T[];
};

const MARKET_CATEGORY_LABELS: Record<"MATCH" | "PLAYER", string> = {
  MATCH: "Match Markets",
  PLAYER: "Player Markets",
};

// Groups markets into <optgroup> sections, Match Markets first then Player
// Markets, omitting either group entirely if it has no markets to show.
export const groupMarketsByCategory = <T extends MarketCategoryLike>(
  markets: T[],
): MarketCategoryGroup<T>[] =>
  (["MATCH", "PLAYER"] as const)
    .map((category) => ({
      category,
      label: MARKET_CATEGORY_LABELS[category],
      markets: markets.filter((m) => m.category === category),
    }))
    .filter((group) => group.markets.length > 0);

// Player markets that should only ever offer players in a specific position
// — currently just Goalkeeper Saves, keyed by market name rather than a new
// schema field since it's a single market today. Extend this map if more
// position-scoped player markets are added later.
const POSITION_SCOPED_MARKETS: Record<string, string> = {
  "Goalkeeper Saves": "Goalkeeper",
};

export type PlayerPositionLike = { position?: string | null };
export type MarketNameLike = { name: string };

// Filters a fixture's player list down to the position required by the
// given market (e.g. only goalkeepers for "Goalkeeper Saves"). Markets with
// no position restriction — the vast majority — return the players list
// unchanged. Players with a missing/unset position are excluded once a
// restriction applies, since we can't confirm they're eligible.
export const filterPlayersForMarket = <T extends PlayerPositionLike>(
  players: T[],
  market: MarketNameLike | null | undefined,
): T[] => {
  const requiredPosition = market ? POSITION_SCOPED_MARKETS[market.name] : undefined;
  if (!requiredPosition) return players;
  return players.filter((player) => player.position === requiredPosition);
};

