import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveEffectiveOrgId } from "@/lib/org-context";
import { flyerDesignSchema } from "./flyer-design";

export const saveFlyerDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => flyerDesignSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { orgId } = await resolveEffectiveOrgId(context);
    if (!orgId) throw new Error("Choose a clinic before saving its flyer.");
    const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role, org_id").eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!roles?.some((r) => r.role === "super_admin" || (r.role === "org_admin" && r.org_id === orgId))) throw new Error("Forbidden");
    if (data.logoPath && (!data.logoPath.startsWith(`${orgId}/`) || data.logoPath.includes(".."))) throw new Error("Choose a logo belonging to this clinic.");
    const { data: updated, error } = await context.supabase.from("organisations").update({ flyer_design: data }).eq("id", orgId).select("id").single();
    if (error || !updated) throw new Error(error?.message ?? "Flyer could not be saved.");
    return { ok: true };
  });