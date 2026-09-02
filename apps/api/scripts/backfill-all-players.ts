import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';
import { fetchAllTeamsForLeague, fetchPlayersForTeam, isSuspectedPlayerTruncation, TRACKED_LEAGUES } from '../src/services/thesportsdb';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// One-off/occasional bulk backfill: walks every tracked league (see
// TRACKED_LEAGUES / the exclusion note on LEAGUE_SPORTSDB_IDS in
// thesportsdb.ts — EFL_CUP, FA_CUP, EUROPA_LEAGUE, and CONFERENCE_LEAGUE are
// deliberately excluded), fetches every team in that league, then fetches
// and caches every team's full roster. Only useful while a Premium/Business
// TheSportsDB key is configured (THESPORTSDB_API_KEY in apps/api/.env) — on
// the free tier, list/teams and lookup_all_players.php both silently cap
// out at 10 results per call, so running this against a free key would only
// ever cache the first ~10 teams per league and the first ~10 players per
// team.
//
// Run manually with: `npm run backfill:players` (see apps/api/package.json).
// Safe to re-run any time the key is on a paid tier — reconciliation below
// uses the same isSuspectedPlayerTruncation guard as the on-demand path in
// server.ts, so if the key ever reverts to free tier mid-run (or a run is
// kicked off against a lapsed subscription by mistake), it will still only
// add players, never wrongly prune an existing fuller cache down to 10.
const main = async () => {
  const leagues = TRACKED_LEAGUES;


  let totalTeams = 0;
  let totalPlayersUpserted = 0;
  let teamsSkippedTruncation = 0;

  for (const league of leagues) {
    console.log(`\nFetching teams for ${league}...`);
    let teams: Array<{ sportsDbId: string; name: string }> = [];
    try {
      teams = await fetchAllTeamsForLeague(league);
    } catch (error) {
      console.error(`Failed to fetch team list for ${league}:`, error);
      continue;
    }

    console.log(`  ${teams.length} teams found for ${league}.`);
    totalTeams += teams.length;

    for (const team of teams) {
      try {
        const cached = await prisma.player.findMany({
          where: { teamSportsDbId: team.sportsDbId },
          select: { sportsDbId: true },
        });

        const fetched = await fetchPlayersForTeam(team.sportsDbId);
        if (fetched.length === 0) {
          console.warn(`  ${team.name}: 0 players returned, leaving existing cache untouched.`);
          continue;
        }

        const suspectedTruncation = isSuspectedPlayerTruncation(fetched.length, cached.length);
        const fetchedIds = fetched.map((player) => player.sportsDbId);

        const operations: Array<ReturnType<typeof prisma.player.upsert> | ReturnType<typeof prisma.player.deleteMany>> =
          fetched.map((player) =>
          prisma.player.upsert({
            where: { sportsDbId: player.sportsDbId },
            create: {
              sportsDbId: player.sportsDbId,
              teamSportsDbId: player.teamSportsDbId,
              teamName: team.name,
              name: player.name,
              position: player.position,
            },
            update: {
              teamSportsDbId: player.teamSportsDbId,
              teamName: team.name,
              name: player.name,
              position: player.position,
              fetchedAt: new Date(),
            },
          }),
        );

        if (suspectedTruncation) {
          teamsSkippedTruncation += 1;
          console.warn(
            `  ${team.name}: suspected truncated fetch (got ${fetched.length}, had ${cached.length} ` +
              `cached) -- upserting new players but skipping prune.`,
          );
        } else {
          operations.push(
            prisma.player.deleteMany({
              where: { teamSportsDbId: team.sportsDbId, sportsDbId: { notIn: fetchedIds } },
            }),
          );
        }

        await prisma.$transaction(operations);
        totalPlayersUpserted += fetched.length;
        console.log(`  ${team.name}: cached ${fetched.length} players.`);
      } catch (error) {
        console.error(`  Failed to backfill roster for ${team.name} (${team.sportsDbId}):`, error);
      }
    }
  }

  console.log(
    `\nDone. ${totalTeams} teams processed across ${leagues.length} leagues, ` +
      `${totalPlayersUpserted} player upserts, ${teamsSkippedTruncation} teams skipped pruning ` +
      `due to suspected truncation.`,
  );
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
