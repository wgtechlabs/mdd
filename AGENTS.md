# mdd contributor instructions

## Product boundary

This is `wgtechlabs/mdd`: the documentation reader, CLI, static exporter, and Node server. Consume the published `@wgtechlabs/mdd-engine` package for content/configuration validation, Markdown, routes, navigation, and diagnostics. Never duplicate the compiler or import a sibling checkout. See `docs/SPEC.md` for the product contract.

All authoring happens through repository files. There is no admin dashboard, database, account system, plugin runtime, or multi-site service. Private source repositories and deployment-action implementation are deferred. Railway hosting uses one public content repository per deployment; the app repository is a separate input.

## Toolchain and quality

- TypeScript, Bun 1.3.10 tooling and a single committed `bun.lock`.
- Ship Node-compatible ESM and explicit TypeScript declarations. Never ship Bun runtime APIs.
- Support Node 22, 24, and 26. Default to the latest LTS, currently Node 24.21.0 as verified October 2026. Verify the declared minimum and run the same packaged CLI/server smoke test in each supported Node major.
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
- Use Build Flow with package/release flows and inherited development/PR/manual channels when publishing is activated. Both npm and GitHub Packages must succeed before GitHub Release. Use npm OIDC and GitHub's built-in token, never log credentials.
- A green build does not prove publication, deployment, or runtime behavior. Verify the actual outcome and disclose missing evidence.
