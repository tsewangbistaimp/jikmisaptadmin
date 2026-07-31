import { Wallet, Receipt, PiggyBank } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { netTransactionAmount } from "@/lib/report-helpers";

interface DayTransaction {
  id: string;
  amount: number;
  created_at: string;
  payment_method: string;
  transaction_type: string;
  booking: { booking_number: string } | null;
  guest: { full_name: string } | null;
}

interface DayExpense {
  id: string;
  title: string;
  amount: number;
  payment_method: string;
  category: { name: string } | null;
}

export function DayDetailDialog({
  date,
  transactions,
  expenses,
  onClose,
}: {
  date: string | null;
  transactions: DayTransaction[];
  expenses: DayExpense[];
  onClose: () => void;
}) {
  const income = transactions.reduce((s, t) => s + netTransactionAmount(t), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = income - expenseTotal;

  return (
    <Dialog open={!!date} onClose={onClose} title={date ? formatDate(date) : ""} description="Everything recorded for this day" className="max-w-2xl">
      {date && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <Wallet className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">{formatCurrency(income)}</p>
              <p className="text-[11px] text-emerald-600">Income</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-center">
              <Receipt className="mx-auto mb-1 h-4 w-4 text-rose-600" />
              <p className="text-sm font-semibold text-rose-700">{formatCurrency(expenseTotal)}</p>
              <p className="text-[11px] text-rose-600">Expenses</p>
            </div>
            <div className={cn("rounded-2xl p-3 text-center", profit >= 0 ? "bg-brand-50" : "bg-rose-50")}>
              <PiggyBank className={cn("mx-auto mb-1 h-4 w-4", profit >= 0 ? "text-brand-600" : "text-rose-600")} />
              <p className={cn("text-sm font-semibold", profit >= 0 ? "text-brand-700" : "text-rose-700")}>{formatCurrency(profit)}</p>
              <p className={cn("text-[11px]", profit >= 0 ? "text-brand-600" : "text-rose-600")}>Net Profit</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Transactions ({transactions.length})</p>
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-400">No payments recorded.</p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {t.guest?.full_name ?? "Guest"} {t.booking?.booking_number && <span className="text-slate-400">· {t.booking.booking_number}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method} · {formatDateTime(t.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("font-semibold", t.transaction_type === "refund" ? "text-rose-600" : "text-emerald-600")}>
                        {t.transaction_type === "refund" ? "−" : "+"}
                        {formatCurrency(Math.abs(Number(t.amount)))}
                      </span>
                      <Badge tone={t.transaction_type === "refund" ? "red" : "green"}>{t.transaction_type}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Expenses ({expenses.length})</p>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-400">No expenses recorded.</p>
            ) : (
              <ul className="space-y-2">
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{e.title}</p>
                      <p className="text-xs text-slate-400">
                        {e.category?.name ?? "Other"} · {EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-rose-600">−{formatCurrency(Number(e.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {transactions.length === 0 && expenses.length === 0 && (
            <EmptyState title="Nothing happened this day" description="No income or expenses were recorded." />
          )}
        </div>
      )}
    </Dialog>
  );
}
