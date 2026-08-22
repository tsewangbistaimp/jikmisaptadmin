import type { CashFlowInputs, CashFlowResults } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const TEAL: [number, number, number] = [13, 148, 136];
const BRAND: [number, number, number] = [61, 99, 245];

export function buildCashFlowReportContent(inputs: CashFlowInputs, results: CashFlowResults): BusinessReportContent {
  return {
    reportKind: "Professional Rental Cash Flow Report",
    filenameBase: "Rental_Cash_Flow_Report",
    coverSubtitle: "Rental Cash Flow Analysis",
    summaryCards: [
      { label: "Gross Monthly Rent", value: formatNPRShort(results.grossMonthlyRent), accent: "brand" },
      { label: "Effective Monthly Rent", value: formatNPRShort(results.effectiveMonthlyRent), accent: "green" },
      { label: "Monthly Expenses (Incl. EMI)", value: formatNPRShort(results.totalMonthlyExpensesExcludingEMI + inputs.emi), accent: "amber" },
      { label: "Net Monthly Cash Flow", value: formatNPRShort(results.netMonthlyCashFlow), accent: results.isPositive ? "green" : "red" },
      { label: "Status", value: results.isPositive ? "Positive Cash Flow" : "Negative Cash Flow", accent: results.isPositive ? "green" : "red" },
    ],
    summaryNarrative: `Based on the assumptions entered, this property generates ${formatNPRShort(results.effectiveMonthlyRent)} in effective monthly rent after vacancy. After the loan payment and all operating expenses, the estimated net monthly cash flow is ${formatNPRShort(results.netMonthlyCashFlow)} — a ${results.isPositive ? "positive" : "negative"} cash flow position.`,
    highlights: [
      { label: "Gross Monthly Rent", value: formatNPR(results.grossMonthlyRent) },
      { label: "Vacancy Loss", value: formatNPR(results.vacancyLoss) },
      { label: "Effective Monthly Rent", value: formatNPR(results.effectiveMonthlyRent) },
      { label: "EMI", value: formatNPR(inputs.emi) },
      { label: "Other Monthly Expenses", value: formatNPR(results.totalMonthlyExpensesExcludingEMI) },
      { label: "Net Monthly Cash Flow", value: formatNPR(results.netMonthlyCashFlow) },
      { label: "Annual Cash Flow", value: formatNPR(results.annualCashFlow) },
      { label: "Annual Rental Income", value: formatNPR(results.annualRentalIncome) },
      { label: "Annual Expenses", value: formatNPR(results.annualExpenses) },
    ],
    sections: [
      {
        title: "Cash Flow Analysis",
        intro: "Gross rent, reduced for vacancy, the loan payment, and every operating expense, to arrive at net monthly cash flow.",
        columns: ["Metric", "Result"],
        rows: [
          ["Gross Monthly Rent", formatNPR(results.grossMonthlyRent)],
          ["Vacancy Loss", `-${formatNPR(results.vacancyLoss)}`],
          ["EMI", `-${formatNPR(inputs.emi)}`],
          ["Property Tax", `-${formatNPR(inputs.propertyTaxMonthly)}`],
          ["Insurance", `-${formatNPR(inputs.insuranceMonthly)}`],
          ["Maintenance", `-${formatNPR(inputs.maintenanceMonthly)}`],
          ["Property Management", `-${formatNPR(inputs.managementMonthly)}`],
          ["Utilities", `-${formatNPR(inputs.utilitiesMonthly)}`],
          ["Other Expenses", `-${formatNPR(inputs.otherExpensesMonthly)}`],
          ["Net Monthly Cash Flow", formatNPR(results.netMonthlyCashFlow)],
        ],
      },
      {
        title: "Annual Summary",
        columns: ["Metric", "Result"],
        rows: [
          ["Annual Rental Income", formatNPR(results.annualRentalIncome)],
          ["Annual Expenses", formatNPR(results.annualExpenses)],
          ["Annual Cash Flow", formatNPR(results.annualCashFlow)],
          ["Cash Flow After Debt", formatNPR(results.cashFlowAfterDebt)],
          ["Cash-on-Cash Return", results.cashOnCashReturnPct === null ? "Not calculated (no cash invested entered)" : formatPercent(results.cashOnCashReturnPct)],
        ],
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "Monthly Rent vs Expenses",
        categories: ["This Property"],
        series: [
          { label: "Effective Rent", values: [results.effectiveMonthlyRent], color: TEAL },
          { label: "EMI + Expenses", values: [inputs.emi + results.totalMonthlyExpensesExcludingEMI], color: BRAND },
        ],
      },
    ],
    keyFindings: [
      `Effective monthly rent, after ${formatPercent(inputs.vacancyRatePct, 1)} vacancy, is estimated at ${formatNPRShort(results.effectiveMonthlyRent)}.`,
      `After the EMI of ${formatNPRShort(inputs.emi)} and ${formatNPRShort(results.totalMonthlyExpensesExcludingEMI)} in other monthly expenses, net monthly cash flow is ${formatNPRShort(results.netMonthlyCashFlow)}.`,
      `This property shows ${results.isPositive ? "a positive" : "a negative"} cash flow position on a monthly basis.`,
      results.cashOnCashReturnPct !== null
        ? `Cash-on-cash return, based on the cash invested entered, is estimated at ${formatPercent(results.cashOnCashReturnPct)}.`
        : "Cash-on-cash return was not calculated, as no cash invested amount was entered.",
    ],
    assumptions: [
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Vacancy Rate", value: formatPercent(inputs.vacancyRatePct, 1) },
      { label: "EMI", value: formatNPR(inputs.emi) },
      { label: "Property Tax (Monthly)", value: formatNPR(inputs.propertyTaxMonthly) },
      { label: "Insurance (Monthly)", value: formatNPR(inputs.insuranceMonthly) },
      { label: "Maintenance (Monthly)", value: formatNPR(inputs.maintenanceMonthly) },
      { label: "Property Management (Monthly)", value: formatNPR(inputs.managementMonthly) },
      { label: "Utilities (Monthly)", value: formatNPR(inputs.utilitiesMonthly) },
      { label: "Other Expenses (Monthly)", value: formatNPR(inputs.otherExpensesMonthly) },
    ],
    methodology: [
      {
        title: "Net Monthly Cash Flow",
        body: "Gross rent is reduced for estimated vacancy to give effective rent. The loan payment (EMI) and every monthly operating expense are then subtracted to arrive at net monthly cash flow — the actual cash the property generates (or requires) each month.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, this property is estimated to produce ${results.isPositive ? "a positive" : "a negative"} net monthly cash flow of ${formatNPRShort(Math.abs(results.netMonthlyCashFlow))}, or ${formatNPRShort(Math.abs(results.annualCashFlow))} per year.`,
    ],
  };
}
