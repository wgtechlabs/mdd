import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compileProject, type Page, type Site } from "@wgtechlabs/mdd-engine";
import {
  type ReaderIdentity,
  renderNotFound,
  renderPage,
} from "../src/render.js";

const identity: ReaderIdentity = {
  mddVersion: "0.1.0-dev.3",
  theme: { name: "D Theme", release: "D26", version: "0.1.0" },
};

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

test("search is progressively enhanced and shared footer labels are escaped", () => {
  const html = renderPage(
    {
      ...site,
      footer: {
        source: "mdd/footer.md",
        socials: [
          {
            label: '<script>bad()</script> & "GitHub"',
            url: "https://github.com/wgtechlabs/mdd",
          },
        ],
      },
    },
    page,
    identity,
  );
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain('aria-keyshortcuts="Control+k Meta+k" hidden');
  expect(html).toContain(
    '<dialog class="mdd-search-dialog" aria-labelledby="_mdd-search-title" data-index-url="/docs/_mdd/search-index.json">',
  );
  expect(html).toContain('type="module" src="/docs/_mdd/search-ui.js"');
  const searchInput = /<input[^>]*class="mdd-search-input"[^>]*>/.exec(
    html,
  )?.[0];
  expect(searchInput).toContain('role="combobox"');
  expect(searchInput).toContain('aria-controls="_mdd-search-results"');
  expect(searchInput).toContain('aria-expanded="false"');
  expect(searchInput).toContain('aria-autocomplete="list"');
  const searchResults = /<ul[^>]*class="mdd-search-results"[^>]*>/.exec(
    html,
  )?.[0];
  expect(searchResults).toContain('id="_mdd-search-results"');
  expect(searchResults).toContain('role="listbox"');
  expect(html).toContain(
    'aria-label="&lt;script&gt;bad()&lt;/script&gt; &amp; &quot;GitHub&quot;"',
  );
  expect(html).not.toContain("<script>bad()");
  expect(html.indexOf('class="mdd-socials"')).toBeGreaterThan(
    html.indexOf('<footer class="mdd-footer">'),
  );
  expect(html.indexOf('class="mdd-socials"')).toBeLessThan(
    html.indexOf('class="mdd-credit"'),
  );
  expect(renderPage(site, page, identity)).not.toContain('class="mdd-socials"');
});

test("reader escapes metadata and supplies working navigation and outline without browser scripts", () => {
  const html = renderPage(site, page, identity);
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<script>bad()");
  expect(html).toContain("Docs &quot;&amp;&quot; &lt;unsafe&gt;");
  expect(html).toContain('href="/docs/#mdd-reading"');
  expect(html).toContain('href="/docs/markdown/index.md"');
  expect(html).toContain('href="/docs/next/"');
  expect(html).toContain('aria-current="page"');
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  expect(html).toContain('<details class="mdd-mobile-navigation">');
  const header = /<header class="mdd-header">([\s\S]*?)<\/header>/.exec(
    html,
  )?.[1];
  expect(header).not.toContain("View Markdown");
  expect(header).toContain('aria-label="Switch theme" hidden');
  expect(header).toContain('class="mdd-icon-sun"');
  expect(header).toContain('class="mdd-icon-moon"');
  expect(html).not.toContain('class="mdd-sidebar-footer"');
  expect(html).toContain(
    'aria-controls="_mdd-sidebar" aria-expanded="true" hidden',
  );
  expect(html).toContain(
    'aria-label="Agent resources"><a href="/docs/markdown/index.md">View Markdown</a><a href="/docs/llms.txt">llms.txt for agents</a>',
  );
  expect(html.indexOf("View Markdown</a>")).toBeGreaterThan(
    html.indexOf('<footer class="mdd-footer">'),
  );
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

    const html = renderPage(result.site, compiledPage, identity);
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
    { ...identity, customTheme: { name: "custom", version: "2.0.0" } },
  );
  expect(html).toContain("<h1>Home &lt;img");
  expect(html).toContain('href="/docs/_mdd/theme/theme.css"');
  expect(html).toContain('src="/docs/_mdd/theme/reader%20extra.js"');
  expect(html).not.toContain("mdd/themes/custom");
});

