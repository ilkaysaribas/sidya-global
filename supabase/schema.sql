-- Sidya Global B2B backend setup
-- Run this in Supabase SQL Editor after creating a Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.b2b_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  contact text not null,
  email text not null,
  country text not null,
  tax_number text not null,
  incoterm text not null,
  notes text,
  document_paths text[] not null default '{}',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

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
