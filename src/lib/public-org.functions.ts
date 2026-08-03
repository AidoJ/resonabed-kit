import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AvailabilityWindow } from "./availability-pattern";
import { publicShortName } from "./person-name";

export type PublicOrg = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  slug: string;
  public_blurb: string | null;
  /** Optional short tagline shown beside the logo (max 50 chars). */
  public_strapline: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  public_suburb: string | null;
  public_booking_enabled: boolean;
  timezone: string | null;
  theme_sidebar: string | null;
  theme_primary: string | null;
  /** 'retail' | 'home', drives whether a street address may be shown at all. */
  clinic_type: "retail" | "home";
  /**
   * Formatted street address. The database function only ever returns this for
   * retail clinics that opt to show it; it is always null for home-based orgs.
   */
  public_address: string | null;
};

export type PublicService = {
  id: string;
  name: string;
  duration_minutes: number;
  /** Null when the clinic has chosen not to publish this session's price. */
  price: number | null;
  show_price: boolean;
};

export type PublicPractitioner = {
  id: string;
  /** "Aidan L." - given name plus surname initial only. */
  name: string;
  bio: string | null;
  avatarUrl: string | null;
};


export const getPublicOrgPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const [orgRes, svcRes, availRes] = await Promise.all([
      supabase.rpc("get_public_org", { p_slug: data.slug }),
      supabase.rpc("get_public_services", { p_slug: data.slug }),
      supabase.rpc("get_public_availability", { p_slug: data.slug }),
    ]);

    const org = (orgRes.data as PublicOrg[] | null)?.[0] ?? null;
    if (!org)
      return {
        org: null,
        services: [] as PublicService[],
        logoUrl: null,
        availability: [] as AvailabilityWindow[],
        practitioners: [] as PublicPractitioner[],
      };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgRow } = await supabaseAdmin
      .from("organisations")
      .select("id, logo_path")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();

    // Logos live in a private bucket; sign a short-lived URL for the public page.
    let logoUrl: string | null = org.logo_url ?? null;
    if (!logoUrl && orgRow?.logo_path) {
      const signed = await supabaseAdmin.storage
        .from("org-logos")
        .createSignedUrl(orgRow.logo_path, 60 * 60 * 24 * 7);
      logoUrl = signed.data?.signedUrl ?? null;
    }

    // Team members shown publicly: display name is reduced to "First L." and
    // only the bio/headshot the clinic chose to store is exposed.
    let practitioners: PublicPractitioner[] = [];
    if (orgRow?.id) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, bio, avatar_path")
        .eq("org_id", orgRow.id)
        .eq("is_active", true)
        .order("display_name", { ascending: true });
      practitioners = await Promise.all(
        (profiles ?? []).map(async (p) => {
          let avatarUrl: string | null = null;
          if (p.avatar_path) {
            const signed = await supabaseAdmin.storage
              .from("team-avatars")
              .createSignedUrl(p.avatar_path, 60 * 60 * 24 * 7);
            avatarUrl = signed.data?.signedUrl ?? null;
          }
          return {
            id: p.id as string,
            name: publicShortName(p.display_name as string | null),
            bio: (p.bio as string | null) ?? null,
            avatarUrl,
          };
        }),
      );
      practitioners = practitioners.filter((p) => !!p.name);
    }

    return {
      org,
      services: (svcRes.data as PublicService[] | null) ?? [],
      logoUrl,
      availability: (availRes.data as AvailabilityWindow[] | null) ?? [],
      practitioners,
    };
  });


export type PublicOrgBranding = {
  name: string;
  logoUrl: string | null;
  themeSidebar: string | null;
  themePrimary: string | null;
  slug: string;
};

/**
 * Cosmetic branding for the shared login page when a therapist arrives from
 * their clinic's public page (/auth?clinic=slug). Returns only data the public
 * clinic page already exposes, and only for published, active orgs.
 */
export const getPublicOrgBranding = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicOrgBranding | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: rows } = await supabase.rpc("get_public_org", { p_slug: data.slug });
    const org = (rows as PublicOrg[] | null)?.[0] ?? null;
    if (!org) return null;

    let logoUrl: string | null = org.logo_url ?? null;
    if (!logoUrl) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: orgRow } = await supabaseAdmin
        .from("organisations")
        .select("logo_path")
        .eq("slug", data.slug)
        .eq("published", true)
        .maybeSingle();
      if (orgRow?.logo_path) {
        const signed = await supabaseAdmin.storage
          .from("org-logos")
          .createSignedUrl(orgRow.logo_path, 60 * 60 * 24 * 7);
        logoUrl = signed.data?.signedUrl ?? null;
      }
    }

    return {
      name: org.name,
      logoUrl,
      themeSidebar: org.theme_sidebar,
      themePrimary: org.theme_primary,
      slug: org.slug,
    };
  });
