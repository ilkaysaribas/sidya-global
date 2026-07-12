(function () {
  var path = String(location.pathname || "").replace(/\/+$/, "");
  if (path !== "/admin" && path !== "/admin.html") return;
  if (window.__sidyaAdminLtrGuard) return;
  window.__sidyaAdminLtrGuard = true;

  function ensureStyle() {
    if (document.getElementById("sidyaAdminLtrGuardStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaAdminLtrGuardStyle";
    style.textContent = [
      "html.admin-ltr-root,html.admin-ltr-root body{direction:ltr!important;}",
      "html.admin-ltr-root body{text-align:left!important;}",
      "html.admin-ltr-root #appShell,html.admin-ltr-root .app-shell{direction:ltr!important;display:grid!important;grid-template-columns:230px minmax(0,1fr)!important;}",
      "html.admin-ltr-root .sidebar{direction:ltr!important;grid-column:1!important;left:0!important;right:auto!important;}",
      "html.admin-ltr-root .main{direction:ltr!important;grid-column:2!important;min-width:0!important;width:100%!important;}",
      "html.admin-ltr-root .topbar,html.admin-ltr-root .panel-heading,html.admin-ltr-root .button-row,html.admin-ltr-root .topbar-user,html.admin-ltr-root .sidebar-brand{direction:ltr!important;flex-direction:row!important;}",
      "html.admin-ltr-root .sidebar nav button,html.admin-ltr-root .signout,html.admin-ltr-root label,html.admin-ltr-root input,html.admin-ltr-root select,html.admin-ltr-root textarea{text-align:left!important;direction:ltr!important;}",
      "html.admin-ltr-root table,html.admin-ltr-root th,html.admin-ltr-root td{direction:ltr!important;}",
      "html.admin-ltr-root th,html.admin-ltr-root td{text-align:left;}",
      "html.admin-ltr-root .row-actions,html.admin-ltr-root .dialog-actions{direction:ltr!important;}",
      "html.admin-ltr-root .nav-count{float:right!important;}",
      "@media (max-width:720px){html.admin-ltr-root #appShell,html.admin-ltr-root .app-shell{grid-template-columns:1fr!important;}html.admin-ltr-root .sidebar,html.admin-ltr-root .main{grid-column:1!important;}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function enforce() {
    document.documentElement.setAttribute("lang", "tr");
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.classList.add("admin-ltr-root");
    document.documentElement.classList.remove("is-rtl", "rtl");

    if (document.body) {
      document.body.setAttribute("dir", "ltr");
      document.body.classList.add("admin-ltr-body");
      document.body.classList.remove("is-rtl", "rtl");
    }

    var shell = document.getElementById("appShell");
    if (shell) shell.setAttribute("dir", "ltr");
    ensureStyle();
  }

  enforce();
  document.addEventListener("DOMContentLoaded", enforce);
  window.addEventListener("load", enforce);
  window.addEventListener("sidya:locale-applied", enforce, true);

  var observer = new MutationObserver(enforce);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang", "class"] });

  var observeBody = function () {
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["dir", "class"] });
  };
  observeBody();
  document.addEventListener("DOMContentLoaded", observeBody);

  var attempts = 0;
  var timer = setInterval(function () {
    enforce();
    attempts += 1;
    if (attempts >= 20) clearInterval(timer);
  }, 500);
})();
