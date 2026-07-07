// Supabase Edge Function: admin-manage-user
//
// Lets the Super Admin reset a staff member's password, enable/disable an
// account, or permanently delete it. Same trust model as admin-create-user:
// only an authenticated admin may call this, and only this server-side
// function ever touches the service role key.
//
// Deploy: supabase functions deploy admin-manage-user
//
// Body: { action: "reset_password" | "set_status" | "delete", user_id: string,
//          password?: string, status?: "active" | "disabled" }

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

    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, status")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "active") {
      return json({ error: "Only the Super Admin can manage staff accounts." }, 403);
    }

    const { action, user_id, password, status } = await req.json();
    if (!action || !user_id) return json({ error: "action and user_id are required." }, 400);
    if (user_id === caller.id && (action === "delete" || action === "set_status")) {
      return json({ error: "You cannot disable or delete your own admin account." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (action === "reset_password") {
      if (!password || password.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true }, 200);
    }

    if (action === "set_status") {
      if (!status || !["active", "disabled"].includes(status)) {
        return json({ error: "status must be active or disabled." }, 400);
      }
      // Ban the auth user so they can no longer log in, and mirror status in profiles.
      const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: status === "disabled" ? "876000h" : "none",
      });
      if (authErr) return json({ error: authErr.message }, 400);

      const { error: profileErr } = await admin.from("profiles").update({ status }).eq("id", user_id);
      if (profileErr) return json({ error: profileErr.message }, 400);

      return json({ ok: true }, 200);
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action." }, 400);
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
