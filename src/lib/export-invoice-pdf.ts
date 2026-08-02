// Branded, one-page invoice PDF — drawn directly with jsPDF's vector drawing
// API (rects, lines, text) plus autoTable for the itemized charges, the same
// two building blocks src/lib/export-pdf.ts already uses for every other
// report in this app.
//
// This deliberately does NOT rasterize the on-screen <InvoiceDialog> DOM via
// html2canvas: that invoice is laid out with flexbox/grid utility classes
// throughout, and html2canvas-style libraries (including html2canvas-pro)
// re-implement CSS layout by hand rather than using a real browser engine —
// flexbox/grid support is notoriously incomplete, and in practice it
// collapsed the entire invoice into an unstyled vertical stack of plain text
// with no colors, borders, or table grid at all. A hand-drawn PDF has no
// such failure mode: every box, line, and cell is placed at an exact
// coordinate, so there's nothing for an incompatible layout engine to get
// wrong.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants";
import type { BookingWithRelations, BookingService } from "@/lib/database.types";

const NAVY_RGB: [number, number, number] = [21, 40, 72]; // --color-navy-700
const SLATE_RGB: [number, number, number] = [51, 65, 85]; // slate-700
const MUTED_RGB: [number, number, number] = [148, 163, 184]; // slate-400
const FAINT_BG_RGB: [number, number, number] = [248, 250, 252]; // slate-50
const BORDER_RGB: [number, number, number] = [226, 232, 240]; // slate-200
const EMERALD_RGB: [number, number, number] = [4, 120, 87]; // emerald-700
const EMERALD_BG_RGB: [number, number, number] = [236, 253, 245]; // emerald-50
const AMBER_RGB: [number, number, number] = [180, 83, 9]; // amber-700
const AMBER_BG_RGB: [number, number, number] = [255, 251, 235]; // amber-50
const ROSE_RGB: [number, number, number] = [225, 29, 72]; // rose-600

