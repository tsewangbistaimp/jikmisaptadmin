// Supabase Edge Function: notify-new-booking
//
// Emails jikmisdonkhang@gmail.com a brief heads-up whenever a guest submits
// a new booking on the website — separate from the guest-facing approve/
// reject templates (send-email), and separate from the admin dashboard's
// realtime popup, so staff still hear about a new request even if nobody
// has the dashboard open. Deliberately brief (guest name, room, dates,
// booking number) — NOT the full booking detail, per spec.
//
// Called by the guest website right after create_public_booking() succeeds,
// so it has to accept anonymous callers (a guest has no staff session).
// That means it can't trust anything from the request body except which
// booking to look up — every actual detail in the email is read straight
// from the database with a service-role client, never taken from the
// caller, so there's nothing here an anonymous caller could inject or
// forge into the email content.
//
// Reuses the same Gmail SMTP secrets as send-email (SMTP_HOST/PORT/USER/
// PASS/FROM_NAME/FROM_EMAIL) — no new secrets needed, no new deploy step
// beyond `supabase functions deploy notify-new-booking`.
//
// Body: { booking_id: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const STAFF_ALERT_RECIPIENT = "jikmisdonkhang@gmail.com";
const RECENT_WINDOW_MS = 15 * 60 * 1000; // only alert for bookings made in the last 15 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id: bookingId } = await req.json();
    if (!bookingId || typeof bookingId !== "string") {
      return json({ error: "booking_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey);

    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .select("id, booking_number, booking_status, check_in, check_out, created_at, guest_id, room_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return json({ error: "Booking not found" }, 200);
    }

    // Anti-abuse: only ever alert for a booking that's genuinely a fresh
    // pending request, not an arbitrary/old booking ID someone could replay
    // to spam the inbox.
    if (booking.booking_status !== "pending_approval") {
      return json({ error: "Booking is not pending approval" }, 200);
    }
    const ageMs = Date.now() - new Date(booking.created_at).getTime();
    if (ageMs > RECENT_WINDOW_MS) {
      return json({ error: "Booking is too old for a new-booking alert" }, 200);
    }

    // Idempotent — a retry (or a duplicate call) for the same booking must
    // not send a second alert.
    const { data: existingAlert } = await db
      .from("notification_log")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("template", "new_booking_alert")
      .limit(1)
      .maybeSingle();
    if (existingAlert) {
      return json({ ok: true, alreadySent: true }, 200);
    }

    const [{ data: guest }, { data: room }] = await Promise.all([
      db.from("guests").select("full_name").eq("id", booking.guest_id).maybeSingle(),
      db.from("rooms").select("room_number, room_type").eq("id", booking.room_id).maybeSingle(),
    ]);

    const subject = "New Online Booking Request – Jikmis Apartment";
    const message = [
      `New online booking request received.`,
      ``,
      `Booking No: ${booking.booking_number}`,
      `Guest: ${guest?.full_name ?? "Guest"}`,
      `Room: ${room ? `${room.room_number} · ${room.room_type}` : "—"}`,
      `Dates: ${booking.check_in} to ${booking.check_out}`,
      ``,
      `Review and approve/reject it from Online Bookings in the admin dashboard.`,
    ].join("\n");

    const { data: logRow, error: logInsertError } = await db
      .from("notification_log")
      .insert({
        booking_id: bookingId,
        guest_id: booking.guest_id,
        channel: "email",
        template: "new_booking_alert",
        recipient: STAFF_ALERT_RECIPIENT,
        subject,
        message,
        status: "pending",
      })
      .select("id")
      .single();

    if (logInsertError || !logRow) {
      console.error("notify-new-booking: failed to insert notification_log row:", logInsertError);
      return json({ error: "Couldn't queue the alert" }, 200);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Jikmis Apartment";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? smtpUser;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      await db
        .from("notification_log")
        .update({ status: "failed", failure_reason: "Gmail SMTP is not configured (SMTP_* secrets missing)." })
        .eq("id", logRow.id);
      return json({ error: "Gmail SMTP is not configured yet." }, 200);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: STAFF_ALERT_RECIPIENT,
        subject,
        text: message,
      });
      await db
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider: "gmail-smtp" })
        .eq("id", logRow.id);
      return json({ ok: true }, 200);
    } catch (smtpErr) {
      console.error("notify-new-booking SMTP failure:", smtpErr);
      await db
        .from("notification_log")
        .update({ status: "failed", failure_reason: `SMTP error: ${(smtpErr as Error).message ?? "unknown"}`, provider: "gmail-smtp" })
        .eq("id", logRow.id);
      return json({ error: "Failed to send the alert email" }, 200);
    }
  } catch (err) {
    console.error("notify-new-booking failure:", err);
    return json({ error: (err as Error).message ?? "Failed to process the alert" }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
