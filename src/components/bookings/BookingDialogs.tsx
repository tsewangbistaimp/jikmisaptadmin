import * as React from "react";
import { toast } from "sonner";
import { Printer, Building2, Wallet, ShieldCheck, IdCard } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { BOOKING_SOURCE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { paymentStatusTone, bookingStatusTone } from "@/lib/badge-tones";
import type { BookingService, BookingWithRelations, PaymentMethod, Transaction } from "@/lib/database.types";

type TransactionWithStaff = Transaction & { staff: { full_name: string } | null };

// ---------------------------------------------------------------------------
// View booking details + payment history
// ---------------------------------------------------------------------------
export function BookingDetailDialog({
  booking,
  onClose,
  onRecordPayment,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onRecordPayment?: (booking: BookingWithRelations) => void;
}) {
  const [transactions, setTransactions] = React.useState<TransactionWithStaff[]>([]);
  const [addOns, setAddOns] = React.useState<BookingService[]>([]);
  const [idPhotoUrl, setIdPhotoUrl] = React.useState<string | null>(null);

  const reloadTransactions = React.useCallback(() => {
    if (!booking) return;
    supabase
      .from("transactions")
      .select("*, staff:profiles(full_name)")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTransactions((data as TransactionWithStaff[]) ?? []));
  }, [booking]);

  React.useEffect(() => {
    if (!booking) return;
    reloadTransactions();
    supabase
      .from("booking_services")
      .select("*")
      .eq("booking_id", booking.id)
      .then(({ data }) => setAddOns((data as BookingService[]) ?? []));

    setIdPhotoUrl(null);
    if (booking.guest?.id_document_path) {
      supabase.storage
        .from("guest-documents")
        .createSignedUrl(booking.guest.id_document_path, 3600)
        .then(({ data }) => setIdPhotoUrl(data?.signedUrl ?? null));
    }
  }, [booking, reloadTransactions]);

  if (!booking) return null;

  return (
    <Dialog open={!!booking} onClose={onClose} title={booking.booking_number} description="Booking details" className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone={bookingStatusTone(booking.booking_status)} className="capitalize">
            {booking.booking_status.replace("_", " ")}
          </Badge>
          <Badge tone={paymentStatusTone(booking.payment_status)} className="capitalize">
            {booking.payment_status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Guest" value={booking.guest?.full_name} />
          <Info label="Phone" value={booking.guest?.phone ?? "—"} />
          <Info label="Room" value={`${booking.room?.room_number} · ${booking.room?.room_type}`} />
          <Info label="Guests" value={String(booking.guest_count)} />
          <Info label="Check-in" value={formatDate(booking.check_in)} />
          <Info label="Check-out" value={formatDate(booking.check_out)} />
          <Info label="Nights" value={String(booking.nights)} />
          <Info label="Source" value={BOOKING_SOURCE_LABELS[booking.booking_source]} />
          <Info label="Total" value={formatCurrency(booking.total_amount)} />
          <Info label="Paid" value={formatCurrency(booking.advance_paid)} />
          <Info label="Balance" value={formatCurrency(booking.remaining_balance)} />
          <Info label="Method" value={booking.payment_method ? PAYMENT_METHOD_LABELS[booking.payment_method] : "—"} />
        </div>

        {idPhotoUrl && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
              <IdCard className="h-3.5 w-3.5" /> Guest ID
            </p>
            <a href={idPhotoUrl} target="_blank" rel="noreferrer">
              <img src={idPhotoUrl} alt="Guest ID" className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200 hover:opacity-90" />
            </a>
          </div>
        )}

        {booking.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Notes</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{booking.notes}</p>
          </div>
        )}

        {addOns.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Services & Add-ons</p>
            <ul className="space-y-1.5">
              {addOns.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {a.name} {a.quantity > 1 ? `× ${a.quantity}` : ""}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(a.unit_price * a.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Payment History</p>
            {onRecordPayment && booking.remaining_balance > 0 && booking.booking_status !== "cancelled" && (
              <button
                onClick={() => onRecordPayment(booking)}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <Wallet className="h-3.5 w-3.5" /> Record Payment
              </button>
            )}
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">{t.transaction_type} · {PAYMENT_METHOD_LABELS[t.payment_method]}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDateTime(t.created_at)}
                      {t.staff?.full_name ? ` · recorded by ${t.staff.full_name}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(t.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value ?? "—"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit booking
// ---------------------------------------------------------------------------
export function EditBookingDialog({
  booking,
  onClose,
  onSaved,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [bookingSource, setBookingSource] = React.useState("walk_in");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!booking) return;
    setCheckIn(booking.check_in);
    setCheckOut(booking.check_out);
    setTotalAmount(booking.total_amount);
    setNotes(booking.notes ?? "");
    setBookingSource(booking.booking_source);
  }, [booking]);

  if (!booking) return null;

  const save = async () => {
    setError(null);
    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("Check-out must be after check-in");
      return;
    }
    if (totalAmount < booking.advance_paid) {
      setError("Total amount can't be less than the amount already paid");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        check_in: checkIn,
        check_out: checkOut,
        total_amount: totalAmount,
        notes: notes || null,
        booking_source: bookingSource,
      })
      .eq("id", booking.id);
    setSaving(false);
    if (error) {
      if (error.code === "23P01") setError("This room is already booked for the selected dates.");
      else setError(error.message);
      return;
    }
    toast.success("Booking updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title={`Edit ${booking.booking_number}`} className="max-w-md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Check-in</Label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <Label>Check-out</Label>
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Total Amount</Label>
          <Input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} />
        </div>
        <div>
          <Label>Booking Source</Label>
          <Select value={bookingSource} onChange={(e) => setBookingSource(e.target.value)}>
            {Object.entries(BOOKING_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <FieldError message={error ?? undefined} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
export function CheckoutDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (booking) setAmount(booking.remaining_balance);
  }, [booking]);

  if (!booking) return null;

  const confirmCheckout = async () => {
    setSaving(true);
    try {
      if (amount > 0) {
        const { error: txError } = await supabase.from("transactions").insert({
          booking_id: booking.id,
          guest_id: booking.guest_id,
          amount,
          payment_method: method,
          transaction_type: "final",
          notes: "Final payment at checkout",
          created_by: profile?.id ?? null,
        });
        if (txError) throw txError;
      }

      const newAdvance = booking.advance_paid + amount;
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          advance_paid: newAdvance,
          payment_status: newAdvance >= booking.total_amount ? "paid" : "partial",
          booking_status: "checked_out",
        })
        .eq("id", booking.id);
      if (bookingError) throw bookingError;

      // Room availability is calculated from booking dates, so once a
      // booking is checked out it no longer blocks any future date range —
      // no room status needs to change here.

      toast.success(`${booking.guest?.full_name} checked out`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title="Confirm Checkout" description={booking.booking_number} className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {booking.guest?.full_name} · Room {booking.room?.room_number}
        </p>

        {booking.remaining_balance > 0 ? (
          <>
            <div>
              <Label>Collect Remaining Payment</Label>
              <Input type="number" min={0} max={booking.remaining_balance} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Outstanding balance: {formatCurrency(booking.remaining_balance)}</p>
            </div>
            {amount > 0 && (
              <div>
                <Label>Payment Method</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-green-50 dark:bg-green-500/10 px-3 py-2 text-sm text-green-700">Fully paid — no balance due.</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirmCheckout} loading={saving}>
            Confirm Checkout
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Record an additional (due) payment — usable any time, not just checkout.
// The remaining-balance check and all totals are recalculated on the server
// inside the record_payment() Postgres function, so a client can't submit an
// amount that overpays the booking even by editing frontend code.
// ---------------------------------------------------------------------------
export function RecordPaymentDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (booking) {
      setAmount(booking.remaining_balance);
      setNotes("");
      setError(null);
    }
  }, [booking]);

  if (!booking) return null;

  const fullyPaid = booking.remaining_balance <= 0;

  const submit = async () => {
    setError(null);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (amount > booking.remaining_balance) {
      setError(`Amount can't exceed the remaining balance of ${formatCurrency(booking.remaining_balance)}`);
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: amount,
      p_payment_method: method,
      p_notes: notes || null,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success(`Payment of ${formatCurrency(amount)} recorded`);
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title="Record Payment" description={booking.booking_number} className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {booking.guest?.full_name} · Room {booking.room?.room_number}
        </p>

        {fullyPaid ? (
          <p className="rounded-lg bg-green-50 dark:bg-green-500/10 px-3 py-2 text-sm text-green-700">Fully paid — no balance due.</p>
        ) : (
          <>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                max={booking.remaining_balance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Outstanding balance: {formatCurrency(booking.remaining_balance)}
              </p>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Paid remaining balance in cash" />
            </div>
            <FieldError message={error ?? undefined} />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {fullyPaid ? "Close" : "Cancel"}
          </Button>
          {!fullyPaid && (
            <Button onClick={submit} loading={saving}>
              <Wallet className="h-4 w-4" /> Record Payment
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
export function DeleteBookingDialog({
  booking,
  onClose,
  onDeleted,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCode("");
    setError(null);
  }, [booking]);

  if (!booking) return null;

  // Admins can delete directly — the "bookings_delete" RLS policy already
  // restricts this to admins, and no authorization code is needed for them.
  if (isAdmin) {
    const confirmDelete = async () => {
      setLoading(true);
      const { error: delError } = await supabase.from("bookings").delete().eq("id", booking.id);
      setLoading(false);
      if (delError) {
        toast.error(delError.message);
        return;
      }
      toast.success("Booking deleted");
      onDeleted();
      onClose();
    };

    return (
      <ConfirmDialog
        open={!!booking}
        onClose={onClose}
        onConfirm={confirmDelete}
        title={`Delete ${booking.booking_number}?`}
        description="This will permanently remove the booking and its payment records. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={loading}
      />
    );
  }

  // Receptionists must supply a valid, unexpired, unused code that an admin
  // generated for them. Verification happens entirely server-side inside
  // delete_booking_with_code() — this component never performs the delete
  // itself, so there's no way to bypass the check from the frontend.
  const confirmWithCode = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Enter the authorization code your admin gave you");
      return;
    }
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("delete_booking_with_code", {
      p_booking_id: booking.id,
      p_code: code.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Booking deleted");
    onDeleted();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title={`Delete ${booking.booking_number}?`} className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This will permanently remove the booking and its payment records. Ask your admin for a temporary
          authorization code to continue.
        </p>
        <div>
          <Label>Authorization Code</Label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
            />
          </div>
        </div>
        <FieldError message={error ?? undefined} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmWithCode} loading={loading}>
            Delete Booking
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Printable invoice
// ---------------------------------------------------------------------------
export function InvoiceDialog({ booking, onClose }: { booking: BookingWithRelations | null; onClose: () => void }) {
  const [addOns, setAddOns] = React.useState<BookingService[]>([]);

  React.useEffect(() => {
    if (!booking) return;
    supabase
      .from("booking_services")
      .select("*")
      .eq("booking_id", booking.id)
      .then(({ data }) => setAddOns((data as BookingService[]) ?? []));
  }, [booking]);

  if (!booking) return null;

  const addOnsTotal = addOns.reduce((sum, a) => sum + a.unit_price * a.quantity, 0);
  const roomCharge = Math.max(booking.total_amount - addOnsTotal, 0);
  const ratePerNight = booking.nights > 0 ? roomCharge / booking.nights : roomCharge;

  return (
    <Dialog open={!!booking} onClose={onClose} title="Invoice" className="max-w-lg">
      <div id="invoice-print" className="space-y-5 text-sm">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight text-slate-900">Jikmis Apartment</p>
              <p className="text-xs text-slate-400">Front Desk · Booking Invoice</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Invoice For</p>
            <p className="font-semibold text-slate-900">{booking.booking_number}</p>
            <p className="text-xs text-slate-400">{formatDate(booking.created_at)}</p>
          </div>
        </div>

        {/* Billed to / stay details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Billed To</p>
            <Info label="Guest" value={booking.guest?.full_name} />
            <div className="mt-2">
              <Info label="Phone" value={booking.guest?.phone ?? "—"} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Stay Details</p>
            <Info label="Room" value={`${booking.room?.room_number} · ${booking.room?.room_type}`} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Info label="Check-in" value={formatDate(booking.check_in)} />
              <Info label="Check-out" value={formatDate(booking.check_out)} />
            </div>
          </div>
        </div>

        {/* Itemized charges */}
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 text-slate-700">
                  Room Charge <span className="text-xs text-slate-400">({formatCurrency(ratePerNight)}/night)</span>
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{booking.nights}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(roomCharge)}</td>
              </tr>
              {addOns.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-slate-700">{a.name}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{a.quantity}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(a.unit_price * a.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex justify-between">
            <span className="text-slate-500">Total Amount</span>
            <span className="font-medium text-slate-800">{formatCurrency(booking.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-medium text-slate-800">{formatCurrency(booking.advance_paid)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
            <span>Balance Due</span>
            <span className="text-brand-600">{formatCurrency(booking.remaining_balance)}</span>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">Thank you for staying with Jikmis Apartment!</p>
      </div>
      <div className="mt-5 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
    </Dialog>
  );
}
