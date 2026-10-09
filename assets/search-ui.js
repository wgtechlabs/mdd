import { search, validateSearchIndex } from "./search.js";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Presentation only: preserve original text while marking engine-style terms. */
function highlight(element, text, terms) {
  const groups = [];
  for (const { segment, index } of graphemes.segment(text)) {
    let group = {
      text: segment.normalize("NFKC"),
      start: index,
      end: index + segment.length,
    };
    // Compatibility normalization can join adjacent graphemes (e.g. ㄱㅏ → 가).
    while (groups.length) {
      const previous = groups.at(-1);
      const joined = previous.text + group.text;
      const combined = joined.normalize("NFKC");
      if (combined === joined) break;
      groups.pop();
      group = { text: combined, start: previous.start, end: group.end };
    }
    groups.push(group);
  }
  const offsets = [];
  let normalized = "";
  for (const group of groups) {
    normalized += group.text;
    for (let unit = 0; unit < group.text.toLowerCase().length; unit++)
      offsets.push([group.start, group.end]);
  }
  // Lowercase together so contextual letters, such as final sigma, match the
  // engine. Offsets map compatibility expansions back to intact graphemes.
  normalized = normalized.toLowerCase();
  const ranges = [];
  for (const term of terms) {
    let found = normalized.indexOf(term);
    while (found !== -1) {
      ranges.push([offsets[found][0], offsets[found + term.length - 1][1]]);
      found = normalized.indexOf(term, found + 1);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  let cursor = 0;
  for (const [start, end] of merged) {
    element.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    element.append(mark);
    cursor = end;
  }
  element.append(document.createTextNode(text.slice(cursor)));
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

  const update = () => {
    if (!dialog.open) return;
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
      const hits = search(index, query, { limit: 8 });
      const terms = [
        ...new Set(
          query
            .normalize("NFKC")
            .toLowerCase()
            .match(/[\p{L}\p{N}\p{M}_]+/gu) ?? [],
        ),
      ];
      for (const hit of hits) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "mdd-search-result";
        link.href = destination(hit.url);
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
        const title = document.createElement("strong");
        title.className = "mdd-search-result-title";
        highlight(title, hit.title, terms);
        link.append(title);
        if (hit.section) {
          const section = document.createElement("span");
          section.className = "mdd-search-section";
          highlight(section, hit.section, terms);
          link.append(section);
        }
        const excerpt = document.createElement("p");
        excerpt.className = "mdd-search-result-excerpt";
        highlight(excerpt, hit.excerpt, terms);
        link.append(excerpt);
        item.append(link);
        results.append(item);
      }
      status.textContent = hits.length
        ? `${hits.length} ${hits.length === 1 ? "result" : "results"}.`
        : "No results. Try another search.";
    } catch (error) {
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
    if (dialog.open || !returnFocus) return;
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
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
      return;
    if (event.key === "Escape") {
      // Search inputs otherwise consume Escape to clear their value first.
      event.preventDefault();
      dialog.close();
      return;
    }
    const links = [...results.querySelectorAll("a")];
    const active = document.activeElement;
    if (active === input && event.key === "ArrowDown" && links.length) {
      event.preventDefault();
      links[0].focus();
      return;
    }
    const position = links.indexOf(active);
    if (position < 0) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      (links[position - 1] ?? input).focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      (links[position + 1] ?? links[position]).focus();
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
