import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compileProject, type Page, type Site } from "@wgtechlabs/mdd-engine";
import { renderNotFound, renderPage } from "../src/render.js";

const page: Page = {
  source: "mdd/contents/index.md",
  route: "/",
  url: "/docs/",
  title: 'Home <img src=x onerror="bad()">',
  description: '"><script>bad()</script>',
  html: '<h1 id="mdd-home">Home</h1><h2 id="mdd-reading">Reading</h2><p>Article</p>',
  markdown: "# Home",
  headings: [
    { depth: 1, text: "Home", id: "mdd-home" },
    { depth: 2, text: "Reading", id: "mdd-reading" },
  ],
  navigation: { title: "Start" },
};
const site: Site = {
  title: 'Docs "&" <unsafe>',
  basePath: "/docs/",
  pages: [page],
  navigation: [
    { title: "Start <unsafe>", route: "/", url: "/docs/" },
    { title: "Next", route: "/next/", url: "/docs/next/" },
  ],
  assets: [],
  theme: { name: "default" },
};

test("reader escapes metadata and supplies working navigation and outline without browser scripts", () => {
  const html = renderPage(site, page);
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<script>bad()");
  expect(html).toContain("Docs &quot;&amp;&quot; &lt;unsafe&gt;");
  expect(html).toContain('href="/docs/#mdd-reading"');
  expect(html).toContain('href="/docs/markdown/index.md"');
  expect(html).toContain('href="/docs/next/"');
  expect(html).toContain('aria-current="page"');
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  expect(html).toContain('<details class="mdd-mobile-navigation">');
});

test("shell anchors cannot collide with compiled Markdown headings", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "mdd-render-test-"));
  try {
    const contents = path.join(projectDir, "mdd/contents");
    await mkdir(contents, { recursive: true });
    await writeFile(
      path.join(contents, "index.md"),
      "# Welcome\n\nIntro.\n\n## Main\n\nTarget content.\n",
    );
    const result = await compileProject({ projectDir, basePath: "/docs/" });
    expect(result.diagnostics).toEqual([]);
    const compiledPage = result.site?.pages[0];
    if (!result.site || !compiledPage)
      throw new Error("Expected compiled page");

    const html = renderPage(result.site, compiledPage);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('<h2 id="mdd-main">Main</h2>');
    expect(html).toContain('href="/docs/#mdd-main"');
    const mainId = /<main id="([^"]+)"/.exec(html)?.[1];
    expect(mainId).toBeDefined();
    expect(mainId).not.toStartWith("mdd-");
    expect(html).toContain(`href="#${mainId}">Skip to content`);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("heading-free pages get a title and custom theme paths are encoded per segment", () => {
  const html = renderPage(
    {
      ...site,
      theme: {
        name: "custom",
        directory: "mdd/themes/custom",
        css: "mdd/themes/custom/theme.css",
        js: "mdd/themes/custom/reader extra.js",
      },
    },
    { ...page, headings: [], html: "<p>Text</p>" },
  );
  expect(html).toContain("<h1>Home &lt;img");
  expect(html).toContain('href="/docs/_mdd/theme/theme.css"');
  expect(html).toContain('src="/docs/_mdd/theme/reader%20extra.js"');
  expect(html).not.toContain("mdd/themes/custom");
});

test("not-found page links back to the same prefix and does not pretend to be an article", () => {
  const html = renderNotFound(site);
  expect(html).toContain("<h1>Page not found</h1>");
  expect(html).toContain('href="/docs/">Back to the documentation</a>');
  expect(html).not.toContain('aria-current="page"');
});
