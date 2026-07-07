import * as React from "react";
import { Link } from "react-router-dom";
import {
  LogIn,
  LogOut,
  Users,
  DoorOpen,
  Wallet,
  ClipboardList,
  PlusCircle,
  UserPlus,
  Download,
  CalendarClock,
  Sparkles as SparklesIcon,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { formatCurrency, formatDate, relativeTime, todayISO, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  StatCard,
  BookingStatusDonut,
  ReservationsChart,
  OccupancyGauge,
  RevenueBarChart,
} from "@/components/dashboard/DashboardWidgets";
import { countByDay, countByWeek, countByMonth, sumByDay, monthOverMonthChange, daysAgoISO } from "@/lib/dashboard-helpers";
import type { Room } from "@/lib/database.types";

interface BookingRow {
  id: string;
  created_at: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  total_amount: number;
  guest: { full_name: string } | null;
  room: { room_number: string } | null;
}

interface TransactionRow {
  id: string;
  amount: number;
  created_at: string;
  transaction_type: string;
  booking: { booking_number: string } | null;
  guest: { full_name: string } | null;
}

type Granularity = "daily" | "weekly" | "monthly";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [bookings, setBookings] = React.useState<BookingRow[]>([]);
  const [transactions, setTransactions] = React.useState<TransactionRow[]>([]);
  const [statusCounts, setStatusCounts] = React.useState({ confirmed: 0, checked_in: 0, checked_out: 0, cancelled: 0 });
  const [totalBookingsAllTime, setTotalBookingsAllTime] = React.useState(0);
  const [pendingBalance, setPendingBalance] = React.useState(0);
  const [granularity, setGranularity] = React.useState<Granularity>("daily");

  const load = React.useCallback(async () => {
    setLoading(true);
    const since = daysAgoISO(200);

    const [
      roomsRes,
      bookingsRes,
      txRes,
      confirmedRes,
      checkedInRes,
      checkedOutRes,
      cancelledRes,
      totalRes,
      pendingRes,
    ] = await Promise.all([
      supabase.from("rooms").select("*"),
      supabase
        .from("bookings")
        .select("id, created_at, check_in, check_out, booking_status, total_amount, guest:guests(full_name), room:rooms(room_number)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("transactions")
        .select("id, amount, created_at, transaction_type, booking:bookings(booking_number), guest:guests(full_name)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "confirmed"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "checked_in"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "checked_out"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "cancelled"),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase
        .from("bookings")
        .select("remaining_balance")
        .gt("remaining_balance", 0)
        .not("booking_status", "in", "(cancelled,checked_out)"),
    ]);

    setRooms((roomsRes.data as Room[]) ?? []);
    setBookings((bookingsRes.data as unknown as BookingRow[]) ?? []);
    setTransactions((txRes.data as unknown as TransactionRow[]) ?? []);
    setStatusCounts({
      confirmed: confirmedRes.count ?? 0,
      checked_in: checkedInRes.count ?? 0,
      checked_out: checkedOutRes.count ?? 0,
      cancelled: cancelledRes.count ?? 0,
    });
    setTotalBookingsAllTime(totalRes.count ?? 0);
    setPendingBalance((pendingRes.data ?? []).reduce((s: number, b: { remaining_balance: number }) => s + Number(b.remaining_balance), 0));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader />;

  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const activeBookings = bookings.filter((b) => b.booking_status !== "cancelled");

  const checkInsToday = activeBookings.filter((b) => b.check_in === today).length;
  const checkInsYesterday = activeBookings.filter((b) => b.check_in === yesterday).length;
  const checkOutsToday = bookings.filter((b) => b.check_out === today && b.booking_status === "checked_in").length;
  const checkOutsYesterday = activeBookings.filter((b) => b.check_out === yesterday).length;

  const availableRooms = rooms.filter((r) => r.status === "available").length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;

  const thisMonth = today.slice(0, 7);
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const bookingsThisMonth = bookings.filter((b) => b.created_at.slice(0, 7) === thisMonth).length;
  const bookingsLastMonth = bookings.filter((b) => b.created_at.slice(0, 7) === lastMonth).length;

  const revenueThisMonth = transactions.filter((t) => t.created_at.slice(0, 7) === thisMonth).reduce((s, t) => s + Number(t.amount), 0);
  const revenueLastMonth = transactions.filter((t) => t.created_at.slice(0, 7) === lastMonth).reduce((s, t) => s + Number(t.amount), 0);

  const bookingsSpark = countByDay(activeBookings, (b) => b.created_at, 14);
  const checkInSpark = countByDay(activeBookings, (b) => b.check_in, 14);
  const checkOutSpark = countByDay(activeBookings, (b) => b.check_out, 14);
  const revenueSpark = sumByDay(transactions, (t) => t.created_at, (t) => Number(t.amount), 14).map((d) => ({ label: d.label, count: d.total }));

  const donutData = [
    { name: "Confirmed", value: statusCounts.confirmed },
    { name: "Checked In", value: statusCounts.checked_in },
    { name: "Checked Out", value: statusCounts.checked_out },
    { name: "Cancelled", value: statusCounts.cancelled },
  ].filter((d) => d.value > 0);

  const reservationsSeries =
    granularity === "daily"
      ? countByDay(activeBookings, (b) => b.created_at, 14).map((d, i) => ({
          label: d.label,
          bookings: d.count,
          checkIns: countByDay(activeBookings, (b) => b.check_in, 14)[i]?.count ?? 0,
        }))
      : granularity === "weekly"
      ? countByWeek(activeBookings, (b) => b.created_at, 8).map((d, i) => ({
          label: d.label,
          bookings: d.count,
          checkIns: countByWeek(activeBookings, (b) => b.check_in, 8)[i]?.count ?? 0,
        }))
      : countByMonth(activeBookings, (b) => b.created_at, 6).map((d, i) => ({
          label: d.label,
          bookings: d.count,
          checkIns: countByMonth(activeBookings, (b) => b.check_in, 6)[i]?.count ?? 0,
        }));

  const revenueThisMonthDays = Number(today.slice(8, 10));
  const revenueDaily = sumByDay(
    transactions.filter((t) => t.created_at.slice(0, 7) === thisMonth),
    (t) => t.created_at,
    (t) => Number(t.amount),
    revenueThisMonthDays
  );

  const arrivalsToday = activeBookings.filter((b) => b.check_in === today);
  const departuresToday = bookings.filter((b) => b.check_out === today && b.booking_status === "checked_in");

  const recentActivity = [
    ...bookings.slice(0, 6).map((b) => ({
      id: `b-${b.id}`,
      type: "booking" as const,
      title: `New booking · ${b.guest?.full_name ?? "Guest"}`,
      subtitle: `Room ${b.room?.room_number ?? "—"}`,
      time: b.created_at,
    })),
    ...transactions.slice(0, 6).map((t) => ({
      id: `t-${t.id}`,
      type: "payment" as const,
      title: `Payment received · ${formatCurrency(t.amount)}`,
      subtitle: t.guest?.full_name ?? t.booking?.booking_number ?? "",
      time: t.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Bookings"
          value={totalBookingsAllTime}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="blue"
          trend={monthOverMonthChange(bookingsThisMonth, bookingsLastMonth)}
          sparkline={bookingsSpark}
        />
        <StatCard
          label="Available Rooms"
          value={availableRooms}
          icon={<DoorOpen className="h-5 w-5" />}
          tone="green"
          subtext={`${occupiedRooms} occupied of ${rooms.length}`}
        />
        <StatCard
          label="Check In Today"
          value={checkInsToday}
          icon={<LogIn className="h-5 w-5" />}
          tone="amber"
          trend={monthOverMonthChange(checkInsToday, checkInsYesterday)}
          sparkline={checkInSpark}
        />
        <StatCard
          label="Check Out Today"
          value={checkOutsToday}
          icon={<LogOut className="h-5 w-5" />}
          tone="red"
          trend={monthOverMonthChange(checkOutsToday, checkOutsYesterday)}
          sparkline={checkOutSpark}
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(revenueThisMonth)}
          icon={<Wallet className="h-5 w-5" />}
          tone="brand"
          trend={monthOverMonthChange(revenueThisMonth, revenueLastMonth)}
          subtext="This month"
          sparkline={revenueSpark}
        />
      </div>

      {/* Row 2: donut, reservations chart, today's schedule */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Booking Overview</p>
          {donutData.length === 0 ? (
            <EmptyState title="No bookings yet" />
          ) : (
            <BookingStatusDonut data={donutData} />
          )}
        </Card>

        <Card className="p-5 lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Reservations Analytics</p>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
              {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
                    granularity === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <ReservationsChart data={reservationsSeries} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Today's Schedule</p>
            <CalendarClock className="h-4 w-4 text-slate-400" />
          </div>
          {arrivalsToday.length === 0 && departuresToday.length === 0 ? (
            <EmptyState title="Nothing scheduled today" />
          ) : (
            <ul className="max-h-60 space-y-3 overflow-y-auto scrollbar-thin">
              {arrivalsToday.map((b) => (
                <ScheduleRow key={`arr-${b.id}`} kind="Check In" name={b.guest?.full_name ?? "Guest"} room={b.room?.room_number} tone="green" />
              ))}
              {departuresToday.map((b) => (
                <ScheduleRow key={`dep-${b.id}`} kind="Check Out" name={b.guest?.full_name ?? "Guest"} room={b.room?.room_number} tone="amber" />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Row 3: occupancy, revenue, recent activity, quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-slate-800">Occupancy Rate</p>
          <OccupancyGauge occupied={occupiedRooms} total={rooms.length} />
        </Card>

        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-slate-800">Revenue Overview</p>
          <p className="mb-1 text-xl font-semibold text-slate-900">{formatCurrency(revenueThisMonth)}</p>
          <p className="mb-2 text-xs text-slate-400">This month</p>
          <RevenueBarChart data={revenueDaily.map((d) => ({ label: d.label, total: d.total }))} />
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-slate-800">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="max-h-60 space-y-3 overflow-y-auto scrollbar-thin">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      a.type === "booking" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                    )}
                  >
                    {a.type === "booking" ? <ClipboardList className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                    <p className="truncate text-xs text-slate-400">{a.subtitle}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{relativeTime(a.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-slate-800">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction to="/bookings/new" label="New Booking" icon={<PlusCircle className="h-4 w-4" />} tone="blue" />
            <QuickAction to="/rooms" label="Manage Rooms" icon={<DoorOpen className="h-4 w-4" />} tone="green" />
            <QuickAction to="/services" label="Services" icon={<SparklesIcon className="h-4 w-4" />} tone="amber" />
            <QuickAction to="/transactions" label="Export CSV" icon={<Download className="h-4 w-4" />} tone="brand" />
          </div>
          {profile?.role === "admin" && (
            <Link to="/settings/users" className="mt-2 block">
              <Button variant="outline" size="sm" className="w-full">
                <UserPlus className="h-4 w-4" /> Add Staff Account
              </Button>
            </Link>
          )}
        </Card>
      </div>

      {/* keep a couple of light "everything at a glance" callouts below the fold */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Current Guests</p>
            <p className="text-xl font-semibold text-slate-900">{statusCounts.checked_in}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Pending Balance</p>
            <p className="text-xl font-semibold text-slate-900">{formatCurrency(pendingBalance)}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Wallet className="h-5 w-5" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ScheduleRow({
  kind,
  name,
  room,
  tone,
}: {
  kind: string;
  name: string;
  room?: string;
  tone: "green" | "amber";
}) {
  return (
    <li className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
        )}
      >
        {tone === "green" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
        <p className="text-xs text-slate-400">Room {room ?? "—"}</p>
      </div>
      <Badge tone={tone === "green" ? "green" : "amber"}>{kind}</Badge>
    </li>
  );
}

function QuickAction({
  to,
  label,
  icon,
  tone,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "brand";
}) {
  const toneClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    green: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
    amber: "bg-amber-50 text-amber-600 hover:bg-amber-100",
    brand: "bg-brand-50 text-brand-600 hover:bg-brand-100",
  };
  return (
    <Link
      to={to}
      className={cn("flex flex-col items-start gap-2 rounded-xl p-3 text-sm font-medium transition-colors", toneClasses[tone])}
    >
      {icon}
      {label}
    </Link>
  );
}
