
-- 1. booking_status enum
create type public.booking_status as enum (
  'pending','confirmed','in_progress','completed','cancelled','no_show'
);

-- 2. bookings table
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  practitioner_id uuid not null references auth.users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  notes text,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at)
);
create index bookings_org_starts_idx on public.bookings(org_id, starts_at);
create index bookings_practitioner_starts_idx on public.bookings(practitioner_id, starts_at);
create index bookings_session_idx on public.bookings(session_id);

grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

create policy bookings_select on public.bookings for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());
create policy bookings_insert on public.bookings for insert to authenticated
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());
create policy bookings_update on public.bookings for update to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id())
  with check (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());
create policy bookings_delete on public.bookings for delete to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (org_id = public.current_org_id() and public.is_org_admin(auth.uid(), org_id))
  );

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- 3. bookings org-consistency trigger
create or replace function public.bookings_check_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_org uuid;
  v_service_org uuid;
  v_prac_org uuid;
begin
  select org_id into v_client_org from public.clients where id = new.client_id;
  if v_client_org is null then
    raise exception 'client not found for client_id %', new.client_id;
  end if;
  if v_client_org is distinct from new.org_id then
    raise exception 'client org_id does not match booking org_id';
  end if;

  select org_id into v_service_org from public.services where id = new.service_id;
  if v_service_org is null then
    raise exception 'service not found for service_id %', new.service_id;
  end if;
  if v_service_org is distinct from new.org_id then
    raise exception 'service org_id does not match booking org_id';
  end if;

  select org_id into v_prac_org from public.profiles where id = new.practitioner_id;
  if v_prac_org is null then
    raise exception 'practitioner profile not found for practitioner_id %', new.practitioner_id;
  end if;
  if v_prac_org is distinct from new.org_id then
    raise exception 'practitioner org_id does not match booking org_id';
  end if;

  return new;
end;
$$;

create trigger bookings_check_org
  before insert or update on public.bookings
  for each row execute function public.bookings_check_org_consistency();

-- 4. practitioner_availability
create table public.practitioner_availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  practitioner_id uuid not null references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prac_avail_time_order check (end_time > start_time)
);
create index prac_avail_org_prac_idx
  on public.practitioner_availability(org_id, practitioner_id);

grant select, insert, update, delete on public.practitioner_availability to authenticated;
grant all on public.practitioner_availability to service_role;
alter table public.practitioner_availability enable row level security;

create policy avail_select on public.practitioner_availability for select to authenticated
  using (public.is_super_admin(auth.uid()) or org_id = public.current_org_id());
create policy avail_insert on public.practitioner_availability for insert to authenticated
  with check (
    public.is_super_admin(auth.uid())
    or (
      org_id = public.current_org_id()
      and (practitioner_id = auth.uid() or public.is_org_admin(auth.uid(), org_id))
    )
  );
create policy avail_update on public.practitioner_availability for update to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (
      org_id = public.current_org_id()
      and (practitioner_id = auth.uid() or public.is_org_admin(auth.uid(), org_id))
    )
  )
  with check (
    public.is_super_admin(auth.uid())
    or (
      org_id = public.current_org_id()
      and (practitioner_id = auth.uid() or public.is_org_admin(auth.uid(), org_id))
    )
  );
create policy avail_delete on public.practitioner_availability for delete to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (
      org_id = public.current_org_id()
      and (practitioner_id = auth.uid() or public.is_org_admin(auth.uid(), org_id))
    )
  );

create trigger prac_avail_set_updated_at
  before update on public.practitioner_availability
  for each row execute function public.set_updated_at();

-- 5. propagate session status changes to linked booking
create or replace function public.sessions_propagate_to_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'completed' then
      update public.bookings
        set status = 'completed'
        where session_id = new.id
          and status in ('in_progress','confirmed','pending');
    elsif new.status = 'cancelled' then
      update public.bookings
        set status = 'confirmed'
        where session_id = new.id
          and status = 'in_progress';
    end if;
  end if;
  return new;
end;
$$;

create trigger sessions_propagate_to_booking_trg
  after update on public.sessions
  for each row execute function public.sessions_propagate_to_booking();
