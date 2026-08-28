// Human-readable labels for the League enum values returned by the API
// (see apps/api/prisma/schema.prisma). Kept in sync with the 11 tracked
// competitions across the 6 domestic leagues + 5 cup competitions.
const LEAGUE_LABELS: Record<string, string> = {
  PREMIER_LEAGUE: "Premier League",
  CHAMPIONSHIP: "Championship",
  LA_LIGA: "La Liga",
  BUNDESLIGA: "Bundesliga",
  LIGUE_1: "Ligue 1",
  SERIE_A: "Serie A",
  EFL_CUP: "EFL Cup",
  FA_CUP: "FA Cup",
  CHAMPIONS_LEAGUE: "Champions League",
  EUROPA_LEAGUE: "Europa League",
  CONFERENCE_LEAGUE: "Conference League",
};

export const formatLeagueLabel = (league: string): string => LEAGUE_LABELS[league] || league;
