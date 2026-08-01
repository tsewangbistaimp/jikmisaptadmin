import type { NotificationProvider, NotificationPayload, NotificationResult } from "../types";

// ----------------------------------------------------------------------------
// Email provider — STUB, same shape as smsProvider.ts. Swap in Gmail SMTP,
// SendGrid, Resend, etc. here when ready. Note: guests.email is currently
// always null (no booking form collects it yet), so in practice this
// provider won't be invoked until that's added — the column and this
// provider exist so that's a frontend-only change when the time comes.
// ----------------------------------------------------------------------------
export const emailProvider: NotificationProvider = {
  name: "email-stub",
  channel: "email",
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "Email provider not configured yet. Add an email service (e.g. Gmail SMTP, SendGrid) in emailProvider.ts to enable delivery.",
    };
  },
};
