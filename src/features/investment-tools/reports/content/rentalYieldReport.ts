import type { RentalYieldInputs, RentalYieldResults } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];
const TEAL: [number, number, number] = [13, 148, 136];

export function buildRentalYieldReportContent(inputs: RentalYieldInputs, results: RentalYieldResults): BusinessReportContent {
  return {
    reportKind: "Professional Rental Yield Report",
    filenameBase: "Rental_Yield_Report",
    coverSubtitle: "Rental Yield Analysis",
    summaryCards: [
      { label: "Property Price", value: formatNPRShort(inputs.propertyPrice), accent: "brand" },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent), accent: "green" },
      { label: "Annual Rent", value: formatNPRShort(results.annualRent) },
      { label: "Gross Rental Yield", value: formatPercent(results.grossYieldPct), accent: "brand" },
      { label: "Net Rental Yield", value: formatPercent(results.netYieldPct), accent: results.netYieldPct >= 0 ? "green" : "red" },
    ],
    summaryNarrative: `Based on the assumptions entered, this property produces a gross rental yield of ${formatPercent(results.grossYieldPct)} before expenses, and a net rental yield of ${formatPercent(results.netYieldPct)} after accounting for ${formatNPRShort(inputs.annualExpenses)} in annual expenses.`,
    highlights: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Annual Rent", value: formatNPR(results.annualRent) },
      { label: "Annual Expenses", value: formatNPR(inputs.annualExpenses) },
      { label: "Gross Rental Yield", value: formatPercent(results.grossYieldPct) },
      { label: "Net Rental Yield", value: formatPercent(results.netYieldPct) },
    ],
    sections: [
      {
        title: "Rental Income Analysis",
        intro: "Gross yield looks at rent before expenses; net yield looks at rent after expenses.",
        columns: ["Metric", "Result"],
        rows: [
          ["Property Price", formatNPR(inputs.propertyPrice)],
          ["Monthly Rent", formatNPR(inputs.monthlyRent)],
          ["Annual Rent", formatNPR(results.annualRent)],
          ["Annual Expenses", formatNPR(inputs.annualExpenses)],
          ["Gross Rental Yield", formatPercent(results.grossYieldPct)],
          ["Net Rental Yield", formatPercent(results.netYieldPct)],
        ],
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "Gross vs Net Rental Yield",
        categories: ["This Property"],
        series: [
          { label: "Gross Yield %", values: [results.grossYieldPct], color: BRAND },
          { label: "Net Yield %", values: [results.netYieldPct], color: TEAL },
        ],
      },
    ],
    keyFindings: [
      `Annual rent of ${formatNPRShort(results.annualRent)} against a property price of ${formatNPRShort(inputs.propertyPrice)} gives a gross rental yield of ${formatPercent(results.grossYieldPct)}.`,
      `After ${formatNPRShort(inputs.annualExpenses)} in annual expenses, the net rental yield is estimated at ${formatPercent(results.netYieldPct)}.`,
    ],
    assumptions: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Annual Expenses", value: formatNPR(inputs.annualExpenses) },
    ],
    methodology: [
      {
        title: "Rental Yield",
        body: "Gross rental yield divides annual rent by the property price. Net rental yield subtracts annual expenses from annual rent first, giving a more realistic picture of the return after operating costs.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, this property's gross rental yield is ${formatPercent(results.grossYieldPct)}, and its net rental yield — after expenses — is ${formatPercent(results.netYieldPct)}.`,
    ],
  };
}
