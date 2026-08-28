// Wrapper around TheSportsDB's free public JSON API
// (https://www.thesportsdb.com/free_sports_api). The "3" API key below is
// TheSportsDB's published free/test key — it works without any account or
// registration and is intended for exactly this kind of hobby-scale, low
// volume usage (we only call it once per league per day via the fixtures
// refresh script/cron job, never on-demand from user requests).
import type { League } from '@prisma/client';

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '3';
const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}`;

// Competition IDs resolved via TheSportsDB's search_all_leagues.php /
// lookupleague.php endpoints. These are stable per-competition identifiers
// on TheSportsDB and don't change over time.
export const LEAGUE_SPORTSDB_IDS: Record<League, string> = {
  PREMIER_LEAGUE: '4328',
  CHAMPIONSHIP: '4329',
  LA_LIGA: '4335',
  BUNDESLIGA: '4331',
  LIGUE_1: '4334',
  SERIE_A: '4332',
  EFL_CUP: '4570',
  FA_CUP: '4482',
  CHAMPIONS_LEAGUE: '4480',
  EUROPA_LEAGUE: '4481',
  CONFERENCE_LEAGUE: '5071',
};

type SportsDbEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string | null;
  strTimeLocal: string | null;
  strTime: string | null;
  strVenue: string | null;
};

type EventsDayResponse = {
  events: SportsDbEvent[] | null;
};

// TheSportsDB's `strTime` field is UTC (matches `strTimestamp`), while
// `strTimeLocal` is local to the event's venue — we want UTC so it can be
// compared consistently regardless of where the user viewing the banner is.
const toKickoffDate = (event: SportsDbEvent): Date | null => {
  if (!event.dateEvent) return null;
  const time = event.strTime || event.strTimeLocal || '00:00:00';
  const parsed = new Date(`${event.dateEvent}T${time}Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export type NormalizedFixture = {
  sportsDbEventId: string;
  league: League;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  venue: string | null;
};

const fetchFixturesForLeagueAndDate = async (
  league: League,
  date: string,
): Promise<NormalizedFixture[]> => {
  const leagueId = LEAGUE_SPORTSDB_IDS[league];
  const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${encodeURIComponent(date)}&l=${leagueId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed (${response.status}) for league ${league}`);
  }

  const payload = (await response.json()) as EventsDayResponse;
  const events = payload.events || [];

  return events
    .map((event) => {
      const kickoffAt = toKickoffDate(event);
      if (!kickoffAt || !event.idEvent || !event.strHomeTeam || !event.strAwayTeam) {
        return null;
      }
      return {
        sportsDbEventId: event.idEvent,
        league,
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        kickoffAt,
        venue: event.strVenue || null,
      } satisfies NormalizedFixture;
    })
    .filter((fixture): fixture is NormalizedFixture => fixture !== null);
};

/**
 * Fetches fixtures for every tracked league/cup competition for the given
 * date (format: 'YYYY-MM-DD'). Calls TheSportsDB once per competition
 * (currently 11 calls), so this should only be invoked from a daily
 * scheduled refresh job/script — never from a request handler.
 */
export const fetchFixturesForDate = async (date: string): Promise<NormalizedFixture[]> => {
  const leagues = Object.keys(LEAGUE_SPORTSDB_IDS) as League[];
  const results: NormalizedFixture[] = [];

  for (const league of leagues) {
    try {
      const fixtures = await fetchFixturesForLeagueAndDate(league, date);
      results.push(...fixtures);
    } catch (error) {
      console.error(`Failed to fetch fixtures for ${league} on ${date}:`, error);
    }
  }

  return results;
};
