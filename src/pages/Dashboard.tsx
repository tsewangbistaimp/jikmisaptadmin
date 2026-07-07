import * as React from "react";
import { Link } from "react-router-dom";
import {
  LogIn,
  LogOut,
  Users,
  DoorOpen,
  DoorClosed,
  Wallet,
  Hourglass,
  TrendingUp,
  PlusCircle,
  CreditCard,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, EmptyState, Skeleton } from "@/components/ui/misc";
import { formatCurrency, formatDate, formatDateTime, todayISO } from "@/lib/utils";
import type { BookingWithRelations, Room, TransactionWithRelations } from "@/lib/database.types";
import { paymentStatusTone, bookingStatusTone } from "@/lib/badge-tones";

interface Stats {
  checkInsToday: number;
  checkOutsToday: number;
  currentGuests: number;
  availableRooms: number;
  occupiedRooms: number;
  todayIncome: number;
  pendingBalance: number;
  monthlyRevenue: number;
}

export default function Dashboard() {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = React.useState<BookingWithRelations[]>([]);
  const [recentTransactions, setRecentTransactions] = React.useState<TransactionWithRelations[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const today = todayISO();
    const monthStart = today.slice(0, 8) + "01";

    const [
      checkInsRes,
      checkOutsRes,
      currentGuestsRes,
      roomsRes,
      todayTxRes,
      pendingRes,
      monthTxRes,
      recentBookingsRes,
      recentTxRes,
    ] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_in", today).neq("booking_status", "cancelled"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_out", today).eq("booking_status", "checked_in"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "checked_in"),
      supabase.from("rooms").select("*"),
      supabase.from("transactions").select("amount").gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
      supabase.from("bookings").select("remaining_balance").gt("remaining_balance", 0).neq("booking_status", "cancelled").neq("booking_status", "checked_out"),
      supabase.from("transactions").select("amount").gte("created_at", `${monthStart}T00:00:00`),
      supabase
        .from("bookings")
        .select("*, guest:guests(*), room:rooms(*)")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("transactions")
        .select("*, booking:bookings(id, booking_number), guest:guests(id, full_name)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const rooms = (roomsRes.data as Room[]) ?? [];
    const todayIncome = (todayTxRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
    const pendingBalance = (pendingRes.data ?? []).reduce((sum: number, b: { remaining_balance: number }) => sum + Number(b.remaining_balance), 0);
    const monthlyRevenue = (monthTxRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

    setStats({
      checkInsToday: checkInsRes.count ?? 0,
      checkOutsToday: checkOutsRes.count ?? 0,
      currentGuests: currentGuestsRes.count ?? 0,
      availableRooms: rooms.filter((r) => r.status === "available").length,
      occupiedRooms: rooms.filter((r) => r.status === "occupied").length,
      todayIncome,
      pendingBalance,
      monthlyRevenue,
    });
    setRecentBookings((recentBookingsRes.data as BookingWithRelations[]) ?? []);
    setRecentTransactions((recentTxRes.data as TransactionWithRelations[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Here's what's happening at Jikmis Apartment today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Check-ins Today" value={stats.checkInsToday} icon={<LogIn className="h-5 w-5" />} tone="brand" />
        <StatCard label="Check-outs Today" value={stats.checkOutsToday} icon={<LogOut className="h-5 w-5" />} tone="slate" />
        <StatCard label="Current Guests" value={stats.currentGuests} icon={<Users className="h-5 w-5" />} tone="green" />
        <StatCard label="Available Rooms" value={stats.availableRooms} icon={<DoorOpen className="h-5 w-5" />} tone="green" />
        <StatCard label="Occupied Rooms" value={stats.occupiedRooms} icon={<DoorClosed className="h-5 w-5" />} tone="amber" />
        <StatCard label="Today's Income" value={formatCurrency(stats.todayIncome)} icon={<Wallet className="h-5 w-5" />} tone="brand" />
        <StatCard label="Pending Balance" value={formatCurrency(stats.pendingBalance)} icon={<Hourglass className="h-5 w-5" />} tone="red" />
        <StatCard label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" />
      </div>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/bookings/new">
            <Button size="sm">
              <PlusCircle className="h-4 w-4" /> New Booking
            </Button>
          </Link>
          <Link to="/transactions">
            <Button size="sm" variant="outline">
              <CreditCard className="h-4 w-4" /> View Transactions
            </Button>
          </Link>
          <Link to="/guests">
            <Button size="sm" variant="outline">
              <Users className="h-4 w-4" /> View Guests
            </Button>
          </Link>
          <Link to="/bookings">
            <Button size="sm" variant="outline">
              <Search className="h-4 w-4" /> Search Booking
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link to="/bookings" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="pt-3">
            {recentBookings.length === 0 ? (
              <EmptyState title="No bookings yet" description="New bookings will show up here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{b.guest?.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {b.booking_number} · Room {b.room?.room_number} · {formatDate(b.check_in)} → {formatDate(b.check_out)}
                      </p>
                    </div>
                    <Badge tone={bookingStatusTone(b.booking_status)}>{b.booking_status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link to="/transactions" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="pt-3">
            {recentTransactions.length === 0 ? (
              <EmptyState title="No transactions yet" description="Payments will show up here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{t.guest?.full_name ?? "—"}</p>
                      <p className="text-xs text-slate-400">
                        {t.booking?.booking_number} · {formatDateTime(t.created_at)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(t.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
