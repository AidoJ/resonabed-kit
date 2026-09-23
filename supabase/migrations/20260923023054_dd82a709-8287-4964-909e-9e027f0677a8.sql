ALTER TABLE public.demo_enquiries
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','demo_booked','won','lost')),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS next_follow_up_on date,
  ADD COLUMN IF NOT EXISTS lost_reason text;

CREATE POLICY "demo_enquiries_super_admin_update" ON public.demo_enquiries
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.demo_enquiry_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES public.demo_enquiries(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('note','stage_change','assignment')),
  body text CHECK (char_length(body) <= 2000),
  from_stage text,
  to_stage text,
  actor_id uuid REFERENCES auth.users(id),
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.demo_enquiry_events TO authenticated;
GRANT ALL ON public.demo_enquiry_events TO service_role;

ALTER TABLE public.demo_enquiry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_enquiry_events_super_admin_select" ON public.demo_enquiry_events
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "demo_enquiry_events_super_admin_insert" ON public.demo_enquiry_events
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));