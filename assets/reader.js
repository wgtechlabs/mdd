(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".mdd-theme-toggle");
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  try {
    const stored = localStorage.getItem("mdd-theme");
    if (stored === "dark" || stored === "light") root.dataset.theme = stored;
  } catch {
    /* Reading and theme switching still work when storage is unavailable. */
  }
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === "dark" : system.matches;
  const labelTheme = () => {
    if (!toggle) return;
    const target = isDark() ? "light" : "dark";
    const label = `Switch to ${target} theme`;
    toggle.dataset.target = target;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
  };
  if (toggle) {
    labelTheme();
    toggle.hidden = false;
    system.addEventListener("change", labelTheme);
    toggle.addEventListener("click", () => {
      root.dataset.theme = isDark() ? "light" : "dark";
      try {
        localStorage.setItem("mdd-theme", root.dataset.theme);
      } catch {
        /* Storage is optional. */
      }
      labelTheme();
    });
  }
  const sidebarToggle = document.querySelector(".mdd-sidebar-toggle");
  const sidebar = document.querySelector(".mdd-sidebar");
  if (sidebarToggle && sidebar) {
    const setSidebar = (collapsed) => {
      if (collapsed && sidebar.contains(document.activeElement))
        sidebarToggle.focus();
      sidebar.inert = collapsed;
      root.dataset.sidebar = collapsed ? "collapsed" : "expanded";
      const label = collapsed ? "Show sidebar" : "Hide sidebar";
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
      sidebarToggle.setAttribute("aria-label", label);
      sidebarToggle.setAttribute("title", label);
    };
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("mdd-sidebar") === "collapsed";
    } catch {
      /* Navigation stays expanded when storage is unavailable. */
    }
    setSidebar(collapsed);
    sidebarToggle.hidden = false;
    sidebarToggle.addEventListener("click", () => {
      // Animate reader actions, never the restoration of a saved preference.
      root.dataset.sidebarMotion = "ready";
      setSidebar(root.dataset.sidebar !== "collapsed");
      try {
        localStorage.setItem("mdd-sidebar", root.dataset.sidebar);
      } catch {
        /* Sidebar controls do not require persistent storage. */
      }
    });
  }
  const sections = new Map();
  for (const section of document.querySelectorAll(
    ".mdd-nav-section[data-mdd-nav-key]",
  )) {
    const key = `mdd-nav:v1:${section.dataset.mddNavKey}`;
    let group = sections.get(key);
    if (!group) {
      let open = true;
      try {
        open = localStorage.getItem(key) !== "closed";
      } catch {
        /* Native disclosures still work without storage. */
      }
      group = { open, elements: [] };
      sections.set(key, group);
    }
    group.elements.push(section);
    section.open = group.open;
    section.addEventListener("toggle", () => {
      // Restore/sync also queues toggle events; only reader changes update state.
      if (section.open === group.open) return;
      group.open = section.open;
      for (const peer of group.elements) peer.open = group.open;
      try {
        localStorage.setItem(key, group.open ? "open" : "closed");
      } catch {
        /* The two menus stay in sync even when persistence is unavailable. */
      }
    });
  }
  const status = document.querySelector(".mdd-status");
  for (const pre of document.querySelectorAll(".mdd-article pre")) {
    const code = pre.querySelector("code");
    if (!code) continue;
    pre.tabIndex = 0;
    pre.setAttribute("aria-label", "Code example");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mdd-copy";
    button.textContent = "Copy code";
    pre.prepend(button);
    let reset;
    button.addEventListener("click", async () => {
      clearTimeout(reset);
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        button.textContent = "Copied";
        if (status) status.textContent = "Code copied to clipboard.";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        button.textContent = "Code selected";
        if (status)
          status.textContent =
            "Copy unavailable. Code selected; use your browser's copy command.";
      } finally {
        button.disabled = false;
        reset = setTimeout(() => {
          button.textContent = "Copy code";
        }, 2000);
      }
    });
  }
  const links = [...document.querySelectorAll(".mdd-outline a")];
  const headings = links.map((link) =>
    document.getElementById(
      decodeURIComponent(new URL(link.href).hash.slice(1)),
    ),
  );
  let scheduled = false;
  const updateOutline = () => {
    let active = -1;
    for (let index = 0; index < headings.length; index++) {
      if (headings[index] && headings[index].getBoundingClientRect().top <= 130)
        active = index;
    }
    links.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scheduled = false;
  };
  if (links.length) {
    window.addEventListener(
      "scroll",
      () => {
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(updateOutline);
        }
      },
      { passive: true },
    );
    updateOutline();
  }
})();
