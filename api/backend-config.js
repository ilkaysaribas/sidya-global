module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const config = {
    supabaseUrl: process.env.SIDYA_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.SIDYA_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    storageBucket: process.env.SIDYA_SUPABASE_STORAGE_BUCKET || "b2b-documents",
  };

  res.status(200).send(`window.SIDYA_BACKEND = ${JSON.stringify(config)};`);
};
