import * as React from "react";
import { supabase } from "@/lib/supabase";
import type { BookingPriceQuote } from "@/lib/database.types";

/** Live price preview from the shared public.calculate_booking_price() RPC —
 *  the same function the database uses to authoritatively price every
 *  booking (guest website requests, and this dashboard's own reception
 *  bookings). This hook exists so New Booking / Edit Booking never
 *  reimplement the daily-vs-monthly-rate rule in JS; they just ask the
 *  database what today's rate would be for a room + date range. */
export function useBookingPrice(roomId: string | undefined, checkIn: string, checkOut: string) {
  const [quote, setQuote] = React.useState<BookingPriceQuote | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!roomId || !checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("calculate_booking_price", { p_room_id: roomId, p_check_in: checkIn, p_check_out: checkOut })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setQuote(null);
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          setQuote((row as BookingPriceQuote) ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, checkIn, checkOut]);

  return { quote, loading };
}
