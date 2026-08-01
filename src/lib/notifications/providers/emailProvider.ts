import { supabase } from "@/lib/supabase";
import type { NotificationProvider, NotificationPayload, NotificationResult } from "../types";

// ----------------------------------------------------------------------------
// Email provider — delivers via the `send-email` Supabase Edge Function,
// which sends through Gmail SMTP using the official jikmisdonkhang@gmail.com
// account. The Gmail App Password never touches this file or the browser
// bundle: it lives only in the edge function's environment (Supabase Edge
// Function secrets), read there via Deno.env.get(). This file just invokes
// the function with a staff-authenticated request and reports the outcome.
// ----------------------------------------------------------------------------
export const emailProvider: NotificationProvider = {
  name: "gmail-smtp",
  channel: "email",
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.subject) {
      return { success: false, error: "Missing email subject" };
    }

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to: payload.to, subject: payload.subject, message: payload.message },
    });

    if (error) {
      return { success: false, error: error.message ?? "Failed to reach the email service" };
    }

    if (!data?.ok) {
      return { success: false, error: data?.error ?? "Email delivery failed" };
    }

    return { success: true };
  },
};
