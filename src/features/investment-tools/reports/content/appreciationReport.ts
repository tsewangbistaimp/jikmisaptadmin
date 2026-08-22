import { calcAppreciation } from "../../lib/calculations";
import type { BusinessReportContent } from "../types";
import { formatNPR, formatNPRShort, formatPercent } from "../../lib/format";

const BRAND: [number, number, number] = [61, 99, 245];

export function buildAppreciationReportContent(currentValue: number, annualAppreciationPct: number, years: number): BusinessReportContent {
  const results = calcAppreciation({ currentValue, annualAppreciationPct, years });

  return {
    reportKind: "Professional Property Appreciation Report",
    filenameBase: "Property_Appreciation_Report",
    coverSubtitle: `Property Appreciation Analysis — ${years} ${years === 1 ? "Year" : "Years"}`,
    summaryCards: [
      { label: "Current Value", value: formatNPRShort(results.currentValue), accent: "brand" },
      { label: `Future Value (${years} Yr)`, value: formatNPRShort(results.futureValue), accent: "green" },
      { label: "Total Increase", value: formatNPRShort(results.totalIncrease), accent: "green" },
      { label: "Percentage Increase", value: formatPercent(results.percentIncrease) },
    ],
    summaryNarrative: `Based on an assumed annual appreciation rate of ${formatPercent(annualAppreciationPct, 1)}, this property's value is projected to grow from ${formatNPRShort(results.currentValue)} to ${formatNPRShort(results.futureValue)} over ${years} ${years === 1 ? "year" : "years"} — an increase of ${formatPercent(results.percentIncrease)}.`,
    highlights: [
      { label: "Current Value", value: formatNPR(results.currentValue) },
      { label: "Annual Appreciation Rate", value: formatPercent(annualAppreciationPct, 1) },
      { label: "Analysis Period", value: `${years} ${years === 1 ? "year" : "years"}` },
      { label: "Future Value", value: formatNPR(results.futureValue) },
      { label: "Total Increase", value: formatNPR(results.totalIncrease) },
      { label: "Percentage Increase", value: formatPercent(results.percentIncrease) },
    ],
    sections: [
      {
        title: "Property Growth Analysis",
        intro: "Future value assumes the property gains value at a steady annual rate, compounded yearly.",
        columns: ["Metric", "Result"],
        rows: [
          ["Current Value", formatNPR(results.currentValue)],
          ["Annual Appreciation Rate", formatPercent(annualAppreciationPct, 1)],
          [`Future Value (${years} Yr)`, formatNPR(results.futureValue)],
          ["Total Increase", formatNPR(results.totalIncrease)],
          ["Percentage Increase", formatPercent(results.percentIncrease)],
        ],
      },
    ],
    charts: [
      {
        kind: "line",
        title: "Property Value Growth",
        categories: results.series.map((p) => `Y${p.year}`),
        series: [{ label: "Property Value", values: results.series.map((p) => p.value), color: BRAND }],
      },
    ],
    keyFindings: [
      `Starting from a current value of ${formatNPRShort(results.currentValue)}, the property is projected to reach ${formatNPRShort(results.futureValue)} after ${years} ${years === 1 ? "year" : "years"}.`,
      `This represents a total increase of ${formatNPRShort(results.totalIncrease)}, or ${formatPercent(results.percentIncrease)} of the current value.`,
    ],
    assumptions: [
      { label: "Current Property Value", value: formatNPR(results.currentValue) },
      { label: "Annual Appreciation Rate", value: formatPercent(annualAppreciationPct, 1) },
      { label: "Analysis Period", value: `${years} ${years === 1 ? "year" : "years"}` },
    ],
    methodology: [
      {
        title: "Property Appreciation",
        body: "Future value equals current value multiplied by (1 + annual appreciation rate) raised to the number of years — assuming steady, compounding annual growth.",
      },
    ],
    conclusionParagraphs: [
      `Under the selected scenario, the model indicates the property could be worth ${formatNPRShort(results.futureValue)} after ${years} ${years === 1 ? "year" : "years"}, assuming the ${formatPercent(annualAppreciationPct, 1)} annual appreciation rate holds over that period.`,
    ],
  };
}
