-- Sidya Global B2B backend setup
-- Run this in Supabase SQL Editor after creating a Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.b2b_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  contact text not null,
  email text not null,
  username text,
  country text not null,
  tax_number text not null,
  incoterm text not null,
  notes text,
  document_paths text[] not null default '{}',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.b2b_onboarding_requests
add column if not exists username text;

alter table public.b2b_onboarding_requests enable row level security;

drop policy if exists "buyers can read own onboarding requests" on public.b2b_onboarding_requests;
create policy "buyers can read own onboarding requests"
on public.b2b_onboarding_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "buyers can create own onboarding requests" on public.b2b_onboarding_requests;
create policy "buyers can create own onboarding requests"
on public.b2b_onboarding_requests
for insert
to authenticated
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('b2b-documents', 'b2b-documents', false)
on conflict (id) do nothing;

drop policy if exists "buyers can upload own b2b documents" on storage.objects;
create policy "buyers can upload own b2b documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'b2b-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "buyers can read own b2b documents" on storage.objects;
create policy "buyers can read own b2b documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'b2b-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Operations panel: customers, inventory, invoices and reports.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins can read own admin record" on public.admin_users;
create policy "admins can read own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  onboarding_request_id uuid unique references public.b2b_onboarding_requests(id) on delete set null,
  code text unique,
  company text not null,
  contact_name text,
  email text,
  phone text,
  country text,
  tax_number text,
  tax_office text,
  address text,
  currency text not null default 'EUR',
  payment_term_days integer not null default 0 check (payment_term_days >= 0),
  status text not null default 'active' check (status in ('active', 'passive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.customer_code_seq start 1001;

create or replace function public.assign_customer_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'C-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customers_assign_code on public.customers;
create trigger customers_assign_code
before insert or update on public.customers
for each row execute function public.assign_customer_code();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  catalog_id text unique,
  sku text unique,
  barcode text,
  name text not null,
  brand text,
  category text,
  unit text not null default 'koli',
  units_per_carton numeric(14,3) not null default 1,
  kg_per_carton numeric(14,3) not null default 0,
  purchase_price numeric(14,4) not null default 0,
  sale_price numeric(14,4) not null default 0,
  currency text not null default 'EUR',
  stock_quantity numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('opening', 'purchase', 'sale', 'adjustment_in', 'adjustment_out', 'sale_cancel')),
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_cost numeric(14,4) not null default 0,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create sequence if not exists public.invoice_no_seq start 1;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  invoice_type text not null default 'sale' check (invoice_type in ('sale', 'purchase')),
  customer_id uuid not null references public.customers(id),
  invoice_date date not null default current_date,
  due_date date,
  currency text not null default 'EUR',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  status text not null default 'posted' check (status in ('draft', 'posted', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  tax_rate numeric(6,2) not null default 0 check (tax_rate >= 0),
  line_subtotal numeric(14,2) not null,
  line_tax numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create table if not exists public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('invoice', 'payment', 'credit_note', 'opening')),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and (debit > 0 or credit > 0))
);

create index if not exists customers_company_idx on public.customers (company);
create index if not exists products_name_idx on public.products (name);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists stock_movements_product_created_idx on public.stock_movements (product_id, created_at desc);
create index if not exists invoices_customer_date_idx on public.invoices (customer_id, invoice_date desc);
create index if not exists customer_ledger_customer_date_idx on public.customer_ledger (customer_id, transaction_date desc);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.customer_ledger enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers', 'products', 'stock_movements', 'invoices', 'invoice_items', 'customer_ledger'
  ]
  loop
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.sync_onboarding_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customers (
    auth_user_id,
    onboarding_request_id,
    company,
    contact_name,
    email,
    country,
    tax_number,
    notes
  )
  values (
    new.user_id,
    new.id,
    new.company,
    new.contact,
    new.email,
    new.country,
    new.tax_number,
    new.notes
  )
  on conflict (onboarding_request_id) do update set
    auth_user_id = excluded.auth_user_id,
    company = excluded.company,
    contact_name = excluded.contact_name,
    email = excluded.email,
    country = excluded.country,
    tax_number = excluded.tax_number,
    notes = excluded.notes,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_sync_customer on public.b2b_onboarding_requests;
create trigger onboarding_sync_customer
after insert or update of company, contact, email, country, tax_number, notes
on public.b2b_onboarding_requests
for each row execute function public.sync_onboarding_customer();

insert into public.customers (
  auth_user_id,
  onboarding_request_id,
  company,
  contact_name,
  email,
  country,
  tax_number,
  notes
)
select
  request.user_id,
  request.id,
  request.company,
  request.contact,
  request.email,
  request.country,
  request.tax_number,
  request.notes
