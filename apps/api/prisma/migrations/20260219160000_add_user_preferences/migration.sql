CREATE TABLE IF NOT EXISTS "UserBookmaker" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "bookmaker" "Bookmaker" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBookmaker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserPreference" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "defaultBookmaker" "Bookmaker",
  "defaultBetType" TEXT,
  "defaultStake" DECIMAL(65,30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserBookmaker_userId_idx" ON "UserBookmaker"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserBookmaker_userId_bookmaker_key" ON "UserBookmaker"("userId", "bookmaker");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_userId_key" ON "UserPreference"("userId");

ALTER TABLE "UserBookmaker"
  ADD CONSTRAINT "UserBookmaker_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "set_user_preference_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_user_preference_updated_at" ON "UserPreference";
CREATE TRIGGER "trg_user_preference_updated_at"
BEFORE UPDATE ON "UserPreference"
FOR EACH ROW
EXECUTE FUNCTION "set_user_preference_updated_at"();
