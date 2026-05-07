import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "specialist", "agent"] as const;
type Role = (typeof ROLES)[number];

const STATUSES = ["active", "suspended", "disabled"] as const;
type Status = (typeof STATUSES)[number];

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

async function logAction(actorId: string, action: string, targetUserId: string | null, targetEmail: string | null, details: Record<string, unknown> = {}) {
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

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, facility, status, created_at")
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
        status: (p.status ?? "active") as Status,
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

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    await logAction(context.userId, "role.update", data.user_id, null, { role: data.role });
    return { ok: true };
  });

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional().default(""),
  facility: z.string().trim().max(150).optional().default(""),
  role: z.enum(ROLES),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        facility: data.facility,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    const newId = created.user.id;

    // Trigger handle_new_user already creates a profile + default role.
    // Replace role with chosen role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (rErr) throw new Error(rErr.message);

    // Update profile fields in case trigger metadata mismatched
    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      phone: data.phone,
      facility: data.facility,
    }).eq("id", newId);

    await logAction(context.userId, "user.create", newId, data.email, { role: data.role });
    return { ok: true, id: newId };
  });

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  facility: z.string().trim().max(150).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(STATUSES).optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const profileUpdate: {
      full_name?: string;
      phone?: string;
      facility?: string;
      status?: Status;
    } = {};
    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (data.phone !== undefined) profileUpdate.phone = data.phone;
    if (data.facility !== undefined) profileUpdate.facility = data.facility;
    if (data.status !== undefined) profileUpdate.status = data.status;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      if (data.user_id === context.userId && data.role !== "admin") {
        throw new Error("You cannot remove your own admin role");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role });
      if (error) throw new Error(error.message);
    }

    // Map status to auth (suspended/disabled => ban; active => unban)
    if (data.status) {
      const banDuration = data.status === "active" ? "none" : "876000h"; // ~100y
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        ban_duration: banDuration,
      });
    }

    await logAction(context.userId, "user.update", data.user_id, null, { ...data });
    return { ok: true };
  });

const deleteUserSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account");

    // Capture target email for log
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = target?.user?.email ?? null;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);

    await logAction(context.userId, "user.delete", data.user_id, email, {});
    return { ok: true };
  });