from public.b2b_onboarding_requests request
on conflict (auth_user_id) do update set
  onboarding_request_id = excluded.onboarding_request_id,
  company = excluded.company,
  contact_name = excluded.contact_name,
  email = excluded.email,
  country = excluded.country,
  tax_number = excluded.tax_number,
  notes = excluded.notes,
  updated_at = now();

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_stock numeric;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz islem';
  end if;
  if p_quantity = 0 then
    raise exception 'Miktar sifir olamaz';
  end if;

  update public.products
  set stock_quantity = stock_quantity + p_quantity, updated_at = now()
  where id = p_product_id
    and stock_quantity + p_quantity >= 0
  returning stock_quantity into next_stock;

  if next_stock is null then
    raise exception 'Urun bulunamadi veya stok yetersiz';
  end if;

  insert into public.stock_movements (
    product_id, movement_type, quantity, note, created_by
  )
  values (
    p_product_id,
    case when p_quantity > 0 then 'adjustment_in' else 'adjustment_out' end,
    p_quantity,
    p_note,
    auth.uid()
  );
  return next_stock;
end;
$$;

create or replace function public.create_invoice(
  p_customer_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_invoice_id uuid;
  new_invoice_no text;
  item jsonb;
  product_record public.products%rowtype;
  item_quantity numeric;
  item_price numeric;
  item_tax_rate numeric;
  item_subtotal numeric;
  item_tax numeric;
  invoice_subtotal numeric := 0;
  invoice_tax numeric := 0;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz islem';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Faturada en az bir urun bulunmalidir';
  end if;

  new_invoice_no := 'INV-' || to_char(coalesce(p_invoice_date, current_date), 'YYYY') || '-' ||
    lpad(nextval('public.invoice_no_seq')::text, 6, '0');

  insert into public.invoices (
    invoice_no, customer_id, invoice_date, due_date, currency, exchange_rate, notes, created_by
  )
  values (
    new_invoice_no,
    p_customer_id,
    coalesce(p_invoice_date, current_date),
    p_due_date,
    upper(coalesce(nullif(p_currency, ''), 'EUR')),
    coalesce(nullif(p_exchange_rate, 0), 1),
    p_notes,
    auth.uid()
  )
  returning id into new_invoice_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_quantity := (item->>'quantity')::numeric;
    item_price := (item->>'unit_price')::numeric;
    item_tax_rate := coalesce((item->>'tax_rate')::numeric, 0);
    if item_quantity <= 0 or item_price < 0 or item_tax_rate < 0 then
      raise exception 'Gecersiz fatura satiri';
    end if;

    select * into product_record
    from public.products
    where id = (item->>'product_id')::uuid
    for update;

    if product_record.id is null then
      raise exception 'Urun bulunamadi';
    end if;
    if product_record.stock_quantity < item_quantity then
      raise exception '% icin stok yetersiz. Mevcut: %', product_record.name, product_record.stock_quantity;
    end if;

    item_subtotal := round(item_quantity * item_price, 2);
    item_tax := round(item_subtotal * item_tax_rate / 100, 2);
    invoice_subtotal := invoice_subtotal + item_subtotal;
    invoice_tax := invoice_tax + item_tax;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price, tax_rate,
      line_subtotal, line_tax, line_total
    )
    values (
      new_invoice_id,
      product_record.id,
      coalesce(nullif(item->>'description', ''), product_record.name),
      item_quantity,
      item_price,
      item_tax_rate,
      item_subtotal,
      item_tax,
      item_subtotal + item_tax
    );

    update public.products
    set stock_quantity = stock_quantity - item_quantity, updated_at = now()
    where id = product_record.id;

    insert into public.stock_movements (
      product_id, movement_type, quantity, unit_cost, reference_type,
      reference_id, note, created_by
    )
    values (
      product_record.id, 'sale', -item_quantity, item_price, 'invoice',
      new_invoice_id, new_invoice_no, auth.uid()
    );
  end loop;

  update public.invoices
  set subtotal = invoice_subtotal,
      tax_total = invoice_tax,
      grand_total = invoice_subtotal + invoice_tax
  where id = new_invoice_id;

  insert into public.customer_ledger (
    customer_id, transaction_date, transaction_type, debit, currency,
    reference_type, reference_id, description, created_by
  )
  values (
    p_customer_id,
    coalesce(p_invoice_date, current_date),
    'invoice',
    invoice_subtotal + invoice_tax,
    upper(coalesce(nullif(p_currency, ''), 'EUR')),
    'invoice',
    new_invoice_id,
    new_invoice_no,
    auth.uid()
  );

  return new_invoice_id;
