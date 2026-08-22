import { buildProjection, type ProjectionInputs } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];
const TEAL: [number, number, number] = [13, 148, 136];
const AMBER: [number, number, number] = [180, 83, 9];

export function buildProjectionReportContent(inputs: ProjectionInputs, years: number): BusinessReportContent {
  const rows = buildProjection(inputs, years);
  const last = rows[rows.length - 1];
  const milestones = [5, 10, 20].filter((y) => rows.some((r) => r.year === y));

  return {
    reportKind: "Professional Long-Term Investment Projection Report",
    filenameBase: "Long_Term_Property_Projection",
    coverSubtitle: `${years}-Year Property Projection`,
    summaryCards: [
      { label: "Property Price", value: formatNPRShort(inputs.propertyPrice), accent: "brand" },
      { label: `Value After ${years} Yr`, value: formatNPRShort(last?.propertyValue ?? 0), accent: "green" },
      { label: "Loan Balance (Final Yr)", value: formatNPRShort(last?.loanBalance ?? 0) },
      { label: "Owner Equity (Final Yr)", value: formatNPRShort(last?.ownerEquity ?? 0), accent: "brand" },
      { label: "Cumulative Rental Income", value: formatNPRShort(last?.cumulativeRentalIncome ?? 0) },
      { label: "Cumulative Return", value: formatNPRShort(last?.cumulativeReturn ?? 0), accent: (last?.cumulativeReturn ?? 0) >= 0 ? "green" : "red" },
    ],
    summaryNarrative: `Over a ${years}-year horizon, this property is projected to grow from ${formatNPRShort(inputs.propertyPrice)} to ${formatNPRShort(last?.propertyValue ?? 0)} in value, while the loan balance is reduced to ${formatNPRShort(last?.loanBalance ?? 0)}. Estimated owner equity at year ${years} is ${formatNPRShort(last?.ownerEquity ?? 0)}, and cumulative rental income collected over the period is estimated at ${formatNPRShort(last?.cumulativeRentalIncome ?? 0)}.`,
    highlights: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Analysis Period", value: `${years} years` },
      { label: `Property Value (Year ${years})`, value: formatNPR(last?.propertyValue ?? 0) },
      { label: `Loan Balance (Year ${years})`, value: formatNPR(last?.loanBalance ?? 0) },
      { label: `Owner Equity (Year ${years})`, value: formatNPR(last?.ownerEquity ?? 0) },
      { label: "Cumulative Rental Income", value: formatNPR(last?.cumulativeRentalIncome ?? 0) },
      { label: "Cumulative Cash Flow", value: formatNPR(last?.cumulativeCashFlow ?? 0) },
      { label: "Cumulative Return", value: formatNPR(last?.cumulativeReturn ?? 0) },
    ],
    sections: [
      {
        title: "Long-Term Projection — Year by Year",
        intro: `Selected milestone years from a full ${years}-year projection.`,
        columns: ["Year", "Property Value", "Loan Balance", "Owner Equity", "Rental Income", "Net Cash Flow"],
        rows: rows
          .filter((r) => milestones.includes(r.year) || r.year === years)
          .map((r) => [r.year, formatNPR(r.propertyValue), formatNPR(r.loanBalance), formatNPR(r.ownerEquity), formatNPR(r.rentalIncome), formatNPR(r.netCashFlow)]),
      },
    ],
    charts: [
      {
        kind: "line",
        title: "Property Value, Owner Equity & Loan Balance",
        categories: rows.map((r) => `Y${r.year}`),
        series: [
          { label: "Property Value", values: rows.map((r) => r.propertyValue), color: BRAND },
          { label: "Owner Equity", values: rows.map((r) => r.ownerEquity), color: TEAL },
          { label: "Loan Balance", values: rows.map((r) => r.loanBalance), color: AMBER },
        ],
      },
      {
        kind: "bar",
        title: "Rental Income & Net Cash Flow by Milestone Year",
        categories: milestones.map((y) => `Year ${y}`),
        series: [
          { label: "Rental Income", values: milestones.map((y) => rows.find((r) => r.year === y)?.rentalIncome ?? 0), color: TEAL },
          { label: "Net Cash Flow", values: milestones.map((y) => rows.find((r) => r.year === y)?.netCashFlow ?? 0), color: BRAND },
        ],
      },
    ],
    keyFindings: [
      `Property value is projected to grow from ${formatNPRShort(inputs.propertyPrice)} to ${formatNPRShort(last?.propertyValue ?? 0)} over ${years} years.`,
      `The loan balance is projected to reduce to ${formatNPRShort(last?.loanBalance ?? 0)} by year ${years}, from an original loan amount reflected in principal paid to date of ${formatNPRShort(last?.cumulativePrincipalPaid ?? 0)}.`,
      `Estimated owner equity at year ${years} is ${formatNPRShort(last?.ownerEquity ?? 0)}.`,
      `Total rental income collected over the period is estimated at ${formatNPRShort(last?.cumulativeRentalIncome ?? 0)}.`,
      `Cumulative investment return over ${years} years — combining appreciation and rental income, minus expenses and interest — is estimated at ${formatNPRShort(last?.cumulativeReturn ?? 0)}.`,
    ],
    assumptions: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: `${inputs.downPaymentPct}%` },
      { label: "Interest Rate", value: `${inputs.annualRatePct}%` },
      { label: "Loan Term", value: `${inputs.termYears} years` },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Annual Rent Increase", value: `${inputs.annualRentIncreasePct}%` },
      { label: "Annual Appreciation", value: `${inputs.annualAppreciationPct}%` },
      { label: "Annual Expenses", value: formatNPR(inputs.annualExpenses) },
      { label: "Vacancy Rate", value: `${inputs.vacancyRatePct}%` },
      { label: "Analysis Period", value: `${years} years` },
    ],
    methodology: [
      {
        title: "Long-Term Projection",
        body: "Each year's property value compounds at the assumed appreciation rate; the loan balance is calculated using the standard amortization schedule; rental income grows at the assumed annual rate and is reduced for vacancy; owner equity equals property value minus the remaining loan balance.",
      },
      {
        title: "Cumulative Return",
        body: "Cumulative return combines the property's appreciation to date and total rental income collected, minus total expenses and total interest paid — a measure of overall investment performance, excluding principal (which is instead reflected in growing equity).",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, the model indicates this property could be worth ${formatNPRShort(last?.propertyValue ?? 0)} after ${years} years, with an estimated owner equity of ${formatNPRShort(last?.ownerEquity ?? 0)}.`,
      `Cumulative rental income over the period is estimated at ${formatNPRShort(last?.cumulativeRentalIncome ?? 0)}, contributing to an estimated cumulative return of ${formatNPRShort(last?.cumulativeReturn ?? 0)}.`,
    ],
  };
}
