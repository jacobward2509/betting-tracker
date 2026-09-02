import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';
import { fetchFixturesForDateWithStats, fetchPlayersForTeam } from '../src/services/thesportsdb';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

// Add Bet only ever offers fixtures from today up to 7 days ahead, so that's
// the entire future window worth refreshing daily. Past dates are cached
// on-demand and permanently (see GET /api/fixtures in server.ts) — this
// script never touches them.
const FUTURE_WINDOW_DAYS = 8; // today + next 7 days inclusive

const main = async () => {
  const today = new Date();
  const dates = Array.from({ length: FUTURE_WINDOW_DAYS }, (_, i) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + i);
    return toDateOnly(date);
  });

  console.log(`Refreshing fixtures cache for ${dates[0]}..${dates[dates.length - 1]}...`);

  // Sequential (not Promise.all) — every call this makes into
  // fetchFixturesForDateWithStats goes through thesportsdb.ts's shared rate
  // limiter, which paces every request against TheSportsDB's global
  // 30/minute free-tier budget. Running the 8 dates sequentially (rather
  // than in parallel) keeps things simple and predictable; no artificial
  // extra delay between dates is needed since the limiter already enforces
  // the real constraint.
  const fixturesByDate: Array<Awaited<ReturnType<typeof fetchFixturesForDateWithStats>>> = [];
  for (const date of dates) {
    fixturesByDate.push(await fetchFixturesForDateWithStats(date));
  }
  const fixtures = fixturesByDate.flatMap((r) => r.fixtures);
  const totalFailedLeagues = fixturesByDate.reduce((sum, r) => sum + r.failedLeagues, 0);
  const totalLeagueCalls = fixturesByDate.reduce((sum, r) => sum + r.totalLeagues, 0);
  console.log(`Fetched ${fixtures.length} fixtures from TheSportsDB.`);

  await prisma.$transaction(
    fixtures.map((fixture) =>
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
          isHistorical: false,
        },
        update: {
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamSportsDbId: fixture.homeTeamSportsDbId,
          awayTeamSportsDbId: fixture.awayTeamSportsDbId,
          kickoffAt: fixture.kickoffAt,
          venue: fixture.venue,
          fetchedAt: new Date(),
        },
      }),
    ),
  );

  // Prune fixtures that are no longer within the future window (e.g.
  // postponed/rescheduled fixtures TheSportsDB has since removed) — but
  // never touch rows already marked historical (permanent records for
  // retrospective bet logging), and — critically — never prune at all if a
  // meaningful share of this run's upstream calls failed (e.g. TheSportsDB
  // rate-limiting/429s), since "not fetched this time" would otherwise be
  // wrongly treated as "no longer exists" and wipe out a perfectly valid
  // cache the next time a rate limit is hit.
  if (totalLeagueCalls > 0 && totalFailedLeagues / totalLeagueCalls > 0.2) {
    console.warn(
      `Skipping prune: ${totalFailedLeagues}/${totalLeagueCalls} upstream league calls failed this run ` +
        `(likely rate-limited) — leaving the existing future-window cache untouched.`,
    );
  } else {
    const fetchedIds = fixtures.map((fixture) => fixture.sportsDbEventId);
    const deleted = await prisma.fixture.deleteMany({
      where: { sportsDbEventId: { notIn: fetchedIds }, isHistorical: false },
    });
    console.log(`Upserted ${fixtures.length} fixtures, pruned ${deleted.count} stale rows.`);
  }

  // Refresh player rosters for every distinct team appearing in the
  // refreshed future window, so the Add Bet player dropdown always has
  // up-to-date squads for fixtures within the next 7 days.
  const teamIds = new Set<string>();
  for (const fixture of fixtures) {
    if (fixture.homeTeamSportsDbId) teamIds.add(fixture.homeTeamSportsDbId);
    if (fixture.awayTeamSportsDbId) teamIds.add(fixture.awayTeamSportsDbId);
  }

  console.log(`Refreshing rosters for ${teamIds.size} teams...`);
  let refreshedTeams = 0;
  for (const teamId of teamIds) {
    try {
      const fixtureForTeam = fixtures.find(
        (fixture) => fixture.homeTeamSportsDbId === teamId || fixture.awayTeamSportsDbId === teamId,
      );
      const teamName =
        fixtureForTeam?.homeTeamSportsDbId === teamId ? fixtureForTeam?.homeTeam : fixtureForTeam?.awayTeam;

      const players = await fetchPlayersForTeam(teamId);
      await prisma.$transaction(
        players.map((player) =>
          prisma.player.upsert({
            where: { sportsDbId: player.sportsDbId },
            create: {
              sportsDbId: player.sportsDbId,
              teamSportsDbId: player.teamSportsDbId,
              teamName: teamName || '',
              name: player.name,
              position: player.position,
            },
            update: {
              teamName: teamName || undefined,
              name: player.name,
              position: player.position,
              fetchedAt: new Date(),
            },
          }),
        ),
      );
      refreshedTeams += 1;
    } catch (error) {
      console.error(`Failed to refresh roster for team ${teamId}:`, error);
    }
  }
  console.log(`Refreshed rosters for ${refreshedTeams}/${teamIds.size} teams.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

