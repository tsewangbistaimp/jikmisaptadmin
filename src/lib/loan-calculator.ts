// ============================================================================
// Real-Estate Investment Loan Calculator — pure calculation helpers.
//
// This file is entirely new and self-contained: nothing here is imported by
// any existing page, and it imports nothing from the rest of the app except
// types. It does not touch src/lib/utils.ts's formatCurrency (used
// throughout the existing booking/finance pages) — this feature needs
// lakh/crore-grouped NPR formatting, which is a different, new formatter
// (formatNPR / formatNPRShorthand below) kept local to this feature only.
// ============================================================================

export interface PropertyInputs {
  /** Purchase price of the property, in NPR. */
  price: number;
  /** Down payment as a percentage of price, e.g. 20 for 20%. */
  downPaymentPct: number;
  /** Annual loan interest rate, e.g. 10 for 10%. */
  annualInterestRatePct: number;
  /** Loan term in years. */
  loanTermYears: number;
  /** Expected monthly rental income, in NPR. */
  monthlyRent: number;
  /** Expected annual property appreciation rate, e.g. 5 for 5%. */
  annualAppreciationPct: number;
  /** Recurring monthly expenses (maintenance, tax, insurance...), in NPR. */
  monthlyExpenses: number;
}

export interface PropertyResults {
  downPayment: number;
  loanAmount: number;
  /** Loan as a % of price — the mirror of downPaymentPct, shown for
   *  reference only (not independently editable, so the two always agree). */
  loanToValuePct: number;
  monthlyEMI: number;

  /** Full loan-term figures (over all `n` scheduled payments). */
  totalPayments: number;
  totalPaidToBankFullTerm: number;
  totalInterestFullTerm: number;

  /** Figures as of the selected analysis period (`periodYears`). */
  periodYears: number;
  principalPaidInPeriod: number;
  interestPaidInPeriod: number;
  remainingLoanBalance: number;

  monthlyRentalIncome: number;
  annualRentalIncome: number;
  rentalYieldPct: number;
  monthlyCashFlow: number;
  annualCashFlow: number;

  futurePropertyValue: number;
  propertyAppreciation: number;
  ownerEquity: number;

  totalRentalIncomeInPeriod: number;
  totalExpensesInPeriod: number;
  netInvestmentProfitLoss: number;
}

/** Standard amortizing-loan EMI formula: EMI = P·r·(1+r)^n / ((1+r)^n - 1). */
export function calculateEMI(loanAmount: number, annualInterestRatePct: number, loanTermYears: number): number {
  const n = Math.max(0, Math.round(loanTermYears * 12));
  if (n === 0 || loanAmount <= 0) return 0;
  const r = annualInterestRatePct / 100 / 12;
  if (r === 0) return loanAmount / n;
  const factor = Math.pow(1 + r, n);
  return (loanAmount * r * factor) / (factor - 1);
}

/** Outstanding balance after `monthsElapsed` scheduled monthly payments. */
export function remainingBalance(loanAmount: number, annualInterestRatePct: number, loanTermYears: number, monthsElapsed: number): number {
  const n = Math.max(0, Math.round(loanTermYears * 12));
  if (n === 0 || loanAmount <= 0) return 0;
  const k = Math.min(Math.max(Math.round(monthsElapsed), 0), n);
  const r = annualInterestRatePct / 100 / 12;
  if (r === 0) return loanAmount * (1 - k / n);
  const factor = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, k);
  return (loanAmount * (factor - factorK)) / (factor - 1);
}

