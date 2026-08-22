import type { AffordabilityInputs, AffordabilityResults } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];
const TEAL: [number, number, number] = [13, 148, 136];

export function buildAffordabilityReportContent(inputs: AffordabilityInputs, results: AffordabilityResults): BusinessReportContent {
  return {
    reportKind: "Professional Property Affordability Report",
    filenameBase: "Property_Affordability_Report",
    coverSubtitle: "Property Affordability Analysis",
    summaryCards: [
      { label: "Estimated Affordable Price", value: formatNPRShort(results.maxEstimatedPropertyPrice), accent: "brand" },
      { label: "Estimated Monthly EMI", value: formatNPRShort(results.estimatedEMI), accent: "amber" },
      { label: "Estimated Down Payment", value: formatNPRShort(results.requiredDownPayment) },
      { label: "Resulting DTI Ratio", value: formatPercent(results.dtiRatioPct) },
      { label: "Remaining Monthly Income", value: formatNPRShort(results.remainingMonthlyIncome), accent: "green" },
    ],
    summaryNarrative: `Based on the income, existing debt, and target debt-to-income ratio entered, this analysis estimates an affordable property price of ${formatNPRShort(results.maxEstimatedPropertyPrice)}, supported by a monthly loan payment of ${formatNPR(results.estimatedEMI)} and a down payment of ${formatNPRShort(results.requiredDownPayment)}.`,
    highlights: [
      { label: "Total Monthly Income", value: formatNPR(results.totalMonthlyIncome) },
      { label: "Existing Monthly Debt", value: formatNPR(inputs.existingMonthlyDebt) },
      { label: "Desired DTI Ratio", value: formatPercent(inputs.desiredDTIPct, 1) },
      { label: "Max Affordable Monthly Payment", value: formatNPR(results.maxAffordableMonthlyPayment) },
      { label: "Max Estimated Loan", value: formatNPR(results.maxEstimatedLoan) },
      { label: "Max Estimated Property Price", value: formatNPR(results.maxEstimatedPropertyPrice) },
      { label: "Required Down Payment", value: formatNPR(results.requiredDownPayment) },
      { label: "Estimated EMI", value: formatNPR(results.estimatedEMI) },
      { label: "Resulting DTI Ratio", value: formatPercent(results.dtiRatioPct) },
      { label: "Remaining Monthly Income", value: formatNPR(results.remainingMonthlyIncome) },
    ],
    sections: [
      {
        title: "Affordability Analysis",
        intro: "Maximum affordable monthly payment is derived from income, existing debt, and the target debt-to-income ratio; the property price is then estimated from that payment using the loan's interest rate and term.",
        columns: ["Metric", "Result"],
        rows: [
          ["Total Monthly Income", formatNPR(results.totalMonthlyIncome)],
          ["Existing Monthly Debt", formatNPR(inputs.existingMonthlyDebt)],
          ["Desired DTI Ratio", formatPercent(inputs.desiredDTIPct, 1)],
          ["Max Affordable Monthly Payment", formatNPR(results.maxAffordableMonthlyPayment)],
          ["Interest Rate", formatPercent(inputs.annualRatePct, 2)],
          ["Loan Term", `${inputs.termYears} years`],
          ["Max Estimated Loan", formatNPR(results.maxEstimatedLoan)],
          ["Available Down Payment", formatNPR(inputs.availableDownPayment)],
          ["Max Estimated Property Price", formatNPR(results.maxEstimatedPropertyPrice)],
        ],
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "Monthly Income Allocation",
        categories: ["Monthly Budget"],
        series: [
          { label: "Existing Debt", values: [inputs.existingMonthlyDebt], color: TEAL },
          { label: "Estimated EMI", values: [results.estimatedEMI], color: BRAND },
        ],
      },
    ],
    keyFindings: [
      `Based on ${formatNPRShort(results.totalMonthlyIncome)} in total monthly income and a target debt-to-income ratio of ${formatPercent(inputs.desiredDTIPct, 1)}, the maximum affordable monthly payment is estimated at ${formatNPRShort(results.maxAffordableMonthlyPayment)}.`,
      `This supports an estimated maximum loan of ${formatNPRShort(results.maxEstimatedLoan)}, and combined with the available down payment of ${formatNPRShort(inputs.availableDownPayment)}, an estimated affordable property price of ${formatNPRShort(results.maxEstimatedPropertyPrice)}.`,
      `After the estimated EMI and existing debt, ${formatNPRShort(results.remainingMonthlyIncome)} of monthly income remains, resulting in a debt-to-income ratio of ${formatPercent(results.dtiRatioPct)}.`,
    ],
    assumptions: [
      { label: "Monthly Income", value: formatNPR(inputs.monthlyIncome) },
      { label: "Other Monthly Income", value: formatNPR(inputs.otherMonthlyIncome) },
      { label: "Existing Monthly Debt", value: formatNPR(inputs.existingMonthlyDebt) },
      { label: "Available Down Payment", value: formatNPR(inputs.availableDownPayment) },
      { label: "Interest Rate", value: formatPercent(inputs.annualRatePct, 2) },
      { label: "Loan Term", value: `${inputs.termYears} years` },
      { label: "Desired DTI Ratio", value: formatPercent(inputs.desiredDTIPct, 1) },
    ],
    methodology: [
      {
        title: "Affordability Calculation",
        body: "The maximum affordable monthly payment is total income multiplied by the desired debt-to-income ratio, minus existing debt. That payment is then converted into a maximum loan amount using the standard amortizing-loan formula in reverse, and the available down payment is added to estimate the maximum affordable property price.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, the model estimates an affordable property price of ${formatNPRShort(results.maxEstimatedPropertyPrice)}, with a monthly payment of ${formatNPR(results.estimatedEMI)} and a down payment of ${formatNPRShort(results.requiredDownPayment)}.`,
    ],
  };
}
