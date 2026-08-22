// ============================================================================
// Real Estate Investment Tools — shared formatting & number-safety helpers.
//
// Self-contained on purpose: this whole feature (src/features/investment-tools)
// does not import from src/lib/loan-calculator.ts or any other existing app
// code, so nothing here can ever be affected by — or accidentally affect —
// an existing calculator. A few lines of formatting logic are duplicated as
// the price of that isolation.
// ============================================================================

/** Coerces anything non-finite (undefined, null, NaN, ±Infinity) to a fallback. */
export function safeNum(v: number | undefined | null, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Non-negative, finite. */
export function nonNeg(v: number | undefined | null): number {
  return Math.max(0, safeNum(v));
}

/** Clamped to [min, max], finite. */
export function clampPct(v: number | undefined | null, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, safeNum(v)));
}

/** Full NPR amount with Nepali/Indian lakh-crore digit grouping, e.g. "NPR 2,50,00,000". */
export function formatNPR(amount: number): string {
  const value = safeNum(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "NPR",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("NPR", "NPR ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Human shorthand for large figures, e.g. "NPR 2.50 Crore" / "NPR 25.00 Lakh". */
export function formatNPRShort(amount: number): string {
  const value = safeNum(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}NPR ${(abs / 1_00_00_000).toFixed(2)} Crore`;
  if (abs >= 1_00_000) return `${sign}NPR ${(abs / 1_00_000).toFixed(2)} Lakh`;
  return formatNPR(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${safeNum(value).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(safeNum(value));
}
