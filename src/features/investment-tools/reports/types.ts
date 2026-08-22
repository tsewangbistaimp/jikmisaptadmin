// ============================================================================
// Real Estate Investment Tools — professional business report contract.
//
// Each of the 9 calculators maps its own already-computed results into this
// shape (see ./content/*.ts) and hands it to the single shared PDF engine
// (./business-report-pdf.ts). No calculation happens in this file or in the
// engine — every number arriving here was already produced by the
// calculator's own lib/calculations.ts functions.
// ============================================================================

/** Optional, user-entered report metadata. Empty fields are simply omitted
 *  from the rendered report — never shown as blank labels. */
export interface ReportSettings {
  reportTitle?: string;
  clientName?: string;
  propertyName?: string;
  propertyAddress?: string;
  companyName?: string;
  preparedBy?: string;
  reportDate?: string;
  /** Only meaningful for calculators with a period concept (e.g. Projection). */
  periodLabel?: string;
}

export type Accent = "brand" | "green" | "red" | "amber" | "slate";

export interface ReportSummaryCard {
  label: string;
  value: string;
  accent?: Accent;
}

export interface ReportSection {
  title: string;
  note?: string;
  columns: string[];
  rows: (string | number)[][];
  /** Optional freeform explanatory paragraph shown above the table. */
  intro?: string;
}

export interface ReportLineChart {
  kind: "line";
  title: string;
  categories: (string | number)[];
  series: { label: string; values: number[]; color: [number, number, number] }[];
}

export interface ReportBarChart {
  kind: "bar";
  title: string;
  categories: string[];
  series: { label: string; values: number[]; color: [number, number, number] }[];
}

export type ReportChart = ReportLineChart | ReportBarChart;

export interface BusinessReportContent {
  /** e.g. "Professional Mortgage Analysis Report" — shown on the cover. */
  reportKind: string;
  /** e.g. "Real_Estate_Mortgage_Analysis" — becomes "<base>.pdf". */
  filenameBase: string;
  /** e.g. "Mortgage / EMI Analysis" — cover subtitle. */
  coverSubtitle: string;
  summaryCards: ReportSummaryCard[];
  summaryNarrative: string;
  highlights: { label: string; value: string }[];
  sections: ReportSection[];
  charts: ReportChart[];
  keyFindings: string[];
  assumptions: { label: string; value: string }[];
  methodology: { title: string; body: string }[];
  conclusionParagraphs: string[];
}
