// Human-readable labels for the League enum values returned by the API
// (see apps/api/prisma/schema.prisma). PREMIER_LEAGUE through
// CHAMPIONS_LEAGUE are the leagues we actively fetch/cache data for;
// EFL_CUP, FA_CUP, EUROPA_LEAGUE, and CONFERENCE_LEAGUE remain valid values
// in the underlying Postgres enum (for any historical Bet/Fixture rows
// already tagged with them, and for the Fixture dropdown's league-grouping
// in AddBetModal/EditBetModal/BetLegsEditor) even though they're no longer
// actively fetched going forward (see the exclusion note on
// LEAGUE_SPORTSDB_IDS in apps/api/src/services/thesportsdb.ts) — kept here
// so any of those older leagues still get a friendly label instead of
// falling back to the raw enum value.
const LEAGUE_LABELS: Record<string, string> = {
  PREMIER_LEAGUE: "Premier League",
  CHAMPIONSHIP: "Championship",
  LA_LIGA: "La Liga",
  BUNDESLIGA: "Bundesliga",
  LIGUE_1: "Ligue 1",
  SERIE_A: "Serie A",
  CHAMPIONS_LEAGUE: "Champions League",
  EFL_CUP: "EFL Cup",
  FA_CUP: "FA Cup",
  EUROPA_LEAGUE: "Europa League",
  CONFERENCE_LEAGUE: "Conference League",
};


export const formatLeagueLabel = (league: string): string => LEAGUE_LABELS[league] || league;

