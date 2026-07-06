const PROJECT_REF = "jhjforyykkxklfarjtjl";
const MIGRATION_RUN_TOKEN = "sidya-mail-crm-run-20260706";
const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc";

const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
const stripBearer = (value) => String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "").trim();
const supabaseUrl = () => (readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const serviceKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");
const json = (res, status, body) => res.status(status).json(body);

async function rest(path, options = {}) {
  const key = serviceKey();
  if (!key) { const error = new Error("SUPABASE_SERVICE_ROLE_KEY eksik."); error.statusCode = 501; throw error; }
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) { const error = new Error("Supabase REST isteği başarısız."); error.statusCode = response.status; error.safeDetails = data; throw error; }
  return data;
}

async function assertAdmin(req) {
  const token = stripBearer(req.headers.authorization);
  if (!token) { const error = new Error("Admin oturumu bulunamadı."); error.statusCode = 401; throw error; }
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: serviceKey(), Authorization: `Bearer ${token}` } });
  if (!response.ok) { const error = new Error("Admin oturumu doğrulanamadı."); error.statusCode = 401; throw error; }
  const user = await response.json();
  const admins = await rest(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!Array.isArray(admins) || !admins.length) { const error = new Error("Bu işlem için admin yetkisi gerekli."); error.statusCode = 403; throw error; }
  return user;
}

async function loadMailSettings() {
  const rows = await rest("mail_settings?id=eq.main&select=*");
  const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
  return {
    host: readEnv("SMTP_HOST", "MAIL_HOST") || row.smtp_host,
    port: Number(readEnv("SMTP_PORT", "MAIL_PORT") || row.smtp_port || 587),
    secure: String(readEnv("SMTP_SECURE", "MAIL_SECURE") || row.smtp_secure || "").toLowerCase() === "true" || Number(readEnv("SMTP_PORT", "MAIL_PORT") || row.smtp_port) === 465,
    user: readEnv("SMTP_USER", "MAIL_USER") || row.smtp_user,
    pass: readEnv("SMTP_PASSWORD", "MAIL_PASSWORD") || row.smtp_password,
    senderName: readEnv("SMTP_SENDER_NAME", "MAIL_SENDER_NAME") || row.sender_name || "Sidya Global Export",
    senderEmail: readEnv("SMTP_SENDER_EMAIL", "MAIL_SENDER_EMAIL") || row.sender_email || "export@sidyaglobal.com",
  };
}

async function sendSmtpMail({ to, subject, body }) {
  const nodemailer = require("nodemailer");
  const settings = await loadMailSettings();
  if (!settings.host || !settings.user || !settings.pass) { const error = new Error("SMTP ayarları eksik. Mail Center > SMTP ayarlarını kaydedin."); error.statusCode = 400; throw error; }
  const transporter = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure, auth: { user: settings.user, pass: settings.pass } });
  return transporter.sendMail({ from: `"${settings.senderName}" <${settings.senderEmail}>`, to, subject, text: body || "", html: String(body || "").replace(/\n/g, "<br>") });
}

