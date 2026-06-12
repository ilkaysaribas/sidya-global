module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const defaultSupabaseUrl = "https://jhjforyykkxklfarjtjl.supabase.co";
  const defaultSupabasePublishableKey = "sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    defaultSupabasePublishableKey;
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "b2b-documents";

  const config = {
    supabaseUrl,
    supabasePublishableKey,
    supabaseAnonKey: supabasePublishableKey,
    storageBucket,
    configured: Boolean(supabaseUrl && supabasePublishableKey),
  };

  res.status(200).send(`window.SIDYA_BACKEND = ${JSON.stringify(config)};`);
};