export function downloadInvoicePdf(
  booking: BookingWithRelations,
  addOns: BookingService[],
  refundTotal: number
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  const addOnsTotal = addOns.reduce((sum, a) => sum + a.unit_price * a.quantity, 0);
  const roomCharge = Math.max(booking.total_amount - addOnsTotal, 0);
  const ratePerNight = booking.nights > 0 ? roomCharge / booking.nights : roomCharge;
  const netRevenue = booking.total_amount - booking.discount - refundTotal;
  const isPaidInFull = booking.remaining_balance <= 0;

  // ---- Letterhead ---------------------------------------------------------
  doc.setFillColor(...NAVY_RGB);
  doc.roundedRect(margin, y, 34, 34, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("J", margin + 17, y + 23, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...SLATE_RGB);
  doc.text("Jikmis Apartment", margin + 44, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Front desk reservations & guest services", margin + 44, y + 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY_RGB);
  doc.text("INVOICE", pageWidth - margin, y + 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Invoice No.", pageWidth - margin, y + 22, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_RGB);
  doc.text(booking.booking_number, pageWidth - margin, y + 33, { align: "right" });

  y += 44;
  doc.setDrawColor(...NAVY_RGB);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(1);
  y += 22;

  // ---- Meta row: issue date / source / payment status ---------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Issue Date", margin, y);
  doc.text("Source", margin + 140, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_RGB);
  doc.text(formatDate(booking.created_at), margin, y + 12);
  doc.text(BOOKING_SOURCE_LABELS[booking.booking_source] ?? booking.booking_source, margin + 140, y + 12);

  const statusLabel = isPaidInFull ? "Paid in Full" : booking.payment_status === "partial" ? "Partially Paid" : "Unpaid";
  const statusRgb = isPaidInFull ? EMERALD_RGB : booking.payment_status === "partial" ? AMBER_RGB : ROSE_RGB;
  const statusBgRgb = isPaidInFull ? EMERALD_BG_RGB : AMBER_BG_RGB;
  doc.setFillColor(...statusBgRgb);
  const statusWidth = doc.getTextWidth(statusLabel.toUpperCase()) + 20;
  doc.roundedRect(pageWidth - margin - statusWidth, y - 12, statusWidth, 20, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...statusRgb);
  doc.text(statusLabel.toUpperCase(), pageWidth - margin - statusWidth / 2, y + 1, { align: "center" });

  y += 30;

  // ---- Billed To / Stay Details box ----------------------------------------
  const boxHeight = 70;
  doc.setFillColor(...FAINT_BG_RGB);
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 6, 6, "F");
  const colWidth = (pageWidth - margin * 2) / 2;
  const pad = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text("BILLED TO", margin + pad, y + 18);
  doc.text("STAY DETAILS", margin + colWidth + pad, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Guest", margin + pad, y + 32);
  doc.text("Room", margin + colWidth + pad, y + 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_RGB);
  doc.text(booking.guest?.full_name ?? "—", margin + pad, y + 44);
  doc.text(`${booking.room?.room_number ?? "—"} · ${booking.room?.room_type ?? ""}`, margin + colWidth + pad, y + 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Phone", margin + pad, y + 58);
  doc.text("Check-in", margin + colWidth + pad, y + 58);
  doc.text("Check-out", margin + colWidth + pad + 90, y + 58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_RGB);
  doc.text(booking.guest?.phone ?? "—", margin + pad, y + 70);
  doc.text(formatDate(booking.check_in), margin + colWidth + pad, y + 70);
  doc.text(formatDate(booking.check_out), margin + colWidth + pad + 90, y + 70);

  y += boxHeight + 24;

  // ---- Itemized charges table ----------------------------------------------
  const rows: (string | number)[][] = [
    [`Room Charge (${formatCurrency(ratePerNight)}/night)`, String(booking.nights), formatCurrency(roomCharge)],
    ...addOns.map((a) => [a.name, String(a.quantity), formatCurrency(a.unit_price * a.quantity)]),
  ];

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Amount"]],
    body: rows,
    margin: { left: margin, right: margin, bottom: 50 },
    styles: { fontSize: 9, cellPadding: 7, textColor: SLATE_RGB },
    headStyles: { fillColor: NAVY_RGB, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: { 1: { halign: "center", cellWidth: 60 }, 2: { halign: "right", cellWidth: 100 } },
    alternateRowStyles: { fillColor: FAINT_BG_RGB },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  y = (docWithTable.lastAutoTable?.finalY ?? y) + 20;

  // ---- Totals ---------------------------------------------------------------
  const totalsWidth = 220;
  const totalsX = pageWidth - margin - totalsWidth;
  let ty = y;

  const line = (label: string, value: string, rgb: [number, number, number] = SLATE_RGB) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_RGB);
    doc.text(label, totalsX, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb);
    doc.text(value, totalsX + totalsWidth, ty, { align: "right" });
    ty += 15;
  };

  if (booking.discount > 0) line("Discount", `-${formatCurrency(booking.discount)}`);
  if (booking.tax > 0) line("Tax", `+${formatCurrency(booking.tax)}`);
  line("Total Amount", formatCurrency(booking.total_amount));
  line("Amount Paid", formatCurrency(booking.advance_paid));
  if (refundTotal > 0) line("Refunded", `-${formatCurrency(refundTotal)}`, ROSE_RGB);

  ty += 4;
  const balanceBoxRgb = isPaidInFull ? EMERALD_BG_RGB : AMBER_BG_RGB;
  const balanceTextRgb = isPaidInFull ? EMERALD_RGB : AMBER_RGB;
  doc.setFillColor(...balanceBoxRgb);
  doc.roundedRect(totalsX, ty - 12, totalsWidth, 26, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...balanceTextRgb);
  doc.text(isPaidInFull ? "Paid in Full" : "Balance Due", totalsX + 8, ty + 5);
  doc.text(isPaidInFull ? formatCurrency(0) : formatCurrency(booking.remaining_balance), totalsX + totalsWidth - 8, ty + 5, {
    align: "right",
  });
  ty += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Net Revenue (after discount & refunds)", totalsX, ty);
  doc.text(formatCurrency(netRevenue), totalsX + totalsWidth, ty, { align: "right" });
  ty += 26;

  // ---- Footer ----------------------------------------------------------------
  doc.setDrawColor(...BORDER_RGB);
  doc.line(margin, ty, pageWidth - margin, ty);
  ty += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_RGB);
  doc.text("Thank you for staying with Jikmis Apartment!", pageWidth / 2, ty, { align: "center" });
  ty += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text(
    "This is a computer-generated invoice and does not require a signature. For questions about this invoice, please contact the front desk.",
    pageWidth / 2,
    ty,
    { align: "center", maxWidth: pageWidth - margin * 2 }
  );

  doc.save(`invoice-${booking.booking_number}.pdf`);
}
