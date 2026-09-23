CREATE TABLE public.demo_enquiries (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE CHECK (reference ~ '^RB-[A-Z0-9]{8}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  practice text NOT NULL CHECK (char_length(practice) BETWEEN 1 AND 150),
  suburb text NOT NULL CHECK (char_length(suburb) BETWEEN 1 AND 100),
  phone text CHECK (phone IS NULL OR char_length(phone) BETWEEN 6 AND 30),
  utm_source text NOT NULL DEFAULT '' CHECK (char_length(utm_source) <= 200),
  utm_medium text NOT NULL DEFAULT '' CHECK (char_length(utm_medium) <= 200),
  utm_campaign text NOT NULL DEFAULT '' CHECK (char_length(utm_campaign) <= 200),
  utm_content text NOT NULL DEFAULT '' CHECK (char_length(utm_content) <= 200),
  notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'suppressed', 'failed')),
  notification_error text CHECK (notification_error IS NULL OR char_length(notification_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.demo_enquiries TO authenticated;
GRANT ALL ON public.demo_enquiries TO service_role;

ALTER TABLE public.demo_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY demo_enquiries_super_admin_select
ON public.demo_enquiries
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER demo_enquiries_set_updated_at
BEFORE UPDATE ON public.demo_enquiries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();