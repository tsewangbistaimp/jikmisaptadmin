import type { RentalRoiInputs, RentalRoiResults } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const TEAL: [number, number, number] = [13, 148, 136];
const BRAND: [number, number, number] = [61, 99, 245];

export function buildRentalRoiReportContent(inputs: RentalRoiInputs, results: RentalRoiResults): BusinessReportContent {
  const positive = results.annualCashFlow >= 0;
  return {
    reportKind: "Professional Rental Investment Report",
    filenameBase: "Rental_ROI_Investment_Report",
    coverSubtitle: "Rental ROI Analysis",
    summaryCards: [
      { label: "Property Price", value: formatNPRShort(inputs.propertyPrice), accent: "brand" },
      { label: "Loan Amount", value: formatNPRShort(results.loanAmount) },
      { label: "Monthly EMI", value: formatNPR(results.monthlyEMI), accent: "amber" },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent), accent: "green" },
      { label: "Annual Cash Flow", value: formatNPRShort(results.annualCashFlow), accent: positive ? "green" : "red" },
      { label: "Rental ROI", value: formatPercent(results.rentalROIPct) },
    ],
    summaryNarrative: `Based on the assumptions entered, this property is expected to generate ${positive ? "a positive" : "a negative"} annual cash flow of ${formatNPRShort(Math.abs(results.annualCashFlow))} after debt payments and operating expenses. Cash-on-cash return is estimated at ${formatPercent(results.cashOnCashReturnPct)}, and rental ROI — which also factors in estimated appreciation — is estimated at ${formatPercent(results.rentalROIPct)}.`,
    highlights: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: formatNPR(inputs.downPayment) },
      { label: "Loan Amount", value: formatNPR(results.loanAmount) },
      { label: "Monthly EMI", value: formatNPR(results.monthlyEMI) },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Annual Rental Income (After Vacancy)", value: formatNPR(results.effectiveAnnualRent) },
      { label: "Annual Expenses", value: formatNPR(results.annualExpenses) },
      { label: "Net Operating Income", value: formatNPR(results.netOperatingIncome) },
      { label: "Annual Cash Flow", value: formatNPR(results.annualCashFlow) },
      { label: "Cash-on-Cash Return", value: formatPercent(results.cashOnCashReturnPct) },
      { label: "Rental ROI", value: formatPercent(results.rentalROIPct) },
    ],
    sections: [
      {
        title: "Financing Analysis",
        columns: ["Metric", "Result"],
        rows: [
          ["Property Price", formatNPR(inputs.propertyPrice)],
          ["Down Payment", formatNPR(inputs.downPayment)],
          ["Loan Amount", formatNPR(results.loanAmount)],
          ["Interest Rate", formatPercent(inputs.annualRatePct, 2)],
          ["Loan Term", `${inputs.loanTermYears} years`],
          ["Monthly EMI", formatNPR(results.monthlyEMI)],
        ],
      },
      {
        title: "Rental Income Analysis",
        intro: "Gross rent, reduced for vacancy, management fees, and operating costs.",
        columns: ["Metric", "Result"],
        rows: [
          ["Gross Annual Rent", formatNPR(results.grossAnnualRent)],
          ["Vacancy Loss", formatNPR(results.vacancyLoss)],
          ["Effective Annual Rent", formatNPR(results.effectiveAnnualRent)],
          ["Management Fee", formatNPR(results.managementFee)],
          ["Annual Expenses (Total)", formatNPR(results.annualExpenses)],
          ["Net Operating Income", formatNPR(results.netOperatingIncome)],
        ],
      },
      {
        title: "Cash Flow Analysis",
        columns: ["Metric", "Result"],
        rows: [
          ["Annual Debt Service (EMI × 12)", formatNPR(results.annualDebtService)],
          ["Annual Cash Flow", formatNPR(results.annualCashFlow)],
          ["Cash Invested (Down Payment)", formatNPR(results.cashInvested)],
          ["Cash-on-Cash Return", formatPercent(results.cashOnCashReturnPct)],
          ["Estimated Annual Appreciation", formatNPR(results.annualAppreciationAmount)],
          ["Rental ROI (Cash Flow + Appreciation)", formatPercent(results.rentalROIPct)],
        ],
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "Annual Rental Income vs Expenses",
        categories: ["This Property"],
        series: [
          { label: "Effective Rental Income", values: [results.effectiveAnnualRent], color: TEAL },
          { label: "Expenses + Debt Service", values: [results.annualExpenses + results.annualDebtService], color: BRAND },
        ],
      },
    ],
    keyFindings: [
      `Effective annual rental income (after vacancy) is estimated at ${formatNPRShort(results.effectiveAnnualRent)}, against ${formatNPRShort(results.annualExpenses)} in annual operating expenses.`,
      `After the annual loan payment of ${formatNPRShort(results.annualDebtService)}, this property is estimated to produce ${positive ? "a positive" : "a negative"} cash flow of ${formatNPRShort(Math.abs(results.annualCashFlow))} per year.`,
      `Cash-on-cash return (cash flow only) is estimated at ${formatPercent(results.cashOnCashReturnPct)}; rental ROI (cash flow plus estimated appreciation) is estimated at ${formatPercent(results.rentalROIPct)}.`,
      `Estimated property value after one year, at the assumed appreciation rate, is ${formatNPRShort(results.estimatedPropertyValueYear1)}.`,
    ],
    assumptions: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: formatNPR(inputs.downPayment) },
      { label: "Interest Rate", value: formatPercent(inputs.annualRatePct, 2) },
      { label: "Loan Term", value: `${inputs.loanTermYears} years` },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Monthly Expenses (Other)", value: formatNPR(inputs.monthlyExpenses) },
      { label: "Annual Maintenance", value: formatNPR(inputs.annualMaintenance) },
      { label: "Annual Property Tax", value: formatNPR(inputs.propertyTaxAnnual) },
      { label: "Annual Insurance", value: formatNPR(inputs.insuranceAnnual) },
      { label: "Management Fee", value: formatPercent(inputs.managementFeePct, 1) },
      { label: "Vacancy Rate", value: formatPercent(inputs.vacancyRatePct, 1) },
      { label: "Annual Appreciation", value: formatPercent(inputs.annualAppreciationPct, 1) },
    ],
    methodology: [
      {
        title: "Net Operating Income & Cash Flow",
        body: "Effective rent (gross rent less vacancy) minus operating expenses gives net operating income. Subtracting the annual loan payment (EMI × 12) gives annual cash flow — the cash left over each year after every cost.",
      },
      {
        title: "Cash-on-Cash Return vs Rental ROI",
        body: "Cash-on-cash return divides annual cash flow by the cash invested (down payment). Rental ROI goes further, adding the property's estimated yearly appreciation to cash flow before dividing by cash invested — giving a fuller picture of total return.",
      },
    ],
    conclusionParagraphs: [
      `Based on the assumptions provided, this property is projected to run ${positive ? "a positive" : "a negative"} annual cash flow of ${formatNPRShort(Math.abs(results.annualCashFlow))}.`,
      `The model indicates a cash-on-cash return of ${formatPercent(results.cashOnCashReturnPct)} and a rental ROI of ${formatPercent(results.rentalROIPct)}, based on the rent, expenses, financing terms, and appreciation rate entered.`,
    ],
  };
}
