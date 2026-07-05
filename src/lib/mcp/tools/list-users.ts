import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ROLES = ["admin", "specialiste", "agent"] as const;

export default defineTool({
  name: "list_users",
  title: "List users",
  description:
    "List platform users (id, full name, phone, facility, primary role). Admin only. Optionally filter by role.",
  inputSchema: {
    role: z.enum(ROLES).optional().describe("Filter by role: admin, specialiste, or agent."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ role, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: ctx.getUserId(),
      _role: "admin",
    });
    if (roleErr) {
      return { content: [{ type: "text", text: `Role check failed: ${roleErr.message}` }], isError: true };
    }
    if (!isAdmin) {
      return { content: [{ type: "text", text: "Forbidden: admin role required." }], isError: true };
    }

    const cap = limit ?? 50;
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, facility, created_at")
      .order("created_at", { ascending: false })
      .limit(cap);
    if (pErr) {
      return { content: [{ type: "text", text: `Query failed: ${pErr.message}` }], isError: true };
    }

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (rErr) {
      return { content: [{ type: "text", text: `Query failed: ${rErr.message}` }], isError: true };
    }

    const roleByUser = new Map<string, string>();
    for (const r of roles ?? []) {
      const existing = roleByUser.get(r.user_id);
      const rank = (v: string) => (v === "admin" ? 3 : v === "specialiste" ? 2 : 1);
      if (!existing || rank(r.role) > rank(existing)) roleByUser.set(r.user_id, r.role);
    }

    let rows = (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      facility: p.facility,
      created_at: p.created_at,
      role: roleByUser.get(p.id) ?? "agent",
    }));
    if (role) rows = rows.filter((r) => r.role === role);

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { users: rows, count: rows.length },
    };
  },
});