const customerFields = ["company_name", "contact_name", "country", "email", "phone", "whatsapp", "source", "interested_products", "status", "last_contact_at", "next_follow_up_at", "notes"];
const cleanCustomer = (body = {}) => customerFields.reduce((acc, key) => { if (Object.prototype.hasOwnProperty.call(body, key)) acc[key] = body[key] === "" ? null : body[key]; return acc; }, {});
const addDaysIso = (days) => new Date(Date.now() + days * 86400000).toISOString();
const bodyValue = (body, ...keys) => keys.map((key) => body[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "") || "";

const mailCrmSql = `
create extension if not exists pgcrypto;
create or replace function public.sidya_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create table if not exists public.mail_settings (id text primary key default 'main', smtp_host text, smtp_port integer, smtp_secure boolean not null default true, smtp_user text, smtp_password text, sender_name text not null default 'Sidya Global Export', sender_email text not null default 'export@sidyaglobal.com', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
drop trigger if exists mail_settings_touch_updated_at on public.mail_settings; create trigger mail_settings_touch_updated_at before update on public.mail_settings for each row execute function public.sidya_touch_updated_at();
create table if not exists public.crm_customers (id uuid primary key default gen_random_uuid(), company_name text, contact_name text, country text, email text, phone text, whatsapp text, source text not null default 'website', interested_products text, status text not null default 'lead', last_contact_at timestamptz, next_follow_up_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists crm_customers_email_unique_idx on public.crm_customers (lower(email)) where email is not null and btrim(email) <> '';
create index if not exists crm_customers_follow_up_idx on public.crm_customers (next_follow_up_at); create index if not exists crm_customers_status_idx on public.crm_customers (status);
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

async function runManagementSql(query) {
  const accessToken = stripBearer(readEnv("SUPABASE_ACCESS_TOKEN"));
  if (!accessToken || !accessToken.startsWith("sbp_")) { const error = new Error("SUPABASE_ACCESS_TOKEN eksik veya Supabase personal access token değil."); error.statusCode = 501; throw error; }
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) { const error = new Error("Supabase SQL API hata verdi."); error.statusCode = response.status; error.safeDetails = data; throw error; }
  return data;
}

async function handleMailCrm(req, res, action) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (action === "migrate") {
    const token = req.query.run || req.query.verify || req.headers["x-migration-token"];
    const envToken = readEnv("MIGRATION_ADMIN_KEY");
    if (!token || !(token === MIGRATION_RUN_TOKEN || (envToken && token === envToken))) return json(res, 401, { ok: false, error: "Migration token gerekli." });
    const verifySql = "select to_regclass('public.mail_settings') is not null as mail_settings, to_regclass('public.crm_customers') is not null as crm_customers, to_regclass('public.crm_interactions') is not null as crm_interactions;";
    const result = req.query.verify ? await runManagementSql(verifySql) : await runManagementSql(mailCrmSql);
    const verify = await runManagementSql(verifySql);
    return json(res, 200, { ok: true, result, verify });
  }
  if (action === "contact") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    const body = req.body || {};
    const email = String(bodyValue(body, "email", "mail") || "").trim().toLowerCase();
    if (!email) return json(res, 400, { ok: false, error: "E-posta gerekli." });
    const payload = { company_name: String(bodyValue(body, "company", "company_name") || "").trim(), contact_name: String(bodyValue(body, "name", "contact", "contact_name") || "").trim(), country: String(bodyValue(body, "country") || "").trim(), email, phone: String(bodyValue(body, "phone", "tel") || "").trim(), whatsapp: String(bodyValue(body, "whatsapp") || "").trim(), source: String(bodyValue(body, "source") || "website_contact").trim(), interested_products: String(bodyValue(body, "product", "interested_products") || "").trim(), status: "lead", last_contact_at: new Date().toISOString(), next_follow_up_at: addDaysIso(15), notes: String(bodyValue(body, "message", "notes", "body") || "").trim() };
    const existing = await rest(`crm_customers?email=eq.${encodeURIComponent(email)}&select=*`);
    let customer;
    if (Array.isArray(existing) && existing.length) {
      const current = existing[0];
      const rows = await rest(`crm_customers?id=eq.${encodeURIComponent(current.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ company_name: payload.company_name || current.company_name, contact_name: payload.contact_name || current.contact_name, country: payload.country || current.country, phone: payload.phone || current.phone, whatsapp: payload.whatsapp || current.whatsapp, interested_products: payload.interested_products || current.interested_products, last_contact_at: payload.last_contact_at, next_follow_up_at: current.next_follow_up_at || payload.next_follow_up_at, notes: [current.notes, payload.notes].filter(Boolean).join("\n---\n") }) });
      customer = Array.isArray(rows) ? rows[0] : rows;
    } else {
      const rows = await rest("crm_customers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      customer = Array.isArray(rows) ? rows[0] : rows;
    }
    await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ customer_id: customer.id, type: "form", direction: "inbound", subject: `Website talebi - ${payload.interested_products || "Genel"}`, body: payload.notes }) });
    let mailSent = false;
    try { await sendSmtpMail({ to: "export@sidyaglobal.com", subject: `Sidya Global talep - ${payload.company_name || payload.contact_name || payload.email}`, body: [`Firma: ${payload.company_name || "-"}`, `Yetkili: ${payload.contact_name || "-"}`, `E-posta: ${payload.email}`, `Telefon: ${payload.phone || "-"}`, `WhatsApp: ${payload.whatsapp || "-"}`, `Ülke: ${payload.country || "-"}`, `Ürün: ${payload.interested_products || "-"}`, "", payload.notes || ""].join("\n") }); mailSent = true; } catch (_error) {}
    return json(res, 200, { ok: true, customerId: customer.id, mailSent });
  }
  await assertAdmin(req);
  if (action === "mail-settings") {
    if (req.method === "GET") { const rows = await rest("mail_settings?id=eq.main&select=id,smtp_host,smtp_port,smtp_secure,smtp_user,sender_name,sender_email,updated_at,smtp_password"); const row = Array.isArray(rows) && rows[0] ? rows[0] : {}; const hasPassword = Boolean(row.smtp_password || readEnv("SMTP_PASSWORD", "MAIL_PASSWORD")); delete row.smtp_password; row.hasPassword = hasPassword; return json(res, 200, { ok: true, settings: row }); }
    if (req.method === "POST") { const body = req.body || {}; const currentRows = await rest("mail_settings?id=eq.main&select=smtp_password"); const current = Array.isArray(currentRows) && currentRows[0] ? currentRows[0] : {}; const payload = { id: "main", smtp_host: String(body.smtp_host || "").trim(), smtp_port: Number.parseInt(body.smtp_port, 10) || 587, smtp_secure: Boolean(body.smtp_secure), smtp_user: String(body.smtp_user || "").trim(), sender_name: String(body.sender_name || "Sidya Global Export").trim(), sender_email: String(body.sender_email || "export@sidyaglobal.com").trim() }; if (String(body.smtp_password || "").trim()) payload.smtp_password = String(body.smtp_password).trim(); else if (current.smtp_password) payload.smtp_password = current.smtp_password; await rest("mail_settings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) }); return json(res, 200, { ok: true, message: "Mail ayarları kaydedildi." }); }
  }
  if (action === "send-mail") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    const { to, subject, body, customerId, type } = req.body || {};
    if (!to || !subject) return json(res, 400, { ok: false, error: "Alıcı ve konu gerekli." });
    await sendSmtpMail({ to, subject, body: body || "" });
    if (customerId) { await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ customer_id: customerId, type: type || "email", direction: "outbound", subject, body: body || "" }) }); await rest(`crm_customers?id=eq.${encodeURIComponent(customerId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_contact_at: new Date().toISOString() }) }); }
    return json(res, 200, { ok: true, message: "Mail gönderildi." });
  }
  if (action === "crm-center") {
    const crmAction = req.query.action || "customers";
    if (req.method === "GET" && crmAction === "customers") return json(res, 200, { ok: true, customers: await rest("crm_customers?select=*&order=created_at.desc") || [] });
    if (req.method === "GET" && crmAction === "interactions") { const id = String(req.query.customerId || ""); if (!id) return json(res, 400, { ok: false, error: "customerId gerekli." }); return json(res, 200, { ok: true, interactions: await rest(`crm_interactions?customer_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc`) || [] }); }
    if (req.method === "POST" && crmAction === "customer") { const rows = await rest("crm_customers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(cleanCustomer(req.body || {})) }); return json(res, 200, { ok: true, customer: Array.isArray(rows) ? rows[0] : rows }); }
    if (req.method === "PATCH" && crmAction === "customer") { const id = String((req.body || {}).id || ""); if (!id) return json(res, 400, { ok: false, error: "Müşteri id gerekli." }); const rows = await rest(`crm_customers?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(cleanCustomer(req.body || {})) }); return json(res, 200, { ok: true, customer: Array.isArray(rows) ? rows[0] : rows }); }
    if (req.method === "POST" && crmAction === "interaction") { const body = req.body || {}; if (!body.customer_id) return json(res, 400, { ok: false, error: "customer_id gerekli." }); const rows = await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ customer_id: body.customer_id, type: body.type || "note", direction: body.direction || "internal", subject: body.subject || "Not", body: body.body || "" }) }); return json(res, 200, { ok: true, interaction: Array.isArray(rows) ? rows[0] : rows }); }
  }
  return json(res, 404, { ok: false, error: "Mail CRM action bulunamadı." });
}

