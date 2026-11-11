import type { SupabaseClient } from "@supabase/supabase-js";
import { MUSIC_LICENCE_EXPIRED_ERROR, orgLicenceOk, type OrgLicenceRow } from "@/lib/music-access";

/**
 * Signs a music file link with the server-only admin client. Storage rules no
 * longer let signed-in accounts read the shared folder, so this is the only
 * way a shared track can be reached. Call it only AFTER the caller's access
 * has been checked.
 */
export async function signMusicPath(path: string, expiresInSeconds: number): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("audio-files")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Reads the clinic's licence through the caller's own access rules. */
export async function loadOrgLicence(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgLicenceRow | null> {
  const { data } = await supabase
    .from("organisations")
    .select("music_licence_status, music_licence_expires_at")
    .eq("id", orgId)
    .maybeSingle();
  return (data as OrgLicenceRow | null) ?? null;
}

/** Throws before anything is written when the clinic's music licence has expired. */
export async function assertOrgMusicLicence(supabase: SupabaseClient, orgId: string): Promise<void> {
  const org = await loadOrgLicence(supabase, orgId);
  if (!orgLicenceOk(org)) {
    throw new Error(MUSIC_LICENCE_EXPIRED_ERROR);
  }
}
