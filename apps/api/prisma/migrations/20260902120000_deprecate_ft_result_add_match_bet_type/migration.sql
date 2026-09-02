-- Deprecates the standalone "FT Result" bet type now that Match Result is
-- available as a proper structured market under the new "Match" bet type
-- (category = MATCH on the Market table), and adds "Match" itself as a
-- selectable bet type. Existing Bet rows with betType = 'FT Result' are left
-- completely untouched (that column is a plain string with no FK), so no
-- historical data is affected — this only stops "FT Result" being offered as
-- a choice for new bets going forward.
INSERT INTO "BetTypes" ("betTypes") VALUES
  ('Match')
ON CONFLICT ("betTypes") DO NOTHING;

DELETE FROM "BetTypes" WHERE "betTypes" = 'FT Result';