end;
$$;

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_date date,
  p_description text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  ledger_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz islem';
  end if;
  if p_amount <= 0 then
    raise exception 'Tahsilat tutari sifirdan buyuk olmalidir';
  end if;

  insert into public.customer_ledger (
    customer_id, transaction_date, transaction_type, credit, currency,
    description, created_by
  )
  values (
    p_customer_id,
    coalesce(p_payment_date, current_date),
    'payment',
    p_amount,
    upper(coalesce(nullif(p_currency, ''), 'EUR')),
    p_description,
    auth.uid()
  )
  returning id into ledger_id;
  return ledger_id;
end;
$$;

grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;
grant execute on function public.create_invoice(uuid, date, date, text, numeric, text, jsonb) to authenticated;
grant execute on function public.record_customer_payment(uuid, numeric, text, date, text) to authenticated;

create or replace view public.customer_balances
with (security_invoker = true)
as
select
  customer.id,
  customer.code,
  customer.company,
  ledger.currency,
  coalesce(sum(ledger.debit - ledger.credit), 0)::numeric(14,2) as balance
from public.customers customer
left join public.customer_ledger ledger on ledger.customer_id = customer.id
group by customer.id, customer.code, customer.company, ledger.currency;

-- Commercial automation v2: suppliers, site orders, purchase invoices,
-- VAT, multi-level discounts and editable export invoice drafts.

alter table public.b2b_onboarding_requests
alter column user_id drop not null;

alter table public.customers alter column currency set default 'USD';
alter table public.products alter column currency set default 'USD';

update public.products
set currency = 'USD'
where currency = 'EUR'
  and purchase_price = 0
  and sale_price = 0;

alter table public.products
add column if not exists vat_rate numeric(6,2) not null default 20;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  company text not null,
  contact_name text,
  email text,
  phone text,
  tax_number text,
  tax_office text,
  address text,
  currency text not null default 'TRY',
  status text not null default 'active' check (status in ('active', 'passive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.supplier_code_seq start 1001;

create or replace function public.assign_supplier_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'S-' || lpad(nextval('public.supplier_code_seq')::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists suppliers_assign_code on public.suppliers;
create trigger suppliers_assign_code
before insert or update on public.suppliers
for each row execute function public.assign_supplier_code();

create table if not exists public.site_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  auth_user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_company text,
  customer_name text,
  customer_email text,
  customer_phone text,
  currency text not null default 'USD',
  transport text,
  container_route text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'converted', 'cancelled')),
  items jsonb not null default '[]'::jsonb,
  total_cartons numeric(14,3) not null default 0,
  total_pallets numeric(14,3) not null default 0,
  total_weight numeric(14,3) not null default 0,
  source text not null default 'website',
  notes text,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices
alter column customer_id drop not null;

alter table public.invoices
add column if not exists supplier_id uuid references public.suppliers(id),
add column if not exists source_order_id uuid references public.site_orders(id),
add column if not exists scenario text not null default 'domestic',
add column if not exists invoice_discount_rate numeric(6,2) not null default 0,
add column if not exists invoice_discount_amount numeric(14,2) not null default 0,
add column if not exists total_discount numeric(14,2) not null default 0,
add column if not exists gib_status text not null default 'not_sent',
add column if not exists gib_uuid text,
add column if not exists draft_data jsonb not null default '{}'::jsonb;

alter table public.invoice_items
add column if not exists discount_1 numeric(6,2) not null default 0,
add column if not exists discount_2 numeric(6,2) not null default 0,
add column if not exists discount_3 numeric(6,2) not null default 0,
add column if not exists discount_total numeric(14,2) not null default 0;

create table if not exists public.supplier_ledger (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('invoice', 'payment', 'credit_note', 'opening')),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and (debit > 0 or credit > 0))
);

create table if not exists public.app_settings (
  id text primary key default 'main',
  company_name text,
  company_tax_number text,
  company_tax_office text,
  company_address text,
  company_country text not null default 'TR',
  default_currency text not null default 'USD',
  gib_provider text,
  gib_environment text not null default 'test',
  invoice_template jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, default_currency)
values ('main', 'USD')
on conflict (id) do nothing;

alter table public.suppliers enable row level security;
alter table public.site_orders enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.app_settings enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers', 'site_orders', 'supplier_ledger', 'app_settings']
  loop
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

create index if not exists suppliers_company_idx on public.suppliers (company);
create index if not exists site_orders_created_idx on public.site_orders (created_at desc);
create index if not exists site_orders_status_idx on public.site_orders (status);
create index if not exists supplier_ledger_supplier_date_idx on public.supplier_ledger (supplier_id, transaction_date desc);

