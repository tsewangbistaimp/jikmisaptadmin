// Small client-side aggregation helpers for the dashboard charts.
// Everything here buckets real rows (bookings/transactions) into time series —
// no synthetic/fake data.

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Count how many items fall on each of the last `days` days, keyed by a date field (YYYY-MM-DD or ISO). */
export function countByDay<T>(items: T[], dateField: (item: T) => string, days: number) {
  const buckets = new Map<string, number>();
  const today = toDateOnly(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }),
    count,
  }));
}

/** Sum a numeric field per day for the last `days` days. */
export function sumByDay<T>(items: T[], dateField: (item: T) => string, valueField: (item: T) => number, days: number) {
  const buckets = new Map<string, number>();
  const today = toDateOnly(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + valueField(item));
  }
  return Array.from(buckets.entries()).map(([date, total]) => ({
    date,
    label: new Date(date + "T00:00:00").getDate().toString(),
    total,
  }));
}

/** Count items per ISO week for the last `weeks` weeks. */
export function countByWeek<T>(items: T[], dateField: (item: T) => string, weeks: number) {
  const today = toDateOnly(new Date());
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - today.getDay());

  const buckets: { start: Date; label: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(startOfThisWeek.getTime() - i * 7 * DAY_MS);
    buckets.push({
      start,
      label: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      count: 0,
    });
  }

  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const d = toDateOnly(new Date(raw));
    for (const bucket of buckets) {
      const end = new Date(bucket.start.getTime() + 7 * DAY_MS);
      if (d >= bucket.start && d < end) {
        bucket.count += 1;
        break;
      }
    }
  }

  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

/** Count items per calendar month for the last `months` months. */
export function countByMonth<T>(items: T[], dateField: (item: T) => string, months: number) {
  const now = new Date();
  const buckets: { year: number; month: number; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-GB", { month: "short" }), count: 0 });
  }
  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const d = new Date(raw);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.count += 1;
  }
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

/** Sum a numeric field per calendar month for the last `months` months. */
export function sumByMonth<T>(items: T[], dateField: (item: T) => string, valueField: (item: T) => number, months: number) {
  const now = new Date();
  const buckets: { year: number; month: number; label: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-GB", { month: "short" }), total: 0 });
  }
  for (const item of items) {
    const raw = dateField(item);
    if (!raw) continue;
    const d = new Date(raw);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.total += valueField(item);
  }
  return buckets.map((b) => ({ label: b.label, total: b.total }));
}

export function monthOverMonthChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
