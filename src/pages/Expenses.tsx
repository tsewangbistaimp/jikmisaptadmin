import * as React from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  Wallet,
  CalendarClock,
  CalendarRange,
  Clock,
  PiggyBank,
  ListTodo,
  CheckCircle2,
  Circle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { StatCard, GradientStatCard } from "@/components/dashboard/DashboardWidgets";
import { ExpenseFormDialog, DeleteExpenseDialog } from "@/components/expenses/ExpenseDialogs";
import { ReminderFormDialog, DeleteReminderDialog } from "@/components/expenses/ReminderDialogs";
import { BudgetsDialog } from "@/components/expenses/BudgetsDialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, todayISO, advanceDate, cn } from "@/lib/utils";
import { EXPENSE_PAYMENT_METHOD_LABELS, EXPENSE_STATUS_LABELS, EXPENSE_PRIORITY_LABELS, UTILITY_CATEGORY_NAMES } from "@/lib/constants";
import { expenseStatusTone, expensePriorityTone } from "@/lib/badge-tones";
import type { ExpenseCategory, ExpenseReminder, ExpenseWithCategory } from "@/lib/database.types";

type RangeFilter = "all" | "today" | "week" | "month";

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = React.useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [reminders, setReminders] = React.useState<ExpenseReminder[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<RangeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const [editingExpense, setEditingExpense] = React.useState<ExpenseWithCategory | "new" | null>(null);
  const [deletingExpense, setDeletingExpense] = React.useState<ExpenseWithCategory | null>(null);

  const [editingReminder, setEditingReminder] = React.useState<ExpenseReminder | "new" | null>(null);
  const [deletingReminder, setDeletingReminder] = React.useState<ExpenseReminder | null>(null);
  const [showAllReminders, setShowAllReminders] = React.useState(false);
  const [budgetsOpen, setBudgetsOpen] = React.useState(false);

  const loadCategories = React.useCallback(async () => {
    const { data } = await supabase.from("expense_categories").select("*").order("name");
    setCategories((data as ExpenseCategory[]) ?? []);
  }, []);

  const loadExpenses = React.useCallback(async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*, category:expense_categories(id, name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    setExpenses((data as ExpenseWithCategory[]) ?? []);
  }, []);

  const loadReminders = React.useCallback(async () => {
    const { data } = await supabase
      .from("expense_reminders")
      .select("*")
      .order("is_completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false });
    setReminders((data as ExpenseReminder[]) ?? []);
  }, []);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCategories(), loadExpenses(), loadReminders()]);
    setLoading(false);
  }, [loadCategories, loadExpenses, loadReminders]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------------------------------------------------------------
  // Stats (always computed from the full, unfiltered expense list)
  // ---------------------------------------------------------------------
  const stats = React.useMemo(() => {
    const today = todayISO();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    let todayTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;
    let pendingTotal = 0;
    let pendingCount = 0;
    const byCategory = new Map<string, number>();

    for (const e of expenses) {
      const amt = Number(e.amount);
      const d = new Date(e.date);
      if (e.date === today) todayTotal += amt;
      if (d >= monthStart) monthTotal += amt;
      if (d >= yearStart) yearTotal += amt;
      if (e.status === "pending") {
        pendingTotal += amt;
        pendingCount += 1;
      }
      const catName = e.category?.name ?? "Other Expenses";
      byCategory.set(catName, (byCategory.get(catName) ?? 0) + amt);
    }

    let topCategory = "—";
    let topAmount = 0;
    for (const [name, amt] of byCategory) {
      if (amt > topAmount) {
        topAmount = amt;
        topCategory = name;
      }
    }

    return { todayTotal, monthTotal, yearTotal, pendingTotal, pendingCount, topCategory, topAmount };
  }, [expenses]);

  // ---------------------------------------------------------------------
  // Budget vs Actual, expense trends/insights, utility tracking — all
  // derived from a shared trailing-6-month per-category breakdown so each
  // section stays consistent with the others.
  // ---------------------------------------------------------------------
  const insights = React.useMemo(() => {
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthKey = monthKey(now);
    const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyByCategory = new Map<string, Map<string, number>>();
    const monthlyTotal = new Map<string, number>();

    for (const e of expenses) {
      const d = new Date(e.date);
      if (d < sixMonthsAgo) continue;
      const key = monthKey(d);
      const amt = Number(e.amount);
      monthlyTotal.set(key, (monthlyTotal.get(key) ?? 0) + amt);
      if (e.category_id) {
        const catMap = monthlyByCategory.get(e.category_id) ?? new Map<string, number>();
        catMap.set(key, (catMap.get(key) ?? 0) + amt);
        monthlyByCategory.set(e.category_id, catMap);
      }
    }

    const thisMonthTotal = monthlyTotal.get(thisMonthKey) ?? 0;
    const lastMonthTotal = monthlyTotal.get(lastMonthKey) ?? 0;
    const expenseGrowthPct = lastMonthTotal === 0 ? (thisMonthTotal > 0 ? 100 : 0) : Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) / 10;

    const monthTotals = Array.from(monthlyTotal.values());
    const avgMonthlyExpense = monthTotals.length > 0 ? monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length : 0;

    const budgetVsActual = categories
      .filter((c) => c.monthly_budget != null)
      .map((c) => {
        const actual = monthlyByCategory.get(c.id)?.get(thisMonthKey) ?? 0;
        const budget = Number(c.monthly_budget);
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
        return { category: c, actual, budget, pct, overspent: actual > budget };
      })
      .sort((a, b) => b.pct - a.pct);

    // Flag a category as "unusual" only once it has real trailing history
    // (avg spend of at least NPR 500 across other months) and this month
    // is at least 50% above that average — a category with one small
    // one-off expense shouldn't get flagged as a spike.
    const unusualAlerts: { name: string; thisMonth: number; average: number }[] = [];
    for (const c of categories) {
      const catMap = monthlyByCategory.get(c.id);
      if (!catMap) continue;
      const thisMonthAmt = catMap.get(thisMonthKey) ?? 0;
      const otherMonths = Array.from(catMap.entries()).filter(([k]) => k !== thisMonthKey);
      if (otherMonths.length === 0) continue;
      const avg = otherMonths.reduce((s, [, v]) => s + v, 0) / otherMonths.length;
      if (avg >= 500 && thisMonthAmt > avg * 1.5) {
        unusualAlerts.push({ name: c.name, thisMonth: thisMonthAmt, average: avg });
      }
    }

    const utilityBreakdown = UTILITY_CATEGORY_NAMES.map((name) => {
      const cat = categories.find((c) => c.name === name);
      const amount = cat ? monthlyByCategory.get(cat.id)?.get(thisMonthKey) ?? 0 : 0;
      return { name, amount };
    });

    const thisMonthByCategory = categories.map((c) => ({ name: c.name, amount: monthlyByCategory.get(c.id)?.get(thisMonthKey) ?? 0 }));
    const spentCategories = thisMonthByCategory.filter((c) => c.amount > 0);
    const highestCategory = spentCategories.length ? spentCategories.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;
    const lowestCategory = spentCategories.length ? spentCategories.reduce((a, b) => (b.amount < a.amount ? b : a)) : null;

    return { budgetVsActual, unusualAlerts, utilityBreakdown, expenseGrowthPct, avgMonthlyExpense, highestCategory, lowestCategory };
  }, [expenses, categories]);

  // ---------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------
  const filtered = React.useMemo(() => {
    let rows = expenses;

    if (range !== "all") {
      const now = new Date();
      let start: Date;
      if (range === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (range === "week") {
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      rows = rows.filter((e) => new Date(e.date) >= start);
    }

    if (categoryFilter !== "all") rows = rows.filter((e) => e.category_id === categoryFilter);
    if (statusFilter !== "all") rows = rows.filter((e) => e.status === statusFilter);

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.category?.name?.toLowerCase().includes(q) ||
          e.paid_by?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [expenses, range, categoryFilter, statusFilter, query]);

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const exportCsv = () => {
    const header = ["Title", "Category", "Amount", "Date", "Payment Method", "Paid By", "Status", "Description"];
    const rows = filtered.map((e) => [
      e.title,
      e.category?.name ?? "",
      e.amount,
      e.date,
      EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method],
      e.paid_by ?? "",
      EXPENSE_STATUS_LABELS[e.status],
      e.description ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const { downloadExcelWorkbook } = await import("@/lib/export-excel");
    downloadExcelWorkbook(`expenses-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        name: "Expenses",
        columns: [
          { header: "Title", key: "title" },
          { header: "Category", key: "category" },
          { header: "Amount", key: "amount", numeric: true },
          { header: "Date", key: "date" },
          { header: "Payment Method", key: "method" },
          { header: "Paid By", key: "paidBy" },
          { header: "Status", key: "status" },
          { header: "Description", key: "description" },
        ],
        rows: filtered.map((e) => ({
          title: e.title,
          category: e.category?.name ?? "",
          amount: Number(e.amount),
          date: e.date,
          method: EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method],
          paidBy: e.paid_by ?? "",
          status: EXPENSE_STATUS_LABELS[e.status],
          description: e.description ?? "",
        })),
      },
    ]);
  };

  const exportPdf = async () => {
    const { downloadPdfReport } = await import("@/lib/export-pdf");
    downloadPdfReport({
      title: "Expenses Report",
      subtitle: `${filtered.length} expenses`,
      summary: [
        { label: "Total Amount", value: formatCurrency(filteredTotal), tone: "negative" },
        { label: "Expenses", value: String(filtered.length) },
        { label: "Pending", value: `${stats.pendingCount} · ${formatCurrency(stats.pendingTotal)}` },
      ],
      sections: [
        {
          columns: ["Title", "Category", "Amount", "Date", "Method", "Status"],
          rows: filtered.map((e) => [
            e.title,
            e.category?.name ?? "—",
            formatCurrency(e.amount),
            formatDate(e.date),
            EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method],
            EXPENSE_STATUS_LABELS[e.status],
          ]),
        },
      ],
      filename: `expenses-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const viewReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't open receipt");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const toggleReminder = async (reminder: ExpenseReminder) => {
    const nowCompleted = !reminder.is_completed;
    const { error } = await supabase
      .from("expense_reminders")
      .update({ is_completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null })
      .eq("id", reminder.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Recurring reminders: completing one immediately schedules the next
    // occurrence so a repeating bill (e.g. "Pay Electricity Bill", monthly)
    // never falls off the list. This is plain client logic, matching how
    // the rest of this table already works (no DB trigger writes to it).
    if (nowCompleted && reminder.is_recurring && reminder.recurrence_interval) {
      const nextDue = advanceDate(reminder.due_date ?? todayISO(), reminder.recurrence_interval);
      const { error: insertError } = await supabase.from("expense_reminders").insert({
        title: reminder.title,
        due_date: nextDue,
        amount: reminder.amount,
        priority: reminder.priority,
        is_recurring: true,
        recurrence_interval: reminder.recurrence_interval,
      });
      if (insertError) {
        toast.error(`Reminder completed, but couldn't schedule the next one: ${insertError.message}`);
      } else {
        toast.success(`Next "${reminder.title}" scheduled for ${formatDate(nextDue)}`);
      }
    }

    loadReminders();
  };

  const visibleReminders = showAllReminders ? reminders : reminders.filter((r) => !r.is_completed).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track apartment spending and stay on top of upcoming bills</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setBudgetsOpen(true)}>
              <PiggyBank className="h-4 w-4" /> Manage Budgets
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setEditingExpense("new")}>
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <PageLoader rows={2} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GradientStatCard
              label="Spent Today"
              value={formatCurrency(stats.todayTotal)}
              numeric={stats.todayTotal}
              format={formatCurrency}
              icon={<Wallet className="h-5 w-5" />}
              tone="green"
            />
            <GradientStatCard
              label="Spent This Month"
              value={formatCurrency(stats.monthTotal)}
              numeric={stats.monthTotal}
              format={formatCurrency}
              icon={<CalendarRange className="h-5 w-5" />}
              tone="blue"
            />
            <GradientStatCard
              label="Spent This Year"
              value={formatCurrency(stats.yearTotal)}
              numeric={stats.yearTotal}
              format={formatCurrency}
              icon={<CalendarClock className="h-5 w-5" />}
              tone="purple"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Pending Payments"
              value={formatCurrency(stats.pendingTotal)}
              numeric={stats.pendingTotal}
              format={formatCurrency}
              subtext={`${stats.pendingCount} expense${stats.pendingCount === 1 ? "" : "s"}`}
              icon={<Clock className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard
              label="Top Category"
              value={stats.topCategory}
              subtext={stats.topAmount > 0 ? formatCurrency(stats.topAmount) : undefined}
              icon={<PiggyBank className="h-5 w-5" />}
              tone="rose"
            />
          </div>
        </>
      )}

      {/* Budget vs Actual */}
      {insights.budgetVsActual.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Budget vs Actual (This Month)</p>
          <div className="space-y-3">
            {insights.budgetVsActual.map((b) => (
              <div key={b.category.id}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                  <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-300">{b.category.name}</span>
                  <span className={cn("flex shrink-0 items-center whitespace-nowrap font-semibold", b.overspent ? "text-rose-600" : "text-slate-600 dark:text-slate-400")}>
                    {formatCurrency(b.actual)} / {formatCurrency(b.budget)}
                    {b.overspent && (
                      <Badge tone="red" className="ml-2">
                        Over Budget
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn("h-full rounded-full transition-all", b.overspent ? "bg-rose-500" : b.pct > 80 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(b.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Expense Insights */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Expense Insights</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Highest Category" value={insights.highestCategory?.name ?? "—"} subtext={insights.highestCategory ? formatCurrency(insights.highestCategory.amount) : undefined} icon={<TrendingUp className="h-5 w-5" />} tone="rose" />
          <StatCard label="Lowest Category" value={insights.lowestCategory?.name ?? "—"} subtext={insights.lowestCategory ? formatCurrency(insights.lowestCategory.amount) : undefined} icon={<TrendingDown className="h-5 w-5" />} tone="green" />
          <StatCard label="Average Monthly Expense" value={formatCurrency(insights.avgMonthlyExpense)} numeric={insights.avgMonthlyExpense} format={formatCurrency} icon={<CalendarRange className="h-5 w-5" />} tone="brand" subtext="Last 6 months" />
          <StatCard
            label="Expense Growth"
            value={`${insights.expenseGrowthPct >= 0 ? "+" : ""}${insights.expenseGrowthPct}%`}
            icon={insights.expenseGrowthPct >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            tone={insights.expenseGrowthPct > 0 ? "rose" : "green"}
            subtext="vs last month"
          />
        </div>
        {insights.unusualAlerts.length > 0 && (
          <div className="mt-4 space-y-2">
            {insights.unusualAlerts.map((a) => (
              <div key={a.name} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{a.name}</strong> is unusually high this month: {formatCurrency(a.thisMonth)} vs a typical {formatCurrency(a.average)}.
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Utility Tracking */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Utility Tracking (This Month)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {insights.utilityBreakdown.map((u) => (
            <div key={u.name} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{u.name}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(u.amount)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Reminders / todo */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Expense Reminders</h2>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setEditingReminder("new")}>
              <Plus className="h-3.5 w-3.5" /> Add Reminder
            </Button>
          )}
        </div>

        {reminders.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">No reminders yet. Add one to stay on top of upcoming bills.</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleReminders.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800",
                    r.is_completed && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => toggleReminder(r)}
                    aria-label={r.is_completed ? "Mark incomplete" : "Mark complete"}
                    className="shrink-0 text-slate-400 hover:text-brand-500 disabled:cursor-not-allowed"
                  >
                    {r.is_completed ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium text-slate-800 dark:text-slate-200", r.is_completed && "line-through")}>
                      {r.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {r.due_date && <span>Due {formatDate(r.due_date)}</span>}
                      {r.amount != null && <span>{formatCurrency(r.amount)}</span>}
                      {r.is_recurring && <span>Repeats {r.recurrence_interval}</span>}
                    </div>
                  </div>
                  <Badge tone={expensePriorityTone(r.priority)} className="capitalize">
                    {EXPENSE_PRIORITY_LABELS[r.priority]}
                  </Badge>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <IconButton title="Edit reminder" onClick={() => setEditingReminder(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton title="Delete reminder" destructive onClick={() => setDeletingReminder(r)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {reminders.length > visibleReminders.length && !showAllReminders && (
              <button
                onClick={() => setShowAllReminders(true)}
                className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Show all {reminders.length} reminders
              </button>
            )}
            {showAllReminders && (
              <button
                onClick={() => setShowAllReminders(false)}
                className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Show less
              </button>
            )}
          </>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, category, notes…" className="pl-9" />
          </div>
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeFilter)} className="sm:w-36">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </Select>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="sm:w-48">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-36">
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </Select>
        </div>
      </Card>

      {/* Expense list */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} expense{filtered.length === 1 ? "" : "s"} · {formatCurrency(filteredTotal)} total
          </p>
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No expenses found"
            description="Add your first expense to start tracking apartment spending."
            action={
              isAdmin && (
                <Button size="sm" onClick={() => setEditingExpense("new")}>
                  <Plus className="h-4 w-4" /> Add Expense
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Category</TH>
                    <TH>Amount</TH>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Status</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      isAdmin={isAdmin}
                      onEdit={() => setEditingExpense(e)}
                      onDelete={() => setDeletingExpense(e)}
                      onViewReceipt={() => e.receipt_url && viewReceipt(e.receipt_url)}
                    />
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {filtered.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">{e.category?.name ?? "—"}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(e.amount)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatDate(e.date)}</span>
                    <span>{EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method]}</span>
                    <Badge tone={expenseStatusTone(e.status)}>{EXPENSE_STATUS_LABELS[e.status]}</Badge>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {e.receipt_url && (
                      <Button variant="outline" size="sm" onClick={() => viewReceipt(e.receipt_url!)}>
                        <Paperclip className="h-3.5 w-3.5" /> Receipt
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditingExpense(e)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingExpense(e)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <ExpenseFormDialog
        expense={editingExpense === "new" ? null : editingExpense}
        open={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        onSaved={loadExpenses}
        categories={categories}
        onCategoriesChanged={loadCategories}
      />
      <DeleteExpenseDialog expense={deletingExpense} onClose={() => setDeletingExpense(null)} onDeleted={loadExpenses} />

      <ReminderFormDialog
        reminder={editingReminder === "new" ? null : editingReminder}
        open={editingReminder !== null}
        onClose={() => setEditingReminder(null)}
        onSaved={loadReminders}
      />
      <DeleteReminderDialog reminder={deletingReminder} onClose={() => setDeletingReminder(null)} onDeleted={loadReminders} />

      <BudgetsDialog open={budgetsOpen} categories={categories} onClose={() => setBudgetsOpen(false)} onSaved={loadCategories} />
    </div>
  );
}

function ExpenseRow({
  expense,
  isAdmin,
  onEdit,
  onDelete,
  onViewReceipt,
}: {
  expense: ExpenseWithCategory;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewReceipt: () => void;
}) {
  return (
    <TR>
      <TD className="font-medium text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-1.5">
          {expense.title}
          {expense.receipt_url && (
            <button title="View receipt" onClick={onViewReceipt} className="text-slate-400 hover:text-brand-500">
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </TD>
      <TD>{expense.category?.name ?? "—"}</TD>
      <TD className="font-semibold">{formatCurrency(expense.amount)}</TD>
      <TD>{formatDate(expense.date)}</TD>
      <TD>{EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method]}</TD>
      <TD>
        <Badge tone={expenseStatusTone(expense.status)}>{EXPENSE_STATUS_LABELS[expense.status]}</Badge>
      </TD>
      <TD>
        {isAdmin && (
          <div className="flex justify-end gap-1">
            <IconButton title="Edit expense" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Delete expense" destructive onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}
      </TD>
    </TR>
  );
}
