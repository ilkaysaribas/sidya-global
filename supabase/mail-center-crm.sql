create extension if not exists pgcrypto;

create or replace function public.sidya_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.mail_settings (
  id text primary key default 'main',
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean not null default true,
  smtp_user text,
  smtp_password text,
  sender_name text not null default 'Sidya Global Export Department',
  sender_email text not null default 'export@sidyaglobal.com',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mail_settings_touch_updated_at on public.mail_settings;
create trigger mail_settings_touch_updated_at
before update on public.mail_settings
for each row execute function public.sidya_touch_updated_at();

create table if not exists public.mail_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text,
  subject text,
  status text not null default 'failed',
  error_message text,
  sent_at timestamptz not null default now(),
  source text not null default 'crm'
);

create index if not exists mail_logs_sent_at_idx on public.mail_logs (sent_at desc);
create index if not exists mail_logs_source_idx on public.mail_logs (source);

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text,
  country text,
  email text,
  phone text,
  whatsapp text,
  source text not null default 'website',
  interested_products text,
  status text not null default 'lead',
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_customers_email_unique_idx
on public.crm_customers (lower(email)) where email is not null and btrim(email) <> '';

create index if not exists crm_customers_follow_up_idx on public.crm_customers (next_follow_up_at);
create index if not exists crm_customers_status_idx on public.crm_customers (status);

drop trigger if exists crm_customers_touch_updated_at on public.crm_customers;
create trigger crm_customers_touch_updated_at
before update on public.crm_customers
for each row execute function public.sidya_touch_updated_at();

create table if not exists public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  type text not null default 'form' check (type in ('email', 'form', 'whatsapp', 'call', 'quote', 'note')),
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound', 'internal')),
  subject text,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists crm_interactions_customer_created_idx on public.crm_interactions (customer_id, created_at desc);

alter table public.mail_settings enable row level security;
alter table public.mail_logs enable row level security;
alter table public.crm_customers enable row level security;
alter table public.crm_interactions enable row level security;

drop policy if exists "admins manage mail settings" on public.mail_settings;
create policy "admins manage mail settings"
on public.mail_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read mail logs" on public.mail_logs;
create policy "admins read mail logs"
on public.mail_logs for select to authenticated
using (public.is_admin());

drop policy if exists "admins manage crm customers" on public.crm_customers;
create policy "admins manage crm customers"
on public.crm_customers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage crm interactions" on public.crm_interactions;
create policy "admins manage crm interactions"
on public.crm_interactions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public creates crm customers" on public.crm_customers;
create policy "public creates crm customers"
on public.crm_customers for insert to anon, authenticated
with check (true);

drop policy if exists "public creates crm interactions" on public.crm_interactions;
create policy "public creates crm interactions"
on public.crm_interactions for insert to anon, authenticated
with check (true);

grant select, insert, update, delete on public.mail_settings to authenticated;
grant select on public.mail_logs to authenticated;
grant select, insert, update, delete on public.crm_customers to authenticated;
grant select, insert, update, delete on public.crm_interactions to authenticated;
grant insert on public.crm_customers to anon;
grant insert on public.crm_interactions to anon;

insert into public.mail_settings (id, sender_name, sender_email)
values ('main', 'Sidya Global Export Department', 'export@sidyaglobal.com')
on conflict (id) do update
set sender_name = 'Sidya Global Export Department',
    sender_email = 'export@sidyaglobal.com';

notify pgrst, 'reload schema';
