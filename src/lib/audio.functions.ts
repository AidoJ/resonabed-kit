import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listOrgAudioFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Returns both global (org_id IS NULL) and the caller's own org rows — RLS
    // filters the rest. The session player uses the same visibility.
    const { data, error } = await context.supabase
      .from("audio_files")
      .select("id, org_id, title, frequency_id, file_url, duration_seconds, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAudioFileRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        title: z.string().min(1).max(160),
        frequency_id: uuid,
        is_global: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Super_admin can upload to the shared global library (org_id = null).
    if (data.is_global) {
      const { data: isSuper, error: rErr } = await context.supabase.rpc("is_super_admin", {
        _user_id: context.userId,
      });
      if (rErr) throw new Error(rErr.message);
      if (!isSuper) throw new Error("Only super admins can upload to the global library");

      const { data: row, error } = await context.supabase
        .from("audio_files")
        .insert({
          org_id: null,
          title: data.title,
          frequency_id: data.frequency_id,
          is_active: true,
        })
        .select("id, org_id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id, org_id: row.org_id as string | null };
    }

    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) throw new Error("No organisation assigned to your profile");

    const { data: row, error } = await context.supabase
      .from("audio_files")
      .insert({
        org_id: profile.org_id,
        title: data.title,
        frequency_id: data.frequency_id,
        is_active: true,
      })
      .select("id, org_id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, org_id: row.org_id as string | null };
  });


export const finalizeAudioFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid,
        file_url: z.string().min(1).max(400),
        duration_seconds: z.number().int().min(0).max(60 * 60 * 12).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadMutableAudioRow, deactivateOrgSiblings } = await import("./audio.server");
    const row = await loadMutableAudioRow(context, data.id);
    const { error } = await context.supabase
      .from("audio_files")
      .update({
        file_url: data.file_url,
        duration_seconds: data.duration_seconds,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // A freshly uploaded org track becomes the one that plays for its frequency.
    if (row.is_active) await deactivateOrgSiblings(context, row);
    return { ok: true };
  });

export const setAudioFileActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, is_active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadMutableAudioRow, deactivateOrgSiblings } = await import("./audio.server");
    const row = await loadMutableAudioRow(context, data.id);
    const { error } = await context.supabase
      .from("audio_files")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.is_active) await deactivateOrgSiblings(context, row);
    return { ok: true };
  });

export const deleteAudioFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const row = await loadMutableAudioRow(context, data.id);

    if (row.file_url) {
      const { error: rmErr } = await context.supabase.storage
        .from("audio-files")
        .remove([row.file_url]);
      // Ignore "not found" — row can still be deleted.
      if (rmErr && !/not.?found/i.test(rmErr.message)) {
        throw new Error(rmErr.message);
      }
    }

    const { error } = await context.supabase
      .from("audio_files")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getSignedAudioUrlById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("audio_files")
      .select("file_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.file_url) throw new Error("Audio file has no stored path");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("audio-files")
      .createSignedUrl(row.file_url, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });
