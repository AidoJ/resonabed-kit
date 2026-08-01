import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function requireSuperAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export interface GlobalService {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
  created_at: string;
  rrp: number | null;
}

/**
 * Global service catalogue, the template copied into new orgs at creation.
 * `rrp` is a Recommended Retail Price: a display-only guide for clinics.
 * A clinic's own `price` is never bound to it.
 */
export const listGlobalServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GlobalService[]> => {
    // Any authenticated user can read global rows (needed to preview them),
    // but only super_admin sees this admin surface via UI gating.
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, duration_minutes, buffer_minutes, is_active, created_at, rrp")
      .is("org_id", null)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as GlobalService[];
  });

export const upsertGlobalService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().min(1).max(160),
        duration_minutes: z.number().int().min(1).max(600),
        buffer_minutes: z.number().int().min(0).max(240),
        rrp: z.number().min(0).max(100000).nullable(),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("services")
        .update({
          name: data.name,
          duration_minutes: data.duration_minutes,
          buffer_minutes: data.buffer_minutes,
          rrp: data.rrp,
          is_active: data.is_active,
        })
        .eq("id", data.id)
        .is("org_id", null);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("services")
      .insert({
        org_id: null,
        name: data.name,
        duration_minutes: data.duration_minutes,
        buffer_minutes: data.buffer_minutes,
        rrp: data.rrp,
        price: 0,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGlobalService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase
      .from("services")
      .delete()
      .eq("id", data.id)
      .is("org_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
