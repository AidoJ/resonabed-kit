
CREATE OR REPLACE FUNCTION public.prevent_org_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.org_id is distinct from old.org_id then
    -- Allow when running as service_role (no auth.uid()) or as a super admin.
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_super_admin(auth.uid()) then
      raise exception 'org_id can only be changed by a super admin';
    end if;
  end if;
  return new;
end;
$function$;
