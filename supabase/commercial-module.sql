-- Sidya Ticari Otomasyon commercial module migration
-- Run in Supabase SQL Editor for project jhjforyykkxklfarjtjl.

alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists net_kg_liter numeric default 0;
alter table public.products add column if not exists purchase_price_vat_included numeric default 0;
alter table public.products add column if not exists purchase_price_vat_excluded numeric default 0;
alter table public.products add column if not exists sale_currency text default 'USD';
alter table public.products add column if not exists sale_carton_price numeric default 0;
alter table public.products add column if not exists support_rate numeric default 0;
alter table public.products add column if not exists support_eligible boolean default false;
alter table public.products add column if not exists active boolean default true;

alter table public.customers add column if not exists customer_type text default 'customer';
alter table public.customers add column if not exists due_days integer default 0;
alter table public.customers add column if not exists active boolean default true;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('order','invoice')),
  document_no text not null unique,
  document_date date not null default current_date,
  customer_id uuid references public.customers(id),
  due_date date,
  warehouse text,
  payment_type text,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  sales_channel text,
  usd_rate numeric not null default 1,
  eur_rate numeric not null default 1,
  gel_rate numeric not null default 1,
  support_rate numeric not null default 0,
  total_sale_try numeric not null default 0,
  total_purchase_vat_included numeric not null default 0,
  total_purchase_vat_excluded numeric not null default 0,
  vat_receivable numeric not null default 0,
  support_receivable numeric not null default 0,
  direct_expense numeric not null default 0,
  net_profit numeric not null default 0,
  profit_rate numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  product_id uuid references public.products(id),
  product_code text,
  product_name text not null,
  barcode text,
  brand text,
  category text,
  unit text,
  cartons numeric not null default 0,
  units_per_carton numeric not null default 1,
  total_units numeric not null default 0,
  net_kg_liter numeric not null default 0,
  vat_rate numeric not null default 0,
  purchase_unit_vat_included numeric not null default 0,
  purchase_cost_vat_included numeric not null default 0,
  purchase_cost_vat_excluded numeric not null default 0,
  vat_receivable numeric not null default 0,
  sale_currency text not null default 'USD',
  sale_carton_price numeric not null default 0,
  exchange_rate numeric not null default 1,
  gross_sale_try numeric not null default 0,
  support_rate numeric not null default 0,
  support_receivable numeric not null default 0,
  direct_expense numeric not null default 0,
  net_profit numeric not null default 0,
  profit_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  receivable_type text not null check (receivable_type in ('customer','vat','government_support','person_current')),
  description text,
  amount_try numeric not null default 0,
  remaining_try numeric not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open','partial','closed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  payable_type text not null check (payable_type in ('supplier','check','credit_card','bank_loan','tax_official','person_current')),
  description text,
  amount_try numeric not null default 0,
  remaining_try numeric not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open','partial','closed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('cash','bank','pos','stock','fixed_asset','vehicle','forklift')),
  name text not null,
  amount_try numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.receivables enable row level security;
alter table public.payables enable row level security;
alter table public.assets enable row level security;
alter table public.audit_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['documents','document_items','receivables','payables','assets','audit_log'] loop
    execute format('drop policy if exists admin_all_%I on public.%I', t, t);
    execute format('create policy admin_all_%I on public.%I for all using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))', t, t);
  end loop;
end $$;

create or replace function public.try_rate(currency_code text, usd_rate numeric, eur_rate numeric, gel_rate numeric)
returns numeric language sql immutable as $$
  select case upper(coalesce(currency_code, 'TRY'))
    when 'TRY' then 1
    when 'USD' then coalesce(nullif(usd_rate, 0), 1)
    when 'EUR' then coalesce(nullif(eur_rate, 0), 1)
    when 'GEL' then coalesce(nullif(gel_rate, 0), 1)
    else coalesce(nullif(usd_rate, 0), 1)
  end
$$;

