import * as React from "react";
import { BarChart, Bar, Cell, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Calendar, Filter } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
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
              preset === p ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            {DATE_RANGE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="hidden h-4 w-4 text-slate-400 dark:text-slate-500 sm:block" />
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => onCustomChange(e.target.value, customTo)}
          className="h-9 w-[9.5rem] px-2 text-xs"
        />
        <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
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

// ---------------------------------------------------------------------------
// Generic single-series line chart — used by Yearly Analytics' profit
// trend line, styled to match ReservationsChart's line conventions.
// ---------------------------------------------------------------------------
export function TrendLineChart({ data, color = "#3d63f5" }: { data: { label: string; total: number }[]; color?: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Line type="monotone" dataKey="total" name="Profit" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={700} animationEasing="ease-out" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced filters — Room / Guest / Payment Method / Expense Category. Kept
// separate from DateRangeFilterBar since these are optional narrowing
// filters (only the Ledger tab uses them today) rather than something every
// tab needs. Any option left as "all" is simply ignored by the caller.
// ---------------------------------------------------------------------------
export interface FilterOption {
  value: string;
  label: string;
}

export function AdvancedFiltersBar({
  rooms,
  guests,
  methods,
  categories,
  roomFilter,
  guestFilter,
  methodFilter,
  categoryFilter,
  onChange,
}: {
  rooms: FilterOption[];
  guests: FilterOption[];
  methods: FilterOption[];
  categories: FilterOption[];
  roomFilter: string;
  guestFilter: string;
  methodFilter: string;
  categoryFilter: string;
  onChange: (next: { room?: string; guest?: string; method?: string; category?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      <Select value={roomFilter} onChange={(e) => onChange({ room: e.target.value })} className="h-9 w-auto px-2 text-xs">
        <option value="all">All Rooms</option>
        {rooms.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <Select value={guestFilter} onChange={(e) => onChange({ guest: e.target.value })} className="h-9 w-auto px-2 text-xs">
        <option value="all">All Guests</option>
        {guests.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </Select>
      <Select value={methodFilter} onChange={(e) => onChange({ method: e.target.value })} className="h-9 w-auto px-2 text-xs">
        <option value="all">All Methods</option>
        {methods.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      <Select value={categoryFilter} onChange={(e) => onChange({ category: e.target.value })} className="h-9 w-auto px-2 text-xs">
        <option value="all">All Categories</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
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
    <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
      {options.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
            value === g ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}
