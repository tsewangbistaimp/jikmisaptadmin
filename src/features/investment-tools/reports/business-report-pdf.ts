// ============================================================================
// Real Estate Investment Tools — shared professional business-report PDF
// engine.
//
// One layout engine, reused by all 9 calculators (see ./content/*.ts for
// each calculator's data mapping, and ./GenerateReportButton.tsx for the
// UI that drives this). This module performs NO investment math — every
// number it draws was already computed by the calling calculator's own
// lib/calculations.ts functions and handed in via BusinessReportContent.
// Isolated from every other PDF in this app (does not import
// src/lib/export-pdf.ts, src/lib/investment-report-pdf.ts, or
// ../pdf/investment-tools-report-pdf.ts) — built with jsPDF + jspdf-autotable,
// already dependencies used the same way elsewhere.
// ============================================================================
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { BusinessReportContent, ReportChart, ReportSettings, ReportSummaryCard } from "./types";
import { formatNPRShort } from "../lib/format";

const NAVY: [number, number, number] = [21, 40, 72];
const BRAND: [number, number, number] = [61, 99, 245];
const TEAL: [number, number, number] = [13, 148, 136];
const AMBER: [number, number, number] = [180, 83, 9];
const RED: [number, number, number] = [190, 18, 60];
const GREEN: [number, number, number] = [4, 120, 87];
const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const FAINT: [number, number, number] = [148, 163, 184];
const BORDER: [number, number, number] = [226, 232, 240];
const FAINT_BG: [number, number, number] = [248, 250, 252];

const ACCENT_RGB: Record<string, [number, number, number]> = {
  brand: BRAND,
  green: GREEN,
  red: RED,
  amber: AMBER,
  slate: SLATE,
};

const MARGIN = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function short(n: number): string {
  return formatNPRShort(n).replace("NPR ", "");
}

// ---- Layout primitives -------------------------------------------------

function sectionHeading(doc: jsPDF, y: number, eyebrow: string, title: string, subtitle?: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND);
  doc.text(eyebrow.toUpperCase(), MARGIN, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...SLATE);
  doc.text(title, MARGIN, y);
  y += 8;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(2.2);
  doc.line(MARGIN, y, MARGIN + 46, y);
  doc.setLineWidth(1);
  y += 20;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(subtitle, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 13 + 10;
  }
  return y;
}

function paragraph(doc: jsPDF, y: number, text: string, opts?: { fontSize?: number; color?: [number, number, number]; bold?: boolean }): number {
  const fontSize = opts?.fontSize ?? 9.5;
  const color = opts?.color ?? SLATE;
  const lineHeight = fontSize * 1.5;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * lineHeight;
}

function calloutBox(
  doc: jsPDF,
  y: number,
  text: string,
  opts?: { bg?: [number, number, number]; border?: [number, number, number]; textColor?: [number, number, number]; label?: string }
): number {
  const fontSize = 9;
  const lineHeight = fontSize * 1.55;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, CONTENT_W - 32);
  const labelH = opts?.label ? 16 : 0;
  const boxH = lines.length * lineHeight + labelH + 24;
  doc.setFillColor(...(opts?.bg ?? FAINT_BG));
  doc.setDrawColor(...(opts?.border ?? BORDER));
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 6, 6, "FD");
  let ty = y + 18;
  if (opts?.label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...(opts?.textColor ?? SLATE));
    doc.text(opts.label.toUpperCase(), MARGIN + 16, ty);
    ty += labelH;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...(opts?.textColor ?? SLATE));
  doc.text(lines, MARGIN + 16, ty);
  return y + boxH + 16;
}

function bulletList(doc: jsPDF, y: number, items: string[], dotColor: [number, number, number] = BRAND): number {
  const fontSize = 9.3;
  const lineHeight = fontSize * 1.45;
  let yy = y;
  items.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(item, CONTENT_W - 16);
    doc.setFillColor(...dotColor);
    doc.circle(MARGIN + 3, yy - 3, 2, "F");
    doc.setTextColor(...SLATE);
    doc.text(lines, MARGIN + 14, yy);
    yy += lines.length * lineHeight + 7;
  });
  return yy;
}

