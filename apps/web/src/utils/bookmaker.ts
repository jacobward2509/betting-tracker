export const formatBookmakerLabel = (value: string): string => {
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "");

  if (normalized === "PADDYPOWER") return "Paddy Power";
  if (normalized === "WILLIAMHILL") return "William Hill";
  return raw;
};

