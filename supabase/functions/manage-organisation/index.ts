// Secure organisation management. SUPER_ADMIN ONLY.
// Every mutation verifies server-side that the caller has the super_admin role
// before doing anything. The client is never trusted.
//
// Actions:
//   - create:        Create org + first org_admin + seed services from the global catalogue.
//   - update:        Rename / rebrand an existing org.
//   - suspend:       status=suspended AND ban every user in the org.
//   - reactivate:    status=active AND lift bans on every user in the org.


import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAR_FUTURE_BAN = "876000h"; // ~100 years

type Action =
  | {
      type: "create";
      name: string;
      brand_color?: string | null;
      logo_path?: string | null;
      admin_email: string;
      admin_display_name?: string | null;
      admin_phone?: string | null;
      seed_services: boolean;
      seed_frequencies: boolean; // no-op flag (frequencies are global)
      seed_audio?: boolean; // deprecated no-op: global audio library is shared, not copied
    }
  | {
      type: "update";
      org_id: string;
      name?: string;
      brand_color?: string | null;
      logo_path?: string | null;
    }
  | { type: "suspend"; org_id: string }
  | { type: "reactivate"; org_id: string }
  
  | { type: "list_admins"; org_id: string }
  | { type: "reset_admin_password"; org_id: string; user_id: string }
  | { type: "revoke_admin"; org_id: string; user_id: string }
  | {
      type: "create_admin";
      org_id: string;
      admin_email: string;
      admin_display_name?: string | null;
      admin_phone?: string | null;
    };


