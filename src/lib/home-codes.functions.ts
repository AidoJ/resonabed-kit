import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Platform-admin management of home-user kit access codes. */

const uuid = z.string().uuid();

async function requireSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Resonabed platform admins can manage access codes");
}

export interface AccessCodeRow {
  id: string;
  code: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  package_key: string | null;
  source: string;
  source_ref: string | null;
  status: string;
  issued_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export const listAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessCodeRow[]> => {
    await requireSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("kit_access_codes")
      .select(
        "id, code, buyer_email, buyer_name, buyer_phone, package_key, source, source_ref, status, issued_at, redeemed_at, revoked_at, revoked_reason",
      )
      .order("issued_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as AccessCodeRow[];
  });

/** Manually issue a code, for bank-transfer or phone orders. */
export const issueAccessCodeManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        buyerEmail: z.string().trim().email().max(200),
        buyerName: z.string().trim().max(120).optional(),
        buyerPhone: z.string().trim().max(40).optional(),
        packageKey: z.string().trim().max(40).optional(),
        reference: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { issueAccessCode } = await import("@/lib/home-access.server");
    const issued = await issueAccessCode({
      buyerEmail: data.buyerEmail,
      buyerName: data.buyerName ?? null,
      buyerPhone: data.buyerPhone ?? null,
      packageKey: data.packageKey ?? null,
      source: "manual",
      sourceRef: data.reference || null,
    });
    return { code: issued.code, alreadyExisted: issued.alreadyExisted };
  });

export const revokeAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, reason: z.string().trim().max(300).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("kit_access_codes")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: data.reason ?? null,
      })
      .eq("id", data.id)
      .eq("status", "issued");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Revokes the old code and issues + emails a fresh one for the same order. */
export const regenerateAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, email: z.string().trim().email().max(200).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: old, error } = await supabaseAdmin
      .from("kit_access_codes")
      .select("id, buyer_email, buyer_name, buyer_phone, package_key, source, source_ref, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!old) throw new Error("Access code not found");
    if (old.status === "redeemed") {
      throw new Error("That code has already created an account, so it cannot be regenerated");
    }

    // Free the source_ref uniqueness slot before issuing the replacement.
    const { error: revokeError } = await supabaseAdmin
      .from("kit_access_codes")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: "Replaced by a regenerated code",
      })
      .eq("id", old.id);
    if (revokeError) throw new Error(revokeError.message);

    const { issueAccessCode } = await import("@/lib/home-access.server");
    const issued = await issueAccessCode({
      buyerEmail: data.email?.trim().toLowerCase() || old.buyer_email,
      buyerName: old.buyer_name,
      buyerPhone: old.buyer_phone,
      packageKey: old.package_key,
      source: old.source,
      sourceRef: old.source_ref,
    });

    await supabaseAdmin
      .from("kit_access_codes")
      .update({ replaced_by_id: issued.id })
      .eq("id", old.id);

    return { code: issued.code };
  });

export const resendAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, email: z.string().trim().email().max(200).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("kit_access_codes")
      .select("code, buyer_email, buyer_name, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Access code not found");
    if (row.status !== "issued") throw new Error("Only an unused code can be resent");

    const to = data.email?.trim().toLowerCase() || row.buyer_email;
    if (to !== row.buyer_email) {
      const { error: updateError } = await supabaseAdmin
        .from("kit_access_codes")
        .update({ buyer_email: to })
        .eq("id", data.id);
      if (updateError) throw new Error(updateError.message);
    }

    const { sendAccessCodeEmail } = await import("@/lib/home-access.server");
    const result = await sendAccessCodeEmail({
      to,
      code: row.code,
      name: row.buyer_name,
      isResend: true,
    });
    return { sent: result.sent, email: to };
  });
