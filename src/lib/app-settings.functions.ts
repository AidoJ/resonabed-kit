import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MUSIC_RENEWAL_PRICE_KEY = "music_renewal_price_display";

export const getAppSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<string | null> => {
    const { data: row, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row?.value as string | null) ?? null;
  });

export const setAppSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        key: z.string().min(1).max(120),
        value: z.string().max(500).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // RLS enforces super_admin write; upsert works for both insert & update.
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        { key: data.key, value: data.value, updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
