import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tables to wipe (and restart Int-based autoincrement sequences on).
// Bet/Session/User use UUID primary keys, so there's no sequence to restart —
// clearing the rows is the equivalent "start from scratch" action for them.
const TABLES_TO_RESET = ["Bet", "Session", "UserBookmaker", "UserPreference", "User"];

// Tables that must be preserved exactly as-is.
const TABLES_TO_PRESERVE = ["BetTypes", "Bookmakers", "PlayerPropMarkets"];

async function main() {
  console.log("Resetting tables:", TABLES_TO_RESET.join(", "));

  const quotedTables = TABLES_TO_RESET.map((t) => `"${t}"`).join(", ");

  // RESTART IDENTITY resets any Int autoincrement sequences (UserBookmaker,
  // UserPreference) back to 1. CASCADE handles FK relationships between the
  // listed tables safely. Tables not listed here (BetTypes, Bookmakers,
  // PlayerPropMarkets) are completely untouched.
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`
  );

  console.log("Reset complete. Row counts after reset:");

  for (const table of TABLES_TO_RESET) {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "${table}";`
    );
    console.log(`  ${table}: ${rows[0].count}`);
  }

  console.log("Preserved tables (unchanged):");

  for (const table of TABLES_TO_PRESERVE) {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "${table}";`
    );
    console.log(`  ${table}: ${rows[0].count}`);
  }
}

main()
  .catch((err) => {
    console.error("Failed to reset database:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
