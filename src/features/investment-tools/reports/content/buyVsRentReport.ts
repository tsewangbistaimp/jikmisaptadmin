import { compareBuyVsRent, type BuyVsRentInputs } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];
const ROSE: [number, number, number] = [225, 29, 72];

export function buildBuyVsRentReportContent(inputs: BuyVsRentInputs, years: number): BusinessReportContent {
  const series = compareBuyVsRent(inputs, years);
  const last = series[series.length - 1];
  const favorsBuying = (last?.difference ?? 0) >= 0;

  return {
    reportKind: "Professional Buy vs Rent Analysis Report",
    filenameBase: "Buy_vs_Rent_Analysis",
    coverSubtitle: `Buy vs Rent Analysis — ${years} Years`,
    summaryCards: [
      { label: "Property Price", value: formatNPRShort(inputs.propertyPrice), accent: "brand" },
      { label: "Monthly Rent", value: formatNPRShort(inputs.monthlyRent), accent: "green" },
      { label: `Buy — Net Position (Yr ${years})`, value: formatNPRShort(last?.buy.netPosition ?? 0), accent: "brand" },
      { label: `Rent — Net Position (Yr ${years})`, value: formatNPRShort(last?.rent.netPosition ?? 0), accent: "green" },
      { label: "Estimated Difference", value: formatNPRShort(Math.abs(last?.difference ?? 0)), accent: favorsBuying ? "green" : "amber" },
    ],
    summaryNarrative: `Based on the assumptions entered, after ${years} years the model estimates a net position of ${formatNPRShort(last?.buy.netPosition ?? 0)} for buying versus ${formatNPRShort(last?.rent.netPosition ?? 0)} for renting and investing the difference — a difference of ${formatNPRShort(Math.abs(last?.difference ?? 0))} in favor of ${favorsBuying ? "buying" : "renting"}, under the selected scenario.`,
    highlights: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: `Buy — Property Value (Yr ${years})`, value: formatNPR(last?.buy.propertyValue ?? 0) },
      { label: `Buy — Remaining Loan (Yr ${years})`, value: formatNPR(last?.buy.remainingLoan ?? 0) },
      { label: `Buy — Owner Equity (Yr ${years})`, value: formatNPR(last?.buy.ownerEquity ?? 0) },
      { label: `Buy — Net Position (Yr ${years})`, value: formatNPR(last?.buy.netPosition ?? 0) },
      { label: `Rent — Investment Value (Yr ${years})`, value: formatNPR(last?.rent.investmentValue ?? 0) },
      { label: `Rent — Net Position (Yr ${years})`, value: formatNPR(last?.rent.netPosition ?? 0) },
    ],
    sections: [
      {
        title: "Buy Scenario",
        columns: ["Metric", "Result"],
        rows: [
          ["Total Payments", formatNPR(last?.buy.totalPaid ?? 0)],
          ["Property Value", formatNPR(last?.buy.propertyValue ?? 0)],
          ["Remaining Loan", formatNPR(last?.buy.remainingLoan ?? 0)],
          ["Owner Equity", formatNPR(last?.buy.ownerEquity ?? 0)],
          ["Selling Costs", formatNPR(last?.buy.sellingCosts ?? 0)],
          ["Total Costs", formatNPR(last?.buy.totalCosts ?? 0)],
          ["Net Position (After Selling Costs)", formatNPR(last?.buy.netPosition ?? 0)],
        ],
      },
      {
        title: "Rent Scenario",
        columns: ["Metric", "Result"],
        rows: [
          ["Total Rent Paid", formatNPR(last?.rent.totalRentPaid ?? 0)],
          ["Investment Value of Saved Cash", formatNPR(last?.rent.investmentValue ?? 0)],
          ["Total Costs", formatNPR(last?.rent.totalCosts ?? 0)],
          ["Net Position", formatNPR(last?.rent.netPosition ?? 0)],
        ],
      },
    ],
    charts: [
      {
        kind: "line",
        title: "Estimated Net Position Over Time",
        categories: series.map((r) => `Y${r.year}`),
        series: [
          { label: "Buy — Net Position", values: series.map((r) => r.buy.netPosition), color: BRAND },
          { label: "Rent — Net Position", values: series.map((r) => r.rent.netPosition), color: ROSE },
        ],
      },
    ],
    keyFindings: [
      `After ${years} years, buying is projected to leave a net position of ${formatNPRShort(last?.buy.netPosition ?? 0)} (owner equity after estimated selling costs).`,
      `Renting and investing the difference is projected to leave a net position of ${formatNPRShort(last?.rent.netPosition ?? 0)}.`,
      `The estimated difference is ${formatNPRShort(Math.abs(last?.difference ?? 0))} in favor of ${favorsBuying ? "buying" : "renting"}, based on the assumptions entered.`,
    ],
    assumptions: [
      { label: "Property Price", value: formatNPR(inputs.propertyPrice) },
      { label: "Down Payment", value: `${inputs.downPaymentPct}%` },
      { label: "Interest Rate", value: `${inputs.annualRatePct}%` },
      { label: "Loan Term", value: `${inputs.termYears} years` },
      { label: "Annual Maintenance", value: formatNPR(inputs.annualMaintenance) },
      { label: "Annual Property Tax", value: formatNPR(inputs.propertyTaxAnnual) },
      { label: "Annual Insurance", value: formatNPR(inputs.insuranceAnnual) },
      { label: "Annual Appreciation", value: `${inputs.annualAppreciationPct}%` },
      { label: "Selling Costs", value: `${inputs.sellingCostsPct}%` },
      { label: "Monthly Rent", value: formatNPR(inputs.monthlyRent) },
      { label: "Annual Rent Increase", value: `${inputs.annualRentIncreasePct}%` },
      { label: "Expected Investment Return", value: `${inputs.expectedInvestmentReturnPct}%` },
      { label: "Analysis Period", value: `${years} years` },
    ],
    methodology: [
      {
        title: "Buy Net Position",
        body: "Owner equity (estimated property value minus remaining loan balance) minus estimated selling costs, at the end of the analysis period.",
      },
      {
        title: "Rent Net Position",
        body: "The down payment that would otherwise have been spent buying, plus the monthly difference between the cost of buying and the cost of renting, invested each month at the expected investment return rate.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, the model indicates ${favorsBuying ? "buying" : "renting"} results in a stronger estimated financial position after ${years} years, by approximately ${formatNPRShort(Math.abs(last?.difference ?? 0))}.`,
      "This is an estimate based on the assumptions provided and is not financial advice — small changes to interest rates, rent growth, or investment returns can change this result.",
    ],
  };
}
