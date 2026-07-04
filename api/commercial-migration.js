const PROJECT_REF = "jhjforyykkxklfarjtjl";
const RUN_TOKEN = "sidya-commercial-run-20260704";

const readEnv = (...names) => {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
};

const stripBearer = (value) =>
  String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^[']|[']$/g, "")
    .replace(/^[\"]|[\"]$/g, "")
    .trim();

const safePresence = (name, value, extra = {}) => ({
  name,
  configured: Boolean(value),
  length: value ? value.length : 0,
  prefix: value ? value.slice(0, 4) : "",
  ...extra,
});

const envDiagnostics = () => {
  const accessToken = stripBearer(readEnv("SUPABASE_ACCESS_TOKEN"));
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = readEnv("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING");

  return {
    supabaseAccessToken: safePresence("SUPABASE_ACCESS_TOKEN", accessToken, {
      looksLikeSupabasePat: accessToken.startsWith("sbp_"),
      looksLikeOtherToken: Boolean(accessToken) && !accessToken.startsWith("sbp_"),
    }),
    supabaseUrl: safePresence("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL", supabaseUrl, {
      host: supabaseUrl ? (() => {
        try {
          return new URL(supabaseUrl).host;
        } catch (_error) {
          return "invalid-url";
        }
      })() : "",
    }),
    serviceRoleKey: safePresence("SUPABASE_SERVICE_ROLE_KEY or SIDYA_SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey, {
      looksLikeJwt: serviceRoleKey.split(".").length === 3,
    }),
    databaseUrl: safePresence("DATABASE_URL or POSTGRES_URL", databaseUrl, {
      configuredForDirectSql: Boolean(databaseUrl),
    }),
  };
};

const informationSql = `
create extension if not exists pgcrypto;

create table if not exists public.information_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  message text,
  source text,
  created_at timestamptz default now()
);

alter table public.information_messages enable row level security;
drop policy if exists "public inserts information messages" on public.information_messages;
create policy "public inserts information messages"
on public.information_messages for insert to anon, authenticated
with check (true);
drop policy if exists "admins read information messages" on public.information_messages;
create policy "admins read information messages"
on public.information_messages for select to authenticated
using (public.is_admin());

grant insert on public.information_messages to anon, authenticated;
grant select, update, delete on public.information_messages to authenticated;
notify pgrst, 'reload schema';
`;

const catalogSql = `
create table if not exists public.site_catalog_prices (
  publish_key text primary key,
  catalog_id text,
  barcode text,
  name text not null,
  brand text,
  category text,
  grammage text,
  sale_price numeric(14,4) not null default 0 check (sale_price >= 0),
  currency text not null default 'USD',
  units_per_carton numeric(14,3) not null default 1,
  cartons_per_pallet numeric(14,3),
  kg_per_carton numeric(14,3),
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.site_catalog_prices enable row level security;
drop policy if exists "public reads active site catalog prices" on public.site_catalog_prices;
create policy "public reads active site catalog prices"
on public.site_catalog_prices for select to anon, authenticated
using (active = true or public.is_admin());
drop policy if exists "admins manage site catalog prices" on public.site_catalog_prices;
create policy "admins manage site catalog prices"
on public.site_catalog_prices for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.site_catalog_prices to anon, authenticated;
grant insert, update, delete on public.site_catalog_prices to authenticated;
notify pgrst, 'reload schema';
`;

const verifySql = `
select
  to_regclass('public.information_messages') is not null as information_messages,
  to_regclass('public.site_catalog_prices') is not null as site_catalog_prices,
  to_regclass('public.documents') is not null as documents,
  to_regclass('public.document_items') is not null as document_items,
  to_regclass('public.receivables') is not null as receivables,
  to_regclass('public.payables') is not null as payables,
  to_regclass('public.assets') is not null as assets,
  to_regprocedure('public.post_document_v1(jsonb)') is not null as post_document_v1;
`;

const runSqlWithManagementApi = async (query) => {
  const accessToken = stripBearer(readEnv("SUPABASE_ACCESS_TOKEN"));
  if (!accessToken || !accessToken.startsWith("sbp_")) {
    const error = new Error("SUPABASE_ACCESS_TOKEN is missing or is not a Supabase personal access token.");
    error.statusCode = 501;
    throw error;
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error("Supabase Management SQL API failed.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }

  return data;
};

const runSql = async (query) => runSqlWithManagementApi(query);

const respondMethodNotAllowed = (res) => {
  res.setHeader("Allow", "GET");
  res.status(405).json({ ok: false, error: "Method not allowed" });
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    respondMethodNotAllowed(res);
    return;
  }

  try {
    if (req.query?.bilgi === RUN_TOKEN || req.query?.information === RUN_TOKEN) {
      const result = await runSql(informationSql);
      res.status(200).json({ ok: true, action: "information", result });
      return;
    }

    if (req.query?.catalog === RUN_TOKEN) {
      const result = await runSql(catalogSql);
      res.status(200).json({ ok: true, action: "catalog", result });
      return;
    }

    if (req.query?.all === RUN_TOKEN) {
      const information = await runSql(informationSql);
      const catalog = await runSql(catalogSql);
      const verify = await runSql(verifySql);
      res.status(200).json({ ok: true, action: "all", information, catalog, verify });
      return;
    }

    if (req.query?.verify === RUN_TOKEN) {
      const result = await runSql(verifySql);
      res.status(200).json({ ok: true, action: "verify", result });
      return;
    }

    res.status(200).json({
      ok: true,
      mode: "commercial-migration-runner-20260704",
      actions: {
        runAll: `/api/commercial-migration?all=${RUN_TOKEN}`,
        runInformation: `/api/commercial-migration?bilgi=${RUN_TOKEN}`,
        runCatalog: `/api/commercial-migration?catalog=${RUN_TOKEN}`,
        verify: `/api/commercial-migration?verify=${RUN_TOKEN}`,
      },
      env: envDiagnostics(),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || "Migration failed.",
      details: error.safeDetails || undefined,
      env: envDiagnostics(),
    });
  }
};
