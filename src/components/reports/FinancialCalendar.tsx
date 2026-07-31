import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyNet } from "@/lib/report-helpers";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * A month calendar shading each day green (profit), red (loss), or gray (no
 * financial activity) based on that day's net income − expenses, following
 * the same grid layout as MiniCalendar/RoomCalendar. Clicking a day invokes
 * `onSelectDay` so the parent can open a detail dialog with that day's
 * transactions/expenses.
 */
export function FinancialCalendar({
  dailyNet,
  onSelectDay,
  month,
  onMonthChange,
}: {
  dailyNet: Map<string, DailyNet>;
  onSelectDay: (iso: string) => void;
  month: Date;
  onMonthChange: (d: Date) => void;
}) {
  const todayISO = toISODate(new Date());

  const weeks = React.useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstOfMonth = new Date(year, m, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, m, 1 - startOffset);

    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === m });
    }
    while (days.length > 35 && days.slice(-7).every((d) => !d.inMonth)) {
      days.splice(days.length - 7, 7);
    }

    const rows: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-800">{MONTH_LABEL.format(month)}</p>
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <p key={w} className="text-[11px] font-medium text-slate-400">
            {w}
          </p>
        ))}

        {weeks.flat().map(({ date, inMonth }, i) => {
          const iso = toISODate(date);
          const isToday = iso === todayISO;
          const entry = inMonth ? dailyNet.get(iso) : undefined;
          const hasActivity = !!entry && (entry.income > 0 || entry.expense > 0);
          const isProfit = !!entry && entry.profit > 0;
          const isLoss = !!entry && entry.profit < 0;

          return (
            <button
              key={i}
              disabled={!inMonth}
              onClick={() => inMonth && onSelectDay(iso)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-xs transition-colors",
                !inMonth && "cursor-default text-slate-300",
                inMonth && !hasActivity && "text-slate-500 hover:bg-slate-50",
                inMonth && isProfit && "bg-emerald-50 font-medium text-emerald-700 hover:bg-emerald-100",
                inMonth && isLoss && "bg-rose-50 font-medium text-rose-700 hover:bg-rose-100",
                isToday && "ring-2 ring-brand-400"
              )}
            >
              <span>{date.getDate()}</span>
              {hasActivity && <span className="text-[10px] leading-tight">{compact(entry!.profit)}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-100" /> Profit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-100" /> Loss
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-100" /> No Activity
        </span>
      </div>
    </div>
  );
}
