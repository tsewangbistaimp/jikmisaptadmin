import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  TrendingDown,
  IdCard,
  RotateCw,
  Bell,
  Mail,
  Phone as PhoneIcon,
  ImagePlus,
  ImageOff,
  Wallet,
  RefreshCcw,
  StickyNote,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useBookingPrice } from "@/hooks/useBookingPrice";
import { formatCurrency, formatDate, formatDateTime, nightsBetween, todayISO, addDaysISO } from "@/lib/utils";
import { BOOKING_SOURCE_LABELS, PRICING_METHOD_LABELS, REJECTION_REASON_PRESETS, PAYMENT_METHOD_LABELS, BOOKING_STATUS_LABELS } from "@/lib/constants";
import { bookingStatusTone, paymentStatusTone, notificationStatusTone } from "@/lib/badge-tones";
import { sendNotification, retryNotification, getPendingNotificationsForBooking } from "@/lib/notifications/NotificationService";
import type { BookingWithRelations, Room, NotificationLog, PaymentMethod } from "@/lib/database.types";

const GMAIL_SENDER = "jikmisdonkhang@gmail.com";

/** Best-effort device string for the audit trail — a real client IP can only
 *  be captured server-side (trusted proxy headers), so that field stays
 *  optional/empty for now; this covers the "device" half of "Optional IP
 *  Address, Optional Device" from the spec. */
function deviceInfo() {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent.slice(0, 300);
}

interface DispatchSummary {
  /** Outcome of the 'email' channel row, if the guest gave an address —
   *  undefined when no email notification was queued at all. */
  email?: { sent: boolean };
  /** Outcome of the 'sms' channel row (always queued by approve/reject). */
  sms: { sent: boolean };
}

/** Fires after approve/reject succeeds: looks up every notification_log row
 *  that RPC just queued (sms always, email when the guest gave an address)
 *  and attempts delivery through NotificationService for each. Never
 *  throws — a failed send is an expected, normal outcome, not an error in
 *  the approve/reject flow itself; per spec, delivery failure must never
 *  roll back the booking decision that already succeeded. */
async function dispatchAndDescribe(bookingId: string): Promise<DispatchSummary> {
  const pending = await getPendingNotificationsForBooking(bookingId);
  const summary: DispatchSummary = { sms: { sent: false } };

  for (const notification of pending) {
    const outcome = await sendNotification(notification);
    if (notification.channel === "email") {
      summary.email = { sent: outcome.status === "sent" };
    } else if (notification.channel === "sms") {
      summary.sms = { sent: outcome.status === "sent" };
    }
  }

  return summary;
}

/** Builds the exact toast wording the spec calls for. When the guest gave an
 *  email, the email outcome drives the message (naming the Gmail sender
 *  explicitly); otherwise falls back to the SMS-oriented wording used before
 *  email support existed. */
