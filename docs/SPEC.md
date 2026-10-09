# mdd specification

Status: local reader/exporter/CLI/server implementation with published `@wgtechlabs/mdd-engine@1.1.0` adoption on October 10, 2026. The separate `wgtechlabs/mdd` repository exists. The user delegated frontend choices: static HTML/CSS, a clean editorial reader, and direct implementation. See VERIFICATION.md for current evidence and remaining visual/hosting gates. This document specifies intended behavior; it does not establish MDD publication or a working Railway deployment.

## Purpose and boundary

mdd is the documentation website product: reader frontend, CLI, static exporter, server, and planned Railway template. It consumes the independently versioned mdd-engine package. It is also the single build entry point for the deployment action. The [delivery contract](ARCHITECTURE.md#delivery-contract) separates the published engine package, MDD's Railway application, and the user's content repository. The engine is installed as a dependency; MDD is deployed as an application, with no MDD npm publication step.

All authoring/configuration is file-based. No admin dashboard, accounts, database, plugin runtime, or multi-site host is required.

The [responsibility contract](ARCHITECTURE.md) defines the boundary between MDD Engine, MDD, and themes. The engine renders semantic article HTML; MDD composes the reader and owns shared interactions; themes style that markup. Keep content parsing and validation in the engine, including any future authoring syntax needed by reader features.

## Runtime and release contract

Use TypeScript and Bun for dependencies/scripts/tests/builds. The shipped CLI and server support Node.js 22, 24, and 26, matching mdd-engine. The default development and Railway runtime is always the latest Node.js LTS, currently Node 24 as verified on October 3, 2026; Node 26 compatibility does not make it the default.

Use `.node-version` and `.nvmrc` for the LTS default, package engines for the supported range, and Build Flow `ci-matrix-versions: '["22","24","26"]'` for compatibility. Follow the same minimum-version verification and Bun lockfile policy as mdd-engine. Pin resolved versions for reproducibility and update the default deliberately when the latest LTS changes. Build browser assets for browsers and server code for Node. The default production image uses Node LTS and must not need Bun at runtime.

mdd-engine is a normal package dependency, not a Git submodule, sibling filesystem import, or copied parser. Pin a tested engine version for each released mdd build. Use Clean Workflow and Build Flow for the MDD application. Only mdd-engine is published to npm and GitHub Packages. Keep MDD registry publication disabled and `package.json` private; its local `@wgtechlabs/mdd` identifier does not imply registry distribution. MDD is MIT licensed; its server and frontend are intended for a Railway template with one public content repository per deployment. Local checkout builds provide the CLI and static export during development. GitHub Releases and future container delivery are independent of npm; no MDD token, Trusted Publisher, or first-package bootstrap is needed. Initial implementation does not authorize deployment or changing repository visibility.

## Command interface

| Command | Behavior |
|---|---|
| `mdd check` | Compile/validate the configured local docs and return actionable diagnostics |
| `mdd build` | Produce the complete portable static website |
| `mdd dev` | Local preview of the same renderer; a simple rebuild loop is sufficient initially |
| `mdd serve` | Serve already-built files using Node; no Git fetch or Markdown compilation on startup |

Support explicit docs directory, output directory, and effective base path. These CLI commands are implemented. Do not clear arbitrary directories supplied as output; use a dedicated staging directory and refuse unsafe/overlapping destinations.

## Frontend and theme contract

The site provides a readable article layout, folder-derived sidebar, mobile navigation, page headings/anchors, code blocks, alerts, table of contents, search, shared footer links, previous/next page links, and a real 404 page. Reading and navigation work without JavaScript; enhance interactions progressively.

MDD places previous/next navigation after each article, above the divider that begins the footer. When editing is configured, the footer begins with a contribution row pairing **Help improve this page.** and **Edit this markdown**, separated from the resources beneath it. There are no helpfulness voting controls. The footer groups **View Markdown** and **llms.txt for agents** on one line, wrapping together when space is limited. View Markdown opens the exported page Markdown; llms.txt opens the site-wide index. The 404 page has no article actions. The header contains an accessible sun/moon theme control; the project credit lives in the main page footer. MDD provides a desktop sidebar toggle that remembers the reader's choice when browser storage is available; mobile retains its native Browse documentation disclosure. Folder groups use native disclosures on both layouts, open by default, with folder landing-page links preserved. MDD remembers each group's expanded/collapsed state across page navigation and reloads using its encoded folder path and public site prefix. Desktop and mobile copies stay synchronized; a saved collapse is honored even when the current page is inside that group. If storage is unavailable, in-page synchronization and native controls still work, but preferences do not survive a new page load. MDD renders **Edit this markdown** when an HTTPS source editor prefix is supplied through `--edit-base-url`, CLI environment variable `MDD_EDIT_BASE_URL`, or library option `editBaseUrl`. Append the engine's project-relative `Page.source`, encoding literal filename segments; do not derive source files from public routes. The prefix includes the content repository, editable branch, and any project subdirectory. Reject credentials, query/fragment, and unsafe paths before output replacement. Omit the link without configuration and on the 404 page. This is MDD reader configuration, not new Markdown syntax or an engine schema extension; themes style `.mdd-edit-page` while shared rendering owns the link.

Start with static HTML templates, CSS, and small browser scripts unless implementation evidence justifies a frontend framework. Use the user's Impeccable and Make Interfaces Feel Better workflow to establish the visual design, then validate keyboard/mobile behavior with screenshots.

### Alerts, search, and shared footer

Consume engine 1.0.0's semantic HTML for root-level GitHub-style `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` alerts. The engine validates syntax, supplies the static visible labels and `.mdd-alert`/type hooks, and preserves the `> [!TYPE]` marker in exported Markdown. MDD does not reparse author source or inject live regions. D Theme styles the existing labels with decorative icons and colors. Removed `:::note`, `:::tip`, and `:::warning` blocks fail with the engine's actionable `REMOVED_COMPONENT` diagnostic; preserve the prior output and direct authors to migrate the complete body and optional custom title. `:::details` is unchanged.

Use the engine's index builder after successful compilation and its browser-safe query API at runtime. MDD owns the header search control, Ctrl/Cmd+K shortcut, native dialog, input and result DOM, Escape/close behavior, and loading, empty, failure, and retry states. Load the static index when search is opened; do not require a remote service, a query endpoint, or a second search algorithm. Request section mode with bounded typo fallback. Present independent page/heading labels, breadcrumbs, and optional body-match excerpts as text, using engine-provided match ranges for highlights. Keep input focus during arrow-key selection, use Enter for the selected link, and preserve native editing keys; use the engine's validated page/heading URLs under the configured base path. Search requires JavaScript but must not gate ordinary reading or navigation. Themes control appearance without changing index/query semantics.

The optional shared `mdd/footer.md` is engine-owned authoring input beside `config.json`, including when the documentation directory is customized. It contains one `:::socials` container with a flat unordered list of plain-text labeled HTTPS links. Preserve engine validation of content, URLs, and paths. Missing or empty files produce no social links. MDD renders `site.footer.socials` in `.mdd-socials` and groups it with `.mdd-credit` in `.mdd-footer-bottom`, below the agent resource links. Known social icons are decorative and links retain accessible labels; unfamiliar destinations retain readable text. Do not add footer content to routes, navigation, Markdown article exports, or search results.

Develop, test, and ship **D Theme** in this MDD repository under `themes/d/`, with stable ID `d`. Its numeric version is independent of the MDD release. `themes/d/theme.json` declares name `D Theme`, release `D26`, and current version `0.2.0`; the initial development version was `0.1.0`. Maintain its change history alongside the stylesheet. Minor and patch updates retain the release name; the planned 1.0.0 major release introduces D27. Release names are deliberate version names, not separate annual themes or automatic calendar changes. Preserve released historical snapshots and their identities under `themes/archive/`.

Custom themes also have their own independent versions and release histories; see the [theme version policy](THEMES.md#version-policy). MDD validates bundled metadata and optional custom `theme.json` display metadata, then shows the MDD version and bundled D Theme identity as two primary entries in every reader footer. When a custom overlay is selected, its identity is available under the collapsed D Theme disclosure as Custom styling; this works without browser JavaScript. Custom metadata requires `name` and `version` and permits an optional `release` label. Missing custom metadata is explicitly labeled; invalid metadata fails checking/building before output replacement. Compatibility checks and version installation remain deferred. Keep shared markup and control behavior in MDD and visual choices in the theme. No separate theme repository/package or engine styling dependency is required.

Ship D Theme as the default base and preserve its public stylesheet URL `_mdd/reader.css`. The MDD-only `--theme d` option explicitly selects that base for check/build/dev; it is also the default when omitted. Configuration still selects a local custom overlay: `theme: custom` resolves `themes/custom/theme.css` and optional `theme.js` through the unchanged engine contract, then loads over D Theme. Do not reinterpret `config.theme: d` as a bundled selector. CSS custom properties and documented selectors cover colors, typography, spacing, and component appearance. Theme-relative assets must be copied and base-path-safe. Theme JavaScript runs only in the browser and is explicitly selected by the repository owner; never execute it as part of content compilation. Full layout replacement and plugin hooks are deferred.

## Static output and agent access

Export an independent HTML file for every route, all required assets, a 404 page, and normalized Markdown under a reserved `markdown/` directory that mirrors logical page paths. Export a docs index at `llms.txt` inside the docs deployment prefix, using links to the Markdown files. A live MCP server is not required for static compatibility.

Export `_mdd/search-index.json` from the compiled site's engine index, `_mdd/search.js` from the published browser query module, and `_mdd/search-ui.js` for MDD's search interaction. Include these files in the output inventory and serve their proper JSON/JavaScript content types. Search URLs must work under `/`, `/docs/`, and `/repository/docs/`, like other reader assets.

Reserve generated paths before writing output and reject content collisions. Serve a small `mdd-build.json` manifest containing docs commit (when known), mdd version, engine version, and effective base path. It must contain no environment dump, credentials, local absolute paths, or unrelated repository files. During local builds, record Git commit when available and dirty state as null (unknown). Do not invoke Git status: local Git filters can execute commands. A commit identifier alone is not proof of a clean release.

One build receives the complete effective prefix: `/`, `/docs/`, or `/repository/docs/`. All page links, theme assets, images, headings, Markdown URLs, and index entries must respect it. The deployment layer computes the host-specific prefix; the renderer does not guess a repository name.

GitHub Pages receives this static output and runs no Node process. [GitHub Pages hosting model](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Railway template and source configuration

The Railway service source is the mdd application repository. The user's repository is a separate content input.

| Variable | Contract |
|---|---|
| `MDD_REPO_URL` | Required public HTTPS source repository URL |
| `MDD_REPO_REF` | Optional initial branch/tag; otherwise the repository's default branch |
| `MDD_SOURCE_SHA` | Exact external docs commit; supplied by the update action |
| `MDD_SOURCE_DIR` | Defaults to `mdd`, relative to the source checkout |
| `MDD_BASE_PATH` | Public documentation prefix, default `/`; consumed by the build and recorded in the manifest |
| `PORT` | Railway-provided port for the Node server |

Proposed first supported repository host: GitHub, matching the initial action workflow. Document this clearly; generic Git hosting can follow without changing the engine. Validate URLs and use argument-safe Git operations; do not execute source repository install hooks or build scripts. The build only consumes documentation/configuration/theme assets.

During the image build, fetch the selected commit, verify the resolved SHA, run mdd, and include the finished site in the final image. A requested SHA that cannot be fetched must fail, never fall back to branch HEAD. For initial URL-only setup, resolve the branch once during that build and record its actual SHA.

Consume `MDD_SOURCE_SHA` before the Docker fetch/build layer so changed docs invalidate that cache. Initial branch-based builds also need a deployment-specific cache input so a fresh deployment does not reuse an old branch checkout. Keep dependency layers reusable. These are proposed implementation rules to validate on Railway, not a claim of a tested template. [Docker build variables](https://docs.railway.com/builds/dockerfiles)

Pass `MDD_BASE_PATH` into the engine/frontend build and configure serving consistently; `/healthz` remains a server readiness route at the root. The runtime serves built files only. It needs no Git checkout, source credentials, persistent volume, or database. One service hosts one docs site.

## Readiness, updates, and failure behavior

Bind to `0.0.0.0` and `PORT`. `/healthz` is a readiness endpoint and succeeds only when the expected site and manifest exist. Restrict serving to the output root and return genuine not-found responses for missing pages.

A new build is promoted only after readiness succeeds. Build failures must leave the previous healthy site available. Railway healthchecks control deployment activation; they are not ongoing monitoring. [Railway healthchecks](https://docs.railway.com/deployments/healthchecks)

Content updates must preserve the currently deployed mdd application revision and change the external docs SHA. Application upgrades are a separate deliberate operation. Restarts serve the same snapshot; rollbacks restore a prior built snapshot subject to provider retention. The separate `mdd-build-flow-action` repository will own the update trigger.

## Acceptance criteria

- The same content/theme fixture works in static export and Railway without divergent rendering rules.
- The same packaged CLI can build the fixture and the built server can serve it under real Node 22, 24, and 26, without Bun installed. The default final server image uses the latest LTS; verify the declared minimum Node version before publication.
- A generic static server proves deep links, 404 behavior, assets, Markdown output, and all required prefixes.
- Default/custom themes pass keyboard, mobile, contrast, and focus checks with screenshot evidence.
- A template deployment works from a public repository URL and its default `mdd/` folder.
- A changed docs SHA appears in the built site and manifest despite caching.
- Invalid source or content prevents publication, and restart/rollback behavior preserves the intended snapshot.
- No source fetch, build-time theme execution, or mutation endpoint exists in the serving process.

Private repositories, multiple sites, theme marketplaces, arbitrary layout plugins, AI chat, and external search services remain later work.
