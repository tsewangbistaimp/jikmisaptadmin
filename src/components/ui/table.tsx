import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem } from "@/lib/motion";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-slate-50/80 dark:bg-slate-800/60", className)} {...props} />;
}

/**
 * Motion stagger container — each direct TR child (which declares
 * variants={staggerItem} without its own initial/animate) inherits this
 * container's animate trigger and staggers in a few ms after the previous
 * row, instead of the whole table just popping in at once.
 */
export function TBody({ className, ...props }: HTMLMotionProps<"tbody">) {
  return (
    <motion.tbody
      variants={staggerContainer(30)}
      initial="initial"
      animate="animate"
      className={cn("divide-y divide-slate-100 dark:divide-slate-800", className)}
      {...props}
    />
  );
}

export function TR({ className, ...props }: HTMLMotionProps<"tr">) {
  return (
    <motion.tr
      variants={staggerItem}
      className={cn("transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap dark:text-slate-400",
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-slate-700 whitespace-nowrap dark:text-slate-300", className)} {...props} />;
}
