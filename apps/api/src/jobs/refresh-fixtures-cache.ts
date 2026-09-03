import { prisma } from '../prisma';
import { fetchFixturesForDateWithStats } from '../services/thesportsdb';
import { MAX_FIXTURE_LOOKAHEAD_DAYS, toDateOnly } from '../lib/fixtures-cache';

export const FIXTURES_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const refreshFixturesCache = async () => {
  try {
    const today = new Date();
    const dates = Array.from({ length: MAX_FIXTURE_LOOKAHEAD_DAYS + 1 }, (_, i) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + i);
      return toDateOnly(date);
    });

    // Sequential (not Promise.all) — every call fetchFixturesForDateWithStats
    // makes goes through thesportsdb.ts's shared rate limiter, which paces
    // every request against TheSportsDB's global 30/minute free-tier
    // budget. No artificial extra delay between dates is needed since the
    // limiter already enforces the real constraint (see the same note in
    // scripts/refresh-fixtures.ts).
    const fixturesByDate: Array<Awaited<ReturnType<typeof fetchFixturesForDateWithStats>>> = [];
    for (const date of dates) {
      fixturesByDate.push(await fetchFixturesForDateWithStats(date));
    }
    const fixtures = fixturesByDate.flatMap((r) => r.fixtures);
    const totalFailedLeagues = fixturesByDate.reduce((sum, r) => sum + r.failedLeagues, 0);
    const totalLeagueCalls = fixturesByDate.reduce((sum, r) => sum + r.totalLeagues, 0);

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

    // Promote any fixture whose kickoff has already passed out of the
    // future window to isHistorical: true *before* pruning below. Without
    // this, a fixture created as isHistorical: false while it was still
    // "today" would still be isHistorical: false the next day once it's
    // fallen out of the today..+7 window TheSportsDB now returns for this
    // refresh -- and the notIn prune below would then delete it as if it
    // no longer existed, cascading (Fixture -> Bet.fixtureId / BetLeg,
    // both onDelete: Cascade or SetNull per schema.prisma) into wiping out
    // any bet/leg data logged against it. Promoting first guarantees every
    // past fixture is excluded from the isHistorical: false prune filter
    // and therefore preserved permanently, matching the "past-dated
    // fixtures are permanent records" contract described below.
    const startOfTodayUtc = new Date(`${toDateOnly(today)}T00:00:00Z`);
    await prisma.fixture.updateMany({
      where: { kickoffAt: { lt: startOfTodayUtc }, isHistorical: false },
      data: { isHistorical: true },
    });

    // Pruning only ever targets the future window (isHistorical: false) —
    // past-dated fixtures cached via the on-demand GET /api/fixtures path
    // (or just promoted above) are permanent records and must never be
    // deleted here. Also skip entirely if a meaningful share of this run's
    // upstream calls failed (e.g. rate-limited), since that would
    // otherwise wipe out a valid cache just because TheSportsDB
    // temporarily refused requests.
    if (totalLeagueCalls > 0 && totalFailedLeagues / totalLeagueCalls > 0.2) {
      console.warn(
        `Skipping fixtures prune: ${totalFailedLeagues}/${totalLeagueCalls} upstream league calls failed ` +
          `this run (likely rate-limited).`,
      );
    } else {
      const fetchedIds = fixtures.map((fixture) => fixture.sportsDbEventId);
      await prisma.fixture.deleteMany({
        where: { sportsDbEventId: { notIn: fetchedIds }, isHistorical: false },
      });
    }

    console.log(
      `Fixtures cache refreshed: ${fixtures.length} fixtures for ${dates[0]}..${dates[dates.length - 1]}.`,
    );
  } catch (error) {
    console.error('Failed to refresh fixtures cache:', error);
  }
};
