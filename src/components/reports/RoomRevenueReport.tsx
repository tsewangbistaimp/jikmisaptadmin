import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Wallet, Award, AlertTriangle, BedDouble, Percent, Eye, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { ChartCard } from "@/components/ui/chart-card";
import { StatCard, ExpenseCategoryDonut } from "@/components/dashboard/DashboardWidgets";
import { DateRangeFilterBar, GranularityToggle, TrendLineChart } from "@/components/reports/ReportWidgets";
import { cn, formatCurrency, formatDate, nightsBetween, todayISO, addDaysISO } from "@/lib/utils";
import { getPresetRange, growthPct, type DateRangePreset } from "@/lib/report-helpers";
import { paymentStatusTone, bookingStatusTone } from "@/lib/badge-tones";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import type { Room, PaymentStatus, BookingStatus } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Room Revenue Report — a new analytics tab on the existing Reports page.
// Purely additive: reads the same `bookings`/`rooms` arrays Reports.tsx
// already fetches (with two extra selected columns — payment_status and the
// guest's name — widened onto that existing query), computes everything
// client-side, and writes nothing back to the database. No new tables, no
// new RPCs, no duplicated booking/payment records.
//
// "Completed and confirmed" bookings (per the spec) means booking_status in
// confirmed / checked_in / checked_out — the same three statuses that ever
// reserve a room (see the no_overlapping_room_bookings exclusion constraint
// in the schema). Pending/rejected/expired bookings never count as revenue.
//
// A 'cancelled' booking counts too, but only its retained payment: when
// staff cancel a booking early (see cancel_booking() in supabase/
// migrations), total_amount is clipped down to whatever was actually
// collected, so counting it here shows exactly the non-refundable revenue
// that was kept, not the value of nights that were never used. A booking
// cancelled with nothing ever collected nets to $0 and effectively drops
// out either way.
// ---------------------------------------------------------------------------

export interface RoomRevenueBooking {
  id: string;
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  total_amount: number;
  remaining_balance: number;
  created_at: string;
  payment_status: string;
  guest: { full_name: string } | null;
}

const REVENUE_STATUSES = new Set(["confirmed", "checked_in", "checked_out"]);

/** A cancelled booking counts toward revenue/occupancy stats only if it
 *  retained payment (see the module comment above) — this is the gate used
 *  everywhere below instead of a bare REVENUE_STATUSES.has() check. */
