// Shared Excel (.xlsx) export helper, built on SheetJS's community "xlsx"
// package. IMPORTANT: this app only ever WRITES workbooks from our own
// trusted data (never calls XLSX.read()/readFile() on user-supplied files),
// so the two disclosed SheetJS CVEs (prototype pollution + ReDoS, both in
// the *parsing* code path) are not reachable through this app's usage.
//
// The free/community edition of the library does not reliably support
// writing custom cell styles (bold/fill colors) into .xlsx files, so
// "professional formatting" here is achieved with the two things it does
// support well: sensible column widths and numeric formatting (thousands
// separators), plus clear per-sheet structure.
import * as XLSX from "xlsx";

export interface ExcelColumn {
  header: string;
  key: string;
  numeric?: boolean;
}

export interface ExcelSheetSpec {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number>[];
}

function sanitizeSheetName(name: string) {
  // Excel sheet names: max 31 chars, and can't contain \ / ? * [ ] :
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
}

export function downloadExcelWorkbook(filename: string, sheets: ExcelSheetSpec[]) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = sheet.columns.map((c) => c.header);
    const aoa: (string | number)[][] = [headers, ...sheet.rows.map((row) => sheet.columns.map((c) => row[c.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    sheet.columns.forEach((col, colIdx) => {
      if (!col.numeric) return;
      for (let r = 1; r <= sheet.rows.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: colIdx });
        const cell = ws[addr];
        if (cell && typeof cell.v === "number") cell.z = "#,##0";
      }
    });

    ws["!cols"] = sheet.columns.map((col) => {
      const maxLen = Math.max(col.header.length, ...sheet.rows.map((row) => String(row[col.key] ?? "").length), 0);
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheet.name));
  }

  // If every sheet ended up empty (shouldn't normally happen), XLSX still
  // needs at least one sheet to produce a valid file.
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No data"]]), "Sheet1");
  }

  XLSX.writeFile(wb, filename);
}
