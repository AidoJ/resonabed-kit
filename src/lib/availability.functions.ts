import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

export const listAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ practitioner_id: uuid.optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("practitioner_availability")
      .select(
        `id, practitioner_id, day_of_week, start_time, end_time, is_active,
         practitioner:practitioner_id(id, display_name)`,
      )
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (data.practitioner_id) q = q.eq("practitioner_id", data.practitioner_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const availabilityInput = z.object({
  id: uuid.optional(),
  practitioner_id: uuid,
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(timeRe),
  end_time: z.string().regex(timeRe),
  is_active: z.boolean().default(true),
});

export const upsertAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => availabilityInput.parse(data))
  .handler(async ({ data, context }) => {
    // Look up the practitioner's org for org_id (RLS gates access).
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", data.practitioner_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) throw new Error("Practitioner has no organisation");

    const payload = {
      org_id: profile.org_id,
      practitioner_id: data.practitioner_id,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("practitioner_availability")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("practitioner_availability")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("practitioner_availability")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
