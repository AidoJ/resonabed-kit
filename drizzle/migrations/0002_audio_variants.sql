ALTER TABLE public.audio_files ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'original';
ALTER TABLE public.audio_files ADD CONSTRAINT audio_files_variant_check CHECK (variant IN ('original','deep','original_amb','deep_amb'));
ALTER TABLE public.audio_files ADD COLUMN IF NOT EXISTS ambience_kind text;
ALTER TABLE public.audio_files ADD CONSTRAINT audio_files_ambience_kind_check CHECK (ambience_kind IS NULL OR ambience_kind IN ('water','wind'));
CREATE UNIQUE INDEX IF NOT EXISTS audio_files_org_freq_variant ON public.audio_files (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), frequency_id, variant) WHERE is_active;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS audio_resonance text NOT NULL DEFAULT 'gentle';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS audio_ambience boolean NOT NULL DEFAULT false;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_audio_resonance_check CHECK (audio_resonance IN ('gentle','deep'));