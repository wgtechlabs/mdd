# MDD

![MDD banner — Free, open-source documentation](<https://ghrb.waren.build/render/banner?header=MDD&subheader=Free,+open-source+documentation&bg=5865F2-1B1C25&color=FFFFFF&stats=false>)

MDD is free, open-source software for turning Markdown into clear documentation websites. Give your project docs people can navigate and agents can read as Markdown. Everything is configured through files.

This repository contains **MDD Standard**: the documentation reader, static exporter, and Node server. It uses the published [**@wgtechlabs/mdd-engine**](https://github.com/wgtechlabs/mdd-engine) package for Markdown compilation, validation, navigation, and search.

## ✨ Features

- **One source, two readers:** render Markdown as a website and make the same pages available as Markdown for agents.
- **Static or server output:** export a site for static hosting or run the Node server in a container.
- **Built-in reader tools:** search, code copying, table of contents, theme switching, and source edit links.
- **Customizable appearance:** use the bundled D Theme or add a local theme overlay.
- **File-based configuration:** keep documentation, reader links, shared footer links, and themes with the project.
- **Page helpfulness feedback:** optionally collect votes and show the aggregate percentage when a usable database is configured.

| Project | Responsibility | Delivery |
| --- | --- | --- |
| **MDD Engine** (wgtechlabs/mdd-engine) | Headless Markdown processing, validation, navigation, and search | Published dependency on npm and GitHub Packages |
| **MDD Standard** (wgtechlabs/mdd, this repository) | Documentation application using MDD Engine and database-backed plugins | Railway is the recommended deployment; the feedback plugin is the first built-in plugin |
| **MDD Light** | Static documentation output | GitHub Pages support and its installation flow are planned; no database |

**MDD Standard on Railway is the current product focus.** A usable `DATABASE_URL` enables server-side plugins, including the built-in feedback plugin, which collects page helpfulness votes and displays only the aggregate percentage. The Railway template and content-repository integration remain deployment work.

**MDD Light is planned for later.** The static exporter works today, but its GitHub Pages installation and update flow is not implemented. Standard and Light will have separate setup paths.

## 🚀 Getting Started

Use Bun 1.3.10 and Node.js 24 LTS by default. The built application supports Node.js 22, 24, and 26 without Bun at runtime.

~~~sh
bun install --frozen-lockfile
bun run demo
~~~

Open <http://127.0.0.1:4173/docs/>. The example includes an API reference, code blocks, all five alert types, search, footer social links, a table of contents, and theme documentation. See [verification](docs/VERIFICATION.md) for current evidence and remaining hosting work.

### Run the server container

The published container builds documentation from a mounted project. The mount must contain the project's mdd/ directory.

~~~sh
docker run --rm -p 3000:3000 -v "$PWD:/workspace" wgtechlabs/mdd:latest
~~~

The container defaults to /workspace for `MDD_PROJECT_DIR`, /workspace/mdd for `MDD_DOCS_DIR`, /tmp/mdd-dist for `MDD_OUTPUT_DIR`, 0.0.0.0 for HOST, and 3000 for PORT. Environment variables can customize the project, docs, output, base path, edit URL, host, and port.

## 📖 Usage

### Write documentation

Create an mdd/ directory in the documentation project:

~~~text
my-project/
  mdd/
    config.json          # optional
    reader.json          # optional MDD header links
    footer.md            # optional shared social links
    contents/
      index.md           # required homepage
      get-started/
        installation.md
    themes/
      custom/
        theme.css
        theme.js         # optional trusted browser code
~~~

Folders become navigation groups; Markdown files become pages. An `index.md` is the landing page for its folder. MDD supports ordinary Markdown, frontmatter, GitHub-style alerts, and `:::details` disclosures. The engine validates local links.

Use NOTE, TIP, IMPORTANT, WARNING, or CAUTION on the opening line of a root-level blockquote:

~~~markdown
> [!NOTE]
> Keep your documentation beside the code it describes.
~~~

Keep the uppercase marker on its own line; nested blockquotes remain ordinary quotes. Engine 1.0.0 removed `:::note`, `:::tip`, and `:::warning`; replace them with alert blockquotes and move any custom title into the body. Those old directives fail with `REMOVED_COMPONENT`. `:::details[More information]` remains supported. See [writing pages](examples/basic/mdd/contents/guides/writing.md).

### Build a static site

The build API exports a complete static site without a command-line interface:

~~~js
import { build } from '/path/to/mdd/dist/index.js';

const result = await build({
  projectDir: '/path/to/my-project',
  outDir: 'mdd-dist',
  basePath: '/docs/',
});

if (!result.site) {
  console.error(result.diagnostics);
  process.exitCode = 1;
}
~~~

Build output must be outside documentation inputs and cannot replace the project root or an unrelated directory. Rebuilds accept only empty directories or unchanged MDD output, verified against `.mdd-output.json`. Edit source files, not generated output. If you deliberately edit output, move it aside before rebuilding. Remove an interrupted build's sibling `.mdd-dist.mdd-lock` only after confirming no build is running.

### Host the output

The output contains one HTML file per page, `_assets/`, `_mdd/` (including the search index and browser modules), `404.html`, `markdown/`, `llms.txt`, and `mdd-build.json`. No browser framework or remote service is required. Navigation and content work without JavaScript; theme switching, code-copy controls, search, and section tracking enhance the reader when scripts run.

For a nested site, set `basePath` to the full prefix, such as /repository/docs/, in `build()` options and serve the contents of `mdd-dist/` at that URL. The output is not wrapped in extra repository/docs/ directories. The Node server verifies the hidden `.mdd-output.json` inventory at startup and serves only declared files. Restart it after replacing output. /healthz checks inventory identity and declared file presence, not every content hash on every request. Configure a static host to use `404.html` for missing paths; the Node server returns real 404 responses automatically. Upload only the output directory, never the project checkout.

The build manifest reports MDD/engine versions, URL prefix, and Git commit when available. `source.dirty` is null (unknown): the exporter avoids Git status because configured Git filters can execute commands. Keep content stable during a build; production should build from an immutable checkout.

### Use the build API from a checkout

~~~js
import { build, serve } from './dist/index.js';

const result = await build({ projectDir: '/path/to/project', basePath: '/docs/' });
if (!result.site) {
  console.error(result.diagnostics);
} else {
  const server = await serve({ directory: result.directory, port: 3000 });
  // Close the returned Node HTTP server when finished.
}
~~~

Build the checkout with bun run build before importing its local API. Registry publication is not required. Authoring errors return diagnostics without replacing old output; operational failures reject with an error.

### Search the documentation

Choose **Search** in the header or press **Ctrl+K** (**⌘K** on macOS). The native dialog provides result links and loading, empty, and retry states. Click outside, press Escape, or use its close button to return to the page. Search requires browser JavaScript; ordinary reading and navigation remain available without it.

Results include pages and individual headings with context breadcrumbs. Exact and partial matches rank ahead of bounded single-edit typo corrections. Use ↑/↓ to select a result while typing and Enter to open it. The first result is selected automatically; ordinary text-editing keys keep their native behavior.

Matching text is highlighted using the engine's original-text ranges, including corrected spellings and Unicode. Short excerpts appear when a match is in the body rather than the primary label. Excerpts are bounded and may not show every word of a multiword query. Highlights stay in the result list; opening a result shows the original documentation page.

The engine creates the index and ranks queries. MDD exports it as ``_mdd/`search-index.json`, loads it when search opens, and renders result titles, sections, and excerpts as text. The engine's browser-safe query module is ``_mdd/`search.js`; MDD's dialog behavior is ``_mdd/`search-ui.js`. Search works under the configured site prefix without an external search service or server-side query endpoint.

### Customize the reader

See [themes](docs/THEMES.md). D Theme lives in [`themes/d/`](themes/d/) and supports system light/dark preference and a persistent reader toggle. Custom CSS loads after its stylesheet; optional `theme.js` runs only in the browser. The build never executes theme scripts or installs source-repository dependencies.

Every page footer shows the installed **mdd** version and bundled **D Theme — D26 · v0.2.0**. D26 is a release name for D Theme, not a separate theme: minor and patch updates retain it, and the planned 1.0.0 major release introduces D27. The theme version changes independently of mdd; release names never change automatically with the year. [`themes/archive/`](themes/archive/) is reserved for historical source snapshots.

Custom themes provide visual styles and assets through their own theme directories. Their identity stays with the theme; the reader footer shows only the installed mdd and bundled D Theme versions.

### Add source edit links

Set the source editor URL prefix when building to show **Edit this markdown** below each article:

~~~js
build({
  projectDir: '/path/to/project',
  editBaseUrl: 'https://github.com/owner/repository/edit/main/',
});
~~~

MDD appends the engine's source file path, so `mdd/`contents/`guides/install.md` links to that file regardless of its public route or deployment prefix. The link works in static exports without browser JavaScript. It is omitted when no edit destination is configured and on the 404 page.

Use `MDD_EDIT_BASE_URL` when starting the server, or pass `editBaseUrl` in `build()` options for a static export. The prefix must be HTTPS with no credentials, query, or fragment. Use the content repository and an editable branch; MDD does not guess these from the app repository.

Paths are relative to `projectDir`. For a project under `examples/basic/`, include that folder in the prefix, for example https://github.com/owner/repository/edit/main/`examples/basic/`. For a branch named `feature/docs`, encode the branch slash as `feature%2Fdocs`. GitLab and other hosts can use their equivalent HTTPS file-editor prefix. MDD encodes each source filename segment and validates the prefix during checking and building; invalid values preserve previous output. Do not put this reader option in the engine's `mdd/config.json`.

## ⚙️ Configuration

All fields in the engine configuration are optional. Omit theme to use D Theme alone. Its theme field selects a local custom overlay; it does not select a bundled theme by ID. Paths are relative to the configuration folder and must stay within the documentation checkout.

~~~json
{
  "title": "My project",
  "paths": { "contents": "./contents", "themes": "./themes" },
  "theme": "custom"
}
~~~

Configure up to two ordinary header links and one CTA in `mdd/reader.json`:

~~~json
{
  "header": {
    "links": [
      { "label": "Sponsor", "href": "https://github.com/sponsors/wgtechlabs" },
      { "label": "Contribute", "href": "https://github.com/wgtechlabs/mdd" }
    ],
    "cta": { "label": "Explore themes", "href": "https://wgtechlabs.com/mdd" }
  }
}
~~~

This MDD-specific file is separate from the engine's strict config.json schema. Links require absolute HTTPS destinations; the [example docs](examples/basic/mdd/) show the sample header.

Write social links once in `mdd/footer.md`:

~~~markdown
:::socials
- [GitHub](https://github.com/wgtechlabs/mdd)
:::
~~~

Use one `socials` block with a flat unordered list of plain-text labels and absolute HTTPS links. Replace the example destination with your project's URL. Attributes, nested content, images, raw HTML, and credential-bearing URLs are rejected. The file belongs beside the documentation configuration, outside `contents/`; it does not become a page or search result. A missing or empty footer file is allowed. MDD renders social links beside **Built with mdd**, using recognizable icons where supported and readable labels otherwise.

The server uses /workspace as `MDD_PROJECT_DIR`, /workspace/mdd as `MDD_DOCS_DIR`, /tmp/mdd-dist as `MDD_OUTPUT_DIR`, 0.0.0.0 as HOST, and 3000 as PORT by default. Set these environment variables to customize the project, docs, output, base path, edit URL, host, or port. MDD has no dashboard or owner accounts. Without a usable `DATABASE_URL`, docs remain available and database plugins stay disabled.

## 📚 Documentation

- [Product specification](docs/SPEC.md)
- [Architecture and delivery boundaries](docs/ARCHITECTURE.md)
- [Theme guide and version policy](docs/THEMES.md)
- [Verification record](docs/VERIFICATION.md)
- [Release process](docs/RELEASING.md)
- [Brand kit](brand/README.md)
- [Writing pages example](examples/basic/mdd/contents/guides/writing.md)

## 🛠️ Development

~~~sh
bun run check
bun run smoke
bun audit
~~~

The smoke check creates a local application archive, installs it in an isolated consumer, and verifies the renderer API and HTTP server with Node. It does not publish anything. `MDD_TEST_NODE_BINARIES` accepts platform-delimited Node binary paths to exercise one archive across runtimes.

[Build Flow](.github/workflows/build-flow.yml) follows the engine's Node matrix and Bun commands. Registry package publishing is disabled for MDD; only mdd-engine publishes to npm and GitHub Packages. MDD has no npm bootstrap or Trusted Publishing requirement. Build Flow publishes the Node renderer/server container using its default artifact settings for Docker Hub and GHCR, and creates versioned GitHub Releases after a successful eligible main build publishes every enabled artifact. These application releases do not publish MDD to npm or GitHub Packages. CodeQL is enabled automatically for this public repository; private copies need verified code-scanning access.

## 🤝 Contributing

Follow [AGENTS.md](AGENTS.md), the [product contract](docs/SPEC.md), and the layer ownership rules in [architecture](docs/ARCHITECTURE.md). Keep changes aligned with the documented boundary between MDD Engine, MDD, and themes.

## 🐛 Issues & Support

Report bugs and request changes in [GitHub Issues](https://github.com/wgtechlabs/mdd/issues). For questions about product direction, see the [specification](docs/SPEC.md).

## 📄 License

MDD is released under the [MIT License](LICENSE).

## 👥 Authors & Contributors

Maintained by [WG Tech Labs](https://github.com/wgtechlabs).

