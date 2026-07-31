import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "gold" | "navy";

const toneClasses: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  // Premium-tier accents (VIP guests, featured rooms, etc.) — distinct from
  // the semantic tones above, which stay tied to status meaning.
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300",
  navy: "bg-navy-100 text-navy-700 dark:bg-navy-500/20 dark:text-navy-200",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
