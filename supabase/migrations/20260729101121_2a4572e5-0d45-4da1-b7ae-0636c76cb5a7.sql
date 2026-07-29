-- 1. Booking provenance
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS public_note text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check CHECK (source IN ('internal', 'public'));

-- Public requests arrive unassigned; staff assign a practitioner on confirm.
ALTER TABLE public.bookings ALTER COLUMN practitioner_id DROP NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_practitioner_required_when_confirmed;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_practitioner_required_when_confirmed
  CHECK (practitioner_id IS NOT NULL OR status IN ('pending', 'cancelled'));

-- Org-consistency trigger must tolerate a null practitioner
CREATE OR REPLACE FUNCTION public.bookings_check_org_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if new.practitioner_id is not null then
    select org_id into v_prac_org from public.profiles where id = new.practitioner_id;
    if v_prac_org is null then
      raise exception 'practitioner profile not found for practitioner_id %', new.practitioner_id;
    end if;
    if v_prac_org is distinct from new.org_id then
      raise exception 'practitioner org_id does not match booking org_id';
    end if;
  end if;

  return new;
end;
$function$;

-- 2. Rate-limit ledger (hashes only, no PII)
CREATE TABLE IF NOT EXISTS public.public_booking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  email_hash text NOT NULL,
  accepted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.public_booking_attempts TO service_role;

ALTER TABLE public.public_booking_attempts ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: this table is written and read only by
-- privileged server code. RLS with zero policies denies everything else.

CREATE INDEX IF NOT EXISTS public_booking_attempts_ip_created_idx
  ON public.public_booking_attempts (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS public_booking_attempts_email_created_idx
  ON public.public_booking_attempts (email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS public_booking_attempts_org_created_idx
  ON public.public_booking_attempts (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_org_source_status_idx
  ON public.bookings (org_id, source, status);
