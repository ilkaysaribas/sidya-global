create extension if not exists pgcrypto;

create table if not exists public.crm_firms (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default '',
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  website text,
  country text,
  city text,
  sector text,
  product_interest text,
  stage text not null default 'lead',
  status text not null default 'active',
  priority text default 'normal',
  source text,
  tax_office text,
  tax_number text,
  address text,
  notes text,
  estimated_value numeric(14,2),
  currency text default 'USD',
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.crm_firms(id) on delete cascade,
  note text not null,
  note_type text default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.crm_firms(id) on delete cascade,
  old_stage text,
  new_stage text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_firms_company_name on public.crm_firms(company_name);
create index if not exists idx_crm_firms_stage on public.crm_firms(stage);
create index if not exists idx_crm_firms_status on public.crm_firms(status);
create index if not exists idx_crm_firms_country on public.crm_firms(country);
create index if not exists idx_crm_firms_created_at on public.crm_firms(created_at);
create index if not exists idx_crm_notes_firm_id on public.crm_notes(firm_id);
create index if not exists idx_crm_stage_history_firm_id on public.crm_stage_history(firm_id);

create or replace function public.set_crm_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_firms_updated_at on public.crm_firms;
create trigger trg_crm_firms_updated_at
before update on public.crm_firms
for each row
execute function public.set_crm_updated_at();

create or replace function public.log_crm_firm_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_audit_log(table_name, row_id, action, old_data, new_data)
    values ('crm_firms', new.id, 'INSERT', null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.crm_audit_log(table_name, row_id, action, old_data, new_data)
    values ('crm_firms', new.id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.crm_audit_log(table_name, row_id, action, old_data, new_data)
    values ('crm_firms', old.id, 'DELETE', to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_crm_firms_audit on public.crm_firms;
create trigger trg_crm_firms_audit
after insert or update or delete on public.crm_firms
for each row
execute function public.log_crm_firm_changes();

create or replace function public.log_crm_stage_change()
returns trigger
language plpgsql
as $$
begin
  if old.stage is distinct from new.stage then
    insert into public.crm_stage_history(firm_id, old_stage, new_stage)
    values (new.id, old.stage, new.stage);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_firms_stage_history on public.crm_firms;
create trigger trg_crm_firms_stage_history
after update of stage on public.crm_firms
for each row
execute function public.log_crm_stage_change();

create or replace view public.crm_pipeline_view as
select
  stage,
  count(*) as firm_count,
  coalesce(sum(estimated_value), 0) as total_estimated_value
from public.crm_firms
where status <> 'deleted'
group by stage
order by stage;

alter table public.crm_firms disable row level security;
alter table public.crm_notes disable row level security;
alter table public.crm_stage_history disable row level security;
alter table public.crm_audit_log disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.crm_firms to anon, authenticated, service_role;
grant all on table public.crm_notes to anon, authenticated, service_role;
grant all on table public.crm_stage_history to anon, authenticated, service_role;
grant all on table public.crm_audit_log to anon, authenticated, service_role;
grant all on table public.crm_pipeline_view to anon, authenticated, service_role;
