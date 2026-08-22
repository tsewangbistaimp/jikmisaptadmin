// ============================================================================
// Real Estate Investment Tools — calculation engine.
//
// Pure functions only, no React/UI/Supabase imports. Every function is
// guarded against empty/zero/negative/extreme inputs so results can never
// come out as NaN or Infinity — callers can render every number here
// directly. This module is entirely new and self-contained: it does not
// import from, and is not imported by, src/lib/loan-calculator.ts or any
// other existing calculator in this app.
// ============================================================================
import { safeNum, nonNeg, clampPct } from "./format";

// ---------------------------------------------------------------------------
// Core amortizing-loan engine, shared by every tool below.
// ---------------------------------------------------------------------------

/** Standard amortizing-loan EMI formula: EMI = P·r·(1+r)^n / ((1+r)^n - 1). */
export function calcEMI(loanAmount: number, annualRatePct: number, termYears: number): number {
  const P = nonNeg(loanAmount);
  const n = Math.max(0, Math.round(nonNeg(termYears) * 12));
  if (P === 0 || n === 0) return 0;
  const r = nonNeg(annualRatePct) / 100 / 12;
  if (r === 0) return P / n;
  const factor = Math.pow(1 + r, n);
  if (!Number.isFinite(factor) || factor <= 1) return P / n;
  return (P * r * factor) / (factor - 1);
}

/** Outstanding balance after `monthsElapsed` scheduled monthly payments. */
export function remainingBalance(loanAmount: number, annualRatePct: number, termYears: number, monthsElapsed: number): number {
  const P = nonNeg(loanAmount);
  const n = Math.max(0, Math.round(nonNeg(termYears) * 12));
  if (P === 0 || n === 0) return 0;
  const k = Math.min(Math.max(Math.round(safeNum(monthsElapsed)), 0), n);
  const r = nonNeg(annualRatePct) / 100 / 12;
  if (r === 0) return P * (1 - k / n);
  const factor = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, k);
  if (!Number.isFinite(factor) || !Number.isFinite(factorK) || factor <= 1) return Math.max(0, P * (1 - k / n));
  return Math.max(0, (P * (factor - factorK)) / (factor - 1));
}

/** Inverts the EMI formula: given an affordable monthly payment, what loan does it support? */
export function maxLoanForPayment(monthlyPayment: number, annualRatePct: number, termYears: number): number {
  const pay = nonNeg(monthlyPayment);
  const n = Math.max(0, Math.round(nonNeg(termYears) * 12));
  if (pay === 0 || n === 0) return 0;
  const r = nonNeg(annualRatePct) / 100 / 12;
  if (r === 0) return pay * n;
  const factor = Math.pow(1 + r, n);
  if (!Number.isFinite(factor) || factor <= 1) return pay * n;
  const loan = (pay * (factor - 1)) / (r * factor);
  return Number.isFinite(loan) ? Math.max(0, loan) : 0;
}

// ---------------------------------------------------------------------------
// 1. Mortgage / EMI Calculator
// ---------------------------------------------------------------------------

export interface MortgageInputs {
  propertyPrice: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
}

export interface MortgageResults {
  downPayment: number;
  loanAmount: number;
  monthlyEMI: number;
  totalPayments: number;
  totalAmountPaid: number;
  totalPrincipal: number;
  totalInterest: number;
}

export function calcMortgage(inputs: MortgageInputs): MortgageResults {
  const price = nonNeg(inputs.propertyPrice);
  const dpPct = clampPct(inputs.downPaymentPct);
  const downPayment = price * (dpPct / 100);
  const loanAmount = Math.max(0, price - downPayment);
  const termYears = nonNeg(inputs.termYears);
  const totalPayments = Math.max(0, Math.round(termYears * 12));
  const monthlyEMI = calcEMI(loanAmount, inputs.annualRatePct, termYears);
  const totalAmountPaid = monthlyEMI * totalPayments;
  const totalPrincipal = loanAmount;
  const totalInterest = Math.max(0, totalAmountPaid - totalPrincipal);
  return { downPayment, loanAmount, monthlyEMI, totalPayments, totalAmountPaid, totalPrincipal, totalInterest };
}

// ---------------------------------------------------------------------------
// 2. Rental ROI Calculator
// ---------------------------------------------------------------------------

