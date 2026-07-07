import * as React from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
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

// ---------------------------------------------------------------------------
// View booking details + payment history
// ---------------------------------------------------------------------------
export function BookingDetailDialog({
  booking,
  onClose,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
}) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [addOns, setAddOns] = React.useState<BookingService[]>([]);

  React.useEffect(() => {
    if (!booking) return;
    supabase
      .from("transactions")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
    supabase
      .from("booking_services")
      .select("*")
      .eq("booking_id", booking.id)
      .then(({ data }) => setAddOns((data as BookingService[]) ?? []));
  }, [booking]);

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

        {booking.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Notes</p>
            <p className="mt-1 text-sm text-slate-700">{booking.notes}</p>
          </div>
        )}

        {addOns.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-slate-400">Services & Add-ons</p>
            <ul className="space-y-1.5">
              {addOns.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {a.name} {a.quantity > 1 ? `× ${a.quantity}` : ""}
                  </span>
                  <span className="font-medium text-slate-900">{formatCurrency(a.unit_price * a.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400">Payment History</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 capitalize">{t.transaction_type} · {PAYMENT_METHOD_LABELS[t.payment_method]}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(t.created_at)}</p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(t.amount)}</p>
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
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value ?? "—"}</p>
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

      await supabase.from("rooms").update({ status: "cleaning" }).eq("id", booking.room_id);

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
        <p className="text-sm text-slate-600">
          {booking.guest?.full_name} · Room {booking.room?.room_number}
        </p>

        {booking.remaining_balance > 0 ? (
          <>
            <div>
              <Label>Collect Remaining Payment</Label>
              <Input type="number" min={0} max={booking.remaining_balance} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <p className="mt-1 text-xs text-slate-400">Outstanding balance: {formatCurrency(booking.remaining_balance)}</p>
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
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Fully paid — no balance due.</p>
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
  const [loading, setLoading] = React.useState(false);
  if (!booking) return null;

  const confirmDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
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

// ---------------------------------------------------------------------------
// Printable invoice
// ---------------------------------------------------------------------------
export function InvoiceDialog({ booking, onClose }: { booking: BookingWithRelations | null; onClose: () => void }) {
  if (!booking) return null;

  return (
    <Dialog open={!!booking} onClose={onClose} title="Invoice" className="max-w-md">
      <div id="invoice-print" className="space-y-4 text-sm">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Jikmis Apartment</p>
          <p className="text-slate-500">Booking Invoice</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Info label="Booking #" value={booking.booking_number} />
          <Info label="Date" value={formatDate(booking.created_at)} />
          <Info label="Guest" value={booking.guest?.full_name} />
          <Info label="Phone" value={booking.guest?.phone ?? "—"} />
          <Info label="Room" value={`${booking.room?.room_number} (${booking.room?.room_type})`} />
          <Info label="Nights" value={String(booking.nights)} />
          <Info label="Check-in" value={formatDate(booking.check_in)} />
          <Info label="Check-out" value={formatDate(booking.check_out)} />
        </div>
        <div className="border-t border-dashed border-slate-200 pt-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Total Amount</span>
            <span className="font-medium">{formatCurrency(booking.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-medium">{formatCurrency(booking.advance_paid)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Balance Due</span>
            <span>{formatCurrency(booking.remaining_balance)}</span>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400">Thank you for staying with us!</p>
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
