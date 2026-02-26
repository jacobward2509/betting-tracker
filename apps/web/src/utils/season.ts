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