export function calculatePropertyResults(inputs: PropertyInputs, periodYears: number): PropertyResults {
  const price = Math.max(0, inputs.price || 0);
  const downPaymentPct = Math.min(100, Math.max(0, inputs.downPaymentPct || 0));
  const downPayment = price * (downPaymentPct / 100);
  const loanAmount = Math.max(0, price - downPayment);
  const loanToValuePct = 100 - downPaymentPct;

  const monthlyEMI = calculateEMI(loanAmount, inputs.annualInterestRatePct || 0, inputs.loanTermYears || 0);
  const totalPayments = Math.max(0, Math.round((inputs.loanTermYears || 0) * 12));
  const totalPaidToBankFullTerm = monthlyEMI * totalPayments;
  const totalInterestFullTerm = Math.max(0, totalPaidToBankFullTerm - loanAmount);

  const clampedPeriodYears = Math.max(0, periodYears || 0);
  const monthsInPeriod = Math.min(totalPayments, Math.round(clampedPeriodYears * 12));
  const remainingLoanBalance = remainingBalance(loanAmount, inputs.annualInterestRatePct || 0, inputs.loanTermYears || 0, monthsInPeriod);
  const principalPaidInPeriod = Math.max(0, loanAmount - remainingLoanBalance);
  const paidInPeriod = monthlyEMI * monthsInPeriod;
  const interestPaidInPeriod = Math.max(0, paidInPeriod - principalPaidInPeriod);

  const monthlyRentalIncome = Math.max(0, inputs.monthlyRent || 0);
  const annualRentalIncome = monthlyRentalIncome * 12;
  const rentalYieldPct = price > 0 ? (annualRentalIncome / price) * 100 : 0;

  const monthlyExpenses = Math.max(0, inputs.monthlyExpenses || 0);
  const monthlyCashFlow = monthlyRentalIncome - monthlyExpenses - monthlyEMI;
  const annualCashFlow = monthlyCashFlow * 12;

  // Future Property Value = Purchase Price × (1 + Annual Appreciation Rate)^Years
  const futurePropertyValue = price * Math.pow(1 + (inputs.annualAppreciationPct || 0) / 100, clampedPeriodYears);
  const propertyAppreciation = futurePropertyValue - price;
  const ownerEquity = futurePropertyValue - remainingLoanBalance;

  const totalRentalIncomeInPeriod = annualRentalIncome * clampedPeriodYears;
  const totalExpensesInPeriod = monthlyExpenses * 12 * clampedPeriodYears;

  // Net Profit/Loss = property appreciation + rental income collected -
  // expenses - interest paid over the period. Principal paid nets out of
  // this on purpose: it isn't a gain or a loss, it just converts cash into
  // home equity, which is already captured by ownerEquity above and by the
  // appreciation term here — subtracting the full EMI *and* separately
  // counting equity growth would double-count the principal portion.
  const netInvestmentProfitLoss = propertyAppreciation + totalRentalIncomeInPeriod - totalExpensesInPeriod - interestPaidInPeriod;

  return {
    downPayment,
    loanAmount,
    loanToValuePct,
    monthlyEMI,
    totalPayments,
    totalPaidToBankFullTerm,
    totalInterestFullTerm,
    periodYears: clampedPeriodYears,
    principalPaidInPeriod,
    interestPaidInPeriod,
    remainingLoanBalance,
    monthlyRentalIncome,
    annualRentalIncome,
    rentalYieldPct,
    monthlyCashFlow,
    annualCashFlow,
    futurePropertyValue,
    propertyAppreciation,
    ownerEquity,
    totalRentalIncomeInPeriod,
    totalExpensesInPeriod,
    netInvestmentProfitLoss,
  };
}

/** Snapshot of just the year-N figures used by the fixed 5-year/10-year
 *  comparison rows, independent of whatever analysis period is selected. */
export function calculateAtYear(inputs: PropertyInputs, years: number) {
  const r = calculatePropertyResults(inputs, years);
  return {
    propertyValue: r.futurePropertyValue,
    remainingLoanBalance: r.remainingLoanBalance,
    ownerEquity: r.ownerEquity,
  };
}

// ----------------------------------------------------------------------------
// NPR formatting with lakh/crore grouping (1,00,000 / 1,00,00,000) — the
// "en-IN" locale groups digits the same way India and Nepal do, which
// Intl's "en-NP" locale (used by the existing formatCurrency) does not.
// ----------------------------------------------------------------------------

export function formatNPR(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
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

/** Human shorthand for large figures, e.g. "NPR 2.50 Crore" / "NPR 75.00 Lakh". */
export function formatNPRShorthand(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}NPR ${(abs / 1_00_00_000).toFixed(2)} Crore`;
  if (abs >= 1_00_000) return `${sign}NPR ${(abs / 1_00_000).toFixed(2)} Lakh`;
  return formatNPR(value);
}

export function formatPct(value: number, digits = 2): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toFixed(digits)}%`;
}
