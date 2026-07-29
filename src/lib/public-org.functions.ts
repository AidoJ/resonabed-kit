import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicOrg = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  slug: string;
  public_blurb: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  public_booking_enabled: boolean;
  timezone: string | null;
};

export type PublicService = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
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

    const [orgRes, svcRes] = await Promise.all([
      supabase.rpc("get_public_org", { p_slug: data.slug }),
      supabase.rpc("get_public_services", { p_slug: data.slug }),
    ]);

    const org = (orgRes.data as PublicOrg[] | null)?.[0] ?? null;
    if (!org) return { org: null, services: [] as PublicService[], logoUrl: null };

    // Logos live in a private bucket; sign a short-lived URL for the public page.
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
          .createSignedUrl(orgRow.logo_path, 60 * 60);
        logoUrl = signed.data?.signedUrl ?? null;
      }
    }

    return {
      org,
      services: (svcRes.data as PublicService[] | null) ?? [],
      logoUrl,
    };
  });
