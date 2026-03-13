import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { email, password } = await req.json();

  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });
  if (roleErr) {
    return new Response(JSON.stringify({ error: roleErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, userId: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
