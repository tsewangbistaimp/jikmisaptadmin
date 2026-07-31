import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dropdownVariants } from "@/lib/motion";

/**
 * A small "Export ▾" button used on every page with downloadable data
 * (Transactions, Expenses, Reports/Ledger) so CSV/Excel/PDF export always
 * looks and behaves the same instead of three separate buttons per page.
 * Any handler left undefined simply hides that option.
 */
export function ExportMenu({
  onCsv,
  onExcel,
  onPdf,
  label = "Export",
}: {
  onCsv?: () => void;
  onExcel?: () => void;
  onPdf?: () => void;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Download className="h-4 w-4" /> {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ transformOrigin: "top right" }}
              className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl"
            >
              {onCsv && (
                <MenuItem icon={<FileText className="h-4 w-4" />} label="CSV" onClick={() => { onCsv(); setOpen(false); }} />
              )}
              {onExcel && (
                <MenuItem icon={<FileSpreadsheet className="h-4 w-4" />} label="Excel (.xlsx)" onClick={() => { onExcel(); setOpen(false); }} />
              )}
              {onPdf && (
                <MenuItem icon={<FileType className="h-4 w-4" />} label="PDF" onClick={() => { onPdf(); setOpen(false); }} />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
    >
      {icon}
      {label}
    </button>
  );
}