function summaryCardsGrid(doc: jsPDF, y: number, items: ReportSummaryCard[], perRow = 3): number {
  const gap = 10;
  const w = (CONTENT_W - gap * (perRow - 1)) / perRow;
  const h = 46;
  items.forEach((item, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = MARGIN + col * (w + gap);
    const yy = y + row * (h + gap);
    doc.setFillColor(...FAINT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, yy, w, h, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x + 10, yy + 16, { maxWidth: w - 20 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...ACCENT_RGB[item.accent ?? "slate"]);
    doc.text(item.value, x + 10, yy + 34, { maxWidth: w - 20 });
  });
  const rows = Math.ceil(items.length / perRow);
  return y + rows * (h + gap);
}

function kvTable(doc: jsPDF, y: number, head: string[], rows: (string | number)[][]): number {
  autoTable(doc, {
    startY: y,
    head: [head],
    body: rows,
    margin: { left: MARGIN, right: MARGIN, bottom: 56 },
    styles: { fontSize: 9, cellPadding: 6.5, textColor: SLATE, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: CONTENT_W * 0.42 } },
    alternateRowStyles: { fillColor: FAINT_BG },
    showHead: "everyPage",
  });
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return (withTable.lastAutoTable?.finalY ?? y) + 22;
}

function lineChart(doc: jsPDF, y: number, chart: Extract<ReportChart, { kind: "line" }>): number {
  const chartH = 140;
  const chartW = CONTENT_W;
  const x0 = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(chart.title, MARGIN, y);
  const top = y + 14;
  const baseline = top + chartH;

  const allVals = chart.series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allVals);
  const minVal = Math.min(0, ...allVals);
  const range = Math.max(1, maxVal - minVal);

  doc.setDrawColor(...BORDER);
  doc.line(x0, baseline, x0 + chartW, baseline);

  const n = chart.categories.length;
  const stepX = n > 1 ? chartW / (n - 1) : chartW;
  const toXY = (i: number, v: number): [number, number] => [x0 + i * stepX, baseline - ((v - minVal) / range) * (chartH - 10)];

  chart.series.forEach((s) => {
    doc.setDrawColor(...s.color);
    doc.setLineWidth(1.6);
    for (let i = 0; i < s.values.length - 1; i++) {
      const [x1, y1] = toXY(i, s.values[i]);
      const [x2, y2] = toXY(i + 1, s.values[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
    doc.setLineWidth(1);
  });

  const labelEvery = n > 10 ? Math.ceil(n / 8) : 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  chart.categories.forEach((cat, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    const [x] = toXY(i, 0);
    doc.text(String(cat), x, baseline + 13, { align: "center" });
  });

  const legendY = baseline + 30;
  let lx = x0;
  chart.series.forEach((s) => {
    doc.setFillColor(...s.color);
    doc.rect(lx, legendY - 7, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...SLATE);
    doc.text(s.label, lx + 12, legendY);
    lx += doc.getTextWidth(s.label) + 34;
  });

  return legendY + 20;
}

function barChart(doc: jsPDF, y: number, chart: Extract<ReportChart, { kind: "bar" }>): number {
  const chartH = 130;
  const chartW = CONTENT_W;
  const x0 = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(chart.title, MARGIN, y);
  const top = y + 14;
  const baseline = top + chartH;

  const allVals = chart.series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allVals);
  const minVal = Math.min(0, ...allVals);
  const range = Math.max(1, maxVal - minVal);
  const zeroY = baseline - ((0 - minVal) / range) * chartH;

  doc.setDrawColor(...BORDER);
  doc.line(x0, zeroY, x0 + chartW, zeroY);

  const seriesCount = Math.max(1, chart.series.length);
  const groupW = chartW / chart.categories.length;
  const barW = Math.min(34, (groupW * 0.7) / seriesCount);
  const gapBetween = 6;
  const totalBarsWidth = seriesCount * barW + (seriesCount - 1) * gapBetween;

  chart.categories.forEach((cat, i) => {
    const groupX = x0 + i * groupW + groupW / 2;
    const startX = groupX - totalBarsWidth / 2;
    chart.series.forEach((s, si) => {
      const val = s.values[i] ?? 0;
      const h = (val / range) * chartH;
      const bx = startX + si * (barW + gapBetween);
      doc.setFillColor(...s.color);
      doc.rect(bx, h >= 0 ? zeroY - h : zeroY, barW, Math.abs(h), "F");
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    doc.text(cat, groupX, baseline + 14, { align: "center" });
  });

  const legendY = baseline + 32;
  let lx = x0;
  chart.series.forEach((s) => {
    doc.setFillColor(...s.color);
    doc.rect(lx, legendY - 7, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...SLATE);
    doc.text(s.label, lx + 12, legendY);
    lx += doc.getTextWidth(s.label) + 34;
  });

  return legendY + 20;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 60) {
    doc.addPage();
    return 64;
  }
  return y;
}

// ---- Page builders -------------------------------------------------------

function metaLines(settings: ReportSettings): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (settings.clientName) out.push({ label: "Prepared for", value: settings.clientName });
  if (settings.propertyName) out.push({ label: "Property", value: settings.propertyName });
  if (settings.propertyAddress) out.push({ label: "Address", value: settings.propertyAddress });
  if (settings.periodLabel) out.push({ label: "Analysis Period", value: settings.periodLabel });
  if (settings.companyName) out.push({ label: "Company", value: settings.companyName });
  if (settings.preparedBy) out.push({ label: "Prepared by", value: settings.preparedBy });
  return out;
}

function drawCover(doc: jsPDF, content: BusinessReportContent, settings: ReportSettings) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 210, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(150, 175, 255);
  doc.text("JIKMISAPARTMENT — REAL ESTATE INVESTMENT TOOLS", MARGIN, 64);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize((settings.reportTitle || "REAL ESTATE INVESTMENT ANALYSIS").toUpperCase(), CONTENT_W);
  doc.text(titleLines, MARGIN, 100);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(196, 210, 245);
  doc.text(content.coverSubtitle, MARGIN, 100 + titleLines.length * 26 + 12);

  let y = 250;
  const today = settings.reportDate
    ? new Date(settings.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const lines = [...metaLines(settings), { label: "Date", value: today }];
  const rowH = 34;
  lines.forEach((line, i) => {
    const yy = y + i * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(line.label.toUpperCase(), MARGIN, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...SLATE);
    doc.text(line.value, MARGIN, yy + 16);
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, yy + 24, PAGE_W - MARGIN, yy + 24);
  });

  const bottomY = PAGE_H - 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...FAINT);
  doc.text(content.reportKind, MARGIN, bottomY, { maxWidth: CONTENT_W });
}

