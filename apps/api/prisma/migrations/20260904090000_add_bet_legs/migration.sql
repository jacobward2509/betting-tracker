-- Adds per-leg detail for multi-leg bet types (Accumulator, Bet Builder,
-- Cross Match Bet Builder). BetLeg is purely additive — the existing Bet
-- table, and every historical row on it, is completely untouched. Every leg
-- is sourced exclusively from the structured catalog (Fixture / Market /
-- MarketSelection / Player) — no manual/free-text fallback, matching the
-- plan to remove manual entry entirely.
--
-- Also registers the new "Cross Match Bet Builder" bet type in the legacy
-- BetTypes lookup table, following the same ON CONFLICT DO NOTHING pattern
-- used by 20260902120000_deprecate_ft_result_add_match_bet_type.

-- CreateTable
CREATE TABLE "BetLeg" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fixtureId" TEXT NOT NULL,
    "marketId" INTEGER NOT NULL,
    "selectionId" INTEGER NOT NULL,
    "lineValue" DECIMAL(65,30),
    "playerId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetLeg_betId_idx" ON "BetLeg"("betId");

-- CreateIndex
CREATE INDEX "BetLeg_fixtureId_idx" ON "BetLeg"("fixtureId");

-- CreateIndex
CREATE INDEX "BetLeg_marketId_idx" ON "BetLeg"("marketId");

-- CreateIndex
CREATE INDEX "BetLeg_playerId_idx" ON "BetLeg"("playerId");

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "MarketSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "BetTypes" ("betTypes") VALUES
  ('Cross Match Bet Builder')
ON CONFLICT ("betTypes") DO NOTHING;
