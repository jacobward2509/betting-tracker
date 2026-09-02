-- Adds an optional odds-boost percentage to a bet. When set, the `odds`
-- column already stores the *boosted* decimal odds (consistent with how
-- potentialReturn/profit are always derived from the stored odds) -- this
-- column exists purely so the Add/Edit Bet UI can redisplay the original
-- (pre-boost) odds and the boost percentage the user entered when editing a
-- previously-boosted bet. Purely additive -- existing rows are untouched
-- and simply have oddsBoostPercent = NULL (no boost applied).
ALTER TABLE "Bet"
ADD COLUMN IF NOT EXISTS "oddsBoostPercent" DECIMAL(65,30);
