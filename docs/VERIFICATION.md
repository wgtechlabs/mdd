# Verification

Initial MDD implementation, October 6, 2026. This record concerns local source and local artifacts. No commit, push, remote CI, package publication, repository visibility change, or live deployment is implied.

## October 8 delivery check

The same local check suite was rerun before preparing `feature/initial-mdd` for the user's branch review: 32 tests / 387 assertions, all four packaged Node runtimes, lint, typecheck, build, and the dependency audit passed. A separate delivery inspection found no apparent secrets or generated files among the 42 candidate source/configuration/documentation files. Visual verification remains pending as documented below. Remote CI, publishing, and deployment are not claimed by these local checks.

## Scope

Portable static exporter, default reader, selected theme assets, Markdown/index output, check/build/dev/serve CLI, and Node static server. The application consumes published mdd-engine 0.1.1; it does not duplicate Markdown compilation.

## Current evidence

- Frozen Bun dependency installation, lint, TypeScript, and Node ESM/declaration build passed.
- The dependency audit reported no known vulnerabilities.
- Functional fixtures cover prefixes `/`, `/docs/`, `/repository/docs/`, encoded names, themes, output ownership, failed authoring preservation, path/symlink rejection, diagnostics, local serving, and preview recovery.
- Independent structure review found no maintainability blockers. Independent security review found and drove fixes for Git filter execution, incomplete server readiness/allowlisting, and watching resolved configuration symlinks.
- Reader metadata escaping, no-JavaScript navigation markup, fallback titles, theme URLs, and the not-found page have automated checks.
- Impeccable's source detector reported no findings.

Final local checks after the integration fixes:

| Check | Result |
| --- | --- |
| `bun run check` | PASS: lint, typecheck, 32 tests / 387 assertions, compiled build |
| `bun run smoke` with four Node binaries | PASS: one installed 21-file archive; Node 22.0.0, 22.16.0, 24.21.0, 26.10.0 |
| Packaged runtime behavior | PASS: CLI, all three public prefixes, native Node preview rebuild/new route/health, source-free serving |
| `bun audit` | PASS: no known vulnerabilities reported |
| Source security regressions | PASS: Git filters not executed; output preserved on control-character paths/invalid prefixes; inventory and linked-config behavior |

The final independent integration finding was a mismatch between export and server URL validation. Both now share canonical prefix validation, and shared file checks reject controls before promotion; encoded Unicode whitespace remains valid. No framework or runtime dependency was added beyond the published engine.

## Visual verification gap

The app's browser policy could not be verified before accessing the local preview. Browser access was refused; no workaround was attempted. Desktop/mobile screenshots, keyboard interaction, theme/copy controls, actual contrast, and custom-theme visual behavior have **not** been verified in a browser.

A fresh generic review agent used Impeccable's degraded finish-review contract because this harness cannot select its shipped agent definition. It returned `recapture`: desktop and mobile screenshots are required before a visual verdict. The visual stage remains open. Static checks do not replace it.

## Release and hosting gaps

- Railway container/template packaging and a live deployment belong to the next phase.
- Generic-host/browser deep-link rendering and configured static-host 404 behavior still need browser evidence; Node HTTP responses are tested separately.
- Publishing is gated pending first-package setup and npm OIDC verification. GitHub-hosted CI and private CodeQL entitlement have not run for this repository.
- Output is staged and replaced with rollback on a handled rename failure. It is not a cross-platform atomic directory exchange; a killed build can leave its lock or staging directory. Do not modify content or output concurrently with builds.
- The Node server treats a completed build as immutable; use a new server snapshot after a build. Local preview handles that transition.