create or replace function public.create_invoice_v2(
  p_invoice_type text,
  p_customer_id uuid,
  p_supplier_id uuid,
  p_source_order_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_scenario text,
  p_invoice_discount_rate numeric,
  p_notes text,
  p_draft_data jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_invoice_id uuid;
  new_invoice_no text;
  item jsonb;
  product_record public.products%rowtype;
  item_quantity numeric;
  item_price numeric;
  item_tax_rate numeric;
  discount_1 numeric;
  discount_2 numeric;
  discount_3 numeric;
  gross_line numeric;
  discounted_line numeric;
  line_discount numeric;
  item_tax numeric;
  invoice_subtotal numeric := 0;
  invoice_tax numeric := 0;
  invoice_line_discount numeric := 0;
  invoice_bottom_discount numeric := 0;
  invoice_grand_total numeric := 0;
  normalized_currency text;
  normalized_scenario text;
  normalized_type text;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz islem';
  end if;

  normalized_type := lower(coalesce(p_invoice_type, 'sale'));
  normalized_scenario := lower(coalesce(p_scenario, 'domestic'));
  normalized_currency := upper(coalesce(nullif(p_currency, ''), 'USD'));

  if normalized_type not in ('sale', 'purchase') then
    raise exception 'Fatura tipi gecersiz';
  end if;
  if normalized_type = 'sale' and p_customer_id is null then
    raise exception 'Satis faturasi icin cari secilmelidir';
  end if;
  if normalized_type = 'purchase' and p_supplier_id is null then
    raise exception 'Alis faturasi icin tedarikci secilmelidir';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Faturada en az bir urun bulunmalidir';
  end if;

  new_invoice_no :=
    case when normalized_type = 'purchase' then 'PUR-' else 'INV-' end ||
    to_char(coalesce(p_invoice_date, current_date), 'YYYY') || '-' ||
    lpad(nextval('public.invoice_no_seq')::text, 6, '0');

  insert into public.invoices (
    invoice_no, invoice_type, customer_id, supplier_id, source_order_id,
    invoice_date, due_date, currency, exchange_rate, scenario,
    invoice_discount_rate, notes, draft_data, created_by
  )
  values (
    new_invoice_no, normalized_type, p_customer_id, p_supplier_id, p_source_order_id,
    coalesce(p_invoice_date, current_date), p_due_date, normalized_currency,
    coalesce(nullif(p_exchange_rate, 0), 1), normalized_scenario,
    greatest(coalesce(p_invoice_discount_rate, 0), 0), p_notes,
    coalesce(p_draft_data, '{}'::jsonb), auth.uid()
  )
  returning id into new_invoice_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_quantity := (item->>'quantity')::numeric;
    item_price := (item->>'unit_price')::numeric;
    discount_1 := greatest(coalesce((item->>'discount_1')::numeric, 0), 0);
    discount_2 := greatest(coalesce((item->>'discount_2')::numeric, 0), 0);
    discount_3 := greatest(coalesce((item->>'discount_3')::numeric, 0), 0);
    item_tax_rate := case
      when normalized_scenario = 'export' then 0
      else greatest(coalesce((item->>'tax_rate')::numeric, 0), 0)
    end;

    if item_quantity <= 0 or item_price < 0 then
      raise exception 'Gecersiz fatura satiri';
    end if;

    select * into product_record
    from public.products
    where id = (item->>'product_id')::uuid
    for update;

    if product_record.id is null then
      raise exception 'Urun bulunamadi';
    end if;
    if normalized_type = 'sale' and product_record.stock_quantity < item_quantity then
      raise exception '% icin stok yetersiz. Mevcut: %', product_record.name, product_record.stock_quantity;
    end if;

    gross_line := round(item_quantity * item_price, 2);
    discounted_line := round(
      gross_line *
      (1 - least(discount_1, 100) / 100) *
      (1 - least(discount_2, 100) / 100) *
      (1 - least(discount_3, 100) / 100),
      2
    );
    line_discount := gross_line - discounted_line;
    item_tax := round(discounted_line * item_tax_rate / 100, 2);
    invoice_subtotal := invoice_subtotal + discounted_line;
    invoice_tax := invoice_tax + item_tax;
    invoice_line_discount := invoice_line_discount + line_discount;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price, tax_rate,
      discount_1, discount_2, discount_3, discount_total,
      line_subtotal, line_tax, line_total
    )
    values (
      new_invoice_id, product_record.id,
      coalesce(nullif(item->>'description', ''), product_record.name),
      item_quantity, item_price, item_tax_rate,
      discount_1, discount_2, discount_3, line_discount,
      discounted_line, item_tax, discounted_line + item_tax
    );

    if normalized_type = 'purchase' then
      update public.products
      set stock_quantity = stock_quantity + item_quantity,
          purchase_price = case
            when normalized_currency = 'USD' then discounted_line / item_quantity
            else (discounted_line / item_quantity) / coalesce(nullif(p_exchange_rate, 0), 1)
          end,
          vat_rate = item_tax_rate,
          updated_at = now()
      where id = product_record.id;

      insert into public.stock_movements (
        product_id, movement_type, quantity, unit_cost, reference_type,
        reference_id, note, created_by
      )
      values (
        product_record.id, 'purchase', item_quantity, item_price, 'invoice',
        new_invoice_id, new_invoice_no, auth.uid()
      );
    else
      update public.products
      set stock_quantity = stock_quantity - item_quantity, updated_at = now()
      where id = product_record.id;

      insert into public.stock_movements (
        product_id, movement_type, quantity, unit_cost, reference_type,
        reference_id, note, created_by
      )
      values (
        product_record.id, 'sale', -item_quantity, item_price, 'invoice',
        new_invoice_id, new_invoice_no, auth.uid()
      );
    end if;
  end loop;

  invoice_bottom_discount := round(
    invoice_subtotal * least(greatest(coalesce(p_invoice_discount_rate, 0), 0), 100) / 100,
    2
  );
  if invoice_subtotal > 0 and invoice_bottom_discount > 0 then
    invoice_tax := round(invoice_tax * ((invoice_subtotal - invoice_bottom_discount) / invoice_subtotal), 2);
  end if;
  invoice_grand_total := invoice_subtotal - invoice_bottom_discount + invoice_tax;

  update public.invoices
  set subtotal = invoice_subtotal,
      tax_total = invoice_tax,
      invoice_discount_amount = invoice_bottom_discount,
      total_discount = invoice_line_discount + invoice_bottom_discount,
      grand_total = invoice_grand_total
  where id = new_invoice_id;

  if normalized_type = 'sale' then
    insert into public.customer_ledger (
      customer_id, transaction_date, transaction_type, debit, currency,
      reference_type, reference_id, description, created_by
    )
    values (
      p_customer_id, coalesce(p_invoice_date, current_date), 'invoice',
      invoice_grand_total, normalized_currency, 'invoice',
      new_invoice_id, new_invoice_no, auth.uid()
    );
  else
    insert into public.supplier_ledger (
      supplier_id, transaction_date, transaction_type, credit, currency,
      reference_type, reference_id, description, created_by
    )
    values (
      p_supplier_id, coalesce(p_invoice_date, current_date), 'invoice',
      invoice_grand_total, normalized_currency, 'invoice',
      new_invoice_id, new_invoice_no, auth.uid()
    );
  end if;

  if p_source_order_id is not null then
    update public.site_orders
    set status = 'converted', converted_invoice_id = new_invoice_id, updated_at = now()
    where id = p_source_order_id;
  end if;

  return new_invoice_id;
