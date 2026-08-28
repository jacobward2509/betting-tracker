import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';
import { fetchFixturesForDate } from '../src/services/thesportsdb';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const main = async () => {
  const today = toDateOnly(new Date());
  console.log(`Refreshing fixtures cache for ${today}...`);

  const fixtures = await fetchFixturesForDate(today);
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
          kickoffAt: fixture.kickoffAt,
          venue: fixture.venue,
        },
        update: {
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          kickoffAt: fixture.kickoffAt,
          venue: fixture.venue,
          fetchedAt: new Date(),
        },
      }),
    ),
  );

  // Prune fixtures that are no longer for today (e.g. yesterday's cached
  // rows, or postponed fixtures TheSportsDB has since removed) so the cache
  // only ever reflects the current day's fixtures.
  const fetchedIds = fixtures.map((fixture) => fixture.sportsDbEventId);
  const deleted = await prisma.fixture.deleteMany({
    where: { sportsDbEventId: { notIn: fetchedIds } },
  });

  console.log(`Upserted ${fixtures.length} fixtures, pruned ${deleted.count} stale rows.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
