import * as React from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Stat card with optional trend + sparkline — white card with a circular
// ring-outlined icon badge (matching the fintech-dashboard reference style),
// bold value, plain colored trend text with arrow.
// ---------------------------------------------------------------------------
const TONE_MAP = {
  brand: { ring: "border-brand-300 text-brand-600", stroke: "#3d63f5" },
  green: { ring: "border-emerald-300 text-emerald-600", stroke: "#059669" },
  amber: { ring: "border-amber-300 text-amber-600", stroke: "#d97706" },
  rose: { ring: "border-rose-300 text-rose-600", stroke: "#e11d48" },
  sky: { ring: "border-sky-300 text-sky-600", stroke: "#0284c7" },
} as const;

export function StatCard({
  label,
  value,
  icon,
  tone,
  trend,
  subtext,
  sparkline,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: keyof typeof TONE_MAP;
  trend?: number;
  subtext?: string;
  sparkline?: { label: string; count: number }[];
}) {
  const colors = TONE_MAP[tone];
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between">
        <p className="text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white", colors.ring)}>{icon}</div>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>}
      {trend !== undefined && (
        <span className={cn("mt-2 inline-flex items-center gap-0.5 text-xs font-semibold", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}% <span className="font-normal text-slate-400">this week</span>
        </span>
      )}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke={colors.stroke} strokeWidth={2} fill={`url(#spark-${tone})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colorful gradient "wallet card" stat — for headline money figures (e.g.
// spend today / this month / this year), matching the reference dashboard's
// Main Balance cards.
// ---------------------------------------------------------------------------
const GRADIENT_TONE_CLASS = {
  green: "gradient-card-green",
  blue: "gradient-card-blue",
  purple: "gradient-card-purple",
  orange: "gradient-card-orange",
} as const;

export function GradientStatCard({
  label,
  value,
  icon,
  tone,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: keyof typeof GRADIENT_TONE_CLASS;
  subtext?: string;
}) {
  return (
    <div className={cn("gradient-card rounded-3xl p-5", GRADIENT_TONE_CLASS[tone])}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-white/70">{subtext}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">{icon}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking status donut
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  Confirmed: "#3d63f5",
  "Checked In": "#059669",
  "Checked Out": "#94a3b8",
  Cancelled: "#e11d48",
};

export function BookingStatusDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={3} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? "#cbd5e1"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{total}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] ?? "#cbd5e1" }} />
              <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
            </div>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}% ({d.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservations analytics line chart
// ---------------------------------------------------------------------------
export function ReservationsChart({ data }: { data: { label: string; bookings: number; checkIns: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#3d63f5" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="checkIns" name="Check Ins" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Occupancy radial gauge
// ---------------------------------------------------------------------------
export function OccupancyGauge({ occupied, total }: { occupied: number; total: number }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const data = [{ name: "occupancy", value: pct, fill: "#3d63f5" }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="100%" barSize={14} data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "#f1f5f9" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{pct}%</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Occupied</p>
        </div>
      </div>
      <div className="mt-3 flex gap-6 text-center">
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{occupied}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Occupied Rooms</p>
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{total - occupied}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Available Rooms</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small side-by-side percentage donuts (e.g. today's Check In vs Check Out split)
// ---------------------------------------------------------------------------
export function MiniPercentDonut({ label, pct, color }: { label: string; pct: number; color: string }) {
  const data = [{ name: label, value: pct, fill: color }];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="100%" barSize={9} data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "#f1f5f9" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-lg font-semibold text-slate-900">{pct}%</p>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue bar chart
// ---------------------------------------------------------------------------
export function RevenueBarChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <Bar dataKey="total" fill="#3d63f5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly Income vs Expenses — grouped bar chart
// ---------------------------------------------------------------------------
export function IncomeVsExpenseChart({
  data,
  height = "h-56",
  showLegend = true,
}: {
  data: { label: string; income: number; expenses: number }[];
  height?: string;
  showLegend?: boolean;
}) {
  return (
    <div className={cn("w-full", height)}>
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
          <Bar dataKey="income" name="Income" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#e11d48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {showLegend && (
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Expenses
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly expense trend — area chart
// ---------------------------------------------------------------------------
export function ExpenseTrendChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="expense-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <Area type="monotone" dataKey="total" name="Expenses" stroke="#e11d48" strokeWidth={2.5} fill="url(#expense-trend)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense category breakdown — donut, generic palette (category names vary
// since admins can add custom categories, unlike the fixed booking statuses)
// ---------------------------------------------------------------------------
const CATEGORY_PALETTE = ["#3d63f5", "#0284c7", "#059669", "#d97706", "#7c3aed", "#e11d48", "#0891b2", "#65a30d", "#c026d3", "#475569"];

export function ExpenseCategoryDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={3} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(total)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
        </div>
      </div>
      <div className="w-full space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
              <span className="truncate text-slate-600 dark:text-slate-400">{d.name}</span>
            </div>
            <span className="shrink-0 font-medium text-slate-800 dark:text-slate-200">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
