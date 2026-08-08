// Aggregation + date-range helpers for the Reports module. Kept separate
// from dashboard-helpers.ts because these operate over an explicit
// [from, to] window chosen by the user (report filters), whereas
// dashboard-helpers.ts always buckets a fixed trailing window ending today.
import { todayISO, nightsBetween } from "@/lib/utils";

export type DateRangePreset = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "year" | "all" | "custom";

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This Week",
  lastWeek: "Last Week",
  month: "This Month",
  lastMonth: "Last Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** A date far enough in the past to safely stand in for "the start of all our data" (the app launched in mid-2026). */
const EPOCH = "2020-01-01";

export function getPresetRange(preset: DateRangePreset, custom?: { from: string; to: string }): { from: string; to: string } {
  const today = todayISO();
  const now = new Date(today + "T00:00:00");

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const iso = toISO(y);
      return { from: iso, to: iso };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: toISO(start), to: today };
    }
    case "lastWeek": {
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
      return { from: toISO(lastWeekStart), to: toISO(lastWeekEnd) };
    }
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "lastMonth": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISO(d), to: toISO(lastDay) };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { from: EPOCH, to: today };
    case "custom":
      return { from: custom?.from || EPOCH, to: custom?.to || today };
  }
}

/**
 * A transaction's contribution to revenue: refunds subtract (money going
 * back out to the guest) rather than adding, unlike a plain sum of
 * `amount` which treats every row as incoming cash.
 */
export function netTransactionAmount(t: { amount: number; transaction_type: string }) {
  return t.transaction_type === "refund" ? -Math.abs(Number(t.amount)) : Number(t.amount);
}

/** Sum a numeric field for items whose date falls within [from, to] inclusive. */
export function sumInRange<T>(items: T[], dateField: (item: T) => string, valueField: (item: T) => number, from: string, to: string) {
  let total = 0;
  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (key >= from && key <= to) total += valueField(item);
  }
  return total;
}

/** Filter items whose date falls within [from, to] inclusive. */
export function filterInRange<T>(items: T[], dateField: (item: T) => string, from: string, to: string) {
  return items.filter((item) => {
    const raw = dateField(item);
    if (!raw) return false;
    const key = raw.slice(0, 10);
    return key >= from && key <= to;
  });
}

export interface DailyNet {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

/**
 * Build a per-day income/expense/profit map covering every day in
 * [from, to] inclusive (gaps filled with zero), for the financial calendar
 * and the daily P&L chart.
 */
export function buildDailyNet<TI, TE>(
  income: TI[],
  incomeDate: (item: TI) => string,
  incomeAmount: (item: TI) => number,
  expenses: TE[],
  expenseDate: (item: TE) => string,
  expenseAmount: (item: TE) => number,
  from: string,
  to: string
): Map<string, DailyNet> {
  const map = new Map<string, DailyNet>();
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);
    map.set(iso, { date: iso, income: 0, expense: 0, profit: 0 });
  }
  for (const item of income) {
    const key = incomeDate(item)?.slice(0, 10);
    const entry = key && map.get(key);
    if (entry) entry.income += incomeAmount(item);
  }
  for (const item of expenses) {
    const key = expenseDate(item)?.slice(0, 10);
    const entry = key && map.get(key);
    if (entry) entry.expense += expenseAmount(item);
  }
  for (const entry of map.values()) entry.profit = entry.income - entry.expense;
  return map;
}

export type LedgerEntryType = "income" | "expense";

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  description: string;
  income: number;
  expense: number;
  runningBalance: number;
  paymentMethod: string;
  reference: string;
  guest: string;
  booking: string;
}

/**
 * Merge transactions (income) and expenses into one chronological ledger
 * with a running balance. Refund transactions (transaction_type "refund")
 * subtract from the running balance instead of adding, since they represent
 * money going back out.
 */
