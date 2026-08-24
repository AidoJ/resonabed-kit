import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CHECKIN_ITEM_KEYS,
  DEFAULT_CHECKIN_ITEMS,
  type CheckinItemKey,
} from "@/lib/checkins";

const uuid = z.string().uuid();
const score = z.number().int().min(0).max(10).nullable().optional();

const ratingsSchema = z.object({
  arousal: score,
  mood: score,
  relaxation: score,
  pain: score,
  sleep_quality: score,
  physical_ease: score,
});

/** The org's enabled check-in scales (falls back to the three defaults). */
export const getCheckinSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveOrgId } = await import("@/lib/org-context");
    const { orgId } = await resolveEffectiveOrgId(context);
    if (!orgId) return { items: [...DEFAULT_CHECKIN_ITEMS] };
    const { data: org } = await context.supabase
      .from("organisations")
      .select("checkin_items")
      .eq("id", orgId)
      .maybeSingle();
    const raw = (org?.checkin_items ?? []) as string[];
    const items = raw.filter((k): k is CheckinItemKey =>
      (CHECKIN_ITEM_KEYS as readonly string[]).includes(k),
    );
    return { items: items.length > 0 ? items : [...DEFAULT_CHECKIN_ITEMS] };
  });

/** Both phases for one session (RLS scopes to the caller's org). */
export const getSessionCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_checkins")
      .select(
        "id, session_id, client_id, phase, arousal, mood, relaxation, pain, sleep_quality, physical_ease, created_at",
      )
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Record (or re-record) one phase of a session's check-in. Ownership fields
 * are derived from the session row server-side; the client-facing UI only
 * ever supplies ratings. One row per session+phase: re-saving updates it.
 */
export const saveSessionCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        session_id: uuid,
        phase: z.enum(["before", "after"]),
        ratings: ratingsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: session, error: sErr } = await context.supabase
      .from("sessions")
      .select("id, org_id, client_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Session not found");

    const { pseudonymForClient } = await import("@/lib/pseudonym.server");
    const payload = {
      org_id: session.org_id,
      session_id: session.id,
      client_id: session.client_id,
      pseudonym_id: await pseudonymForClient(context.supabase, session.client_id),
      phase: data.phase,
      recorded_by: context.userId,
      arousal: data.ratings.arousal ?? null,
      mood: data.ratings.mood ?? null,
      relaxation: data.ratings.relaxation ?? null,
      pain: data.ratings.pain ?? null,
      sleep_quality: data.ratings.sleep_quality ?? null,
      physical_ease: data.ratings.physical_ease ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("session_checkins")
      .upsert(payload, { onConflict: "session_id,phase" })
      .select(
        "id, session_id, client_id, phase, arousal, mood, relaxation, pain, sleep_quality, physical_ease, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** A client's check-in history (oldest first) for the trend view. */
export const listClientCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { client_id: string }) =>
    z.object({ client_id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_checkins")
      .select(
        `id, session_id, client_id, phase, arousal, mood, relaxation, pain, sleep_quality, physical_ease, created_at,
         session:session_id(created_at)`,
      )
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
