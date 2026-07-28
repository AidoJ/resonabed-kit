// Secure team-member management. Never trusts anything from the client.
// The caller MUST be signed in. The function verifies server-side that the
// caller is a super_admin, or an org_admin of the SAME org as the target.
// super_admin can never be created, granted, or revoked through here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { type: "create"; org_id: string; email: string; display_name?: string | null; role: "practitioner" | "org_admin" }
  | { type: "deactivate"; user_id: string }
  | { type: "reactivate"; user_id: string }
  | { type: "change_role"; user_id: string; role: "practitioner" | "org_admin" }
  | { type: "delete"; user_id: string }
  | { type: "reset_password"; user_id: string }
  | { type: "clear_must_change_password"; user_id: string };

const FAR_FUTURE = "2999-12-31T00:00:00Z";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });

  // Identify caller with the publishable key + their JWT (respects RLS).
  const asCaller = createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userRes.user) return json(401, { error: "Not signed in" });
  const callerId = userRes.user.id;

  // Admin client — service role, RLS bypassed. Used ONLY after authorization.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Caller roles
  const { data: callerRoles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", callerId);
  if (rolesErr) return json(500, { error: rolesErr.message });
  const isSuper = !!callerRoles?.some((r) => r.role === "super_admin");
  const callerAdminOrgs = new Set(
    (callerRoles ?? []).filter((r) => r.role === "org_admin" && r.org_id).map((r) => r.org_id as string),
  );

  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // Resolve the org that this action targets.
  const targetOrgFromUser = async (uid: string): Promise<string | null> => {
    const { data } = await admin.from("profiles").select("org_id").eq("id", uid).maybeSingle();
    return (data?.org_id as string | undefined) ?? null;
  };

  const authorize = async (orgId: string | null) => {
    if (isSuper) return true;
    if (!orgId) return false;
    return callerAdminOrgs.has(orgId);
  };

  try {
    switch (body.type) {
      case "create": {
        if (body.role !== "practitioner" && body.role !== "org_admin") {
          return json(400, { error: "Invalid role" });
        }
        if (!(await authorize(body.org_id))) return json(403, { error: "Forbidden" });

        const password = generatePassword(20);
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: body.email,
          password,
          email_confirm: true,
          user_metadata: { display_name: body.display_name ?? null },
          app_metadata: { must_change_password: true },
        });
        if (createErr || !created.user) return json(400, { error: createErr?.message ?? "Create failed" });

        // Attach org + role. handle_new_user() already created the profile row.
        const uid = created.user.id;
        const { error: profileErr } = await admin
          .from("profiles")
          .update({ org_id: body.org_id, display_name: body.display_name ?? null, is_active: true })
          .eq("id", uid);
        if (profileErr) {
          // Cleanup on failure
          await admin.auth.admin.deleteUser(uid);
          return json(400, { error: profileErr.message });
        }
        const { error: roleErr } = await admin
          .from("user_roles")
          .insert({ user_id: uid, org_id: body.org_id, role: body.role });
        if (roleErr) {
          await admin.auth.admin.deleteUser(uid);
          return json(400, { error: roleErr.message });
        }

        return json(200, { ok: true, user_id: uid, temporary_password: password });
      }

      case "deactivate": {
        const org = await targetOrgFromUser(body.user_id);
        if (!(await authorize(org))) return json(403, { error: "Forbidden" });
        if (body.user_id === callerId) return json(400, { error: "Cannot deactivate yourself" });

        // Refuse to touch super_admins.
        const { data: tRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
        if (tRoles?.some((r) => r.role === "super_admin")) {
          return json(403, { error: "Cannot deactivate a super admin" });
        }

        const { error: banErr } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: "876000h", // ~100 years
        } as unknown as { ban_duration: string });
        if (banErr) return json(400, { error: banErr.message });

        // Kill live sessions immediately
        await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});

        await admin.from("profiles").update({ is_active: false }).eq("id", body.user_id);
        return json(200, { ok: true });
      }

      case "reactivate": {
        const org = await targetOrgFromUser(body.user_id);
        if (!(await authorize(org))) return json(403, { error: "Forbidden" });

        const { error: unbanErr } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: "none",
        } as unknown as { ban_duration: string });
        if (unbanErr) return json(400, { error: unbanErr.message });

        await admin.from("profiles").update({ is_active: true }).eq("id", body.user_id);
        return json(200, { ok: true });
      }

      case "change_role": {
        if (body.role !== "practitioner" && body.role !== "org_admin") {
          return json(400, { error: "Invalid role" });
        }
        const org = await targetOrgFromUser(body.user_id);
        if (!(await authorize(org))) return json(403, { error: "Forbidden" });
        if (!org) return json(400, { error: "Target has no org" });

        // Refuse to modify super_admins.
        const { data: tRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
        if (tRoles?.some((r) => r.role === "super_admin")) {
          return json(403, { error: "Cannot modify a super admin" });
        }

        const isTargetAdmin = !!tRoles?.some((r) => r.role === "org_admin");
        if (isTargetAdmin && body.role === "practitioner") {
          if (body.user_id === callerId && !isSuper) {
            return json(400, { error: "You cannot remove your own admin access." });
          }
          const { count } = await admin
            .from("user_roles")
            .select("user_id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("role", "org_admin");
          if ((count ?? 0) <= 1) {
            return json(400, {
              error: "This is the only org admin. Promote another member first.",
            });
          }
        }


        // Remove existing org-scoped roles (practitioner/org_admin), keep others.
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", body.user_id)
          .in("role", ["practitioner", "org_admin"]);

        const { error: insErr } = await admin
          .from("user_roles")
          .insert({ user_id: body.user_id, org_id: org, role: body.role });
        if (insErr) return json(400, { error: insErr.message });
        return json(200, { ok: true });
      }

      case "delete": {
        const org = await targetOrgFromUser(body.user_id);
        if (!(await authorize(org))) return json(403, { error: "Forbidden" });
        if (body.user_id === callerId) return json(400, { error: "Cannot delete yourself" });

        // Refuse to delete super_admins or org_admins.
        const { data: tRoles } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", body.user_id);
        if (tRoles?.some((r) => r.role === "super_admin")) {
          return json(403, { error: "Cannot delete a super admin" });
        }
        if (tRoles?.some((r) => r.role === "org_admin")) {
          return json(403, {
            error:
              "Org admins cannot be removed — change their role to practitioner first, or contact Resonabed.",
          });
        }

        // Kill live sessions and delete the auth user. Downstream FKs
        // (profiles, user_roles) cascade on delete of the auth user.
        await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});
        const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
        if (delErr) return json(400, { error: delErr.message });
        return json(200, { ok: true });
      }

      case "reset_password": {
        const org = await targetOrgFromUser(body.user_id);
        if (!(await authorize(org))) return json(403, { error: "Forbidden" });

        // Refuse to reset a super_admin's password from here.
        const { data: tRoles } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", body.user_id);
        if (tRoles?.some((r) => r.role === "super_admin")) {
          return json(403, { error: "Cannot reset a super admin from here" });
        }

        const password = generatePassword(20);
        const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(body.user_id, {
          password,
          app_metadata: { must_change_password: true },
        });
        if (updErr) return json(400, { error: updErr.message });
        // Kick existing sessions so the new password must be used.
        await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});
        return json(200, {
          ok: true,
          temporary_password: password,
          email: updated?.user?.email ?? null,
        });
      }



      case "clear_must_change_password": {
        // Caller must be clearing their own flag (after successful password update)
        if (body.user_id !== callerId) return json(403, { error: "Forbidden" });
        // Supabase MERGES app_metadata on updateUserById — deleting the key
        // locally has no effect. Set it to null explicitly to clear it.
        const { error: updErr } = await admin.auth.admin.updateUserById(callerId, {
          app_metadata: { must_change_password: null },
        });
        if (updErr) return json(400, { error: updErr.message });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
