import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: "checkin" | "checkout";
  guestName: string;
  roomNumber: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A lightweight month calendar. `highlightDates` marks days that have a
 * check-in (amber dot) and `checkOutDates` marks days with a check-out (red dot); today is shown as a filled circle.
 */
export function MiniCalendar({ highlightDates, checkOutDates = [], events = [] }: { highlightDates: string[]; checkOutDates?: string[]; events?: CalendarEvent[] }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const dayEvents = selected ? events.filter((e) => e.date === selected) : [];
  const [cursor, setCursor] = React.useState(() => new Date());
  const todayISO = toISODate(new Date());
  const highlightSet = React.useMemo(() => new Set(highlightDates), [highlightDates]);
  const checkOutSet = React.useMemo(() => new Set(checkOutDates), [checkOutDates]);

  const weeks = React.useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Monday-first offset
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);

    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === month });
    }
    // Trim trailing rows that are entirely outside the month for a tighter grid
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-800">{MONTH_LABEL.format(cursor)}</p>
        <button
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <p key={w} className="text-[11px] font-medium text-slate-400">
            {w}
          </p>
        ))}

        {weeks.flat().map(({ date, inMonth }, i) => {
          const iso = toISODate(date);
          const isToday = iso === todayISO;
          const hasCheckIn = highlightSet.has(iso);
          const hasCheckOut = checkOutSet.has(iso);
          return (
            <div key={i} className="flex items-center justify-center py-1">
              <span
                role={hasCheckIn || hasCheckOut ? "button" : undefined}
                tabIndex={hasCheckIn || hasCheckOut ? 0 : undefined}
                onClick={hasCheckIn || hasCheckOut ? () => setSelected(iso) : undefined}
                onKeyDown={hasCheckIn || hasCheckOut ? (e) => e.key === "Enter" && setSelected(iso) : undefined}
                className={cn(
                  (hasCheckIn || hasCheckOut) && "cursor-pointer hover:ring-2 hover:ring-brand-300",
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-sm",
                  !inMonth && "text-slate-300",
                  inMonth && !isToday && "text-slate-700",
                  isToday && "bg-brand-500 font-semibold text-white"
                )}
              >
                {date.getDate()}
                {hasCheckIn && !isToday && (
                  <span className="absolute -top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
                {hasCheckOut && (
                  <span className="absolute -top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-red-500" title="Guest checking out" />
                )}
              </span>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? formatDate(selected) : ""} description="Guests arriving and leaving on this day" className="max-w-sm">
        {dayEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No check-ins or check-outs.</p>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.guestName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Room {e.roomNumber} · {formatDate(e.date)}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", e.type === "checkout" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                  {e.type === "checkout" ? "Check-out" : "Check-in"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
