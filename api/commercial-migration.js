const fs = require("fs");
const path = require("path");

const PROJECT_REF = "jhjforyykkxklfarjtjl";
const CONFIRM = "RUN_SIDYA_COMMERCIAL_MIGRATION";

const readSql = () => fs.readFileSync(path.join(process.cwd(), "supabase", "commercial-module.sql"), "utf8");

const envStatus = () => ({
  hasSupabaseAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN?.trim()),
  hasMigrationAdminKey: Boolean(process.env.MIGRATION_ADMIN_KEY?.trim()),
});

module.exports = async (req, res) => {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, ...envStatus() });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const adminKey = process.env.MIGRATION_ADMIN_KEY?.trim();
    if (!adminKey || req.headers["x-migration-key"] !== adminKey) {
      res.status(403).json({ error: "Migration admin key missing or invalid." });
      return;
    }

    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    if (body.confirm !== CONFIRM) {
      res.status(403).json({ error: "Migration confirmation missing." });
      return;
    }

    const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      res.status(501).json({
        error: "SUPABASE_ACCESS_TOKEN is not configured in Vercel.",
        required: ["SUPABASE_ACCESS_TOKEN"],
      });
      return;
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: readSql() }),
    });

    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: text || "Supabase SQL API failed." });
      return;
    }

    res.status(200).json({ ok: true, result: text ? JSON.parse(text) : null });
  } catch (error) {
    res.status(500).json({ error: error.message || "Migration failed." });
  }
};
