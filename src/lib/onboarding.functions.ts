import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Platform-admin view of the clinic onboarding queue: paid business orders
 * waiting for a human to set slug, ABN and clinic type before the org exists.
 */

type AuthedCtx = { supabase: SupabaseClient<Database>; userId: string };

async function requireSuperAdmin(context: AuthedCtx) {
  const { data, error } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Resonabed platform admins can manage clinic onboarding");
}

export interface OnboardingOrderRow {
  id: string;
  source: string;
  source_ref: string | null;
  business_name: string | null;
  abn: string | null;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  package_key: string | null;
  plan: string | null;
  shipping_address: string | null;
  amount_cents: number | null;
  status: string;
  org_id: string | null;
  provisioned_at: string | null;
  notes: string | null;
  created_at: string;
}

const SELECT =
  "id, source, source_ref, business_name, abn, contact_name, contact_email, contact_phone, package_key, plan, shipping_address, amount_cents, status, org_id, provisioned_at, notes, created_at";

export const listOnboardingOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingOrderRow[]> => {
    await requireSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("kit_onboarding_orders")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as OnboardingOrderRow[];
  });

/** Marks an order provisioned once the org and admin user exist. */
export const markOnboardingOrderProvisioned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase
      .from("kit_onboarding_orders")
      .update({
        status: "provisioned",
        org_id: data.orgId,
        provisioned_by: context.userId,
        provisioned_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOnboardingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "provisioned", "cancelled"]).optional(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const patch: { status?: string; notes?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("kit_onboarding_orders")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Manual remedy for a wrong choice at checkout: a buyer who paid as personal
 * but actually runs a clinic can be moved into the onboarding queue by hand,
 * without a refund and rebuy. Idempotent on (source, source_ref).
 */
export const createOnboardingOrderManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessName: z.string().trim().max(160).optional(),
        contactName: z.string().trim().max(120).optional(),
        contactEmail: z.string().trim().email().max(200),
        contactPhone: z.string().trim().max(40).optional(),
        abn: z.string().trim().max(20).optional(),
        packageKey: z.string().trim().max(40).optional(),
        reference: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { recordOnboardingOrder } = await import("@/lib/onboarding.server");
    const result = await recordOnboardingOrder({
      source: "manual",
      sourceRef: data.reference || null,
      businessName: data.businessName ?? null,
      abn: data.abn ?? null,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone ?? null,
      packageKey: data.packageKey ?? null,
      plan: null,
      shippingAddress: null,
      amountCents: null,
      notes: data.notes ?? "Added by hand after a wrong choice at checkout.",
    });
    return result;
  });
