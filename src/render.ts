import type { NavigationItem, Page, Site } from "@wgtechlabs/mdd-engine";
import { editPageUrl } from "./edit.js";
import type { ThemeIdentity } from "./theme.js";

export interface ReaderIdentity {
  mddVersion: string;
  theme: ThemeIdentity;
  customTheme?: ThemeIdentity;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function themeLabel(theme: ThemeIdentity): string {
  return `${escapeHtml(theme.name)}${theme.release ? ` — ${escapeHtml(theme.release)}` : ""}${theme.version === null ? " (version not declared)" : ` · v${escapeHtml(theme.version)}`}`;
}

function themeFooter(identity: ReaderIdentity): string {
  const label = themeLabel(identity.theme);
  return identity.customTheme
    ? `<details class="mdd-theme-info"><summary>${label}</summary><span>Custom styling: ${themeLabel(identity.customTheme)}</span></details>`
    : `<span>${label}</span>`;
}

function editIcon(url: string): string {
  // GitHub mark: Simple Icons (CC0), https://simpleicons.org/?q=github.
  return new URL(url).hostname === "github.com"
    ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 5 4 4M4 20l1-5L17 3l4 4L9 19Z"/></svg>`;
}

function navigationKey(
  item: NavigationItem,
  basePath: string,
  depth: number,
): string | undefined {
  // Folder routes share the first descendant's encoded path at this depth.
  let page = item;
  while (!page.route) {
    const child = page.children?.[0];
    if (!child) return undefined;
    page = child;
  }
  const folderRoute = `/${page.route
    .split("/")
    .slice(1, depth + 1)
    .join("/")}/`;
  return JSON.stringify([basePath, folderRoute]);
}

function footerSocials(site: Site): string {
  if (!site.footer?.socials.length) return "";
  return `<nav class="mdd-socials" aria-label="Social links">${site.footer.socials
    .map(({ label, url }) => {
      const github = new URL(url).hostname === "github.com";
      return `<a href="${escapeHtml(url)}"${github ? ` aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"` : ""}>${github ? editIcon(url) : escapeHtml(label)}</a>`;
    })
    .join("")}</nav>`;
}

function searchDialog(base: string): string {
  return `<dialog class="mdd-search-dialog" aria-labelledby="_mdd-search-title" data-index-url="${escapeHtml(base)}_mdd/search-index.json">
<h2 class="mdd-search-label" id="_mdd-search-title">Search documentation</h2>
<div class="mdd-search-heading"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input class="mdd-search-input" id="_mdd-search-input" type="search" role="combobox" aria-controls="_mdd-search-results" aria-expanded="false" aria-autocomplete="list" aria-label="Search documentation" aria-describedby="_mdd-search-status" placeholder="Search pages and headings…" maxlength="512" autocomplete="off" spellcheck="false"><button class="mdd-search-close" type="button" aria-label="Close search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
<p class="mdd-search-status" id="_mdd-search-status" role="status"></p><ul class="mdd-search-results" id="_mdd-search-results" role="listbox" aria-label="Search results"></ul><button class="mdd-search-retry" type="button" hidden>Try again</button>
<div class="mdd-search-help" aria-hidden="true"><span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
</dialog>`;
}

function navigation(
  items: NavigationItem[],
  basePath: string,
  route?: string,
  depth = 1,
): string {
  return `<ul>${items
    .map((item) => {
      const label = item.url
        ? `<a href="${escapeHtml(item.url)}"${item.route === route ? ' aria-current="page"' : ""}>${escapeHtml(item.title)}</a>`
        : escapeHtml(item.title);
      if (!item.children?.length) return `<li>${label}</li>`;
      const key = navigationKey(item, basePath, depth);
      return `<li><details class="mdd-nav-section"${key ? ` data-mdd-nav-key="${escapeHtml(key)}"` : ""} open><summary>${label}</summary>${navigation(item.children, basePath, route, depth + 1)}</details></li>`;
    })
    .join("")}</ul>`;
}

function flatten(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => [
    ...(item.url ? [item] : []),
    ...flatten(item.children ?? []),
  ]);
}

function outline(page: Page): string {
  const headings = page.headings.filter(
    (heading) => heading.depth > 1 && heading.depth <= 3,
  );
  if (!headings.length) return "";
  return `<nav aria-label="On this page"><ul>${headings.map((heading) => `<li class="mdd-depth-${heading.depth}"><a href="${escapeHtml(page.url)}#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`).join("")}</ul></nav>`;
}

function pageLinks(site: Site, page: Page): string {
  const pages = flatten(site.navigation);
  const position = pages.findIndex((item) => item.route === page.route);
  if (position < 0) return "";
  const previous = pages[position - 1];
  const next = pages[position + 1];
  if (!previous && !next) return "";
  const link = (item: NavigationItem | undefined, direction: string) =>
    item?.url
      ? `<a class="mdd-${direction}" href="${escapeHtml(item.url)}"><span>${direction === "previous" ? "Previous" : "Next"}</span><strong>${escapeHtml(item.title)}</strong></a>`
      : "";
  return `<nav class="mdd-page-links" aria-label="Page navigation">${link(previous, "previous")}${link(next, "next")}</nav>`;
}

