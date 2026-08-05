// Supabase Edge Function: send-email-otp
//
// Step 1 of the guest email-verification gate on the booking website.
// Generates a 6-digit code, stores a HASH of it (never the plaintext) in
// public.email_otp_verifications with a 10-minute expiry, and emails it to
// the guest via the same Gmail SMTP secrets already configured for
// send-email / notify-new-booking — no new secrets, no new deploy config
// beyond `supabase functions deploy send-email-otp`.
//
// Called by anonymous guests (no staff session exists on the public
// website), so it uses a service-role client — email_otp_verifications has
// RLS enabled with zero policies, meaning nothing except this service-role
// path (and the SECURITY DEFINER create_public_booking() check) can ever
// read or write it.
//
// Body: { email: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends for the same email
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  // 6-digit numeric code, always zero-padded (crypto.getRandomValues, not
  // Math.random — this is a security code even though it's short-lived).
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return json({ error: "Please enter a valid email address" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey);

    // Basic resend cooldown — prevents a guest (or a script) from spamming
    // themselves (or someone else's inbox) with repeated codes.
    const { data: recent } = await db
      .from("email_otp_verifications")
      .select("created_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return json({ error: "Please wait a moment before requesting another code" }, 429);
    }

    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: insertError } = await db.from("email_otp_verifications").insert({
      email: normalizedEmail,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("send-email-otp: failed to insert OTP row:", insertError);
      return json({ error: "Couldn't start email verification. Please try again." }, 500);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Jikmis Apartment";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? smtpUser;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      return json({ error: "Email verification is not configured yet. Please contact us directly." }, 500);
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
        to: normalizedEmail,
        subject: "Your Jikmis Apartment verification code",
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\nJikmis Apartment`,
      });
    } catch (smtpErr) {
      console.error("send-email-otp SMTP failure:", smtpErr);
      return json({ error: "Couldn't send the verification email. Please try again." }, 500);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("send-email-otp failure:", err);
    return json({ error: (err as Error).message ?? "Failed to send verification code" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
