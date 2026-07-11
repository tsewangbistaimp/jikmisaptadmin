import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { backdropFade, scaleFade } from "@/lib/motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        // This outer motion.div carries no animation of its own — it only
        // needs to BE a motion component so AnimatePresence can hold the
        // whole tree mounted until its animated descendants (backdrop +
        // card) finish playing their exit animations, instead of the
        // dialog just vanishing instantly on close.
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={backdropFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={scaleFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              "relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800",
              className
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
                {description && <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">{description}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:h-8 md:w-8 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} className="max-w-sm">
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onClose}
          className="h-9 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "h-9 rounded-xl px-4 text-sm font-medium text-white disabled:opacity-50",
            destructive ? "bg-red-500 hover:bg-red-600" : "bg-brand-500 hover:bg-brand-600"
          )}
        >
          {loading ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
