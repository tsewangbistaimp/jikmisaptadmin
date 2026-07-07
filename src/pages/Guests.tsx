import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Search, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { bookingStatusTone } from "@/lib/badge-tones";
import type { Booking, Guest, Room } from "@/lib/database.types";

export default function Guests() {
  const [searchParams] = useSearchParams();
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Guest | null>(null);

  React.useEffect(() => {
    supabase
      .from("guests")
      .select("*")
      .order("full_name")
      .then(({ data }) => {
        setGuests((data as Guest[]) ?? []);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (highlight && guests.length) {
      const g = guests.find((x) => x.id === highlight);
      if (g) setSelected(g);
    }
  }, [searchParams, guests]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.full_name.toLowerCase().includes(q) ||
        g.phone?.toLowerCase().includes(q) ||
        g.passport_number?.toLowerCase().includes(q)
    );
  }, [guests, query]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Guests</h1>
        <p className="text-sm text-slate-500">{guests.length} guests on record</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests…" className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No guests found" description="Guests are created automatically from new bookings." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Guest</TH>
                <TH>Phone</TH>
                <TH>Nationality</TH>
                <TH>Passport / ID</TH>
                <TH>Guests</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((g) => (
                <TR key={g.id} className="cursor-pointer" onClick={() => setSelected(g)}>
                  <TD className="font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {initials(g.full_name)}
                      </div>
                      {g.full_name}
                    </div>
                  </TD>
                  <TD>{g.phone ?? "—"}</TD>
                  <TD>{g.nationality ?? "—"}</TD>
                  <TD>{g.passport_number ?? "—"}</TD>
                  <TD>{g.guest_count}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <GuestProfileDialog guest={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function GuestProfileDialog({ guest, onClose }: { guest: Guest | null; onClose: () => void }) {
  const [bookings, setBookings] = React.useState<(Booking & { room: Room })[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!guest) return;
    setLoading(true);
    supabase
      .from("bookings")
      .select("*, room:rooms(*)")
      .eq("guest_id", guest.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBookings((data as (Booking & { room: Room })[]) ?? []);
        setLoading(false);
      });
  }, [guest]);

  if (!guest) return null;

  const totalVisits = bookings.length;
  const totalPaid = bookings.reduce((s, b) => s + Number(b.advance_paid), 0);
  const outstanding = bookings.reduce((s, b) => s + Number(b.remaining_balance), 0);
  const current = bookings.find((b) => b.booking_status === "checked_in");

  return (
    <Dialog open={!!guest} onClose={onClose} title={guest.full_name} description={guest.phone ?? undefined} className="max-w-lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatBox label="Total Visits" value={String(totalVisits)} />
          <StatBox label="Total Paid" value={formatCurrency(totalPaid)} />
          <StatBox label="Outstanding Balance" value={formatCurrency(outstanding)} />
          <StatBox label="Current Booking" value={current ? current.booking_number : "None"} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Nationality" value={guest.nationality ?? "—"} />
          <Info label="Passport / ID" value={guest.passport_number ?? "—"} />
        </div>

        {guest.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Notes</p>
            <p className="mt-1 text-sm text-slate-700">{guest.notes}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400">Booking History</p>
          {loading ? (
            <PageLoader />
          ) : bookings.length === 0 ? (
            <EmptyState title="No bookings yet" icon={<User className="h-5 w-5" />} />
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {b.booking_number} · Room {b.room?.room_number}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(b.check_in)} → {formatDate(b.check_out)}
                    </p>
                  </div>
                  <Badge tone={bookingStatusTone(b.booking_status)} className="capitalize">
                    {b.booking_status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}
