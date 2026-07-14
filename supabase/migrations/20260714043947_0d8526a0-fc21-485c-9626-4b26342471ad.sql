
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin', 'org_admin', 'practitioner');
create type public.org_status as enum ('active', 'suspended');
create type public.payment_method as enum ('cash', 'eftpos', 'payid', 'other', 'none');
create type public.session_status as enum ('draft', 'completed', 'cancelled');

-- ============ SHARED updated_at TRIGGER FN ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ organisations ============
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  brand_color text,
  status public.org_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organisations to authenticated;
grant all on public.organisations to service_role;
create trigger organisations_set_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organisations(id) on delete set null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============ user_roles ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  org_id uuid references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_roles_super_admin_org_null check (
    (role = 'super_admin' and org_id is null)
    or (role <> 'super_admin' and org_id is not null)
  ),
  unique (user_id, role, org_id)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- ============ clients ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ============ services ============
create table public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  duration_minutes int not null,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ============ frequencies (global reference) ============
create table public.frequencies (
  id uuid primary key default gen_random_uuid(),
  hz numeric not null,
  name text not null,
  description text,
  benefits text,
  color text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.frequencies to authenticated;
grant all on public.frequencies to service_role;

-- ============ audio_files ============
create table public.audio_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  frequency_id uuid references public.frequencies(id) on delete set null,
  title text not null,
  file_url text,
  duration_seconds int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.audio_files to authenticated;
grant all on public.audio_files to service_role;
create trigger audio_files_set_updated_at before update on public.audio_files
  for each row execute function public.set_updated_at();

-- ============ sessions ============
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  practitioner_id uuid not null references auth.users(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  pain_level int,
  stress_level int,
  sleep_quality int,
  body_areas text[] not null default '{}',
  primary_goals text[] not null default '{}',
  health_concerns text[] not null default '{}',
  contraindications text[] not null default '{}',
  consent_given boolean not null default false,
  recommended_frequency_id uuid references public.frequencies(id) on delete set null,
  practitioner_notes text,
  payment_method public.payment_method not null default 'none',
  payment_amount numeric(10,2),
  status public.session_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ============ SECURITY DEFINER HELPERS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'super_admin')
$$;

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'org_admin' and org_id = _org_id
  )
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- ============ AUTH TRIGGER: create profile ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ENABLE RLS ============
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.frequencies enable row level security;
alter table public.audio_files enable row level security;
alter table public.sessions enable row level security;

-- ============ organisations POLICIES ============
create policy "organisations_select" on public.organisations
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or id = public.current_org_id());

create policy "organisations_insert" on public.organisations
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()));

create policy "organisations_update" on public.organisations
  for update to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "organisations_delete" on public.organisations
  for delete to authenticated
  using (public.is_super_admin(auth.uid()));

-- ============ profiles POLICIES ============
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin(auth.uid())
    or (org_id is not null and org_id = public.current_org_id())
  );

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin(auth.uid()))
  with check (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "profiles_insert_super_admin" on public.profiles
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()));

create policy "profiles_delete_super_admin" on public.profiles
  for delete to authenticated
  using (public.is_super_admin(auth.uid()));

-- ============ user_roles POLICIES ============
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or (org_id is not null and public.is_org_admin(auth.uid(), org_id))
  );

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

-- ============ clients POLICIES (health data) ============
create policy "clients_select" on public.clients
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "clients_update" on public.clients
  for update to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id())
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "clients_delete_admin_only" on public.clients
  for delete to authenticated
  using (public.is_super_admin(auth.uid()) or public.is_org_admin(auth.uid(), org_id));

-- ============ services POLICIES ============
create policy "services_select" on public.services
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "services_insert" on public.services
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "services_update" on public.services
  for update to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id())
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "services_delete" on public.services
  for delete to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

-- ============ frequencies POLICIES ============
create policy "frequencies_select" on public.frequencies
  for select to authenticated
  using (true);

create policy "frequencies_insert_super_admin" on public.frequencies
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()));

create policy "frequencies_update_super_admin" on public.frequencies
  for update to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "frequencies_delete_super_admin" on public.frequencies
  for delete to authenticated
  using (public.is_super_admin(auth.uid()));

-- ============ audio_files POLICIES ============
create policy "audio_files_select" on public.audio_files
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "audio_files_insert" on public.audio_files
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "audio_files_update" on public.audio_files
  for update to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id())
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "audio_files_delete" on public.audio_files
  for delete to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

-- ============ sessions POLICIES (health data) ============
create policy "sessions_select" on public.sessions
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "sessions_insert" on public.sessions
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "sessions_update" on public.sessions
  for update to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id())
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());

create policy "sessions_delete_admin_only" on public.sessions
  for delete to authenticated
  using (public.is_super_admin(auth.uid()) or public.is_org_admin(auth.uid(), org_id));
