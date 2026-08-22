// ============================================================================
// Real Estate Investment Tools — small recharts wrappers.
//
// Uses the "recharts" package already listed in package.json (already used
// by src/components/dashboard/DashboardWidgets.tsx and src/pages/Reports.tsx
// elsewhere in this app) — no new charting dependency added. Each chart here
// is rendered inside the existing ChartCard component (src/components/ui/chart-card.tsx)
// so it automatically gets the same "download as PNG" / "fullscreen" actions
// every other chart in the app already has, without any changes to that file.
// ============================================================================
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/ui/chart-card";
import { formatNPRShort } from "../lib/format";

const AXIS_TICK = { fontSize: 10, fill: "#94a3b8" };
const GRID_STROKE = "#f1f5f9";
const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 };
const BRAND = "#3d63f5";
const TEAL = "#0d9488";
const AMBER = "#d97706";
const ROSE = "#e11d48";

function compactAxis(v: number) {
  return formatNPRShort(v).replace("NPR ", "");
}

export function PrincipalVsInterestChart({ principal, interest }: { principal: number; interest: number }) {
  const data = [{ label: "Loan Breakdown", principal, interest }];
  return (
    <ChartCard title="Principal vs Interest" description="Over the full loan term">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
            <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={0} />
            <Tooltip formatter={(v) => formatNPRShort(Number(v))} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="principal" name="Principal" stackId="a" fill={BRAND} radius={[4, 0, 0, 4]} />
            <Bar dataKey="interest" name="Interest" stackId="a" fill={AMBER} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function AppreciationLineChart({ series }: { series: { year: number; value: number }[] }) {
  return (
    <ChartCard title="Property Value Over Time" description="Year-by-year projected value">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `Yr ${v}`} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
            <Tooltip formatter={(v) => formatNPRShort(Number(v))} labelFormatter={(l) => `Year ${l}`} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" name="Property Value" stroke={BRAND} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ProjectionValueEquityChart({ rows }: { rows: { year: number; propertyValue: number; ownerEquity: number; loanBalance: number }[] }) {
  return (
    <ChartCard title="Property Value, Equity & Loan Balance" description="How ownership builds over time">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `Yr ${v}`} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
            <Tooltip formatter={(v) => formatNPRShort(Number(v))} labelFormatter={(l) => `Year ${l}`} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="propertyValue" name="Property Value" stroke={BRAND} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="ownerEquity" name="Owner Equity" stroke={TEAL} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="loanBalance" name="Loan Balance" stroke={AMBER} strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ProjectionRentalCashFlowChart({ rows }: { rows: { year: number; rentalIncome: number; netCashFlow: number }[] }) {
  return (
    <ChartCard title="Rental Income & Net Cash Flow" description="Per-year cash generated by the property">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `Yr ${v}`} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
            <Tooltip formatter={(v) => formatNPRShort(Number(v))} labelFormatter={(l) => `Year ${l}`} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="rentalIncome" name="Rental Income" fill={TEAL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="netCashFlow" name="Net Cash Flow" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function BuyVsRentChart({ rows }: { rows: { year: number; buyNet: number; rentNet: number }[] }) {
  return (
    <ChartCard title="Estimated Net Position Over Time" description="Buyer's equity vs renter's invested savings">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `Yr ${v}`} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
            <Tooltip formatter={(v) => formatNPRShort(Number(v))} labelFormatter={(l) => `Year ${l}`} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="buyNet" name="Buy — Net Position" stroke={BRAND} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="rentNet" name="Rent — Net Position" stroke={ROSE} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