create or replace function public.post_document_v1(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  h jsonb := payload -> 'header'; item jsonb; doc_id uuid; p record; due date;
  cartons numeric; upc numeric; total_units numeric; vat_rate numeric; unit_inc numeric; purchase_inc numeric; purchase_ex numeric; vat_amount numeric;
  sale_currency text; sale_carton numeric; fx numeric; gross_sale numeric; support_rate numeric; support_amount numeric; direct numeric; profit numeric;
  total_sale numeric := 0; total_purchase_inc numeric := 0; total_purchase_ex numeric := 0; total_vat numeric := 0; total_support numeric := 0; doc_direct numeric := 0; total_profit numeric := 0;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid()) then raise exception 'Admin authorization required'; end if;
  due := coalesce((h ->> 'due_date')::date, current_date);
  doc_direct := coalesce((h ->> 'direct_expense')::numeric, 0);
  insert into public.documents(document_type, document_no, document_date, customer_id, due_date, warehouse, payment_type, status, sales_channel, usd_rate, eur_rate, gel_rate, support_rate, direct_expense)
  values(coalesce(h ->> 'document_type','invoice'), coalesce(nullif(h ->> 'document_no',''), 'DOC-' || to_char(now(),'YYYYMMDDHH24MISS')), coalesce((h ->> 'document_date')::date,current_date), nullif(h ->> 'customer_id','')::uuid, due, h ->> 'warehouse', h ->> 'payment_type', coalesce(h ->> 'status','draft'), h ->> 'sales_channel', coalesce((h ->> 'usd_rate')::numeric,1), coalesce((h ->> 'eur_rate')::numeric,1), coalesce((h ->> 'gel_rate')::numeric,1), coalesce((h ->> 'support_rate')::numeric,0), doc_direct)
  returning id into doc_id;
  for item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    select * into p from public.products where id = nullif(item ->> 'product_id','')::uuid;
    cartons := greatest(coalesce((item ->> 'cartons')::numeric,0),0); upc := greatest(coalesce((item ->> 'units_per_carton')::numeric,p.units_per_carton,1),1); total_units := cartons * upc;
    vat_rate := coalesce((item ->> 'vat_rate')::numeric,p.vat_rate,0); unit_inc := coalesce((item ->> 'purchase_unit_vat_included')::numeric,nullif(p.purchase_price_vat_included,0),p.purchase_price,0);
    purchase_inc := total_units * unit_inc; purchase_ex := purchase_inc / (1 + vat_rate / 100); vat_amount := purchase_inc - purchase_ex;
    sale_currency := coalesce(nullif(item ->> 'sale_currency',''),p.sale_currency,'USD'); sale_carton := coalesce((item ->> 'sale_carton_price')::numeric,nullif(p.sale_carton_price,0),p.sale_price,0);
    fx := coalesce((item ->> 'exchange_rate')::numeric, public.try_rate(sale_currency,(h ->> 'usd_rate')::numeric,(h ->> 'eur_rate')::numeric,(h ->> 'gel_rate')::numeric)); gross_sale := sale_carton * cartons * fx;
    support_rate := coalesce((item ->> 'support_rate')::numeric, case when coalesce(p.support_eligible,false) then coalesce(p.support_rate,(h ->> 'support_rate')::numeric,0) else 0 end); support_amount := gross_sale * support_rate / 100;
    direct := coalesce((item ->> 'direct_expense')::numeric,0); profit := gross_sale + vat_amount + support_amount - purchase_inc - direct;
    insert into public.document_items(document_id, product_id, product_code, product_name, barcode, brand, category, unit, cartons, units_per_carton, total_units, net_kg_liter, vat_rate, purchase_unit_vat_included, purchase_cost_vat_included, purchase_cost_vat_excluded, vat_receivable, sale_currency, sale_carton_price, exchange_rate, gross_sale_try, support_rate, support_receivable, direct_expense, net_profit, profit_rate)
    values(doc_id,p.id,coalesce(p.product_code,p.sku),coalesce(p.name,item ->> 'product_name'),p.barcode,p.brand,p.category,p.unit,cartons,upc,total_units,coalesce(p.net_kg_liter,0),vat_rate,unit_inc,purchase_inc,purchase_ex,vat_amount,sale_currency,sale_carton,fx,gross_sale,support_rate,support_amount,direct,profit,case when purchase_inc > 0 then profit / purchase_inc else 0 end);
    total_sale := total_sale + gross_sale; total_purchase_inc := total_purchase_inc + purchase_inc; total_purchase_ex := total_purchase_ex + purchase_ex; total_vat := total_vat + vat_amount; total_support := total_support + support_amount; total_profit := total_profit + profit;
    if coalesce(h ->> 'document_type','invoice') = 'invoice' and coalesce(h ->> 'status','draft') = 'posted' and p.id is not null then update public.products set stock_quantity = coalesce(stock_quantity,0) - total_units where id = p.id; end if;
  end loop;
  update public.documents set total_sale_try=total_sale,total_purchase_vat_included=total_purchase_inc,total_purchase_vat_excluded=total_purchase_ex,vat_receivable=total_vat,support_receivable=total_support,net_profit=total_profit-doc_direct,profit_rate=case when total_purchase_inc > 0 then (total_profit-doc_direct)/total_purchase_inc else 0 end,updated_at=now() where id=doc_id;
  if coalesce(h ->> 'document_type','invoice') = 'invoice' and coalesce(h ->> 'status','draft') = 'posted' then
    insert into public.receivables(document_id,customer_id,receivable_type,description,amount_try,remaining_try,due_date) select doc_id,nullif(h ->> 'customer_id','')::uuid,'customer','Fatura müşteri alacağı',total_sale,total_sale,due where total_sale > 0;
    insert into public.receivables(document_id,customer_id,receivable_type,description,amount_try,remaining_try,due_date) select doc_id,nullif(h ->> 'customer_id','')::uuid,'vat','KDV alacağı',total_vat,total_vat,due where total_vat > 0;
    insert into public.receivables(document_id,customer_id,receivable_type,description,amount_try,remaining_try,due_date) select doc_id,nullif(h ->> 'customer_id','')::uuid,'government_support','Döviz destek alacağı',total_support,total_support,due where total_support > 0;
  end if;
  insert into public.audit_log(action,entity_type,entity_id,after_data) values('post_document_v1','documents',doc_id,payload);
  return doc_id;
end; $$;

create or replace view public.closing_balance_summary as
select 'asset'::text side, asset_type::text bucket, coalesce(sum(amount_try),0) amount_try from public.assets where active = true group by asset_type
union all select 'receivable', receivable_type, coalesce(sum(remaining_try),0) from public.receivables where status in ('open','partial') group by receivable_type
union all select 'payable', payable_type, coalesce(sum(remaining_try),0) from public.payables where status in ('open','partial') group by payable_type;