end;
$$;

grant execute on function public.create_invoice_v2(
  text, uuid, uuid, uuid, date, date, text, numeric, text, numeric, text, jsonb, jsonb
) to authenticated;

create or replace view public.supplier_balances
with (security_invoker = true)
as
select
  supplier.id,
  supplier.code,
  supplier.company,
  ledger.currency,
  coalesce(sum(ledger.credit - ledger.debit), 0)::numeric(14,2) as balance
from public.suppliers supplier
left join public.supplier_ledger ledger on ledger.supplier_id = supplier.id
group by supplier.id, supplier.code, supplier.company, ledger.currency;

create or replace view public.vat_summary
with (security_invoker = true)
as
select
  date_trunc('month', invoice_date)::date as month,
  coalesce(sum(case when invoice_type = 'purchase' and currency = 'TRY' and status = 'posted' then tax_total else 0 end), 0)::numeric(14,2) as input_vat,
  coalesce(sum(case when invoice_type = 'sale' and scenario = 'domestic' and currency = 'TRY' and status = 'posted' then tax_total else 0 end), 0)::numeric(14,2) as output_vat,
  coalesce(sum(case
    when invoice_type = 'sale' and scenario = 'export' and status = 'posted'
    then case when currency = 'USD' then subtotal else subtotal / nullif(exchange_rate, 0) end
    else 0
  end), 0)::numeric(14,2) as export_sales
from public.invoices
group by date_trunc('month', invoice_date);
