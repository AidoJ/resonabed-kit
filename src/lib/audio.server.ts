import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AudioCtx = { supabase: SupabaseClient<Database>; userId: string };

export interface AudioRowRef {
  id: string;
  org_id: string | null;
  frequency_id: string | null;
  file_url: string | null;
  is_active: boolean;
}

/** True when the caller holds the super_admin role. */
export async function callerIsSuperAdmin(context: AudioCtx): Promise<boolean> {
  const { data, error } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Loads an audio row and rejects mutation of a global track by anyone who is
 * not a super admin. RLS already blocks this; the explicit check gives the UI a
 * readable error instead of a silent no-op.
 */
export async function loadMutableAudioRow(
  context: AudioCtx,
  id: string,
): Promise<AudioRowRef> {
  const { data: row, error } = await context.supabase
    .from("audio_files")
    .select("id, org_id, frequency_id, file_url, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Audio file not found");
  if (row.org_id === null && !(await callerIsSuperAdmin(context))) {
    throw new Error(
      "Global tracks are managed by ResonaBed and cannot be changed here",
    );
  }
  return row as AudioRowRef;
}

/**
 * Only one of an organisation's own tracks may be active per frequency, so the
 * session player has a single unambiguous winner. Activating one deactivates
 * its siblings (radio-button behaviour). Global tracks are untouched.
 */
export async function deactivateOrgSiblings(
  context: AudioCtx,
  args: { id: string; org_id: string | null; frequency_id: string | null },
): Promise<void> {
  if (!args.org_id || !args.frequency_id) return;
  const { error } = await context.supabase
    .from("audio_files")
    .update({ is_active: false })
    .eq("org_id", args.org_id)
    .eq("frequency_id", args.frequency_id)
    .eq("is_active", true)
    .neq("id", args.id);
  if (error) throw new Error(error.message);
}
