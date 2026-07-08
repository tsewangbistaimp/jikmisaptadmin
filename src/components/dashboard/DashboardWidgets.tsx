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
// Stat card with optional trend + sparkline
// ---------------------------------------------------------------------------
const TONE_MAP = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", stroke: "#2563eb", fill: "#dbeafe" },
  green: { bg: "bg-green-50 dark:bg-green-500/10", text: "text-green-600 dark:text-green-400", stroke: "#16a34a", fill: "#dcfce7" },
  amber: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", stroke: "#d97706", fill: "#fef3c7" },
  red: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", stroke: "#dc2626", fill: "#fee2e2" },
  brand: { bg: "bg-brand-50", text: "text-brand-600", stroke: "#2563eb", fill: "#dbeafe" },
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
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors.bg, colors.text)}>{icon}</div>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              trend >= 0 ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{subtext}</p>}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke={colors.stroke} strokeWidth={2} fill={`url(#spark-${tone})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Booking status donut
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  Confirmed: "#2563eb",
  "Checked In": "#16a34a",
  "Checked Out": "#94a3b8",
  Cancelled: "#dc2626",
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
          <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#2563eb" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="checkIns" name="Check Ins" stroke="#16a34a" strokeWidth={2.5} dot={false} />
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
  const data = [{ name: "occupancy", value: pct, fill: "#2563eb" }];
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
          <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
