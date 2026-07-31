import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Search, User, Pencil, IdCard, ImagePlus, Loader2, Receipt, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ui/export-menu";
import { InvoiceDialog } from "@/components/bookings/BookingDialogs";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/utils";
import { bookingStatusTone } from "@/lib/badge-tones";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { guestFormSchema, type GuestFormValues } from "@/lib/schemas";
import type { Booking, BookingWithRelations, Guest, Room, Transaction } from "@/lib/database.types";

export default function Guests() {
  const [searchParams] = useSearchParams();
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Guest | null>(null);
  const [editing, setEditing] = React.useState<Guest | null>(null);
  const [invoicing, setInvoicing] = React.useState<BookingWithRelations | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("guests").select("*").order("full_name");
    setGuests((data as Guest[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (highlight && guests.length) {
      const g = guests.find((x) => x.id === highlight);
      if (g) setSelected(g);
    }
  }, [searchParams, guests]);

  // Keep the open profile dialog in sync with the latest row after a save,
  // instead of it showing stale data until the user closes and reopens it.
  React.useEffect(() => {
    if (!selected) return;
    const fresh = guests.find((g) => g.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [guests, selected]);

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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Guests</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{guests.length} guests on record</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests…" className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No guests found" description="Guests are created automatically from new bookings." />
        ) : (
          <>
            <div className="hidden md:block">
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
                      <TD className="font-medium text-slate-900 dark:text-slate-100">
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
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {filtered.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelected(g)}
                  className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50 dark:active:bg-slate-800/60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {initials(g.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{g.full_name}</p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{g.phone ?? "—"}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {g.nationality ?? "—"} · {g.passport_number ?? "No ID"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm text-slate-500 dark:text-slate-400">
                    {g.guest_count} <span className="text-xs">guest{g.guest_count === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <GuestProfileDialog
        guest={selected}
        onClose={() => setSelected(null)}
        onEdit={(g) => setEditing(g)}
        onInvoice={(b) => setInvoicing(b)}
      />

      <GuestEditDialog
        guest={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      <InvoiceDialog booking={invoicing} onClose={() => setInvoicing(null)} />
    </div>
  );
}

function GuestProfileDialog({
  guest,
  onClose,
  onEdit,
  onInvoice,
}: {
  guest: Guest | null;
  onClose: () => void;
  onEdit: (guest: Guest) => void;
  onInvoice: (booking: BookingWithRelations) => void;
}) {
  const [bookings, setBookings] = React.useState<(Booking & { room: Room })[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [idPhotoUrl, setIdPhotoUrl] = React.useState<string | null>(null);

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
    supabase
      .from("transactions")
      .select("*")
      .eq("guest_id", guest.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
  }, [guest]);

  // Show the guest ID photo the receptionist captured during booking, the
  // same way it's shown on the booking detail view — signed URL, since the
  // guest-documents bucket is private.
  React.useEffect(() => {
    if (!guest?.id_document_path) {
      setIdPhotoUrl(null);
      return;
    }
    supabase.storage
      .from("guest-documents")
      .createSignedUrl(guest.id_document_path, 3600)
      .then(({ data }) => setIdPhotoUrl(data?.signedUrl ?? null));
  }, [guest]);

  if (!guest) return null;

  const payments = transactions.filter((t) => t.transaction_type !== "refund");
  const refunds = transactions.filter((t) => t.transaction_type === "refund");
  const totalPayments = payments.reduce((s, t) => s + Number(t.amount), 0);
  const totalRefunded = refunds.reduce((s, t) => s + Number(t.amount), 0);
  const totalSpending = totalPayments - totalRefunded;

  const totalVisits = bookings.length;
  const outstanding = bookings.reduce((s, b) => s + Number(b.remaining_balance), 0);
  const current = bookings.find((b) => b.booking_status === "checked_in");

  const exportStatementCsv = () => {
    const header = ["Date", "Type", "Booking", "Method", "Amount"];
    const rows = transactions.map((t) => [
      formatDateTime(t.created_at),
      t.transaction_type,
      bookings.find((b) => b.id === t.booking_id)?.booking_number ?? "",
      PAYMENT_METHOD_LABELS[t.payment_method],
      t.transaction_type === "refund" ? -t.amount : t.amount,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-statement-${guest.full_name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportStatementExcel = async () => {
    const { downloadExcelWorkbook } = await import("@/lib/export-excel");
    downloadExcelWorkbook(`guest-statement-${guest.full_name.replace(/\s+/g, "-")}.xlsx`, [
      {
        name: "Statement",
        columns: [
          { header: "Date", key: "date" },
          { header: "Type", key: "type" },
          { header: "Booking", key: "booking" },
          { header: "Method", key: "method" },
          { header: "Amount", key: "amount", numeric: true },
        ],
        rows: transactions.map((t) => ({
          date: formatDateTime(t.created_at),
          type: t.transaction_type,
          booking: bookings.find((b) => b.id === t.booking_id)?.booking_number ?? "",
          method: PAYMENT_METHOD_LABELS[t.payment_method],
          amount: t.transaction_type === "refund" ? -t.amount : t.amount,
        })),
      },
    ]);
  };

  const exportStatementPdf = async () => {
    const { downloadPdfReport } = await import("@/lib/export-pdf");
    downloadPdfReport({
      title: "Guest Statement",
      subtitle: `${guest.full_name} · ${guest.phone ?? "—"}`,
      summary: [
        { label: "Total Spending", value: formatCurrency(totalSpending), tone: "positive" },
        { label: "Outstanding Balance", value: formatCurrency(outstanding), tone: outstanding > 0 ? "negative" : "default" },
        { label: "Total Refunded", value: formatCurrency(totalRefunded) },
        { label: "Total Visits", value: String(totalVisits) },
      ],
      sections: [
        {
          title: "Transaction History",
          columns: ["Date", "Type", "Booking", "Method", "Amount"],
          rows: transactions.map((t) => [
            formatDateTime(t.created_at),
            t.transaction_type,
            bookings.find((b) => b.id === t.booking_id)?.booking_number ?? "",
            PAYMENT_METHOD_LABELS[t.payment_method],
            formatCurrency(t.transaction_type === "refund" ? -t.amount : t.amount),
          ]),
        },
        {
          title: "Booking History",
          columns: ["Booking", "Room", "Check-in", "Check-out", "Total", "Paid", "Balance", "Status"],
          rows: bookings.map((b) => [
            b.booking_number,
            b.room?.room_number ?? "",
            formatDate(b.check_in),
            formatDate(b.check_out),
            formatCurrency(b.total_amount),
            formatCurrency(b.advance_paid),
            formatCurrency(b.remaining_balance),
            b.booking_status,
          ]),
        },
      ],
      filename: `guest-statement-${guest.full_name.replace(/\s+/g, "-")}.pdf`,
    });
  };

  return (
    <Dialog open={!!guest} onClose={onClose} title={guest.full_name} description={guest.phone ?? undefined} className="max-w-lg">
      <div className="space-y-5">
        <div className="flex justify-end gap-2 -mt-2">
          <ExportMenu label="Statement" onCsv={exportStatementCsv} onExcel={exportStatementExcel} onPdf={exportStatementPdf} />
          <Button size="sm" variant="outline" onClick={() => onEdit(guest)}>
            <Pencil className="h-3.5 w-3.5" /> Edit Guest
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatBox label="Total Visits" value={String(totalVisits)} />
          <StatBox label="Total Spending" value={formatCurrency(totalSpending)} />
          <StatBox label="Outstanding Balance" value={formatCurrency(outstanding)} />
          <StatBox label="Current Booking" value={current ? current.booking_number : "None"} />
          {totalRefunded > 0 && <StatBox label="Total Refunded" value={formatCurrency(totalRefunded)} />}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Guest Details (from booking)</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Phone" value={guest.phone ?? "—"} />
            <Info label="Guests" value={String(guest.guest_count)} />
            <Info label="Nationality" value={guest.nationality ?? "—"} />
            <Info label="Passport / ID" value={guest.passport_number ?? "—"} />
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
            <IdCard className="h-3.5 w-3.5" /> Guest ID Photo
          </p>
          {idPhotoUrl ? (
            <a href={idPhotoUrl} target="_blank" rel="noreferrer">
              <img src={idPhotoUrl} alt="Guest ID" className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200 hover:opacity-90 dark:ring-slate-700" />
            </a>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">No ID photo on file</p>
          )}
        </div>

        {guest.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Notes</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{guest.notes}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Booking History &amp; Invoices</p>
          {loading ? (
            <PageLoader />
          ) : bookings.length === 0 ? (
            <EmptyState title="No bookings yet" icon={<User className="h-5 w-5" />} />
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {b.booking_number} · Room {b.room?.room_number}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(b.check_in)} → {formatDate(b.check_out)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={bookingStatusTone(b.booking_status)} className="capitalize">
                      {b.booking_status.replace("_", " ")}
                    </Badge>
                    <button
                      title="View Invoice"
                      onClick={() => onInvoice({ ...b, guest } as BookingWithRelations)}
                      className="text-slate-400 hover:text-brand-600"
                    >
                      <Receipt className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Payment History</p>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto scrollbar-thin">
              {payments.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium capitalize text-slate-800 dark:text-slate-200">
                      {t.transaction_type} · {PAYMENT_METHOD_LABELS[t.payment_method]}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(t.created_at)}</p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(t.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {refunds.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
              <Undo2 className="h-3.5 w-3.5" /> Refund History
            </p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto scrollbar-thin">
              {refunds.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-rose-700">{PAYMENT_METHOD_LABELS[t.payment_method]}</p>
                    <p className="text-xs text-rose-400">{formatDateTime(t.created_at)}</p>
                  </div>
                  <p className="font-semibold text-rose-600">-{formatCurrency(t.amount)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function GuestEditDialog({
  guest,
  open,
  onClose,
  onSaved,
}: {
  guest: Guest | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GuestFormValues>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: { full_name: "", phone: "", nationality: "", passport_number: "", guest_count: 1, notes: "" },
  });

  const [idPhotoUrl, setIdPhotoUrl] = React.useState<string | null>(null);
  const [idPhotoPath, setIdPhotoPath] = React.useState<string | null>(null);
  const [idPhotoUploading, setIdPhotoUploading] = React.useState(false);
  const idFileInputRef = React.useRef<HTMLInputElement>(null);

  const loadIdPhoto = React.useCallback((path: string | null | undefined) => {
    setIdPhotoPath(path ?? null);
    if (!path) {
      setIdPhotoUrl(null);
      return;
    }
    supabase.storage
      .from("guest-documents")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setIdPhotoUrl(data?.signedUrl ?? null));
  }, []);

  React.useEffect(() => {
    if (open && guest) {
      reset({
        full_name: guest.full_name,
        phone: guest.phone ?? "",
        nationality: guest.nationality ?? "",
        passport_number: guest.passport_number ?? "",
        guest_count: guest.guest_count,
        notes: guest.notes ?? "",
      });
      loadIdPhoto(guest.id_document_path);
    }
  }, [open, guest, reset, loadIdPhoto]);

  const handleIdPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !guest) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be smaller than 8MB");
      return;
    }
    setIdPhotoUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("guest-documents").upload(path, file);
    if (uploadError) {
      setIdPhotoUploading(false);
      toast.error(uploadError.message);
      return;
    }
    const { error: updateError } = await supabase.from("guests").update({ id_document_path: path }).eq("id", guest.id);
    setIdPhotoUploading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    loadIdPhoto(path);
    onSaved();
    toast.success("Guest ID photo updated");
  };

  const onSubmit = async (values: GuestFormValues) => {
    if (!guest) return;
    const { error } = await supabase
      .from("guests")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        nationality: values.nationality || null,
        passport_number: values.passport_number || null,
        guest_count: values.guest_count,
        notes: values.notes || null,
      })
      .eq("id", guest.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Guest updated");
    onSaved();
    onClose();
  };

  if (!guest) return null;

  return (
    <Dialog open={open} onClose={onClose} title={`Edit ${guest.full_name}`} description="Update guest details" className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label className="flex items-center gap-1">
            <IdCard className="h-3.5 w-3.5" /> Guest ID
          </Label>
          <input ref={idFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIdPhotoChange} />
          {idPhotoUrl ? (
            <div className="flex items-center gap-3">
              <a href={idPhotoUrl} target="_blank" rel="noreferrer">
                <img src={idPhotoUrl} alt="Guest ID" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200 hover:opacity-90" />
              </a>
              <button
                type="button"
                onClick={() => idFileInputRef.current?.click()}
                disabled={idPhotoUploading}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                {idPhotoUploading ? "Uploading…" : "Replace photo"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => idFileInputRef.current?.click()}
              disabled={idPhotoUploading}
              className="flex h-20 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 text-brand-500 hover:border-brand-300 hover:bg-brand-50"
            >
              {idPhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              <span className="text-sm font-medium">{idPhotoUploading ? "Uploading…" : "Add guest ID photo"}</span>
            </button>
          )}
        </div>

        <div>
          <Label>Full Name</Label>
          <Input {...register("full_name")} error={errors.full_name?.message} />
          <FieldError message={errors.full_name?.message} />
        </div>

        <div>
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="98XXXXXXXX" error={errors.phone?.message} />
          <FieldError message={errors.phone?.message} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nationality</Label>
            <Input {...register("nationality")} error={errors.nationality?.message} />
            <FieldError message={errors.nationality?.message} />
          </div>
          <div>
            <Label>Passport / ID No.</Label>
            <Input {...register("passport_number")} error={errors.passport_number?.message} />
            <FieldError message={errors.passport_number?.message} />
          </div>
        </div>

        <div>
          <Label>Guest Count</Label>
          <Input type="number" min={1} {...register("guest_count", { valueAsNumber: true })} error={errors.guest_count?.message} />
          <FieldError message={errors.guest_count?.message} />
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea {...register("notes")} rows={3} error={errors.notes?.message} />
          <FieldError message={errors.notes?.message} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}
