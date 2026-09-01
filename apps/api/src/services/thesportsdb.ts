// Wrapper around TheSportsDB's JSON API
// (https://www.thesportsdb.com/free_sports_api). THESPORTSDB_API_KEY defaults
// to "3", TheSportsDB's published free/test key, but should be set to a
// personal Premium/Business key in apps/api/.env for real usage — see the
// tier comparison below.
//
// Per-tier constraints (from TheSportsDB's own docs, confirmed live):
//   - Free ($0): 30 requests/minute. `eventsday.php` (fixtures) caps out at
//     3 events per call no matter what filters are applied. `lookup_all_players.php`
//     (rosters) and `lookup_all_teams.php` (team lists) both cap out at 10
//     results per call, with no working pagination — repeated/varied calls
//     never reveal more than the same first ~10 results.
//   - Premium/"Single Developer" ($9/mo): 100 requests/minute, and the above
//     per-call caps rise to 3000 (i.e. effectively unlimited for our
//     purposes — no fixture day or squad anywhere near approaches that).
//   - Business ($20/mo): 120 requests/minute, no cap on returned data at all.
//
// Whichever tier is active, every call in this file goes through the single
// shared rate limiter below, keeping us safely under whatever per-minute cap
// applies to the configured key, regardless of how many dates/leagues/teams
// are being fetched or how many callers (the daily refresh job, the on-demand
// past-date fill, the bulk backfill script, the on-demand player-roster
// reconciliation) are active. RATE_LIMIT_MAX_REQUESTS_PER_WINDOW is tuned for
// the free tier's 30/minute by default — bump it via THESPORTSDB_RATE_LIMIT_PER_MINUTE
// once on a paid key to take advantage of the higher ceiling.
import type { League } from '@prisma/client';

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '3';
const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}`;
// v2 is required for the "list teams in a league" endpoint (v1's
// lookup_all_teams.php 404s on a real Premium/Business key — v2's
// /list/teams/{leagueId} is the supported replacement) and uses header-based
// auth (X-API-KEY) rather than the key-in-URL-path style v1 uses.
const THESPORTSDB_V2_BASE_URL = 'https://www.thesportsdb.com/api/v2/json';


// Free tier's per-call result caps, confirmed live against the actual API —
// used only to detect a *suspected* truncated response (see
// isSuspectedTruncation below), so that reconciliation logic never wrongly
// deletes a good cache just because the configured key was temporarily
// downgraded back to the free tier (e.g. a premium subscription lapsing).
export const FREE_TIER_PLAYER_RESULT_CAP = 10;
export const FREE_TIER_TEAM_RESULT_CAP = 10;
export const FREE_TIER_FIXTURE_RESULT_CAP = 3;

// Defaults to the free tier's 30/minute; set THESPORTSDB_RATE_LIMIT_PER_MINUTE
// in the environment once a paid key is configured to use its higher ceiling
// (Premium: 100/minute, Business: 120/minute) — always a few requests under
// the actual documented limit to leave headroom for clock-alignment slop
// between our accounting and TheSportsDB's own minute window.
const RATE_LIMIT_MAX_REQUESTS_PER_WINDOW = Number(process.env.THESPORTSDB_RATE_LIMIT_PER_MINUTE) || 25;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Sliding-window rate limiter shared by every call this file makes to
// TheSportsDB, across all callers (fixtures refresh job, on-demand past-date
// fill, on-demand player-roster reconciliation) — the 30/minute budget is
// global to the API key, not per code path, so a single shared gate is the
// only way to actually guarantee we never breach it no matter what combination
// of callers happens to be running concurrently.
const requestTimestamps: number[] = [];

const waitForRateLimitSlot = async (): Promise<void> => {
  while (true) {
    const now = Date.now();
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] >= RATE_LIMIT_WINDOW_MS) {
      requestTimestamps.shift();
    }

    if (requestTimestamps.length < RATE_LIMIT_MAX_REQUESTS_PER_WINDOW) {
      requestTimestamps.push(now);
      return;
    }

    const oldest = requestTimestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 25;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
};

// Every TheSportsDB request in this file goes through here so the shared
// rate limiter above is the single source of truth for pacing calls — no
// call site should ever call `fetch` on a TheSportsDB URL directly. Also
// handles a 429 that slips through anyway (e.g. TheSportsDB's own clock not
// lining up exactly with ours) by waiting out a full window and retrying
// once, rather than surfacing it immediately as a hard failure. `init` is
// passed straight through to fetch() so v2 calls can supply the required
// X-API-KEY header (v1 calls bake the key into the URL instead and don't
// need this).
const rateLimitedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  await waitForRateLimitSlot();
  let response = await fetch(url, init);

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WINDOW_MS));
    await waitForRateLimitSlot();
    response = await fetch(url, init);
  }

  return response;
};

// Competition IDs resolved via TheSportsDB's search_all_leagues.php /
// lookupleague.php endpoints. These are stable per-competition identifiers
// on TheSportsDB and don't change over time.
//
// Intentionally excludes EFL_CUP, FA_CUP, EUROPA_LEAGUE, and
// CONFERENCE_LEAGUE even though they remain valid values in the Postgres
// League enum (see apps/api/prisma/schema.prisma) — those competitions pull
// in a huge number of small/non-league or foreign clubs with little to no
// betting relevance (e.g. FA_CUP alone drags in hundreds of English
// non-league sides, EUROPA_LEAGUE/CONFERENCE_LEAGUE drag in obscure clubs
// across dozens of countries), which was bloating the Player/Fixture cache
// with irrelevant data and burning API calls for no practical benefit.
// Leaving the enum values in place (rather than migrating them out of
// Postgres) means any historical Bet/Fixture rows already tagged with one
// of these leagues are left completely untouched — this is purely an
// "we no longer fetch new data for these" change, not a data-model change.
// Using Partial here (rather than Record<League, string>) is what lets us
// omit these 4 keys while keeping the type checker honest about the rest.
export const LEAGUE_SPORTSDB_IDS: Partial<Record<League, string>> = {
  PREMIER_LEAGUE: '4328',
  CHAMPIONSHIP: '4329',
  LA_LIGA: '4335',
  BUNDESLIGA: '4331',
  LIGUE_1: '4334',
  SERIE_A: '4332',
  CHAMPIONS_LEAGUE: '4480',
};

// The subset of the League enum we actually fetch/cache fixtures and
// rosters for — see the exclusion note on LEAGUE_SPORTSDB_IDS above. Derived
// from its keys so there is exactly one place (that object) that defines
// "which leagues are tracked."
export const TRACKED_LEAGUES = Object.keys(LEAGUE_SPORTSDB_IDS) as League[];


type SportsDbEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string | null;
  idAwayTeam: string | null;
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
  homeTeamSportsDbId: string | null;
  awayTeamSportsDbId: string | null;
  kickoffAt: Date;
  venue: string | null;
};

const fetchFixturesForLeagueAndDate = async (
  league: League,
  date: string,
): Promise<NormalizedFixture[]> => {
  const leagueId = LEAGUE_SPORTSDB_IDS[league];
  if (!leagueId) {
    throw new Error(`${league} is not a tracked league (missing from LEAGUE_SPORTSDB_IDS)`);
  }
  const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${encodeURIComponent(date)}&l=${leagueId}`;


  const response = await rateLimitedFetch(url);
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
        homeTeamSportsDbId: event.idHomeTeam || null,
        awayTeamSportsDbId: event.idAwayTeam || null,
        kickoffAt,
        venue: event.strVenue || null,
      } satisfies NormalizedFixture;
    })
    .filter((fixture): fixture is NormalizedFixture => fixture !== null);
};