function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function generatePassword(len = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

async function isSuperAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

// Audio seeding is deliberately not done — the shipped Solfeggio library is
// global (org_id IS NULL) and shared with every organisation via RLS, so new
// clinics inherit it automatically without any copying.


async function seedServicesFromGlobalCatalogue(
  admin: SupabaseClient,
  newOrgId: string,
): Promise<{ copied: number }> {
  // Copy the master catalogue (org_id IS NULL) into the new org as its OWN
  // editable rows. Price starts at 0 — each clinic sets its own price.
  const { data: rows, error } = await admin
    .from("services")
    .select("name, duration_minutes, buffer_minutes, is_active")
    .is("org_id", null);
  if (error) throw new Error(`global services list: ${error.message}`);
  if (!rows || rows.length === 0) return { copied: 0 };
  const payload = rows.map((r) => ({ ...r, org_id: newOrgId, price: 0 }));
  const { error: insErr } = await admin.from("services").insert(payload);
  if (insErr) throw new Error(`services insert: ${insErr.message}`);
  return { copied: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });

  const asCaller = createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userRes.user) return json(401, { error: "Not signed in" });
  const callerId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Every action here is super_admin only.
  if (!(await isSuperAdmin(admin, callerId))) return json(403, { error: "Forbidden" });

  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  try {
    switch (body.type) {
      case "create": {
        if (!body.name?.trim()) return json(400, { error: "Name is required" });
        if (!body.admin_email?.trim()) return json(400, { error: "Admin email is required" });
        if (body.brand_color && !/^#[0-9a-fA-F]{6}$/.test(body.brand_color)) {
          return json(400, { error: "Invalid brand_color" });
        }

        // 1. Create the org.
        const { data: org, error: orgErr } = await admin
          .from("organisations")
          .insert({
            name: body.name.trim(),
            brand_color: body.brand_color ?? null,
            logo_path: body.logo_path ?? null,
            status: "active",
          })
          .select("id")
          .single();
        if (orgErr || !org) return json(400, { error: orgErr?.message ?? "org insert failed" });
        const newOrgId = org.id as string;

        // 2. Seed services from the global catalogue (best-effort atomic).
        try {
          if (body.seed_services) await seedServicesFromGlobalCatalogue(admin, newOrgId);
          // Frequencies and audio are shared globally via RLS — no copy needed.
        } catch (e) {
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: `Seeding failed: ${e instanceof Error ? e.message : String(e)}` });
        }

        // 3. Create or reuse the first org_admin user.
        const email = body.admin_email.trim();
        const displayName = body.admin_display_name ?? null;
        const phone = (body.admin_phone ?? null)?.toString().trim() || null;


        // Look for an existing auth user with that email (paginate).
        let existingId: string | null = null;
        for (let page = 1; page <= 20 && !existingId; page++) {
          const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) {
            await admin.from("organisations").delete().eq("id", newOrgId);
            return json(400, { error: listErr.message });
          }
          const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
          if (hit) existingId = hit.id;
          if (list.users.length < 200) break;
        }

        let uid: string;
        let password: string | null = null;

        if (existingId) {
          // Refuse to co-opt a user already tied to a different org.
          const { data: prof } = await admin
            .from("profiles")
            .select("org_id")
            .eq("id", existingId)
            .maybeSingle();
          if (prof?.org_id && prof.org_id !== newOrgId) {
            await admin.from("organisations").delete().eq("id", newOrgId);
            return json(400, {
              error: "That user already belongs to a different organisation. Choose a different admin email.",
            });
          }
          uid = existingId;
          const { error: upProfErr } = await admin
            .from("profiles")
            .update({ org_id: newOrgId, display_name: displayName ?? undefined, phone: phone ?? undefined, is_active: true })
            .eq("id", uid);

          if (upProfErr) {
            await admin.from("organisations").delete().eq("id", newOrgId);
            return json(400, { error: upProfErr.message });
          }
        } else {
          password = generatePassword(20);
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { display_name: displayName },
            app_metadata: { must_change_password: true },
          });
          if (createErr || !created.user) {
            await admin.from("organisations").delete().eq("id", newOrgId);
            return json(400, { error: createErr?.message ?? "Admin create failed" });
          }
          uid = created.user.id;
          const { error: profileErr } = await admin
            .from("profiles")
            .update({ org_id: newOrgId, display_name: displayName, phone, is_active: true })
            .eq("id", uid);

          if (profileErr) {
            await admin.auth.admin.deleteUser(uid);
            await admin.from("organisations").delete().eq("id", newOrgId);
            return json(400, { error: profileErr.message });
          }
        }

        const { error: roleErr } = await admin
          .from("user_roles")
          .upsert(
            { user_id: uid, org_id: newOrgId, role: "org_admin" },
            { onConflict: "user_id,role,org_id", ignoreDuplicates: true },
          );
        if (roleErr) {
          if (password) await admin.auth.admin.deleteUser(uid);
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: roleErr.message });
        }

        return json(200, {
          ok: true,
          org_id: newOrgId,
          admin_user_id: uid,
          admin_email: email,
          temporary_password: password, // null when reusing an existing user
          reused_existing_user: !password,
        });
      }

      case "update": {
        const patch: Record<string, unknown> = {};
        if (typeof body.name === "string") {
          if (!body.name.trim()) return json(400, { error: "Name cannot be empty" });
          patch.name = body.name.trim();
        }
        if (body.brand_color !== undefined) {
          if (body.brand_color && !/^#[0-9a-fA-F]{6}$/.test(body.brand_color)) {
            return json(400, { error: "Invalid brand_color" });
          }
          patch.brand_color = body.brand_color;
        }
        if (body.logo_path !== undefined) patch.logo_path = body.logo_path;
        if (Object.keys(patch).length === 0) return json(400, { error: "Nothing to update" });

        const { error } = await admin.from("organisations").update(patch).eq("id", body.org_id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      case "suspend": {
        const { data: users, error: usersErr } = await admin
          .from("profiles")
          .select("id")
          .eq("org_id", body.org_id);
        if (usersErr) return json(400, { error: usersErr.message });

        // Never ban super_admins even if they happen to sit in this org.
        const userIds = (users ?? []).map((u) => u.id as string);
        const { data: superRows } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        const superSet = new Set((superRows ?? []).map((r) => r.user_id as string));

        for (const uid of userIds) {
          if (superSet.has(uid)) continue;
          await admin.auth.admin.updateUserById(uid, {
            ban_duration: FAR_FUTURE_BAN,
          } as unknown as { ban_duration: string });
          await admin.auth.admin.signOut(uid, "global").catch(() => {});
          await admin.from("profiles").update({ is_active: false }).eq("id", uid);
        }

        const { error: statusErr } = await admin
          .from("organisations")
          .update({ status: "suspended" })
          .eq("id", body.org_id);
        if (statusErr) return json(400, { error: statusErr.message });
        return json(200, { ok: true, users_affected: userIds.length - superSet.size });
      }

      case "reactivate": {
        const { data: users, error: usersErr } = await admin
          .from("profiles")
          .select("id")
          .eq("org_id", body.org_id);
        if (usersErr) return json(400, { error: usersErr.message });

        for (const u of users ?? []) {
          const uid = u.id as string;
          await admin.auth.admin.updateUserById(uid, {
            ban_duration: "none",
          } as unknown as { ban_duration: string });
          await admin.from("profiles").update({ is_active: true }).eq("id", uid);
        }

        const { error: statusErr } = await admin
          .from("organisations")
          .update({ status: "active" })
          .eq("id", body.org_id);
        if (statusErr) return json(400, { error: statusErr.message });
        return json(200, { ok: true, users_affected: (users ?? []).length });
      }




      case "list_admins": {
        const { data: roleRows, error: rolesErr } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("org_id", body.org_id)
          .eq("role", "org_admin");
        if (rolesErr) return json(400, { error: rolesErr.message });
        const ids = (roleRows ?? []).map((r) => r.user_id as string);
        if (ids.length === 0) return json(200, { admins: [] });

        const { data: profs } = await admin
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        const nameById = new Map((profs ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]));

        const admins: Array<{ user_id: string; email: string | null; display_name: string | null }> = [];
        for (const uid of ids) {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          admins.push({
            user_id: uid,
            email: u.user?.email ?? null,
            display_name: nameById.get(uid) ?? null,
          });
        }
        return json(200, { admins });
      }

      case "reset_admin_password": {
        // Confirm the target really is an org_admin of that org.
        const { data: role, error: roleErr } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("org_id", body.org_id)
          .eq("role", "org_admin")
          .eq("user_id", body.user_id)
          .maybeSingle();
        if (roleErr) return json(400, { error: roleErr.message });
        if (!role) return json(404, { error: "User is not an org_admin of this organisation" });

        const password = generatePassword(20);
        const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(body.user_id, {
          password,
          app_metadata: { must_change_password: true },
        });
        if (updErr) return json(400, { error: updErr.message });

        // Force re-login so the new password takes effect immediately.
        await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});

        return json(200, {
          ok: true,
          user_id: body.user_id,
          email: updated.user?.email ?? null,
          temporary_password: password,
        });
      }

      case "create_admin": {
        if (!body.admin_email?.trim()) return json(400, { error: "Admin email is required" });

        // Confirm org exists.
        const { data: org, error: orgErr } = await admin
          .from("organisations")
          .select("id")
          .eq("id", body.org_id)
          .maybeSingle();
        if (orgErr) return json(400, { error: orgErr.message });
        if (!org) return json(404, { error: "Organisation not found" });

        const email = body.admin_email.trim();
        const displayName = body.admin_display_name?.trim() || null;
        const phone = (body.admin_phone ?? null)?.toString().trim() || null;


        // Look for an existing auth user with that email (paginate).
        let existingId: string | null = null;
        for (let page = 1; page <= 20 && !existingId; page++) {
          const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) return json(400, { error: listErr.message });
          const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
          if (hit) existingId = hit.id;
          if (list.users.length < 200) break;
        }

        let uid: string;
        let tempPassword: string | null = null;

        if (existingId) {
          uid = existingId;
          // Refuse to co-opt a user already tied to a different org.
          const { data: prof } = await admin
            .from("profiles")
            .select("org_id")
            .eq("id", uid)
            .maybeSingle();
          if (prof?.org_id && prof.org_id !== body.org_id) {
            return json(400, {
              error: "That user already belongs to a different organisation.",
            });
          }
          const { error: upProfErr } = await admin
            .from("profiles")
            .update({
              org_id: body.org_id,
              display_name: displayName ?? undefined,
              phone: phone ?? undefined,
              is_active: true,
            })
            .eq("id", uid);
          if (upProfErr) return json(400, { error: upProfErr.message });

        } else {
          tempPassword = generatePassword(20);
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { display_name: displayName },
            app_metadata: { must_change_password: true },
          });
          if (createErr || !created.user) {
            return json(400, { error: createErr?.message ?? "Admin create failed" });
          }
          uid = created.user.id;
          const { error: profileErr } = await admin
            .from("profiles")
            .update({ org_id: body.org_id, display_name: displayName, phone, is_active: true })
            .eq("id", uid);

          if (profileErr) {
            await admin.auth.admin.deleteUser(uid);
            return json(400, { error: profileErr.message });
          }
        }

        // Idempotent role grant.
        const { error: roleErr } = await admin
          .from("user_roles")
          .upsert(
            { user_id: uid, org_id: body.org_id, role: "org_admin" },
            { onConflict: "user_id,role,org_id", ignoreDuplicates: true },
          );
        if (roleErr) return json(400, { error: roleErr.message });

        return json(200, {
          ok: true,
          user_id: uid,
          email,
          temporary_password: tempPassword, // null when reusing an existing user
          reused_existing_user: !tempPassword,
        });
      }

      case "revoke_admin": {
        // Confirm the target really is an org_admin of that org.
        const { data: role, error: roleLookupErr } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("org_id", body.org_id)
          .eq("role", "org_admin")
          .eq("user_id", body.user_id)
          .maybeSingle();
        if (roleLookupErr) return json(400, { error: roleLookupErr.message });
        if (!role)
          return json(404, { error: "User is not an org_admin of this organisation" });

        const { error: delErr } = await admin
          .from("user_roles")
          .delete()
          .eq("org_id", body.org_id)
          .eq("role", "org_admin")
          .eq("user_id", body.user_id);
        if (delErr) return json(400, { error: delErr.message });

        // Force sign-out so the revoked admin loses access on all devices immediately.
        await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});

        return json(200, { ok: true, user_id: body.user_id });
      }

      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
