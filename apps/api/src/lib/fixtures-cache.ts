import { prisma } from '../prisma';
import {
  fetchFixturesForDate,
  fetchPlayersForTeam,
  isSuspectedPlayerTruncation,
} from '../services/thesportsdb';

export const MAX_FIXTURE_LOOKAHEAD_DAYS = 7;

// Widest span (inclusive, in days) allowed between `from` and `to` when using
// the range form of GET /api/fixtures — bounds how many on-demand
// TheSportsDB cache-fill calls a single request can trigger for past dates.
export const MAX_FIXTURE_RANGE_DAYS = 14;

// How long a team's cached roster is trusted before the on-demand
// reconciliation in GET /api/fixtures/:id/players bothers making a live
// TheSportsDB call for it again. Rosters rarely change intra-day, so
// skipping the live call entirely for a still-fresh cache avoids paying its
// cost (a rate-limited round trip per team, ~2-5s combined for both teams)
// on every single Edit/Add Bet fixture selection -- the common case once a
// team has been fetched at all.
export const PLAYER_CACHE_FRESHNESS_MS = 12 * 60 * 60 * 1000; // 12 hours

export const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export const parseDateOnly = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

// On-demand cache fill for a single past date we've never seen before —
// future dates are always covered by the daily refresh job, so this is the
// only path that ever hits TheSportsDB live from a request handler, and only
// for genuinely new historical lookups. Shared by both the single-`date` and
// `from`/`to` range forms of GET /api/fixtures.
export const ensurePastDateCached = async (requestedDate: Date): Promise<void> => {
  const dateString = toDateOnly(requestedDate);
  const fetched = await fetchFixturesForDate(dateString);
  if (fetched.length === 0) return;

  await prisma.$transaction(
    fetched.map((fixture) =>
      prisma.fixture.upsert({
        where: { sportsDbEventId: fixture.sportsDbEventId },
        create: {
          sportsDbEventId: fixture.sportsDbEventId,
          league: fixture.league,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamSportsDbId: fixture.homeTeamSportsDbId,
          awayTeamSportsDbId: fixture.awayTeamSportsDbId,
          kickoffAt: fixture.kickoffAt,
          venue: fixture.venue,
          isHistorical: true,
        },
        update: {
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamSportsDbId: fixture.homeTeamSportsDbId,
          awayTeamSportsDbId: fixture.awayTeamSportsDbId,
          kickoffAt: fixture.kickoffAt,
          venue: fixture.venue,
          isHistorical: true,
          fetchedAt: new Date(),
        },
      }),
    ),
  );
};

// Reconciles a single team's Player cache against a fresh live TheSportsDB
// fetch, run in the background (fire-and-forget) after GET
// /api/fixtures/:id/players has already responded with the cache as-is --
// see routes/fixtures.ts for why this is deliberately non-blocking. `cached`
// is the pre-fetch snapshot for this team, used both as the fallback on
// error and to detect a suspected truncated response.
//
// Reconciliation per team (whenever the cache isn't fresh enough to skip it):
//   - Upsert every player TheSportsDB currently returns for the team, keyed
//     by their globally-unique sportsDbId. If a player has moved from
//     another team we already had them cached under, this upsert naturally
//     re-points their teamSportsDbId/teamName to the new team.
//   - Delete any Player row still pointing at this team that TheSportsDB no
//     longer lists on that team's roster -- this is what removes a player
//     from their old team once they have moved on (their row either gets
//     recreated under the new team by that team's own upsert above/below,
//     or simply disappears if they left a tracked team's squad entirely).
//     Bet.playerId references SetNull on delete, so historical bets
//     referencing a removed player are preserved, just unlinked.
//   - If the upstream fetch for a team fails (network error, rate limit) or
//     returns zero players, we skip both the upsert and the prune for that
//     team and fall back to whatever is already cached -- a transient
//     failure must never be allowed to wipe out a previously good cache.
//   - If the fetch returns exactly the free tier's known cap size while we
//     already have a fuller roster cached (isSuspectedPlayerTruncation),
//     we still upsert what came back but skip the delete step -- this
//     guards against a configured key reverting to the free tier (e.g. a
//     Premium subscription lapsing) silently pruning a good cache down to
//     10 players just because that's all a truncated response contained.
export const reconcilePlayersForTeamInBackground = async (
  teamId: string,
  teamName: string,
  cached: Awaited<ReturnType<typeof prisma.player.findMany>>,
): Promise<void> => {
  try {
    const fetched = await fetchPlayersForTeam(teamId);
    if (fetched.length === 0) return;

    const fetchedIds = fetched.map((player) => player.sportsDbId);
    const suspectedTruncation = isSuspectedPlayerTruncation(fetched.length, cached.length);

    const operations: Array<ReturnType<typeof prisma.player.upsert> | ReturnType<typeof prisma.player.deleteMany>> = [
      ...fetched.map((player) =>
        prisma.player.upsert({
          where: { sportsDbId: player.sportsDbId },
          create: {
            sportsDbId: player.sportsDbId,
            teamSportsDbId: player.teamSportsDbId,
            teamName,
            name: player.name,
            position: player.position,
          },
          update: {
            teamSportsDbId: player.teamSportsDbId,
            teamName,
            name: player.name,
            position: player.position,
            fetchedAt: new Date(),
          },
        }),
      ),
    ];

    if (!suspectedTruncation) {
      // Remove players no longer on this team's roster (retired, left the
      // club, or moved to another team -- TheSportsDB simply won't list
      // them here anymore). If they moved to the fixture's other team,
      // that team's own upsert re-adds them there.
      operations.push(
        prisma.player.deleteMany({
          where: { teamSportsDbId: teamId, sportsDbId: { notIn: fetchedIds } },
        }),
      );
    } else {
      console.warn(
        `Suspected truncated roster fetch for team ${teamId} (got ${fetched.length}, had ` +
          `${cached.length} cached) -- skipping prune to avoid destroying a fuller cache.`,
      );
    }

    await prisma.$transaction(operations);
  } catch (error) {
    console.error(`Failed to refresh roster for team ${teamId}:`, error);
  }
};

