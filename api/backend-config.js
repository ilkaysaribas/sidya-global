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

  const adminLiveFixLoader = `\n(function(){\n  window.addEventListener("load", function(){\n    if (document.querySelector("script[data-admin-live-fixes]")) return;\n    var script = document.createElement("script");\n    script.src = "/admin-live-fixes.js?v=20260705-1";\n    script.defer = true;\n    script.dataset.adminLiveFixes = "true";\n    document.head.appendChild(script);\n  });\n})();`;

  res.status(200).send(`window.SIDYA_BACKEND = ${JSON.stringify(config)};${adminLiveFixLoader}`);
};
