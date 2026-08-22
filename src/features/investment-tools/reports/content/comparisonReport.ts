import type { ComparisonPropertyResult } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

// The comparison table can have up to 6 columns (Metric + up to 5
// properties), so it uses the shorter "NPR 2.50 Cr"-style formatting to keep
// cells readable rather than the fully-expanded digit-grouped form used
// elsewhere in this report.
const fmt = formatNPRShort;

const COLORS: [number, number, number][] = [
  [61, 99, 245],
  [13, 148, 136],
  [180, 83, 9],
  [190, 18, 60],
  [124, 58, 237],
];

function bestIndex(values: number[], mode: "min" | "max"): number {
  if (values.length === 0) return -1;
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (mode === "min" ? values[i] < values[idx] : values[i] > values[idx]) idx = i;
  }
  return idx;
}

function row(label: string, mode: "min" | "max", format: (v: number) => string, values: number[]): (string | number)[] {
  const best = bestIndex(values, mode);
  return [label, ...values.map((v, i) => `${format(v)}${i === best ? "  (Best)" : ""}`)];
}

export function buildComparisonReportContent(results: ComparisonPropertyResult[]): BusinessReportContent {
  const names = results.map((r) => r.name);

  const rows: (string | number)[][] = [
    row("Purchase Price", "min", fmt, results.map((r) => r.price)),
    row("Down Payment", "min", fmt, results.map((r) => r.downPayment)),
    row("Loan Amount", "min", fmt, results.map((r) => r.loanAmount)),
    row("Monthly EMI", "min", fmt, results.map((r) => r.monthlyEMI)),
    row("Total Interest (Full Term)", "min", fmt, results.map((r) => r.totalInterestFullTerm)),
    row("Monthly Rent", "max", fmt, results.map((r) => r.monthlyRent)),
    row("Annual Rent", "max", fmt, results.map((r) => r.annualRent)),
    row("Rental Yield", "max", (v) => formatPercent(v), results.map((r) => r.rentalYieldPct)),
    row("Monthly Cash Flow", "max", fmt, results.map((r) => r.monthlyCashFlow)),
    row("5-Year Property Value", "max", fmt, results.map((r) => r.value5yr)),
    row("10-Year Property Value", "max", fmt, results.map((r) => r.value10yr)),
    row("Remaining Loan (5-Yr)", "min", fmt, results.map((r) => r.remainingLoan5yr)),
    row("Remaining Loan (10-Yr)", "min", fmt, results.map((r) => r.remainingLoan10yr)),
    row("Owner Equity (5-Yr)", "max", fmt, results.map((r) => r.equity5yr)),
    row("Owner Equity (10-Yr)", "max", fmt, results.map((r) => r.equity10yr)),
    row("Total Rental Income (10-Yr)", "max", fmt, results.map((r) => r.totalRentalIncome10yr)),
    row("Total Expenses (10-Yr)", "min", fmt, results.map((r) => r.totalExpenses10yr)),
    row("Estimated Return (10-Yr)", "max", fmt, results.map((r) => r.estimatedReturn10yr)),
  ];

  const lowerCapital = names[bestIndex(results.map((r) => -r.downPayment), "max")];
  const higherRent = names[bestIndex(results.map((r) => r.annualRent), "max")];
  const higherYield = names[bestIndex(results.map((r) => r.rentalYieldPct), "max")];
  const strongerCashFlow = names[bestIndex(results.map((r) => r.monthlyCashFlow), "max")];
  const greaterValue10 = names[bestIndex(results.map((r) => r.value10yr), "max")];
  const greaterEquity10 = names[bestIndex(results.map((r) => r.equity10yr), "max")];

  return {
    reportKind: "Professional Property Comparison Report",
    filenameBase: "Property_Comparison_Report",
    coverSubtitle: `Property Comparison — ${results.length} Properties`,
    summaryCards: results.slice(0, 3).flatMap((r, i) => [
      { label: `${r.name} — Price`, value: formatNPRShort(r.price), accent: "brand" as const },
      { label: `${r.name} — Monthly EMI`, value: formatNPRShort(r.monthlyEMI), accent: "amber" as const },
    ]).slice(0, 6),
    summaryNarrative: `This report compares ${results.length} properties (${names.join(", ")}) across purchase cost, financing, rental performance, and projected growth. ${lowerCapital} requires the lowest initial capital, and ${strongerCashFlow} shows the strongest monthly cash flow, based on the assumptions entered for each property.`,
    highlights: results.map((r) => ({ label: r.name, value: `${formatNPR(r.price)} · EMI ${formatNPR(r.monthlyEMI)} · Yield ${formatPercent(r.rentalYieldPct)}` })),
    sections: [
      {
        title: "Full Property Comparison",
        intro: "Every metric compared side by side. \"(Best)\" marks the strongest figure per row — not a recommendation.",
        columns: ["Metric", ...names],
        rows,
      },
    ],
    charts: [
      {
        kind: "bar",
        title: "10-Year Projected Property Value",
        categories: names,
        series: [{ label: "Value After 10 Years", values: results.map((r) => r.value10yr), color: COLORS[0] }],
      },
      {
        kind: "bar",
        title: "Monthly Cash Flow",
        categories: names,
        series: [{ label: "Monthly Cash Flow", values: results.map((r) => r.monthlyCashFlow), color: COLORS[1] }],
      },
    ],
    keyFindings: [
      `${lowerCapital} has the lower initial capital requirement among the properties compared.`,
      `${higherRent} generates the higher rental income.`,
      `${higherYield} has the higher rental yield.`,
      `${strongerCashFlow} shows the stronger monthly cash flow.`,
      `${greaterValue10} has the greater projected value after 10 years.`,
      `${greaterEquity10} has the greater projected owner equity after 10 years.`,
    ],
    assumptions: results.flatMap((r) => [
      { label: `${r.name} — Purchase Price`, value: formatNPR(r.price) },
      { label: `${r.name} — Monthly Rent`, value: formatNPR(r.monthlyRent) },
    ]),
    methodology: [
      {
        title: "Comparison Methodology",
        body: "Each property is evaluated using the same mortgage, rental yield, and appreciation calculations, based on the individual price, financing, rent, and growth assumptions entered for that property.",
      },
    ],
    conclusionParagraphs: [
      `Based on the assumptions provided, ${lowerCapital} requires the least upfront capital, while ${strongerCashFlow} produces the strongest monthly cash flow among the properties compared.`,
      `Over a 10-year horizon, the model indicates ${greaterValue10} reaching the greatest projected value and ${greaterEquity10} building the greatest projected owner equity.`,
      "Which property is the stronger overall choice depends on which of these factors matters most to the reader — this report does not make that determination.",
    ],
  };
}
