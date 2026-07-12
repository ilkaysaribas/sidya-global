-- Sidya Global RFQ / Teklif Talebi module
-- Run in Supabase SQL Editor after supabase/schema.sql.

create extension if not exists pgcrypto;

create table if not exists public.currencies (
  code varchar(3) primary key,
  name text not null,
  symbol text not null,
  decimal_places integer not null default 2,
  active boolean not null default true,
  display_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.currencies (code, name, symbol, decimal_places, active, display_order) values
('TRY','Turkish Lira','₺',2,true,10),
('USD','US Dollar','$',2,true,20),
('EUR','Euro','€',2,true,30),
('GEL','Georgian Lari','₾',2,true,40),
('RUB','Russian Ruble','₽',2,true,50),
('AZN','Azerbaijani Manat','₼',2,true,60),
('GBP','British Pound','£',2,true,70),
('CNY','Chinese Yuan','¥',2,true,80),
('AED','UAE Dirham','د.إ',2,true,90),
('SAR','Saudi Riyal','﷼',2,true,100),
('QAR','Qatari Riyal','ر.ق',2,true,110),
('KWD','Kuwaiti Dinar','د.ك',3,true,120),
('IQD','Iraqi Dinar','ع.د',0,true,130),
('KZT','Kazakhstani Tenge','₸',2,true,140),
('UAH','Ukrainian Hryvnia','₴',2,true,150),
('MDL','Moldovan Leu','L',2,true,160),
('AMD','Armenian Dram','֏',2,true,170),
('IRR','Iranian Rial','﷼',0,true,180)
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  decimal_places = excluded.decimal_places,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.rfq_requests (
  id uuid primary key default gen_random_uuid(),
  rfq_number text unique not null,
  customer_id uuid nullable references public.customers(id) on delete set null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  country_code text,
  country_name text,
  city text,
  registration_number text,
  preferred_language text,
  destination_country text,
  destination_city_or_port text,
  incoterm text,
  shipping_method text,
  expected_purchase_date date,
  payment_preference text,
  requested_validity_days integer,
  general_note text,
  urgent boolean not null default false,
  special_review_required boolean not null default false,
  total_cartons integer,
  total_units numeric,
  estimated_pallets numeric,
  estimated_gross_weight_kg numeric,
  estimated_net_weight_kg numeric,
  estimated_volume_m3 numeric,
  truck_fill_percent numeric,
  container_20_fill_percent numeric,
  container_40hc_fill_percent numeric,
  status text not null default 'new' check (status in ('new','under_review','missing_information','supplier_price_requested','pricing_completed','quote_prepared','quote_sent','customer_review','negotiation','accepted','rejected','expired','converted_to_proforma','converted_to_order','cancelled')),
  source text,
  assigned_user_id uuid nullable references auth.users(id) on delete set null,
  converted_proforma_id uuid nullable,
  converted_order_id uuid nullable,
  exchange_rate_date date,
  exchange_rate_snapshot jsonb not null default '{}'::jsonb,
  consent_privacy boolean not null default false,
  consent_commercial boolean not null default false,
  ip_address text nullable,
  user_agent text nullable,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rfq_request_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfq_requests(id) on delete cascade,
  product_id uuid nullable references public.products(id) on delete set null,
  product_name_snapshot text,
  brand_snapshot text,
  barcode_snapshot text,
  sku_snapshot text,
  carton_inner_quantity numeric,
  carton_weight_kg numeric,
  pallet_carton_quantity numeric,
  minimum_carton_quantity integer,
  requested_cartons integer not null check (requested_cartons > 0),
  requested_units numeric,
  target_unit_price numeric(18,4) not null check (target_unit_price > 0),
  currency_code varchar(3) not null references public.currencies(code),
  target_line_total numeric(18,4),
  exchange_rate_to_try numeric(18,8),
  target_line_total_try numeric(18,2),
  customer_note text,
  below_minimum boolean not null default false,
  special_review_requested boolean not null default false,
  missing_logistics_data boolean not null default false,
  proposed_sales_price numeric(18,4),
  product_cost numeric(18,4),
  gross_profit_per_carton numeric(18,4),
  gross_profit_total numeric(18,4),
  gross_margin_percent numeric(8,2),
  supplier_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rfq_status_history (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfq_requests(id) on delete cascade,
  previous_status text,
  new_status text not null,
  note text,
  changed_by uuid nullable references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.rfq_attachments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfq_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size integer,
  uploaded_by_type text check (uploaded_by_type in ('customer','admin','system')),
  created_at timestamptz not null default now()
);

alter table public.site_orders add column if not exists source_rfq_id uuid nullable references public.rfq_requests(id) on delete set null;
alter table public.invoices add column if not exists source_rfq_id uuid nullable references public.rfq_requests(id) on delete set null;
alter table public.app_settings add column if not exists rfq_settings jsonb not null default '{"allow_below_minimum":true,"minimum_margin_percent":10}'::jsonb;

create sequence if not exists public.rfq_number_seq_2026 start 1;

create or replace function public.assign_rfq_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_year text := to_char(coalesce(new.created_at, now()), 'YYYY');
  seq_name text := 'rfq_number_seq_' || current_year;
  next_no bigint;
begin
  if new.rfq_number is null or btrim(new.rfq_number) = '' then
    execute format('create sequence if not exists public.%I start 1', seq_name);
    execute format('select nextval(%L)', 'public.' || seq_name) into next_no;
    new.rfq_number := 'RFQ-' || current_year || '-' || lpad(next_no::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rfq_requests_assign_number on public.rfq_requests;
create trigger rfq_requests_assign_number
before insert or update on public.rfq_requests
for each row execute function public.assign_rfq_number();

create index if not exists rfq_requests_created_idx on public.rfq_requests (created_at desc);
create index if not exists rfq_requests_status_idx on public.rfq_requests (status);
create index if not exists rfq_requests_customer_idx on public.rfq_requests (customer_id);
create index if not exists rfq_items_rfq_idx on public.rfq_request_items (rfq_id);
create index if not exists rfq_items_product_idx on public.rfq_request_items (product_id);

alter table public.currencies enable row level security;
alter table public.rfq_requests enable row level security;
alter table public.rfq_request_items enable row level security;
alter table public.rfq_status_history enable row level security;
alter table public.rfq_attachments enable row level security;

drop policy if exists "public can read active currencies" on public.currencies;
create policy "public can read active currencies" on public.currencies
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "admins manage currencies" on public.currencies;
create policy "admins manage currencies" on public.currencies
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anonymous can create rfq" on public.rfq_requests;
create policy "anonymous can create rfq" on public.rfq_requests
for insert to anon, authenticated with check (consent_privacy = true);

drop policy if exists "customers read own rfq" on public.rfq_requests;
create policy "customers read own rfq" on public.rfq_requests
for select to authenticated using (
  public.is_admin()
  or customer_id in (select id from public.customers where auth_user_id = auth.uid())
  or email = (select email from auth.users where id = auth.uid())
);

drop policy if exists "admins manage rfq" on public.rfq_requests;
create policy "admins manage rfq" on public.rfq_requests
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anonymous can create rfq items" on public.rfq_request_items;
create policy "anonymous can create rfq items" on public.rfq_request_items
for insert to anon, authenticated with check (exists (select 1 from public.rfq_requests r where r.id = rfq_id));

drop policy if exists "customers read own rfq items" on public.rfq_request_items;
create policy "customers read own rfq items" on public.rfq_request_items
for select to authenticated using (
  exists (
    select 1 from public.rfq_requests r
    where r.id = rfq_id
      and (public.is_admin() or r.customer_id in (select id from public.customers where auth_user_id = auth.uid()) or r.email = (select email from auth.users where id = auth.uid()))
  )
);

drop policy if exists "admins manage rfq items" on public.rfq_request_items;
create policy "admins manage rfq items" on public.rfq_request_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage rfq status" on public.rfq_status_history;
create policy "admins manage rfq status" on public.rfq_status_history
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customers read own rfq attachments" on public.rfq_attachments;
create policy "customers read own rfq attachments" on public.rfq_attachments
for select to authenticated using (
  exists (select 1 from public.rfq_requests r where r.id = rfq_id and (public.is_admin() or r.customer_id in (select id from public.customers where auth_user_id = auth.uid())))
);

drop policy if exists "admins manage rfq attachments" on public.rfq_attachments;
create policy "admins manage rfq attachments" on public.rfq_attachments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('rfq-attachments', 'rfq-attachments', false)
on conflict (id) do nothing;