test("not-found page links back to the same prefix and does not pretend to be an article", () => {
  const html = renderNotFound(site, identity);
  expect(html).toContain("<h1>Page not found</h1>");
  expect(html).toContain('href="/docs/">Back to the documentation</a>');
  expect(html).not.toContain('aria-current="page"');
  expect(html).not.toContain('class="mdd-page-actions"');
  expect(html).not.toContain('class="mdd-page-links"');
  expect(html).not.toContain("View Markdown");
  expect(html).toContain('href="/docs/llms.txt"');
});

test("folder groups use native disclosures and preserve landing pages and emoji labels", () => {
  const html = renderPage(
    {
      ...site,
      navigation: [
        {
          title: "🚀 Get started",
          url: "/docs/get-started/",
          route: "/get-started/",
          children: [{ title: "Install", route: "/", url: "/docs/" }],
        },
      ],
    },
    page,
    identity,
  );
  expect(html).toContain(
    '<details class="mdd-nav-section" data-mdd-nav-key="[&quot;/docs/&quot;,&quot;/get-started/&quot;]" open><summary><a href="/docs/get-started/">🚀 Get started</a></summary>',
  );
  expect(html).toContain('href="/docs/" aria-current="page">Install</a>');
  expect(html).toContain('id="_mdd-sidebar"');
});

test("folder keys follow paths despite duplicate labels, reordering, and nested groups", () => {
  const groups = [
    {
      title: "Same label",
      children: [
        {
          title: "Nested",
          children: [
            {
              title: "Page",
              route: "/a-one/caf%C3%A9/start/",
              url: "/docs/a-one/caf%C3%A9/start/",
            },
          ],
        },
      ],
    },
    {
      title: "Same label",
      children: [
        { title: "Page", route: "/a_one/start/", url: "/docs/a_one/start/" },
      ],
    },
  ];
  const keys = (navigation: Site["navigation"], basePath = "/docs/") =>
    [
      ...renderPage({ ...site, navigation, basePath }, page, identity).matchAll(
        /data-mdd-nav-key="([^"]+)"/g,
      ),
    ]
      .map((match) => JSON.parse((match[1] ?? "").replaceAll("&quot;", '"')))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  expect(keys(groups)).toEqual(
    [
      ["/docs/", "/a-one/"],
      ["/docs/", "/a-one/"],
      ["/docs/", "/a-one/caf%C3%A9/"],
      ["/docs/", "/a-one/caf%C3%A9/"],
      ["/docs/", "/a_one/"],
      ["/docs/", "/a_one/"],
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
  expect(keys([...groups].reverse())).toEqual(keys(groups));
  expect(
    keys(groups, "/repository/docs/").every(
      (key) => key[0] === "/repository/docs/",
    ),
  ).toBe(true);
  expect(
    keys([{ title: "No route evidence", children: [{ title: "Label" }] }]),
  ).toEqual([]);
  const nested = keys(groups).filter((key) => key[1] === "/a-one/caf%C3%A9/");
  const overlappingSite = keys(
    [
      {
        title: "Nested",
        children: [{ title: "Page", route: "/caf%C3%A9/start/" }],
      },
    ],
    "/docs/a-one/",
  );
  expect(nested).toHaveLength(2);
  expect(overlappingSite).toEqual([
    ["/docs/a-one/", "/caf%C3%A9/"],
    ["/docs/a-one/", "/caf%C3%A9/"],
  ]);
  expect(overlappingSite).not.toEqual(nested);
});

