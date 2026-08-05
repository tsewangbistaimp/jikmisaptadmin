import * as React from "react";
import { supabase } from "@/lib/supabase";
import type { BookingWithRelations, NotificationLog } from "@/lib/database.types";

/** All guest-website booking requests (booking_source = 'website'), across
 *  every status — the Online Booking Requests page filters/tabs client-side
 *  from this one list. Subscribes to Supabase Realtime on public.bookings
 *  (already added to the "supabase_realtime" publication in
 *  20260726000000_enable_bookings_realtime.sql) so a new request, or an
 *  approval/rejection made from another tab or by another staff member,
 *  shows up instantly without a page reload — same pattern as Dashboard.tsx. */
export function useOnlineBookings() {
  const [bookings, setBookings] = React.useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*, guest:guests(*), room:rooms(*)")
      .eq("booking_source", "website")
      .order("created_at", { ascending: false })
      .limit(500);
    setBookings((data as BookingWithRelations[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const channel = supabase
      .channel("online-bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { bookings, loading, reload: load };
}

/** Lightweight count-only version for the sidebar badge / topbar alert —
 *  avoids fetching full booking rows just to show a number.
 *
 *  Both the desktop Sidebar and the mobile bottom-nav "More" sheet call this
 *  at the same time (both are always mounted, just hidden/shown per
 *  breakpoint with CSS) — a hardcoded channel name here would mean the
 *  second caller tries to attach a postgres_changes listener to a channel
 *  the first caller already subscribed, which supabase-js throws on
 *  ("cannot add postgres_changes callbacks ... after subscribe()"), crashing
 *  the whole app. useId() gives every hook instance its own channel name so
 *  they don't collide, at the cost of one extra realtime subscription. */
export function usePendingOnlineBookingsCount() {
  const [count, setCount] = React.useState(0);
  const instanceId = React.useId();

  const load = React.useCallback(async () => {
    // Counts both stages that need staff action: a fresh request awaiting
    // its legitimacy review, and one already approved but awaiting advance-
    // payment verification. Neither reserves a room yet, so both are
    // genuinely "something for staff to do", same as the badge implies.
    const { count: c } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_source", "website")
      .in("booking_status", ["pending_approval", "payment_under_review"]);
    setCount(c ?? 0);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`online-bookings-pending-count-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, instanceId]);

  return count;
}

/** Full notification outbox, newest first — powers the Online Bookings
 *  page's "Notifications" tab (the cross-booking "complete notification
 *  history" view). Realtime-subscribed so an approve/reject/retry from
 *  another tab or staff member shows up immediately. */
export function useNotificationLog() {
  const [notifications, setNotifications] = React.useState<NotificationLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("notification_log").select("*").order("created_at", { ascending: false }).limit(500);
    setNotifications((data as NotificationLog[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const channel = supabase
      .channel("notification-log-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_log" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { notifications, loading, reload: load };
}
