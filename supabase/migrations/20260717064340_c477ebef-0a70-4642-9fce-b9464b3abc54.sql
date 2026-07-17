-- Remove the now-unused template-organisation designation.
-- Seeding for new orgs comes from the global services catalogue (services with org_id IS NULL);
-- frequencies and audio are global content. No code path reads is_template anymore.

DROP INDEX IF EXISTS public.organisations_is_template_idx;
DROP INDEX IF EXISTS public.idx_organisations_is_template;
ALTER TABLE public.organisations DROP COLUMN IF EXISTS is_template;
