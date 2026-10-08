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
    toggle.textContent = isDark() ? "Light theme" : "Dark theme";
    toggle.setAttribute(
      "aria-label",
      `Switch to ${isDark() ? "light" : "dark"} theme`,
    );
  };
  if (toggle) {
    toggle.hidden = false;
    labelTheme();
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
