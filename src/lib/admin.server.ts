import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminRole = "admin" | "specialiste" | "agent";
export type AdminStatus = "active" | "suspended" | "disabled";

const VALID_ROLES: AdminRole[] = ["admin", "specialiste", "agent"];

function isAdminRole(role: unknown): role is AdminRole {
  return typeof role === "string" && VALID_ROLES.includes(role as AdminRole);
}

function logAdminUsersError(stage: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error("[admin.users]", stage, {
    ...details,
    error,
    message: error instanceof Error ? error.message : String(error),
  });
}

export type AdminListErrorCode =
  | "FORBIDDEN"
  | "MISSING_TABLE"
  | "MISSING_COLUMN"
  | "DB_ERROR"
  | "SCHEMA_INVALID"
  | "INTERNAL";

export class AdminListError extends Error {
  code: AdminListErrorCode;
  details?: Record<string, unknown>;
  constructor(code: AdminListErrorCode, message: string, details?: Record<string, unknown>) {
    // Encode structured payload in message so it survives the RPC boundary.
    super(JSON.stringify({ code, message, details: details ?? {} }));
    this.name = "AdminListError";
    this.code = code;
    this.details = details;
  }
}

function mapPgError(err: { code?: string | null; message: string; hint?: string | null }): AdminListErrorCode {
  // PostgREST/Postgres codes: 42P01 undefined_table, 42703 undefined_column, PGRST205 missing relation
  if (err.code === "42P01" || err.code === "PGRST205") return "MISSING_TABLE";
  if (err.code === "42703" || err.code === "PGRST204") return "MISSING_COLUMN";
  return "DB_ERROR";
}

const REQUIRED_COLUMNS = ["id", "nom", "email", "role", "statut", "created_at"] as const;


export interface AdminUserRow {
  id: string;
  email: string;
  nom: string;
  full_name: string;
  phone: string;
  facility: string;
  statut: AdminStatus;
  status: AdminStatus;
  created_at: string;
  role: AdminRole;
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

export async function assertAdmin(userId: string, dbClient?: SupabaseClient<Database>) {
  const db = dbClient ?? supabaseAdmin;
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    logAdminUsersError("assertAdmin", error, { userId, code: error.code, hint: error.hint });
    throw new AdminListError("DB_ERROR", `Vérification admin impossible: ${error.message}`, {
      pg_code: error.code,
    });
  }
  if (!data) throw new AdminListError("FORBIDDEN", "Accès refusé : rôle administrateur requis.");
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

export async function listUsersForAdmin(
  actorId: string,
  dbClient?: SupabaseClient<Database>,
): Promise<AdminUserRow[]> {
  console.info("[admin.users] listUsersForAdmin:start", { actorId });
  const db = dbClient ?? supabaseAdmin;
  await assertAdmin(actorId, db);

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, full_name, phone, facility, status, created_at")
    .order("created_at", { ascending: false });
  if (pErr) {
    const code = mapPgError(pErr);
    logAdminUsersError("profiles.select", pErr, { code: pErr.code, mapped: code });
    throw new AdminListError(code, `Lecture impossible (profiles): ${pErr.message}`, {
      pg_code: pErr.code,
      table: "profiles",
      expected_columns: REQUIRED_COLUMNS,
    });
  }

  const { data: rolesData, error: rErr } = await db
    .from("user_roles")
    .select("user_id, role");
  if (rErr) {
    const code = mapPgError(rErr);
    logAdminUsersError("user_roles.select", rErr, { code: rErr.code, mapped: code });
    throw new AdminListError(code, `Lecture impossible (user_roles): ${rErr.message}`, {
      pg_code: rErr.code,
      table: "user_roles",
    });
  }

  const rolesByUser = new Map<string, AdminRole[]>();
  for (const r of rolesData ?? []) {
    if (!isAdminRole(r.role)) {
      logAdminUsersError("user_roles.invalid_role", new Error(`Rôle non autorisé: ${String(r.role)}`), {
        user_id: r.user_id,
        role: r.role,
      });
      continue;
    }
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  const emailById = new Map<string, string>();
  try {
    const { data: authList, error: aErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (aErr) {
      logAdminUsersError("auth.admin.listUsers", aErr);
    } else {
      for (const u of authList.users) {
        if (u.email) emailById.set(u.id, u.email);
      }
    }
  } catch (error) {
    logAdminUsersError("auth.admin.listUsers.exception", error);
  }

  const rows: AdminUserRow[] = [];
  for (const p of profiles ?? []) {
    const userRoles = rolesByUser.get(p.id) ?? [];
    const primary: AdminRole = userRoles.includes("admin")
      ? "admin"
      : userRoles.includes("specialiste")
        ? "specialiste"
        : "agent";
    const status = (p.status ?? "active") as AdminStatus;
    const nom = p.full_name ?? "";

    // Schema validation: required columns
    if (!p.id || typeof p.created_at !== "string") {
      logAdminUsersError("schema.invalid_row", new Error("Row missing id or created_at"), { row: p });
      throw new AdminListError("SCHEMA_INVALID", "Schéma invalide : colonnes id/created_at manquantes.", {
        expected_columns: REQUIRED_COLUMNS,
      });
    }

    rows.push({
      id: p.id,
      email: emailById.get(p.id) ?? "",
      nom,
      full_name: nom,
      phone: p.phone ?? "",
      facility: p.facility ?? "",
      statut: status,
      status,
      created_at: p.created_at,
      role: primary,
      roles: userRoles,
      primary_role: primary,
    });
  }

  console.info("[admin.users] listUsersForAdmin:success", { count: rows.length });
  return rows;
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