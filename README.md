# mdd

**Markdown in. Documentation out.**

MDD turns a repository's Markdown into a documentation website you can host yourself. People get a readable site; agents get the same content as Markdown. Everything is configured through files.

This repository provides the reader, CLI, static exporter, and Node server. The published [`@wgtechlabs/mdd-engine`](https://github.com/wgtechlabs/mdd-engine) package owns Markdown compilation, validation, routes, and navigation.

## Try the local implementation

Use Bun 1.3.10 and Node.js 24 LTS by default. The built application supports Node 22, 24, and 26 without Bun at runtime.

```sh
bun install --frozen-lockfile
bun run demo
```

Open `http://127.0.0.1:4173/docs/`. The example includes pages, code blocks, components, a table of contents, and theme documentation.

This is the initial local implementation. The MDD package is not published, and no Railway deployment or template has been activated. See [verification](docs/VERIFICATION.md) for current evidence and remaining checks.

## Write documentation

```text
my-project/
  mdd/
    config.json          # optional
    contents/
      index.md           # required homepage
      get-started/
        installation.md
    themes/
      custom/
        theme.css
        theme.js         # optional trusted browser code
```

Folders become navigation groups; Markdown files become pages. An `index.md` is the landing page for its folder. The engine validates local links, supports ordinary Markdown and frontmatter, and renders `note`, `tip`, `warning`, and `details` components.

```json
{
  "title": "My project",
  "paths": { "contents": "./contents", "themes": "./themes" },
  "theme": "custom"
}
```

All configuration fields are optional. Omit `theme` to use the default reader. Paths are relative to the configuration folder and must stay within the documentation checkout. There is no admin dashboard or plugin runtime.

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

`--project` defaults to the current directory. `--dir` selects the documentation folder; `--out` selects output relative to the project. `--base-path` sets the complete public URL prefix during check/build/dev. Serving reads that prefix from the build manifest. `--port` overrides `PORT`; preview binds to `127.0.0.1`, while `serve` binds to `0.0.0.0` by default. Run `--help` for command-specific options.

Build output must be outside documentation inputs and cannot replace the project root or an unrelated directory. Rebuilds accept only empty directories or unchanged MDD output, verified against `.mdd-output.json`. Edit source files, not generated output. If you deliberately edit output, move it aside before rebuilding. An interrupted build can leave a sibling `.mdd-dist.mdd-lock`; remove it only after confirming no build is running.

## Host the output

The output contains one HTML file per page, `_assets/`, `_mdd/`, `404.html`, `markdown/`, `llms.txt`, and `mdd-build.json`. No browser framework or remote service is required. Navigation and content work without JavaScript; theme switching, code-copy controls, and section tracking enhance the reader when scripts run.

For a nested site, pass the full prefix:

```sh
node dist/cli.js build --project /path/to/my-project --base-path /repository/docs/
```

Serve the contents of `mdd-dist/` at that URL. The output itself is not wrapped in extra `repository/docs/` directories. Keep the hidden `.mdd-output.json` inventory when using `mdd serve`; it verifies file hashes at startup and serves only declared files. The running server treats the build as immutable; restart it after replacing output. `/healthz` checks inventory identity and declared file presence, not every content hash on every request. Configure your static host to use `404.html` for missing paths; the Node server returns real 404 responses automatically. Upload only this output directory, never the project checkout.

The build manifest reports MDD/engine versions, the URL prefix, and Git commit when available. `source.dirty` is `null` (unknown): the exporter deliberately avoids Git status because configured Git filters can execute commands. Content must remain stable during a build; production should build from an immutable checkout.

A Railway template will consume a separate public content repository at build time and serve its finished snapshot. That packaging and live deployment verification are the next phase; see [the specification](docs/SPEC.md).

## Customize the reader

See [themes](docs/THEMES.md). The default theme supports system light/dark preference and a persistent reader toggle. Custom CSS loads after the default stylesheet; optional `theme.js` runs only in the browser. The build never executes theme scripts or installs source-repository dependencies.

## Use as a library

```js
import { build, serve } from '@wgtechlabs/mdd';

const result = await build({ projectDir: '/path/to/project', basePath: '/docs/' });
if (!result.site) {
  console.error(result.diagnostics);
} else {
  const server = await serve({ directory: result.directory, port: 3000 });
  // Close the returned Node HTTP server when finished.
}
```

This API is available from a locally packed installation until the first package publication. Authoring errors return diagnostics without replacing the old output. Operational failures reject with an error.

## Develop and release

```sh
bun run check
bun run smoke
bun audit
```

The smoke check packs the real package, installs it in an isolated consumer, and runs the CLI/server with Node. `MDD_TEST_NODE_BINARIES` accepts platform-delimited Node binary paths to exercise one archive across runtimes.

[Build Flow](.github/workflows/build-flow.yml) follows the engine's Node matrix and Bun commands. Package and GitHub Release flows have a temporary bootstrap gate until the first npm package and Trusted Publisher are configured; private-repository CodeQL also needs verified access. The exact reasons and activation steps are in [releasing](docs/RELEASING.md). Development, PR, manual, and stable channel settings are inherited when publishing is enabled.

Follow [AGENTS.md](AGENTS.md), [the product contract](docs/SPEC.md), and [MIT licensing](LICENSE).
