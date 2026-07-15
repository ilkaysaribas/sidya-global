-- Additive order price-request integration for Sidya Global.
-- Existing site_orders, invoices and invoice_items remain intact.

create table if not exists public.site_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.site_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_code text,
  quantity numeric(18,3) not null check (quantity > 0),
  unit text not null default 'koli',
  currency text not null default 'USD',
  current_unit_price numeric(18,4) not null default 0,
  requested_unit_price numeric(18,4) not null default 0,
  current_total numeric(18,4) not null default 0,
  requested_total numeric(18,4) not null default 0,
  exchange_rate numeric(18,8) not null default 1,
  exchange_rate_date date,
  price_difference numeric(18,4) not null default 0,
  discount_percentage numeric(9,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists site_order_items_order_product_idx
  on public.site_order_items(order_id, product_id)
  where product_id is not null;
create index if not exists site_order_items_order_idx on public.site_order_items(order_id);

alter table public.site_order_items enable row level security;

drop policy if exists "admins manage site order items" on public.site_order_items;
create policy "admins manage site order items" on public.site_order_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.site_orders
  add column if not exists main_currency text not null default 'USD',
  add column if not exists exchange_rate_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists exchange_rate_date date,
  add column if not exists current_subtotal numeric(18,4) not null default 0,
  add column if not exists requested_subtotal numeric(18,4) not null default 0,
  add column if not exists price_difference numeric(18,4) not null default 0,
  add column if not exists average_discount_percentage numeric(9,4) not null default 0;

alter table public.invoice_items
  add column if not exists line_no integer,
  add column if not exists currency text not null default 'USD',
  add column if not exists line_discount numeric(18,4) not null default 0,
  add column if not exists current_unit_price numeric(18,4),
  add column if not exists requested_unit_price numeric(18,4),
  add column if not exists current_total numeric(18,4),
  add column if not exists requested_total numeric(18,4),
  add column if not exists exchange_rate numeric(18,8),
  add column if not exists exchange_rate_date date,
  add column if not exists price_difference numeric(18,4),
  add column if not exists discount_percentage numeric(9,4);

alter table public.invoices
  add column if not exists updated_at timestamptz not null default now();

comment on column public.invoice_items.current_unit_price is
  'Immutable product price snapshot at order/invoice creation time.';
comment on column public.invoice_items.requested_unit_price is
  'Buyer-requested or negotiated unit price; editable without changing the current-price snapshot.';
