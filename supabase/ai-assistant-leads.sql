create extension if not exists pgcrypto;

create table if not exists public.ai_assistant_leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text not null unique default ('SG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  session_id text not null,
  conversation_id text not null,
  language text not null default 'tr',
  lead_type text not null default 'other',
  lead_status text not null default 'new' check (lead_status in ('new','contacted','quote_preparing','won','lost')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  source text not null default 'ai_assistant' check (source in ('ai_assistant','contact_form','quote_form','whatsapp')),
  full_name text, company_name text, country text, city text, email text, phone text, whatsapp text,
  preferred_contact_method text, product_category text, product_name text, product_details text,
  quantity text, quantity_unit text, destination_country text, destination_city text, destination_port text,
  requested_delivery_date date, incoterm text, target_price text, private_label_request text,
  certificate_requirement text, logistics_type text, message text, conversation_summary text,
  conversation_json jsonb not null default '[]'::jsonb, page_url text, referrer text,
  utm_source text, utm_medium text, utm_campaign text, consent_given boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null, last_contacted_at timestamptz,
  contact_captured boolean not null default false, converted_to_quote boolean not null default false,
  abandoned boolean not null default false, duration_seconds integer not null default 0 check (duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists ai_assistant_leads_created_idx on public.ai_assistant_leads(created_at desc);
create index if not exists ai_assistant_leads_status_idx on public.ai_assistant_leads(lead_status,priority,created_at desc);
create or replace function public.sidya_ai_touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists ai_assistant_leads_touch_updated_at on public.ai_assistant_leads;
create trigger ai_assistant_leads_touch_updated_at before update on public.ai_assistant_leads for each row execute function public.sidya_ai_touch_updated_at();

create table if not exists public.ai_assistant_files (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.ai_assistant_leads(id) on delete cascade,
 storage_path text not null unique, original_name text not null, mime_type text not null,
 size_bytes bigint not null check(size_bytes between 1 and 10485760), created_at timestamptz not null default now()
);
create table if not exists public.ai_assistant_notes (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.ai_assistant_leads(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null, note text not null check(char_length(note) between 1 and 10000),
 created_at timestamptz not null default now()
);
create table if not exists public.ai_assistant_events (
 id bigint generated always as identity primary key, session_id text not null, conversation_id text not null,
 event_name text not null check(event_name in ('opened','message','contact_captured','completed','abandoned')),
 language text, page_url text, utm_source text, utm_medium text, utm_campaign text,
 duration_seconds integer not null default 0 check(duration_seconds>=0), created_at timestamptz not null default now()
);
alter table public.ai_assistant_leads enable row level security;
alter table public.ai_assistant_files enable row level security;
alter table public.ai_assistant_notes enable row level security;
alter table public.ai_assistant_events enable row level security;
revoke all on public.ai_assistant_leads,public.ai_assistant_files,public.ai_assistant_notes,public.ai_assistant_events from anon,authenticated;
grant select,update on public.ai_assistant_leads to authenticated;
grant select on public.ai_assistant_files,public.ai_assistant_events to authenticated;
grant select,insert on public.ai_assistant_notes to authenticated;
drop policy if exists "admins read ai leads" on public.ai_assistant_leads;\ncreate policy "admins read ai leads" on public.ai_assistant_leads for select to authenticated using(public.is_admin());
drop policy if exists "admins update ai leads" on public.ai_assistant_leads;\ncreate policy "admins update ai leads" on public.ai_assistant_leads for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins read ai files" on public.ai_assistant_files;\ncreate policy "admins read ai files" on public.ai_assistant_files for select to authenticated using(public.is_admin());
drop policy if exists "admins manage ai notes" on public.ai_assistant_notes;\ncreate policy "admins manage ai notes" on public.ai_assistant_notes for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins read ai events" on public.ai_assistant_events;\ncreate policy "admins read ai events" on public.ai_assistant_events for select to authenticated using(public.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(
 'ai-assistant-attachments','ai-assistant-attachments',false,10485760,
 array['application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']
) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
notify pgrst,'reload schema';
