import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "specialist", "agent"] as const;
type Role = (typeof ROLES)[number];

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, facility, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: rolesData, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, Role[]>();
    for (const r of rolesData ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    }

    // Fetch emails from auth.users via admin API
    const { data: authList, error: aErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (aErr) throw new Error(aErr.message);
    const emailById = new Map<string, string>();
    for (const u of authList.users) {
      if (u.email) emailById.set(u.id, u.email);
    }

    return (profiles ?? []).map((p) => {
      const userRoles = rolesByUser.get(p.id) ?? [];
      const primary: Role = userRoles.includes("admin")
        ? "admin"
        : userRoles.includes("specialist")
        ? "specialist"
        : "agent";
      return {
        id: p.id,
        email: emailById.get(p.id) ?? "",
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        facility: p.facility ?? "",
        created_at: p.created_at,
        roles: userRoles,
        primary_role: primary,
      };
    });
  });

const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(ROLES),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setRoleSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }

    // Replace all roles for this user with the single chosen role
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });
