// ============================================================================
// Real Estate Investment Tools — shared, feature-local UI atoms.
//
// Built entirely from the app's existing design-system primitives (Card,
// Input, Label, Button, StatCard) exactly as they already exist — nothing
// here modifies those components. This file only composes them into a few
// small helpers reused across the 10 tools so each tool page stays short.
// ============================================================================
import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: string | number;
  suffix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step ?? "any"}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={suffix ? "pr-12" : undefined}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function ToolHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link
          to="/investment-tools"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Real Estate Investment Tools
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    info: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300",
    warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    success: "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
    danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  };
  return (
    <div className={cn("rounded-2xl border p-4 text-sm leading-relaxed", toneClasses[tone])}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function ResultGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return <div className={cn("grid grid-cols-1 gap-3", colClass)}>{children}</div>;
}

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className={cn(title ? "p-5" : "p-5")}>
        {title && <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        <div className={title || description ? "mt-4" : undefined}>{children}</div>
      </CardContent>
    </Card>
  );
}

/** Small "Positive"/"Negative" style pill used by the Cash Flow tool. */
export function StatusPill({ positive, positiveLabel = "Positive", negativeLabel = "Negative" }: { positive: boolean; positiveLabel?: string; negativeLabel?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        positive
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
      )}
    >
      {positive ? positiveLabel : negativeLabel}
    </span>
  );
}

export { Button };
