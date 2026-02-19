-- Rename existing bet type column to stake type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Bet'
      AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Bet'
      AND column_name = 'stakeType'
  ) THEN
    ALTER TABLE "Bet" RENAME COLUMN "type" TO "stakeType";
  END IF;
END $$;

-- Rename enum type for stake type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BetType')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StakeType') THEN
    ALTER TYPE "BetType" RENAME TO "StakeType";
  END IF;
END $$;

-- Ensure expected default remains set
ALTER TABLE "Bet" ALTER COLUMN "stakeType" SET DEFAULT 'NORMAL';

-- Add new betting metadata columns
ALTER TABLE "Bet"
ADD COLUMN IF NOT EXISTS "betType" TEXT NOT NULL DEFAULT 'Player Prop',
ADD COLUMN IF NOT EXISTS "playerPropMarket" TEXT;

-- Create lookup table for bet types
CREATE TABLE IF NOT EXISTS "BetTypes" (
  "id" SERIAL PRIMARY KEY,
  "betTypes" TEXT NOT NULL UNIQUE
);

-- Create lookup table for player prop markets
CREATE TABLE IF NOT EXISTS "PlayerPropMarkets" (
  "id" SERIAL PRIMARY KEY,
  "markets" TEXT NOT NULL UNIQUE
);

-- Seed initial bet types
INSERT INTO "BetTypes" ("betTypes") VALUES
  ('Accumulator'),
  ('Bet Builder'),
  ('Player Prop')
ON CONFLICT ("betTypes") DO NOTHING;

-- Seed initial player prop markets
INSERT INTO "PlayerPropMarkets" ("markets") VALUES
  ('Shots Over'),
  ('Shots Under'),
  ('SOT Over'),
  ('SOT Under'),
  ('Fouls Committed Over'),
  ('Fouls Won Over'),
  ('Tackles Over'),
  ('To Be Carded'),
  ('AGS')
ON CONFLICT ("markets") DO NOTHING;
