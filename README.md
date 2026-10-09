# mdd

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo/mdd-wordmark-white.svg">
  <img src="brand/logo/mdd-wordmark-blurple.svg" alt="mdd" width="240" height="102">
</picture>

**Markdown in. Documentation out.**

MDD turns a repository's Markdown into a documentation website you can host yourself. People get a readable site; agents get the same content as Markdown. Everything is configured through files.

This repository provides the reader frontend and Node server intended for deployment through a Railway template, plus the local CLI and static exporter. The published [`@wgtechlabs/mdd-engine@1.1.0`](https://github.com/wgtechlabs/mdd-engine) package owns Markdown compilation, validation, routes, navigation, shared footer metadata, and headless search.

| Project | Responsibility | Delivery |
| --- | --- | --- |
| **MDD Engine** (`wgtechlabs/mdd-engine`) | Headless Markdown processing, validation, navigation, and search | Published dependency: `@wgtechlabs/mdd-engine` on npm and GitHub Packages |
| **MDD** (`wgtechlabs/mdd`, this repository) | Documentation frontend and Node server using MDD Engine | Railway template application; no MDD npm or GitHub Packages publication |

The Railway template will deploy **this application** and accept a separate public
**content repository URL**. Each deployment will build and serve that repository's
`mdd/` folder as one documentation site. The local reader, CLI, static export, and
server work today; the Railway template and content-fetch integration are still to
be implemented. Static output can also be hosted on GitHub Pages.

- **MDD Engine:** compile Markdown into validated site data and safe article HTML, including code blocks and alerts; create and query a portable search index.
- **MDD:** compose the website, add shared reader controls such as code copying and search, and export or serve it.
- **Themes:** customize colors, typography, spacing, and assets through the shared reader's styling hooks. The bundled **D Theme** is developed in this repository and has its own version and release name: **D26, version 0.2.0**. Custom themes can overlay it with their own versions. See the [version policy](docs/THEMES.md#version-policy).

See [delivery boundaries](docs/ARCHITECTURE.md#delivery-contract) and [responsibilities](docs/ARCHITECTURE.md#ownership) for where each feature belongs.

The Page space logo, blurple palette, icons, and usage guidance live in the [brand kit](brand/README.md).

## Try the local implementation

Use Bun 1.3.10 and Node.js 24 LTS by default. The built application supports Node 22, 24, and 26 without Bun at runtime.

```sh
bun install --frozen-lockfile
bun run demo
```

Open `http://127.0.0.1:4173/docs/`. The example includes pages, code blocks, all five alert types, search, footer social links, a table of contents, and theme documentation.

See [verification](docs/VERIFICATION.md) for current evidence and remaining hosting work.

## Write documentation

```text
my-project/
  mdd/
    config.json          # optional
    footer.md            # optional shared social links
    contents/
      index.md           # required homepage
      get-started/
        installation.md
    themes/
      custom/
        theme.css
        theme.json       # optional name/version and release label
        theme.js         # optional trusted browser code
```

Folders become navigation groups; Markdown files become pages. An `index.md` is the landing page for its folder. The engine validates local links, supports ordinary Markdown and frontmatter, and renders GitHub-style alerts plus `:::details` disclosures.

```markdown
> [!NOTE]
> Keep your documentation beside the code it describes.
```

Use `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, or `CAUTION` on the opening line of a root-level blockquote. Keep the uppercase marker on its own line; nested blockquotes remain ordinary quotes. Engine 1.0.0 removes `:::note`, `:::tip`, and `:::warning`: replace them with alert blockquotes and move any custom title into the body. Old directives fail with `REMOVED_COMPONENT` instead of silently changing meaning. `:::details[More information]` remains supported. See [writing pages](examples/basic/mdd/contents/guides/writing.md).

```json
{
  "title": "My project",
  "paths": { "contents": "./contents", "themes": "./themes" },
  "theme": "custom"
}
```

All configuration fields are optional. Omit `theme` to use D Theme alone. The configuration's `theme` field selects a local custom overlay; it does not select a bundled theme by ID. Paths are relative to the configuration folder and must stay within the documentation checkout. There is no admin dashboard or plugin runtime.

## Shared footer links

Write social links once in `mdd/footer.md`:

```markdown
:::socials
- [GitHub](https://github.com/wgtechlabs/mdd)
:::
```

Use one `socials` block containing a flat unordered list of plain-text labels and absolute HTTPS links. Replace the example destination with your project's URL. Attributes, nested content, images, raw HTML, and credential-bearing URLs are rejected. The file belongs beside the documentation configuration, outside `contents/`; it does not become a page or search result. A missing or empty footer file is allowed. MDD renders the links in the page footer beside **Built with mdd**, using recognizable icons where supported and readable labels otherwise.

## Search the documentation

Choose **Search** in the header or press **Ctrl+K** (**⌘K** on macOS). A native dialog provides the search field, result links, and loading, empty, and retry states. Press Escape or use its close button to return to the page. Search requires browser JavaScript; ordinary reading and navigation remain available without it.

Results show pages and individual headings with context breadcrumbs. A page can have several matching sections. Exact and partial matches rank ahead of bounded single-edit typo corrections. Use ↑/↓ to select a result while continuing to type, and Enter to open it. The first result is selected automatically; ordinary text-editing keys keep their native behavior.

Matching text is highlighted using the engine's original-text ranges, including corrected spellings and Unicode text. Short excerpts appear when the match is in the body rather than the primary label. The engine selects excerpt text around a match, so words farther down a section remain visible in the preview. Excerpts are bounded and may not show every word of a multiword query. Highlights are limited to the result list; opening a result shows the original documentation page.

The engine creates the index and ranks queries. MDD exports it as `_mdd/search-index.json`, loads it when search is opened, and renders result titles, sections, and excerpts as text. The engine's browser-safe query module is exported as `_mdd/search.js`; MDD's dialog behavior is `_mdd/search-ui.js`. Search works from the same static build under the site's configured prefix, with no external search service or server-side query endpoint.

## Commands

From the MDD checkout after `bun run build`:

```sh
node dist/cli.js check --project /path/to/my-project
node dist/cli.js build --project /path/to/my-project --base-path /docs/
node dist/cli.js dev --project /path/to/my-project
node dist/cli.js serve --project /path/to/my-project --port 3000
```

| Command | Behavior |
| --- | --- |
| `check` | Validate content and show source diagnostics without writing output |
| `build` | Write a complete static site to `mdd-dist/` |
| `dev` | Rebuild when content, configuration, or the selected theme changes; refresh the browser to see changes |
| `serve` | Serve an existing build, with no source checkout or compilation required |

`--project` defaults to the current directory. `--dir` selects the documentation folder; `--out` selects output relative to the project. `--base-path` sets the complete public URL prefix during check/build/dev. `--theme d` explicitly selects the bundled D Theme for those commands; omitting it has the same result. A configured custom theme still loads over that base. Serving reads the prefix and already-built theme files from output. `--port` overrides `PORT`; preview binds to `127.0.0.1`, while `serve` binds to `0.0.0.0` by default. Run `--help` for command-specific options.

Build output must be outside documentation inputs and cannot replace the project root or an unrelated directory. Rebuilds accept only empty directories or unchanged MDD output, verified against `.mdd-output.json`. Edit source files, not generated output. If you deliberately edit output, move it aside before rebuilding. An interrupted build can leave a sibling `.mdd-dist.mdd-lock`; remove it only after confirming no build is running.

## Host the output

The output contains one HTML file per page, `_assets/`, `_mdd/` (including the search index and browser modules), `404.html`, `markdown/`, `llms.txt`, and `mdd-build.json`. No browser framework or remote service is required. Navigation and content work without JavaScript; theme switching, code-copy controls, search, and section tracking enhance the reader when scripts run.

For a nested site, pass the full prefix:

```sh
node dist/cli.js build --project /path/to/my-project --base-path /repository/docs/
```

Serve the contents of `mdd-dist/` at that URL. The output itself is not wrapped in extra `repository/docs/` directories. Keep the hidden `.mdd-output.json` inventory when using `mdd serve`; it verifies file hashes at startup and serves only declared files. The running server treats the build as immutable; restart it after replacing output. `/healthz` checks inventory identity and declared file presence, not every content hash on every request. Configure your static host to use `404.html` for missing paths; the Node server returns real 404 responses automatically. Upload only this output directory, never the project checkout.

The build manifest reports MDD/engine versions, the URL prefix, and Git commit when available. `source.dirty` is `null` (unknown): the exporter deliberately avoids Git status because configured Git filters can execute commands. Content must remain stable during a build; production should build from an immutable checkout.

A Railway template will consume a separate public content repository at build time and serve its finished snapshot. That packaging and live deployment verification are the next phase; see [the specification](docs/SPEC.md).

## Customize the reader

See [themes](docs/THEMES.md). D Theme lives in [`themes/d/`](themes/d/) and supports system light/dark preference and a persistent reader toggle. Custom CSS loads after its stylesheet; optional `theme.js` runs only in the browser. The build never executes theme scripts or installs source-repository dependencies.

Every page footer shows two primary entries: **MDD v0.1.0** (the installed MDD version) and **D Theme — D26 · v0.2.0**. When custom styling is selected, expand the D Theme entry to see its name, release, and independent version. D26 is a release name for D Theme, not a separate theme: minor and patch updates retain it, and the planned 1.0.0 major release introduces D27. The theme version changes independently of MDD; release names never change automatically with the year. [`themes/archive/`](themes/archive/) is reserved for historical source snapshots.

Custom themes can declare their own `name`, `version`, and optional `release` in `theme.json`; without the file, their expanded styling details say “version not declared.” MDD validates metadata during `check` and `build`; it does not install theme versions or check compatibility ranges.

## Reader contributions

Add **Edit this markdown** below each article by setting the source editor URL
prefix when building:

```sh
mdd build --project /path/to/project \
  --edit-base-url https://github.com/owner/repository/edit/main/
```

MDD appends the engine's source file path, so `mdd/contents/guides/install.md`
links to that exact file, regardless of its public route or deployment prefix.
The link works in static exports without browser JavaScript. It is omitted when
no edit destination is configured and on the 404 page.

Use `MDD_EDIT_BASE_URL` for CLI builds/previews, or `editBaseUrl` in the library's
`build()` options. An explicit CLI flag overrides the environment variable.
`check`, `build`, and `dev` accept the option; `serve` uses the already-built links.
The prefix must be HTTPS with no credentials, query, or fragment. Use the content
repository and an editable branch. MDD does not guess these from the app repository.

Paths are relative to `--project`. For a project under `examples/basic/`, include
that folder in the prefix, for example
`https://github.com/owner/repository/edit/main/examples/basic/`. For a branch named
`feature/docs`, encode the branch slash as `feature%2Fdocs` in the prefix.
GitLab and other hosts can use their equivalent HTTPS file-editor prefix.
MDD encodes each source filename segment and validates the prefix during checking
and building; invalid values preserve previous output. Do not put this reader
option into the engine's `mdd/config.json`.

## Use the build API from a checkout

```js
import { build, serve } from './dist/index.js';

const result = await build({ projectDir: '/path/to/project', basePath: '/docs/' });
if (!result.site) {
  console.error(result.diagnostics);
} else {
  const server = await serve({ directory: result.directory, port: 3000 });
  // Close the returned Node HTTP server when finished.
}
```

Build the checkout with `bun run build` before importing its local API. MDD does not require registry publication. Authoring errors return diagnostics without replacing the old output. Operational failures reject with an error.

## Develop and release

```sh
bun run check
bun run smoke
bun audit
```

The smoke check creates a local application archive, installs it in an isolated consumer, and runs the CLI/server with Node. This test does not publish anything. `MDD_TEST_NODE_BINARIES` accepts platform-delimited Node binary paths to exercise one archive across runtimes.

[Build Flow](.github/workflows/build-flow.yml) follows the engine's Node matrix and Bun commands. Registry package publishing is disabled for MDD; only `mdd-engine` publishes to npm and GitHub Packages. MDD has no npm bootstrap or Trusted Publishing requirement. GitHub Releases and future container delivery are separate application delivery steps, currently inactive. CodeQL is enabled automatically for this public repository; private copies need verified code-scanning access. See [releasing](docs/RELEASING.md).

Follow [AGENTS.md](AGENTS.md), [the product contract](docs/SPEC.md), and [MIT licensing](LICENSE).