function countsForRevenue(b: { booking_status: string; total_amount: number }): boolean {
  if (REVENUE_STATUSES.has(b.booking_status)) return true;
  return b.booking_status === "cancelled" && Number(b.total_amount) > 0;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PALETTE = ["#3d63f5", "#059669", "#d97706", "#e11d48", "#7c3aed", "#0891b2", "#65a30d", "#c026d3", "#475569", "#0284c7"];

function daysInRange(from: string, to: string): number {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

interface RoomStat {
  room: Room;
  bookingCount: number;
  occupiedNights: number;
  revenue: number;
  avgPerBooking: number;
  avgPerNight: number;
  occupancyRate: number;
}

function computeRoomStats(bookings: RoomRevenueBooking[], rooms: Room[], from: string, to: string): RoomStat[] {
  const totalDays = daysInRange(from, to);
  return rooms.map((room) => {
    const roomBookings = bookings.filter(
      (b) => b.room_id === room.id && countsForRevenue(b) && b.check_in >= from && b.check_in <= to
    );
    const bookingCount = roomBookings.length;
    const occupiedNights = roomBookings.reduce((s, b) => s + nightsBetween(b.check_in, b.check_out), 0);
    const revenue = roomBookings.reduce((s, b) => s + Number(b.total_amount), 0);
    return {
      room,
      bookingCount,
      occupiedNights,
      revenue,
      avgPerBooking: bookingCount > 0 ? revenue / bookingCount : 0,
      avgPerNight: occupiedNights > 0 ? revenue / occupiedNights : 0,
      occupancyRate: totalDays > 0 ? Math.min(100, Math.round((occupiedNights / totalDays) * 1000) / 10) : 0,
    };
  });
}

interface MonthlyRow {
  room: Room;
  months: number[];
  total: number;
}

function computeMonthlyMatrix(bookings: RoomRevenueBooking[], rooms: Room[], year: number): MonthlyRow[] {
  return rooms.map((room) => {
    const months = new Array(12).fill(0) as number[];
    for (const b of bookings) {
      if (b.room_id !== room.id) continue;
      if (!countsForRevenue(b)) continue;
      const d = new Date(b.check_in + "T00:00:00");
      if (d.getFullYear() !== year) continue;
      months[d.getMonth()] += Number(b.total_amount);
    }
    return { room, months, total: months.reduce((s, m) => s + m, 0) };
  });
}

interface WeeklyRow {
  room: Room;
  weeks: number[];
}

function computeWeeklyRevenue(bookings: RoomRevenueBooking[], rooms: Room[], monthISO: string): WeeklyRow[] {
  const [yearStr, monthStr] = monthISO.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  return rooms.map((room) => {
    const weeks = new Array(5).fill(0) as number[];
    for (const b of bookings) {
      if (b.room_id !== room.id) continue;
      if (!countsForRevenue(b)) continue;
      const d = new Date(b.check_in + "T00:00:00");
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const weekIdx = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      weeks[weekIdx] += Number(b.total_amount);
    }
    return { room, weeks };
  });
}

interface DailyRow {
  room: Room;
  revenue: number;
  bookingCount: number;
  occupied: boolean;
}

function computeDailyRevenue(bookings: RoomRevenueBooking[], rooms: Room[], dateISO: string): DailyRow[] {
  return rooms.map((room) => {
    const dayBookings = bookings.filter((b) => b.room_id === room.id && countsForRevenue(b) && b.check_in === dateISO);
    const revenue = dayBookings.reduce((s, b) => s + Number(b.total_amount), 0);
    // Deliberately still REVENUE_STATUSES only (not countsForRevenue) — a
    // cancelled booking has freed the room, so it should never show as
    // "occupied" here even though its retained payment still counts above.
    const occupied = bookings.some(
      (b) => b.room_id === room.id && REVENUE_STATUSES.has(b.booking_status) && b.check_in <= dateISO && b.check_out > dateISO
    );
    return { room, revenue, bookingCount: dayBookings.length, occupied };
  });
}

type ViewMode = "summary" | "monthly" | "weekly" | "daily";

export default function RoomRevenueReport({ bookings, rooms }: { bookings: RoomRevenueBooking[]; rooms: Room[] }) {
  const [view, setView] = React.useState<ViewMode>("summary");
  const [preset, setPreset] = React.useState<DateRangePreset>("month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [year, setYear] = React.useState(() => new Date().getFullYear());
  const [weekMonth, setWeekMonth] = React.useState(() => todayISO().slice(0, 7));
  const [dailyDate, setDailyDate] = React.useState(() => todayISO());
  const [compareRoomA, setCompareRoomA] = React.useState("");
  const [compareRoomB, setCompareRoomB] = React.useState("");
  const [drillDownRoomId, setDrillDownRoomId] = React.useState<string | null>(null);

  const range = getPresetRange(preset, { from: customFrom, to: customTo });

  const roomStats = React.useMemo(() => computeRoomStats(bookings, rooms, range.from, range.to), [bookings, rooms, range.from, range.to]);

  const totalRevenue = roomStats.reduce((s, r) => s + r.revenue, 0);
  const totalOccupiedNights = roomStats.reduce((s, r) => s + r.occupiedNights, 0);
  const totalDays = daysInRange(range.from, range.to);
  const overallOccupancyRate =
    rooms.length > 0 && totalDays > 0 ? Math.min(100, Math.round((totalOccupiedNights / (rooms.length * totalDays)) * 1000) / 10) : 0;

  const ranked = [...roomStats].sort((a, b) => b.revenue - a.revenue);
  const highestRevenue = ranked[0] as RoomStat | undefined;
  const lowestRevenue = ranked[ranked.length - 1] as RoomStat | undefined;
  const rankedByOccupancy = [...roomStats].sort((a, b) => b.occupancyRate - a.occupancyRate);
  const highestOccupancy = rankedByOccupancy[0] as RoomStat | undefined;
  const lowestOccupancy = rankedByOccupancy[rankedByOccupancy.length - 1] as RoomStat | undefined;

  const rangeDays = daysInRange(range.from, range.to);
  const prevTo = addDaysISO(range.from, -1);
  const prevFrom = addDaysISO(prevTo, -(rangeDays - 1));
  const prevStats = React.useMemo(() => computeRoomStats(bookings, rooms, prevFrom, prevTo), [bookings, rooms, prevFrom, prevTo]);
  const prevTotalRevenue = prevStats.reduce((s, r) => s + r.revenue, 0);
  const revenueGrowth = growthPct(totalRevenue, prevTotalRevenue);

  const monthlyMatrix = React.useMemo(() => computeMonthlyMatrix(bookings, rooms, year), [bookings, rooms, year]);
  const monthlyTrend = MONTH_LABELS.map((label, i) => ({
    label,
    total: monthlyMatrix.reduce((s, row) => s + row.months[i], 0),
  }));
  const monthlyChartData = MONTH_LABELS.map((label, i) => {
    const row: Record<string, string | number> = { month: label };
    for (const r of monthlyMatrix) row[r.room.room_number] = r.months[i];
    return row;
  });

  const weeklyRows = React.useMemo(() => computeWeeklyRevenue(bookings, rooms, weekMonth), [bookings, rooms, weekMonth]);
  const dailyRows = React.useMemo(() => computeDailyRevenue(bookings, rooms, dailyDate), [bookings, rooms, dailyDate]);

  const roomA = roomStats.find((r) => r.room.id === compareRoomA);
  const roomB = roomStats.find((r) => r.room.id === compareRoomB);

  const distributionData = ranked.filter((r) => r.revenue > 0).map((r) => ({ name: r.room.room_number, value: r.revenue }));
  const occupancyChartData = roomStats.map((r) => ({ label: r.room.room_number, total: r.occupancyRate }));

  const drillDownRoom = rooms.find((r) => r.id === drillDownRoomId) ?? null;
  const drillDownBookings = drillDownRoom
    ? bookings
        .filter(
          (b) => b.room_id === drillDownRoom.id && countsForRevenue(b) && b.check_in >= range.from && b.check_in <= range.to
        )
        .sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
    : [];

  return (
    <div className="space-y-6">
      {/* ---- View switcher ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GranularityToggle value={view} options={["summary", "monthly", "weekly", "daily"] as const} onChange={setView} />
        {view === "summary" && (
          <DateRangeFilterBar
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => {
              setCustomFrom(f);
              setCustomTo(t);
            }}
          />
        )}
      </div>

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description="Add rooms to start tracking room-by-room revenue." />
      ) : (
        <>
          {view === "summary" && (
            <div className="space-y-6">
              {/* ---- Dashboard summary cards ---- */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  label="Total Apartment Revenue"
                  value={formatCurrency(totalRevenue)}
                  numeric={totalRevenue}
                  format={formatCurrency}
                  icon={<Wallet className="h-5 w-5" />}
                  tone="green"
                  trend={revenueGrowth}
                  trendLabel="vs previous period"
                />
                <StatCard
                  label="Highest Revenue Room"
                  value={highestRevenue?.room.room_number ?? "—"}
                  icon={<Award className="h-5 w-5" />}
                  tone="brand"
                  subtext={highestRevenue ? formatCurrency(highestRevenue.revenue) : undefined}
                />
                <StatCard
                  label="Lowest Revenue Room"
                  value={lowestRevenue?.room.room_number ?? "—"}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  tone="amber"
                  subtext={lowestRevenue ? formatCurrency(lowestRevenue.revenue) : undefined}
                />
                <StatCard
                  label="Average Monthly Revenue / Room"
                  value={formatCurrency(rooms.length > 0 ? monthlyMatrix.reduce((s, r) => s + r.total, 0) / 12 / rooms.length : 0)}
                  numeric={rooms.length > 0 ? monthlyMatrix.reduce((s, r) => s + r.total, 0) / 12 / rooms.length : 0}
                  format={formatCurrency}
                  icon={<BedDouble className="h-5 w-5" />}
                  tone="sky"
                  subtext={`${year}`}
                />
                <StatCard
                  label="Total Occupancy Rate"
                  value={`${overallOccupancyRate}%`}
                  icon={<Percent className="h-5 w-5" />}
                  tone="rose"
                  subtext={`${formatDate(range.from)} – ${formatDate(range.to)}`}
                />
              </div>

              {/* ---- Highlights ---- */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HighlightPill label="Highest Earning" room={highestRevenue?.room} value={highestRevenue ? formatCurrency(highestRevenue.revenue) : "—"} tone="green" />
                <HighlightPill label="Lowest Earning" room={lowestRevenue?.room} value={lowestRevenue ? formatCurrency(lowestRevenue.revenue) : "—"} tone="amber" />
                <HighlightPill label="Highest Occupancy" room={highestOccupancy?.room} value={highestOccupancy ? `${highestOccupancy.occupancyRate}%` : "—"} tone="blue" />
                <HighlightPill label="Lowest Occupancy" room={lowestOccupancy?.room} value={lowestOccupancy ? `${lowestOccupancy.occupancyRate}%` : "—"} tone="slate" />
              </div>

              {/* ---- Per-room cards ---- */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roomStats.map((r) => (
                  <Card key={r.room.id} className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{r.room.room_number}</p>
                        <p className="text-xs text-slate-400">{r.room.room_type}</p>
                      </div>
                      {highestRevenue?.room.id === r.room.id && r.revenue > 0 && (
                        <Badge tone="green" className="flex items-center gap-1">
                          <Award className="h-3 w-3" /> Top Earner
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Bookings" value={String(r.bookingCount)} />
                      <Metric label="Occupied Nights" value={String(r.occupiedNights)} />
                      <Metric label="Revenue" value={formatCurrency(r.revenue)} />
                      <Metric label="Occupancy" value={`${r.occupancyRate}%`} />
                      <Metric label="Avg / Booking" value={formatCurrency(r.avgPerBooking)} />
                      <Metric label="Avg / Night" value={formatCurrency(r.avgPerNight)} />
                    </div>
                    <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setDrillDownRoomId(r.room.id)}>
                      <Eye className="h-3.5 w-3.5" /> View Bookings
                    </Button>
                  </Card>
                ))}
              </div>

              {/* ---- Comparison: previous period + room vs room ---- */}
              <Card className="p-5 sm:p-6">
                <p className="mb-1 flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">
                  <ArrowLeftRight className="h-4 w-4" /> Comparisons
                </p>
                <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                  Current period ({formatDate(range.from)} – {formatDate(range.to)}) vs. the equal-length period right before it
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="This Period" value={formatCurrency(totalRevenue)} numeric={totalRevenue} format={formatCurrency} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
                  <StatCard label="Previous Period" value={formatCurrency(prevTotalRevenue)} numeric={prevTotalRevenue} format={formatCurrency} icon={<TrendingDown className="h-5 w-5" />} tone="sky" />
                  <StatCard
                    label="Growth"
                    value={`${revenueGrowth}%`}
                    icon={revenueGrowth >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    tone={revenueGrowth >= 0 ? "brand" : "rose"}
                  />
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Room vs Room</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <Label className="mb-1">Room A</Label>
                      <Select value={compareRoomA} onChange={(e) => setCompareRoomA(e.target.value)} className="h-9 w-40">
                        <option value="">Select room</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.room_number}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1">Room B</Label>
                      <Select value={compareRoomB} onChange={(e) => setCompareRoomB(e.target.value)} className="h-9 w-40">
                        <option value="">Select room</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.room_number}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  {roomA && roomB && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <RoomCompareCard stat={roomA} />
                      <RoomCompareCard stat={roomB} />
                    </div>
                  )}
                </div>
              </Card>

              {/* ---- Charts ---- */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Monthly Revenue by Room" description={`${year}`}>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 600, color: "#0f172a" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {monthlyMatrix.map((r, i) => (
                          <Bar key={r.room.id} dataKey={r.room.room_number} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard title="Revenue Trend Over Time" description={`${year} · all rooms combined`}>
                  <TrendLineChart data={monthlyTrend} />
                </ChartCard>

                <ChartCard title="Room Revenue Distribution" description={`${formatDate(range.from)} – ${formatDate(range.to)}`}>
                  {distributionData.length === 0 ? <EmptyState title="No revenue in this range" /> : <ExpenseCategoryDonut data={distributionData} />}
                </ChartCard>

                <ChartCard title="Occupancy Rate by Room" description={`${formatDate(range.from)} – ${formatDate(range.to)}`}>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={occupancyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 600, color: "#0f172a" }} />
                        <Bar dataKey="total" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {view === "monthly" && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Room Comparison</p>
                <div className="flex items-center gap-2">
                  <Label className="mb-0">Year</Label>
                  <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-28">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const y = new Date().getFullYear() - i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Room</TH>
                      {MONTH_LABELS.map((m) => (
                        <TH key={m}>{m}</TH>
                      ))}
                      <TH>Total</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {monthlyMatrix.map((row) => (
                      <TR key={row.room.id}>
                        <TD className="font-medium text-slate-900 dark:text-slate-100">{row.room.room_number}</TD>
                        {row.months.map((m, i) => (
                          <TD key={i}>{m > 0 ? formatCurrency(m) : "—"}</TD>
                        ))}
                        <TD className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.total)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}

          {view === "weekly" && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Weekly Revenue</p>
                <Input type="month" value={weekMonth} onChange={(e) => setWeekMonth(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Room</TH>
                      <TH>Week 1</TH>
                      <TH>Week 2</TH>
                      <TH>Week 3</TH>
                      <TH>Week 4</TH>
                      <TH>Week 5</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {weeklyRows.map((row) => (
                      <TR key={row.room.id}>
                        <TD className="font-medium text-slate-900 dark:text-slate-100">{row.room.room_number}</TD>
                        {row.weeks.map((w, i) => (
                          <TD key={i}>{w > 0 ? formatCurrency(w) : "—"}</TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}

          {view === "daily" && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daily Revenue</p>
                <Input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Room</TH>
                      <TH>Revenue</TH>
                      <TH>Bookings</TH>
                      <TH>Occupied</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {dailyRows.map((row) => (
                      <TR key={row.room.id}>
                        <TD className="font-medium text-slate-900 dark:text-slate-100">{row.room.room_number}</TD>
                        <TD>{row.revenue > 0 ? formatCurrency(row.revenue) : "—"}</TD>
                        <TD>{row.bookingCount}</TD>
                        <TD>
                          <Badge tone={row.occupied ? "green" : "slate"}>{row.occupied ? "Occupied" : "Vacant"}</Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ---- Booking drill-down ---- */}
      <Dialog open={!!drillDownRoom} onClose={() => setDrillDownRoomId(null)} title={drillDownRoom?.room_number ?? ""} description="Bookings in the selected date range" className="max-w-2xl">
        {drillDownBookings.length === 0 ? (
          <EmptyState title="No bookings in this range" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Guest</TH>
                  <TH>Check-in</TH>
                  <TH>Check-out</TH>
                  <TH>Nights</TH>
                  <TH>Amount</TH>
                  <TH>Payment</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {drillDownBookings.map((b) => (
                  <TR key={b.id}>
                    <TD>{b.guest?.full_name ?? "—"}</TD>
                    <TD>{formatDate(b.check_in)}</TD>
                    <TD>{formatDate(b.check_out)}</TD>
                    <TD>{nightsBetween(b.check_in, b.check_out)}</TD>
                    <TD className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(b.total_amount)}</TD>
                    <TD>
                      <Badge tone={paymentStatusTone(b.payment_status as PaymentStatus)} className="capitalize">
                        {b.payment_status}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={bookingStatusTone(b.booking_status as BookingStatus)} className="capitalize">
                        {BOOKING_STATUS_LABELS[b.booking_status] ?? b.booking_status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function HighlightPill({
  label,
  room,
  value,
  tone,
}: {
  label: string;
  room: Room | undefined;
  value: string;
  tone: "green" | "amber" | "blue" | "slate";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{room?.room_number ?? "—"}</p>
        <Badge tone={tone}>{value}</Badge>
      </div>
    </Card>
  );
}

function RoomCompareCard({ stat }: { stat: RoomStat }) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 p-4 dark:border-slate-800")}>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {stat.room.room_number} <span className="text-xs font-normal text-slate-400">· {stat.room.room_type}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Bookings" value={String(stat.bookingCount)} />
        <Metric label="Revenue" value={formatCurrency(stat.revenue)} />
        <Metric label="Occupancy" value={`${stat.occupancyRate}%`} />
        <Metric label="Avg / Night" value={formatCurrency(stat.avgPerNight)} />
      </div>
    </div>
  );
}
