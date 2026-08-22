// ============================================================================
// Real-Estate Investment Analysis — professional PDF report generator.
//
// This is a brand-new, fully isolated module for the existing Loan
// Calculator page (src/pages/LoanCalculator.tsx). It performs NO investment
// math of its own: every figure in the PDF comes from
// `calculatePropertyResults`, the exact same pure function the on-screen
// calculator already uses for its results panels and its 5-year/10-year
// comparison table (via `calculateAtYear`). This module only calls that
// function at the two fixed horizons the report is structured around (5
// years and 10 years — mirroring the calculator's own "fixed 5-year and
// 10-year snapshots are independent of the analysis period" comparison
// table), then lays the same numbers out on paper. The handful of
// "key finding" / "final summary" sentences below only ever compare two
// already-computed numbers (A > B) to decide which side to name — that is
// not a new calculation, just a description of the calculator's own output.
//
// Built with jsPDF + jspdf-autotable, the same two building blocks already
// used by src/lib/export-pdf.ts and src/lib/export-invoice-pdf.ts elsewhere
// in this app — drawn directly via jsPDF's vector API (rects/lines/text)
// rather than rasterizing on-screen DOM, so pagination, margins, and text
// wrapping stay exact and print-ready at A4.
// ============================================================================
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  type PropertyInputs,
  type PropertyResults,
  calculatePropertyResults,
  formatNPR,
  formatNPRShorthand,
  formatPct,
} from "@/lib/loan-calculator";

// ---- Shared palette (reusing the app's existing brand/report colors) -----
const NAVY: [number, number, number] = [21, 40, 72]; // --color-navy-700
const BRAND: [number, number, number] = [61, 99, 245]; // --color-brand-500 — Apartment accent
const TEAL: [number, number, number] = [13, 148, 136]; // teal-600 — House accent
const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const FAINT: [number, number, number] = [148, 163, 184];
const BORDER: [number, number, number] = [226, 232, 240];
const FAINT_BG: [number, number, number] = [248, 250, 252];
const GREEN: [number, number, number] = [4, 120, 87];
const RED: [number, number, number] = [190, 18, 60];
const AMBER: [number, number, number] = [180, 83, 9];

const MARGIN = 40;
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const REPORT_TITLE = "Real Estate Investment Analysis";

function short(n: number): string {
  return formatNPRShorthand(n).replace("NPR ", "");
}

// ---- Low-level layout helpers ---------------------------------------------

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

