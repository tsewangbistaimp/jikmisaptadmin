// Supabase Edge Function: admin-create-user
//
// Creates a new receptionist (or admin) account. Only callable by an
// already-authenticated admin. Uses the SERVICE ROLE key (server-side only,
// never shipped to the browser) to call the Supabase Auth admin API, so
// passwords are always hashed and managed by Supabase Auth — never stored
// in our own tables.
//
// Deploy:  supabase functions deploy admin-create-user
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
//          automatically to edge functions by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Client scoped to the caller — used only to verify who is calling.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, status")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "active") {
      return json({ error: "Only the Super Admin can create staff accounts." }, 403);
    }

    const body = await req.json();
    const { full_name, username, email, phone, password, role } = body;

    if (!full_name || !username || !email || !password) {
      return json({ error: "full_name, username, email and password are required." }, 400);
    }

    // Admin client with full privileges, used only inside this trusted function.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        username,
        phone: phone ?? null,
        role: role === "admin" ? "admin" : "receptionist",
        created_by: caller.id,
      },
    });

    if (createError) {
      return json({ error: createError.message }, 400);
    }

    return json({ user: created.user }, 200);
  } catch (err) {
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
