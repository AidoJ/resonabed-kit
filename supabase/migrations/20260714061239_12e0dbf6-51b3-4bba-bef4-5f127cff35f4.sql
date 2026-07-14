ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_org_change;
UPDATE public.profiles SET org_id = '35211795-a6be-4bb7-83af-837b86029860' WHERE id = 'f9761e2e-a8d9-460a-9d46-8e0f8d3685e1';
ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_org_change;