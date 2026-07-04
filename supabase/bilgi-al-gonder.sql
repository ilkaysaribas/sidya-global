-- Bilgi Gonder ve site katalog yayinlama tablolari.
-- Bu dosya guvenle tekrar calistirilabilir.

create extension if not exists pgcrypto;

create table if not exists public.information_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  message text,
  source text,
  created_at timestamptz default now()
);

alter table public.information_messages enable row level security;
drop policy if exists "public inserts information messages" on public.information_messages;
create policy "public inserts information messages"
on public.information_messages for insert to anon, authenticated
with check (true);
drop policy if exists "admins read information messages" on public.information_messages;
create policy "admins read information messages"
on public.information_messages for select to authenticated
using (public.is_admin());

grant insert on public.information_messages to anon, authenticated;
grant select, update, delete on public.information_messages to authenticated;

-- Yonetim panelindeki satis fiyatlarini musteri sitesine guvenli bicimde yayinlar.
-- Maliyet/alis fiyati bu tabloda tutulmaz ve musteriye acilmaz.

create table if not exists public.site_catalog_prices (
  publish_key text primary key,
  catalog_id text,
  barcode text,
  name text not null,
  brand text,
  category text,
  grammage text,
  sale_price numeric(14,4) not null default 0 check (sale_price >= 0),
  currency text not null default 'USD',
  units_per_carton numeric(14,3) not null default 1,
  cartons_per_pallet numeric(14,3),
  kg_per_carton numeric(14,3),
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.site_catalog_prices enable row level security;
drop policy if exists "public reads active site catalog prices" on public.site_catalog_prices;
create policy "public reads active site catalog prices"
on public.site_catalog_prices for select to anon, authenticated
using (active = true or public.is_admin());
drop policy if exists "admins manage site catalog prices" on public.site_catalog_prices;
create policy "admins manage site catalog prices"
on public.site_catalog_prices for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.site_catalog_prices to anon, authenticated;
grant insert, update, delete on public.site_catalog_prices to authenticated;
notify pgrst, 'reload schema';
