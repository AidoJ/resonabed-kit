// Secure organisation management. SUPER_ADMIN ONLY.
// Every mutation verifies server-side that the caller has the super_admin role
// before doing anything. The client is never trusted.
//
// Actions:
//   - create:        Create org + first org_admin + optional seed from template.
//   - update:        Rename / rebrand an existing org.
//   - suspend:       status=suspended AND ban every user in the org.
//   - reactivate:    status=active AND lift bans on every user in the org.
//   - set_template:  Mark one org as the seeding template (clears the previous one).

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
      seed_services: boolean;
      seed_frequencies: boolean; // no-op flag (frequencies are global)
      seed_audio: boolean;
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
  | { type: "set_template"; org_id: string }
  | { type: "list_admins"; org_id: string }
  | { type: "reset_admin_password"; org_id: string; user_id: string }
  | {
      type: "create_admin";
      org_id: string;
      admin_email: string;
      admin_display_name?: string | null;
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

// Copy audio_files rows + underlying storage objects from template org into the new org.
async function seedAudioFromTemplate(
  admin: SupabaseClient,
  templateOrgId: string,
  newOrgId: string,
): Promise<{ copied: number }> {
  const { data: rows, error } = await admin
    .from("audio_files")
    .select("id, title, frequency_id, file_url, duration_seconds, is_active")
    .eq("org_id", templateOrgId);
  if (error) throw new Error(`audio list: ${error.message}`);
  if (!rows || rows.length === 0) return { copied: 0 };

  let copied = 0;
  for (const src of rows) {
    if (!src.file_url) continue;
    // Insert audio_files row FIRST so the new id becomes the storage filename.
    const ext = (src.file_url.split(".").pop() ?? "bin").toLowerCase();
    const { data: inserted, error: insErr } = await admin
      .from("audio_files")
      .insert({
        org_id: newOrgId,
        title: src.title,
        frequency_id: src.frequency_id,
        duration_seconds: src.duration_seconds,
        is_active: src.is_active,
        file_url: "", // placeholder, updated after upload
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(`audio row: ${insErr?.message}`);

    const newPath = `${newOrgId}/${inserted.id}.${ext}`;

    const { data: blob, error: dlErr } = await admin.storage.from("audio-files").download(src.file_url);
    if (dlErr || !blob) {
      await admin.from("audio_files").delete().eq("id", inserted.id);
      throw new Error(`audio download (${src.file_url}): ${dlErr?.message}`);
    }
    const contentType = ext === "wav" ? "audio/wav" : "audio/mpeg";
    const { error: upErr } = await admin.storage
      .from("audio-files")
      .upload(newPath, blob, { contentType, upsert: false });
    if (upErr) {
      await admin.from("audio_files").delete().eq("id", inserted.id);
      throw new Error(`audio upload: ${upErr.message}`);
    }
    const { error: pathErr } = await admin
      .from("audio_files")
      .update({ file_url: newPath })
      .eq("id", inserted.id);
    if (pathErr) throw new Error(`audio path update: ${pathErr.message}`);
    copied++;
  }

  return { copied };
}

async function seedServicesFromTemplate(
  admin: SupabaseClient,
  templateOrgId: string,
  newOrgId: string,
): Promise<{ copied: number }> {
  const { data: rows, error } = await admin
    .from("services")
    .select("name, duration_minutes, buffer_minutes, price, is_active")
    .eq("org_id", templateOrgId);
  if (error) throw new Error(`services list: ${error.message}`);
  if (!rows || rows.length === 0) return { copied: 0 };
  const payload = rows.map((r) => ({ ...r, org_id: newOrgId }));
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

        // 2. Seed from template (best-effort atomic — rollback org on failure).
        try {
          const { data: template } = await admin
            .from("organisations")
            .select("id")
            .eq("is_template", true)
            .maybeSingle();
          const templateId = template?.id as string | undefined;

          if (templateId && templateId !== newOrgId) {
            if (body.seed_services) await seedServicesFromTemplate(admin, templateId, newOrgId);
            if (body.seed_audio) await seedAudioFromTemplate(admin, templateId, newOrgId);
          }
          // seed_frequencies is a no-op: frequencies table is global (no org_id).
        } catch (e) {
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: `Seeding failed: ${e instanceof Error ? e.message : String(e)}` });
        }

        // 3. Create first org_admin user.
        const password = generatePassword(20);
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: body.admin_email.trim(),
          password,
          email_confirm: true,
          user_metadata: { display_name: body.admin_display_name ?? null },
          app_metadata: { must_change_password: true },
        });
        if (createErr || !created.user) {
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: createErr?.message ?? "Admin create failed" });
        }
        const uid = created.user.id;

        const { error: profileErr } = await admin
          .from("profiles")
          .update({
            org_id: newOrgId,
            display_name: body.admin_display_name ?? null,
            is_active: true,
          })
          .eq("id", uid);
        if (profileErr) {
          await admin.auth.admin.deleteUser(uid);
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: profileErr.message });
        }
        const { error: roleErr } = await admin
          .from("user_roles")
          .insert({ user_id: uid, org_id: newOrgId, role: "org_admin" });
        if (roleErr) {
          await admin.auth.admin.deleteUser(uid);
          await admin.from("organisations").delete().eq("id", newOrgId);
          return json(400, { error: roleErr.message });
        }

        return json(200, {
          ok: true,
          org_id: newOrgId,
          admin_user_id: uid,
          admin_email: body.admin_email.trim(),
          temporary_password: password,
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

      case "set_template": {
        // Clear any existing template first, then set the new one.
        const { error: clearErr } = await admin
          .from("organisations")
          .update({ is_template: false })
          .eq("is_template", true);
        if (clearErr) return json(400, { error: clearErr.message });
        const { error: setErr } = await admin
          .from("organisations")
          .update({ is_template: true })
          .eq("id", body.org_id);
        if (setErr) return json(400, { error: setErr.message });
        return json(200, { ok: true });
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
            .update({ org_id: body.org_id, display_name: displayName, is_active: true })
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
            { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
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

      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
