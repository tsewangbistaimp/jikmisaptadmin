import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, ClipboardList, DoorClosed } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import type { Booking, Guest, Room } from "@/lib/database.types";
import { Spinner } from "@/components/ui/misc";

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setGuests([]);
      setBookings([]);
      setRooms([]);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGuests([]);
      setBookings([]);
      setRooms([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const [g, b, r] = await Promise.all([
        supabase
          .from("guests")
          .select("*")
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,passport_number.ilike.%${q}%`)
          .limit(5),
        supabase.from("bookings").select("*").ilike("booking_number", `%${q}%`).limit(5),
        supabase.from("rooms").select("*").ilike("room_number", `%${q}%`).limit(5),
      ]);
      setGuests((g.data as Guest[]) ?? []);
      setBookings((b.data as Booking[]) ?? []);
      setRooms((r.data as Room[]) ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = guests.length + bookings.length + rooms.length > 0;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by guest name, phone, booking ID, room, or passport…"
          className="pl-9 h-11"
        />
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!loading && query.length >= 2 && !hasResults && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No results found.</p>
        )}

        {guests.length > 0 && (
          <div className="mb-2">
            <p className="px-1 py-1 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Guests</p>
            {guests.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  navigate(`/guests?highlight=${g.id}`);
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:bg-slate-900"
              >
                <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="font-medium text-slate-800 dark:text-slate-200">{g.full_name}</span>
                <span className="text-slate-400 dark:text-slate-500">{g.phone}</span>
              </button>
            ))}
          </div>
        )}

        {bookings.length > 0 && (
          <div className="mb-2">
            <p className="px-1 py-1 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Bookings</p>
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  navigate(`/bookings?highlight=${b.id}`);
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:bg-slate-900"
              >
                <ClipboardList className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="font-medium text-slate-800 dark:text-slate-200">{b.booking_number}</span>
              </button>
            ))}
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <p className="px-1 py-1 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rooms</p>
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  navigate(`/rooms?highlight=${r.id}`);
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:bg-slate-900"
              >
                <DoorClosed className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="font-medium text-slate-800 dark:text-slate-200">Room {r.room_number}</span>
                <span className="text-slate-400 dark:text-slate-500">{r.room_type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
