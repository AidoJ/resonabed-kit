INSERT INTO public.shipping_rates (region, label, amount_cents, gst_inclusive, allowed_countries, active, sort_order)
VALUES ('pickup', 'Customer collects (pickup)', 0, false, ARRAY['AU'], true, 0)
ON CONFLICT (region) DO NOTHING;