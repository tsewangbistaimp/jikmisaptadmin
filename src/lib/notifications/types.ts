import type { NotificationChannel } from "@/lib/database.types";

export interface NotificationPayload {
  to: string;
  message: string;
  /** Only meaningful for the email channel; ignored elsewhere. */
  subject?: string;
}

export interface NotificationResult {
  success: boolean;
  /** Human-readable reason on failure — shown to staff and stored on the
   *  notification_log row so a future maintainer knows exactly why a send
   *  failed without digging through logs. */
  error?: string;
}

/** Every channel's provider implements this one interface. The booking
 *  workflow (approve/reject dialogs) never imports a provider directly or
 *  knows which one is in use — it only ever talks to NotificationService,
 *  so swapping SMSProvider's stub for a real Twilio/Sparrow SMS integration
 *  later is a one-file change with zero impact on booking logic. */
export interface NotificationProvider {
  /** Machine-readable name stored on notification_log.provider, e.g. "twilio". */
  name: string;
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