export interface RentalRoiInputs {
  propertyPrice: number;
  downPayment: number;
  annualRatePct: number;
  loanTermYears: number;
  monthlyRent: number;
  monthlyExpenses: number;
  annualMaintenance: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  managementFeePct: number;
  vacancyRatePct: number;
  annualAppreciationPct: number;
}

export interface RentalRoiResults {
  loanAmount: number;
  monthlyEMI: number;
  grossAnnualRent: number;
  vacancyLoss: number;
  effectiveAnnualRent: number;
  managementFee: number;
  annualExpenses: number;
  netOperatingIncome: number;
  annualDebtService: number;
  annualCashFlow: number;
  cashInvested: number;
  cashOnCashReturnPct: number;
  annualAppreciationAmount: number;
  rentalROIPct: number;
  estimatedPropertyValueYear1: number;
}

export function calcRentalRoi(inputs: RentalRoiInputs): RentalRoiResults {
  const price = nonNeg(inputs.propertyPrice);
  const downPayment = Math.min(price, nonNeg(inputs.downPayment));
  const loanAmount = Math.max(0, price - downPayment);
  const monthlyEMI = calcEMI(loanAmount, inputs.annualRatePct, inputs.loanTermYears);
  const annualDebtService = monthlyEMI * 12;

  const grossAnnualRent = nonNeg(inputs.monthlyRent) * 12;
  const vacancyPct = clampPct(inputs.vacancyRatePct);
  const vacancyLoss = grossAnnualRent * (vacancyPct / 100);
  const effectiveAnnualRent = Math.max(0, grossAnnualRent - vacancyLoss);

  const managementFeePct = clampPct(inputs.managementFeePct);
  const managementFee = effectiveAnnualRent * (managementFeePct / 100);

  const annualExpenses =
    nonNeg(inputs.monthlyExpenses) * 12 + nonNeg(inputs.annualMaintenance) + nonNeg(inputs.propertyTaxAnnual) + nonNeg(inputs.insuranceAnnual) + managementFee;

  const netOperatingIncome = effectiveAnnualRent - annualExpenses;
  const annualCashFlow = netOperatingIncome - annualDebtService;

  const cashInvested = downPayment;
  const cashOnCashReturnPct = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;

  const annualAppreciationAmount = price * (nonNeg(inputs.annualAppreciationPct) / 100);
  const rentalROIPct = cashInvested > 0 ? ((annualCashFlow + annualAppreciationAmount) / cashInvested) * 100 : 0;

  const estimatedPropertyValueYear1 = price * (1 + nonNeg(inputs.annualAppreciationPct) / 100);

  return {
    loanAmount,
    monthlyEMI,
    grossAnnualRent,
    vacancyLoss,
    effectiveAnnualRent,
    managementFee,
    annualExpenses,
    netOperatingIncome,
    annualDebtService,
    annualCashFlow,
    cashInvested,
    cashOnCashReturnPct,
    annualAppreciationAmount,
    rentalROIPct,
    estimatedPropertyValueYear1,
  };
}

// ---------------------------------------------------------------------------
// 3. Rental Yield Calculator
// ---------------------------------------------------------------------------

export interface RentalYieldInputs {
  propertyPrice: number;
  monthlyRent: number;
  annualExpenses: number;
}

export interface RentalYieldResults {
  annualRent: number;
  grossYieldPct: number;
  netYieldPct: number;
}

export function calcRentalYield(inputs: RentalYieldInputs): RentalYieldResults {
  const price = nonNeg(inputs.propertyPrice);
  const annualRent = nonNeg(inputs.monthlyRent) * 12;
  const annualExpenses = nonNeg(inputs.annualExpenses);
  const grossYieldPct = price > 0 ? (annualRent / price) * 100 : 0;
  const netYieldPct = price > 0 ? ((annualRent - annualExpenses) / price) * 100 : 0;
  return { annualRent, grossYieldPct, netYieldPct };
}

// ---------------------------------------------------------------------------
// 4. Property Appreciation Calculator
// ---------------------------------------------------------------------------

export interface AppreciationInputs {
  currentValue: number;
  annualAppreciationPct: number;
  years: number;
}

export interface AppreciationResults {
  currentValue: number;
  futureValue: number;
  totalIncrease: number;
  percentIncrease: number;
  series: { year: number; value: number }[];
}

