import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PolicyTemplateKind = "consent" | "privacy" | "health_safety";

export interface PolicyTemplate {
  kind: PolicyTemplateKind;
  title: string;
  body: string;
  updated_at: string;
}

/** Any signed-in user can read templates (org admins need them in settings). */
export const listPolicyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PolicyTemplate[]> => {
    const { data, error } = await context.supabase
      .from("policy_templates")
      .select("kind, title, body, updated_at")
      .order("kind");
    if (error) throw new Error(error.message);
    return (data ?? []) as PolicyTemplate[];
  });

/** Super_admin only — RLS enforces server-side. */
export const updatePolicyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["consent", "privacy", "health_safety"]),
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(50000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("policy_templates")
      .update({ title: data.title, body: data.body, updated_by: context.userId })
      .eq("kind", data.kind);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
