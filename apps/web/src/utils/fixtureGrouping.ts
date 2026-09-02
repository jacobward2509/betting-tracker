// Shared logic for grouping a Fixture list into <optgroup> sections by
// league, used by every fixture <select> across the app (AddBetModal,
// EditBetModal, BetLegsEditor). Extracted from what used to be identical
// copies of this logic living in AddBetModal.vue and EditBetModal.vue.
// League label formatting itself lives in @/utils/league (also used
// standalone by AnimatedFixturesBanner), reused here rather than duplicated.
import { formatLeagueLabel } from "@/utils/league";

export type FixtureLike = { id: string; league: string };

export type FixtureLeagueGroup<T extends FixtureLike> = {
  league: string;
  label: string;
  fixtures: T[];
};

// Priority order for grouping the Fixture dropdown by league — matches the
// `League` enum in apps/api/prisma/schema.prisma. Any league not explicitly
// listed here (EFL_CUP, FA_CUP, EUROPA_LEAGUE, CONFERENCE_LEAGUE) falls back
// to this same enum order, appended after the explicitly-prioritized leagues
// rather than being dropped from the dropdown.
export const LEAGUE_SORT_ORDER = [
  "PREMIER_LEAGUE",
  "CHAMPIONSHIP",
  "LA_LIGA",
  "BUNDESLIGA",
  "LIGUE_1",
  "SERIE_A",
  "CHAMPIONS_LEAGUE",
  "EFL_CUP",
  "FA_CUP",
  "EUROPA_LEAGUE",
  "CONFERENCE_LEAGUE",
];

export const leagueSortIndex = (league: string): number => {
  const index = LEAGUE_SORT_ORDER.indexOf(league);
  return index === -1 ? LEAGUE_SORT_ORDER.length : index;
};


// Groups fixtures into <optgroup> sections for a Fixture select, ordered by
// league priority (Premier League first, then Championship, La Liga,
// Bundesliga, Ligue 1, Serie A, Champions League, then any remaining tracked
// competitions), with fixtures within each league kept in their existing
// (typically kickoff-time-ascending) order from the input list.
export const groupFixturesByLeague = <T extends FixtureLike>(fixtures: T[]): FixtureLeagueGroup<T>[] => {
  const groups = new Map<string, T[]>();
  for (const fixture of fixtures) {
    const existing = groups.get(fixture.league);
    if (existing) {
      existing.push(fixture);
    } else {
      groups.set(fixture.league, [fixture]);
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => leagueSortIndex(a) - leagueSortIndex(b))
    .map(([league, leagueFixtures]) => ({
      league,
      label: formatLeagueLabel(league),
      fixtures: leagueFixtures,
    }));
};
