import * as React from "react";
import { Search, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { TransactionWithRelations } from "@/lib/database.types";

type RangeFilter = "all" | "today" | "week" | "month";

export default function Transactions() {
  const [transactions, setTransactions] = React.useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<RangeFilter>("all");
  const [method, setMethod] = React.useState("all");

  React.useEffect(() => {
    supabase
      .from("transactions")
      .select("*, booking:bookings(id, booking_number), guest:guests(id, full_name)")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        setTransactions((data as TransactionWithRelations[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = React.useMemo(() => {
    let rows = transactions;

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
      rows = rows.filter((t) => new Date(t.created_at) >= start);
    }

    if (method !== "all") rows = rows.filter((t) => t.payment_method === method);

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          t.guest?.full_name?.toLowerCase().includes(q) ||
          t.booking?.booking_number?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [transactions, range, method, query]);

  const total = filtered.reduce((s, t) => s + Number(t.amount), 0);

  const exportCsv = () => {
    const header = ["Transaction ID", "Booking", "Guest", "Amount", "Payment Method", "Date", "Notes"];
    const rows = filtered.map((t) => [
      t.id,
      t.booking?.booking_number ?? "",
      t.guest?.full_name ?? "",
      t.amount,
      PAYMENT_METHOD_LABELS[t.payment_method],
      t.created_at,
      t.notes ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} transactions · {formatCurrency(total)} total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guest, booking, notes…" className="pl-9" />
          </div>
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeFilter)} className="sm:w-40">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </Select>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="sm:w-44">
            <option value="all">All methods</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No transactions found" description="Payments recorded on bookings will appear here." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Booking</TH>
                    <TH>Guest</TH>
                    <TH>Amount</TH>
                    <TH>Method</TH>
                    <TH>Type</TH>
                    <TH>Date</TH>
                    <TH>Notes</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-medium text-slate-900 dark:text-slate-100">{t.booking?.booking_number ?? "—"}</TD>
                      <TD>{t.guest?.full_name ?? "—"}</TD>
                      <TD className="font-semibold">{formatCurrency(t.amount)}</TD>
                      <TD>{PAYMENT_METHOD_LABELS[t.payment_method]}</TD>
                      <TD className="capitalize">{t.transaction_type}</TD>
                      <TD>{formatDateTime(t.created_at)}</TD>
                      <TD className="max-w-[200px] truncate">{t.notes ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {filtered.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t.booking?.booking_number ?? "—"}</p>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">{t.guest?.full_name ?? "—"}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(t.amount)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{PAYMENT_METHOD_LABELS[t.payment_method]}</span>
                    <span className="capitalize">{t.transaction_type}</span>
                    <span>{formatDateTime(t.created_at)}</span>
                  </div>
                  {t.notes && <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{t.notes}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
