const PROJECT_REF = "jhjforyykkxklfarjtjl";
const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const rateBuckets = new Map();

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

const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

const rateLimit = (req, key, limit = 10, windowMs = 60_000) => {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(id) || { count: 0, reset: now + windowMs };
  if (bucket.reset <= now) { bucket.count = 0; bucket.reset = now + windowMs; }
  bucket.count += 1;
  rateBuckets.set(id, bucket);
  if (bucket.count > limit) {
    const error = new Error("Too many migration requests. Try again later.");
    error.statusCode = 429;
    throw error;
  }
};

const safePresence = (name, value, extra = {}) => ({
  name,
  configured: Boolean(value),
  ...extra,
});

const envDiagnostics = () => {
  const accessToken = stripBearer(readEnv("SUPABASE_ACCESS_TOKEN"));
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = readEnv("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING");
  const migrationKey = readEnv("MIGRATION_ADMIN_KEY");

  return {
    migrationAdminKey: safePresence("MIGRATION_ADMIN_KEY", migrationKey),
    supabaseAccessToken: safePresence("SUPABASE_ACCESS_TOKEN", accessToken, {
      looksLikeSupabasePat: accessToken.startsWith("sbp_"),
    }),
    supabaseUrl: safePresence("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL", supabaseUrl, {
      host: supabaseUrl ? (() => {
        try { return new URL(supabaseUrl).host; } catch (_error) { return "invalid-url"; }
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

const requireMigrationToken = (req) => {
  const configured = readEnv("MIGRATION_ADMIN_KEY");
  const supplied = String(req.query?.token || req.query?.run || req.headers["x-migration-token"] || "").trim();
  if (!configured || !supplied || supplied !== configured) {
    const error = new Error("MIGRATION_ADMIN_KEY is required for migration actions.");
    error.statusCode = 401;
    throw error;
  }
};

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
  try { data = text ? JSON.parse(text) : null; } catch (_error) { data = text; }

  if (!response.ok) {
    const error = new Error("Supabase Management SQL API failed.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }

  return data;
};

const runSql = async (query) => runSqlWithManagementApi(query);

const runRestWriteTest = async () => {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
    error.statusCode = 501;
    throw error;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/information_messages`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: "Sidya Migration Test",
      email: "migration-test@sidyaglobal.com",
      phone: "",
      company: "Sidya Global",
      message: "Automatic live write test from commercial migration endpoint.",
      source: "commercial-migration-rest-test",
    }),
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_error) { data = text; }

  if (!response.ok) {
    const error = new Error("Service role REST write test failed.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }

  return data;
};

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
    rateLimit(req, "commercial-migration");
    const action = ["information", "bilgi", "catalog", "all", "verify", "restTest"].find((key) => Object.prototype.hasOwnProperty.call(req.query || {}, key));

    if (!action) {
      res.status(200).json({
        ok: true,
        mode: "commercial-migration-runner-secured",
        actions: ["information", "catalog", "all", "verify", "restTest"],
        token: "Send MIGRATION_ADMIN_KEY as ?token=... or x-migration-token header.",
        env: envDiagnostics(),
      });
      return;
    }

    requireMigrationToken(req);

    if (action === "bilgi" || action === "information") {
      const result = await runSql(informationSql);
      res.status(200).json({ ok: true, action: "information", result });
      return;
    }

    if (action === "catalog") {
      const result = await runSql(catalogSql);
      res.status(200).json({ ok: true, action: "catalog", result });
      return;
    }

    if (action === "all") {
      const information = await runSql(informationSql);
      const catalog = await runSql(catalogSql);
      const verify = await runSql(verifySql);
      res.status(200).json({ ok: true, action: "all", information, catalog, verify });
      return;
    }

    if (action === "verify") {
      const result = await runSql(verifySql);
      res.status(200).json({ ok: true, action: "verify", result });
      return;
    }

    if (action === "restTest") {
      const result = await runRestWriteTest();
      res.status(200).json({ ok: true, action: "restTest", result });
      return;
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || "Migration failed.",
      details: error.safeDetails || undefined,
      env: envDiagnostics(),
    });
  }
};
