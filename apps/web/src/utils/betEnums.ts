// Shared bet-result / stake-type label <-> API-value mappings, used by
// BetsView.vue's table/filter rendering and (for the API-value direction)
// AddBetModal/EditBetModal via useBetForm. Keeping every direction of this
// mapping in one place avoids the four call sites (BetsView's display
// labels, useBetForm's submit payload, and the reverse hydration mapping)
// silently drifting out of sync with each other or with the API's own
// normalizeResultValue()/normalizeStakeTypeValue() (apps/api/src/lib/bet-calculations.ts).

const normalizeResult = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

// Converts a raw API result value (or a loosely-cased variant of one) into
// the human-facing label used throughout the Bets table/filters.
export const getResultLabel = (result: unknown): "Open" | "Win" | "Loss" | "Cashed Out" => {
  const normalized = normalizeResult(result);
  if (normalized === "WON" || normalized === "WIN") return "Win";
  if (normalized === "LOST" || normalized === "LOSS") return "Loss";
  if (normalized === "CASHED_OUT" || normalized === "CASHEDOUT" || normalized === "VOID") {
    return "Cashed Out";
  }
  return "Open";
};

const normalizeStakeType = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

// Converts a raw API stakeType value into the human-facing label used
// throughout the Bets table/filters.
export const getStakeTypeLabel = (stakeType: unknown): "Normal" | "Free" | "Normal + Free" => {
  const normalized = normalizeStakeType(stakeType);
  if (normalized === "FREE") return "Free";
  if (normalized === "NORMAL_PLUS_FREE") return "Normal + Free";
  return "Normal";
};
