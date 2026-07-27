ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS configured_acknowledgement_signature text;