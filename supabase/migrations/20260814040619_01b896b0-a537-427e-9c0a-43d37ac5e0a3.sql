ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_applies_to_check;
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_applies_to_check
  CHECK (applies_to IN ('any','kit','table','essentials','pro','platinum','home'));