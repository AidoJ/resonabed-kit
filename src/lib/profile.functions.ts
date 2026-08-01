import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function requireSuper(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// ---------- My profile (any signed-in user) ----------

export interface MyProfile {
  userId: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  bio: string | null;
  avatarPath: string | null;
  avatarSignedUrl: string | null;
  orgId: string | null;
  orgName: string | null;
  roles: string[];
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId, claims } = context;
    const [{ data: profile, error }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, phone, bio, avatar_path, org_id, organisations:org_id(name)")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (error) throw new Error(error.message);

    let avatarSignedUrl: string | null = null;
    if (profile?.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("team-avatars")
        .createSignedUrl(profile.avatar_path, 3600);
      avatarSignedUrl = signed?.signedUrl ?? null;
    }
    const org = profile?.organisations as { name: string } | null | undefined;

    return {
      userId,
      email: (claims.email as string) ?? null,
      displayName: profile?.display_name ?? null,
      phone: (profile?.phone as string | null) ?? null,
      bio: (profile?.bio as string | null) ?? null,
      avatarPath: (profile?.avatar_path as string | null) ?? null,
      avatarSignedUrl,
      orgId: (profile?.org_id as string | null) ?? null,
      orgName: org?.name ?? null,
      roles: (roleRows ?? []).map((r) => r.role as string),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        display_name: z.string().min(1).max(120),
        phone: z.string().max(40).nullable().optional(),
        bio: z.string().max(2000).nullable().optional(),
        avatar_path: z.string().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      display_name: string;
      phone?: string | null;
      bio?: string | null;
      avatar_path?: string | null;
    } = { display_name: data.display_name.trim() };
    if (data.phone !== undefined) patch.phone = data.phone?.trim() ? data.phone.trim() : null;
    if (data.bio !== undefined) patch.bio = data.bio?.trim() ? data.bio.trim() : null;
    if (data.avatar_path !== undefined) patch.avatar_path = data.avatar_path;

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Platform (super) admins ----------

export interface PlatformAdmin {
  userId: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: string;
  isSelf: boolean;
}

export const listPlatformAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAdmin[]> => {
    await requireSuper(context);
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "super_admin")
      .order("created_at");
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.user_id as string);
    const byId = new Map<string, { display_name: string | null; is_active: boolean }>();
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name, is_active")
        .in("id", ids);
      for (const p of profs ?? []) byId.set(p.id, { display_name: p.display_name, is_active: p.is_active });
    }
    return (data ?? []).map((r) => {
      const p = byId.get(r.user_id as string);
      return {
        userId: r.user_id as string,
        displayName: p?.display_name ?? null,
        isActive: p?.is_active ?? true,
        createdAt: r.created_at as string,
        isSelf: r.user_id === context.userId,
      };
    });
  });

export const createPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(200),
        display_name: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const buf = new Uint8Array(20);
    crypto.getRandomValues(buf);
    let tempPassword = "";
    for (let i = 0; i < buf.length; i++) tempPassword += alphabet[buf[i]! % alphabet.length];

    // Find an existing auth user with this email, otherwise create one.
    let userId: string;
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw new Error(listErr.message);
    const match = list.users.find((u) => (u.email ?? "").toLowerCase() === email);

    if (match) {
      userId = match.id;
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        app_metadata: { ...(match.app_metadata ?? {}), must_change_password: true },
      });
      if (upErr) throw new Error(upErr.message);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { display_name: data.display_name.trim() },
        app_metadata: { must_change_password: true },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, display_name: data.display_name.trim() }, { onConflict: "id" });

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "super_admin", org_id: null },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);

    return { userId, email, tempPassword };
  });

export const revokePlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuper(context);
    if (data.user_id === context.userId) {
      throw new Error("You cannot remove your own platform admin access.");
    }
    const { count } = await context.supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) <= 1) throw new Error("At least one platform admin must remain.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
