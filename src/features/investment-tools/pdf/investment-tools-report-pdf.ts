// ============================================================================
// Real Estate Investment Tools — single-property professional PDF report.
//
// Isolated from every other PDF in this app: it does not import
// src/lib/export-pdf.ts, src/lib/export-invoice-pdf.ts, or
// src/lib/investment-report-pdf.ts (the Loan Calculator's apartment-vs-house
// report). This module performs NO investment math of its own — every
// figure comes from `buildSinglePropertyBundle` in ../lib/calculations.ts,
// the exact same function the on-screen report tool uses to show its live
// preview. Built with jsPDF + jspdf-autotable (already a dependency, used
// the same way elsewhere in this app) — drawn with vector shapes/text so
// pagination, margins, and wrapping stay exact and print-ready at A4.
// ============================================================================
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { type SinglePropertyBundle, buildSinglePropertyBundle, type SinglePropertyInputs } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";

const NAVY: [number, number, number] = [21, 40, 72];
const BRAND: [number, number, number] = [61, 99, 245];
const TEAL: [number, number, number] = [13, 148, 136];
const AMBER: [number, number, number] = [180, 83, 9];
const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const FAINT: [number, number, number] = [148, 163, 184];
const BORDER: [number, number, number] = [226, 232, 240];
const FAINT_BG: [number, number, number] = [248, 250, 252];

const MARGIN = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const REPORT_TITLE = "Real Estate Investment Analysis";

const TYPE_LABELS: Record<string, string> = { apartment: "Apartment", house: "House", commercial: "Commercial Property", other: "Property" };

function short(n: number): string {
  return formatNPRShort(n).replace("NPR ", "");
}

// ---- Layout helpers (self-contained; not shared with other PDF modules) ---

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

function paragraph(doc: jsPDF, y: number, text: string, opts?: { fontSize?: number; color?: [number, number, number]; maxWidth?: number }): number {
  const fontSize = opts?.fontSize ?? 9.5;
  const color = opts?.color ?? SLATE;
  const maxWidth = opts?.maxWidth ?? CONTENT_W;
  const lineHeight = fontSize * 1.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
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

interface StatItem {
  label: string;
  value: string;
  accent?: [number, number, number];
}

function statCards(doc: jsPDF, y: number, items: StatItem[], perRow = 3): number {
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
    doc.setTextColor(...(item.accent ?? SLATE));
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
    columnStyles: { 0: { fontStyle: "bold", cellWidth: CONTENT_W * 0.45 }, 1: { halign: "right" } },
    alternateRowStyles: { fillColor: FAINT_BG },
    showHead: "everyPage",
  });
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return (withTable.lastAutoTable?.finalY ?? y) + 22;
}