/**
 * Fetches fixtures for every tracked league/cup competition for the given
 * date (format: 'YYYY-MM-DD'). Calls TheSportsDB once per tracked
 * competition (currently 7 — see the exclusion note on LEAGUE_SPORTSDB_IDS)
 * — necessary because `eventsday.php`'s free tier caps
 * results at 3 events per call regardless of filters, so the only way to
 * reliably get up to 3 fixtures per tracked competition is one call per
 * league. Every call goes through the shared rate limiter above, so this
 * can safely be invoked from the daily scheduled refresh job/script, or
 * on-demand for a single never-before-seen past date (see the on-demand
 * cache-fill path in server.ts's GET /api/fixtures) without risking a 429.
 */
export const fetchFixturesForDate = async (date: string): Promise<NormalizedFixture[]> => {
  const { fixtures } = await fetchFixturesForDateWithStats(date);
  return fixtures;
};


/**
 * Same as fetchFixturesForDate, but also reports how many of the tracked
 * competitions failed (e.g. due to TheSportsDB rate-limiting/429s) rather
 * than genuinely having no fixtures that day. Callers that prune the
 * Fixture cache based on "what wasn't fetched this time" (the daily
 * refresh job) must check failedLeagues before pruning — otherwise a
 * rate-limited run with 0 successful fetches would wipe out a perfectly
 * valid cache.
 */
