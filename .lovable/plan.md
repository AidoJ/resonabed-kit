
# ResonaBed — Foundation (revised)

Multi-tenant vibroacoustic therapy app. This phase delivers: Lovable Cloud enabled, full schema with strict RLS, private storage bucket for audio, email/password login, and a role-aware dashboard shell.

## 1. Enable Lovable Cloud

Provisions Postgres, Auth, Storage.

## 2. Database schema (single migration)

### Enums
- `app_role`: `super_admin | org_admin | practitioner`
- `org_status`: `active | suspended`
- `payment_method`: `cash | eftpos | payid | other | none`
- `session_status`: `draft | completed | cancelled`

### Tables
All in `public`, `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`. Tables marked ✳ also get `updated_at timestamptz default now()`.

- ✳ `organisations` — name, logo_url, brand_color, status
- ✳ `profiles` — id references `auth.users(id)` on delete cascade, org_id, display_name
- `user_roles` — user_id, role, org_id (nullable; check: null iff role=super_admin), unique (user_id, role, org_id)
- ✳ `clients` — org_id, first_name, last_name, email, phone, date_of_birth
- ✳ `services` — org_id, name, duration_minutes, price numeric(10,2), is_active default true
- `frequencies` — hz numeric, name, description, benefits, color (GLOBAL — no org_id)
- ✳ `audio_files` — org_id, frequency_id, title, file_url, duration_seconds, is_active
- ✳ `sessions` — org_id, client_id, practitioner_id, service_id, pain_level int, stress_level int, sleep_quality int, body_areas text[], primary_goals text[], health_concerns text[], contraindications text[], consent_given bool, recommended_frequency_id, practitioner_notes, payment_method, payment_amount numeric(10,2), status session_status

Every table gets explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role`. No `anon` grants.

### updated_at trigger

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
```

Attached as `before update` trigger on each ✳ table.

### Security-definer helpers
- `public.has_role(_user_id uuid, _role app_role) returns boolean`
- `public.is_super_admin(_user_id uuid) returns boolean`
- `public.is_org_admin(_user_id uuid, _org_id uuid) returns boolean`
- `public.current_org_id() returns uuid` — from `profiles.org_id` for `auth.uid()`

All `SECURITY DEFINER STABLE set search_path = public`.

### Auth trigger
`on_auth_user_created` → inserts `profiles` row (org_id null). No role auto-assigned.

### RLS

All tables RLS enabled. No `USING (true)` for anon. `frequencies` SELECT is `TO authenticated USING (true)` only.

**Org-scoped tables — split by op:**
- `services`, `audio_files`: SELECT/INSERT/UPDATE/DELETE `TO authenticated` where `is_super_admin(auth.uid()) OR org_id = current_org_id()`.
- `clients`, `sessions` (health data): **SELECT/INSERT/UPDATE** for any authenticated member of the org (or super_admin). **DELETE** restricted to super_admin OR org_admin of that org:
  ```sql
  create policy "clients_delete_admin_only" on public.clients
    for delete to authenticated
    using (public.is_super_admin(auth.uid())
           or public.is_org_admin(auth.uid(), org_id));
  -- same shape for sessions
  ```

**organisations:** SELECT for super_admin or own org; INSERT/UPDATE/DELETE super_admin only.

**profiles:** SELECT self / same-org / super_admin. UPDATE self or super_admin. INSERT only via trigger.

**user_roles — explicit policies:**
```sql
-- SELECT: self, super_admin, or org_admin of same org
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or (org_id is not null and public.is_org_admin(auth.uid(), org_id))
  );

-- INSERT: super_admin (any), or org_admin within own org for non-super_admin roles
create policy "user_roles_insert" on public.user_roles
  for insert to authenticated
  with check (
    public.is_super_admin(auth.uid())
    or (
      role <> 'super_admin'
      and org_id = public.current_org_id()
      and public.is_org_admin(auth.uid(), public.current_org_id())
    )
  );

-- UPDATE: same rules on both existing row and new row
create policy "user_roles_update" on public.user_roles
  for update to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (
      role <> 'super_admin'
      and org_id = public.current_org_id()
      and public.is_org_admin(auth.uid(), public.current_org_id())
    )
  )
  with check (
    public.is_super_admin(auth.uid())
    or (
      role <> 'super_admin'
      and org_id = public.current_org_id()
      and public.is_org_admin(auth.uid(), public.current_org_id())
    )
  );

-- DELETE: super_admin, or org_admin removing non-super_admin roles in own org
create policy "user_roles_delete" on public.user_roles
  for delete to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (
      role <> 'super_admin'
      and org_id = public.current_org_id()
      and public.is_org_admin(auth.uid(), public.current_org_id())
    )
  );
```

**frequencies:** SELECT to authenticated; INSERT/UPDATE/DELETE super_admin only.

## 3. Storage — `audio-files` bucket

Private (public=false), via `supabase--storage_create_bucket`. Path convention `{org_id}/{audio_file_id}.{ext}`. Policies on `storage.objects` for all four ops: allowed when `(storage.foldername(name))[1]::uuid = current_org_id()` OR `is_super_admin(auth.uid())`. No anon policy. Client access via signed URLs.

## 4. First super_admin bootstrap (no auth.users writes in migration)

Migration creates schema only. After it runs:
1. You sign up the first account through the normal auth flow (I'll surface the login route; email confirmation may need to be off in Cloud settings for a smooth first login — I'll flag this).
2. I hand you a single SQL statement to run via the insert tool:
   ```sql
   insert into public.user_roles (user_id, role, org_id)
   values ('<paste-user-id>', 'super_admin', null);
   ```

## 5. Client-side auth wiring

- Managed `src/routes/_authenticated/route.tsx` gate (integration-owned).
- `attachSupabaseAuth` appended to `functionMiddleware` in `src/start.ts`.
- `__root.tsx`: real ResonaBed title/description/og tags; single `onAuthStateChange` subscriber filtering SIGNED_IN/OUT/USER_UPDATED (router.invalidate always; queryClient.invalidateQueries except on SIGNED_OUT).

## 6. Routes

- `/auth` (public) — email/password login only; redirects to `/dashboard` if signed in.
- `/_authenticated/dashboard` — welcome + org name + role badges via `getCurrentUserContext` server fn.
- Stub routes (placeholder panels, sidebar visibility role-gated):
  `/_authenticated/clients`, `/services`, `/sessions`, `/frequencies`, `/audio`, `/admin` (org_admin + super_admin).
- `/` redirects to `/dashboard` when signed in, else `/auth`.

## 7. UI shell

`AppSidebar` (collapsible, active-route highlight) + header (org name, role badge, sign-out with canonical hygiene: cancelQueries → clear → signOut → navigate replace `/auth`). Neutral shadcn tokens; you'll provide logo + palette in a follow-up.

## 8. Server functions

- `getCurrentUserContext()` (protected via `requireSupabaseAuth`) → `{ profile, org, roles[] }`.
- No mutations this phase beyond auth.

## Not in this phase

Admin UI (org/user CRUD), client/session CRUD, audio upload UI, frequency seeding, branding theme wiring.
