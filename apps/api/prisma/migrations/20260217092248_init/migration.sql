/*
  Warnings:

  - You are about to drop the column `settledAt` on the `Bet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bet" DROP COLUMN "settledAt";

-- CreateTable
CREATE TABLE "Bookmakers" (
    "id" TEXT NOT NULL,
    "bookmakers" TEXT NOT NULL,

    CONSTRAINT "Bookmakers_pkey" PRIMARY KEY ("id")
);
