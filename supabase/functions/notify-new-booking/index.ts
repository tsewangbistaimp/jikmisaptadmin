// Supabase Edge Function: notify-new-booking
//
// Fires right after a guest's create_public_booking() call succeeds. Does
// two independent things:
//
//   1. Emails jikmisdonkhang@gmail.com a brief heads-up (guest name, room,
//      dates, booking number) — separate from the guest-facing templates
//      below, and separate from the admin dashboard's realtime popup, so
//      staff still hear about a new request even if nobody has the
//      dashboard open.
//   2. Emails the GUEST the "Booking Pending Confirmation" message — the
//      exact text from the verification/payment-review spec — with the
//      50% advance payment instructions (send a screenshot via WhatsApp to
//      +977 9708538395). This is the only guest-facing email at this
//      point; approve_booking() no longer sends one (see the
//      20260803000000 migration) since the guest already has everything
//      they need to act on right here.
//
// Called by the guest website right after create_public_booking() succeeds,
// so it has to accept anonymous callers (a guest has no staff session).
// That means it can't trust anything from the request body except which
// booking to look up — every actual detail in both emails is read straight
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
const WHATSAPP_PAYMENT_NUMBER = "+977 9708538395";
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
      .select("id, booking_number, booking_status, check_in, check_out, created_at, guest_id, room_id, total_amount")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return json({ error: "Booking not found" }, 200);
    }

    // Anti-abuse: only ever alert for a booking that's genuinely a fresh
    // pending request, not an arbitrary/old booking ID someone could replay
    // to spam an inbox.
    if (booking.booking_status !== "pending_approval") {
      return json({ error: "Booking is not pending approval" }, 200);
    }
    const ageMs = Date.now() - new Date(booking.created_at).getTime();
    if (ageMs > RECENT_WINDOW_MS) {
      return json({ error: "Booking is too old for a new-booking alert" }, 200);
    }

    const [{ data: guest }, { data: room }] = await Promise.all([
      db.from("guests").select("full_name, email").eq("id", booking.guest_id).maybeSingle(),
      db.from("rooms").select("room_number, room_type").eq("id", booking.room_id).maybeSingle(),
    ]);

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Jikmis Apartment";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? smtpUser;
    const smtpConfigured = !!(smtpHost && smtpPort && smtpUser && smtpPass && fromEmail);
    const transporter = smtpConfigured
      ? nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })
      : null;

    const results = await Promise.all([
      sendStaffAlert(db, transporter, smtpConfigured, fromName, fromEmail, booking, guest, room),
      sendGuestPendingConfirmation(db, transporter, smtpConfigured, fromName, fromEmail, booking, guest, room),
    ]);

    return json({ ok: true, staffAlert: results[0], guestEmail: results[1] }, 200);
  } catch (err) {
    console.error("notify-new-booking failure:", err);
    return json({ error: (err as Error).message ?? "Failed to process the alert" }, 200);
  }
});

// ----------------------------------------------------------------------------
// 1. Staff heads-up — unchanged behavior from before, just factored out.
// ----------------------------------------------------------------------------
async function sendStaffAlert(
  // deno-lint-ignore no-explicit-any
  db: any,
  transporter: nodemailer.Transporter | null,
  smtpConfigured: boolean,
  fromName: string,
  fromEmail: string | undefined,
  booking: { id: string; booking_number: string; check_in: string; check_out: string; guest_id: string },
  guest: { full_name?: string } | null,
  room: { room_number?: string; room_type?: string } | null
) {
  const { data: existingAlert } = await db
    .from("notification_log")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("template", "new_booking_alert")
    .limit(1)
    .maybeSingle();
  if (existingAlert) {
    return { alreadySent: true };
  }

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
      booking_id: booking.id,
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
    console.error("notify-new-booking: failed to insert staff alert row:", logInsertError);
    return { error: "Couldn't queue the alert" };
  }

  return sendAndRecord(db, transporter, smtpConfigured, fromName, fromEmail, logRow.id, STAFF_ALERT_RECIPIENT, subject, message);
}

