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
  on conflict (auth_user_id) do update set
    onboarding_request_id = excluded.onboarding_request_id,
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
