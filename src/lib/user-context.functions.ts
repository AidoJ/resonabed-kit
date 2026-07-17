import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "super_admin" | "org_admin" | "practitioner";

export interface SupportSessionSummary {
  id: string;
  org_id: string;
  org_name: string;
  reason: string | null;
  entered_at: string;
}

export interface UserContext {
  userId: string;
  email: string | null;
  displayName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  org: {
    id: string;
    name: string;
    brandColor: string | null;
    logoUrl: string | null;
    logoPath: string | null;
    logoSignedUrl: string | null;
    themePrimary: string | null;
    themeSidebar: string | null;
    themeAccent: string | null;
    isConfigured: boolean;
  } | null;
  roles: AppRole[];
  /**
   * When a super_admin has an open support_sessions row, this is populated
   * and the UI unlocks that org's clinical screens (Sessions/Clients/
   * Bookings/Availability) with a persistent banner. Outside support mode
   * super_admin has NO access to individual org records via the UI.
   */
  activeSupportSession: SupportSessionSummary | null;
}

export const getCurrentUserContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserContext> => {
    const { supabase, userId, claims } = context;

    const [profileRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, org_id, is_active, organisations:org_id(id, name, brand_color, logo_url, logo_path, theme_primary, theme_sidebar, theme_accent, is_configured)",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const profile = profileRes.data;
    const orgRow = profile?.organisations as
      | {
          id: string;
          name: string;
          brand_color: string | null;
          logo_url: string | null;
          logo_path: string | null;
          theme_primary: string | null;
          theme_sidebar: string | null;
          theme_accent: string | null;
          is_configured: boolean;
        }
      | null
      | undefined;

    let logoSignedUrl: string | null = null;
    if (orgRow?.logo_path) {
      const { data: signed } = await supabase.storage
        .from("org-logos")
        .createSignedUrl(orgRow.logo_path, 3600);
      logoSignedUrl = signed?.signedUrl ?? null;
    }

    const org = orgRow
      ? {
          id: orgRow.id,
          name: orgRow.name,
          brandColor: orgRow.brand_color,
          logoUrl: orgRow.logo_url,
          logoPath: orgRow.logo_path,
          logoSignedUrl,
          themePrimary: orgRow.theme_primary,
          themeSidebar: orgRow.theme_sidebar,
          themeAccent: orgRow.theme_accent,
          isConfigured: Boolean(orgRow.is_configured),
        }
      : null;

    const appMeta = (claims.app_metadata ?? {}) as Record<string, unknown>;

    return {
      userId,
      email: (claims.email as string) ?? null,
      displayName: profile?.display_name ?? null,
      isActive: profile?.is_active ?? true,
      mustChangePassword: Boolean(appMeta.must_change_password),
      org,
      roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
    };
  });
