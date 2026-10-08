import type { NavigationItem, Page, Site } from "@wgtechlabs/mdd-engine";

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

function navigation(items: NavigationItem[], route?: string): string {
  return `<ul>${items
    .map(
      (item) =>
        `<li>${
          item.url
            ? `<a href="${escapeHtml(item.url)}"${item.route === route ? ' aria-current="page"' : ""}>${escapeHtml(item.title)}</a>`
            : `<span class="mdd-nav-group">${escapeHtml(item.title)}</span>`
        }${item.children?.length ? navigation(item.children, route) : ""}</li>`,
    )
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
  page?: Page,
): string {
  const base = site.basePath;
  const nav = navigation(site.navigation, page?.route);
  const toc = page ? outline(page) : "";
  const markdownUrl = page
    ? `${base}markdown/${page.route.slice(1)}index.md`
    : `${base}llms.txt`;
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
${theme?.js ? `<script src="${escapeHtml(themeUrl(theme.js))}" defer></script>` : ""}
</head>
<body>
<a class="mdd-skip" href="#mdd-main">Skip to content</a>
<header class="mdd-header">
<a class="mdd-brand" href="${escapeHtml(base)}">${escapeHtml(site.title)}</a>
<div class="mdd-tools"><a href="${escapeHtml(markdownUrl)}">${page ? "View Markdown" : "Markdown index"}</a><button class="mdd-theme-toggle" type="button" hidden>Switch theme</button></div>
</header>
<div class="mdd-layout">
<aside class="mdd-sidebar"><nav aria-label="Documentation">${nav}</nav><a class="mdd-credit" href="https://github.com/wgtechlabs/mdd">Built with <strong>mdd</strong></a></aside>
<div class="mdd-reading">
<details class="mdd-mobile-navigation"><summary>Browse documentation</summary><nav aria-label="Documentation">${nav}</nav></details>
${toc ? `<details class="mdd-mobile-outline"><summary>On this page</summary>${toc}</details>` : ""}
<main id="mdd-main" tabindex="-1"><article class="mdd-article">${content}</article>${page ? pageLinks(site, page) : ""}</main>
<footer class="mdd-footer"><a href="${escapeHtml(base)}llms.txt">Documentation index for agents</a><span>Markdown in. Documentation out.</span></footer>
</div>
<aside class="mdd-outline">${toc ? `<h2>On this page</h2>${toc}` : ""}</aside>
</div>
<div class="mdd-status" role="status" aria-live="polite"></div>
</body>
</html>`;
}

/** Article HTML comes exclusively from the engine's sanitized compilation output. */
export function renderPage(site: Site, page: Page): string {
  const title = page.headings.some((heading) => heading.depth === 1)
    ? ""
    : `<h1>${escapeHtml(page.title)}</h1>`;
  return document(site, page.title, title + page.html, page);
}

export function renderNotFound(site: Site): string {
  return document(
    site,
    "Page not found",
    `<h1>Page not found</h1><p>This page may have moved, or the address may be incorrect.</p><p><a href="${escapeHtml(site.basePath)}">Back to the documentation</a></p>`,
  );
}
