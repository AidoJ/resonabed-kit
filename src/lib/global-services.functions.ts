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
  description: string | null;
  image_path: string | null;
  image_url?: string | null;
}

/**
 * Global service catalogue, the template copied into new orgs at creation.
 * `rrp` is a Recommended Retail Price: a display-only guide for clinics.
 * A clinic's own `price` is never bound to it. Description and picture are
 * platform-owned: clinics see them but cannot change them.
 */
export const listGlobalServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GlobalService[]> => {
    // Any authenticated user can read global rows (needed to preview them),
    // but only super_admin sees this admin surface via UI gating.
    const { data, error } = await context.supabase
      .from("services")
      .select(
        "id, name, duration_minutes, buffer_minutes, is_active, created_at, rrp, description, image_path",
      )
      .is("org_id", null)
      .order("name");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as GlobalService[];
    const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
    const urlByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await context.supabase.storage
        .from("service-images")
        .createSignedUrls([...new Set(paths)], 3600);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
      }
    }
    return rows.map((r) => ({
      ...r,
      image_url: r.image_path ? (urlByPath.get(r.image_path) ?? null) : null,
    }));
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
        description: z.string().max(2000).nullable().optional(),
        image_path: z.string().max(400).nullable().optional(),
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
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.image_path !== undefined ? { image_path: data.image_path } : {}),
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
        description: data.description ?? null,
        image_path: data.image_path ?? null,
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