function yearTable(doc: jsPDF, y: number, rows: { year: number; propertyValue: number; loanBalance: number; ownerEquity: number; rentalIncome: number; netCashFlow: number }[]): number {
  autoTable(doc, {
    startY: y,
    head: [["Year", "Property Value", "Loan Balance", "Owner Equity", "Rental Income", "Net Cash Flow"]],
    body: rows.map((r) => [r.year, formatNPR(r.propertyValue), formatNPR(r.loanBalance), formatNPR(r.ownerEquity), formatNPR(r.rentalIncome), formatNPR(r.netCashFlow)]),
    margin: { left: MARGIN, right: MARGIN, bottom: 56 },
    styles: { fontSize: 8, cellPadding: 5, textColor: SLATE, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    alternateRowStyles: { fillColor: FAINT_BG },
    showHead: "everyPage",
  });
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return (withTable.lastAutoTable?.finalY ?? y) + 20;
}

/** Multi-series vector line chart (no image rasterization). */
function lineChart(
  doc: jsPDF,
  y: number,
  title: string,
  years: number[],
  series: { label: string; values: number[]; color: [number, number, number] }[]
): number {
  const chartH = 140;
  const chartW = CONTENT_W;
  const x0 = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(title, MARGIN, y);
  const top = y + 14;
  const baseline = top + chartH;

  const allVals = series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allVals);
  const minVal = Math.min(0, ...allVals);
  const range = Math.max(1, maxVal - minVal);

  doc.setDrawColor(...BORDER);
  doc.line(x0, baseline, x0 + chartW, baseline);

  const stepX = years.length > 1 ? chartW / (years.length - 1) : chartW;
  const toXY = (i: number, v: number): [number, number] => {
    const x = x0 + i * stepX;
    const yy = baseline - ((v - minVal) / range) * (chartH - 10);
    return [x, yy];
  };

  series.forEach((s) => {
    doc.setDrawColor(...s.color);
    doc.setLineWidth(1.6);
    for (let i = 0; i < s.values.length - 1; i++) {
      const [x1, y1] = toXY(i, s.values[i]);
      const [x2, y2] = toXY(i + 1, s.values[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
    doc.setLineWidth(1);
  });

  // x-axis year labels (sparse, to avoid overlap)
  const labelEvery = years.length > 10 ? Math.ceil(years.length / 8) : 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  years.forEach((yr, i) => {
    if (i % labelEvery !== 0 && i !== years.length - 1) return;
    const [x] = toXY(i, 0);
    doc.text(`Y${yr}`, x, baseline + 13, { align: "center" });
  });

  const legendY = baseline + 30;
  let lx = x0;
  series.forEach((s) => {
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

function groupedBarChart(
  doc: jsPDF,
  y: number,
  title: string,
  categories: string[],
  seriesA: { label: string; values: number[]; color: [number, number, number] },
  seriesB: { label: string; values: number[]; color: [number, number, number] }
): number {
  const chartH = 130;
  const chartW = CONTENT_W;
  const x0 = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(title, MARGIN, y);
  const top = y + 14;
  const baseline = top + chartH;

  const allVals = [...seriesA.values, ...seriesB.values];
  const maxVal = Math.max(1, ...allVals);
  const minVal = Math.min(0, ...allVals);
  const range = Math.max(1, maxVal - minVal);
  const zeroY = baseline - ((0 - minVal) / range) * chartH;

  doc.setDrawColor(...BORDER);
  doc.line(x0, zeroY, x0 + chartW, zeroY);

  const groupW = chartW / categories.length;
  const barW = Math.min(40, groupW * 0.22);
  const gapBetween = 8;

  categories.forEach((cat, i) => {
    const groupX = x0 + i * groupW + groupW / 2;
    const aVal = seriesA.values[i] ?? 0;
    const bVal = seriesB.values[i] ?? 0;
    const aH = (aVal / range) * chartH;
    const bH = (bVal / range) * chartH;
    const aX = groupX - barW - gapBetween / 2;
    const bX = groupX + gapBetween / 2;

    doc.setFillColor(...seriesA.color);
    doc.rect(aX, aH >= 0 ? zeroY - aH : zeroY, barW, Math.abs(aH), "F");
    doc.setFillColor(...seriesB.color);
    doc.rect(bX, bH >= 0 ? zeroY - bH : zeroY, barW, Math.abs(bH), "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    doc.text(cat, groupX, baseline + 14, { align: "center" });
  });

  const legendY = baseline + 32;
  doc.setFillColor(...seriesA.color);
  doc.rect(x0, legendY - 7, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...SLATE);
  doc.text(seriesA.label, x0 + 12, legendY);
  doc.setFillColor(...seriesB.color);
  doc.rect(x0 + 130, legendY - 7, 8, 8, "F");
  doc.text(seriesB.label, x0 + 142, legendY);

  return legendY + 20;
}

// ---- Page builders ----------------------------------------------------------

function drawCover(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs } = bundle;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 230, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(150, 175, 255);
  doc.text("JIKMISAPARTMENT — INVESTMENT TOOLS", MARGIN, 70);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text(REPORT_TITLE.toUpperCase(), MARGIN, 108);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(196, 210, 245);
  doc.text("Property Investment Report", MARGIN, 138);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  let y = 270;
  y = statCards(doc, y, [
    { label: "Property Name", value: inputs.propertyName || "Untitled Property" },
    { label: "Property Type", value: TYPE_LABELS[inputs.propertyType] ?? "Property" },
    { label: "Report Date", value: today },
  ]);
  y += 6;
  y = statCards(doc, y, [
    { label: "Analysis Period", value: `${inputs.projectionYears} Years` },
    { label: "Purchase Price", value: formatNPRShort(inputs.propertyPrice), accent: BRAND },
    { label: "Monthly Rent", value: formatNPRShort(inputs.monthlyRent), accent: TEAL },
  ]);

  y += 30;
  paragraph(doc, y, "This report was generated using the Real Estate Investment Tools calculator, from the assumptions entered by the user. All figures are estimates for planning purposes.", {
    fontSize: 8.5,
    color: MUTED,
  });
}

function drawExecutiveSummary(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, mortgage, rentalRoi, appreciation } = bundle;
  let y = sectionHeading(doc, 64, "Page 2", "Executive Summary", "The most important numbers from this analysis, at a glance.");

  y = statCards(
    doc,
    y,
    [
      { label: "Purchase Price", value: formatNPRShort(inputs.propertyPrice), accent: BRAND },
      { label: "Down Payment", value: formatNPRShort(mortgage.downPayment) },
      { label: "Loan Amount", value: formatNPRShort(mortgage.loanAmount) },
      { label: "Monthly EMI", value: formatNPRShort(mortgage.monthlyEMI), accent: AMBER },
      { label: "Monthly Rent", value: formatNPRShort(inputs.monthlyRent), accent: TEAL },
      { label: "Annual Cash Flow", value: formatNPRShort(rentalRoi.annualCashFlow), accent: rentalRoi.annualCashFlow >= 0 ? [4, 120, 87] : [190, 18, 60] },
      { label: "Rental Yield (Gross)", value: formatPercent((inputs.monthlyRent * 12 * 100) / Math.max(1, inputs.propertyPrice)) },
      { label: `Value After ${inputs.projectionYears} Yrs`, value: formatNPRShort(appreciation.futureValue), accent: BRAND },
      { label: "Rental ROI", value: formatPercent(rentalRoi.rentalROIPct) },
    ],
    3
  );

  y += 20;
  calloutBox(
    doc,
    y,
    "These figures are calculated entirely from the assumptions entered into the calculator — purchase price, down payment, interest rate, loan term, rent, appreciation, and expenses. Changing any input will change every number in this report.",
    { label: "Important", bg: [255, 251, 235], border: [253, 230, 138], textColor: [146, 64, 14] }
  );
}

function drawAssumptions(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs } = bundle;
  let y = sectionHeading(doc, 64, "Page 3", "Investment Assumptions", "Every input used to calculate the figures in this report.");
  const rows: (string | number)[][] = [
    ["Property Name", inputs.propertyName || "Untitled Property"],
    ["Property Type", TYPE_LABELS[inputs.propertyType] ?? "Property"],
    ["Purchase Price", formatNPR(inputs.propertyPrice)],
    ["Down Payment %", formatPercent(inputs.downPaymentPct, 1)],
    ["Interest Rate (Annual)", formatPercent(inputs.annualRatePct, 2)],
    ["Loan Term", `${inputs.termYears} years`],
    ["Monthly Rent", formatNPR(inputs.monthlyRent)],
    ["Monthly Expenses (Other)", formatNPR(inputs.monthlyExpenses)],
    ["Annual Maintenance", formatNPR(inputs.annualMaintenance)],
    ["Annual Property Tax", formatNPR(inputs.propertyTaxAnnual)],
    ["Annual Insurance", formatNPR(inputs.insuranceAnnual)],
    ["Management Fee", formatPercent(inputs.managementFeePct, 1)],
    ["Vacancy Rate", formatPercent(inputs.vacancyRatePct, 1)],
    ["Annual Appreciation", formatPercent(inputs.annualAppreciationPct, 1)],
    ["Annual Rent Increase", formatPercent(inputs.annualRentIncreasePct, 1)],
    ["Analysis Period", `${inputs.projectionYears} years`],
  ];
  kvTable(doc, y, ["Assumption", "Value"], rows);
}

function drawLoanAnalysis(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, mortgage } = bundle;
  let y = sectionHeading(doc, 64, "Page 4", "Loan Analysis", "How this property's mortgage is structured, and what it costs over its full term.");
  const rows: (string | number)[][] = [
    ["Property Price", formatNPR(inputs.propertyPrice)],
    ["Down Payment", formatNPR(mortgage.downPayment)],
    ["Loan Amount", formatNPR(mortgage.loanAmount)],
    ["Interest Rate", formatPercent(inputs.annualRatePct, 2)],
    ["Monthly EMI", formatNPR(mortgage.monthlyEMI)],
    ["Total Interest (Full Term)", formatNPR(mortgage.totalInterest)],
    ["Total Amount Paid (Full Term)", formatNPR(mortgage.totalAmountPaid)],
  ];
  y = kvTable(doc, y, ["Metric", "Value"], rows);
  calloutBox(doc, y, "EMI (Equated Monthly Instalment) is the fixed monthly payment required to repay the loan — it includes both principal (the amount borrowed) and interest (the cost of borrowing it).", { label: "What is EMI?" });
}

function drawRentalAnalysis(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, rentalRoi, rentalYield } = bundle;
  let y = sectionHeading(doc, 64, "Page 5", "Rental Analysis", "Expected rental income, costs, and return.");
  const rows: (string | number)[][] = [
    ["Monthly Rent", formatNPR(inputs.monthlyRent)],
    ["Annual Rent", formatNPR(rentalYield.annualRent)],
    ["Annual Expenses", formatNPR(rentalRoi.annualExpenses)],
    ["Gross Rental Yield", formatPercent(rentalYield.grossYieldPct)],
    ["Net Rental Yield", formatPercent(rentalYield.netYieldPct)],
    ["Monthly Cash Flow", formatNPR(rentalRoi.annualCashFlow / 12)],
    ["Annual Cash Flow", formatNPR(rentalRoi.annualCashFlow)],
    ["Rental ROI", formatPercent(rentalRoi.rentalROIPct)],
    ["Cash-on-Cash Return", formatPercent(rentalRoi.cashOnCashReturnPct)],
  ];
  kvTable(doc, y, ["Metric", "Value"], rows);
}

function drawPropertyGrowth(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, appreciation, projection } = bundle;
  const last = projection[projection.length - 1];
  let y = sectionHeading(doc, 64, "Page 6", "Property Growth", `Estimated value and equity growth over ${inputs.projectionYears} years.`);
  const rows: (string | number)[][] = [
    ["Current Value", formatNPR(appreciation.currentValue)],
    [`Future Value (${inputs.projectionYears} Yrs)`, formatNPR(appreciation.futureValue)],
    ["Total Appreciation", formatNPR(appreciation.totalIncrease)],
    ["Percentage Increase", formatPercent(appreciation.percentIncrease)],
    ["Remaining Loan Balance", formatNPR(last?.loanBalance ?? 0)],
    ["Owner Equity", formatNPR(last?.ownerEquity ?? 0)],
  ];
  kvTable(doc, y, ["Metric", "Value"], rows);
}

function drawProjectionTable(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, projection } = bundle;
  const y = sectionHeading(doc, 64, "Page 7", `${inputs.projectionYears}-Year Projection`, "Year-by-year results for this property.");
  yearTable(doc, y, projection);
}

