// Shared PDF export helper — a branded, printable A4 report generator used
// across Reports/Transactions/Expenses/the Ledger/Daily Closing. Built on
// jsPDF + jspdf-autotable rather than the invoice's existing window.print()
// approach, because these reports need to be handed off as an actual file
// (emailed, archived, attached), not just printed from the browser.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// The app has no logo image asset in the codebase (confirmed: no /logo.*,
// no imported image in Sidebar/Topbar — branding today is text-only, e.g.
// Sidebar.tsx's "JIKMISAPARTMENT" wordmark). So the report header uses that
// same wordmark in the brand color instead of an <img>, matching how the
// rest of the app already represents the brand.
const APARTMENT_NAME = "JIKMISAPARTMENT";
const BRAND_RGB: [number, number, number] = [61, 99, 245]; // --color-brand-500
const SLATE_RGB: [number, number, number] = [15, 23, 42];
const MUTED_RGB: [number, number, number] = [100, 116, 139];
const FAINT_RGB: [number, number, number] = [148, 163, 184];
const BORDER_RGB: [number, number, number] = [226, 232, 240];

export interface PdfSummaryItem {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}

export interface PdfSection {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  summary?: PdfSummaryItem[];
  sections: PdfSection[];
  filename: string;
}

export function downloadPdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 46;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND_RGB);
  doc.text(APARTMENT_NAME, margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_RGB);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, pageWidth - margin, y, { align: "right" });

  y += 10;
  doc.setDrawColor(...BORDER_RGB);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...SLATE_RGB);
  doc.text(opts.title, margin, y);

  if (opts.subtitle) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_RGB);
    doc.text(opts.subtitle, margin, y);
  }
  y += 24;

  if (opts.summary && opts.summary.length > 0) {
    const gap = 10;
    const boxWidth = (pageWidth - margin * 2 - gap * (opts.summary.length - 1)) / opts.summary.length;
    const boxHeight = 46;
    opts.summary.forEach((item, i) => {
      const x = margin + i * (boxWidth + gap);
      const rgb = item.tone === "positive" ? [5, 150, 105] : item.tone === "negative" ? [225, 29, 72] : SLATE_RGB;
      doc.setDrawColor(...BORDER_RGB);
      doc.roundedRect(x, y, boxWidth, boxHeight, 6, 6, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED_RGB);
      doc.text(item.label, x + 8, y + 17);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(item.value, x + 8, y + 35);
    });
    y += boxHeight + 22;
  }

  for (const section of opts.sections) {
    if (section.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...SLATE_RGB);
      doc.text(section.title, margin, y);
      y += 14;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows,
      margin: { left: margin, right: margin, bottom: 50 },
      styles: { fontSize: 8, cellPadding: 5, textColor: SLATE_RGB },
      headStyles: { fillColor: BRAND_RGB, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 26;
  }

  // Footer (page numbers + brand) on every page, drawn last so it's not
  // affected by autoTable's own pagination.
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT_RGB);
    doc.text("Jikmis Apartment — Generated report", margin, pageHeight - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  doc.save(opts.filename);
}
