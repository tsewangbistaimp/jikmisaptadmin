import * as React from "react";
import { supabase } from "@/lib/supabase";
import type { BookingWithRelations } from "@/lib/database.types";

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
 *  avoids fetching full booking rows just to show a number. */
export function usePendingOnlineBookingsCount() {
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(async () => {
    const { count: c } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_source", "website")
      .eq("booking_status", "pending_approval");
    setCount(c ?? 0);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const channel = supabase
      .channel("online-bookings-pending-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return count;
}
