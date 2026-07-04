const PROJECT_REF = "jhjforyykkxklfarjtjl";
const RUN_TOKEN = "sidya-commercial-run-20260704";

const catalogSql = `
-- Yönetim panelindeki satış fiyatlarını müşteri sitesine güvenli biçimde yayınlar.
-- Maliyet/alış fiyatı bu tabloda tutulmaz ve müşteriye açılmaz.

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

const rawAccessToken = () => String(process.env.SUPABASE_ACCESS_TOKEN || "");
const readAccessToken = () => rawAccessToken().trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "").trim();
const tokenDiagnostics = () => {
  const raw = rawAccessToken();
  const cleaned = readAccessToken();
  return {
    rawLength: raw.length,
    cleanedLength: cleaned.length,
    prefix: cleaned.slice(0, 4),
    hasWhitespace: /\s/.test(cleaned),
    hasQuote: /['\"]/.test(cleaned),
    looksLikeSupabasePat: cleaned.startsWith("sbp_"),
  };
};

const runSql = async (query) => {
  const accessToken = readAccessToken();
  if (!accessToken) {
    const error = new Error("SUPABASE_ACCESS_TOKEN is not configured in Vercel.");
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
  if (!response.ok) {
    const error = new Error(text || "Supabase SQL API failed.");
    error.statusCode = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
};

const verifySql = `
select
  to_regclass('public.documents') is not null as documents,
  to_regclass('public.document_items') is not null as document_items,
  to_regclass('public.receivables') is not null as receivables,
  to_regclass('public.payables') is not null as payables,
  to_regclass('public.assets') is not null as assets,
  to_regclass('public.site_catalog_prices') is not null as site_catalog_prices,
  to_regprocedure('public.post_document_v1(jsonb)') is not null as post_document_v1;
`;

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (req.query?.catalog === RUN_TOKEN) {
      const result = await runSql(catalogSql);
      res.status(200).json({ ok: true, action: "catalog", result });
      return;
    }

    if (req.query?.verify === RUN_TOKEN) {
      const result = await runSql(verifySql);
      res.status(200).json({ ok: true, action: "verify", result });
      return;
    }

    res.status(200).json({
      ok: true,
      hasSupabaseAccessToken: Boolean(readAccessToken()),
      tokenDiagnostics: tokenDiagnostics(),
      mode: "temporary-catalog-runner",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Migration failed.", tokenDiagnostics: tokenDiagnostics() });
  }
};
