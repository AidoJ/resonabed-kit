import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "super_admin" | "org_admin" | "practitioner";

export interface UserContext {
  userId: string;
  email: string | null;
  displayName: string | null;
  org: { id: string; name: string; brandColor: string | null; logoUrl: string | null } | null;
  roles: AppRole[];
}

export const getCurrentUserContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserContext> => {
    const { supabase, userId, claims } = context;

    const [profileRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, org_id, organisations:org_id(id, name, brand_color, logo_url)")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const profile = profileRes.data;
    const org = profile?.organisations
      ? {
          id: (profile.organisations as { id: string }).id,
          name: (profile.organisations as { name: string }).name,
          brandColor: (profile.organisations as { brand_color: string | null }).brand_color,
          logoUrl: (profile.organisations as { logo_url: string | null }).logo_url,
        }
      : null;

    return {
      userId,
      email: (claims.email as string) ?? null,
      displayName: profile?.display_name ?? null,
      org,
      roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
    };
  });
