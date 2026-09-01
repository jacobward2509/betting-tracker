// Human-readable labels for the League enum values returned by the API
// (see apps/api/prisma/schema.prisma). Only the leagues we actively track
// and fetch data for are listed here — EFL_CUP, FA_CUP, EUROPA_LEAGUE, and
// CONFERENCE_LEAGUE remain valid values in the underlying Postgres enum
// (for any historical Bet/Fixture rows already tagged with them) but are no
// longer fetched/cached going forward (see the exclusion note on
// LEAGUE_SPORTSDB_IDS in apps/api/src/services/thesportsdb.ts), so there's
// no need for a friendly label for them here — formatLeagueLabel's fallback
// to the raw enum value covers that rare case.
const LEAGUE_LABELS: Record<string, string> = {
  PREMIER_LEAGUE: "Premier League",
  CHAMPIONSHIP: "Championship",
  LA_LIGA: "La Liga",
  BUNDESLIGA: "Bundesliga",
  LIGUE_1: "Ligue 1",
  SERIE_A: "Serie A",
  CHAMPIONS_LEAGUE: "Champions League",
};


export const formatLeagueLabel = (league: string): string => LEAGUE_LABELS[league] || league;
