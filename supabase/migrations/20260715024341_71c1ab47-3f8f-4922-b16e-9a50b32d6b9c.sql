
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS organisations_only_one_template
  ON public.organisations ((is_template)) WHERE is_template = true;