export function calcAppreciation(inputs: AppreciationInputs): AppreciationResults {
  const currentValue = nonNeg(inputs.currentValue);
  const rate = nonNeg(inputs.annualAppreciationPct) / 100;
  const years = Math.max(0, Math.round(nonNeg(inputs.years)));
  const growth = (y: number) => {
    const v = currentValue * Math.pow(1 + rate, y);
    return Number.isFinite(v) ? v : currentValue;
  };
  const futureValue = growth(years);
  const totalIncrease = futureValue - currentValue;
  const percentIncrease = currentValue > 0 ? (totalIncrease / currentValue) * 100 : 0;
  const series: { year: number; value: number }[] = [];
  for (let y = 0; y <= years; y++) series.push({ year: y, value: growth(y) });
  return { currentValue, futureValue, totalIncrease, percentIncrease, series };
}

// ---------------------------------------------------------------------------
// 5. Property Comparison Calculator
// ---------------------------------------------------------------------------

export type PropertyType = "apartment" | "house" | "commercial" | "other";

export interface ComparisonPropertyInput {
  id: string;
  name: string;
  type: PropertyType;
  price: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
  monthlyRent: number;
  monthlyExpenses: number;
  annualAppreciationPct: number;
  vacancyRatePct: number;
}

export interface ComparisonPropertyResult {
  id: string;
  name: string;
  type: PropertyType;
  price: number;
  downPayment: number;
  loanAmount: number;
  monthlyEMI: number;
  totalInterestFullTerm: number;
  monthlyRent: number;
  annualRent: number;
  effectiveAnnualRent: number;
  rentalYieldPct: number;
  monthlyCashFlow: number;
  value5yr: number;
  value10yr: number;
  remainingLoan5yr: number;
  remainingLoan10yr: number;
  equity5yr: number;
  equity10yr: number;
  totalRentalIncome10yr: number;
  totalExpenses10yr: number;
  estimatedReturn10yr: number;
}

function valueAtYear(price: number, appreciationPct: number, years: number): number {
  const v = nonNeg(price) * Math.pow(1 + nonNeg(appreciationPct) / 100, years);
  return Number.isFinite(v) ? v : nonNeg(price);
}

export function compareProperties(inputs: ComparisonPropertyInput[]): ComparisonPropertyResult[] {
  return inputs.map((p) => {
    const price = nonNeg(p.price);
    const dpPct = clampPct(p.downPaymentPct);
    const downPayment = price * (dpPct / 100);
    const loanAmount = Math.max(0, price - downPayment);
    const termYears = nonNeg(p.termYears);
    const monthlyEMI = calcEMI(loanAmount, p.annualRatePct, termYears);
    const totalPayments = Math.max(0, Math.round(termYears * 12));
    const totalInterestFullTerm = Math.max(0, monthlyEMI * totalPayments - loanAmount);

    const monthlyRent = nonNeg(p.monthlyRent);
    const annualRent = monthlyRent * 12;
    const vacancyPct = clampPct(p.vacancyRatePct);
    const effectiveAnnualRent = annualRent * (1 - vacancyPct / 100);
    const rentalYieldPct = price > 0 ? (annualRent / price) * 100 : 0;
    const monthlyExpenses = nonNeg(p.monthlyExpenses);
    const monthlyCashFlow = effectiveAnnualRent / 12 - monthlyExpenses - monthlyEMI;

    const value5yr = valueAtYear(price, p.annualAppreciationPct, 5);
    const value10yr = valueAtYear(price, p.annualAppreciationPct, 10);
    const remainingLoan5yr = remainingBalance(loanAmount, p.annualRatePct, termYears, 60);
    const remainingLoan10yr = remainingBalance(loanAmount, p.annualRatePct, termYears, 120);
    const equity5yr = value5yr - remainingLoan5yr;
    const equity10yr = value10yr - remainingLoan10yr;

    const totalRentalIncome10yr = effectiveAnnualRent * 10;
    const totalExpenses10yr = monthlyExpenses * 12 * 10;
    const interestPaid10yr = Math.max(0, loanAmount - remainingLoan10yr) > 0 ? monthlyEMI * Math.min(120, totalPayments) - Math.max(0, loanAmount - remainingLoan10yr) : 0;
    const appreciation10yr = value10yr - price;
    const estimatedReturn10yr = appreciation10yr + totalRentalIncome10yr - totalExpenses10yr - Math.max(0, interestPaid10yr);

    return {
      id: p.id,
      name: p.name || "Untitled Property",
      type: p.type,
      price,
      downPayment,
      loanAmount,
      monthlyEMI,
      totalInterestFullTerm,
      monthlyRent,
      annualRent,
      effectiveAnnualRent,
      rentalYieldPct,
      monthlyCashFlow,
      value5yr,
      value10yr,
      remainingLoan5yr,
      remainingLoan10yr,
      equity5yr,
      equity10yr,
      totalRentalIncome10yr,
      totalExpenses10yr,
      estimatedReturn10yr,
    };
  });
}

