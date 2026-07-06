(() => {
  if (window.__sidyaMailCrmRouteShim) return;
  window.__sidyaMailCrmRouteShim = true;
  const originalFetch = window.fetch.bind(window);
  const mapPath = (input) => {
    const url = typeof input === "string" ? new URL(input, window.location.origin) : new URL(input.url, window.location.origin);
    const routes = {
      "/api/mail-settings": "mail-settings",
      "/api/send-mail": "send-mail",
      "/api/crm-center": "crm-center",
      "/api/contact-crm": "contact",
      "/api/mail-crm-migration": "migrate",
    };
    const action = routes[url.pathname];
    if (!action) return input;
    const next = new URL("/api/backend-config.js", window.location.origin);
    next.searchParams.set("mailCrm", action);
    url.searchParams.forEach((value, key) => next.searchParams.set(key, value));
    return typeof input === "string" ? next.toString() : new Request(next.toString(), input);
  };
  window.fetch = (input, init) => originalFetch(mapPath(input), init);
})();
