
CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL UNIQUE,
  label text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  gst_inclusive boolean NOT NULL DEFAULT false,
  allowed_countries text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.shipping_rates TO service_role;
-- No authenticated/anon grants: all client access goes through server functions using supabaseAdmin.

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

-- No policies: table is only accessed by service_role via server functions.

CREATE TRIGGER shipping_rates_set_updated_at
BEFORE UPDATE ON public.shipping_rates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.shipping_rates (region, label, amount_cents, gst_inclusive, allowed_countries, sort_order) VALUES
  ('au', 'Australia', 3900, true, ARRAY['AU'], 1),
  ('nz', 'New Zealand', 6900, false, ARRAY['NZ'], 2),
  ('na', 'North America', 14900, false, ARRAY['US','CA'], 3),
  ('eu', 'Europe', 16900, false, ARRAY['GB','IE','DE','FR','NL','BE','ES','IT','PT','SE','NO','DK','FI','CH','AT','PL'], 4);
