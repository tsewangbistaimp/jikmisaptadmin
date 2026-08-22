import type { MortgageInputs, MortgageResults } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];
const AMBER: [number, number, number] = [180, 83, 9];

export function buildMortgageReportContent(inputs: MortgageInputs, results: MortgageResults): BusinessReportContent {
  return {
    reportKind: "Professional Mortgage Analysis Report",
    filenameBase: "Real_Estate_Mortgage_Analysis",
    coverSubtitle: "Mortgage / EMI Analysis",
    summaryCards: [
      { label: "Property Price", value: formatNPRShort(inputs.propertyPrice), accent: "brand" },
      { label: "Down Payment", value: formatNPRShort(results.downPayment) },
      { label: "Loan Amount", value: formatNPRShort(results.loanAmount) },
      { label: "Monthly EMI", value: formatNPRShort(results.monthlyEMI), accent: "amber" },
      { label: "Total Interest", value: formatNPRShort(results.totalInterest), accent: "red" },
      { label: "Total Amount Paid", value: formatNPRShort(results.totalAmountPaid) },
    ],
    summaryNarrative: `Based on the assumptions entered, this loan requires a down payment of ${formatNPRShort(results.downPayment)} and a monthly payment (EMI) of ${formatNPR(results.monthlyEMI)} over ${inputs.termYears} years. Across the full loan term, total interest paid is estimated at ${formatNPRShort(results.totalInterest)}, on top of the ${formatNPRShort(results.totalPrincipal)} principal borrowed.`,
    highlights: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: `${formatNPR(results.downPayment)} (${formatPercent(inputs.downPaymentPct, 1)})` },
      { label: "Loan Amount", value: formatNPR(results.loanAmount) },
      { label: "Interest Rate", value: formatPercent(inputs.annualRatePct, 2) },
      { label: "Loan Term", value: `${inputs.termYears} years` },
      { label: "Monthly EMI", value: formatNPR(results.monthlyEMI) },
      { label: "Total Payments", value: `${results.totalPayments} installments` },
      { label: "Total Principal", value: formatNPR(results.totalPrincipal) },
      { label: "Total Interest", value: formatNPR(results.totalInterest) },
      { label: "Total Amount Paid", value: formatNPR(results.totalAmountPaid) },
    ],
    sections: [
      {
        title: "Investment Overview",
        intro: "The purchase is financed through a combination of an upfront down payment and a bank loan.",
        columns: ["Metric", "Result"],
        rows: [
          ["Property Price", formatNPR(inputs.propertyPrice)],
          ["Down Payment %", formatPercent(inputs.downPaymentPct, 1)],
          ["Down Payment Amount", formatNPR(results.downPayment)],
          ["Loan Amount", formatNPR(results.loanAmount)],
        ],
      },
      {
        title: "Financing Analysis",
        intro: "The monthly EMI repays both principal and interest in equal instalments over the loan term.",
        columns: ["Metric", "Result"],
        rows: [
          ["Interest Rate", formatPercent(inputs.annualRatePct, 2)],
          ["Loan Term", `${inputs.termYears} years`],
          ["Monthly EMI", formatNPR(results.monthlyEMI)],
          ["Total Payments", `${results.totalPayments} installments`],
          ["Total Interest (Full Term)", formatNPR(results.totalInterest)],
          ["Total Amount Paid (Full Term)", formatNPR(results.totalAmountPaid)],
        ],
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "Principal vs Interest (Full Loan Term)",
        categories: ["Loan Breakdown"],
        series: [
          { label: "Principal", values: [results.totalPrincipal], color: BRAND },
          { label: "Interest", values: [results.totalInterest], color: AMBER },
        ],
      },
    ],
    keyFindings: [
      `This loan requires an upfront down payment of ${formatNPRShort(results.downPayment)}, equal to ${formatPercent(inputs.downPaymentPct, 1)} of the property price.`,
      `The estimated monthly payment (EMI) is ${formatNPR(results.monthlyEMI)}, based on a ${formatPercent(inputs.annualRatePct, 1)} annual interest rate over ${inputs.termYears} years.`,
      `Over the full loan term, total interest paid is estimated at ${formatNPRShort(results.totalInterest)} — ${results.totalPrincipal > 0 ? formatPercent((results.totalInterest / results.totalPrincipal) * 100, 0) : "0%"} of the amount borrowed.`,
      `In total, ${formatNPRShort(results.totalAmountPaid)} will be paid to the lender across ${results.totalPayments} monthly instalments.`,
    ],
    assumptions: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: formatPercent(inputs.downPaymentPct, 1) },
      { label: "Interest Rate", value: formatPercent(inputs.annualRatePct, 2) },
      { label: "Loan Term", value: `${inputs.termYears} years` },
    ],
    methodology: [
      {
        title: "Monthly Loan Payment (EMI)",
        body: "Calculated using the standard amortizing-loan formula, based on the loan amount, the monthly interest rate (annual rate divided by 12), and the total number of monthly payments (loan term multiplied by 12). This produces a fixed monthly payment that fully repays the loan by the end of its term.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, financing this property requires ${formatNPRShort(results.downPayment)} in upfront capital and an ongoing monthly commitment of ${formatNPR(results.monthlyEMI)}.`,
      `The model indicates a total financing cost of ${formatNPRShort(results.totalInterest)} in interest over the life of the loan, in addition to the ${formatNPRShort(results.totalPrincipal)} principal.`,
    ],
  };
}
