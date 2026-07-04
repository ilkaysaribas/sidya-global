const fs = require("fs");
const path = require("path");

const PROJECT_REF = "jhjforyykkxklfarjtjl";
const RUN_TOKEN = "sidya-commercial-run-20260704";

const readSql = () => fs.readFileSync(path.join(process.cwd(), "supabase", "commercial-module.sql"), "utf8");
const readAccessToken = () => String(process.env.SUPABASE_ACCESS_TOKEN || "").trim().replace(/^Bearer\s+/i, "").trim();

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
  to_regprocedure('public.post_document_v1(jsonb)') is not null as post_document_v1;
`;

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (req.query?.run === RUN_TOKEN) {
      const result = await runSql(readSql());
      res.status(200).json({ ok: true, action: "run", result });
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
      mode: "temporary-get-runner",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Migration failed." });
  }
};