function paragraph(
  doc: jsPDF,
  y: number,
  text: string,
  opts?: { fontSize?: number; color?: [number, number, number]; bold?: boolean; maxWidth?: number; x?: number }
): number {
  const fontSize = opts?.fontSize ?? 9.5;
  const color = opts?.color ?? SLATE;
  const maxWidth = opts?.maxWidth ?? CONTENT_W;
  const x = opts?.x ?? MARGIN;
  const lineHeight = fontSize * 1.5;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
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

function bulletList(doc: jsPDF, y: number, items: string[], opts?: { dotColor?: [number, number, number]; fontSize?: number }): number {
  const fontSize = opts?.fontSize ?? 9.3;
  const lineHeight = fontSize * 1.45;
  const dotColor = opts?.dotColor ?? BRAND;
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

function twoColTable(doc: jsPDF, y: number, head: string[], rows: (string | number)[][]): number {
  autoTable(doc, {
    startY: y,
    head: [head],
    body: rows,
    margin: { left: MARGIN, right: MARGIN, bottom: 56 },
    styles: { fontSize: 9, cellPadding: 7, textColor: SLATE, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.8 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CONTENT_W * 0.38 },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    alternateRowStyles: { fillColor: FAINT_BG },
    showHead: "everyPage",
  });
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return (withTable.lastAutoTable?.finalY ?? y) + 22;
}

/** Grouped two-series vertical bar chart, drawn with plain vector shapes. */
function groupedBarChart(
  doc: jsPDF,
  y: number,
  title: string,
  categories: string[],
  seriesA: { label: string; values: number[]; color: [number, number, number] },
  seriesB: { label: string; values: number[]; color: [number, number, number] }
): number {
  const chartH = 140;
  const chartW = CONTENT_W;
  const x0 = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(title, MARGIN, y);
  const chartTop = y + 14;
  const baseline = chartTop + chartH;

  const maxVal = Math.max(1, ...seriesA.values, ...seriesB.values);
  doc.setDrawColor(...BORDER);
  doc.line(x0, baseline, x0 + chartW, baseline);

  const groupW = chartW / categories.length;
  const barW = Math.min(50, groupW * 0.26);
  const gapBetween = 10;

  categories.forEach((cat, i) => {
    const groupX = x0 + i * groupW + groupW / 2;
    const aVal = seriesA.values[i] ?? 0;
    const bVal = seriesB.values[i] ?? 0;
    const aH = Math.max(1, (aVal / maxVal) * (chartH - 24));
    const bH = Math.max(1, (bVal / maxVal) * (chartH - 24));
    const aX = groupX - barW - gapBetween / 2;
    const bX = groupX + gapBetween / 2;

    doc.setFillColor(...seriesA.color);
    doc.rect(aX, baseline - aH, barW, aH, "F");
    doc.setFillColor(...seriesB.color);
    doc.rect(bX, baseline - bH, barW, bH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...seriesA.color);
    doc.text(short(aVal), aX + barW / 2, baseline - aH - 5, { align: "center" });
    doc.setTextColor(...seriesB.color);
    doc.text(short(bVal), bX + barW / 2, baseline - bH - 5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...MUTED);
    doc.text(cat, groupX, baseline + 15, { align: "center" });
  });

  const legendY = baseline + 34;
  doc.setFillColor(...seriesA.color);
  doc.rect(x0, legendY - 7, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...SLATE);
  doc.text(seriesA.label, x0 + 12, legendY);
  doc.setFillColor(...seriesB.color);
  doc.rect(x0 + 110, legendY - 7, 8, 8, "F");
  doc.text(seriesB.label, x0 + 122, legendY);

  return legendY + 20;
}

function winner(aVal: number, bVal: number, aName: string, bName: string): string {
  if (Math.abs(aVal - bVal) < 0.5) return "The two are essentially equal on this measure.";
  return aVal > bVal ? aName : bName;
}

// ---- Report data shape ------------------------------------------------------

interface ReportInputs {
  apartment: PropertyInputs;
  house: PropertyInputs;
}

interface Bundle {
  apt5: PropertyResults;
  apt10: PropertyResults;
  hse5: PropertyResults;
  hse10: PropertyResults;
}

// ---- Page builders -----------------------------------------------------------

function drawCover(doc: jsPDF, { apartment, house }: ReportInputs, { apt5, hse5 }: Bundle) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 230, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...([150, 175, 255] as [number, number, number]));
  doc.text("JIKMISAPARTMENT — INVESTMENT ANALYSIS", MARGIN, 70);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(REPORT_TITLE, CONTENT_W);
  doc.text(titleLines, MARGIN, 108);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(...([196, 210, 245] as [number, number, number]));
  doc.text("Apartment vs House — Loan & Investment Comparison", MARGIN, 108 + titleLines.length * 30 + 12);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = 270;
  const metaItems: StatItem[] = [
    { label: "Analysis Date", value: today },
    { label: "Properties Compared", value: "Apartment vs House" },
    { label: "Investment Outlook", value: "5-Year & 10-Year" },
  ];
  y = statCards(doc, y, metaItems, 3);

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("PROPERTY SNAPSHOT", MARGIN, y);
  y += 16;

  const colW = (CONTENT_W - 16) / 2;
  const cardH = 140;
  const drawSnapshotCard = (
    x: number,
    label: string,
    accent: [number, number, number],
    inputs: PropertyInputs,
    r5: PropertyResults
  ) => {
    doc.setFillColor(...FAINT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, colW, cardH, 8, 8, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, colW, 5, 8, 8, "F");
    doc.rect(x, y + 3, colW, 4, "F"); // square off the bottom of the accent bar

    let cy = y + 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text(label, x + 16, cy);
    cy += 22;

    const row = (l: string, v: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      doc.setTextColor(...MUTED);
      doc.text(l, x + 16, cy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      doc.text(v, x + colW - 16, cy, { align: "right" });
      cy += 19;
    };
    row("Purchase Price", formatNPRShorthand(inputs.price));
    row("Down Payment", formatNPRShorthand(r5.downPayment));
    row("Monthly EMI", formatNPRShorthand(r5.monthlyEMI));
    row("Monthly Rent", formatNPRShorthand(inputs.monthlyRent));
    row("Rental Yield", formatPct(r5.rentalYieldPct));
  };

  drawSnapshotCard(MARGIN, "Apartment", BRAND, apartment, apt5);
  drawSnapshotCard(MARGIN + colW + 16, "House", TEAL, house, hse5);

  y += cardH + 26;
  paragraph(doc, y, "This report was generated from the assumptions entered into the Jikmis Apartment Loan Calculator. All figures are estimates for planning purposes.", {
    fontSize: 8.5,
    color: MUTED,
  });
}

function drawExecutiveSummary(doc: jsPDF, { apartment, house }: ReportInputs, { apt5, apt10, hse5, hse10 }: Bundle) {
  let y = sectionHeading(
    doc,
    64,
    "Page 2",
    "Executive Summary",
    "A quick, plain-language look at both properties — no finance background required."
  );

  const items: StatItem[] = [
    { label: "Apartment Purchase Price", value: formatNPRShorthand(apartment.price), accent: BRAND },
    { label: "House Purchase Price", value: formatNPRShorthand(house.price), accent: TEAL },
    { label: "Apartment Down Payment", value: formatNPRShorthand(apt5.downPayment), accent: BRAND },
    { label: "House Down Payment", value: formatNPRShorthand(hse5.downPayment), accent: TEAL },
    { label: "Apartment Loan Amount", value: formatNPRShorthand(apt5.loanAmount), accent: BRAND },
    { label: "House Loan Amount", value: formatNPRShorthand(hse5.loanAmount), accent: TEAL },
    { label: "Apartment Monthly EMI", value: formatNPRShorthand(apt5.monthlyEMI), accent: BRAND },
    { label: "House Monthly EMI", value: formatNPRShorthand(hse5.monthlyEMI), accent: TEAL },
    { label: "Apartment Monthly Rent", value: formatNPRShorthand(apartment.monthlyRent), accent: BRAND },
    { label: "House Monthly Rent", value: formatNPRShorthand(house.monthlyRent), accent: TEAL },
    { label: "Apartment Value (5-Yr)", value: formatNPRShorthand(apt5.futurePropertyValue), accent: BRAND },
    { label: "House Value (5-Yr)", value: formatNPRShorthand(hse5.futurePropertyValue), accent: TEAL },
    { label: "Apartment Value (10-Yr)", value: formatNPRShorthand(apt10.futurePropertyValue), accent: BRAND },
    { label: "House Value (10-Yr)", value: formatNPRShorthand(hse10.futurePropertyValue), accent: TEAL },
  ];
  y = statCards(doc, y, items, 2);

  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE);
  doc.text("Which investment appears stronger based on the entered assumptions?", MARGIN, y, { maxWidth: CONTENT_W });
  y += 22;

  const metrics: [string, number, number][] = [
    ["lower down payment", -apt5.downPayment, -hse5.downPayment],
    ["lower monthly EMI", -apt5.monthlyEMI, -hse5.monthlyEMI],
    ["higher rental yield", apt5.rentalYieldPct, hse5.rentalYieldPct],
    ["stronger monthly cash flow", apt5.monthlyCashFlow, hse5.monthlyCashFlow],
    ["higher 5-year equity", apt5.ownerEquity, hse5.ownerEquity],
    ["higher 10-year equity", apt10.ownerEquity, hse10.ownerEquity],
  ];
  let aptWins = 0;
  let hseWins = 0;
  metrics.forEach(([, a, b]) => {
    if (a > b) aptWins++;
    else if (b > a) hseWins++;
  });
  const lead = aptWins === hseWins ? "The Apartment and House are closely matched" : aptWins > hseWins ? "The Apartment shows a stronger result" : "The House shows a stronger result";

  y = paragraph(
    doc,
    y,
    `${lead} across the measures compared in this report (Apartment favourable in ${aptWins} of ${metrics.length} categories, House favourable in ${hseWins} of ${metrics.length}).`
  );
  y += 10;
  calloutBox(
    doc,
    y,
    "This comparison depends entirely on the assumptions entered by the user — purchase price, down payment, interest rate, loan term, rent, appreciation, and expenses. Changing any of these inputs can change which option appears stronger. This is not a recommendation to buy either property.",
    { label: "Important", bg: [255, 251, 235], border: [253, 230, 138], textColor: [146, 64, 14] }
  );
}