function drawChartsPage(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { projection } = bundle;
  let y = sectionHeading(doc, 64, "Page 8", "Charts", "Visual summary of the projection on the previous page.");
  const years = projection.map((r) => r.year);
  y = lineChart(doc, y, "Property Value, Owner Equity & Loan Balance", years, [
    { label: "Property Value", values: projection.map((r) => r.propertyValue), color: BRAND },
    { label: "Owner Equity", values: projection.map((r) => r.ownerEquity), color: TEAL },
    { label: "Loan Balance", values: projection.map((r) => r.loanBalance), color: AMBER },
  ]);
  y += 10;
  const milestoneYears = [5, 10, 20].filter((yr) => projection.some((r) => r.year === yr));
  const milestoneCats = milestoneYears.map((yr) => `Year ${yr}`);
  const rentalAt = milestoneYears.map((yr) => projection.find((r) => r.year === yr)?.rentalIncome ?? 0);
  const cashFlowAt = milestoneYears.map((yr) => projection.find((r) => r.year === yr)?.netCashFlow ?? 0);
  groupedBarChart(doc, y, "Rental Income & Net Cash Flow by Year", milestoneCats, { label: "Rental Income", values: rentalAt, color: TEAL }, { label: "Net Cash Flow", values: cashFlowAt, color: BRAND });
}

