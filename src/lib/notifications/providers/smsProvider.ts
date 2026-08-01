import type { NotificationProvider, NotificationPayload, NotificationResult } from "../types";

// ----------------------------------------------------------------------------
// SMS provider — STUB. No SMS gateway (Twilio, Sparrow SMS, etc.) is
// configured yet, so this deliberately fails every send with a clear reason
// rather than pretending to succeed. Once a real account is set up, replace
// the body of send() with an actual API call — nothing else in the app
// (NotificationService, the approve/reject dialogs, the retry button) needs
// to change, since they only depend on the NotificationProvider interface.
// ----------------------------------------------------------------------------
export const smsProvider: NotificationProvider = {
  name: "sms-stub",
  channel: "sms",
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "SMS provider not configured yet. Add an SMS gateway (e.g. Twilio, Sparrow SMS) in smsProvider.ts to enable delivery.",
    };
  },
};
