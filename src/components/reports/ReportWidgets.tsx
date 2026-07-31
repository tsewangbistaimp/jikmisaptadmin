import * as React from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "@/lib/report-helpers";

// ---------------------------------------------------------------------------
// Profit trend — bar chart colored green (profit) / red (loss) per bucket,
// matching the app's existing recharts styling conventions (see
// DashboardWidgets.tsx: dashed grid, muted axis ticks, rounded tooltip).
// ---------------------------------------------------------------------------
export function ProfitTrendChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Bar dataKey="total" name="Profit" radius={[4, 4, 4, 4]} animationDuration={700} animationEasing="ease-out">
            {data.map((d, i) => (
              <Cell key={i} fill={d.total >= 0 ? "#059669" : "#e11d48"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared date-range filter bar — preset pills + a custom from/to range,
// reused across every Reports tab (Overview / Calendar / Ledger) so the
// same selected window drives all of them consistently.
// ---------------------------------------------------------------------------
const PRESETS: DateRangePreset[] = ["today", "yesterday", "week", "lastWeek", "month", "lastMonth", "year", "all"];

export function DateRangeFilterBar({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  preset: DateRangePreset;
  onPresetChange: (p: DateRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onPresetChange(p)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              preset === p ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {DATE_RANGE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="hidden h-4 w-4 text-slate-400 sm:block" />
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => onCustomChange(e.target.value, customTo)}
          className="h-9 w-[9.5rem] px-2 text-xs"
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e) => onCustomChange(customFrom, e.target.value)}
          className="h-9 w-[9.5rem] px-2 text-xs"
        />
        {preset !== "custom" && (customFrom || customTo) && (
          <Button size="sm" variant="outline" className="h-9" onClick={() => onPresetChange("custom")}>
            Apply
          </Button>
        )}
      </div>
    </div>
  );
}

export function GranularityToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
      {options.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
            value === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}
