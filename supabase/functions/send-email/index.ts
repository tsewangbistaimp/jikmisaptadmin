// Supabase Edge Function: send-email
//
// Sends a booking notification email through Gmail SMTP, always from the
// official Jikmis Apartment account — never from the guest's own address.
// This has to live server-side: an SMTP App Password must never be shipped
// to the browser bundle, so the admin dashboard calls this function instead
// of talking to an SMTP server directly (see src/lib/notifications/providers/
// emailProvider.ts).
//
// Only an authenticated, active staff member may call this — same trust
// model as admin-manage-user/admin-create-user.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   SMTP_HOST       e.g. smtp.gmail.com
//   SMTP_PORT       e.g. 587
//   SMTP_USER       jikmisdonkhang@gmail.com
//   SMTP_PASS       a Gmail App Password (NOT the account's login password)
//   SMTP_FROM_NAME  Jikmis Apartment
//   SMTP_FROM_EMAIL jikmisdonkhang@gmail.com
//
// Deploy: supabase functions deploy send-email
//
// Body: { to: string, subject: string, message: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile } = await callerClient.from("profiles").select("status").eq("id", caller.id).single();

    if (!callerProfile || callerProfile.status !== "active") {
      return json({ error: "Only active staff can send guest notification emails." }, 403);
    }

    const { to, subject, message } = await req.json();
    if (!to || !subject || !message) {
      return json({ error: "to, subject, and message are required." }, 400);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Jikmis Apartment";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? smtpUser;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      return json(
        { error: "Gmail SMTP is not configured yet. Run `supabase secrets set SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=... SMTP_FROM_EMAIL=...` and redeploy this function." },
        200 // 200 so the client sees this as a clean, expected "not configured" failure rather than a hard error
      );
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
        to,
        subject,
        text: message,
      });
    } catch (smtpErr) {
      // Logged (not just returned) so it shows up in the Supabase dashboard's
      // Edge Functions -> send-email -> Logs tab — the Invocations tab only
      // shows request metadata, not this response body's actual content.
      console.error("send-email SMTP failure:", smtpErr);
      return json({ error: `SMTP error: ${(smtpErr as Error).message ?? "unknown"}` }, 200);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("send-email failure:", err);
    return json({ error: (err as Error).message ?? "Failed to send email" }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
