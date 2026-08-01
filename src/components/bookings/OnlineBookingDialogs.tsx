import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Pencil, TrendingDown, IdCard, RotateCw, Bell } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useBookingPrice } from "@/hooks/useBookingPrice";
import { formatCurrency, formatDate, formatDateTime, nightsBetween, todayISO, addDaysISO } from "@/lib/utils";
import { BOOKING_SOURCE_LABELS, PRICING_METHOD_LABELS, REJECTION_REASON_PRESETS } from "@/lib/constants";
import { bookingStatusTone, paymentStatusTone, notificationStatusTone } from "@/lib/badge-tones";
import { sendNotification, retryNotification, getLatestNotificationForBooking } from "@/lib/notifications/NotificationService";
import type { BookingWithRelations, Room, NotificationLog } from "@/lib/database.types";

/** Best-effort device string for the audit trail — a real client IP can only
 *  be captured server-side (trusted proxy headers), so that field stays
 *  optional/empty for now; this covers the "device" half of "Optional IP
 *  Address, Optional Device" from the spec. */
function deviceInfo() {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent.slice(0, 300);
}

/** Fires after approve/reject succeeds: looks up the notification_log row
 *  that RPC just queued, attempts delivery through NotificationService, and
 *  returns a toast-ready summary. Never throws — a failed send is an
 *  expected, normal outcome (no provider is configured yet), not an error
 *  in the approve/reject flow itself. */
async function dispatchAndDescribe(bookingId: string): Promise<{ notification: NotificationLog | null; sent: boolean }> {
  const notification = await getLatestNotificationForBooking(bookingId);
  if (!notification) return { notification: null, sent: false };
  const outcome = await sendNotification(notification);
  return { notification: { ...notification, status: outcome.status }, sent: outcome.status === "sent" };
}

