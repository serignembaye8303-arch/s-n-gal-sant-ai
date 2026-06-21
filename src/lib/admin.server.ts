import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminRole = "admin" | "specialiste" | "agent";
export type AdminStatus = "active" | "suspended" | "disabled";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  facility: string;
  status: AdminStatus;
  created_at: string;
  roles: AdminRole[];
  primary_role: AdminRole;
}

export interface CreateManagedUserInput {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  facility: string;
  role: AdminRole;
}

export interface UpdateManagedUserInput {
  user_id: string;
  full_name?: string;
  phone?: string;
  facility?: string;
  role?: AdminRole;
  status?: AdminStatus;
}

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

export async function listUsersForAdmin(actorId: string): Promise<AdminUserRow[]> {
  await assertAdmin(actorId);

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, facility, status, created_at")
    .order("created_at", { ascending: false });
  if (pErr) throw new Error(pErr.message);

  const { data: rolesData, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role");
  if (rErr) throw new Error(rErr.message);

  const rolesByUser = new Map<string, AdminRole[]>();
  for (const r of rolesData ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role as AdminRole);
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
    const primary: AdminRole = userRoles.includes("admin")
      ? "admin"
      : userRoles.includes("specialiste")
        ? "specialiste"
        : "agent";

    return {
      id: p.id,
      email: emailById.get(p.id) ?? "",
      full_name: p.full_name ?? "",
      phone: p.phone ?? "",
      facility: p.facility ?? "",
      status: (p.status ?? "active") as AdminStatus,
      created_at: p.created_at,
      roles: userRoles,
      primary_role: primary,
    };
  });
}

export async function setUserRoleForAdmin(actorId: string, userId: string, role: AdminRole) {
  await assertAdmin(actorId);

  if (userId === actorId && role !== "admin") {
    throw new Error("You cannot remove your own admin role");
  }

  const { error: delErr } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);

  const { error: insErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (insErr) throw new Error(insErr.message);

  await logAction(actorId, "role.update", userId, null, { role });
  return { ok: true };
}

export async function createManagedUser(actorId: string, data: CreateManagedUserInput) {
  await assertAdmin(actorId);

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

  await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: newId, role: data.role });
  if (roleError) throw new Error(roleError.message);

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: newId,
      full_name: data.full_name,
      phone: data.phone,
      facility: data.facility,
      status: "active",
    });
  if (profileError) throw new Error(profileError.message);

  await logAction(actorId, "user.create", newId, data.email, { role: data.role });
  return { ok: true, id: newId };
}

export async function updateManagedUser(actorId: string, data: UpdateManagedUserInput) {
  await assertAdmin(actorId);

  const profileUpdate: {
    full_name?: string;
    phone?: string;
    facility?: string;
    status?: AdminStatus;
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
    if (data.user_id === actorId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
  }

  if (data.status) {
    const banDuration = data.status === "active" ? "none" : "876000h";
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: banDuration,
    });
  }

  await logAction(actorId, "user.update", data.user_id, null, { ...data });
  return { ok: true };
}

export async function deleteManagedUser(actorId: string, userId: string) {
  await assertAdmin(actorId);
  if (userId === actorId) throw new Error("You cannot delete your own account");

  const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = target?.user?.email ?? null;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  await logAction(actorId, "user.delete", userId, email, {});
  return { ok: true };
}