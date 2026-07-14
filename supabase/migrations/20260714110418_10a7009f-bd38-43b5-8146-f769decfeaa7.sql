ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0;

UPDATE public.services SET buffer_minutes = 15 WHERE buffer_minutes = 0;

ALTER TABLE public.services
  ADD CONSTRAINT services_buffer_minutes_nonneg CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240);