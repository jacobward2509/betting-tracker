export const parseFixtureTeams = (fixture: unknown): string[] => {
  const raw = String(fixture || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s+vs\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  return [parts[0], parts[1]];
};

export const parsePlayerFromSelection = (selection: unknown, market: unknown): string => {
  const text = String(selection || '')
    .trim()
    .replace(/\s+/g, ' ');
  const normalizedMarket = String(market || '').trim();
  if (!text) return '';

  if (normalizedMarket) {
    const idx = text.toLowerCase().indexOf(normalizedMarket.toLowerCase());
    if (idx > 0) {
      return text.slice(0, idx).trim();
    }
  }

  const legacyMatch = text.match(/^(.*?)\s+[OU]\s*(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (legacyMatch) {
    return String(legacyMatch[1] || '').trim();
  }

  // Heuristic fallback for legacy/imported text such as:
  // "Joelinton to be carded", "Joelinton carded", "Joelinton AGS", "Joelinton O0.5 FW"
  const fallback = text
    .replace(/\b[OU]\s*\d+(?:\.\d+)?\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(
      /\b(shots?|sot|fouls?\s+won|fouls?\s+committed|tackles?|to\s+be\s+carded|carded|ags|fw|fc)\b.*$/i,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (fallback) return fallback;

  // Final fallback: allow single-token player names.
  const firstToken = text.split(/\s+/).filter(Boolean)[0] || '';
  if (firstToken) return firstToken;

  return '';
};
