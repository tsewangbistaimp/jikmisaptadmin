// Supabase Edge Function: verify-email-otp
//
// Step 2 of the guest email-verification gate. Checks a submitted 6-digit
// code against the most recent, unexpired, unverified
// email_otp_verifications row for that email. On success, marks it verified
// and returns a fresh opaque verification_token — the website holds onto
// this and passes it to create_public_booking(), which re-checks it
// server-side (see the 20260803000000 migration), so a client can never
// skip verification simply by not calling this function.
//
// Body: { email: string, code: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC_FAILURE = "Email verification failed. Please request a new verification code.";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const submittedCode = typeof code === "string" ? code.trim() : "";

    if (!normalizedEmail || !submittedCode) {
      return json({ error: GENERIC_FAILURE }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey);

    const { data: row, error: findError } = await db
      .from("email_otp_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !row) {
      return json({ error: GENERIC_FAILURE }, 400);
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      return json({ error: GENERIC_FAILURE }, 400);
    }

    const submittedHash = await sha256Hex(submittedCode);
    if (submittedHash !== row.code_hash) {
      await db
        .from("email_otp_verifications")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return json({ error: GENERIC_FAILURE }, 400);
    }

    const verificationToken = crypto.randomUUID();
    const verifiedAt = new Date().toISOString();

    const { error: updateError } = await db
      .from("email_otp_verifications")
      .update({ verified: true, verified_at: verifiedAt, verification_token: verificationToken })
      .eq("id", row.id);

    if (updateError) {
      console.error("verify-email-otp: failed to mark verified:", updateError);
      return json({ error: GENERIC_FAILURE }, 500);
    }

    return json({ verified: true, verification_token: verificationToken }, 200);
  } catch (err) {
    console.error("verify-email-otp failure:", err);
    return json({ error: GENERIC_FAILURE }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