function describeDispatch(summary: DispatchSummary, action: "approved" | "rejected", guestName: string): { kind: "success" | "warning"; text: string } {
  if (summary.email) {
    if (summary.email.sent) {
      const noun = action === "approved" ? "Confirmation" : "Rejection";
      return { kind: "success", text: `✅ Booking successfully ${action}. ${noun} email sent from ${GMAIL_SENDER}.` };
    }
    return { kind: "warning", text: "⚠ Booking updated successfully. Email delivery failed. Retry available." };
  }

  if (summary.sms.sent) {
    return { kind: "success", text: `Booking successfully ${action}. Confirmation message sent to ${guestName}.` };
  }
  return { kind: "warning", text: "Booking updated successfully. Notification delivery failed — retry from the booking's detail view." };
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
// Verification status — Email Verified / Phone Verified / Verification Time.
// phone_verified is always false today (no SMS/OTP provider configured
// yet) and is shown honestly as "Not Verified" rather than hidden.
// ---------------------------------------------------------------------------
function VerificationStatus({ booking }: { booking: BookingWithRelations }) {
  if (booking.booking_source !== "website") return null;
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Verification Status
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={booking.email_verified ? "green" : "red"} className="flex items-center gap-1">
          <Mail className="h-3 w-3" /> Email {booking.email_verified ? "Verified" : "Not Verified"}
        </Badge>
        <Badge tone={booking.phone_verified ? "green" : "slate"} className="flex items-center gap-1">
          <PhoneIcon className="h-3 w-3" /> Phone {booking.phone_verified ? "Verified" : "Not Verified"}
        </Badge>
      </div>
      {booking.verified_at && <p className="text-xs text-slate-400">Verified {formatDateTime(booking.verified_at)}</p>}
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
  onReviewPayment,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onApprove: (b: BookingWithRelations) => void;
  onReject: (b: BookingWithRelations) => void;
  onModify: (b: BookingWithRelations) => void;
  onReviewPayment: (b: BookingWithRelations) => void;
}) {
  if (!booking) return null;
  const isPending = booking.booking_status === "pending_approval";
  const isPaymentReview = booking.booking_status === "payment_under_review";

  return (
    <Dialog open={!!booking} onClose={onClose} title={booking.booking_number} description="Online booking request" className="max-w-lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={bookingStatusTone(booking.booking_status)}>
            {BOOKING_STATUS_LABELS[booking.booking_status] ?? booking.booking_status}
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
          <Info label="Booking Status" value={BOOKING_STATUS_LABELS[booking.booking_status] ?? booking.booking_status} />
        </div>

        {booking.guest?.nationality && <Info label="Nationality" value={booking.guest.nationality} />}
        {booking.guest?.passport_number && <Info label="Passport / ID" value={booking.guest.passport_number} />}

        <VerificationStatus booking={booking} />

        {(booking.payment_verified_at || booking.payment_screenshot_path) && (
          <div className="space-y-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-500/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <Wallet className="h-3.5 w-3.5" /> Payment Verification
            </p>
            {booking.payment_verified_at && (
              <p className="text-xs text-emerald-700">
                Verified {formatDateTime(booking.payment_verified_at)}
                {booking.payment_verified_by_name && ` by ${booking.payment_verified_by_name}`}
              </p>
            )}
          </div>
        )}

        {booking.admin_notes && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
              <StickyNote className="h-3 w-3" /> Internal Notes
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{booking.admin_notes}</p>
          </div>
        )}

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

        {isPaymentReview && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button size="sm" onClick={() => onReviewPayment(booking)}>
              <Wallet className="h-3.5 w-3.5" /> Review Payment
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Approve — legitimacy review only. Moves the request to
// 'payment_under_review' (NOT 'confirmed' — the room stays unreserved until
// staff verifies the 50% advance payment via Review Payment). No guest
// notification is sent here: the guest already received the payment-
// instructions email immediately at submission time.
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
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Booking approved — now awaiting advance payment verification.");
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
          This approves the request and moves it to Payment Under Review. The room is only reserved once you verify the guest's
          advance payment from the Payment Review screen.
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
    const summary = await dispatchAndDescribe(booking.id);
    setSaving(false);
    const { kind, text } = describeDispatch(summary, "rejected", booking.guest?.full_name ?? "the guest");
    toast[kind](text);
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
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load rooms: " + error.message);
        setRooms((data as Room[]) ?? []);
      });
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

