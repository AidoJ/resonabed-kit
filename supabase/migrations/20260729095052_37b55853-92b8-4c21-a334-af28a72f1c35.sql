ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_blurb text,
  ADD COLUMN IF NOT EXISTS public_contact_email text,
  ADD COLUMN IF NOT EXISTS public_contact_phone text,
  ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Australia/Brisbane';

CREATE UNIQUE INDEX IF NOT EXISTS organisations_slug_key ON public.organisations (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.organisations
  DROP CONSTRAINT IF EXISTS organisations_slug_format_chk;
ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_slug_format_chk
  CHECK (slug IS NULL OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 48));

-- Publishing gate: must be configured and have a slug.
CREATE OR REPLACE FUNCTION public.organisations_check_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.published THEN
    IF NEW.slug IS NULL THEN
      RAISE EXCEPTION 'A public URL name (slug) is required before publishing.';
    END IF;
    IF NOT COALESCE(NEW.is_configured, false) THEN
      RAISE EXCEPTION 'Organisation setup must be completed and acknowledged before publishing.';
    END IF;
  ELSE
    NEW.public_booking_enabled := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisations_check_publish_trg ON public.organisations;
CREATE TRIGGER organisations_check_publish_trg
BEFORE INSERT OR UPDATE ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.organisations_check_publish();

-- Narrow public read surface: one function, published + active orgs only.
CREATE OR REPLACE FUNCTION public.get_public_org(p_slug text)
RETURNS TABLE (
  name text,
  logo_url text,
  brand_color text,
  slug text,
  public_blurb text,
  public_contact_email text,
  public_contact_phone text,
  public_booking_enabled boolean,
  timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT o.name, o.logo_url, o.brand_color, o.slug, o.public_blurb,
         o.public_contact_email, o.public_contact_phone, o.public_booking_enabled, o.timezone
  FROM public.organisations o
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_org(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_org(text) TO anon, authenticated, service_role;