export const fetchFixturesForDateWithStats = async (
  date: string,
): Promise<{ fixtures: NormalizedFixture[]; failedLeagues: number; totalLeagues: number }> => {
  const leagues = TRACKED_LEAGUES;
  const results: NormalizedFixture[] = [];
  let failedLeagues = 0;

  // No per-call delay needed here — the shared rate limiter inside
  // rateLimitedFetch (via fetchFixturesForLeagueAndDate) already paces every
  // request against TheSportsDB's global 30/minute free-tier budget, so
  // looping straight through the tracked leagues is safe.
  for (const league of leagues) {
    try {
      const fixtures = await fetchFixturesForLeagueAndDate(league, date);

      results.push(...fixtures);
    } catch (error) {
      failedLeagues += 1;
      console.error(`Failed to fetch fixtures for ${league} on ${date}:`, error);
    }
  }

  return { fixtures: results, failedLeagues, totalLeagues: leagues.length };
};


export type NormalizedTeam = {
  sportsDbId: string;
  name: string;
};

type SportsDbTeamV2 = {
  idTeam: string;
  strTeam: string;
};

type ListTeamsV2Response = {
  list: SportsDbTeamV2[] | null;
};

/**
 * Fetches every team in a tracked league/cup competition via v2's
 * /list/teams/{leagueId}. v1's lookup_all_teams.php is not usable here — it
 * 404s on a real Premium/Business key (confirmed live), so this is the one
 * call in this file that goes through TheSportsDB's v2 API instead of v1,
 * using header-based auth (X-API-KEY) rather than the key-in-URL-path v1
 * uses everywhere else. Free tier caps this at 10 teams per league (with no
 * working pagination), so this is really only useful for a complete
 * one-off/occasional bulk backfill (see scripts/backfill-all-players.ts)
 * while a Premium/Business key (3000/unlimited cap) is configured. Goes
 * through the same shared rate limiter as every other call in this file.
 */