function drawAssumptions(doc: jsPDF, { apartment, house }: ReportInputs, { apt5, hse5 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 3", "Investment Assumptions", "Every figure below was entered into the calculator and drives all results in this report.");

  const rows: (string | number)[][] = [
    ["Purchase Price", formatNPR(apartment.price), formatNPR(house.price)],
    ["Down Payment %", formatPct(apartment.downPaymentPct, 1), formatPct(house.downPaymentPct, 1)],
    ["Down Payment Amount", formatNPR(apt5.downPayment), formatNPR(hse5.downPayment)],
    ["Loan %", formatPct(apt5.loanToValuePct, 1), formatPct(hse5.loanToValuePct, 1)],
    ["Loan Amount", formatNPR(apt5.loanAmount), formatNPR(hse5.loanAmount)],
    ["Interest Rate (Annual)", formatPct(apartment.annualInterestRatePct, 2), formatPct(house.annualInterestRatePct, 2)],
    ["Loan Term", `${apartment.loanTermYears} years`, `${house.loanTermYears} years`],
    ["Monthly Rent", formatNPR(apartment.monthlyRent), formatNPR(house.monthlyRent)],
    ["Annual Appreciation %", formatPct(apartment.annualAppreciationPct, 1), formatPct(house.annualAppreciationPct, 1)],
    ["Monthly Expenses", formatNPR(apartment.monthlyExpenses), formatNPR(house.monthlyExpenses)],
  ];
  y = twoColTable(doc, y, ["Assumption", "Apartment", "House"], rows);

  paragraph(doc, y, "These are the exact inputs used by the Loan Calculator's results panels and comparison table — nothing in this report uses different figures.", {
    fontSize: 8.5,
    color: MUTED,
  });
}

function drawLoanAnalysis(doc: jsPDF, { apt5, hse5 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 4", "Loan Analysis", "How each mortgage is structured, and what it costs over its full term.");

  const rows: (string | number)[][] = [
    ["Property Price", formatNPR(apt5.downPayment + apt5.loanAmount), formatNPR(hse5.downPayment + hse5.loanAmount)],
    ["Down Payment", formatNPR(apt5.downPayment), formatNPR(hse5.downPayment)],
    ["Loan Amount", formatNPR(apt5.loanAmount), formatNPR(hse5.loanAmount)],
    ["Monthly EMI", formatNPR(apt5.monthlyEMI), formatNPR(hse5.monthlyEMI)],
    ["Total Payments", `${apt5.totalPayments} installments`, `${hse5.totalPayments} installments`],
    ["Total Interest (Full Term)", formatNPR(apt5.totalInterestFullTerm), formatNPR(hse5.totalInterestFullTerm)],
    ["Total Paid to Bank (Full Term)", formatNPR(apt5.totalPaidToBankFullTerm), formatNPR(hse5.totalPaidToBankFullTerm)],
  ];
  y = twoColTable(doc, y, ["Metric", "Apartment", "House"], rows);

  calloutBox(doc, y, "EMI (Equated Monthly Instalment) is the estimated fixed monthly payment required to repay the loan — it includes both principal (the amount borrowed) and interest (the cost of borrowing it), spread evenly across the loan term.", {
    label: "What is EMI?",
  });
}

function drawRentalAnalysis(doc: jsPDF, { apt5, hse5 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 5", "Rental Income Analysis", "Whether expected rent is enough to cover the monthly loan payment.");

  const rows: (string | number)[][] = [
    ["Monthly Rent", formatNPR(apt5.monthlyRentalIncome), formatNPR(hse5.monthlyRentalIncome)],
    ["Annual Rent", formatNPR(apt5.annualRentalIncome), formatNPR(hse5.annualRentalIncome)],
    ["Rental Yield", formatPct(apt5.rentalYieldPct), formatPct(hse5.rentalYieldPct)],
    ["Monthly Cash Flow (After EMI & Expenses)", formatNPR(apt5.monthlyCashFlow), formatNPR(hse5.monthlyCashFlow)],
    ["Annual Cash Flow (After EMI & Expenses)", formatNPR(apt5.annualCashFlow), formatNPR(hse5.annualCashFlow)],
  ];
  y = twoColTable(doc, y, ["Metric", "Apartment", "House"], rows);

  const aptCovers = apt5.monthlyCashFlow >= 0;
  const hseCovers = hse5.monthlyCashFlow >= 0;
  const aptText = aptCovers
    ? `The Apartment's expected rent covers its EMI and monthly expenses, leaving a surplus of ${formatNPR(apt5.monthlyCashFlow)}/month.`
    : `The Apartment's expected rent does not fully cover its EMI and monthly expenses, leaving a shortfall of ${formatNPR(Math.abs(apt5.monthlyCashFlow))}/month.`;
  const hseText = hseCovers
    ? `The House's expected rent covers its EMI and monthly expenses, leaving a surplus of ${formatNPR(hse5.monthlyCashFlow)}/month.`
    : `The House's expected rent does not fully cover its EMI and monthly expenses, leaving a shortfall of ${formatNPR(Math.abs(hse5.monthlyCashFlow))}/month.`;

  y = paragraph(doc, y, aptText);
  y += 6;
  paragraph(doc, y, hseText);
}

function drawYearOutlook(doc: jsPDF, pageLabel: string, years: 5 | 10, { apartment, house }: ReportInputs, aptR: PropertyResults, hseR: PropertyResults) {
  let y = sectionHeading(doc, 64, pageLabel, `${years}-Year Investment Outlook`, `Property value, loan payoff progress, and net investment result after ${years} years.`);

  const rows: (string | number)[][] = [
    ["Original Property Value", formatNPR(apartment.price), formatNPR(house.price)],
    [`Estimated Value After ${years} Years`, formatNPR(aptR.futurePropertyValue), formatNPR(hseR.futurePropertyValue)],
    ["Property Appreciation", formatNPR(aptR.propertyAppreciation), formatNPR(hseR.propertyAppreciation)],
    ["Total Principal Repaid", formatNPR(aptR.principalPaidInPeriod), formatNPR(hseR.principalPaidInPeriod)],
    ["Remaining Loan Balance", formatNPR(aptR.remainingLoanBalance), formatNPR(hseR.remainingLoanBalance)],
    ["Owner Equity", formatNPR(aptR.ownerEquity), formatNPR(hseR.ownerEquity)],
    [`Total Rental Income (${years} Yrs)`, formatNPR(aptR.totalRentalIncomeInPeriod), formatNPR(hseR.totalRentalIncomeInPeriod)],
    [`Total Expenses (${years} Yrs)`, formatNPR(aptR.totalExpensesInPeriod), formatNPR(hseR.totalExpensesInPeriod)],
    ["Net Investment Result", formatNPR(aptR.netInvestmentProfitLoss), formatNPR(hseR.netInvestmentProfitLoss)],
  ];
  y = twoColTable(doc, y, ["Metric", "Apartment", "House"], rows);

  groupedBarChart(
    doc,
    y + 6,
    `Property Value Growth — Today vs Year ${years}`,
    ["Today", `Year ${years}`],
    { label: "Apartment", values: [apartment.price, aptR.futurePropertyValue], color: BRAND },
    { label: "House", values: [house.price, hseR.futurePropertyValue], color: TEAL }
  );
}

function drawComparisonTable(doc: jsPDF, { apt5, apt10, hse5, hse10 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 8", "Apartment vs House — Full Comparison", "Every key metric from this report, side by side.");

  const rows: (string | number)[][] = [
    ["Purchase Price", formatNPR(apt5.downPayment + apt5.loanAmount), formatNPR(hse5.downPayment + hse5.loanAmount)],
    ["Down Payment", formatNPR(apt5.downPayment), formatNPR(hse5.downPayment)],
    ["Loan Amount", formatNPR(apt5.loanAmount), formatNPR(hse5.loanAmount)],
    ["Monthly EMI", formatNPR(apt5.monthlyEMI), formatNPR(hse5.monthlyEMI)],
    ["Total Interest (Full Term)", formatNPR(apt5.totalInterestFullTerm), formatNPR(hse5.totalInterestFullTerm)],
    ["Monthly Rent", formatNPR(apt5.monthlyRentalIncome), formatNPR(hse5.monthlyRentalIncome)],
    ["Annual Rent", formatNPR(apt5.annualRentalIncome), formatNPR(hse5.annualRentalIncome)],
    ["Rental Yield", formatPct(apt5.rentalYieldPct), formatPct(hse5.rentalYieldPct)],
    ["Monthly Cash Flow", formatNPR(apt5.monthlyCashFlow), formatNPR(hse5.monthlyCashFlow)],
    ["5-Year Property Value", formatNPR(apt5.futurePropertyValue), formatNPR(hse5.futurePropertyValue)],
    ["5-Year Equity", formatNPR(apt5.ownerEquity), formatNPR(hse5.ownerEquity)],
    ["10-Year Property Value", formatNPR(apt10.futurePropertyValue), formatNPR(hse10.futurePropertyValue)],
    ["10-Year Equity", formatNPR(apt10.ownerEquity), formatNPR(hse10.ownerEquity)],
    ["Net Investment Result (5-Yr)", formatNPR(apt5.netInvestmentProfitLoss), formatNPR(hse5.netInvestmentProfitLoss)],
    ["Net Investment Result (10-Yr)", formatNPR(apt10.netInvestmentProfitLoss), formatNPR(hse10.netInvestmentProfitLoss)],
  ];
  twoColTable(doc, y, ["Metric", "Apartment", "House"], rows);
}

function drawKeyFindings(doc: jsPDF, { apt5, apt10, hse5, hse10 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 9", "Key Findings", "Plain observations drawn directly from the numbers in this report — no assumptions added.");

  const findings = [
    `Initial capital: the Apartment requires ${formatNPRShorthand(apt5.downPayment)} down, the House requires ${formatNPRShorthand(hse5.downPayment)}. ${winner(-apt5.downPayment, -hse5.downPayment, "The Apartment", "The House")} requires less upfront capital.`,
    `Monthly EMI: the Apartment's EMI is ${formatNPRShorthand(apt5.monthlyEMI)}, the House's is ${formatNPRShorthand(hse5.monthlyEMI)}. ${winner(-apt5.monthlyEMI, -hse5.monthlyEMI, "The Apartment", "The House")} has the lower monthly payment.`,
    `Rental income: the Apartment generates ${formatNPRShorthand(apt5.annualRentalIncome)}/year, the House generates ${formatNPRShorthand(hse5.annualRentalIncome)}/year. ${winner(apt5.annualRentalIncome, hse5.annualRentalIncome, "The Apartment", "The House")} generates more rental income.`,
    `Rental yield: the Apartment yields ${formatPct(apt5.rentalYieldPct)}, the House yields ${formatPct(hse5.rentalYieldPct)}. ${winner(apt5.rentalYieldPct, hse5.rentalYieldPct, "The Apartment", "The House")} has the higher rental yield.`,
    `Monthly cash flow: the Apartment nets ${formatNPRShorthand(apt5.monthlyCashFlow)}/month after EMI and expenses, the House nets ${formatNPRShorthand(hse5.monthlyCashFlow)}/month. ${winner(apt5.monthlyCashFlow, hse5.monthlyCashFlow, "The Apartment", "The House")} produces stronger monthly cash flow.`,
    `5-year value: the Apartment is estimated at ${formatNPRShorthand(apt5.futurePropertyValue)}, the House at ${formatNPRShorthand(hse5.futurePropertyValue)}. ${winner(apt5.futurePropertyValue, hse5.futurePropertyValue, "The Apartment", "The House")} has the greater estimated 5-year value.`,
    `10-year value: the Apartment is estimated at ${formatNPRShorthand(apt10.futurePropertyValue)}, the House at ${formatNPRShorthand(hse10.futurePropertyValue)}. ${winner(apt10.futurePropertyValue, hse10.futurePropertyValue, "The Apartment", "The House")} has the greater estimated 10-year value.`,
    `5-year equity: the Apartment builds ${formatNPRShorthand(apt5.ownerEquity)} in owner equity, the House builds ${formatNPRShorthand(hse5.ownerEquity)}. ${winner(apt5.ownerEquity, hse5.ownerEquity, "The Apartment", "The House")} has the greater estimated 5-year equity.`,
    `10-year equity: the Apartment builds ${formatNPRShorthand(apt10.ownerEquity)} in owner equity, the House builds ${formatNPRShorthand(hse10.ownerEquity)}. ${winner(apt10.ownerEquity, hse10.ownerEquity, "The Apartment", "The House")} has the greater estimated 10-year equity.`,
  ];

  y = bulletList(doc, y + 4, findings);
  y += 8;
  paragraph(doc, y, "These findings describe the calculator's output only. They do not weigh which factors matter most for any individual buyer's goals.", {
    fontSize: 8.3,
    color: MUTED,
  });
}

function drawRisks(doc: jsPDF) {
  let y = sectionHeading(doc, 64, "Page 10", "Risks & Considerations", "Every projection in this report is an estimate. Real outcomes can differ for many reasons, including:");

  const risks = [
    "Interest rate changes — if the loan has a variable/floating rate, the EMI shown here can rise or fall over the loan term.",
    "Vacancy periods — the rental income figures assume the property is rented continuously; unoccupied months reduce actual income.",
    "Rental income changes — market rents can rise or fall over time, unlike the fixed monthly rent used in this analysis.",
    "Maintenance costs — repairs, renovations, and upkeep can exceed the monthly expense estimate used here.",
    "Property taxes and fees — local taxes, society/HOA fees, and utility charges may not be fully captured in the expense figure entered.",
    "Insurance — property and contents insurance premiums are not separately itemized in this report.",
    "Unexpected repairs — structural, plumbing, or electrical issues can arise without notice.",
    "Property market conditions — demand, location trends, and the broader economy affect resale value and rentability.",
    "Actual appreciation may differ — the appreciation rate entered is an assumption, not a guarantee; real property values can rise, fall, or stay flat.",
    "Buying/selling transaction costs — registration, legal, brokerage, and transfer costs are not included in this analysis.",
  ];
  y = bulletList(doc, y + 4, risks, { dotColor: AMBER });
  y += 10;

  calloutBox(
    doc,
    y,
    "This report is an investment analysis based on the assumptions entered into the calculator. It is not financial, investment, tax, or legal advice. Please consult a qualified professional before making any investment decision.",
    { label: "Disclaimer", bg: [255, 241, 242], border: [254, 205, 211], textColor: [159, 18, 57] }
  );
}

function drawMethodology(doc: jsPDF) {
  let y = sectionHeading(doc, 64, "Page 11", "Calculation Methodology", "How the figures in this report are calculated, explained in plain language.");

  const items: [string, string][] = [
    [
      "Monthly Loan Payment (EMI)",
      "Calculated using the standard amortizing-loan formula, based on the loan amount, the monthly interest rate (annual rate ÷ 12), and the total number of monthly payments (loan term × 12). This produces a fixed monthly payment that pays off the loan in full by the end of its term.",
    ],
    [
      "Property Appreciation",
      "Estimated future value = purchase price × (1 + annual appreciation rate) raised to the power of the number of years. This assumes the property gains value at a steady annual rate.",
    ],
    [
      "Rental Yield",
      "Annual rental income divided by the purchase price, shown as a percentage. This measures how much rental income the property produces relative to what it cost.",
    ],
    [
      "Remaining Loan Balance",
      "The portion of the original loan still owed after a given number of monthly payments, accounting for how amortizing loans pay mostly interest early on and mostly principal later.",
    ],
    [
      "Owner Equity",
      "Estimated property value at a given point in time, minus the remaining loan balance at that same point. This is the estimated value the owner would keep if the property were sold and the loan paid off.",
    ],
  ];

  items.forEach(([title, body]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...BRAND);
    doc.text(title, MARGIN, y);
    y += 14;
    y = paragraph(doc, y, body, { fontSize: 9 });
    y += 12;
  });

  paragraph(doc, y, "Net Investment Result = Property Appreciation + Total Rental Income − Total Expenses − Total Interest Paid. Loan principal is not counted separately here, since paying it down converts cash into home equity, which is already captured above.", {
    fontSize: 8.3,
    color: MUTED,
  });
}

function drawFinalSummary(doc: jsPDF, { apt5, apt10, hse5, hse10 }: Bundle) {
  let y = sectionHeading(doc, 64, "Page 12", "Apartment vs House — Investment Snapshot", "A final, at-a-glance recap of this report.");

  const items: StatItem[] = [
    { label: "Best Initial Cash Flow", value: winner(apt5.monthlyCashFlow, hse5.monthlyCashFlow, "Apartment", "House") },
    { label: "Best Rental Yield", value: winner(apt5.rentalYieldPct, hse5.rentalYieldPct, "Apartment", "House") },
    { label: "Best 5-Year Projected Value", value: winner(apt5.futurePropertyValue, hse5.futurePropertyValue, "Apartment", "House") },
    { label: "Best 10-Year Projected Value", value: winner(apt10.futurePropertyValue, hse10.futurePropertyValue, "Apartment", "House") },
    { label: "Best 5-Year Projected Equity", value: winner(apt5.ownerEquity, hse5.ownerEquity, "Apartment", "House") },
    { label: "Best 10-Year Projected Equity", value: winner(apt10.ownerEquity, hse10.ownerEquity, "Apartment", "House") },
  ];
  y = statCards(doc, y, items, 3);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE);
  doc.text("Decision Summary", MARGIN, y);
  y += 18;

  let aptWins = 0;
  let hseWins = 0;
  items.forEach((i) => {
    if (i.value === "Apartment") aptWins++;
    else if (i.value === "House") hseWins++;
  });
  const summarySentence =
    aptWins === hseWins
      ? "Across the six headline measures in this snapshot, the Apartment and House are evenly matched."
      : aptWins > hseWins
        ? `Across the six headline measures in this snapshot, the Apartment leads in ${aptWins} of 6 and the House leads in ${hseWins} of 6.`
        : `Across the six headline measures in this snapshot, the House leads in ${hseWins} of 6 and the Apartment leads in ${aptWins} of 6.`;

  y = paragraph(doc, y, summarySentence);
  y += 8;
  calloutBox(
    doc,
    y,
    "This snapshot reflects only the assumptions entered into the calculator — purchase price, down payment, interest rate, loan term, rent, appreciation, and expenses — as of the date this report was generated. Changing any of these inputs will change these results. This report does not constitute financial, investment, tax, or legal advice.",
    { label: "Final Note", bg: FAINT_BG, border: BORDER }
  );
}

// ---- Running header / footer, applied to every page after content exists --

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
    doc.text("Jikmis Apartment — Generated report", MARGIN, PAGE_H - 24);
    doc.text(`Page ${i - 1} of ${pageCount - 1}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }
}

// ---- Public entry point -----------------------------------------------------

export interface InvestmentReportInputs {
  apartment: PropertyInputs;
  house: PropertyInputs;
}

/**
 * Builds and downloads the 12-page "Real Estate Investment Analysis" PDF.
 * Takes only the raw calculator inputs — every number in the PDF is derived
 * by calling `calculatePropertyResults` (the calculator's own function) at
 * the 5-year and 10-year marks, exactly mirroring what the on-screen
 * comparison table already shows.
 */
export function downloadInvestmentReportPdf({ apartment, house }: InvestmentReportInputs) {
  const apt5 = calculatePropertyResults(apartment, 5);
  const apt10 = calculatePropertyResults(apartment, 10);
  const hse5 = calculatePropertyResults(house, 5);
  const hse10 = calculatePropertyResults(house, 10);
  const bundle: Bundle = { apt5, apt10, hse5, hse10 };
  const inputs: ReportInputs = { apartment, house };

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawCover(doc, inputs, bundle);
  doc.addPage();
  drawExecutiveSummary(doc, inputs, bundle);
  doc.addPage();
  drawAssumptions(doc, inputs, bundle);
  doc.addPage();
  drawLoanAnalysis(doc, bundle);
  doc.addPage();
  drawRentalAnalysis(doc, bundle);
  doc.addPage();
  drawYearOutlook(doc, "Page 6", 5, inputs, bundle.apt5, bundle.hse5);
  doc.addPage();
  drawYearOutlook(doc, "Page 7", 10, inputs, bundle.apt10, bundle.hse10);
  doc.addPage();
  drawComparisonTable(doc, bundle);
  doc.addPage();
  drawKeyFindings(doc, bundle);
  doc.addPage();
  drawRisks(doc);
  doc.addPage();
  drawMethodology(doc);
  doc.addPage();
  drawFinalSummary(doc, bundle);

  drawHeadersAndFooters(doc);

  doc.save("Real_Estate_Investment_Analysis_Apartment_vs_House.pdf");
}
