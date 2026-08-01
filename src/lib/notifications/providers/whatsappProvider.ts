import type { NotificationProvider, NotificationPayload, NotificationResult } from "../types";

// ----------------------------------------------------------------------------
// WhatsApp provider — STUB, same shape as smsProvider.ts. Swap in the
// WhatsApp Business API (or a BSP like Gupshup/Twilio) here when ready; the
// rest of the app never needs to change since it only depends on
// NotificationProvider.
// ----------------------------------------------------------------------------
export const whatsappProvider: NotificationProvider = {
  name: "whatsapp-stub",
  channel: "whatsapp",
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "WhatsApp provider not configured yet. Add the WhatsApp Business API in whatsappProvider.ts to enable delivery.",
    };
  },
};
