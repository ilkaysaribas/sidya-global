const PROJECT_REF = "jhjforyykkxklfarjtjl";
const RUN_TOKEN = "sidya-mail-crm-run-20260706";

const stripBearer = (value) => String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "").trim();
const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";

const sql = `
create extension if not exists pgcrypto;
create or replace function public.sidya_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create table if not exists public.mail_settings (id text primary key default 'main', smtp_host text, smtp_port integer, smtp_secure boolean not null default true, smtp_user text, smtp_password text, sender_name text not null default 'Sidya Global Export', sender_email text not null default 'export@sidyaglobal.com', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
drop trigger if exists mail_settings_touch_updated_at on public.mail_settings; create trigger mail_settings_touch_updated_at before update on public.mail_settings for each row execute function public.sidya_touch_updated_at();
create table if not exists public.crm_customers (id uuid primary key default gen_random_uuid(), company_name text, contact_name text, country text, email text, phone text, whatsapp text, source text not null default 'website', interested_products text, status text not null default 'lead', last_contact_at timestamptz, next_follow_up_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists crm_customers_email_unique_idx on public.crm_customers (lower(email)) where email is not null and btrim(email) <> '';
create index if not exists crm_customers_follow_up_idx on public.crm_customers (next_follow_up_at);
create index if not exists crm_customers_status_idx on public.crm_customers (status);
drop trigger if exists crm_customers_touch_updated_at on public.crm_customers; create trigger crm_customers_touch_updated_at before update on public.crm_customers for each row execute function public.sidya_touch_updated_at();
create table if not exists public.crm_interactions (id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.crm_customers(id) on delete cascade, type text not null default 'form' check (type in ('email','form','whatsapp','call','quote','note')), direction text not null default 'inbound' check (direction in ('inbound','outbound','internal')), subject text, body text, created_at timestamptz not null default now());
create index if not exists crm_interactions_customer_created_idx on public.crm_interactions (customer_id, created_at desc);
alter table public.mail_settings enable row level security; alter table public.crm_customers enable row level security; alter table public.crm_interactions enable row level security;
drop policy if exists "admins manage mail settings" on public.mail_settings; create policy "admins manage mail settings" on public.mail_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage crm customers" on public.crm_customers; create policy "admins manage crm customers" on public.crm_customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage crm interactions" on public.crm_interactions; create policy "admins manage crm interactions" on public.crm_interactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public creates crm customers" on public.crm_customers; create policy "public creates crm customers" on public.crm_customers for insert to anon, authenticated with check (true);
drop policy if exists "public creates crm interactions" on public.crm_interactions; create policy "public creates crm interactions" on public.crm_interactions for insert to anon, authenticated with check (true);
grant select, insert, update, delete on public.mail_settings to authenticated; grant select, insert, update, delete on public.crm_customers to authenticated; grant select, insert, update, delete on public.crm_interactions to authenticated; grant insert on public.crm_customers to anon; grant insert on public.crm_interactions to anon;
insert into public.mail_settings (id, sender_name, sender_email) values ('main', 'Sidya Global Export', 'export@sidyaglobal.com') on conflict (id) do nothing;
notify pgrst, 'reload schema';
`;

const verifySql = `select to_regclass('public.mail_settings') is not null as mail_settings, to_regclass('public.crm_customers') is not null as crm_customers, to_regclass('public.crm_interactions') is not null as crm_interactions;`;

async function runSql(query) {
  const accessToken = stripBearer(readEnv("SUPABASE_ACCESS_TOKEN"));
  if (!accessToken || !accessToken.startsWith("sbp_")) {
    const error = new Error("SUPABASE_ACCESS_TOKEN eksik veya Supabase personal access token değil.");
    error.statusCode = 501;
    throw error;
  }
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) {
    const error = new Error("Supabase SQL API hata verdi.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const token = req.query.run || req.query.verify || req.headers["x-migration-token"];
  const envToken = readEnv("MIGRATION_ADMIN_KEY");
  const allowed = token && (token === RUN_TOKEN || (envToken && token === envToken));
  if (!allowed) return res.status(401).json({ ok: false, error: "Migration token gerekli." });
  try {
    if (req.query.verify) return res.status(200).json({ ok: true, result: await runSql(verifySql) });
    const result = await runSql(sql);
    const verify = await runSql(verifySql);
    res.status(200).json({ ok: true, message: "Mail Center CRM tabloları kuruldu.", result, verify });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: error.message, details: error.safeDetails || null });
  }
};
