import { supabase } from "@/lib/supabase";
import type { NotificationLog } from "@/lib/database.types";
import type { NotificationProvider } from "./types";
import { smsProvider } from "./providers/smsProvider";
import { whatsappProvider } from "./providers/whatsappProvider";
import { emailProvider } from "./providers/emailProvider";

// The booking workflow (approve/reject dialogs) calls sendNotification() /
// retryNotification() and never touches a provider or the database write
// path directly — "DO NOT send SMS directly inside the booking controller,
// call NotificationService instead." Which provider actually runs is picked
// here, by channel, so adding a 4th channel or swapping a stub for a real
// integration never requires touching a booking component.
const PROVIDERS: Record<string, NotificationProvider> = {
  sms: smsProvider,
  whatsapp: whatsappProvider,
  email: emailProvider,
};

export interface SendOutcome {
  status: "sent" | "failed";
  provider: string;
  failureReason?: string;
}

/** Attempts to actually deliver a notification_log row that's currently
 *  'pending' or 'retrying', then writes the outcome back via the
 *  update_notification_status RPC (the only path allowed to mutate
 *  notification_log — see the migration). Always resolves, never throws:
 *  a delivery failure is a normal, expected outcome to show in the UI, not
 *  an exception. */
export async function sendNotification(notification: NotificationLog): Promise<SendOutcome> {
  const provider = PROVIDERS[notification.channel];
  if (!provider) {
    const outcome: SendOutcome = { status: "failed", provider: "unknown", failureReason: `No provider registered for channel "${notification.channel}"` };
    await persist(notification.id, outcome);
    return outcome;
  }

  if (!notification.recipient) {
    const outcome: SendOutcome = { status: "failed", provider: provider.name, failureReason: "Guest has no contact info on file for this channel" };
    await persist(notification.id, outcome);
    return outcome;
  }

  const result = await provider.send({
    to: notification.recipient,
    message: notification.message,
    subject: notification.subject ?? undefined,
  });
  const outcome: SendOutcome = result.success
    ? { status: "sent", provider: provider.name }
    : { status: "failed", provider: provider.name, failureReason: result.error ?? "Delivery failed" };

  await persist(notification.id, outcome);
  return outcome;
}

/** Bumps retry_count via the retry_notification RPC, then immediately tries
 *  sending again through the same channel's provider. */
export async function retryNotification(notification: NotificationLog): Promise<SendOutcome> {
  const { data, error } = await supabase.rpc("retry_notification", { p_notification_id: notification.id });
  if (error) {
    return { status: "failed", provider: notification.provider ?? "unknown", failureReason: error.message };
  }
  return sendNotification((data as NotificationLog) ?? notification);
}

async function persist(notificationId: string, outcome: SendOutcome) {
  await supabase.rpc("update_notification_status", {
    p_notification_id: notificationId,
    p_status: outcome.status,
    p_provider: outcome.provider,
    p_failure_reason: outcome.failureReason ?? null,
  });
}

/** Fetches the most recent notification_log row for a booking — used right
 *  after approve_booking()/reject_booking() succeeds, since those RPCs
 *  return the booking row, not the notification they just queued. */
export async function getLatestNotificationForBooking(bookingId: string): Promise<NotificationLog | null> {
  const { data } = await supabase
    .from("notification_log")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as NotificationLog) ?? null;
}

/** Fetches every notification_log row this approve/reject call just queued —
 *  approve_booking()/reject_booking() insert an 'sms' row always, plus an
 *  'email' row when the guest gave an address, so a single "latest" lookup
 *  isn't enough to dispatch both. Scoped to rows still 'pending' so a
 *  re-dispatch after this booking's history has been retried before doesn't
 *  re-send anything already sent/failed. */
export async function getPendingNotificationsForBooking(bookingId: string): Promise<NotificationLog[]> {
  const { data } = await supabase
    .from("notification_log")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as NotificationLog[]) ?? [];
}
