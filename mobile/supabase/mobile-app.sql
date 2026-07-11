-- Sidya Global mobile app support tables
-- Run in Supabase SQL Editor after reviewing the existing production schema.

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_order_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'synced', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.mobile_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  device_info jsonb,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.mobile_push_tokens enable row level security;
alter table public.mobile_order_drafts enable row level security;
alter table public.mobile_sync_queue enable row level security;
alter table public.mobile_audit_log enable row level security;

create policy if not exists "Users manage own mobile push tokens" on public.mobile_push_tokens
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy if not exists "Users manage own mobile order drafts" on public.mobile_order_drafts
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy if not exists "Users manage own mobile sync queue" on public.mobile_sync_queue
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy if not exists "Admins read audit logs" on public.mobile_audit_log
  for select using (public.is_admin());

create policy if not exists "Users insert own audit logs" on public.mobile_audit_log
  for insert with check (auth.uid() = user_id or public.is_admin());

create index if not exists idx_mobile_push_tokens_user_id on public.mobile_push_tokens(user_id);
create index if not exists idx_mobile_order_drafts_user_id_status on public.mobile_order_drafts(user_id, status);
create index if not exists idx_mobile_sync_queue_user_id_status on public.mobile_sync_queue(user_id, status);
create index if not exists idx_mobile_audit_log_created_at on public.mobile_audit_log(created_at desc);
