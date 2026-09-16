// Human-readable labels for the League enum values returned by the API
// (see apps/api/prisma/schema.prisma). All 11 values are actively
// fetched/cached (see LEAGUE_SPORTSDB_IDS in
// apps/api/src/services/thesportsdb.ts) and used for the Fixture dropdown's
// league-grouping in AddBetModal/EditBetModal/BetLegsEditor.
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