function document(
  site: Site,
  title: string,
  content: string,
  identity: ReaderIdentity,
  page?: Page,
  editUrl?: string,
): string {
  const base = site.basePath;
  const nav = navigation(site.navigation, base, page?.route);
  const toc = page ? outline(page) : "";
  const markdownUrl = page
    ? `${base}markdown/${page.route.slice(1)}index.md`
    : undefined;
  const theme = "directory" in site.theme ? site.theme : undefined;
  const themeUrl = (source: string) =>
    `${base}_mdd/theme/${source
      .slice((theme?.directory.length ?? 0) + 1)
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} · ${escapeHtml(site.title)}</title>
${page?.description ? `<meta name="description" content="${escapeHtml(page.description)}">` : ""}
<link rel="stylesheet" href="${escapeHtml(base)}_mdd/reader.css">
${theme ? `<link rel="stylesheet" href="${escapeHtml(themeUrl(theme.css))}">` : ""}
<script src="${escapeHtml(base)}_mdd/reader.js" defer></script>
<script type="module" src="${escapeHtml(base)}_mdd/search-ui.js"></script>
${theme?.js ? `<script src="${escapeHtml(themeUrl(theme.js))}" defer></script>` : ""}
</head>
<body>
<a class="mdd-skip" href="#_mdd-main">Skip to content</a>
<header class="mdd-header">
<div class="mdd-heading-tools"><button class="mdd-sidebar-toggle" type="button" aria-label="Hide sidebar" aria-controls="_mdd-sidebar" aria-expanded="true" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><path class="mdd-sidebar-icon-open" d="M9 4v16"/><path class="mdd-sidebar-icon-closed" d="M7 8v8"/></svg></button><a class="mdd-brand" href="${escapeHtml(base)}">${escapeHtml(site.title)}</a></div>
<div class="mdd-tools"><button class="mdd-search-toggle" type="button" aria-haspopup="dialog" aria-label="Search documentation" aria-keyshortcuts="Control+k Meta+k" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span class="mdd-search-label">Search</span><kbd class="mdd-search-shortcut" aria-hidden="true">⌘ / Ctrl K</kbd></button><button class="mdd-theme-toggle" type="button" aria-label="Switch theme" hidden>
<svg class="mdd-icon-sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
<svg class="mdd-icon-moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/></svg>
</button></div>
</header>
${searchDialog(base)}
<div class="mdd-layout">
<aside class="mdd-sidebar" id="_mdd-sidebar"><nav aria-label="Documentation">${nav}</nav></aside>
<div class="mdd-reading">
<details class="mdd-mobile-navigation"><summary>Browse documentation</summary><nav aria-label="Documentation">${nav}</nav></details>
${toc ? `<details class="mdd-mobile-outline"><summary>On this page</summary>${toc}</details>` : ""}
<main id="_mdd-main" tabindex="-1"><article class="mdd-article">${content}</article>${page ? pageLinks(site, page) : ""}</main>
<footer class="mdd-footer">
${editUrl ? `<div class="mdd-page-actions"><span>Help improve this page.</span><a class="mdd-edit-page" href="${escapeHtml(editUrl)}">${editIcon(editUrl)}Edit this markdown</a></div>` : ""}
<nav class="mdd-agent-links" aria-label="Agent resources">${markdownUrl ? `<a href="${escapeHtml(markdownUrl)}">View Markdown</a>` : ""}<a href="${escapeHtml(base)}llms.txt">llms.txt for agents</a></nav>
<div class="mdd-footer-bottom">${footerSocials(site)}<a class="mdd-credit" href="https://github.com/wgtechlabs/mdd">Built with <strong>mdd</strong></a></div>
<div class="mdd-build-info"><span>MDD v${escapeHtml(identity.mddVersion)}</span>${themeFooter(identity)}</div>
</footer>
</div>
<aside class="mdd-outline">${toc ? `<h2>On this page</h2>${toc}` : ""}</aside>
</div>
<div class="mdd-status" role="status" aria-live="polite"></div>
</body>
</html>`;
}

/** Article HTML comes exclusively from the engine's sanitized compilation output. */
export function renderPage(
  site: Site,
  page: Page,
  identity: ReaderIdentity,
  editBaseUrl?: string,
): string {
  const title = page.headings.some((heading) => heading.depth === 1)
    ? ""
    : `<h1>${escapeHtml(page.title)}</h1>`;
  return document(
    site,
    page.title,
    title + page.html,
    identity,
    page,
    editBaseUrl === undefined
      ? undefined
      : editPageUrl(editBaseUrl, page.source),
  );
}

export function renderNotFound(site: Site, identity: ReaderIdentity): string {
  return document(
    site,
    "Page not found",
    `<h1>Page not found</h1><p>This page may have moved, or the address may be incorrect.</p><p><a href="${escapeHtml(site.basePath)}">Back to the documentation</a></p>`,
    identity,
  );
}
