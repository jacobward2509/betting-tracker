export const formatBookmakerLabel = (value: string): string => {
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "");

  // Multi-word / stylized display labels for bookmaker tokens that are
  // stored as plain, no-space Prisma enum values (see the `Bookmaker` enum
  // in apps/api/prisma/schema.prisma) — this is the sole place spacing/casing
  // is reintroduced for display, so the database/API layer never needs
  // @map(...) directives.
  if (normalized === "PADDYPOWER") return "Paddy Power";
  if (normalized === "WILLIAMHILL") return "William Hill";
  if (normalized === "SKYBET") return "Sky Bet";
  if (normalized === "LIVESCOREBET") return "LiveScore Bet";
  if (normalized === "BOYLESPORTS") return "BoyleSports";
  if (normalized === "VIRGINBET") return "Virgin Bet";
  if (normalized === "THIRTYTWORED") return "32Red";
  if (normalized === "GROSVENORSPORT") return "Grosvenor Sport";
  if (normalized === "QUINNBET") return "QuinnBet";
  if (normalized === "MANSIONBET") return "MansionBet";
  if (normalized === "STARSPORTS") return "Star Sports";
  if (normalized === "CASUMOBET") return "Casumo Bet";
  if (normalized === "EIGHTEIGHTEIGHTSPORT") return "888sport";
  return raw;
};


