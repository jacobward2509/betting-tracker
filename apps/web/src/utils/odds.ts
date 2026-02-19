export type OddsFormat = "decimal" | "fractional";
const MAX_DECIMAL_PLACES = 5;
const DECIMAL_PRECISION_FACTOR = 10 ** MAX_DECIMAL_PLACES;

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

const toSimplifiedFraction = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return { numerator: 0, denominator: 1 };

  let bestNumerator = 0;
  let bestDenominator = 1;
  let smallestError = Number.POSITIVE_INFINITY;

  for (let denominator = 1; denominator <= 100; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < smallestError) {
      smallestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
      if (error < 1e-8) break;
    }
  }

  const divisor = gcd(bestNumerator, bestDenominator);
  return {
    numerator: bestNumerator / divisor,
    denominator: bestDenominator / divisor,
  };
};

export const decimalToFractionalOdds = (decimalOdds: number): string => {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return "0/1";
  const fractional = decimalOdds - 1;
  const { numerator, denominator } = toSimplifiedFraction(fractional);
  return `${numerator}/${denominator}`;
};

export const fractionalToDecimalOdds = (fractionalOdds: string): number | null => {
  const match = String(fractionalOdds || "")
    .trim()
    .match(/^(\d+)\s*\/\s*(\d+)$/);

  if (!match) return null;

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;

  return numerator / denominator + 1;
};

export const formatDecimalOdds = (decimalOdds: number): string => {
  if (!Number.isFinite(decimalOdds)) return "0";
  return decimalOdds.toFixed(MAX_DECIMAL_PLACES).replace(/\.?0+$/, "");
};

export const formatOddsForDisplay = (decimalOdds: number, format: OddsFormat): string => {
  if (format === "fractional") return decimalToFractionalOdds(decimalOdds);
  return formatDecimalOdds(decimalOdds);
};

export const parseOddsInput = (value: string, format: OddsFormat): number | null => {
  if (format === "fractional") return fractionalToDecimalOdds(value);
  const normalized = String(value || "").trim();
  if (!/^\d+(?:\.\d{1,5})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const normalizeOddsPrecision = (value: number): number | null => {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * DECIMAL_PRECISION_FACTOR) / DECIMAL_PRECISION_FACTOR;
};
