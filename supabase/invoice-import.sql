-- Invoice file import staging tables for Sidya Global Ticari Otomasyon.
-- Stores raw invoice headers/lines before final invoice approval.

create table if not exists public.invoice_imports (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  file_name text,
  file_type text,
  invoice_type text not null default 'purchase' check (invoice_type in ('purchase', 'sale', 'return')),
  invoice_no text,
  invoice_date date,
  due_date date,
  customer_id uuid references public.customers(id) on delete set null,
  raw_customer_name text,
  raw_tax_number text,
  currency text not null default 'TRY',
  subtotal numeric not null default 0,
  total_discount numeric not null default 0,
  tax_total numeric not null default 0,
  grand_total numeric not null default 0,
  payable_total numeric not null default 0,
  parsing_status text not null default 'draft',
  raw_payload jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_import_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_import_id uuid not null references public.invoice_imports(id) on delete cascade,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,
  row_no integer not null default 0,
  raw_product_name text,
  raw_barcode text,
  raw_product_code text,
  seller_product_code text,
  matched_product_id uuid references public.products(id) on delete set null,
  match_type text not null default 'none',
  match_confidence numeric not null default 0,
  quantity numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  discount_rate numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_rate numeric not null default 0,
  vat_amount numeric not null default 0,
  other_tax_amount numeric not null default 0,
  line_subtotal numeric not null default 0,
  line_total numeric not null default 0,
  lot_number text,
  expiry_date date,
  matching_status text not null default 'unmatched',
  manual_entry boolean not null default false,
  stock_processed boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_imports_invoice_no_idx on public.invoice_imports(invoice_no);
create index if not exists invoice_imports_customer_idx on public.invoice_imports(customer_id);
create index if not exists invoice_import_lines_import_idx on public.invoice_import_lines(invoice_import_id);
create index if not exists invoice_import_lines_product_idx on public.invoice_import_lines(matched_product_id);

alter table public.invoice_imports enable row level security;
alter table public.invoice_import_lines enable row level security;

grant select, insert, update, delete on public.invoice_imports to authenticated;
grant select, insert, update, delete on public.invoice_import_lines to authenticated;

-- Reuse the project's admin authorization helper when it exists.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_imports' and policyname = 'invoice_imports_admin_all') then
      execute 'create policy invoice_imports_admin_all on public.invoice_imports for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_import_lines' and policyname = 'invoice_import_lines_admin_all') then
      execute 'create policy invoice_import_lines_admin_all on public.invoice_import_lines for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    end if;
  end if;
end $$;
