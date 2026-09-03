export const SELECTED_SEASON_STORAGE_KEY = "selected-football-season";

export const getSeasonKeyFromDate = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = Jan, 7 = Aug
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

export const getCurrentSeasonKey = (): string => getSeasonKeyFromDate(new Date());

export const getSeasonLabel = (seasonKey: string): string => {
  const [start, end] = String(seasonKey || "").split("-");
  if (!start || !end) return seasonKey;
  return `${start}/${String(end).slice(-2)}`;
};

// Inverse of getSeasonLabel — recovers a "YYYY-YYYY" season key from either
// that same key (passed through unchanged) or a display label like
// "2025/26". Used to compare a persisted/selected season label against
// bets' own season keys (derived via getSeasonKeyFromDate) when filtering.
// Returns "" for anything that doesn't look like either shape.
export const getSeasonKeyFromLabel = (label: string): string => {
  const trimmed = String(label || "").trim();
  const keyMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (keyMatch) return `${keyMatch[1]}-${keyMatch[2]}`;
  const labelMatch = trimmed.match(/^(\d{4})\s*\/\s*(\d{2})$/);
  if (!labelMatch) return "";
  const startYear = Number(labelMatch[1]);
  return `${startYear}-${startYear + 1}`;
};

