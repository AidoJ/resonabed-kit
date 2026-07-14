create or replace function public.prevent_org_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id
     and not public.is_super_admin(auth.uid()) then
    raise exception 'org_id can only be changed by a super admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_org_change on public.profiles;

create trigger profiles_prevent_org_change
  before update on public.profiles
  for each row execute function public.prevent_org_id_change();