
DO $$ BEGIN
  CREATE TYPE public.email_status AS ENUM ('valid', 'bounced', 'complained', 'unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email_status public.email_status NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS email_status_updated_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_status public.email_status NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS email_status_updated_at timestamptz;