function drawExecutiveSummary(doc: jsPDF, content: BusinessReportContent) {
  let y = sectionHeading(doc, 64, "Executive Summary", "Financial Snapshot", "The most important numbers from this analysis, at a glance.");
  if (content.summaryCards.length > 0) {
    y = summaryCardsGrid(doc, y, content.summaryCards, 3);
    y += 16;
  }
  paragraph(doc, y, content.summaryNarrative);
}

function drawFinancialHighlights(doc: jsPDF, content: BusinessReportContent) {
  const y = sectionHeading(doc, 64, "Financial Highlights", "Key Metrics Summary", "Key figures from this analysis, in one place.");
  kvTable(
    doc,
    y,
    ["Metric", "Result"],
    content.highlights.map((h) => [h.label, h.value])
  );
}

function drawDetailedSections(doc: jsPDF, content: BusinessReportContent) {
  content.sections.forEach((section, i) => {
    doc.addPage();
    let y = sectionHeading(doc, 64, "Detailed Financial Analysis", `${i + 1}. ${section.title}`, section.note);
    if (section.intro) {
      y = paragraph(doc, y, section.intro);
      y += 10;
    }
    if (section.rows.length > 0) {
      kvTable(doc, y, section.columns, section.rows);
    }
  });
}

function drawCharts(doc: jsPDF, content: BusinessReportContent) {
  if (content.charts.length === 0) return;
  doc.addPage();
  let y = sectionHeading(doc, 64, "Visual Analysis", "Charts", "Visual summary of the figures in this report.");
  content.charts.forEach((chart, i) => {
    if (i > 0) y = ensureSpace(doc, y, 200);
    y = (chart.kind === "line" ? lineChart(doc, y, chart) : barChart(doc, y, chart)) + 10;
  });
}

function drawKeyFindings(doc: jsPDF, content: BusinessReportContent) {
  doc.addPage();
  const y = sectionHeading(doc, 64, "Key Findings", "What the Numbers Show", "Observations drawn directly from the figures in this report.");
  bulletList(doc, y + 4, content.keyFindings);
}

