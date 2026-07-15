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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

create table if not exists public.einvoice_settings (
  id text primary key default 'main',
  environment text not null default 'test' check (environment in ('test', 'production')),
  provider_type text not null default 'private_integrator' check (provider_type in ('private_integrator', 'gib_direct', 'portal_reference')),
  integration_status text not null default 'draft' check (integration_status in ('draft', 'configured', 'verified', 'blocked')),
  send_enabled boolean not null default false,
  company_title text,
  company_tax_number text,
  company_tax_office text,
  company_address text,
  sender_unit_alias text,
  postbox_alias text,
  endpoint_url text,
  integrator_username text,
  secret_reference text,
  certificate_alias text,
  xslt_profile_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists einvoice_settings_touch_updated_at on public.einvoice_settings;
create trigger einvoice_settings_touch_updated_at
before update on public.einvoice_settings
for each row execute function public.sidya_touch_updated_at();

create table if not exists public.einvoice_drafts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  draft_no text not null,
  scenario text not null default 'commercial',
  invoice_type text not null default 'sale',
  status text not null default 'draft' check (status in ('draft', 'ready', 'blocked', 'queued', 'sent', 'failed', 'cancelled')),
  currency text not null default 'TRY',
  issue_date date,
  customer_id uuid,
  ubl_xml text,
  validation_warnings text[] not null default array[]::text[],
  send_block_reason text,
  official_uuid text,
  official_envelope_id text,
  provider_response jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id),
  unique (draft_no)
);

drop trigger if exists einvoice_drafts_touch_updated_at on public.einvoice_drafts;
create trigger einvoice_drafts_touch_updated_at
before update on public.einvoice_drafts
for each row execute function public.sidya_touch_updated_at();

create table if not exists public.einvoice_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.einvoice_drafts(id) on delete cascade,
  event_type text not null,
  message text,
  payload jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.einvoice_outbox (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.einvoice_drafts(id) on delete cascade,
  status text not null default 'blocked' check (status in ('blocked', 'queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists einvoice_outbox_touch_updated_at on public.einvoice_outbox;
create trigger einvoice_outbox_touch_updated_at
before update on public.einvoice_outbox
for each row execute function public.sidya_touch_updated_at();

create index if not exists einvoice_drafts_invoice_idx on public.einvoice_drafts(invoice_id);
create index if not exists einvoice_drafts_status_idx on public.einvoice_drafts(status);
create index if not exists einvoice_drafts_created_idx on public.einvoice_drafts(created_at desc);
create index if not exists einvoice_events_draft_idx on public.einvoice_events(draft_id, created_at desc);
create index if not exists einvoice_outbox_status_idx on public.einvoice_outbox(status, created_at);

alter table public.einvoice_settings enable row level security;
alter table public.einvoice_drafts enable row level security;
alter table public.einvoice_events enable row level security;
alter table public.einvoice_outbox enable row level security;

drop policy if exists "admins manage einvoice settings" on public.einvoice_settings;
create policy "admins manage einvoice settings" on public.einvoice_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage einvoice drafts" on public.einvoice_drafts;
create policy "admins manage einvoice drafts" on public.einvoice_drafts for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage einvoice events" on public.einvoice_events;
create policy "admins manage einvoice events" on public.einvoice_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage einvoice outbox" on public.einvoice_outbox;
create policy "admins manage einvoice outbox" on public.einvoice_outbox for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.einvoice_settings to authenticated;
grant select, insert, update, delete on public.einvoice_drafts to authenticated;
grant select, insert, update, delete on public.einvoice_events to authenticated;
grant select, insert, update, delete on public.einvoice_outbox to authenticated;

insert into public.einvoice_settings (id, environment, provider_type, integration_status, send_enabled)
values ('main', 'test', 'private_integrator', 'draft', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
