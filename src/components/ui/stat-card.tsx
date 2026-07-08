import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  tone = "slate",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "slate" | "brand" | "green" | "amber" | "red";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    brand: "bg-brand-100 text-brand-600",
    green: "bg-green-100 text-green-600 dark:text-green-400",
    amber: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
    red: "bg-red-100 text-red-600 dark:text-red-400",
  };

  return (
    <Card className="p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
      {icon && (
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
          {icon}
        </div>
      )}
    </Card>
  );
}
