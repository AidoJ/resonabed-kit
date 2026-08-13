ALTER TABLE public.shipping_rates
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'kit',
  ADD COLUMN IF NOT EXISTS allowed_states text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_rates_applies_to_check'
  ) THEN
    ALTER TABLE public.shipping_rates
      ADD CONSTRAINT shipping_rates_applies_to_check
      CHECK (applies_to IN ('kit', 'table', 'any'));
  END IF;
END $$;

-- Pickup works for every product.
UPDATE public.shipping_rates SET applies_to = 'any' WHERE region = 'pickup';

-- Table freight bands for the Resonabed for Home package (ships a fitted table).
INSERT INTO public.shipping_rates
  (region, label, amount_cents, gst_inclusive, allowed_countries, allowed_states, applies_to, active, sort_order)
VALUES
  ('au-table-metro', 'Australia, east coast metro (table freight)', 8900, true, ARRAY['AU'],
   ARRAY['QLD','NSW','ACT','VIC'], 'table', true, 10),
  ('au-table-standard', 'Australia, other states and regional (table freight)', 14900, true, ARRAY['AU'],
   ARRAY[]::text[], 'table', true, 11)
ON CONFLICT (region) DO NOTHING;