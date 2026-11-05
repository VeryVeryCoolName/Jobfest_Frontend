(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = tab => {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      item.classList.toggle("active-tab", active);
      document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus();
    });
  });
  if (tabs.length) select(tabs[0]);

  const storageKey = "jobfest-navigation";
  const scrollTo = id => {
    const target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const currentPath = window.location.pathname + window.location.search;
  for (const link of document.querySelectorAll("a[href]")) {
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !url.hash) continue;
    let target;
    try { target = decodeURIComponent(url.hash.slice(1)); } catch { continue; }
    const destination = url.pathname + url.search;
    const original = link.getAttribute("href").split("#")[0];
    link.setAttribute("href", original || window.location.pathname.split("/").pop() || "index.html");
    link.addEventListener("click", event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (destination === currentPath) {
        event.preventDefault();
        scrollTo(target);
      } else {
        try { window.sessionStorage.setItem(storageKey, JSON.stringify({ path: destination, id: target })); } catch {}
      }
    });
  }
  let incoming = window.location.hash.slice(1);
  if (incoming) {
    window.history.replaceState(window.history.state, "", currentPath);
    try { incoming = decodeURIComponent(incoming); } catch { incoming = ""; }
  }
  try {
    const pending = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    window.sessionStorage.removeItem(storageKey);
    if (!incoming && pending?.path === currentPath) incoming = pending.id;
  } catch {}
  if (incoming) scrollTo(incoming);
})();
