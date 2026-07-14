
-- 1. Integrity trigger on sessions
create or replace function public.sessions_check_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_org uuid;
  v_service_org uuid;
begin
  select org_id into v_client_org from public.clients where id = new.client_id;
  if v_client_org is null then
    raise exception 'client not found for client_id %', new.client_id;
  end if;
  if v_client_org is distinct from new.org_id then
    raise exception 'client org_id does not match session org_id';
  end if;

  if new.service_id is not null then
    select org_id into v_service_org from public.services where id = new.service_id;
    if v_service_org is null then
      raise exception 'service not found for service_id %', new.service_id;
    end if;
    if v_service_org is distinct from new.org_id then
      raise exception 'service org_id does not match session org_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_org_consistency on public.sessions;
create trigger sessions_org_consistency
  before insert or update on public.sessions
  for each row execute function public.sessions_check_org_consistency();

-- 2. Frequencies seed (idempotent)
create unique index if not exists frequencies_hz_unique on public.frequencies(hz);

insert into public.frequencies (hz, name, description, benefits, color) values
  (174, 'Grounding',  'A low, settling tone often used to encourage a sense of safety and rest.', 'Gentle grounding, sense of steadiness, supports rest and calm.', '#3B4A6B'),
  (285, 'Renewal',    'A soft tone commonly used to support a feeling of restoration after a busy day.', 'Encourages a soft reset, restfulness and quiet renewal.', '#4A6B8A'),
  (396, 'Release',    'A warm tone commonly used for stress relief and letting go of tension.', 'Supports letting go of tension, ease of mind, deep relaxation.', '#5B7BA8'),
  (417, 'Change',     'A gentle tone often used to encourage a fresh, calm mindset.', 'Supports mental calm, gentle clarity, a settled feeling.', '#6B8FC7'),
  (528, 'Harmony',    'A balanced tone often chosen for overall wellbeing and deep relaxation.', 'Encourages balance, a sense of harmony and general wellbeing.', '#7BB0A8'),
  (639, 'Connection', 'A warm tone often used to evoke comfort and connection.', 'Supports feelings of warmth, comfort and social ease.', '#9BC48A'),
  (741, 'Clarity',    'A bright tone often used for gentle focus and a refreshed feeling.', 'Encourages gentle clarity, focus and a refreshed mind.', '#C7B87B'),
  (852, 'Stillness',  'A calm tone often used for meditative quiet and inner stillness.', 'Supports inner quiet, meditative calm and stillness.', '#B08AC7'),
  (963, 'Serenity',   'A soft, airy tone commonly used to support rest and peaceful stillness.', 'Encourages serenity, rest and peaceful stillness — commonly used for better sleep and calm.', '#8A6BC7')
on conflict (hz) do update set
  name = excluded.name,
  description = excluded.description,
  benefits = excluded.benefits,
  color = excluded.color;
