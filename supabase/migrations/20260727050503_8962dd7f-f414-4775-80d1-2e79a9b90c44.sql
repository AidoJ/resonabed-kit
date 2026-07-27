ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;