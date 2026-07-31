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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ui/export-menu";
import { StatCard, RevenueBarChart, ExpenseTrendChart } from "@/components/dashboard/DashboardWidgets";
import { ProfitTrendChart, DateRangeFilterBar, GranularityToggle } from "@/components/reports/ReportWidgets";
import { FinancialCalendar } from "@/components/reports/FinancialCalendar";
import { DayDetailDialog } from "@/components/reports/DayDetailDialog";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { sumByDay, sumByWeek, sumByMonth, sumByYear } from "@/lib/dashboard-helpers";
import {
  getPresetRange,
  sumInRange,
  filterInRange,
  buildDailyNet,
  buildLedger,
  netTransactionAmount,
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
type Tab = "overview" | "calendar" | "ledger";

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

  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

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
        .select("id, amount, created_at, payment_method, transaction_type, booking:bookings(booking_number), guest:guests(full_name)")
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
  const filterRange = getPresetRange(preset, { from: customFrom, to: customTo });
  const ledgerTransactions = filterInRange(transactions, (t) => t.created_at, filterRange.from, filterRange.to);
  const ledgerExpenses = filterInRange(expenses, (e) => e.date, filterRange.from, filterRange.to);
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
            <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
            <TabButton active={tab === "ledger"} onClick={() => setTab("ledger")} icon={<ListTree className="h-4 w-4" />} label="Ledger" />
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

      {tab === "calendar" && (
        <Card className="p-5 sm:p-6">
          <FinancialCalendar dailyNet={dailyNet} onSelectDay={setSelectedDay} month={calendarMonth} onMonthChange={setCalendarMonth} />
        </Card>
      )}

      {tab === "ledger" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DateRangeFilterBar preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
              <div className="shrink-0">
                <ExportMenu onCsv={exportLedgerCsv} onExcel={exportLedgerExcel} onPdf={exportLedgerPdf} />
              </div>
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