function drawKeyFindings(doc: jsPDF, bundle: SinglePropertyBundle) {
  const { inputs, mortgage, rentalRoi, appreciation, projection } = bundle;
  let y = sectionHeading(doc, 64, "Page 9", "Key Findings", "The important results from this analysis, explained simply.");
  const last = projection[projection.length - 1];
  const findings = [
    `This ${TYPE_LABELS[inputs.propertyType]?.toLowerCase() ?? "property"} costs ${formatNPRShort(inputs.propertyPrice)}, requiring a down payment of ${formatNPRShort(mortgage.downPayment)} and a loan of ${formatNPRShort(mortgage.loanAmount)}.`,
    `The estimated monthly loan payment (EMI) is ${formatNPRShort(mortgage.monthlyEMI)}, based on a ${formatPercent(inputs.annualRatePct, 1)} interest rate over ${inputs.termYears} years.`,
    `At ${formatNPRShort(inputs.monthlyRent)} in monthly rent, this property is estimated to produce ${rentalRoi.annualCashFlow >= 0 ? "a positive" : "a negative"} annual cash flow of ${formatNPRShort(Math.abs(rentalRoi.annualCashFlow))} after all expenses and the loan payment.`,
    `Over ${inputs.projectionYears} years, the property's value is estimated to grow from ${formatNPRShort(appreciation.currentValue)} to ${formatNPRShort(appreciation.futureValue)} — an increase of ${formatPercent(appreciation.percentIncrease)}.`,
    `By year ${inputs.projectionYears}, the estimated owner equity (property value minus remaining loan) is ${formatNPRShort(last?.ownerEquity ?? 0)}.`,
    `Total rental income collected over ${inputs.projectionYears} years is estimated at ${formatNPRShort(last?.cumulativeRentalIncome ?? 0)}.`,
    `The estimated cumulative investment return over ${inputs.projectionYears} years — combining appreciation and rental income, minus expenses and interest — is ${formatNPRShort(last?.cumulativeReturn ?? 0)}.`,
  ];
  bulletList(doc, y + 4, findings);
}

