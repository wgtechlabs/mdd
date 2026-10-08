# mdd specification

Status: v0.1 local reader/exporter/CLI/server implementation is underway on October 6, 2026. The separate private `wgtechlabs/mdd` repository exists. Its compiler dependency is published `@wgtechlabs/mdd-engine@0.1.1`. The user delegated frontend choices: static HTML/CSS, a clean editorial reader, and direct implementation. See VERIFICATION.md for current evidence and remaining visual/hosting gates. This document specifies intended behavior; it does not establish completion, publication, or a working Railway deployment.

## Purpose and boundary

mdd is the documentation website product: reader frontend, CLI, static exporter, server, and Railway template. It consumes the independently versioned mdd-engine package. It is also the single build entry point for the deployment action.

All authoring/configuration is file-based. No admin dashboard, accounts, database, plugin runtime, or multi-site host is required.

## Runtime and release contract

Use TypeScript and Bun for dependencies/scripts/tests/builds. The shipped CLI and server support Node.js 22, 24, and 26, matching mdd-engine. The default development and Railway runtime is always the latest Node.js LTS, currently Node 24 as verified on October 3, 2026; Node 26 compatibility does not make it the default.

Use `.node-version` and `.nvmrc` for the LTS default, package engines for the supported range, and Build Flow `ci-matrix-versions: '["22","24","26"]'` for compatibility. Follow the same minimum-version verification and Bun lockfile policy as mdd-engine. Pin resolved versions for reproducibility and update the default deliberately when the latest LTS changes. Build browser assets for browsers and server code for Node. The default production image uses Node LTS and must not need Bun at runtime.

mdd-engine is a normal package dependency, not a Git submodule, sibling filesystem import, or copied parser. Pin a tested engine version for each released mdd build. Use Clean Workflow and Build Flow with package/release flows enabled when publishing is activated; publish the mdd package to npm and GitHub Packages, then complete its GitHub Release. Local package metadata proposes `@wgtechlabs/mdd` and MIT, matching the engine. Verify these and registry prerequisites before publication. Initial implementation does not authorize publishing or changing repository visibility.

## Proposed command interface

| Command | Behavior |
|---|---|
| `mdd check` | Compile/validate the configured local docs and return actionable diagnostics |
| `mdd build` | Produce the complete portable static website |
| `mdd dev` | Local preview of the same renderer; a simple rebuild loop is sufficient initially |
| `mdd serve` | Serve already-built files using Node; no Git fetch or Markdown compilation on startup |

Support explicit docs directory, output directory, and effective base path. CLI syntax is proposed, not an existing interface. Do not clear arbitrary directories supplied as output; use a dedicated staging directory and refuse unsafe/overlapping destinations.

## Frontend and theme contract

The initial site provides a readable article layout, folder-derived sidebar, mobile navigation, page headings/anchors, code blocks, table of contents, previous/next page links, and a real 404 page. Reading and navigation work without JavaScript; enhance interactions progressively.

Start with static HTML templates, CSS, and small browser scripts unless implementation evidence justifies a frontend framework. Use the user's Impeccable and Make Interfaces Feel Better workflow to establish the visual design, then validate keyboard/mobile behavior with screenshots.

Ship one useful default theme. Selecting `theme: custom` resolves `themes/custom/theme.css` and optional `theme.js` through configuration. CSS custom properties and documented selectors cover colors, typography, spacing, and component appearance. Theme-relative assets must be copied and base-path-safe. Theme JavaScript runs only in the browser and is explicitly selected by the repository owner; never execute it as part of content compilation. Full layout replacement and plugin hooks are deferred.

## Static output and agent access

Export an independent HTML file for every route, all required assets, a 404 page, and normalized Markdown under a reserved `markdown/` directory that mirrors logical page paths. Export a docs index at `llms.txt` inside the docs deployment prefix, using links to the Markdown files. A live MCP server is not required for static compatibility.

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
