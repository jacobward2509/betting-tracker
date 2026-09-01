-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('MATCH', 'PLAYER');

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "fixtureId" TEXT,
ADD COLUMN     "lineValue" DECIMAL(65,30),
ADD COLUMN     "marketId" INTEGER,
ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "selectionId" INTEGER;

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "awayTeamSportsDbId" TEXT,
ADD COLUMN     "homeTeamSportsDbId" TEXT,
ADD COLUMN     "isHistorical" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Market" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MarketCategory" NOT NULL,
    "requiresPlayer" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSelection" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketLine" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sportsDbId" TEXT NOT NULL,
    "teamSportsDbId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSelection_marketId_label_key" ON "MarketSelection"("marketId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "MarketLine_marketId_value_key" ON "MarketLine"("marketId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sportsDbId_key" ON "Player"("sportsDbId");

-- CreateIndex
CREATE INDEX "Player_teamSportsDbId_idx" ON "Player"("teamSportsDbId");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "Bet_fixtureId_idx" ON "Bet"("fixtureId");

-- CreateIndex
CREATE INDEX "Bet_playerId_idx" ON "Bet"("playerId");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "MarketSelection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSelection" ADD CONSTRAINT "MarketSelection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketLine" ADD CONSTRAINT "MarketLine_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

