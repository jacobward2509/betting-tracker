INSERT INTO "BetTypes" ("betTypes") VALUES
  ('Superboost'),
  ('FT Result'),
  ('Other')
ON CONFLICT ("betTypes") DO NOTHING;
