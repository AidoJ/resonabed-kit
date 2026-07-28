create sequence if not exists public.kit_invoice_seq start 1000;
create sequence if not exists public.kit_receipt_seq start 1000;

create table public.kit_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  stripe_session_id text,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  billing_address text,
  shipping_address text,
  package_key text not null,
  package_label text not null,
  plan text not null default 'full',
  currency text not null default 'AUD',
  list_cents integer not null default 0,
  discount_cents integer not null default 0,
  shipping_cents integer not null default 0,
  shipping_region text,
  shipping_gst_inclusive boolean not null default true,
  total_cents integer not null default 0,
  gst_cents integer not null default 0,
  payment_terms text not null default 'eft',
  due_date date,
  status text not null default 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kit_payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  invoice_id uuid not null references public.kit_invoices(id) on delete cascade,
  amount_cents integer not null,
  gst_cents integer not null default 0,
  method text not null default 'eft',
  paid_at date not null default (now()::date),
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index on public.kit_payments (invoice_id);

grant select, insert, update, delete on public.kit_invoices to authenticated;
grant all on public.kit_invoices to service_role;
grant select, insert, update, delete on public.kit_payments to authenticated;
grant all on public.kit_payments to service_role;

alter table public.kit_invoices enable row level security;
alter table public.kit_payments enable row level security;

create policy "super admins manage kit invoices" on public.kit_invoices
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "super admins manage kit payments" on public.kit_payments
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger kit_invoices_updated_at before update on public.kit_invoices
  for each row execute function public.set_updated_at();

create or replace function public.next_kit_invoice_number()
returns text language sql volatile set search_path = public as $$
  select 'INV-' || lpad(nextval('public.kit_invoice_seq')::text, 5, '0')
$$;

create or replace function public.next_kit_receipt_number()
returns text language sql volatile set search_path = public as $$
  select 'RCT-' || lpad(nextval('public.kit_receipt_seq')::text, 5, '0')
$$;

grant execute on function public.next_kit_invoice_number() to authenticated, service_role;
grant execute on function public.next_kit_receipt_number() to authenticated, service_role;