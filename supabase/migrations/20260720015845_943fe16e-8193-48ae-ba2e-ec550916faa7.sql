
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS practitioners_can_complete_unpaid boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.org_practitioner_permission(_org_id uuid, _flag text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE _flag
    WHEN 'manage_clients'    THEN COALESCE((SELECT practitioners_can_manage_clients    FROM public.organisations WHERE id = _org_id), true)
    WHEN 'view_all_clients'  THEN COALESCE((SELECT practitioners_can_view_all_clients  FROM public.organisations WHERE id = _org_id), true)
    WHEN 'manage_bookings'   THEN COALESCE((SELECT practitioners_can_manage_bookings   FROM public.organisations WHERE id = _org_id), true)
    WHEN 'complete_unpaid'   THEN COALESCE((SELECT practitioners_can_complete_unpaid   FROM public.organisations WHERE id = _org_id), true)
    ELSE false
  END;
$function$;