function sendBackendScript(res) {
  const defaultSupabaseUrl = DEFAULT_SUPABASE_URL;
  const defaultSupabasePublishableKey = DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || defaultSupabasePublishableKey;
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "b2b-documents";
  const config = { supabaseUrl: publicUrl, supabasePublishableKey, supabaseAnonKey: supabasePublishableKey, storageBucket, configured: Boolean(publicUrl && supabasePublishableKey) };
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(`
    window.SIDYA_BACKEND = ${JSON.stringify(config)};
    (function(){
      if (window.__sidyaAdminFixLoader) return;
      window.__sidyaAdminFixLoader = true;
      function appReady(){ var shell = document.getElementById("appShell"); return !!(shell && !shell.hidden); }
      function appendScript(id, src){ if (document.getElementById(id)) return; var script = document.createElement("script"); script.id = id; script.src = src; script.defer = true; document.head.appendChild(script); }
      function loadSiteEnhancements(){ if (document.getElementById("quoteForm")) { appendScript("sidyaMailCrmRouteShimScript", "/mail-crm-route-shim.js?v=20260706-1"); appendScript("sidyaSiteMailCrmScript", "/site-mail-crm.js?v=20260706-1"); } }
      function loadFixes(){ loadSiteEnhancements(); if (!appReady()) return; appendScript("sidyaMailCrmRouteShimScript", "/mail-crm-route-shim.js?v=20260706-1"); appendScript("sidyaAdminPanelFixesScript", "/admin-panel-fixes.js?v=20260705-2"); appendScript("sidyaAdminRateFixScript", "/admin-rate-fix.js?v=20260706-2"); appendScript("sidyaAdminProfitFixScript", "/admin-profit-fix.js?v=20260705-1"); appendScript("sidyaAdminProfitTableV4Script", "/admin-profit-table-v4.js?v=20260706-1"); appendScript("sidyaInfoActionsScript", "/admin-info-actions.js?v=20260706-1"); appendScript("sidyaMailCrmAdminScript", "/admin-mail-crm.js?v=20260706-1"); }
      var timer = setInterval(function(){ loadFixes(); if (appReady() && document.getElementById("sidyaAdminProfitTableV4Script") && document.getElementById("sidyaInfoActionsScript") && document.getElementById("sidyaMailCrmAdminScript")) clearInterval(timer); }, 500);
      document.addEventListener("DOMContentLoaded", loadFixes); window.addEventListener("load", loadFixes);
    })();
  `);
}

module.exports = async (req, res) => {
  try {
    const action = req.query.mailCrm;
    if (action) return await handleMailCrm(req, res, action);
    return sendBackendScript(res);
  } catch (error) {
    return json(res, error.statusCode || 500, { ok: false, error: error.message, details: error.safeDetails || null });
  }
};
