-- CreateEnum
CREATE TYPE "Bookmaker" AS ENUM ('Bet365', 'Betfair', 'BetUK', 'Ladbrokes', 'Paddy Power', 'SkyBet', 'William Hill');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('NORMAL', 'FREE');

-- CreateEnum
CREATE TYPE "BetResult" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID');

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "fixture" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "bookmaker" "Bookmaker" NOT NULL DEFAULT 'Bet365',
    "type" "BetType" NOT NULL DEFAULT 'NORMAL',
    "stake" DECIMAL(65,30) NOT NULL,
    "odds" DECIMAL(65,30) NOT NULL,
    "potentialReturn" DECIMAL(65,30) NOT NULL,
    "result" "BetResult" NOT NULL DEFAULT 'OPEN',
    "profit" DECIMAL(65,30),
    "placedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);
