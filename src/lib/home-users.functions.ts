import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** Platform-admin management of home (personal kit) user accounts. */

const uuid = z.string().uuid();

type AuthedCtx = { supabase: SupabaseClient<Database>; userId: string };

async function requireSuperAdmin(context: AuthedCtx) {
  const { data, error } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Resonabed platform admins can manage home users");
}

export interface HomeUserRow {
  userId: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export const listHomeUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeUserRow[]> => {
    await requireSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("home_accounts")
      .select("user_id, email, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      userId: r.user_id as string,
      email: r.email as string,
      displayName: (r.display_name as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

/**
 * Changes the sign-in email for a home user. Updates the auth login first,
 * then the mirrored row on home_accounts so the two stay in step.
 */
export const updateHomeUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: uuid,
        email: z.string().trim().email().max(200),
        display_name: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();

    const { data: account, error: accountError } = await supabaseAdmin
      .from("home_accounts")
      .select("user_id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (accountError) throw new Error(accountError.message);
    if (!account) throw new Error("That home user account no longer exists");

    // Reject an address already in use by another login.
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw new Error(listError.message);
    const clash = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === email && u.id !== data.user_id,
    );
    if (clash) throw new Error("Another account already uses that email address");

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email,
      email_confirm: true,
    });
    if (authError) throw new Error(authError.message);

    const patch: { email: string; display_name?: string } = { email };
    if (data.display_name !== undefined && data.display_name.length > 0) {
      patch.display_name = data.display_name;
    }
    const { error: mirrorError } = await supabaseAdmin
      .from("home_accounts")
      .update(patch)
      .eq("user_id", data.user_id);
    if (mirrorError) throw new Error(mirrorError.message);

    return { ok: true, email };
  });