// ----------------------------------------------------------------------------
// 2. Guest-facing "Booking Pending Confirmation" email — the exact spec
//    copy. Only sent if the guest has an email on file (it's now required
//    to even reach create_public_booking(), so in practice this always
//    fires for bookings created after the verification migration).
// ----------------------------------------------------------------------------
async function sendGuestPendingConfirmation(
  // deno-lint-ignore no-explicit-any
  db: any,
  transporter: nodemailer.Transporter | null,
  smtpConfigured: boolean,
  fromName: string,
  fromEmail: string | undefined,
  booking: { id: string; booking_number: string; guest_id: string; total_amount: number },
  guest: { full_name?: string; email?: string } | null,
  _room: unknown
) {
  if (!guest?.email || guest.email.trim().length === 0) {
    return { skipped: "no email on file" };
  }

  const { data: existingEmail } = await db
    .from("notification_log")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("template", "pending_confirmation")
    .limit(1)
    .maybeSingle();
  if (existingEmail) {
    return { alreadySent: true };
  }

  const subject = "Booking Pending Confirmation – Jikmis Apartment";
  const message = [
    `Dear ${guest.full_name ?? "Guest"},`,
    ``,
    `Your booking request has been received successfully.`,
    ``,
    `Booking Status: Pending Confirmation`,
    ``,
    `To confirm your reservation, please complete the 50% advance payment and send a screenshot of the payment receipt via WhatsApp to:`,
    WHATSAPP_PAYMENT_NUMBER,
    ``,
    `Once we receive and verify your payment, we will confirm your booking and send you a confirmation email with your booking details.`,
    ``,
    `Please Note:`,
    `- Your room is not reserved until the advance payment has been verified.`,
    `- Payment should be made as soon as possible to avoid losing room availability.`,
    `- Once payment is verified, your booking status will automatically change from Pending Confirmation to Confirmed.`,
    `- If payment is not received within the required time, the booking request may be cancelled automatically.`,
    `- If you have any questions, please contact us via WhatsApp.`,
    ``,
    `Booking Number: ${booking.booking_number}`,
    ``,
    `Thank you for choosing Jikmis Apartment. We look forward to welcoming you.`,
  ].join("\n");

  const { data: logRow, error: logInsertError } = await db
    .from("notification_log")
    .insert({
      booking_id: booking.id,
      guest_id: booking.guest_id,
      channel: "email",
      template: "pending_confirmation",
      recipient: guest.email.trim(),
      subject,
      message,
      status: "pending",
    })
    .select("id")
    .single();

  if (logInsertError || !logRow) {
    console.error("notify-new-booking: failed to insert pending-confirmation row:", logInsertError);
    return { error: "Couldn't queue the guest email" };
  }

  return sendAndRecord(db, transporter, smtpConfigured, fromName, fromEmail, logRow.id, guest.email.trim(), subject, message);
}

// ----------------------------------------------------------------------------
// Shared "actually send + update the notification_log row" step.
// ----------------------------------------------------------------------------
async function sendAndRecord(
  // deno-lint-ignore no-explicit-any
  db: any,
  transporter: nodemailer.Transporter | null,
  smtpConfigured: boolean,
  fromName: string,
  fromEmail: string | undefined,
  logId: string,
  to: string,
  subject: string,
  text: string
) {
  if (!smtpConfigured || !transporter) {
    await db
      .from("notification_log")
      .update({ status: "failed", failure_reason: "Gmail SMTP is not configured (SMTP_* secrets missing)." })
      .eq("id", logId);
    return { error: "Gmail SMTP is not configured yet." };
  }

  try {
    await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text });
    await db
      .from("notification_log")
      .update({ status: "sent", sent_at: new Date().toISOString(), provider: "gmail-smtp" })
      .eq("id", logId);
    return { ok: true };
  } catch (smtpErr) {
    console.error("notify-new-booking SMTP failure:", smtpErr);
    await db
      .from("notification_log")
      .update({ status: "failed", failure_reason: `SMTP error: ${(smtpErr as Error).message ?? "unknown"}`, provider: "gmail-smtp" })
      .eq("id", logId);
    return { error: "Failed to send the email" };
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
