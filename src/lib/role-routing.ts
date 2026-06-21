import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

export function roleHomePath(role: AppRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin/users";
    case "specialiste":
      return "/dashboard/ai-performance";
    case "agent":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

export async function fetchPrimaryRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!data || data.length === 0) return null;
  const roles = data.map((r) => r.role as AppRole);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("specialiste")) return "specialiste";
  return "agent";
}
