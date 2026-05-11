import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createManagedUser,
  deleteManagedUser,
  listUsersForAdmin,
  setUserRoleForAdmin,
  updateManagedUser,
} from "@/lib/admin.server";

const ROLES = ["admin", "specialist", "agent"] as const;
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
    return listUsersForAdmin(context.userId);
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setRoleSchema.parse(data))
  .handler(async ({ context, data }) => {
    return setUserRoleForAdmin(context.userId, data.user_id, data.role);
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    return createManagedUser(context.userId, data);
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    return updateManagedUser(context.userId, data);
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteUserSchema.parse(data))
  .handler(async ({ context, data }) => {
    return deleteManagedUser(context.userId, data.user_id);
  });