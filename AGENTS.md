# mdd contributor instructions

## Product boundary

This is `wgtechlabs/mdd`: the documentation renderer, reader, static exporter, and Node server. MDD has no standalone CLI; its container builds a mounted content project and starts the HTTP server directly. The current roadmap prioritizes MDD Standard on Railway, with one user content repository per deployment. MDD Light static hosting through GitHub Pages is planned for later. Consume the published `@wgtechlabs/mdd-engine` package for content/configuration validation, Markdown, routes, navigation, and diagnostics. Never duplicate the compiler or import a sibling checkout. See `docs/SPEC.md` for the product contract.

**Delivery direction:** focus on MDD Standard application behavior first; Railway
template creation is handled separately, and MDD Light/GitHub Pages follows later.
Keep the app source separate from the user's content repository. A usable
`DATABASE_URL` enables the generic server-side Plugin Storage API and built-in
feedback plugin; without it, docs remain available and database plugins stay
disabled. Do not add a dashboard, owner accounts, public raw-data route, or
authenticated Analytics API to the feedback feature. Follow the [delivery
contract](docs/ARCHITECTURE.md#delivery-contract); do not add an MDD npm bootstrap,
registry release, or Trusted Publisher as a prerequisite.

Follow [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for layer ownership. The engine owns semantic article HTML and authoring syntax; MDD owns the page shell, accessible shared controls, and presentation enhancements; themes own visual styling. Code-copy behavior belongs to MDD. Syntax highlighting is not implemented; future tokenization belongs to MDD and token colors to themes. Any new authoring metadata still needs an engine contract first. Theme changes must preserve content meaning and compiled navigation.

Use the published engine's `createSearchIndex`, browser-safe `search`, and `validateSearchIndex` APIs; do not build a second indexer or ranking system. MDD exports the index and browser modules and owns the search dialog's loading, retry, keyboard, and focus behavior. Search results use text nodes and stay inside the same documentation origin and base path. Consume `Site.footer.socials` for the shared footer; footer parsing and HTTPS link validation belong to the engine. GitHub alerts are semantic engine output; D Theme adds decorative icons and styling without live-alert roles. Keep these controls outside article HTML and normalized Markdown.

Today, authoring happens through repository files; MDD has no account system or multi-site service. Database-backed plugin behavior belongs to MDD Standard; MDD Light remains static and database-free. The plugin storage interface is server-side only, scoped by plugin ID, and must not expose arbitrary SQL or another plugin's records. Private source repositories and deployment-action implementation are deferred. Planned hosting will use one public content repository per deployment; the app repository is a separate input.

Develop, test, version, and ship **D Theme** in this repository under `themes/d/`, with stable identifier `d`. Its stylesheet is `themes/d/theme.css`; shared shell markup and browser behavior remain in `src/render.ts` and `assets/reader.js`. Keep the exported stylesheet URL `_mdd/reader.css` stable. Custom themes overlay D Theme without redefining shared reader features. Do not move bundled styling into the engine or require a separate theme repository/package.

D Theme has its own numeric version and release name in `themes/d/theme.json`, independent of the MDD application version. The initial identity is D Theme / D26 / 0.1.0; minor and patch updates keep D26, and the planned 1.0.0 major release introduces D27. Release names change deliberately with major design releases, never automatically with the calendar. Preserve historical source snapshots in `themes/archive/`; they are versions of D Theme, not separate annual themes. Custom themes also have independent author-managed versions.

MDD owns the version footer. Show the installed `mdd` version and bundled D Theme identity only; custom themes remain visual layers selected by the engine and do not add footer metadata. Keep theme-specific styles and assets in their theme directories. D Theme is the bundled base; `config.theme` selects a local custom overlay using the engine contract. Do not invent new engine configuration or mutate `Site.theme` to point at package files. Follow [the theme version policy](docs/THEMES.md#version-policy); compatibility checks and version installation are deferred.

## Toolchain and quality

- TypeScript, Bun 1.3.10 tooling and a single committed `bun.lock`.
- Ship Node-compatible ESM and explicit TypeScript declarations. Never ship Bun runtime APIs.
- Support Node 22, 24, and 26. Default to the latest LTS, currently Node 24.21.0 as verified October 2026. Verify the declared minimum and run the packaged renderer/server smoke check in each supported Node major.
- Use strict TypeScript, fixture-based tests, lint, build, dependency audit, and actual static/server checks. Do not infer Node compatibility from Bun tests.
- Follow Grilling for unresolved decisions, APEX for implementation, Impeccable for frontend direction, Make Interfaces Feel Better for polish, and Thermo-Nuclear review for substantial changes. Reuse settled user decisions and relevant verification.
- Prefer platform APIs, existing packages, and the smallest correct implementation. Do not introduce a frontend framework without a material reason and the user's direction.

## Security and output

Treat documentation and repositories as untrusted data. Never execute source repository install scripts, config JavaScript, or theme JavaScript at build time. Selected theme JavaScript runs only in the browser and must be documented as trusted author code.

Emit only declared documentation output and safely selected assets. Reject traversal, symlink escapes, sensitive files, unsafe/overlapping output destinations, and generated-path collisions. Failed builds preserve the previous output. Never clear arbitrary directories. Serve only validated build output, return genuine 404s, and expose no mutation routes. `/healthz` succeeds only for a complete expected build.

Public base paths affect URLs, not an extra level of output directories. Preserve `/`, `/docs/`, and `/repository/docs/` behavior across static export and the Node server. Escape metadata used in HTML; embed article fragments only from the engine contract.

## Git and delivery

WG Tech Labs Clean Workflow is adopted. Use its Clean Coding, Clean Code Review, Clean Commit, Clean Flow, and Clean Labels guidance.

- Feature/fix branches originate from `dev`; squash their PRs into `dev`.
- Promote `dev` to `main` using a regular merge commit and a `🚀 release:` title.
- Use Clean Commit `<emoji> <type>: <lowercase description>` messages.
- Preserve unrelated changes, reviewer history, and both long-lived branches. Do not self-approve.
- Use GHLT for authorized label template changes. Do not delete labels as a side effect of adopting conventions.
- Package publication, public exposure, live deployment, and merging require the applicable user authorization. Preserve the repository's existing visibility.
- MDD is an application, not a registry package. Keep `package.json` private and Build Flow `enable-package: false`; only `mdd-engine` publishes to npm and GitHub Packages. MDD needs no npm token, Trusted Publisher, or first-package bootstrap. Build Flow publishes the Node renderer/server container and versioned GitHub Releases after successful enabled artifact publishing. This does not publish MDD to a package registry or imply a Railway deployment.
- A green build does not prove publication, deployment, or runtime behavior. Verify the actual outcome and disclose missing evidence.
