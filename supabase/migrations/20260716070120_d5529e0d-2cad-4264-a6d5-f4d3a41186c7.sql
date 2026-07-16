
-- Music licence entitlement (enforces access to global tracks only)
CREATE TYPE public.music_licence_status AS ENUM ('trial', 'active', 'expired');
CREATE TYPE public.music_licence_plan AS ENUM ('none', 'basic', 'pro');

ALTER TABLE public.organisations
  ADD COLUMN music_licence_status public.music_licence_status NOT NULL DEFAULT 'trial',
  ADD COLUMN music_licence_expires_at timestamptz,
  ADD COLUMN music_licence_note text,
  ADD COLUMN music_licence_plan public.music_licence_plan NOT NULL DEFAULT 'none';

-- Backfill existing orgs: 1-month trial from their created_at (or already expired if older).
UPDATE public.organisations
  SET music_licence_expires_at = created_at + interval '1 month',
      music_licence_status = CASE
        WHEN created_at + interval '1 month' > now() THEN 'trial'::public.music_licence_status
        ELSE 'expired'::public.music_licence_status
      END
  WHERE music_licence_expires_at IS NULL;

-- New org default: 1-month trial from creation.
CREATE OR REPLACE FUNCTION public.organisations_set_default_licence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.music_licence_expires_at IS NULL THEN
    NEW.music_licence_expires_at := coalesce(NEW.created_at, now()) + interval '1 month';
    NEW.music_licence_status := 'trial';
    NEW.music_licence_plan := 'none';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.organisations_set_default_licence() FROM PUBLIC;

CREATE TRIGGER organisations_default_licence
  BEFORE INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.organisations_set_default_licence();

-- Central check used by the app.
CREATE OR REPLACE FUNCTION public.org_music_licence_ok(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT music_licence_status <> 'expired'
       AND music_licence_expires_at IS NOT NULL
       AND music_licence_expires_at > now()
     FROM public.organisations WHERE id = _org_id),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.org_music_licence_ok(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_music_licence_ok(uuid) TO authenticated;