// ---------------------------------------------------------------------------
// Payment Review — for bookings in 'payment_under_review'. Staff upload the
// guest's WhatsApp-sent payment screenshot, pick the payment method, add
// optional internal notes, then Approve Payment (reserves the room + sends
// the confirmation email), Reject Payment (rejects the booking outright), or
// Request New Screenshot (asks the guest to resend, stays in review).
// ---------------------------------------------------------------------------
export function PaymentReviewDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [screenshotPath, setScreenshotPath] = React.useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("bank_transfer");
  const [notes, setNotes] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");
  const [showRejectReason, setShowRejectReason] = React.useState(false);
  const [saving, setSaving] = React.useState<"approve" | "reject" | "request" | "notes" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setScreenshotPath(booking?.payment_screenshot_path ?? null);
    setNotes(booking?.admin_notes ?? "");
    setPaymentMethod("bank_transfer");
    setRejectReason("");
    setShowRejectReason(false);
    setError(null);
  }, [booking]);

  React.useEffect(() => {
    if (!screenshotPath) {
      setScreenshotUrl(null);
      return;
    }
    supabase.storage
      .from("payment-screenshots")
      .createSignedUrl(screenshotPath, 3600)
      .then(({ data }) => setScreenshotUrl(data?.signedUrl ?? null));
  }, [screenshotPath]);

  if (!booking) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be smaller than 8MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${booking.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("payment-screenshots").upload(path, file);
    setUploading(false);
    if (uploadError) {
      toast.error(uploadError.message);
      return;
    }
    setScreenshotPath(path);
    toast.success("Screenshot uploaded");
  };

  const saveNotesOnly = async () => {
    setSaving("notes");
    setError(null);
    const { error: rpcError } = await supabase.rpc("admin_update_booking_note", { p_booking_id: booking.id, p_note: notes || null });
    setSaving(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Notes saved");
    onDone();
  };

  const approve = async () => {
    setSaving("approve");
    setError(null);
    const { error: rpcError } = await supabase.rpc("approve_payment", {
      p_booking_id: booking.id,
      p_payment_screenshot_path: screenshotPath,
      p_payment_method: paymentMethod,
      p_notes: notes || null,
      p_device: deviceInfo(),
    });
    if (rpcError) {
      setSaving(null);
      setError(rpcError.message);
      return;
    }
    const summary = await dispatchAndDescribe(booking.id);
    setSaving(null);
    const { kind, text } = describeDispatch(summary, "approved", booking.guest?.full_name ?? "the guest");
    toast[kind](text);
    onDone();
    onClose();
  };

  const reject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 2) {
      setShowRejectReason(true);
      setError("Enter a reason for rejecting this payment");
      return;
    }
    setSaving("reject");
    setError(null);
    const { error: rpcError } = await supabase.rpc("reject_payment", {
      p_booking_id: booking.id,
      p_reason: rejectReason.trim(),
      p_payment_screenshot_path: screenshotPath,
      p_device: deviceInfo(),
    });
    if (rpcError) {
      setSaving(null);
      setError(rpcError.message);
      return;
    }
    const summary = await dispatchAndDescribe(booking.id);
    setSaving(null);
    const { kind, text } = describeDispatch(summary, "rejected", booking.guest?.full_name ?? "the guest");
    toast[kind](text);
    onDone();
    onClose();
  };

  const requestNew = async () => {
    setSaving("request");
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_new_payment_screenshot", {
      p_booking_id: booking.id,
      p_note: notes || null,
      p_device: deviceInfo(),
    });
    if (rpcError) {
      setSaving(null);
      setError(rpcError.message);
      return;
    }
    const summary = await dispatchAndDescribe(booking.id);
    setSaving(null);
    if (summary.email?.sent) {
      toast.success("Guest notified to resend a payment screenshot.");
    } else {
      toast.warning("Saved — but the guest notification email failed to send. You can retry from Notifications.");
    }
    setScreenshotPath(null);
    onDone();
  };

  const advance = Math.round(booking.total_amount * 0.5);

  return (
    <Dialog open={!!booking} onClose={onClose} title="Review Payment" description={booking.booking_number} className="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {booking.guest?.full_name} · Room {booking.room?.room_number} · Total {formatCurrency(booking.total_amount)}
        </p>
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10">
          50% advance due: <span className="font-semibold">{formatCurrency(advance)}</span>. Guest sends the screenshot via
          WhatsApp — upload it below once you've received it.
        </div>

        <div>
          <Label>Payment Screenshot (optional)</Label>
          {screenshotUrl ? (
            <a
              href={screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <img src={screenshotUrl} alt="Payment screenshot" className="max-h-64 w-full bg-slate-50 object-contain dark:bg-slate-900" />
            </a>
          ) : (
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400 dark:border-slate-700">
              <ImageOff className="h-4 w-4" /> No screenshot uploaded yet
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <ImagePlus className="h-3.5 w-3.5" /> {screenshotUrl ? "Replace Screenshot" : "Upload Screenshot"}
          </Button>
        </div>

        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Internal Notes</Label>
            <Button variant="ghost" size="sm" onClick={saveNotesOnly} loading={saving === "notes"}>
              <StickyNote className="h-3.5 w-3.5" /> Save Notes
            </Button>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Visible to staff only" />
        </div>

        {showRejectReason && (
          <div>
            <Label>Rejection Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder="Why is this payment being rejected?"
            />
          </div>
        )}

        <FieldError message={error ?? undefined} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={requestNew} loading={saving === "request"}>
            <RefreshCcw className="h-3.5 w-3.5" /> Request New Screenshot
          </Button>
          <Button variant="destructive" size="sm" onClick={reject} loading={saving === "reject"}>
            <XCircle className="h-3.5 w-3.5" /> Reject Payment
          </Button>
        
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve Payment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
