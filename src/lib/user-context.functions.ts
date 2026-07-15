import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "super_admin" | "org_admin" | "practitioner";

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
    isConfigured: boolean;
  } | null;
  roles: AppRole[];
}

export const getCurrentUserContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserContext> => {
    const { supabase, userId, claims } = context;

    const [profileRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, org_id, is_active, organisations:org_id(id, name, brand_color, logo_url, logo_path, is_configured)",
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
          is_configured: boolean;
        }
      | null
      | undefined;
    const org = orgRow
      ? {
          id: orgRow.id,
          name: orgRow.name,
          brandColor: orgRow.brand_color,
          logoUrl: orgRow.logo_url,
          logoPath: orgRow.logo_path,
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
