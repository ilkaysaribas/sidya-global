-- Product price history support for the admin stock card.
-- Safe to run multiple times in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx
on public.audit_log (entity_type, entity_id, created_at desc);

create index if not exists audit_log_action_idx
on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "admins can read audit log" on public.audit_log;
create policy "admins can read audit log"
on public.audit_log
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can insert audit log" on public.audit_log;
create policy "admins can insert audit log"
on public.audit_log
for insert
to authenticated
with check (public.is_admin());
