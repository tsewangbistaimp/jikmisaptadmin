import * as React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, PlusCircle, Eye, Pencil, LogOut, Trash2, Receipt, Download, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { bookingStatusTone, paymentStatusTone } from "@/lib/badge-tones";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import type { BookingWithRelations } from "@/lib/database.types";
import {
  BookingDetailDialog,
  EditBookingDialog,
  CheckoutDialog,
  DeleteBookingDialog,
  InvoiceDialog,
} from "@/components/bookings/BookingDialogs";

const PAGE_SIZE = 10;

type SortKey = "created_at" | "check_in" | "check_out" | "total_amount";

export default function Bookings() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = React.useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  const [viewing, setViewing] = React.useState<BookingWithRelations | null>(null);
  const [editing, setEditing] = React.useState<BookingWithRelations | null>(null);
  const [checkingOut, setCheckingOut] = React.useState<BookingWithRelations | null>(null);
  const [deleting, setDeleting] = React.useState<BookingWithRelations | null>(null);
  const [invoicing, setInvoicing] = React.useState<BookingWithRelations | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*, guest:guests(*), room:rooms(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    setBookings((data as BookingWithRelations[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (highlight) setQuery("");
  }, [searchParams]);

  const filtered = React.useMemo(() => {
    let rows = bookings;
    if (statusFilter !== "all") rows = rows.filter((b) => b.booking_status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          b.booking_number.toLowerCase().includes(q) ||
          b.guest?.full_name?.toLowerCase().includes(q) ||
          b.guest?.phone?.toLowerCase().includes(q) ||
          b.room?.room_number?.toLowerCase().includes(q)
      );
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [bookings, query, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => setPage(1), [query, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const header = ["Booking ID", "Guest", "Phone", "Room", "Check-in", "Check-out", "Total", "Paid", "Balance", "Status"];
    const rows = filtered.map((b) => [
      b.booking_number,
      b.guest?.full_name ?? "",
      b.guest?.phone ?? "",
      b.room?.room_number ?? "",
      b.check_in,
      b.check_out,
      b.total_amount,
      b.advance_paid,
      b.remaining_balance,
      b.booking_status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bookings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Link to="/bookings/new">
            <Button size="sm">
              <PlusCircle className="h-4 w-4" /> New Booking
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest, phone, booking ID or room…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
            <option value="all">All statuses</option>
            {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description="Try adjusting your search or filters, or create a new booking."
            action={
              <Link to="/bookings/new">
                <Button size="sm">
                  <PlusCircle className="h-4 w-4" /> New Booking
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            {/* Desktop / tablet: full table, no horizontal scroll issues since columns fit md+ */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Booking ID</TH>
                    <TH>Guest</TH>
                    <TH>Phone</TH>
                    <TH>Room</TH>
                    <SortableTH label="Check-in" onClick={() => toggleSort("check_in")} />
                    <SortableTH label="Check-out" onClick={() => toggleSort("check_out")} />
                    <SortableTH label="Total" onClick={() => toggleSort("total_amount")} />
                    <TH>Paid</TH>
                    <TH>Balance</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {paginated.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium text-slate-900 dark:text-slate-100">{b.booking_number}</TD>
                      <TD>{b.guest?.full_name}</TD>
                      <TD>{b.guest?.phone}</TD>
                      <TD>{b.room?.room_number}</TD>
                      <TD>{formatDate(b.check_in)}</TD>
                      <TD>{formatDate(b.check_out)}</TD>
                      <TD>{formatCurrency(b.total_amount)}</TD>
                      <TD>{formatCurrency(b.advance_paid)}</TD>
                      <TD>{formatCurrency(b.remaining_balance)}</TD>
                      <TD>
                        <div className="flex flex-col gap-1">
                          <Badge tone={bookingStatusTone(b.booking_status)} className="w-fit capitalize">
                            {b.booking_status.replace("_", " ")}
                          </Badge>
                          <Badge tone={paymentStatusTone(b.payment_status)} className="w-fit capitalize">
                            {b.payment_status}
                          </Badge>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <IconButton title="View" onClick={() => setViewing(b)}>
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="Edit" onClick={() => setEditing(b)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          {b.booking_status !== "checked_out" && b.booking_status !== "cancelled" && (
                            <IconButton title="Checkout" onClick={() => setCheckingOut(b)}>
                              <LogOut className="h-4 w-4" />
                            </IconButton>
                          )}
                          <IconButton title="Invoice" onClick={() => setInvoicing(b)}>
                            <Receipt className="h-4 w-4" />
                          </IconButton>
                          {isAdmin && (
                            <IconButton title="Delete" onClick={() => setDeleting(b)} destructive>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile: stacked cards, no horizontal scroll */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {paginated.map((b) => (
                <div key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{b.booking_number}</p>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">{b.guest?.full_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{b.guest?.phone}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={bookingStatusTone(b.booking_status)} className="w-fit capitalize">
                        {b.booking_status.replace("_", " ")}
                      </Badge>
                      <Badge tone={paymentStatusTone(b.payment_status)} className="w-fit capitalize">
                        {b.payment_status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Room</p>
                      <p className="text-slate-700 dark:text-slate-300">{b.room?.room_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Check-in / out</p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {formatDate(b.check_in)} – {formatDate(b.check_out)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Total / Paid</p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {formatCurrency(b.total_amount)} / {formatCurrency(b.advance_paid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Balance</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(b.remaining_balance)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <IconButton title="View" onClick={() => setViewing(b)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton title="Edit" onClick={() => setEditing(b)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    {b.booking_status !== "checked_out" && b.booking_status !== "cancelled" && (
                      <IconButton title="Checkout" onClick={() => setCheckingOut(b)}>
                        <LogOut className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton title="Invoice" onClick={() => setInvoicing(b)}>
                      <Receipt className="h-4 w-4" />
                    </IconButton>
                    {isAdmin && (
                      <IconButton title="Delete" onClick={() => setDeleting(b)} destructive>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <BookingDetailDialog booking={viewing} onClose={() => setViewing(null)} />
      <EditBookingDialog booking={editing} onClose={() => setEditing(null)} onSaved={load} />
      <CheckoutDialog booking={checkingOut} onClose={() => setCheckingOut(null)} onDone={load} />
      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={load} />
      <InvoiceDialog booking={invoicing} onClose={() => setInvoicing(null)} />
    </div>
  );
}

function SortableTH({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TH>
      <button onClick={onClick} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TH>
  );
}

function IconButton({
  children,
  onClick,
  title,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  destructive?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${destructive ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-500/10" : "text-slate-500 dark:text-slate-400"}`}
    >
      {children}
    </button>
  );
}
