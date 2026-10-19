(() => {
  const highlightCode = (code) => {
    const language = [...code.classList]
      .find((name) => name.startsWith("language-"))
      ?.slice(9)
      .toLowerCase();
    const aliases = {
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      ts: "typescript",
      mts: "typescript",
      cts: "typescript",
      yml: "yaml",
      xml: "html",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
    };
    const lang = aliases[language] ?? language;
    const languageNames = {
      javascript: "JavaScript",
      typescript: "TypeScript",
      json: "JSON",
      css: "CSS",
      html: "HTML",
      yaml: "YAML",
      shell: "Shell",
      markdown: "Markdown",
    };
    const grammar = {
      javascript:
        /\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield|console|document|globalThis|Math|JSON|Array|Object|Promise|Map|Set|String|Number|Boolean)\b|\b\d+(?:\.\d+)?\b/g,
      typescript:
        /\b(?:abstract|any|as|async|await|boolean|break|case|catch|class|const|constructor|continue|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|infer|instanceof|interface|keyof|let|namespace|never|new|null|number|of|private|protected|public|readonly|return|static|string|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield|Array|Error|Map|Object|Promise|Record|Set|String|console|document|globalThis)\b|\b\d+(?:\.\d+)?\b/g,
      json: /\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      css: /#[\da-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?\b|--[\w-]+|\b(?:color|background|display|grid|flex|padding|margin|border|font|width|height|gap|align-items|justify-content)\b/g,
      html: /&lt;\/?[\w-]+|&gt;|\b[\w-]+(?==)/g,
      yaml: /\b(?:true|false|null|yes|no)\b|\b\d+(?:\.\d+)?\b|^[\w.-]+(?=\s*:)/gm,
      shell:
        /\b(?:sudo|npm|npx|bun|node|git|cd|mkdir|export|echo|curl|pip|python3?)\b|--?[\w-]+/g,
      markdown:
        /^#{1,6}\s.*$|^\s*>.*$|^\s*[-*+]\s|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\)/gm,
    }[lang];
    if (!grammar || code.dataset.highlighted)
      return language ? (languageNames[lang] ?? language) : null;
    const comments = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
    const strings = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
    code.dataset.highlighted = "true";
    const text = code.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let offset = 0;
    const matches = [
      ...text.matchAll(comments),
      ...text.matchAll(strings),
      ...text.matchAll(grammar),
    ]
      .filter((match) => match.index !== undefined)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const match of matches) {
      const token = match[0];
      const index = match.index;
      if (index === undefined || index < offset) continue;
      fragment.append(document.createTextNode(text.slice(offset, index)));
      const span = document.createElement("span");
      span.className = `mdd-token-${/^(?:\/\/|\/\*|#)/.test(token) ? "comment" : /^(?:"|'|`)/.test(token) ? "string" : /^(?:\d|true\b|false\b|null\b)/.test(token) ? "literal" : "keyword"}`;
      span.textContent = token;
      fragment.append(span);
      offset = index + token.length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    code.replaceChildren(fragment);
    return language ? (languageNames[lang] ?? language) : null;
  };
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
  const sidebarNavigation = sidebar?.querySelector(".mdd-sidebar-nav");
  if (sidebarToggle && sidebar && sidebarNavigation) {
    const setSidebar = (collapsed) => {
      if (collapsed && sidebar.contains(document.activeElement))
        sidebarToggle.focus();
      sidebarNavigation.inert = collapsed;
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
    const language = highlightCode(code);
    pre.tabIndex = 0;
    pre.setAttribute("aria-label", "Code example");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mdd-copy";
    button.textContent = "Copy code";
    if (language) {
      const label = document.createElement("span");
      label.className = "mdd-code-language";
      label.textContent = language;
      pre.prepend(label);
    }
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
  const outlineGroups = [
    ...document.querySelectorAll(".mdd-outline nav, .mdd-mobile-outline nav"),
  ].map((nav) => ({ nav, links: [...nav.querySelectorAll("a")] }));
  const links = outlineGroups[0]?.links ?? [];
  const mobileTools = document.querySelector(".mdd-mobile-tools");
  const headings = links.map((link) =>
    document.getElementById(
      decodeURIComponent(new URL(link.href).hash.slice(1)),
    ),
  );
  let scheduled = false;
  const updateOutline = () => {
    const activationTop = Math.max(
      130,
      (mobileTools?.getBoundingClientRect().bottom ?? 0) + 16,
    );
    let active = links.length ? 0 : -1;
    for (let index = 0; index < headings.length; index++) {
      if (
        headings[index] &&
        headings[index].getBoundingClientRect().top <= activationTop
      )
        active = index;
    }
    const maxScroll = root.scrollHeight - window.innerHeight;
    if (maxScroll > 0 && window.scrollY >= maxScroll - 2) {
      // Trailing headings cannot always reach the activation line. At the
      // bottom, honor a visible anchor target or select the final section.
      const target = links.findIndex(
        (link) => new URL(link.href).hash === window.location.hash,
      );
      const targetTop = headings[target]?.getBoundingClientRect().top;
      active =
        targetTop > activationTop && targetTop < window.innerHeight
          ? target
          : links.length - 1;
    }
    for (const group of outlineGroups) {
      group.links.forEach((link, index) => {
        if (index === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      if (group.links[active]) {
        const linkRect = group.links[active].getBoundingClientRect();
        const outlineTop = group.nav.getBoundingClientRect().top;
        group.nav.style.setProperty(
          "--mdd-outline-marker-y",
          `${linkRect.top - outlineTop + group.nav.scrollTop}px`,
        );
        group.nav.style.setProperty(
          "--mdd-outline-marker-height",
          `${linkRect.height}px`,
        );
      }
    }
    scheduled = false;
  };
  if (links.length) {
    const scheduleOutline = () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(updateOutline);
      }
    };
    window.addEventListener("scroll", scheduleOutline, { passive: true });
    window.addEventListener("hashchange", scheduleOutline);
    window.addEventListener("resize", scheduleOutline);
    document
      .querySelector(".mdd-mobile-outline")
      ?.addEventListener("toggle", scheduleOutline);
    updateOutline();
  }
  if (mobileTools) {
    const closeMenus = () => {
      for (const menu of mobileTools.querySelectorAll(":scope > details[open]"))
        menu.open = false;
    };
    document.addEventListener("click", (event) => {
      if (!mobileTools.contains(event.target)) closeMenus();
      else if (
        event.target.closest("a") &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      )
        closeMenus();
    });
    mobileTools.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const summary = mobileTools.querySelector(
        ":scope > details[open] > summary",
      );
      if (summary) {
        closeMenus();
        summary.focus();
        event.preventDefault();
      }
    });
  }
})();
