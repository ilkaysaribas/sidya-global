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

  res.status(200).send(`
    window.SIDYA_BACKEND = ${JSON.stringify(config)};
    (function(){
      if (window.__sidyaAdminFixLoader) return;
      window.__sidyaAdminFixLoader = true;
      function appReady(){
        var shell = document.getElementById("appShell");
        return !!(shell && !shell.hidden);
      }
      function appendScript(id, src){
        if (document.getElementById(id)) return;
        var script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.defer = true;
        document.head.appendChild(script);
      }
      function loadSiteEnhancements(){
        if (document.getElementById("quoteForm")) {
          appendScript("sidyaSiteMailCrmScript", "/site-mail-crm.js?v=20260706-1");
        }
      }
      function loadFixes(){
        loadSiteEnhancements();
        if (!appReady()) return;
        appendScript("sidyaAdminPanelFixesScript", "/admin-panel-fixes.js?v=20260705-2");
        appendScript("sidyaAdminRateFixScript", "/admin-rate-fix.js?v=20260706-2");
        appendScript("sidyaAdminProfitFixScript", "/admin-profit-fix.js?v=20260705-1");
        appendScript("sidyaAdminProfitTableV4Script", "/admin-profit-table-v4.js?v=20260706-1");
        appendScript("sidyaInfoActionsScript", "/admin-info-actions.js?v=20260706-1");
        appendScript("sidyaMailCrmAdminScript", "/admin-mail-crm.js?v=20260706-1");
      }
      var timer = setInterval(function(){
        loadFixes();
        if (appReady() && document.getElementById("sidyaAdminProfitTableV4Script") && document.getElementById("sidyaInfoActionsScript") && document.getElementById("sidyaMailCrmAdminScript")) clearInterval(timer);
      }, 500);
      document.addEventListener("DOMContentLoaded", loadFixes);
      window.addEventListener("load", loadFixes);
    })();
  `);
};