export const fetchAllTeamsForLeague = async (league: League): Promise<NormalizedTeam[]> => {
  const leagueId = LEAGUE_SPORTSDB_IDS[league];
  if (!leagueId) {
    throw new Error(`${league} is not a tracked league (missing from LEAGUE_SPORTSDB_IDS)`);
  }
  const url = `${THESPORTSDB_V2_BASE_URL}/list/teams/${encodeURIComponent(leagueId)}`;


  const response = await rateLimitedFetch(url, { headers: { 'X-API-KEY': THESPORTSDB_API_KEY } });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new Error(
      `TheSportsDB v2 list/teams rejected the configured key (${response.status}) for league ${league} -- ` +
        'v2 requires a Premium/Business key, unlike the v1 endpoints used elsewhere in this file.',
    );
  }
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed (${response.status}) for league ${league} team list`);
  }

  const payload = (await response.json()) as ListTeamsV2Response;
  const teams = payload.list || [];

  return teams
    .map((team) => ({ sportsDbId: team.idTeam, name: team.strTeam }))
    .filter((team) => Boolean(team.sportsDbId && team.name));
};

/**
 * Heuristic used by every reconciliation path (GET /api/fixtures/:id/players,
 * the daily refresh job, the bulk backfill script) to decide whether a fetch
 * result is trustworthy enough to prune the cache against. If the configured
 * key ever reverts to the free tier (e.g. a Premium subscription lapsing)
 * while we already have a fuller roster cached, a fresh fetch would silently
 * come back truncated at FREE_TIER_PLAYER_RESULT_CAP results — reconciling
 * (deleting what's "missing") against that response would wrongly destroy an
 * otherwise-good cache. Treating "fetched exactly the free-tier cap size, but
 * we already have more cached than that" as a suspected truncation means we
 * still upsert whatever came back (so genuinely new players still get
 * added) but skip the delete step entirely for that team.
 */
export const isSuspectedPlayerTruncation = (fetchedCount: number, previouslyCachedCount: number): boolean =>
  fetchedCount === FREE_TIER_PLAYER_RESULT_CAP && previouslyCachedCount > FREE_TIER_PLAYER_RESULT_CAP;

type SportsDbPlayer = {
  idPlayer: string;
  idTeam: string;
  strPlayer: string;
  strPosition: string | null;
};

type LookupAllPlayersResponse = {
  player: SportsDbPlayer[] | null;
};

// Coaching staff / non-playing roles TheSportsDB includes in
// lookup_all_players.php but that are never relevant to a player prop bet.
const NON_PLAYER_POSITIONS = new Set([
  'coach',
  'assistant coach',
  'manager',
  'goalkeeping coach',
  'fitness coach',
]);

export type NormalizedPlayer = {
  sportsDbId: string;
  teamSportsDbId: string;
  name: string;
  position: string | null;
};

/**
 * Fetches the full roster for a single team by TheSportsDB team id. Called
 * from two places: the daily fixtures refresh job (scripts/refresh-fixtures.ts
 * and its inline copy in server.ts), which proactively caches rosters for
 * every team appearing in the next 7 days of fixtures, and on-demand from
 * GET /api/fixtures/:id/players whenever a fixture is selected in Add Bet —
 * that on-demand path reconciles (not just fills gaps in) the Player cache
 * for both of the fixture's teams every time, which is what keeps the cache
 * accurate for teams outside the refresh job's narrow window and handles
 * player transfers between tracked teams. Every call goes through the same
 * shared rate limiter as the fixtures calls above (rateLimitedFetch), since
 * the 30/minute free-tier budget is global to the API key rather than
 * per-endpoint — this is what keeps concurrent refresh-job + on-demand
 * roster calls from ever combining to breach the limit.
 */
export const fetchPlayersForTeam = async (teamSportsDbId: string): Promise<NormalizedPlayer[]> => {
  const url = `${THESPORTSDB_BASE_URL}/lookup_all_players.php?id=${encodeURIComponent(teamSportsDbId)}`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed (${response.status}) for team ${teamSportsDbId}`);
  }

  const payload = (await response.json()) as LookupAllPlayersResponse;
  const players = payload.player || [];

  return players
    .filter((player) => {
      const position = String(player.strPosition || '').trim().toLowerCase();
      return !NON_PLAYER_POSITIONS.has(position);
    })
    .map((player) => ({
      sportsDbId: player.idPlayer,
      teamSportsDbId: player.idTeam,
      name: player.strPlayer,
      position: player.strPosition || null,
    }))
    .filter((player) => Boolean(player.sportsDbId && player.name));
};