export function NotificationStatusBadge({ status }: { status: NotificationLog["status"] }) {
  const label = status === "sent" ? "Notification Sent" : status === "failed" ? "Notification Failed" : status === "retrying" ? "Pending Retry" : "Notification Pending";
  return (
    <Badge tone={notificationStatusTone(status)} className="w-fit">
      {label}
    </Badge>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value ?? "—"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification history for one booking — every attempt, with a Retry
// action on whatever's currently 'failed'. This is the "complete
// notification history" view the spec asks for, scoped to the booking
// being reviewed (the Notifications tab on the list page covers the
// across-all-bookings view).
// ---------------------------------------------------------------------------
function NotificationHistorySection({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = React.useState<NotificationLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase
      .from("notification_log")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    setRows((data as NotificationLog[]) ?? []);
    setLoading(false);
  }, [bookingId]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRetry = async (row: NotificationLog) => {
    setRetryingId(row.id);
    const outcome = await retryNotification(row);
    setRetryingId(null);
    if (outcome.status === "sent") {
      toast.success("Notification delivered on retry.");
    } else {
      toast.warning(`Retry failed: ${outcome.failureReason ?? "delivery unsuccessful"}`);
    }
    load();
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <Bell className="h-3.5 w-3.5" /> Notification History
      </p>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <NotificationStatusBadge status={row.status} />
              <span className="capitalize text-slate-500">{row.channel}</span>
            </div>
            <p className="mt-0.5 truncate text-slate-400">
              {row.status === "sent" && row.sent_at ? `Sent ${formatDateTime(row.sent_at)}` : row.failure_reason ?? "Queued for delivery"}
            </p>
          </div>
          {row.status === "failed" && (
            <Button size="sm" variant="outline" onClick={() => handleRetry(row)} loading={retryingId === row.id}>
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail view — read-only summary + entry points into Approve/Reject/Modify
// ---------------------------------------------------------------------------
export function OnlineBookingDetailDialog({
  booking,
  onClose,
  onApprove,
  onReject,
  onModify,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onApprove: (b: BookingWithRelations) => void;
  onReject: (b: BookingWithRelations) => void;
  onModify: (b: BookingWithRelations) => void;
}) {
  if (!booking) return null;
  const isPending = booking.booking_status === "pending_approval";

  return (
    <Dialog open={!!booking} onClose={onClose} title={booking.booking_number} description="Online booking request" className="max-w-lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={bookingStatusTone(booking.booking_status)} className="capitalize">
            {booking.booking_status.replace("_", " ")}
          </Badge>
          <Badge tone={paymentStatusTone(booking.payment_status)} className="capitalize">
            {booking.payment_status}
          </Badge>
          {booking.pricing_method && (
            <Badge tone="slate" className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> {PRICING_METHOD_LABELS[booking.pricing_method]}
            </Badge>
          )}
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
          <Info label="Pricing Method" value={booking.pricing_method ? PRICING_METHOD_LABELS[booking.pricing_method] : "—"} />
          <Info label="Calculated Total" value={formatCurrency(booking.total_amount)} />
          <Info label="Payment Status" value={<span className="capitalize">{booking.payment_status}</span>} />
          <Info label="Booking Status" value={<span className="capitalize">{booking.booking_status.replace("_", " ")}</span>} />
        </div>

        {booking.guest?.nationality && <Info label="Nationality" value={booking.guest.nationality} />}
        {booking.guest?.passport_number && <Info label="Passport / ID" value={booking.guest.passport_number} />}

        {booking.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Special Notes</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{booking.notes}</p>
          </div>
        )}

        {booking.booking_status === "rejected" && booking.rejection_reason && (
          <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide">Rejection Reason</p>
            <p className="mt-0.5">{booking.rejection_reason}</p>
            {booking.rejected_by_name && <p className="mt-1 text-xs text-red-500">Rejected by {booking.rejected_by_name}</p>}
          </div>
        )}

        {booking.booking_status === "confirmed" && booking.approved_at && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved {formatDate(booking.approved_at)}
            {booking.approved_by_name && ` by ${booking.approved_by_name}`}
          </p>
        )}

        <p className="flex items-center gap-1 text-xs text-slate-400">
          <IdCard className="h-3 w-3" /> Guest-submitted request — no ID photo attached from the website.
        </p>

        {booking.booking_status !== "pending_approval" && <NotificationHistorySection bookingId={booking.id} />}

        {isPending && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => onModify(booking)}>
              <Pencil className="h-3.5 w-3.5" /> Modify
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onReject(booking)}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button size="sm" onClick={() => onApprove(booking)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Approve — flips status to 'confirmed'; the exclusion constraint (same one
// reception bookings rely on) blocks the approval if another confirmed
// booking already overlaps these dates.
// ---------------------------------------------------------------------------
export function ApproveBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setError(null), [booking]);

  if (!booking) return null;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("approve_booking", { p_booking_id: booking.id, p_device: deviceInfo() });
    if (rpcError) {
      setSaving(false);
      setError(rpcError.message);
      return;
    }
    const { sent } = await dispatchAndDescribe(booking.id);
    setSaving(false);
    if (sent) {
      toast.success(`Booking successfully approved. Confirmation message sent to ${booking.guest?.full_name ?? "the guest"}.`);
    } else {
      toast.warning("Booking updated successfully. Notification delivery failed — retry from the booking's detail view.");
    }
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title="Approve Booking Request" description={booking.booking_number} className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {booking.guest?.full_name} · Room {booking.room?.room_number} · {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
        </p>
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10">
          This will confirm the booking, notify the guest, and update room availability.
        </div>
        <FieldError message={error ?? undefined} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={saving}>
            <CheckCircle2 className="h-4 w-4" /> Approve Booking
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reject — requires a reason, matching the templated guest notification.
// ---------------------------------------------------------------------------
export function RejectBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [preset, setPreset] = React.useState(REJECTION_REASON_PRESETS[0]);
  const [customReason, setCustomReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPreset(REJECTION_REASON_PRESETS[0]);
    setCustomReason("");
    setError(null);
  }, [booking]);

  if (!booking) return null;

  const isOther = preset === "Other";
  const reason = isOther ? customReason.trim() : preset;

  const confirm = async () => {
    setError(null);
    if (!reason || reason.length < 2) {
      setError("Enter a reason for this rejection");
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("reject_booking", { p_booking_id: booking.id, p_reason: reason, p_device: deviceInfo() });
    if (rpcError) {
      setSaving(false);
      setError(rpcError.message);
      return;
    }
    const { sent } = await dispatchAndDescribe(booking.id);
    setSaving(false);
    if (sent) {
      toast.success(`Booking successfully rejected. Cancellation message sent to ${booking.guest?.full_name ?? "the guest"}.`);
    } else {
      toast.warning("Booking updated successfully. Notification delivery failed — retry from the booking's detail view.");
    }
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title="Reject Booking Request" description={booking.booking_number} className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {booking.guest?.full_name} · Room {booking.room?.room_number}
        </p>
        <div>
          <Label>Reason</Label>
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {REJECTION_REASON_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        {isOther && (
          <div>
            <Label>Details</Label>
            <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Explain why this request can't be approved" />
          </div>
        )}
        <FieldError message={error ?? undefined} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} loading={saving}>
            <XCircle className="h-4 w-4" /> Reject Booking
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Modify — change room/check-in/check-out on a pending request before
// deciding; total_amount is always recalculated by the shared
// calculate_booking_price() engine, never hand-typed here.
// ---------------------------------------------------------------------------
export function ModifyBookingStayDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomId, setRoomId] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!booking) return;
    setRoomId(booking.room_id);
    setCheckIn(booking.check_in);
    setCheckOut(booking.check_out);
    setError(null);
    supabase
      .from("rooms")
      .select("*")
      .order("room_number")
      .then(({ data }) => setRooms((data as Room[]) ?? []));
  }, [booking]);

  const nights = nightsBetween(checkIn, checkOut);
  const { quote } = useBookingPrice(roomId || undefined, checkIn, checkOut);

  if (!booking) return null;

  const save = async () => {
    setError(null);
    if (!roomId) {
      setError("Select a room");
      return;
    }
    if (nights <= 0) {
      setError("Check-out must be after check-in");
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("modify_booking_stay", {
      p_booking_id: booking.id,
      p_room_id: roomId,
      p_check_in: checkIn,
      p_check_out: checkOut,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Booking updated — price recalculated automatically");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!booking} onClose={onClose} title="Modify Booking" description={booking.booking_number} className="max-w-md">
      <div className="space-y-4">
        <div>
          <Label>Room</Label>
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id} disabled={r.status === "maintenance"}>
                {r.room_number} · {r.room_type} · {formatCurrency(r.price)}/night
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Check-in</Label>
            <Input type="date" min={todayISO()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <Label>Check-out</Label>
            <Input type="date" min={addDaysISO(checkIn || todayISO(), 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>

        {quote && (
          <div className="space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500">
              <span>{nights} night{nights === 1 ? "" : "s"} · {PRICING_METHOD_LABELS[quote.pricing_method]}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(quote.total_amount)}</span>
            </div>
            {quote.pricing_method === "monthly" && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <TrendingDown className="h-3 w-3" /> Long-term apartment pricing applied automatically
                {quote.long_term_daily_rate != null && ` — ${formatCurrency(quote.long_term_daily_rate)}/night`}
              </p>
            )}
          </div>
        )}

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
