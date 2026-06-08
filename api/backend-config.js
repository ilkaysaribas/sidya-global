module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jhjforyykkxklfarjtjl.supabase.co",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "b2b-documents",
  };

  res.status(200).send(`window.SIDYA_BACKEND = ${JSON.stringify(config)};`);
};
