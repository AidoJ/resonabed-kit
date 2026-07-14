
ALTER TABLE public.frequencies
  ADD COLUMN IF NOT EXISTS goal_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS body_area_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pain_affinity int NOT NULL DEFAULT 0 CHECK (pain_affinity BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS stress_affinity int NOT NULL DEFAULT 0 CHECK (stress_affinity BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS sleep_affinity int NOT NULL DEFAULT 0 CHECK (sleep_affinity BETWEEN 0 AND 5);

-- Backfill sensible defaults for the 9 seeded frequencies
UPDATE public.frequencies SET goal_tags = ARRAY['relaxation','comfort','stress_relief'], body_area_tags = ARRAY['feet','legs','hips','lower_back'], pain_affinity = 3, stress_affinity = 1, sleep_affinity = 0 WHERE hz = 174;
UPDATE public.frequencies SET goal_tags = ARRAY['recovery','relaxation','comfort'], body_area_tags = ARRAY['lower_back','hips','abdomen'], pain_affinity = 2, stress_affinity = 0, sleep_affinity = 1 WHERE hz = 285;
UPDATE public.frequencies SET goal_tags = ARRAY['stress_relief','relaxation'], body_area_tags = ARRAY['lower_back','hips','upper_back','shoulders'], pain_affinity = 2, stress_affinity = 4, sleep_affinity = 0 WHERE hz = 396;
UPDATE public.frequencies SET goal_tags = ARRAY['stress_relief','relaxation'], body_area_tags = ARRAY['abdomen','chest'], pain_affinity = 0, stress_affinity = 3, sleep_affinity = 1 WHERE hz = 417;
UPDATE public.frequencies SET goal_tags = ARRAY['relaxation','comfort','recovery','energy'], body_area_tags = ARRAY['chest','abdomen','upper_back'], pain_affinity = 1, stress_affinity = 0, sleep_affinity = 0 WHERE hz = 528;
UPDATE public.frequencies SET goal_tags = ARRAY['comfort','relaxation'], body_area_tags = ARRAY['chest','shoulders','arms','hands'], pain_affinity = 0, stress_affinity = 1, sleep_affinity = 0 WHERE hz = 639;
UPDATE public.frequencies SET goal_tags = ARRAY['energy','recovery'], body_area_tags = ARRAY['neck','shoulders','upper_back'], pain_affinity = 0, stress_affinity = 0, sleep_affinity = 0 WHERE hz = 741;
UPDATE public.frequencies SET goal_tags = ARRAY['better_sleep','relaxation','stress_relief'], body_area_tags = ARRAY['head','neck'], pain_affinity = 0, stress_affinity = 2, sleep_affinity = 3 WHERE hz = 852;
UPDATE public.frequencies SET goal_tags = ARRAY['better_sleep','relaxation'], body_area_tags = ARRAY['head','neck'], pain_affinity = 0, stress_affinity = 1, sleep_affinity = 4 WHERE hz = 963;
