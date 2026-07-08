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
// Stat card with optional trend + sparkline — solid pastel cards, matching
// the Travelgo-style reference (full-color background, icon in a soft white
// badge, large number, label below).
// ---------------------------------------------------------------------------
const TONE_MAP = {
  purple: { card: "bg-violet-100", badge: "bg-white/70 text-violet-600", text: "text-violet-950", sub: "text-violet-700/70", stroke: "#7c3aed", trendBg: "bg-white/60 text-violet-700" },
  green: { card: "bg-emerald-100", badge: "bg-white/70 text-emerald-600", text: "text-emerald-950", sub: "text-emerald-700/70", stroke: "#059669", trendBg: "bg-white/60 text-emerald-700" },
  amber: { card: "bg-amber-100", badge: "bg-white/70 text-amber-600", text: "text-amber-950", sub: "text-amber-700/70", stroke: "#d97706", trendBg: "bg-white/60 text-amber-700" },
  rose: { card: "bg-rose-100", badge: "bg-white/70 text-rose-600", text: "text-rose-950", sub: "text-rose-700/70", stroke: "#e11d48", trendBg: "bg-white/60 text-rose-700" },
  sky: { card: "bg-sky-100", badge: "bg-white/70 text-sky-600", text: "text-sky-950", sub: "text-sky-700/70", stroke: "#0284c7", trendBg: "bg-white/60 text-sky-700" },
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
    <div className={cn("rounded-2xl p-4 sm:p-5", colors.card)}>
      <div className="flex items-start justify-between">
        <p className={cn("text-xl font-bold sm:text-2xl", colors.text)}>{value}</p>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colors.badge)}>{icon}</div>
      </div>
      <p className={cn("mt-1 text-sm font-medium", colors.sub)}>{label}</p>
      {subtext && <p className={cn("mt-0.5 text-xs", colors.sub)}>{subtext}</p>}
      {trend !== undefined && (
        <span className={cn("mt-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium", colors.trendBg)}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}%
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
// Booking status donut
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  Confirmed: "#7c3aed",
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
          <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="checkIns" name="Check Ins" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
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
  const data = [{ name: "occupancy", value: pct, fill: "#7c3aed" }];
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
          <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
