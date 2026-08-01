import * as React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, PlusCircle, Eye, Pencil, LogOut, Trash2, Receipt, Download, ArrowUpDown, Wallet, Undo2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { bookingStatusTone, paymentStatusTone } from "@/lib/badge-tones";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import type { BookingWithRelations } from "@/lib/database.types";
import {
  BookingDetailDialog,
  EditBookingDialog,
  CheckoutDialog,
  DeleteBookingDialog,
  InvoiceDialog,
  RecordPaymentDialog,
  RefundDialog,
} from "@/components/bookings/BookingDialogs";

const PAGE_SIZE = 10;

type SortKey = "created_at" | "check_in" | "check_out" | "total_amount";

export default function Bookings() {
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = React.useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const [viewing, setViewing] = React.useState<BookingWithRelations | null>(null);
  const [editing, setEditing] = React.useState<BookingWithRelations | null>(null);
  const [checkingOut, setCheckingOut] = React.useState<BookingWithRelations | null>(null);
  const [deleting, setDeleting] = React.useState<BookingWithRelations | null>(null);
  const [invoicing, setInvoicing] = React.useState<BookingWithRelations | null>(null);
  const [paying, setPaying] = React.useState<BookingWithRelations | null>(null);
  const [refunding, setRefunding] = React.useState<BookingWithRelations | null>(null);

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

  const downloadCsv = (rowsSource: BookingWithRelations[], filenamePrefix: string) => {
    const header = ["Booking ID", "Guest", "Phone", "Room", "Check-in", "Check-out", "Total", "Paid", "Balance", "Status"];
    const rows = rowsSource.map((b) => [
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
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => downloadCsv(filtered, "bookings");
  const exportSelectedCsv = () => {
    const rows = bookings.filter((b) => selectedIds.has(b.id));
    downloadCsv(rows, "bookings-selected");
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = paginated.length > 0 && paginated.every((b) => selectedIds.has(b.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginated.forEach((b) => next.delete(b.id));
      } else {
        paginated.forEach((b) => next.add(b.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-200 bg-navy-50 px-4 py-3 text-sm dark:border-navy-500/30 dark:bg-navy-500/10">
          <span className="font-medium text-navy-800 dark:text-navy-100">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportSelectedCsv}>
              <Download className="h-3.5 w-3.5" /> Export Selected
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

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
                    <TH className="w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectPage}
                        aria-label="Select all bookings on this page"
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                    </TH>
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
                    <TR key={b.id} className={selectedIds.has(b.id) ? "bg-navy-50/60 dark:bg-navy-500/10" : undefined}>
                      <TD>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() => toggleSelectOne(b.id)}
                          aria-label={`Select booking ${b.booking_number}`}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                        />
                      </TD>
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
                          {b.remaining_balance > 0 && b.booking_status !== "cancelled" && (
                            <IconButton title="Record Payment" onClick={() => setPaying(b)}>
                              <Wallet className="h-4 w-4" />
                            </IconButton>
                          )}
                          {b.advance_paid > 0 && (
                            <IconButton title="Refund" onClick={() => setRefunding(b)}>
                              <Undo2 className="h-4 w-4" />
                            </IconButton>
                          )}
                          <IconButton title="Delete" onClick={() => setDeleting(b)} destructive>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
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
                <div key={b.id} className={cn("p-4", selectedIds.has(b.id) && "bg-navy-50/60 dark:bg-navy-500/10")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={() => toggleSelectOne(b.id)}
                        aria-label={`Select booking ${b.booking_number}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{b.booking_number}</p>
                        <p className="truncate text-sm text-slate-600 dark:text-slate-400">{b.guest?.full_name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{b.guest?.phone}</p>
                      </div>
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

                  <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
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
                    {b.remaining_balance > 0 && b.booking_status !== "cancelled" && (
                      <IconButton title="Record Payment" onClick={() => setPaying(b)}>
                        <Wallet className="h-4 w-4" />
                      </IconButton>
                    )}
                    {b.advance_paid > 0 && (
                      <IconButton title="Refund" onClick={() => setRefunding(b)}>
                        <Undo2 className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton title="Delete" onClick={() => setDeleting(b)} destructive>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
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

      <BookingDetailDialog
        booking={viewing}
        onClose={() => setViewing(null)}
        onRecordPayment={(b) => {
          setViewing(null);
          setPaying(b);
        }}
        onRecordRefund={(b) => {
          setViewing(null);
          setRefunding(b);
        }}
      />
      <EditBookingDialog booking={editing} onClose={() => setEditing(null)} onSaved={load} />
      <CheckoutDialog booking={checkingOut} onClose={() => setCheckingOut(null)} onDone={load} />
      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={load} />
      <InvoiceDialog booking={invoicing} onClose={() => setInvoicing(null)} />
      <RecordPaymentDialog booking={paying} onClose={() => setPaying(null)} onDone={load} />
      <RefundDialog booking={refunding} onClose={() => setRefunding(null)} onDone={load} />
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

