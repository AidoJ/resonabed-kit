ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS theme_primary text,
  ADD COLUMN IF NOT EXISTS theme_sidebar text,
  ADD COLUMN IF NOT EXISTS theme_accent text;

ALTER TABLE public.organisations
  DROP CONSTRAINT IF EXISTS organisations_theme_primary_hex,
  DROP CONSTRAINT IF EXISTS organisations_theme_sidebar_hex,
  DROP CONSTRAINT IF EXISTS organisations_theme_accent_hex;

ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_theme_primary_hex CHECK (theme_primary IS NULL OR theme_primary ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT organisations_theme_sidebar_hex CHECK (theme_sidebar IS NULL OR theme_sidebar ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT organisations_theme_accent_hex CHECK (theme_accent IS NULL OR theme_accent ~ '^#[0-9a-fA-F]{6}$');

-- Seed theme_primary from brand_color where set and theme_primary is null.
UPDATE public.organisations
SET theme_primary = brand_color
WHERE theme_primary IS NULL AND brand_color ~ '^#[0-9a-fA-F]{6}$';