test("Edit this markdown links the source in the contribution footer after page navigation", () => {
  const html = renderPage(
    site,
    { ...page, source: "guide/01-café & 'notes'.md" },
    identity,
    "https://github.com/example/docs/edit/main/",
  );
  expect(html).toContain(
    'href="https://github.com/example/docs/edit/main/guide/01-caf%C3%A9%20%26%20&#39;notes&#39;.md"',
  );
  expect(html).toContain("Edit this markdown</a>");
  expect(html).toContain("Help improve this page.</span>");
  expect(html).not.toContain("Edit this page");
  const editPosition = html.indexOf('class="mdd-edit-page"');
  expect(editPosition).toBeGreaterThan(html.indexOf("</article>"));
  expect(editPosition).toBeGreaterThan(html.indexOf('class="mdd-page-links"'));
  expect(editPosition).toBeGreaterThan(
    html.indexOf('<footer class="mdd-footer">'),
  );
  expect(editPosition).toBeGreaterThan(
    html.indexOf('class="mdd-page-actions"'),
  );
  expect(editPosition).toBeLessThan(html.indexOf("View Markdown</a>"));
  expect(html.indexOf('class="mdd-page-links"')).toBeLessThan(
    html.indexOf('<footer class="mdd-footer">'),
  );
  expect(html).not.toContain("/docs/guide/01-caf");
  for (const unconfigured of [
    renderPage(site, page, identity),
    renderNotFound(site, identity),
  ]) {
    expect(unconfigured).not.toContain("Edit this markdown");
    expect(unconfigured).not.toContain('class="mdd-edit-page"');
    expect(unconfigured).not.toContain("Help improve this page.");
    expect(unconfigured).not.toContain('class="mdd-page-actions"');
  }
});

test("every reader footer shows the supplied MDD and theme versions without browser scripts", () => {
  for (const html of [
    renderPage(site, page, identity),
    renderNotFound(site, identity),
  ]) {
    const footer = /<footer class="mdd-footer">([\s\S]*?)<\/footer>/.exec(
      html,
    )?.[1];
    expect(footer).toBeDefined();
    expect(footer).toContain("MDD v0.1.0-dev.3");
    expect(footer).toContain("D Theme — D26 · v0.1.0");
    expect(footer).not.toContain("Custom styling:");
    expect(footer).not.toContain("mdd-theme-info");
    expect(footer).toContain('href="/docs/llms.txt"');
    expect(footer).toContain(
      'class="mdd-credit" href="https://github.com/wgtechlabs/mdd">Built with <strong>mdd</strong>',
    );
  }
});

test("reader footer escapes every identity value", () => {
  const untrusted: ReaderIdentity = {
    mddVersion: '<script>mdd()</script> & "version"',
    theme: {
      name: "<img src=x onerror=\"theme()\"> & 'name'",
      version: '<script>version()</script> & "theme"',
      release: '<script>release()</script> & "release"',
    },
    customTheme: {
      name: '<script>custom()</script> & "custom"',
      version: "<script>customVersion()</script>",
      release: "<script>customRelease()</script>",
    },
  };
  for (const html of [
    renderPage(site, page, untrusted),
    renderNotFound(site, untrusted),
  ]) {
    expect(html).toContain(
      "MDD v&lt;script&gt;mdd()&lt;/script&gt; &amp; &quot;version&quot;",
    );
    expect(html).toContain(
      "&lt;img src=x onerror=&quot;theme()&quot;&gt; &amp; &#39;name&#39;",
    );
    expect(html).toContain(
      "&lt;script&gt;version()&lt;/script&gt; &amp; &quot;theme&quot;",
    );
    expect(html).toContain(
      "&lt;script&gt;release()&lt;/script&gt; &amp; &quot;release&quot;",
    );
    expect(html).toContain(
      "Custom styling: &lt;script&gt;custom()&lt;/script&gt; &amp; &quot;custom&quot;",
    );
    expect(html).toContain("&lt;script&gt;customVersion()&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;customRelease()&lt;/script&gt;");
    expect(html).not.toContain("<script>mdd()");
    expect(html).not.toContain("<script>version()");
    expect(html).not.toContain("<script>release()");
    expect(html).not.toContain("<script>custom");
    expect(html).not.toContain("<img src=x");
  }
});

test("custom styling details are collapsed and preserve unknown versions on articles and 404 pages", () => {
  const legacy: ReaderIdentity = {
    ...identity,
    customTheme: { name: "Existing theme", version: null },
  };
  for (const html of [
    renderPage(site, page, legacy),
    renderNotFound(site, legacy),
  ]) {
    expect(html).toContain("MDD v0.1.0-dev.3");
    expect(html).toContain(
      '<details class="mdd-theme-info"><summary>D Theme — D26 · v0.1.0</summary><span>Custom styling: Existing theme (version not declared)</span></details>',
    );
    expect(html).not.toContain('<details class="mdd-theme-info" open');
    expect(html).not.toContain("Existing theme · v0.1.0-dev.3");
  }
});
