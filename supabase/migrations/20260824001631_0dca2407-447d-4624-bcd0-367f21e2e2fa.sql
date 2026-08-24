CREATE TABLE public.session_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  pseudonym_id uuid not null references public.client_pseudonyms(id),
  phase text not null check (phase in ('before','after')),
  arousal smallint check (arousal between 0 and 10),
  mood smallint check (mood between 0 and 10),
  relaxation smallint check (relaxation between 0 and 10),
  pain smallint check (pain between 0 and 10),
  sleep_quality smallint check (sleep_quality between 0 and 10),
  physical_ease smallint check (physical_ease between 0 and 10),
  recorded_by uuid references auth.users(id),
  created_at timestamp with time zone not null default now(),
  unique (session_id, phase)
);
GRANT SELECT, INSERT, UPDATE ON public.session_checkins TO authenticated;
GRANT ALL ON public.session_checkins TO service_role;
ALTER TABLE public.session_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_checkins_select" ON public.session_checkins FOR SELECT TO authenticated USING ((org_id = current_org_id()) OR super_admin_supporting_org(auth.uid(), org_id));
CREATE POLICY "session_checkins_insert" ON public.session_checkins FOR INSERT TO authenticated WITH CHECK ((org_id = current_org_id()) OR super_admin_supporting_org(auth.uid(), org_id));
CREATE POLICY "session_checkins_update" ON public.session_checkins FOR UPDATE TO authenticated USING ((org_id = current_org_id()) OR super_admin_supporting_org(auth.uid(), org_id)) WITH CHECK ((org_id = current_org_id()) OR super_admin_supporting_org(auth.uid(), org_id));
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT ON public.session_checkins FOR EACH ROW EXECUTE FUNCTION fill_pseudonym_from_client();

ALTER TABLE public.organisations ADD COLUMN checkin_items text[] not null default '{arousal,mood,relaxation}';
ALTER TABLE public.organisations ADD CONSTRAINT organisations_checkin_items_valid CHECK (checkin_items <@ array['arousal','mood','relaxation','pain','sleep_quality','physical_ease']::text[]);