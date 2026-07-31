import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BookedRange {
  check_in: string;
  check_out: string;
}

/**
 * A month calendar for a single room, shading every day that falls inside
 * one of its booked date ranges (check_in inclusive, check_out exclusive —
 * matching how the booking system itself treats stays) so staff can see at
 * a glance which days are taken and which are free, not just a single
 * "available from" date.
 */
export function RoomCalendar({ bookedRanges }: { bookedRanges: BookedRange[] }) {
  const [cursor, setCursor] = React.useState(() => new Date());
  const todayISO = toISODate(new Date());

  const isBooked = React.useCallback(
    (iso: string) => bookedRanges.some((r) => iso >= r.check_in && iso < r.check_out),
    [bookedRanges]
  );

  const weeks = React.useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);

    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === month });
    }
    while (days.length > 35 && days.slice(-7).every((d) => !d.inMonth)) {
      days.splice(days.length - 7, 7);
    }

    const rows: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{MONTH_LABEL.format(cursor)}</p>
        <button
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <p key={w} className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {w}
          </p>
        ))}

        {weeks.flat().map(({ date, inMonth }, i) => {
          const iso = toISODate(date);
          const isToday = iso === todayISO;
          const booked = inMonth && isBooked(iso);
          return (
            <div key={i} className="flex items-center justify-center py-1">
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-sm",
                  !inMonth && "text-slate-300 dark:text-slate-700",
                  inMonth && !isToday && !booked && "text-slate-700 dark:text-slate-300",
                  booked && !isToday && "bg-rose-100 font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
                  isToday && "bg-brand-500 font-semibold text-white"
                )}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-100 dark:bg-rose-500/20" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Today
        </span>
      </div>
    </div>
  );
}