function drawRisks(doc: jsPDF) {
  doc.addPage();
  let y = sectionHeading(doc, 64, "Risk Analysis", "Risks & Considerations", "Every projection in this report is an estimate. Actual results may differ because of:");
  const risks = [
    "Property market conditions — demand, location trends, and the broader economy affect resale value and rentability.",
    "Interest rate changes — if financing has a variable/floating rate, payments shown here can rise or fall over time.",
    "Vacancy — rental figures assume continuous occupancy; unoccupied periods reduce actual income.",
    "Rental price changes — market rents can move differently than the assumptions used in this analysis.",
    "Maintenance — repairs and upkeep can exceed the estimates used here.",
    "Taxes — property taxes and related charges can change over time.",
    "Insurance — premiums are not guaranteed to remain constant.",
    "Unexpected repairs — structural, legal, or other unplanned costs are not included in this analysis.",
    "Property transaction costs — brokerage, registration, and transfer costs may not be fully reflected.",
    "Appreciation — actual property appreciation may differ from the assumed rate; values can rise, fall, or stay flat.",
  ];
  y = bulletList(doc, y + 4, risks, AMBER);
  y += 6;
  y = ensureSpace(doc, y, 90);
  calloutBox(doc, y, "This report does not guarantee any investment outcome. All figures are estimates based on the assumptions entered.", {
    label: "Note",
    bg: [255, 251, 235],
    border: [253, 230, 138],
    textColor: [146, 64, 14],
  });
}

function drawAssumptions(doc: jsPDF, content: BusinessReportContent) {
  doc.addPage();
  const y = sectionHeading(doc, 64, "Assumptions", "Investment Assumptions", "Every input used to calculate the figures in this report.");
  kvTable(
    doc,
    y,
    ["Assumption", "Value"],
    content.assumptions.map((a) => [a.label, a.value])
  );
}

function drawMethodology(doc: jsPDF, content: BusinessReportContent) {
  doc.addPage();
  let y = sectionHeading(doc, 64, "Methodology", "Calculation Methodology", "How the figures in this report are calculated, in plain language.");
  content.methodology.forEach(({ title, body }) => {
    y = ensureSpace(doc, y, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...BRAND);
    doc.text(title, MARGIN, y);
    y += 14;
    y = paragraph(doc, y, body, { fontSize: 9 });
    y += 12;
  });
}

function drawConclusion(doc: jsPDF, content: BusinessReportContent) {
  doc.addPage();
  let y = sectionHeading(doc, 64, "Conclusion", "Investment Summary", undefined);
  content.conclusionParagraphs.forEach((p) => {
    y = paragraph(doc, y, p);
    y += 10;
  });
  y = ensureSpace(doc, y, 110);
  y += 6;
  calloutBox(
    doc,
    y,
    "This report is an estimate based on the assumptions and information entered by the user. Actual investment performance may differ due to market conditions, financing terms, rental performance, operating costs, taxes, transaction costs, and other factors. This report is for informational purposes only and does not constitute financial, investment, tax, accounting, or legal advice.",
    { label: "Disclaimer", bg: [255, 241, 242], border: [254, 205, 211], textColor: [159, 18, 57] }
  );
}

function drawHeadersAndFooters(doc: jsPDF, content: BusinessReportContent) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text(content.reportKind.toUpperCase(), MARGIN, 30);
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, 38, PAGE_W - MARGIN, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text("Jikmis Apartment — Real Estate Investment Tools", MARGIN, PAGE_H - 24);
    doc.text(`Page ${i - 1} of ${pageCount - 1}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }
}

// ---- Public entry points ----------------------------------------------------

export function buildBusinessReportDoc(content: BusinessReportContent, settings: ReportSettings): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawCover(doc, content, settings);
  doc.addPage();
  drawExecutiveSummary(doc, content);
  doc.addPage();
  drawFinancialHighlights(doc, content);
  drawDetailedSections(doc, content);
  drawCharts(doc, content);
  drawKeyFindings(doc, content);
  drawRisks(doc);
  drawAssumptions(doc, content);
  drawMethodology(doc, content);
  drawConclusion(doc, content);

  drawHeadersAndFooters(doc, content);
  return doc;
}

export function downloadBusinessReportPdf(content: BusinessReportContent, settings: ReportSettings) {
  const doc = buildBusinessReportDoc(content, settings);
  doc.save(`${content.filenameBase}.pdf`);
}

/** Blob URL for an <iframe> preview. Caller is responsible for revoking it
 *  (URL.revokeObjectURL) when the preview is closed. */
export function getBusinessReportPreviewUrl(content: BusinessReportContent, settings: ReportSettings): string {
  const doc = buildBusinessReportDoc(content, settings);
  return doc.output("bloburl").toString();
}
