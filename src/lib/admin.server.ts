import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export async function logAction(
  actorId: string,
  action: string,
  targetUserId: string | null,
  targetEmail: string | null,
  details: Record<string, unknown> = {},
) {
  const { data: actor } = await supabaseAdmin.auth.admin.getUserById(actorId);

  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: actorId,
    actor_email: actor?.user?.email ?? null,
    action,
    target_user_id: targetUserId,
    target_email: targetEmail,
    details: details as never,
  });
}