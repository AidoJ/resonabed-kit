import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { HOME_SAFETY_VERSION } from "@/lib/home-safety";

/**
 * Home-user server functions.
 *
 * Deliberately narrow: identity, the one-time safety acknowledgement, and
 * read-only access to the global frequency/audio library. Nothing here writes
 * a session record, and no symptom, goal or duration value is ever persisted.
 */

const uuid = z.string().uuid();

export type AccountKind = "home" | "clinic" | "none";

export interface HomeContext {
  kind: AccountKind;
  userId: string;
  email: string | null;
  displayName: string | null;
  /** True once the one-time product-safety acknowledgement is signed. */
  acknowledged: boolean;
  acknowledgedVersion: string | null;
}

/**
 * Single source of truth for "which app does this login belong to". Used by
 * both the clinic gate and the home gate so a user can never end up in the
 * wrong experience.
 */
export const getHomeContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeContext> => {
    const { data: account, error } = await context.supabase
      .from("home_accounts")
      .select("user_id, email, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!account) {
      return {
        kind: "clinic",
        userId: context.userId,
        email: null,
        displayName: null,
        acknowledged: false,
        acknowledgedVersion: null,
      };
    }

    const { data: ack, error: ackError } = await context.supabase
      .from("home_safety_acknowledgements")
      .select("version")
      .eq("user_id", context.userId)
      .eq("version", HOME_SAFETY_VERSION)
      .limit(1)
      .maybeSingle();
    if (ackError) throw new Error(ackError.message);

    return {
      kind: "home",
      userId: context.userId,
      email: account.email,
      displayName: account.display_name,
      acknowledged: !!ack,
      acknowledgedVersion: ack?.version ?? null,
    };
  });

/** Records the one-time product-safety acknowledgement. Append-only. */
export const acknowledgeHomeSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    // Drawn signature: a PNG data URL, same capture as the clinic app.
    z.object({ signature: z.string().trim().min(2).max(400_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("home_safety_acknowledgements").insert({
      user_id: context.userId,
      version: HOME_SAFETY_VERSION,
      signature: data.signature,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type AuthedCtx = { supabase: SupabaseClient<Database>; userId: string };

async function assertHomeUser(context: AuthedCtx) {
  const { data, error } = await context.supabase
    .from("home_accounts")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This area is for personal Resonabed accounts");
}

/**
 * The global frequency library plus which global tracks have audio. Home users
 * never see clinic-uploaded tracks: the query is pinned to org_id IS NULL.
 */
export const listHomeLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertHomeUser(context);

    const { data: frequencies, error: fErr } = await context.supabase
      .from("frequencies")
      .select("id, hz, name, description, benefits, color, goal_tags, body_area_tags")
      .order("hz", { ascending: true });
    if (fErr) throw new Error(fErr.message);

    const { data: tracks, error: aErr } = await context.supabase
      .from("audio_files")
      .select("id, title, frequency_id, duration_seconds")
      .is("org_id", null)
      .eq("is_active", true);
    if (aErr) throw new Error(aErr.message);

    return { frequencies: frequencies ?? [], tracks: tracks ?? [] };
  });

/** Signed playback URL for a GLOBAL track only. */
export const getHomeAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await assertHomeUser(context);

    const { data: row, error } = await context.supabase
      .from("audio_files")
      .select("file_url, org_id, is_active")
      .eq("id", data.id)
      .is("org_id", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.file_url || !row.is_active) throw new Error("That track is not available");

    const { data: signed, error: sErr } = await context.supabase.storage
      .from("audio-files")
      .createSignedUrl(row.file_url, 60 * 90);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

/** Public: redeem a purchase access code and create the perpetual account. */
export const redeemHomeAccessCode = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        code: z.string().trim().min(6).max(24),
        email: z.string().trim().email().max(200),
        password: z
          .string()
          .min(8, "Use at least 8 characters")
          .max(200)
          .regex(/[A-Z]/, "Include a capital letter")
          .regex(/[a-z]/, "Include a lowercase letter")
          .regex(/[0-9]/, "Include a number")
          .regex(/[^A-Za-z0-9]/, "Include a symbol"),
        displayName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { redeemAccessCodeForAccount } = await import("@/lib/home-redeem.server");
    return redeemAccessCodeForAccount({
      code: data.code,
      email: data.email,
      password: data.password,
      displayName: data.displayName ?? null,
    });
  });
