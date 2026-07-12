(function () {
  if (window.__sidyaRtlHeroFix) return;
  window.__sidyaRtlHeroFix = true;

  var ensureStyle = function () {
    if (document.getElementById("sidyaRtlHeroFixStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaRtlHeroFixStyle";
    style.textContent = [
      "html,body{width:100%;max-width:100%;overflow-x:hidden;}",
      "body{min-width:0;}",
      ".site-header,.exchange-rate-bar,.hero,.market-intro,.supplier-search,.category-section,.steps,.contact-section,.site-footer{max-width:100%;}",
      ".site-header>*,.nav-links,.header-actions,.exchange-rate-list,.hero-content,.hero-copy,.hero-metrics,.supplier-search-control{min-width:0;}",
      ".hero{isolation:isolate;max-width:100%;}",
      ".hero-image{transform-origin:center center;will-change:transform;}",
      "html[dir='rtl'] .hero,html[lang='ar'] .hero{direction:rtl;}",
      "html[dir='rtl'] .hero-image,html[lang='ar'] .hero-image{transform:scaleX(-1);object-position:left center;}",
      "html[dir='rtl'] .hero-overlay,html[lang='ar'] .hero-overlay{background:linear-gradient(270deg,rgba(248,248,248,.94),rgba(246,246,246,.78) 42%,rgba(246,246,246,.08) 70%),linear-gradient(0deg,rgba(16,16,16,.18),rgba(255,255,255,.04) 52%);}",
      "html[dir='rtl'] .hero-content,html[lang='ar'] .hero-content{width:min(520px,90%);max-width:min(520px,calc(100vw - 28px));margin-inline-start:0!important;margin-inline-end:auto!important;justify-self:start;text-align:right;direction:rtl;}",
      "html[dir='rtl'] .hero h1,html[lang='ar'] .hero h1,html[dir='rtl'] .hero-copy,html[lang='ar'] .hero-copy{text-align:right;max-width:100%;}",
      "html[dir='rtl'] .hero-copy,html[lang='ar'] .hero-copy{margin-inline-start:0;margin-inline-end:0;}",
      "html[dir='rtl'] .hero-actions,html[lang='ar'] .hero-actions{direction:rtl;justify-content:flex-start;}",
      "html[dir='rtl'] .hero-actions .primary-btn,html[lang='ar'] .hero-actions .primary-btn,html[dir='rtl'] .hero-actions .secondary-btn,html[lang='ar'] .hero-actions .secondary-btn{transform:none;}",
      "html[dir='rtl'] .hero-metrics,html[lang='ar'] .hero-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(96px,1fr));direction:rtl;text-align:right;max-width:min(430px,calc(100vw - 28px));margin:0!important;right:clamp(22px,5vw,84px);left:auto;transform:none;}",
      "html[dir='rtl'] .metric,html[lang='ar'] .metric{min-width:0;}",
      "html[dir='rtl'] .site-header,html[lang='ar'] .site-header{direction:ltr;}",
      "html[dir='rtl'] .site-header .brand,html[lang='ar'] .site-header .brand{order:3;direction:rtl;}",
      "html[dir='rtl'] .nav-links,html[lang='ar'] .nav-links{order:2;direction:rtl;justify-content:flex-start;}",
      "html[dir='rtl'] .header-actions,html[lang='ar'] .header-actions{order:1;direction:ltr;justify-content:flex-start;}",
      "html[dir='rtl'] .products-menu,html[lang='ar'] .products-menu{left:auto!important;right:0!important;inset-inline-start:auto!important;inset-inline-end:0!important;text-align:right;}",
      "html[dir='rtl'] .customs-nav-item .customs-menu,html[lang='ar'] .customs-nav-item .customs-menu{left:auto!important;right:0!important;}",
      "html[dir='rtl'] .exchange-rate-bar,html[lang='ar'] .exchange-rate-bar{direction:rtl;}",
      "html[dir='rtl'] .exchange-rate-list,html[lang='ar'] .exchange-rate-list{justify-content:flex-start;}",
      "html[dir='rtl'] .market-intro,html[lang='ar'] .market-intro,html[dir='rtl'] .supplier-search,html[lang='ar'] .supplier-search,html[dir='rtl'] .category-section,html[lang='ar'] .category-section,html[dir='rtl'] .steps,html[lang='ar'] .steps{text-align:right;direction:rtl;}",
      "html[dir='rtl'] .supplier-search-control,html[lang='ar'] .supplier-search-control{grid-template-columns:48px minmax(0,1fr);direction:ltr;max-width:min(900px,calc(100vw - 28px));}",
      "html[dir='rtl'] .supplier-search-control input,html[lang='ar'] .supplier-search-control input{order:2;text-align:right;direction:rtl;}",
      "html[dir='rtl'] .supplier-search-control button,html[lang='ar'] .supplier-search-control button{order:1;}",
      "@media(max-width:1060px){html[dir='rtl'] .site-header .brand,html[lang='ar'] .site-header .brand{order:1;}html[dir='rtl'] .header-actions,html[lang='ar'] .header-actions{order:2;margin-inline-start:auto;}html[dir='rtl'] .nav-links,html[lang='ar'] .nav-links{order:3;width:100%;justify-content:flex-start;overflow-x:auto;}html[dir='rtl'] .products-menu,html[lang='ar'] .products-menu{position:fixed;left:16px!important;right:16px!important;inset-inline:auto!important;max-width:calc(100vw - 32px);}}",
      "@media(max-width:760px){html[dir='rtl'] .hero,html[lang='ar'] .hero{min-height:430px;padding:28px 14px 132px;}html[dir='rtl'] .hero-image,html[lang='ar'] .hero-image{object-position:30% center;}html[dir='rtl'] .hero-overlay,html[lang='ar'] .hero-overlay{background:linear-gradient(0deg,rgba(248,248,248,.92),rgba(248,248,248,.7) 54%,rgba(248,248,248,.16)),linear-gradient(270deg,rgba(248,248,248,.94),rgba(248,248,248,.72) 46%,rgba(248,248,248,.12) 76%);}html[dir='rtl'] .hero-content,html[lang='ar'] .hero-content{width:min(100%,calc(100vw - 28px));max-width:calc(100vw - 28px);margin-inline-start:0!important;margin-inline-end:auto!important;}html[dir='rtl'] .hero-copy,html[lang='ar'] .hero-copy{max-width:min(28ch,100%);}html[dir='rtl'] .hero-metrics,html[lang='ar'] .hero-metrics{left:14px;right:14px;bottom:14px;max-width:none;grid-template-columns:repeat(3,minmax(0,1fr));text-align:center;}html[dir='rtl'] .metric,html[lang='ar'] .metric{text-align:center;}}",
      "@media(max-width:430px){html[dir='rtl'] .hero,html[lang='ar'] .hero{padding-inline:10px;}html[dir='rtl'] .hero-content,html[lang='ar'] .hero-content{max-width:calc(100vw - 20px);}html[dir='rtl'] .hero-metrics,html[lang='ar'] .hero-metrics{left:10px;right:10px;grid-template-columns:repeat(3,minmax(0,1fr));}}"
    ].join("\n");
    document.head.appendChild(style);
  };

  var apply = function () {
    ensureStyle();
    document.documentElement.classList.toggle("sidya-rtl-hero-fixed", document.documentElement.dir === "rtl" || document.documentElement.lang === "ar");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dir", "lang"]
  });
})();
