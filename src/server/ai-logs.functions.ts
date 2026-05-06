import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const logSchema = z.object({
  model: z.string().min(1).max(100),
  latency_ms: z.number().int().min(0).max(600000),
  confidence_score: z.number().min(0).max(1).nullable().optional(),
  symptoms_summary: z.string().max(2000).optional(),
  suggested_diagnosis: z.string().max(2000).optional(),
});

export const logAIDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => logSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("facility")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("ai_diagnostics_logs").insert({
      agent_id: context.userId,
      facility: profile?.facility ?? "",
      model: data.model,
      latency_ms: data.latency_ms,
      confidence_score: data.confidence_score ?? null,
      symptoms_summary: data.symptoms_summary ?? null,
      suggested_diagnosis: data.suggested_diagnosis ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const validateAIDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ log_id: z.string().uuid(), agrees: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    // Only specialists/admins can validate
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles ?? []).some(
      (r) => r.role === "specialist" || r.role === "admin",
    );
    if (!allowed) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("ai_diagnostics_logs")
      .update({
        validated_by_specialist: true,
        specialist_agrees: data.agrees,
      })
      .eq("id", data.log_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
