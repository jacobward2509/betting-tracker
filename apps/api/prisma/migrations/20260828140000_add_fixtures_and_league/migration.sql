-- CreateEnum
CREATE TYPE "League" AS ENUM ('PREMIER_LEAGUE', 'CHAMPIONSHIP', 'LA_LIGA', 'BUNDESLIGA', 'LIGUE_1', 'SERIE_A', 'EFL_CUP', 'FA_CUP', 'CHAMPIONS_LEAGUE', 'EUROPA_LEAGUE', 'CONFERENCE_LEAGUE');

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "sportsDbEventId" TEXT NOT NULL,
    "league" "League" NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_sportsDbEventId_key" ON "Fixture"("sportsDbEventId");

-- CreateIndex
CREATE INDEX "Fixture_kickoffAt_idx" ON "Fixture"("kickoffAt");

