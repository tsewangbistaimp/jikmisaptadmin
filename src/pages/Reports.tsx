import * as React from "react";
import {
  Wallet,
  Receipt,
  PiggyBank,
  DoorOpen,
  ClipboardList,
  Users,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  CalendarDays,
  ListTree,
  LineChart as LineChartIcon,
  BedDouble,
  Award,
  Percent,
  CalendarCheck,
  LogIn,
  LogOut,
  Landmark,
  Banknote,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { ExportMenu } from "@/components/ui/export-menu";
import { StatCard, RevenueBarChart, ExpenseTrendChart, IncomeVsExpenseChart, ExpenseCategoryDonut } from "@/components/dashboard/DashboardWidgets";
import { ProfitTrendChart, TrendLineChart, DateRangeFilterBar, AdvancedFiltersBar, GranularityToggle } from "@/components/reports/ReportWidgets";
import { FinancialCalendar } from "@/components/reports/FinancialCalendar";
import { DayDetailDialog } from "@/components/reports/DayDetailDialog";
import { cn, formatCurrency, formatDateTime, formatDate, todayISO } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { sumByDay, sumByWeek, sumByMonth, sumByYear, monthOverMonthChange } from "@/lib/dashboard-helpers";
import {
  getPresetRange,
  sumInRange,
  filterInRange,
  buildDailyNet,
  buildLedger,
  netTransactionAmount,
  roomNightsInRange,
  aggregateByRoom,
  averageStay,
  growthPct,
  type DateRangePreset,
} from "@/lib/report-helpers";
import type { Room } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Row shapes fetched for this page. Kept local (not reusing Dashboard's
// interfaces) because Reports needs a couple of extra fields (payment
// method, transaction_type, remaining_balance) that Dashboard doesn't.
// ---------------------------------------------------------------------------
interface ReportBooking {
  id: string;
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  total_amount: number;
  remaining_balance: number;
  created_at: string;
}

interface ReportTransaction {
  id: string;
  booking_id: string | null;
  amount: number;
  created_at: string;
  payment_method: string;
  transaction_type: string;
  booking: { booking_number: string } | null;
  guest: { full_name: string } | null;
}

interface ReportExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  payment_method: string;
  category: { name: string } | null;
}

type PLGranularity = "daily" | "weekly" | "monthly" | "yearly";
type Tab = "overview" | "analytics" | "calendar" | "ledger" | "closing";

const PL_WINDOW: Record<PLGranularity, number> = { daily: 30, weekly: 12, monthly: 12, yearly: 5 };

export default function Reports() {
  const [loading, setLoading] = React.useState(true);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [bookings, setBookings] = React.useState<ReportBooking[]>([]);
  const [transactions, setTransactions] = React.useState<ReportTransaction[]>([]);
  const [expenses, setExpenses] = React.useState<ReportExpense[]>([]);

  const [tab, setTab] = React.useState<Tab>("overview");
  const [plGranularity, setPlGranularity] = React.useState<PLGranularity>("monthly");

  const [preset, setPreset] = React.useState<DateRangePreset>("month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  const [roomFilter, setRoomFilter] = React.useState("all");
  const [guestFilter, setGuestFilter] = React.useState("all");
  const [methodFilter, setMethodFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [closingDate, setClosingDate] = React.useState(() => todayISO());

  const load = React.useCallback(async () => {
    setLoading(true);
    // Reports must reconcile to the cent, unlike the Dashboard's "recent
    // trend" feed — so unlike Dashboard.tsx (which windows to the last 200
    // days), everything here is fetched with no lower date bound. A 10,000
    // row cap is a generous ceiling for a small apartment's lifetime data;
    // if this property ever outgrows that, switch to server-side paging.
    const [roomsRes, bookingsRes, txRes, expensesRes] = await Promise.all([
      supabase.from("rooms").select("*"),
      supabase
        .from("bookings")
        .select("id, room_id, guest_id, check_in, check_out, booking_status, total_amount, remaining_balance, created_at")
        .order("created_at", { ascending: true })
        .limit(10000),
      supabase
        .from("transactions")
        .select("id, booking_id, amount, created_at, payment_method, transaction_type, booking:bookings(booking_number), guest:guests(full_name)")
        .order("created_at", { ascending: true })
        .limit(10000),
      supabase
        .from("expenses")
        .select("id, title, amount, date, payment_method, category:expense_categories(name)")
        .order("date", { ascending: true })
        .limit(10000),
    ]);

    setRooms((roomsRes.data as Room[]) ?? []);
    setBookings((bookingsRes.data as unknown as ReportBooking[]) ?? []);
    setTransactions((txRes.data as unknown as ReportTransaction[]) ?? []);
    setExpenses((expensesRes.data as unknown as ReportExpense[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Live refresh — same pattern as Dashboard.tsx: any booking/transaction/
  // expense change anywhere in the app should update these figures without
  // a manual reload, since this page is meant to be trusted at a glance.
  React.useEffect(() => {
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (loading) return <PageLoader />;

  // ---- Fixed today / month / year figures (independent of the filter bar) ----
  const todayRange = getPresetRange("today");
  const monthRange = getPresetRange("month");
  const yearRange = getPresetRange("year");

  const revenue = (from: string, to: string) => sumInRange(transactions, (t) => t.created_at, netTransactionAmount, from, to);
  const expenseTotal = (from: string, to: string) => sumInRange(expenses, (e) => e.date, (e) => Number(e.amount), from, to);

  const revenueToday = revenue(todayRange.from, todayRange.to);
  const expensesToday = expenseTotal(todayRange.from, todayRange.to);
  const revenueMonth = revenue(monthRange.from, monthRange.to);
  const expensesMonth = expenseTotal(monthRange.from, monthRange.to);
  const revenueYear = revenue(yearRange.from, yearRange.to);
  const expensesYear = expenseTotal(yearRange.from, yearRange.to);

  const today = todayRange.from;
  const activeBookings = bookings.filter((b) => b.booking_status !== "cancelled");
  const occupiedTodayRoomIds = new Set(
    activeBookings.filter((b) => b.booking_status !== "checked_out" && b.check_in <= today && b.check_out > today).map((b) => b.room_id)
  );
  const underMaintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;
  const occupiedRooms = rooms.filter((r) => occupiedTodayRoomIds.has(r.id)).length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

  const totalBookings = bookings.length;
  const activeGuests = bookings.filter((b) => b.booking_status === "checked_in").length;
  const pendingBookings = bookings.filter((b) => Number(b.remaining_balance) > 0 && !["cancelled", "checked_out"].includes(b.booking_status));
  const pendingAmount = pendingBookings.reduce((s, b) => s + Number(b.remaining_balance), 0);

  // ---- P&L trend series ----
  const n = PL_WINDOW[plGranularity];
  const incomeSeries =
    plGranularity === "daily"
      ? sumByDay(transactions, (t) => t.created_at, netTransactionAmount, n)
      : plGranularity === "weekly"
      ? sumByWeek(transactions, (t) => t.created_at, netTransactionAmount, n)
      : plGranularity === "monthly"
      ? sumByMonth(transactions, (t) => t.created_at, netTransactionAmount, n)
      : sumByYear(transactions, (t) => t.created_at, netTransactionAmount, n);
  const expenseSeries =
    plGranularity === "daily"
      ? sumByDay(expenses, (e) => e.date, (e) => Number(e.amount), n)
      : plGranularity === "weekly"
      ? sumByWeek(expenses, (e) => e.date, (e) => Number(e.amount), n)
      : plGranularity === "monthly"
      ? sumByMonth(expenses, (e) => e.date, (e) => Number(e.amount), n)
      : sumByYear(expenses, (e) => e.date, (e) => Number(e.amount), n);
  const profitSeries = incomeSeries.map((d, i) => ({ label: d.label, total: d.total - (expenseSeries[i]?.total ?? 0) }));

  // ---- Monthly & Yearly Analytics ----
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const monthBookings = bookings.filter((b) => b.check_in >= monthRange.from && b.check_in <= monthRange.to);
  const monthRoomAgg = aggregateByRoom(monthBookings);
  let bestRoom: { room: Room | undefined; revenue: number } | null = null;
  let mostBookedRoom: { room: Room | undefined; count: number } | null = null;
  for (const agg of monthRoomAgg.values()) {
    if (!bestRoom || agg.revenue > bestRoom.revenue) bestRoom = { room: roomById.get(agg.roomId), revenue: agg.revenue };
    if (!mostBookedRoom || agg.bookingCount > mostBookedRoom.count) mostBookedRoom = { room: roomById.get(agg.roomId), count: agg.bookingCount };
  }
  const avgStayMonth = averageStay(monthBookings);
  const roomNightsMonth = roomNightsInRange(bookings, monthRange.from, monthRange.to);
  const adrMonth = roomNightsMonth > 0 ? revenueMonth / roomNightsMonth : 0;

  const lastMonthRange = getPresetRange("lastMonth");
  const revenueLastMonth = revenue(lastMonthRange.from, lastMonthRange.to);
  const expensesLastMonth = expenseTotal(lastMonthRange.from, lastMonthRange.to);
  const momRevenueChange = monthOverMonthChange(revenueMonth, revenueLastMonth);
  const momExpenseChange = monthOverMonthChange(expensesMonth, expensesLastMonth);
  const momProfitChange = monthOverMonthChange(revenueMonth - expensesMonth, revenueLastMonth - expensesLastMonth);

  const lastYearFrom = `${Number(yearRange.from.slice(0, 4)) - 1}-01-01`;
  const lastYearTo = `${Number(yearRange.from.slice(0, 4)) - 1}-12-31`;
  const revenueLastYear = revenue(lastYearFrom, lastYearTo);
  const expensesLastYear = expenseTotal(lastYearFrom, lastYearTo);
  const revenueGrowthPct = growthPct(revenueYear, revenueLastYear);
  const profitGrowthPct = growthPct(revenueYear - expensesYear, revenueLastYear - expensesLastYear);

  const yearlyIncomeSeries = sumByYear(transactions, (t) => t.created_at, netTransactionAmount, 5);
  const yearlyExpenseSeries = sumByYear(expenses, (e) => e.date, (e) => Number(e.amount), 5);
  const yearlyCombinedSeries = yearlyIncomeSeries.map((y, i) => ({ label: y.label, income: y.total, expenses: yearlyExpenseSeries[i]?.total ?? 0 }));
  const yearlyProfitSeries = yearlyIncomeSeries.map((y, i) => ({ label: y.label, total: y.total - (yearlyExpenseSeries[i]?.total ?? 0) }));

  const allTimeRoomAgg = aggregateByRoom(activeBookings);
  const roomRevenueShare = Array.from(allTimeRoomAgg.values())
    .map((agg) => ({ name: roomById.get(agg.roomId)?.room_number ?? "Unknown", value: agg.revenue }))
    .sort((a, b) => b.value - a.value);

  // ---- Ledger tab filter option lists ----
  const roomOptions = rooms.map((r) => ({ value: r.id, label: `${r.room_number} · ${r.room_type}` }));
  const guestOptions = Array.from(new Set(transactions.map((t) => t.guest?.full_name).filter((n): n is string => !!n)))
    .sort()
    .map((n) => ({ value: n, label: n }));
  const methodOptions = Array.from(new Set([...Object.keys(PAYMENT_METHOD_LABELS), ...Object.keys(EXPENSE_PAYMENT_METHOD_LABELS)])).map((v) => ({
    value: v,
    label: PAYMENT_METHOD_LABELS[v] ?? EXPENSE_PAYMENT_METHOD_LABELS[v] ?? v,
  }));
  const categoryOptions = Array.from(new Set(expenses.map((e) => e.category?.name).filter((n): n is string => !!n)))
    .sort()
    .map((n) => ({ value: n, label: n }));

  // ---- Calendar tab data ----
  const monthStart = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
  const dailyNet = buildDailyNet(
    transactions,
    (t) => t.created_at,
    netTransactionAmount,
    expenses,
    (e) => e.date,
    (e) => Number(e.amount),
    monthStart,
    monthEnd
  );
  const dayTransactions = selectedDay ? transactions.filter((t) => t.created_at.slice(0, 10) === selectedDay) : [];
  const dayExpenses = selectedDay ? expenses.filter((e) => e.date.slice(0, 10) === selectedDay) : [];

  // ---- Ledger tab data ----
  // Room/Guest/Category are each only meaningful for one side of the
  // ledger (a room or guest only applies to income; a category only
  // applies to expenses) — so setting one of those narrows to just its
  // matching row type and clears the other, rather than showing an
  // unfiltered mix. Payment Method applies to both and simply narrows.
  const filterRange = getPresetRange(preset, { from: customFrom, to: customTo });
  let ledgerTransactions = filterInRange(transactions, (t) => t.created_at, filterRange.from, filterRange.to);
  let ledgerExpenses = filterInRange(expenses, (e) => e.date, filterRange.from, filterRange.to);

  if (roomFilter !== "all") {
    const roomBookingIds = new Set(bookings.filter((b) => b.room_id === roomFilter).map((b) => b.id));
    ledgerTransactions = ledgerTransactions.filter((t) => !!t.booking_id && roomBookingIds.has(t.booking_id));
    ledgerExpenses = [];
  }
  if (guestFilter !== "all") {
    ledgerTransactions = ledgerTransactions.filter((t) => t.guest?.full_name === guestFilter);
    ledgerExpenses = [];
  }
  if (categoryFilter !== "all") {
    ledgerExpenses = ledgerExpenses.filter((e) => e.category?.name === categoryFilter);
    ledgerTransactions = [];
  }
  if (methodFilter !== "all") {
    ledgerTransactions = ledgerTransactions.filter((t) => t.payment_method === methodFilter);
    ledgerExpenses = ledgerExpenses.filter((e) => e.payment_method === methodFilter);
  }

  const ledger = buildLedger(ledgerTransactions, ledgerExpenses);

  const exportLedgerCsv = () => {
    const header = ["Date", "Type", "Description", "Income", "Expense", "Running Balance", "Payment Method", "Reference", "Guest", "Booking"];
    const rows = ledger.map((r) => [
      r.date.slice(0, 10),
      r.type,
      r.description,
      r.income || "",
      r.expense || "",
      r.runningBalance,
      PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
      r.reference,
      r.guest,
      r.booking,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${filterRange.from}-to-${filterRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLedgerExcel = async () => {
    const { downloadExcelWorkbook } = await import("@/lib/export-excel");
    downloadExcelWorkbook(`ledger-${filterRange.from}-to-${filterRange.to}.xlsx`, [
      {
        name: "Ledger",
        columns: [
          { header: "Date", key: "date" },
          { header: "Type", key: "type" },
          { header: "Description", key: "description" },
          { header: "Income", key: "income", numeric: true },
          { header: "Expense", key: "expense", numeric: true },
          { header: "Running Balance", key: "balance", numeric: true },
          { header: "Payment Method", key: "method" },
          { header: "Reference", key: "reference" },
          { header: "Guest", key: "guest" },
          { header: "Booking", key: "booking" },
        ],
        rows: ledger.map((r) => ({
          date: r.date.slice(0, 10),
          type: r.type,
          description: r.description,
          income: r.income,
          expense: r.expense,
          balance: r.runningBalance,
          method: PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
          reference: r.reference,
          guest: r.guest,
          booking: r.booking,
        })),
      },
    ]);
  };

  const exportLedgerPdf = async () => {
    const { downloadPdfReport } = await import("@/lib/export-pdf");
    const totalIncome = ledger.reduce((s, r) => s + r.income, 0);
    const totalExpense = ledger.reduce((s, r) => s + r.expense, 0);
    downloadPdfReport({
      title: "Financial Ledger",
      subtitle: `${filterRange.from} to ${filterRange.to} · ${ledger.length} entries`,
      summary: [
        { label: "Total Income", value: formatCurrency(totalIncome), tone: "positive" },
        { label: "Total Expenses", value: formatCurrency(totalExpense), tone: "negative" },
        { label: "Net Balance", value: formatCurrency(totalIncome - totalExpense) },
      ],
      sections: [
        {
          columns: ["Date", "Type", "Description", "Income", "Expense", "Balance", "Guest/Booking"],
          rows: ledger.map((r) => [
            r.date.slice(0, 10),
            r.type,
            r.description,
            r.income ? formatCurrency(r.income) : "—",
            r.expense ? formatCurrency(r.expense) : "—",
            formatCurrency(r.runningBalance),
            [r.guest, r.booking].filter(Boolean).join(" · ") || "—",
          ]),
        },
      ],
      filename: `ledger-${filterRange.from}-to-${filterRange.to}.pdf`,
    });
  };

  // ---- Full-report export (Overview tab) — the multi-sheet workbook and
  // branded PDF statement requested for "Advanced Export System". Uses
  // fixed 12-month / 5-year windows regardless of the P&L toggle above, so
  // the exported report is always complete rather than matching whatever
  // granularity happened to be selected on screen.
  const exportFullExcel = async () => {
    const { downloadExcelWorkbook } = await import("@/lib/export-excel");
    const monthlyIncome = sumByMonth(transactions, (t) => t.created_at, netTransactionAmount, 12);
    const monthlyExpense = sumByMonth(expenses, (e) => e.date, (e) => Number(e.amount), 12);
    const yearlyIncome = sumByYear(transactions, (t) => t.created_at, netTransactionAmount, 5);
    const yearlyExpense = sumByYear(expenses, (e) => e.date, (e) => Number(e.amount), 5);
    const allTimeRevenue = transactions.reduce((s, t) => s + netTransactionAmount(t), 0);
    const allTimeExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    downloadExcelWorkbook(`jikmis-apartment-report-${todayRange.from}.xlsx`, [
      {
        name: "Totals",
        columns: [{ header: "Metric", key: "metric" }, { header: "Value", key: "value" }],
        rows: [
          { metric: "Total Revenue (All Time)", value: allTimeRevenue },
          { metric: "Total Expenses (All Time)", value: allTimeExpense },
          { metric: "Net Profit (All Time)", value: allTimeRevenue - allTimeExpense },
          { metric: "Total Bookings", value: totalBookings },
          { metric: "Total Transactions", value: transactions.length },
          { metric: "Total Expense Entries", value: expenses.length },
          { metric: "Occupancy Rate Today (%)", value: occupancyRate },
          { metric: "Pending Payments (count)", value: pendingBookings.length },
          { metric: "Pending Payments (amount)", value: pendingAmount },
        ],
      },
      {
        name: "Profit and Loss",
        columns: [{ header: "Period", key: "period" }, { header: "Revenue", key: "revenue", numeric: true }, { header: "Expenses", key: "expenses", numeric: true }, { header: "Net Profit", key: "profit", numeric: true }],
        rows: [
          { period: "Today", revenue: revenueToday, expenses: expensesToday, profit: revenueToday - expensesToday },
          { period: "This Month", revenue: revenueMonth, expenses: expensesMonth, profit: revenueMonth - expensesMonth },
          { period: "This Year", revenue: revenueYear, expenses: expensesYear, profit: revenueYear - expensesYear },
        ],
      },
      {
        name: "Monthly Summary",
        columns: [{ header: "Month", key: "month" }, { header: "Revenue", key: "revenue", numeric: true }, { header: "Expenses", key: "expenses", numeric: true }, { header: "Net Profit", key: "profit", numeric: true }],
        rows: monthlyIncome.map((m, i) => ({ month: m.label, revenue: m.total, expenses: monthlyExpense[i]?.total ?? 0, profit: m.total - (monthlyExpense[i]?.total ?? 0) })),
      },
      {
        name: "Yearly Summary",
        columns: [{ header: "Year", key: "year" }, { header: "Revenue", key: "revenue", numeric: true }, { header: "Expenses", key: "expenses", numeric: true }, { header: "Net Profit", key: "profit", numeric: true }],
        rows: yearlyIncome.map((y, i) => ({ year: y.label, revenue: y.total, expenses: yearlyExpense[i]?.total ?? 0, profit: y.total - (yearlyExpense[i]?.total ?? 0) })),
      },
      {
        name: "Transactions",
        columns: [
          { header: "Date", key: "date" },
          { header: "Guest", key: "guest" },
          { header: "Booking", key: "booking" },
          { header: "Amount", key: "amount", numeric: true },
          { header: "Method", key: "method" },
          { header: "Type", key: "type" },
        ],
        rows: transactions.map((t) => ({
          date: formatDateTime(t.created_at),
          guest: t.guest?.full_name ?? "",
          booking: t.booking?.booking_number ?? "",
          amount: Number(t.amount),
          method: PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
          type: t.transaction_type,
        })),
      },
      {
        name: "Expenses",
        columns: [
          { header: "Date", key: "date" },
          { header: "Title", key: "title" },
          { header: "Category", key: "category" },
          { header: "Amount", key: "amount", numeric: true },
          { header: "Method", key: "method" },
        ],
        rows: expenses.map((e) => ({
          date: e.date,
          title: e.title,
          category: e.category?.name ?? "",
          amount: Number(e.amount),
          method: e.payment_method,
        })),
      },
    ]);
  };

  const exportFullPdf = async () => {
    const { downloadPdfReport } = await import("@/lib/export-pdf");
    const monthlyIncome = sumByMonth(transactions, (t) => t.created_at, netTransactionAmount, 12);
    const monthlyExpense = sumByMonth(expenses, (e) => e.date, (e) => Number(e.amount), 12);
    const yearlyIncome = sumByYear(transactions, (t) => t.created_at, netTransactionAmount, 5);
    const yearlyExpense = sumByYear(expenses, (e) => e.date, (e) => Number(e.amount), 5);

    downloadPdfReport({
      title: "Financial Report",
      subtitle: `Summary as of ${todayRange.from}`,
      summary: [
        { label: "Today's Profit", value: formatCurrency(revenueToday - expensesToday), tone: revenueToday - expensesToday >= 0 ? "positive" : "negative" },
        { label: "Monthly Profit", value: formatCurrency(revenueMonth - expensesMonth), tone: revenueMonth - expensesMonth >= 0 ? "positive" : "negative" },
        { label: "Yearly Profit", value: formatCurrency(revenueYear - expensesYear), tone: revenueYear - expensesYear >= 0 ? "positive" : "negative" },
        { label: "Occupancy", value: `${occupancyRate}%` },
      ],
      sections: [
        {
          title: "Profit & Loss Summary",
          columns: ["Period", "Revenue", "Expenses", "Net Profit"],
          rows: [
            ["Today", formatCurrency(revenueToday), formatCurrency(expensesToday), formatCurrency(revenueToday - expensesToday)],
            ["This Month", formatCurrency(revenueMonth), formatCurrency(expensesMonth), formatCurrency(revenueMonth - expensesMonth)],
            ["This Year", formatCurrency(revenueYear), formatCurrency(expensesYear), formatCurrency(revenueYear - expensesYear)],
          ],
        },
        {
          title: "Monthly Trend (Last 12 Months)",
          columns: ["Month", "Revenue", "Expenses", "Net Profit"],
          rows: monthlyIncome.map((m, i) => [m.label, formatCurrency(m.total), formatCurrency(monthlyExpense[i]?.total ?? 0), formatCurrency(m.total - (monthlyExpense[i]?.total ?? 0))]),
        },
        {
          title: "Yearly Trend",
          columns: ["Year", "Revenue", "Expenses", "Net Profit"],
          rows: yearlyIncome.map((y, i) => [y.label, formatCurrency(y.total), formatCurrency(yearlyExpense[i]?.total ?? 0), formatCurrency(y.total - (yearlyExpense[i]?.total ?? 0))]),
        },
      ],
      filename: `jikmis-apartment-report-${todayRange.from}.pdf`,
    });
  };

  // ---- Daily Closing Report (Closing tab) — a one-click end-of-day summary
  // for a single chosen date (defaults to today). Pending payments/occupancy
  // reflect the live snapshot rather than a historical reconstruction, which
  // is the right behaviour when closing out today but is a known simplification
  // if an admin picks a past date to re-print a closing report.
  const closingTransactions = transactions.filter((t) => t.created_at.slice(0, 10) === closingDate);
  const closingExpenses = expenses.filter((e) => e.date.slice(0, 10) === closingDate);
  const closingRevenue = closingTransactions.reduce((s, t) => s + netTransactionAmount(t), 0);
  const closingExpenseTotal = closingExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const closingProfit = closingRevenue - closingExpenseTotal;
  const closingCash = closingTransactions.filter((t) => t.payment_method === "cash").reduce((s, t) => s + netTransactionAmount(t), 0);
  const closingBank = closingTransactions.filter((t) => t.payment_method === "bank_transfer").reduce((s, t) => s + netTransactionAmount(t), 0);
  const closingOnline = closingTransactions
    .filter((t) => t.payment_method === "esewa" || t.payment_method === "khalti")
    .reduce((s, t) => s + netTransactionAmount(t), 0);
  const closingCheckIns = bookings.filter((b) => b.check_in === closingDate && b.booking_status !== "cancelled");
  const closingCheckOuts = bookings.filter((b) => b.check_out === closingDate && b.booking_status !== "cancelled");
  const closingOccupiedRoomIds = new Set(
    activeBookings.filter((b) => b.booking_status !== "checked_out" && b.check_in <= closingDate && b.check_out > closingDate).map((b) => b.room_id)
  );
  const closingOccupancyRate = rooms.length > 0 ? Math.round((rooms.filter((r) => closingOccupiedRoomIds.has(r.id)).length / rooms.length) * 100) : 0;

  const exportClosingExcel = async () => {
    const { downloadExcelWorkbook } = await import("@/lib/export-excel");
    downloadExcelWorkbook(`daily-closing-${closingDate}.xlsx`, [
      {
        name: "Daily Closing",
        columns: [{ header: "Metric", key: "metric" }, { header: "Value", key: "value" }],
        rows: [
          { metric: "Date", value: closingDate },
          { metric: "Revenue", value: closingRevenue },
          { metric: "Expenses", value: closingExpenseTotal },
          { metric: "Net Profit", value: closingProfit },
          { metric: "Cash", value: closingCash },
          { metric: "Bank Transfer", value: closingBank },
          { metric: "Online (eSewa/Khalti)", value: closingOnline },
          { metric: "Pending Payments (amount)", value: pendingAmount },
          { metric: "Check-ins", value: closingCheckIns.length },
          { metric: "Check-outs", value: closingCheckOuts.length },
          { metric: "Occupancy Rate (%)", value: closingOccupancyRate },
        ],
      },
      {
        name: "Transactions",
        columns: [
          { header: "Time", key: "time" },
          { header: "Guest", key: "guest" },
          { header: "Booking", key: "booking" },
          { header: "Amount", key: "amount", numeric: true },
          { header: "Method", key: "method" },
          { header: "Type", key: "type" },
        ],
        rows: closingTransactions.map((t) => ({
          time: formatDateTime(t.created_at),
          guest: t.guest?.full_name ?? "",
          booking: t.booking?.booking_number ?? "",
          amount: netTransactionAmount(t),
          method: PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
          type: t.transaction_type,
        })),
      },
      {
        name: "Expenses",
        columns: [
          { header: "Title", key: "title" },
          { header: "Category", key: "category" },
          { header: "Amount", key: "amount", numeric: true },
          { header: "Method", key: "method" },
        ],
        rows: closingExpenses.map((e) => ({
          title: e.title,
          category: e.category?.name ?? "",
          amount: Number(e.amount),
          method: e.payment_method,
        })),
      },
    ]);
  };

  const exportClosingPdf = async () => {
    const { downloadPdfReport } = await import("@/lib/export-pdf");
    downloadPdfReport({
      title: "Daily Closing Report",
      subtitle: formatDate(closingDate),
      summary: [
        { label: "Revenue", value: formatCurrency(closingRevenue), tone: "positive" },
        { label: "Expenses", value: formatCurrency(closingExpenseTotal), tone: "negative" },
        { label: "Net Profit", value: formatCurrency(closingProfit), tone: closingProfit >= 0 ? "positive" : "negative" },
        { label: "Occupancy", value: `${closingOccupancyRate}%` },
      ],
      sections: [
        {
          title: "Cash Flow Split",
          columns: ["Cash", "Bank Transfer", "Online (eSewa/Khalti)", "Pending Payments", "Check-ins", "Check-outs"],
          rows: [[
            formatCurrency(closingCash),
            formatCurrency(closingBank),
            formatCurrency(closingOnline),
            formatCurrency(pendingAmount),
            String(closingCheckIns.length),
            String(closingCheckOuts.length),
          ]],
        },
        {
          title: "Transactions",
          columns: ["Time", "Guest", "Booking", "Amount", "Method", "Type"],
          rows: closingTransactions.map((t) => [
            formatDateTime(t.created_at),
            t.guest?.full_name ?? "—",
            t.booking?.booking_number ?? "—",
            formatCurrency(netTransactionAmount(t)),
            PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
            t.transaction_type,
          ]),
        },
        {
          title: "Expenses",
          columns: ["Title", "Category", "Amount", "Method"],
          rows: closingExpenses.map((e) => [e.title, e.category?.name ?? "—", formatCurrency(Number(e.amount)), e.payment_method]),
        },
      ],
      filename: `daily-closing-${closingDate}.pdf`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Revenue, expenses, and profit across your whole operation</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<LayoutGrid className="h-4 w-4" />} label="Overview" />
            <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<LineChartIcon className="h-4 w-4" />} label="Analytics" />
            <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
            <TabButton active={tab === "ledger"} onClick={() => setTab("ledger")} icon={<ListTree className="h-4 w-4" />} label="Ledger" />
            <TabButton active={tab === "closing"} onClick={() => setTab("closing")} icon={<CalendarCheck className="h-4 w-4" />} label="Daily Closing" />
          </div>
          <ExportMenu label="Export Report" onExcel={exportFullExcel} onPdf={exportFullPdf} />
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <StatCard label="Today's Revenue" value={formatCurrency(revenueToday)} numeric={revenueToday} format={formatCurrency} icon={<Wallet className="h-5 w-5" />} tone="green" />
            <StatCard label="Today's Expenses" value={formatCurrency(expensesToday)} numeric={expensesToday} format={formatCurrency} icon={<Receipt className="h-5 w-5" />} tone="rose" />
            <StatCard
              label="Today's Profit"
              value={formatCurrency(revenueToday - expensesToday)}
              numeric={revenueToday - expensesToday}
              format={formatCurrency}
              icon={<PiggyBank className="h-5 w-5" />}
              tone={revenueToday - expensesToday >= 0 ? "brand" : "rose"}
            />
            <StatCard label="Monthly Revenue" value={formatCurrency(revenueMonth)} numeric={revenueMonth} format={formatCurrency} icon={<TrendingUp className="h-5 w-5" />} tone="green" subtext="This month" />
            <StatCard label="Monthly Expenses" value={formatCurrency(expensesMonth)} numeric={expensesMonth} format={formatCurrency} icon={<TrendingDown className="h-5 w-5" />} tone="rose" subtext="This month" />
            <StatCard
              label="Monthly Profit"
              value={formatCurrency(revenueMonth - expensesMonth)}
              numeric={revenueMonth - expensesMonth}
              format={formatCurrency}
              icon={<PiggyBank className="h-5 w-5" />}
              tone={revenueMonth - expensesMonth >= 0 ? "brand" : "rose"}
              subtext="This month"
            />
            <StatCard label="Yearly Revenue" value={formatCurrency(revenueYear)} numeric={revenueYear} format={formatCurrency} icon={<Wallet className="h-5 w-5" />} tone="sky" subtext="This year" />
            <StatCard label="Yearly Expenses" value={formatCurrency(expensesYear)} numeric={expensesYear} format={formatCurrency} icon={<Receipt className="h-5 w-5" />} tone="amber" subtext="This year" />
            <StatCard
              label="Yearly Profit"
              value={formatCurrency(revenueYear - expensesYear)}
              numeric={revenueYear - expensesYear}
              format={formatCurrency}
              icon={<PiggyBank className="h-5 w-5" />}
              tone={revenueYear - expensesYear >= 0 ? "brand" : "rose"}
              subtext="This year"
            />
            <StatCard label="Occupancy Rate" value={`${occupancyRate}%`} icon={<DoorOpen className="h-5 w-5" />} tone="brand" subtext={`${occupiedRooms} of ${rooms.length} rooms · ${underMaintenanceRooms} in maintenance`} />
            <StatCard label="Total Bookings" value={totalBookings} numeric={totalBookings} icon={<ClipboardList className="h-5 w-5" />} tone="brand" subtext="All time" />
            <StatCard label="Active Guests" value={activeGuests} numeric={activeGuests} icon={<Users className="h-5 w-5" />} tone="green" subtext="Currently checked in" />
            <StatCard
              label="Pending Payments"
              value={pendingBookings.length}
              numeric={pendingBookings.length}
              icon={<AlertCircle className="h-5 w-5" />}
              tone="amber"
              subtext={`${formatCurrency(pendingAmount)} outstanding`}
            />
          </div>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">Profit &amp; Loss</p>
                <p className="text-xs text-slate-400">Revenue − Expenses = Net Profit</p>
              </div>
              <GranularityToggle value={plGranularity} options={["daily", "weekly", "monthly", "yearly"] as const} onChange={setPlGranularity} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue</p>
                <RevenueBarChart data={incomeSeries} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Expenses</p>
                <ExpenseTrendChart data={expenseSeries} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Profit Trend</p>
                <ProfitTrendChart data={profitSeries} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <p className="mb-1 text-base font-semibold text-slate-900">Monthly Analytics</p>
            <p className="mb-4 text-xs text-slate-400">This month, compared with last month</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Revenue" value={formatCurrency(revenueMonth)} numeric={revenueMonth} format={formatCurrency} icon={<Wallet className="h-5 w-5" />} tone="green" trend={momRevenueChange} trendLabel="vs last month" />
              <StatCard label="Expenses" value={formatCurrency(expensesMonth)} numeric={expensesMonth} format={formatCurrency} icon={<Receipt className="h-5 w-5" />} tone="rose" trend={momExpenseChange} trendLabel="vs last month" />
              <StatCard
                label="Profit"
                value={formatCurrency(revenueMonth - expensesMonth)}
                numeric={revenueMonth - expensesMonth}
                format={formatCurrency}
                icon={<PiggyBank className="h-5 w-5" />}
                tone={revenueMonth - expensesMonth >= 0 ? "brand" : "rose"}
                trend={momProfitChange}
                trendLabel="vs last month"
              />
              <StatCard label="Occupancy Rate" value={`${occupancyRate}%`} icon={<DoorOpen className="h-5 w-5" />} tone="brand" />
              <StatCard
                label="Average Daily Revenue"
                value={formatCurrency(adrMonth)}
                numeric={adrMonth}
                format={formatCurrency}
                icon={<Percent className="h-5 w-5" />}
                tone="sky"
                subtext="Per occupied room-night"
              />
              <StatCard label="Average Stay" value={`${avgStayMonth.toFixed(1)} nights`} icon={<BedDouble className="h-5 w-5" />} tone="amber" />
              <StatCard
                label="Best Performing Room"
                value={bestRoom?.room?.room_number ?? "—"}
                icon={<Award className="h-5 w-5" />}
                tone="brand"
                subtext={bestRoom ? formatCurrency(bestRoom.revenue) : undefined}
              />
              <StatCard
                label="Most Booked Room"
                value={mostBookedRoom?.room?.room_number ?? "—"}
                icon={<ClipboardList className="h-5 w-5" />}
                tone="green"
                subtext={mostBookedRoom ? `${mostBookedRoom.count} booking${mostBookedRoom.count === 1 ? "" : "s"}` : undefined}
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="mb-1 text-base font-semibold text-slate-900">Yearly Analytics</p>
            <p className="mb-4 text-xs text-slate-400">This year vs. last year</p>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Revenue" value={formatCurrency(revenueYear)} numeric={revenueYear} format={formatCurrency} icon={<Wallet className="h-5 w-5" />} tone="green" trend={revenueGrowthPct} trendLabel="vs last year" />
              <StatCard label="Expenses" value={formatCurrency(expensesYear)} numeric={expensesYear} format={formatCurrency} icon={<Receipt className="h-5 w-5" />} tone="rose" />
              <StatCard
                label="Profit"
                value={formatCurrency(revenueYear - expensesYear)}
                numeric={revenueYear - expensesYear}
                format={formatCurrency}
                icon={<PiggyBank className="h-5 w-5" />}
                tone={revenueYear - expensesYear >= 0 ? "brand" : "rose"}
                trend={profitGrowthPct}
                trendLabel="vs last year"
              />
              <StatCard label="Last Year Revenue" value={formatCurrency(revenueLastYear)} numeric={revenueLastYear} format={formatCurrency} icon={<TrendingUp className="h-5 w-5" />} tone="sky" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue vs Expenses (5 Years)</p>
                <IncomeVsExpenseChart data={yearlyCombinedSeries} height="h-56" showLegend={false} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Profit Trend (5 Years)</p>
                <TrendLineChart data={yearlyProfitSeries} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue by Room (All Time)</p>
                {roomRevenueShare.length === 0 ? <EmptyState title="No bookings yet" /> : <ExpenseCategoryDonut data={roomRevenueShare} />}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "calendar" && (
        <Card className="p-5 sm:p-6">
          <FinancialCalendar dailyNet={dailyNet} onSelectDay={setSelectedDay} month={calendarMonth} onMonthChange={setCalendarMonth} />
        </Card>
      )}

      {tab === "ledger" && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DateRangeFilterBar preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
              <div className="shrink-0">
                <ExportMenu onCsv={exportLedgerCsv} onExcel={exportLedgerExcel} onPdf={exportLedgerPdf} />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <AdvancedFiltersBar
                rooms={roomOptions}
                guests={guestOptions}
                methods={methodOptions}
                categories={categoryOptions}
                roomFilter={roomFilter}
                guestFilter={guestFilter}
                methodFilter={methodFilter}
                categoryFilter={categoryFilter}
                onChange={(next) => {
                  if (next.room !== undefined) setRoomFilter(next.room);
                  if (next.guest !== undefined) setGuestFilter(next.guest);
                  if (next.method !== undefined) setMethodFilter(next.method);
                  if (next.category !== undefined) setCategoryFilter(next.category);
                }}
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            {ledger.length === 0 ? (
              <EmptyState title="No activity in this range" description="Try a wider date range." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Type</TH>
                      <TH>Description</TH>
                      <TH>Income</TH>
                      <TH>Expense</TH>
                      <TH>Running Balance</TH>
                      <TH>Method</TH>
                      <TH>Reference</TH>
                      <TH>Guest</TH>
                      <TH>Booking</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {ledger.map((r) => (
                      <TR key={r.id}>
                        <TD>{r.date.slice(0, 10)}</TD>
                        <TD>
                          <Badge tone={r.type === "income" ? "green" : "red"}>{r.type}</Badge>
                        </TD>
                        <TD>{r.description}</TD>
                        <TD className={r.income ? "text-emerald-600 font-medium" : ""}>{r.income ? formatCurrency(r.income) : "—"}</TD>
                        <TD className={r.expense ? "text-rose-600 font-medium" : ""}>{r.expense ? formatCurrency(r.expense) : "—"}</TD>
                        <TD className={cn("font-semibold", r.runningBalance >= 0 ? "text-slate-800" : "text-rose-600")}>{formatCurrency(r.runningBalance)}</TD>
                        <TD>{PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}</TD>
                        <TD>{r.reference}</TD>
                        <TD>{r.guest || "—"}</TD>
                        <TD>{r.booking || "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "closing" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Daily Closing Report</p>
                <p className="text-xs text-slate-400">One-click end-of-day summary for a chosen date</p>
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <Label className="mb-1">Date</Label>
                  <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="h-9" />
                </div>
                <ExportMenu label="Export Closing" onExcel={exportClosingExcel} onPdf={exportClosingPdf} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Revenue" value={formatCurrency(closingRevenue)} numeric={closingRevenue} format={formatCurrency} icon={<Wallet className="h-5 w-5" />} tone="green" />
              <StatCard label="Expenses" value={formatCurrency(closingExpenseTotal)} numeric={closingExpenseTotal} format={formatCurrency} icon={<Receipt className="h-5 w-5" />} tone="rose" />
              <StatCard
                label="Net Profit"
                value={formatCurrency(closingProfit)}
                numeric={closingProfit}
                format={formatCurrency}
                icon={<PiggyBank className="h-5 w-5" />}
                tone={closingProfit >= 0 ? "brand" : "rose"}
              />
              <StatCard label="Occupancy" value={`${closingOccupancyRate}%`} icon={<DoorOpen className="h-5 w-5" />} tone="sky" />
              <StatCard label="Cash" value={formatCurrency(closingCash)} numeric={closingCash} format={formatCurrency} icon={<Banknote className="h-5 w-5" />} tone="green" />
              <StatCard label="Bank Transfer" value={formatCurrency(closingBank)} numeric={closingBank} format={formatCurrency} icon={<Landmark className="h-5 w-5" />} tone="brand" />
              <StatCard label="Online" value={formatCurrency(closingOnline)} numeric={closingOnline} format={formatCurrency} icon={<CreditCard className="h-5 w-5" />} tone="amber" subtext="eSewa / Khalti" />
              <StatCard label="Pending Payments" value={formatCurrency(pendingAmount)} numeric={pendingAmount} format={formatCurrency} icon={<AlertCircle className="h-5 w-5" />} tone="rose" subtext={`${pendingBookings.length} bookings`} />
              <StatCard label="Check-ins" value={closingCheckIns.length} numeric={closingCheckIns.length} icon={<LogIn className="h-5 w-5" />} tone="green" />
              <StatCard label="Check-outs" value={closingCheckOuts.length} numeric={closingCheckOuts.length} icon={<LogOut className="h-5 w-5" />} tone="rose" />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-900">Transactions on {formatDate(closingDate)}</p>
            </div>
            {closingTransactions.length === 0 ? (
              <EmptyState title="No transactions on this date" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Time</TH>
                      <TH>Guest</TH>
                      <TH>Booking</TH>
                      <TH>Method</TH>
                      <TH>Type</TH>
                      <TH>Amount</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {closingTransactions.map((t) => (
                      <TR key={t.id}>
                        <TD>{formatDateTime(t.created_at)}</TD>
                        <TD>{t.guest?.full_name ?? "—"}</TD>
                        <TD>{t.booking?.booking_number ?? "—"}</TD>
                        <TD>{PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method}</TD>
                        <TD className="capitalize">{t.transaction_type}</TD>
                        <TD className={t.transaction_type === "refund" ? "font-medium text-rose-600" : "font-medium text-slate-800"}>
                          {t.transaction_type === "refund" ? "-" : ""}
                          {formatCurrency(t.amount)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-900">Expenses on {formatDate(closingDate)}</p>
            </div>
            {closingExpenses.length === 0 ? (
              <EmptyState title="No expenses on this date" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Title</TH>
                      <TH>Category</TH>
                      <TH>Method</TH>
                      <TH>Amount</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {closingExpenses.map((e) => (
                      <TR key={e.id}>
                        <TD>{e.title}</TD>
                        <TD>{e.category?.name ?? "—"}</TD>
                        <TD>{EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method}</TD>
                        <TD className="font-medium text-rose-600">{formatCurrency(Number(e.amount))}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}

      <DayDetailDialog date={selectedDay} transactions={dayTransactions} expenses={dayExpenses} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
