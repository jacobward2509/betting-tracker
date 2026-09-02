-- Rebuild the Bookmaker catalog from scratch with a curated, industry-led
-- list of 23 UK-facing bookmakers (up from the original personal list of 7).
--
-- Postgres won't let us DROP an enum type that's still referenced by columns,
-- so every column typed "Bookmaker" is first converted to TEXT (preserving
-- its current value), the old enum is dropped and recreated with the full
-- new value set, then each column is converted back. Because every one of
-- the original 7 names is being kept (just re-declared as plain, no-space
-- identifiers with no @map(...) needed), the UPDATEs below map the two
-- previously space-mapped labels ('Paddy Power' -> 'PaddyPower', 'William
-- Hill' -> 'WilliamHill') onto their new token form. No historical
-- Bet/UserBookmaker/UserPreference row is dropped or altered in value — this
-- is purely a schema-shape refresh. The "Bookmakers" lookup table's own
-- "bookmakers" column is also typed as the "Bookmaker" enum on the live
-- database (despite the original 20260217092248_init migration file having
-- created it as plain TEXT — it was migrated to the enum type out-of-band
-- since), so it is converted here too, then reseeded from scratch.

-- Step 1: Every column typed "Bookmaker" -> TEXT.
ALTER TABLE "Bet" ALTER COLUMN "bookmaker" DROP DEFAULT;
ALTER TABLE "Bet" ALTER COLUMN "bookmaker" TYPE TEXT USING "bookmaker"::TEXT;
ALTER TABLE "UserBookmaker" ALTER COLUMN "bookmaker" TYPE TEXT USING "bookmaker"::TEXT;
ALTER TABLE "UserPreference" ALTER COLUMN "defaultBookmaker" TYPE TEXT USING "defaultBookmaker"::TEXT;
ALTER TABLE "Bookmakers" ALTER COLUMN "bookmakers" TYPE TEXT USING "bookmakers"::TEXT;

-- Step 2: Translate the two previously space-mapped legacy values to their
-- new no-space token form before recreating the enum.
UPDATE "Bet" SET "bookmaker" = 'PaddyPower' WHERE "bookmaker" = 'Paddy Power';
UPDATE "Bet" SET "bookmaker" = 'WilliamHill' WHERE "bookmaker" = 'William Hill';
UPDATE "UserBookmaker" SET "bookmaker" = 'PaddyPower' WHERE "bookmaker" = 'Paddy Power';
UPDATE "UserBookmaker" SET "bookmaker" = 'WilliamHill' WHERE "bookmaker" = 'William Hill';
UPDATE "UserPreference" SET "defaultBookmaker" = 'PaddyPower' WHERE "defaultBookmaker" = 'Paddy Power';
UPDATE "UserPreference" SET "defaultBookmaker" = 'WilliamHill' WHERE "defaultBookmaker" = 'William Hill';

-- Step 3: Drop and recreate the Bookmaker enum with the full curated list.
DROP TYPE "Bookmaker";
CREATE TYPE "Bookmaker" AS ENUM (
  'Bet365',
  'Betfair',
  'BetUK',
  'Ladbrokes',
  'PaddyPower',
  'SkyBet',
  'WilliamHill',
  'Coral',
  'BetVictor',
  'Betfred',
  'EightEightEightSport',
  'Unibet',
  'LiveScoreBet',
  'BoyleSports',
  'VirginBet',
  'Betway',
  'ThirtyTwoRed',
  'GrosvenorSport',
  'QuinnBet',
  'Spreadex',
  'MansionBet',
  'StarSports',
  'CasumoBet'
);

-- Step 4: Convert the columns back to the new enum type.
ALTER TABLE "Bet" ALTER COLUMN "bookmaker" TYPE "Bookmaker" USING "bookmaker"::"Bookmaker";
ALTER TABLE "Bet" ALTER COLUMN "bookmaker" SET DEFAULT 'Bet365';
ALTER TABLE "UserBookmaker" ALTER COLUMN "bookmaker" TYPE "Bookmaker" USING "bookmaker"::"Bookmaker";
ALTER TABLE "UserPreference" ALTER COLUMN "defaultBookmaker" TYPE "Bookmaker" USING "defaultBookmaker"::"Bookmaker";

-- Step 5: Reseed the Bookmakers lookup table from scratch with the full
-- curated list (delete-all + insert rather than an in-place edit, then
-- convert the column back to the enum type, per "start fresh" rather than
-- "alter what's there").
DELETE FROM "Bookmakers";
ALTER TABLE "Bookmakers" ALTER COLUMN "bookmakers" TYPE "Bookmaker" USING "bookmakers"::"Bookmaker";

INSERT INTO "Bookmakers" ("bookmakers") VALUES
  ('Bet365'),
  ('Betfair'),
  ('BetUK'),
  ('Ladbrokes'),
  ('PaddyPower'),
  ('SkyBet'),
  ('WilliamHill'),
  ('Coral'),
  ('BetVictor'),
  ('Betfred'),
  ('EightEightEightSport'),
  ('Unibet'),
  ('LiveScoreBet'),
  ('BoyleSports'),
  ('VirginBet'),
  ('Betway'),
  ('ThirtyTwoRed'),
  ('GrosvenorSport'),
  ('QuinnBet'),
  ('Spreadex'),
  ('MansionBet'),
  ('StarSports'),
  ('CasumoBet');