export function buildLedger(
  transactions: {
    id: string;
    amount: number;
    created_at: string;
    payment_method: string;
    transaction_type: string;
    booking: { booking_number: string } | null;
    guest: { full_name: string } | null;
  }[],
  expenses: {
    id: string;
    amount: number;
    date: string;
    title: string;
    payment_method: string;
    category: { name: string } | null;
  }[]
): LedgerEntry[] {
  const rows: Omit<LedgerEntry, "runningBalance">[] = [];

  for (const t of transactions) {
    const isRefund = t.transaction_type === "refund";
    rows.push({
      id: `t-${t.id}`,
      date: t.created_at,
      type: "income",
      description: isRefund ? "Refund" : `Payment (${t.transaction_type})`,
      income: netTransactionAmount(t),
      expense: 0,
      paymentMethod: t.payment_method,
      reference: t.booking?.booking_number ?? t.id.slice(0, 8),
      guest: t.guest?.full_name ?? "",
      booking: t.booking?.booking_number ?? "",
    });
  }

  for (const e of expenses) {
    rows.push({
      id: `e-${e.id}`,
      date: e.date,
      type: "expense",
      description: e.title,
      income: 0,
      expense: Number(e.amount),
      paymentMethod: e.payment_method,
      reference: e.category?.name ?? e.id.slice(0, 8),
      guest: "",
      booking: "",
    });
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  return rows.map((r) => {
    balance += r.income - r.expense;
    return { ...r, runningBalance: balance };
  });
}

// ---------------------------------------------------------------------------
// Monthly/Yearly Analytics helpers
// ---------------------------------------------------------------------------

/**
 * A cancelled booking still counts toward revenue/occupancy stats if it
 * retained payment — cancel_booking() (see supabase/migrations) clips
 * total_amount down to whatever was actually collected and kept as
 * non-refundable revenue at cancellation time, so a booking cancelled with
 * nothing ever collected naturally nets to zero either way; this just skips
 * counting it as a "booking"/night at all in that case.
 */
function countsTowardStats<T extends { booking_status: string; total_amount: number }>(b: T): boolean {
  if (b.booking_status !== "cancelled") return true;
  return Number(b.total_amount) > 0;
}

/**
 * Count "room-nights" — one per room per night actually occupied — for
 * resolved bookings (cancelled bookings only count if they retained
 * payment - see countsTowardStats), clipped to [from, to] inclusive. Used
 * for Average Daily Revenue (ADR = revenue in range ÷ room-nights in
 * range), which is only meaningful once you know how many nights were
 * actually sold, not just how many bookings touched the range.
 */
export function roomNightsInRange<T extends { check_in: string; check_out: string; booking_status: string; total_amount: number }>(
  bookings: T[],
  from: string,
  to: string
): number {
  const rangeEndExclusive = new Date(to + "T00:00:00");
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);
  const rangeEndISO = rangeEndExclusive.toISOString().slice(0, 10);

  let nights = 0;
  for (const b of bookings) {
    if (!countsTowardStats(b)) continue;
    const start = b.check_in > from ? b.check_in : from;
    const end = b.check_out < rangeEndISO ? b.check_out : rangeEndISO;
    if (end > start) nights += nightsBetween(start, end);
  }
  return nights;
}

export interface RoomAggregate {
  roomId: string;
  bookingCount: number;
  revenue: number;
}

/** Group resolved bookings by room, summing booking count and total_amount
 *  (cancelled bookings only count if they retained payment - see
 *  countsTowardStats; total_amount is already clipped to what was kept). */
export function aggregateByRoom<T extends { room_id: string; total_amount: number; booking_status: string }>(bookings: T[]): Map<string, RoomAggregate> {
  const map = new Map<string, RoomAggregate>();
  for (const b of bookings) {
    if (!countsTowardStats(b)) continue;
    const existing = map.get(b.room_id) ?? { roomId: b.room_id, bookingCount: 0, revenue: 0 };
    existing.bookingCount += 1;
    existing.revenue += Number(b.total_amount);
    map.set(b.room_id, existing);
  }
  return map;
}

/** Average nights-per-stay across resolved bookings (cancelled bookings only
 *  count if they retained payment - see countsTowardStats). Returns 0 if
 *  there are none. */
export function averageStay<T extends { check_in: string; check_out: string; booking_status: string; total_amount: number }>(bookings: T[]): number {
  const active = bookings.filter((b) => countsTowardStats(b));
  if (active.length === 0) return 0;
  const totalNights = active.reduce((s, b) => s + nightsBetween(b.check_in, b.check_out), 0);
  return totalNights / active.length;
}

/** Percentage growth from `previous` to `current`, rounded to 1 decimal place. */
export function growthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
