ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS rrp numeric,
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS services_source_global_id_idx ON public.services(source_global_id);

-- Backfill: link existing org services to the matching global catalogue entry by name.
UPDATE public.services s
SET source_global_id = g.id
FROM public.services g
WHERE s.org_id IS NOT NULL
  AND s.source_global_id IS NULL
  AND g.org_id IS NULL
  AND lower(trim(g.name)) = lower(trim(s.name));