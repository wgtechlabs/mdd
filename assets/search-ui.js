import { search, validateSearchIndex } from "./search.js";

/** Render only engine-provided original-text ranges; never interpret HTML. */
function highlight(element, text, ranges) {
  let cursor = 0;
  for (const [start, end] of ranges) {
    element.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    element.append(mark);
    cursor = end;
  }
  element.append(document.createTextNode(text.slice(cursor)));
}

function resultIcon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
    class: "mdd-search-result-icon",
  }))
    svg.setAttribute(name, value);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    kind === "section"
      ? "M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"
      : "M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h8",
  );
  svg.append(path);
  return svg;
}

(() => {
  const toggle = document.querySelector(".mdd-search-toggle");
  const dialog = document.querySelector(".mdd-search-dialog");
  const input = dialog?.querySelector(".mdd-search-input");
  const close = dialog?.querySelector(".mdd-search-close");
  const status = dialog?.querySelector(".mdd-search-status");
  const results = dialog?.querySelector(".mdd-search-results");
  const retry = dialog?.querySelector(".mdd-search-retry");
  if (
    !toggle ||
    !dialog ||
    typeof dialog.showModal !== "function" ||
    !input ||
    !close ||
    !status ||
    !results ||
    !retry
  )
    return;

  const indexUrl = new URL(dialog.dataset.indexUrl, window.location.href);
  const indexPath = "_mdd/search-index.json";
  if (
    indexUrl.origin !== window.location.origin ||
    !indexUrl.pathname.endsWith(indexPath)
  )
    return;
  const basePath = indexUrl.pathname.slice(0, -indexPath.length);
  const destination = (value) => {
    const url = new URL(value, indexUrl);
    if (url.origin !== indexUrl.origin || !url.pathname.startsWith(basePath))
      throw new TypeError("Search destination is outside this documentation.");
    return url.href;
  };

  let index;
  let loading = false;
  let loadFailed = false;
  let returnFocus;
  let selected = -1;
  let links = [];

  const select = (position, scroll = false) => {
    selected = position;
    links.forEach((link, n) => {
      link.setAttribute("aria-selected", String(n === position));
    });
    if (position < 0) input.removeAttribute("aria-activedescendant");
    else {
      input.setAttribute("aria-activedescendant", links[position].id);
      if (scroll) links[position].scrollIntoView({ block: "nearest" });
    }
  };

  const update = () => {
    if (!dialog.open) return;
    select(-1);
    links = [];
    results.replaceChildren();
    results.setAttribute("aria-busy", String(loading));
    retry.hidden = true;
    if (loading) {
      status.textContent = "Loading search…";
      return;
    }
    if (loadFailed) {
      status.textContent = "Search could not load. Please try again.";
      retry.hidden = false;
      return;
    }
    const query = input.value.trim();
    if (!index || !query) {
      status.textContent = "Search the documentation.";
      return;
    }
    try {
      const hits = search(index, query, {
        limit: 8,
        mode: "sections",
        fuzzy: true,
      });
      for (const hit of hits) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "mdd-search-result";
        link.href = destination(hit.url);
        item.setAttribute("role", "presentation");
        link.setAttribute("role", "option");
        link.setAttribute("tabindex", "-1");
        link.id = `_mdd-search-result-${links.length}`;
        const position = links.length;
        links.push(link);
        link.addEventListener("pointermove", () => select(position));
        link.addEventListener("click", (event) => {
          // Same-page heading links do not reload the document. Dismiss the
          // modal before native navigation so the destination is visible.
          if (
            !event.defaultPrevented &&
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            // Let anchor navigation own focus after the native close, rather
            // than returning to the opener in the queued close event.
            returnFocus = undefined;
            dialog.close();
          }
        });
        link.append(resultIcon(hit.kind));
        const content = document.createElement("span");
        content.className = "mdd-search-result-content";
        const title = document.createElement("strong");
        title.className = "mdd-search-result-title";
        const hasHeading = hit.kind === "section" && hit.section;
        const primary = hasHeading ? hit.section : hit.title;
        const matches = hasHeading ? hit.matches.section : hit.matches.title;
        highlight(title, primary, matches);
        content.append(title);
        if (hit.breadcrumbs.length) {
          const breadcrumbs = document.createElement("span");
          breadcrumbs.className = "mdd-search-breadcrumbs";
          hit.breadcrumbs.forEach((label, n) => {
            if (n) {
              const separator = document.createElement("span");
              separator.textContent = " / ";
              breadcrumbs.append(separator);
            }
            const ancestor = document.createElement("span");
            highlight(ancestor, label, hit.matches.breadcrumbs[n]);
            breadcrumbs.append(ancestor);
          });
          content.append(document.createTextNode(" "), breadcrumbs);
        }
        // Body-only matches need an excerpt to explain why the row appeared.
        if (!matches.length && hit.excerpt) {
          const excerpt = document.createElement("p");
          excerpt.className = "mdd-search-result-excerpt";
          highlight(excerpt, hit.excerpt, hit.matches.excerpt);
          content.append(document.createTextNode(" "), excerpt);
        }
        link.append(content);
        item.append(link);
        results.append(item);
      }
      if (links.length) select(0);
      status.textContent = hits.length
        ? `${hits.length} ${hits.length === 1 ? "result" : "results"}.`
        : "No results. Try another search.";
    } catch (error) {
      select(-1);
      links = [];
      results.replaceChildren();
      status.textContent =
        error instanceof RangeError
          ? "This search is too long. Use fewer words."
          : "Search could not run. Please try again.";
      retry.hidden = false;
    }
  };

  const load = async () => {
    if (index || loading) return;
    loading = true;
    loadFailed = false;
    update();
    try {
      const response = await fetch(indexUrl, {
        mode: "same-origin",
        credentials: "same-origin",
        redirect: "error",
      });
      if (!response.ok) throw new Error("Search index request failed.");
      const data = await response.json();
      validateSearchIndex(data);
      for (const page of data.pages) {
        destination(page.url);
        for (const section of page.sections) destination(section.url);
      }
      index = data;
    } catch {
      loadFailed = true;
    } finally {
      loading = false;
      update();
    }
  };

  const open = () => {
    if (!dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
      input.setAttribute("aria-expanded", "true");
    }
    input.focus();
    input.select();
    if (!index && !loading && !loadFailed) void load();
    else update();
  };
  toggle.addEventListener("click", open);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    // A queued close event must not steal focus from a reopened dialog.
    if (dialog.open) return;
    input.setAttribute("aria-expanded", "false");
    select(-1);
    if (!returnFocus) return;
    if (returnFocus?.isConnected && typeof returnFocus.focus === "function")
      returnFocus.focus();
    else toggle.focus();
  });
  retry.addEventListener("click", () => {
    input.focus();
    if (index) update();
    else void load();
  });
  input.addEventListener("input", update);
  dialog.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing
    )
      return;
    if (event.key === "Escape") {
      // Search inputs otherwise consume Escape to clear their value first.
      event.preventDefault();
      dialog.close();
      return;
    }
    if (document.activeElement !== input || !links.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      select((selected + step + links.length) % links.length, true);
    } else if (event.key === "Enter" && selected >= 0) {
      event.preventDefault();
      links[selected].click();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.isComposing &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      open();
    }
  });
  toggle.hidden = false;
})();