// ---------------------------------------------------------------------------
// 6. 5 / 10 / 20-Year Property Projection
// ---------------------------------------------------------------------------

export interface ProjectionInputs {
  propertyPrice: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
  monthlyRent: number;
  annualRentIncreasePct: number;
  annualAppreciationPct: number;
  annualExpenses: number;
  vacancyRatePct: number;
}

export interface ProjectionYearRow {
  year: number;
  propertyValue: number;
  loanBalance: number;
  principalPaidThisYear: number;
  interestPaidThisYear: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
  rentalIncome: number;
  expenses: number;
  netCashFlow: number;
  ownerEquity: number;
  cumulativeRentalIncome: number;
  cumulativeCashFlow: number;
  cumulativeReturn: number;
}

export function buildProjection(inputs: ProjectionInputs, maxYears = 20): ProjectionYearRow[] {
  const price = nonNeg(inputs.propertyPrice);
  const dpPct = clampPct(inputs.downPaymentPct);
  const downPayment = price * (dpPct / 100);
  const loanAmount = Math.max(0, price - downPayment);
  const termYears = nonNeg(inputs.termYears);
  const monthlyEMI = calcEMI(loanAmount, inputs.annualRatePct, termYears);
  const annualEMI = monthlyEMI * 12;
  const rentIncreasePct = nonNeg(inputs.annualRentIncreasePct) / 100;
  const appreciationPct = nonNeg(inputs.annualAppreciationPct) / 100;
  const vacancyPct = clampPct(inputs.vacancyRatePct);
  const annualExpenses = nonNeg(inputs.annualExpenses);

  const years = Math.max(1, Math.min(50, Math.round(maxYears)));
  const rows: ProjectionYearRow[] = [];
  let cumulativeRentalIncome = 0;
  let cumulativeCashFlow = 0;
  let prevLoanBalance = loanAmount;

  for (let year = 1; year <= years; year++) {
    const propertyValueRaw = price * Math.pow(1 + appreciationPct, year);
    const propertyValue = Number.isFinite(propertyValueRaw) ? propertyValueRaw : price;

    const loanBalance = remainingBalance(loanAmount, inputs.annualRatePct, termYears, year * 12);
    const monthsPaidThisYear = Math.max(0, Math.min(12, Math.round(termYears * 12) - (year - 1) * 12));
    const paidThisYear = monthlyEMI * monthsPaidThisYear;
    const principalPaidThisYear = Math.max(0, prevLoanBalance - loanBalance);
    const interestPaidThisYear = Math.max(0, paidThisYear - principalPaidThisYear);
    prevLoanBalance = loanBalance;

    const grossRentThisYearRaw = nonNeg(inputs.monthlyRent) * 12 * Math.pow(1 + rentIncreasePct, year - 1);
    const grossRentThisYear = Number.isFinite(grossRentThisYearRaw) ? grossRentThisYearRaw : nonNeg(inputs.monthlyRent) * 12;
    const rentalIncome = grossRentThisYear * (1 - vacancyPct / 100);

    const netCashFlow = rentalIncome - annualExpenses - annualEMI;
    const ownerEquity = propertyValue - loanBalance;

    cumulativeRentalIncome += rentalIncome;
    cumulativeCashFlow += netCashFlow;

    const cumulativePrincipalPaid = loanAmount - loanBalance;
    const cumulativeInterestPaid = monthlyEMI * Math.min(year * 12, Math.round(termYears * 12)) - cumulativePrincipalPaid;
    const cumulativeAppreciation = propertyValue - price;
    // Consistent with the same principled formula used elsewhere in this app:
    // return = appreciation + rental income - expenses - interest. Principal
    // is excluded because paying it down converts cash into equity, which is
    // already captured by the appreciation term (equity = value - balance).
    const cumulativeExpensesOnly = annualExpenses * year;
    const cumulativeReturn = cumulativeAppreciation + cumulativeRentalIncome - cumulativeExpensesOnly - Math.max(0, cumulativeInterestPaid);

    rows.push({
      year,
      propertyValue,
      loanBalance,
      principalPaidThisYear,
      interestPaidThisYear,
      cumulativePrincipalPaid,
      cumulativeInterestPaid: Math.max(0, cumulativeInterestPaid),
      rentalIncome,
      expenses: annualExpenses,
      netCashFlow,
      ownerEquity,
      cumulativeRentalIncome,
      cumulativeCashFlow,
      cumulativeReturn,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// 7. Buy vs Rent Calculator
// ---------------------------------------------------------------------------

export interface BuyVsRentInputs {
  propertyPrice: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
  annualMaintenance: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  annualAppreciationPct: number;
  sellingCostsPct: number;
  monthlyRent: number;
  annualRentIncreasePct: number;
  expectedInvestmentReturnPct: number;
}

export interface BuyVsRentYearResult {
  year: number;
  buy: {
    totalPaid: number;
    propertyValue: number;
    remainingLoan: number;
    ownerEquity: number;
    sellingCosts: number;
    netPosition: number;
    totalCosts: number;
  };
  rent: {
    totalRentPaid: number;
    investmentValue: number;
    netPosition: number;
    totalCosts: number;
  };
  difference: number;
}

export function compareBuyVsRent(inputs: BuyVsRentInputs, maxYears = 20): BuyVsRentYearResult[] {
  const price = nonNeg(inputs.propertyPrice);
  const dpPct = clampPct(inputs.downPaymentPct);
  const downPayment = price * (dpPct / 100);
  const loanAmount = Math.max(0, price - downPayment);
  const termYears = nonNeg(inputs.termYears);
  const monthlyEMI = calcEMI(loanAmount, inputs.annualRatePct, termYears);
  const buyFixedMonthly = (nonNeg(inputs.annualMaintenance) + nonNeg(inputs.propertyTaxAnnual) + nonNeg(inputs.insuranceAnnual)) / 12;
  const appreciationPct = nonNeg(inputs.annualAppreciationPct) / 100;
  const sellingCostsPct = clampPct(inputs.sellingCostsPct);
  const rentIncreasePct = nonNeg(inputs.annualRentIncreasePct) / 100;
  const monthlyReturn = nonNeg(inputs.expectedInvestmentReturnPct) / 100 / 12;

  const years = Math.max(1, Math.min(50, Math.round(maxYears)));
  const results: BuyVsRentYearResult[] = [];

  let investmentBalance = downPayment;
  let totalRentPaid = 0;
  let totalBuyCashOutlay = 0;

  for (let year = 1; year <= years; year++) {
    for (let m = 1; m <= 12; m++) {
      const rentGrowthRaw = nonNeg(inputs.monthlyRent) * Math.pow(1 + rentIncreasePct, year - 1);
      const rentThisMonth = Number.isFinite(rentGrowthRaw) ? rentGrowthRaw : nonNeg(inputs.monthlyRent);
      const buyMonthlyCost = monthlyEMI + buyFixedMonthly;
      const monthlyDiff = buyMonthlyCost - rentThisMonth;
      const grown = investmentBalance * (1 + monthlyReturn) + monthlyDiff;
      investmentBalance = Number.isFinite(grown) ? grown : investmentBalance;
      totalRentPaid += rentThisMonth;
      totalBuyCashOutlay += buyMonthlyCost;
    }

    const propertyValueRaw = price * Math.pow(1 + appreciationPct, year);
    const propertyValue = Number.isFinite(propertyValueRaw) ? propertyValueRaw : price;
    const remainingLoan = remainingBalance(loanAmount, inputs.annualRatePct, termYears, year * 12);
    const ownerEquity = propertyValue - remainingLoan;
    const sellingCosts = propertyValue * (sellingCostsPct / 100);
    const buyNetPosition = ownerEquity - sellingCosts;
    const buyTotalCosts = downPayment + totalBuyCashOutlay;

    const rentNetPosition = investmentBalance;
    const rentTotalCosts = totalRentPaid;

    results.push({
      year,
      buy: {
        totalPaid: totalBuyCashOutlay,
        propertyValue,
        remainingLoan,
        ownerEquity,
        sellingCosts,
        netPosition: buyNetPosition,
        totalCosts: buyTotalCosts,
      },
      rent: {
        totalRentPaid,
        investmentValue: rentNetPosition,
        netPosition: rentNetPosition,
        totalCosts: rentTotalCosts,
      },
      difference: buyNetPosition - rentNetPosition,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 8. Property Affordability Calculator
// ---------------------------------------------------------------------------

export interface AffordabilityInputs {
  monthlyIncome: number;
  otherMonthlyIncome: number;
  existingMonthlyDebt: number;
  availableDownPayment: number;
  annualRatePct: number;
  termYears: number;
  desiredDTIPct: number;
}

export interface AffordabilityResults {
  totalMonthlyIncome: number;
  maxTotalDebtPayment: number;
  maxAffordableMonthlyPayment: number;
  maxEstimatedLoan: number;
  maxEstimatedPropertyPrice: number;
  requiredDownPayment: number;
  estimatedEMI: number;
  dtiRatioPct: number;
  remainingMonthlyIncome: number;
}

export function calcAffordability(inputs: AffordabilityInputs): AffordabilityResults {
  const totalMonthlyIncome = nonNeg(inputs.monthlyIncome) + nonNeg(inputs.otherMonthlyIncome);
  const existingMonthlyDebt = nonNeg(inputs.existingMonthlyDebt);
  const dtiPct = clampPct(inputs.desiredDTIPct, 0, 100);
  const maxTotalDebtPayment = totalMonthlyIncome * (dtiPct / 100);
  const maxAffordableMonthlyPayment = Math.max(0, maxTotalDebtPayment - existingMonthlyDebt);

  const availableDownPayment = nonNeg(inputs.availableDownPayment);
  const maxEstimatedLoan = maxLoanForPayment(maxAffordableMonthlyPayment, inputs.annualRatePct, inputs.termYears);
  const maxEstimatedPropertyPrice = maxEstimatedLoan + availableDownPayment;
  const requiredDownPayment = availableDownPayment;
  const estimatedEMI = calcEMI(maxEstimatedLoan, inputs.annualRatePct, inputs.termYears);

  const dtiRatioPct = totalMonthlyIncome > 0 ? ((existingMonthlyDebt + estimatedEMI) / totalMonthlyIncome) * 100 : 0;
  const remainingMonthlyIncome = Math.max(0, totalMonthlyIncome - existingMonthlyDebt - estimatedEMI);

  return {
    totalMonthlyIncome,
    maxTotalDebtPayment,
    maxAffordableMonthlyPayment,
    maxEstimatedLoan,
    maxEstimatedPropertyPrice,
    requiredDownPayment,
    estimatedEMI,
    dtiRatioPct,
    remainingMonthlyIncome,
  };
}

// ---------------------------------------------------------------------------
// 9. Rental Cash Flow Calculator
// ---------------------------------------------------------------------------

export interface CashFlowInputs {
  monthlyRent: number;
  vacancyRatePct: number;
  emi: number;
  propertyTaxMonthly: number;
  insuranceMonthly: number;
  maintenanceMonthly: number;
  managementMonthly: number;
  utilitiesMonthly: number;
  otherExpensesMonthly: number;
  cashInvested?: number;
}

export interface CashFlowResults {
  grossMonthlyRent: number;
  vacancyLoss: number;
  effectiveMonthlyRent: number;
  totalMonthlyExpensesExcludingEMI: number;
  netMonthlyCashFlow: number;
  isPositive: boolean;
  annualCashFlow: number;
  annualRentalIncome: number;
  annualExpenses: number;
  cashFlowAfterDebt: number;
  cashOnCashReturnPct: number | null;
}

// ---------------------------------------------------------------------------
// 10. Single-property bundle — combines Mortgage + Rental ROI + Appreciation
// + Projection for the "Generate PDF Report" tool, so the report page (and
// its PDF) never runs different math than the rest of this feature.
// ---------------------------------------------------------------------------

export interface SinglePropertyInputs {
  propertyName: string;
  propertyType: PropertyType;
  propertyPrice: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
  monthlyRent: number;
  monthlyExpenses: number;
  annualMaintenance: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  managementFeePct: number;
  vacancyRatePct: number;
  annualAppreciationPct: number;
  annualRentIncreasePct: number;
  projectionYears: number;
}

export interface SinglePropertyBundle {
  inputs: SinglePropertyInputs;
  mortgage: MortgageResults;
  rentalRoi: RentalRoiResults;
  rentalYield: RentalYieldResults;
  appreciation: AppreciationResults;
  projection: ProjectionYearRow[];
}

export function buildSinglePropertyBundle(inputs: SinglePropertyInputs): SinglePropertyBundle {
  const mortgage = calcMortgage({
    propertyPrice: inputs.propertyPrice,
    downPaymentPct: inputs.downPaymentPct,
    annualRatePct: inputs.annualRatePct,
    termYears: inputs.termYears,
  });

  const rentalRoi = calcRentalRoi({
    propertyPrice: inputs.propertyPrice,
    downPayment: mortgage.downPayment,
    annualRatePct: inputs.annualRatePct,
    loanTermYears: inputs.termYears,
    monthlyRent: inputs.monthlyRent,
    monthlyExpenses: inputs.monthlyExpenses,
    annualMaintenance: inputs.annualMaintenance,
    propertyTaxAnnual: inputs.propertyTaxAnnual,
    insuranceAnnual: inputs.insuranceAnnual,
    managementFeePct: inputs.managementFeePct,
    vacancyRatePct: inputs.vacancyRatePct,
    annualAppreciationPct: inputs.annualAppreciationPct,
  });

  const rentalYield = calcRentalYield({
    propertyPrice: inputs.propertyPrice,
    monthlyRent: inputs.monthlyRent,
    annualExpenses: rentalRoi.annualExpenses,
  });

  const projectionYears = Math.max(1, Math.min(30, Math.round(nonNeg(inputs.projectionYears) || 20)));
  const appreciation = calcAppreciation({
    currentValue: inputs.propertyPrice,
    annualAppreciationPct: inputs.annualAppreciationPct,
    years: projectionYears,
  });

  const projection = buildProjection(
    {
      propertyPrice: inputs.propertyPrice,
      downPaymentPct: inputs.downPaymentPct,
      annualRatePct: inputs.annualRatePct,
      termYears: inputs.termYears,
      monthlyRent: inputs.monthlyRent,
      annualRentIncreasePct: inputs.annualRentIncreasePct,
      annualAppreciationPct: inputs.annualAppreciationPct,
      annualExpenses: rentalRoi.annualExpenses,
      vacancyRatePct: inputs.vacancyRatePct,
    },
    projectionYears
  );

  return { inputs, mortgage, rentalRoi, rentalYield, appreciation, projection };
}

export function calcRentalCashFlow(inputs: CashFlowInputs): CashFlowResults {
  const grossMonthlyRent = nonNeg(inputs.monthlyRent);
  const vacancyPct = clampPct(inputs.vacancyRatePct);
  const vacancyLoss = grossMonthlyRent * (vacancyPct / 100);
  const effectiveMonthlyRent = grossMonthlyRent - vacancyLoss;

  const totalMonthlyExpensesExcludingEMI =
    nonNeg(inputs.propertyTaxMonthly) +
    nonNeg(inputs.insuranceMonthly) +
    nonNeg(inputs.maintenanceMonthly) +
    nonNeg(inputs.managementMonthly) +
    nonNeg(inputs.utilitiesMonthly) +
    nonNeg(inputs.otherExpensesMonthly);

  const emi = nonNeg(inputs.emi);
  const netMonthlyCashFlow = effectiveMonthlyRent - emi - totalMonthlyExpensesExcludingEMI;
  const isPositive = netMonthlyCashFlow >= 0;
  const annualCashFlow = netMonthlyCashFlow * 12;
  const annualRentalIncome = effectiveMonthlyRent * 12;
  const annualExpenses = totalMonthlyExpensesExcludingEMI * 12;
  const cashFlowAfterDebt = annualCashFlow;

  const cashInvested = inputs.cashInvested;
  const cashOnCashReturnPct =
    typeof cashInvested === "number" && Number.isFinite(cashInvested) && cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : null;

  return {
    grossMonthlyRent,
    vacancyLoss,
    effectiveMonthlyRent,
    totalMonthlyExpensesExcludingEMI,
    netMonthlyCashFlow,
    isPositive,
    annualCashFlow,
    annualRentalIncome,
    annualExpenses,
    cashFlowAfterDebt,
    cashOnCashReturnPct,
  };
}