function drawRisksAndAssumptions(doc: jsPDF) {
  let y = sectionHeading(doc, 64, "Page 10", "Risks & Assumptions", "Every projection in this report is an estimate. Actual results can differ because of:");
  const risks = [
    "Market conditions — property demand, location trends, and the broader economy affect resale value and rentability.",
    "Interest rates — if the loan has a variable/floating rate, the EMI shown here can rise or fall over the loan term.",
    "Vacancy — the rental figures assume the property is rented continuously; unoccupied months reduce actual income.",
    "Maintenance — repairs, renovations, and upkeep can exceed the estimates used in this report.",
    "Taxes — property taxes, fees, and other charges can change over time.",
    "Rental changes — market rents can rise or fall differently than the rent-increase assumption used here.",
    "Property appreciation — actual appreciation may differ from the assumed rate; values can rise, fall, or stay flat.",
    "Unexpected costs — structural, legal, or other unplanned expenses are not included in this analysis.",
  ];
  y = bulletList(doc, y + 4, risks, AMBER);
  y += 10;
  calloutBox(
    doc,
    y,
    "This report is an estimate based on the assumptions entered by the user. It is for informational purposes only and is not financial, investment, tax, legal, or professional advice.",
    { label: "Disclaimer", bg: [255, 241, 242], border: [254, 205, 211], textColor: [159, 18, 57] }
  );
}

function drawHeadersAndFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text(REPORT_TITLE.toUpperCase(), MARGIN, 30);
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, 38, PAGE_W - MARGIN, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text("Jikmis Apartment — Real Estate Investment Tools", MARGIN, PAGE_H - 24);
    doc.text(`Page ${i - 1} of ${pageCount - 1}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }
}

// ---- Public entry point -----------------------------------------------------

export function downloadInvestmentToolsReportPdf(inputs: SinglePropertyInputs) {
  const bundle = buildSinglePropertyBundle(inputs);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawCover(doc, bundle);
  doc.addPage();
  drawExecutiveSummary(doc, bundle);
  doc.addPage();
  drawAssumptions(doc, bundle);
  doc.addPage();
  drawLoanAnalysis(doc, bundle);
  doc.addPage();
  drawRentalAnalysis(doc, bundle);
  doc.addPage();
  drawPropertyGrowth(doc, bundle);
  doc.addPage();
  drawProjectionTable(doc, bundle);
  doc.addPage();
  drawChartsPage(doc, bundle);
  doc.addPage();
  drawKeyFindings(doc, bundle);
  doc.addPage();
  drawRisksAndAssumptions(doc);

  drawHeadersAndFooters(doc);

  const safeName = (inputs.propertyName || "Property").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`Real_Estate_Investment_Report_${safeName}.pdf`);
}
