import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "specialiste", "agent"] as const;
const STATUSES = ["active", "suspended", "disabled"] as const;

const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(ROLES),
});

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional().default(""),
  facility: z.string().trim().max(150).optional().default(""),
  role: z.enum(ROLES),
});

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  facility: z.string().trim().max(150).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(STATUSES).optional(),
});

const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listUsersForAdmin } = await import("@/lib/admin.server");
    return listUsersForAdmin(context.userId);
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setRoleSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { setUserRoleForAdmin } = await import("@/lib/admin.server");
    return setUserRoleForAdmin(context.userId, data.user_id, data.role);
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { createManagedUser } = await import("@/lib/admin.server");
    return createManagedUser(context.userId, data);
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { updateManagedUser } = await import("@/lib/admin.server");
    return updateManagedUser(context.userId, data);
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { deleteManagedUser } = await import("@/lib/admin.server");
    return deleteManagedUser(context.userId, data.user_id);
  });