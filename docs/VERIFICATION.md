# Verification

Initial MDD implementation, October 6, 2026. This record concerns local source and local artifacts. No commit, push, remote CI, package publication, repository visibility change, or live deployment is implied.

## October 9 engine 1.0.1 search excerpt integration

MDD now pins published `@wgtechlabs/mdd-engine@1.0.1`. Its existing export wiring
ships that package's browser query module, so result excerpts show text around a
match without duplicating the engine's excerpt logic in the reader. MDD remains
0.1.0 and D Theme remains 0.2.0 / D26.

- The new reader regression failed against engine 1.0.0: a late body match was
  absent from the excerpt. It passes with 1.0.1 and verifies visible matched text,
  semantic highlighting, the 160-code-point bound, and the heading destination.
- `bun run check`: PASS, lint, typecheck, build, 83 tests / 865 assertions.
- One isolated installed 28-file archive passed packaged CLI/server/search checks
  under Node 22.0.0, 24.21.0, and 26.10.0, including all three public prefixes.
- `bun audit`: PASS, no known vulnerabilities reported.
- Real Node 24.21.0 browser preview: searching `theme` returned three results,
  each with a visible highlighted match. The Writing pages excerpt now includes
  `Selected theme scripts`, and keyboard navigation reaches that result. No
  console warnings or errors were observed. Capture:
  `.impeccable/review/engine-101-search.jpg`.
- Independent bounded adoption review found no blocking issue. No renderer or
  theme implementation change was needed.

Changes are local and uncommitted. This check does not establish updated MDD
remote CI, publication, or deployment. The prior broader responsive review was
not repeated for this dependency-only behavior change.

## October 9 search result highlighting

Matching query terms now appear as semantic marks in result titles, section labels,
and excerpts. MDD preserves the engine's ranking and the original displayed text;
article pages receive no search highlights. D Theme uses its existing accent and
canvas colors. No dependency or engine version changed.

- `bun run check`: PASS, 82 tests / 861 assertions, including partial/multiple terms,
  overlapping matches, live query replacement, literal HTML, and Unicode cases
  (decomposed accents, ligatures, dotted I, Greek sigma, Hangul, astral letters).
- Real Node 24.21.0 preview: light/dark desktop and 390×844 dark mobile inspected.
  No horizontal overflow, live highlight updates, keyboard focus, and result
  navigation verified. The destination article had no marks. No console warnings
  or errors were observed.
- Captures: `.impeccable/review/search-highlights-desktop.jpg`,
  `search-highlights-dark.jpg`, and `search-highlights-mobile.jpg`.
- Independent code review: no actionable findings. A fresh generic visual reviewer
  substituted for the unavailable shipped reviewer type and returned **ship** for
  the captured views. Its documentation wording correction was applied.
- One design detector pass returned only advisories: the already documented `2px`
  radius and existing radius/font-size values. No unrelated design-system changes
  were made.
- The generic documenter verified the highlighting guidance. It also reported
  older teal narrative and preview metadata in the design sidecar; that existing
  documentation drift is outside this feature and was left unchanged.

This follow-up did not repeat the prior packed Node compatibility matrix or audit
because server/package code and dependencies did not change. Forced-colors,
assistive technology, and physical mobile keyboards were not tested. Changes are
local and uncommitted; no updated remote CI, publication, or deployment is claimed.

## October 9 engine 1.0.0 integration

MDD now consumes published `@wgtechlabs/mdd-engine@1.0.0`. The reader exports the engine's search index and browser query module, provides a keyboard-accessible search dialog, renders shared footer social links, and styles all five GitHub alerts with D Theme 0.2.0 / D26. The example pages use the new alert syntax. MDD remains 0.1.0 locally; these results do not imply a published MDD release.

| Contract | Evidence | Result |
| --- | --- | --- |
| Build, types, lint, regressions | `bun run check` | PASS: 72 tests / 802 assertions |
| Actual package and Node compatibility | One isolated installed archive; Node 22.0.0, 24.21.0, 26.10.0 | PASS: CLI, build, native preview, source-free serving, search module, footer, alerts |
| Search and public prefixes | Engine queries over exported indexes at `/`, `/docs/`, `/repository/docs/`, and `/caf%C3%A9/`; browser dialog at `/docs/` | PASS: heading destinations and safe text rendering |
| Native search interaction | Browser Ctrl+K, Cmd+K, arrows, Enter, Escape with a nonempty query, focus return, and same-document heading selection | PASS: dialog closes and destination stays visible; no-results state verified |
| Loading and errors | Controller tests for cached loading, close/reopen races, malformed/external indexes, retry, and query limits | PASS; request failure states were not induced in the browser |
| Shared footer preview | Real Node default/custom documentation directories; create, edit, invalid content, remove | PASS: invalid authoring preserves the previous site |
| Responsive appearance | Current browser captures at 1280×720, 852×740, and 390×844 | PASS for inspected reader, search, alert, and desktop footer views; no mobile horizontal overflow |
| Dependency audit | `bun audit` | PASS: no known vulnerabilities |

Browser captures are local artifacts in `.impeccable/review/`: `desktop.jpg`, `desktop-search.jpg`, `desktop-alerts.jpg`, `desktop-footer.jpg`, `mobile.jpg`, `mobile-search.jpg`, and `user-852.jpg`. They supersede the prior browser-access blocker for these inspected states. This is not a complete assistive-technology audit: forced-colors/reduced-motion browser emulation and physical mobile keyboard behavior were not tested. The preview produced no console warnings or errors during the observed interaction.

Independent code review found and closed a same-document search navigation bug: result activation now closes the dialog without suppressing native links or restoring focus over the destination. Browser testing additionally found that search inputs consume Escape to clear their value; the dialog now closes on the first Escape. A separate read-only review found no actionable issue in the footer watcher or preview shutdown fix. Fresh generic agents provided the visual finish review and design documentation because this harness cannot select Impeccable's shipped agent types. The visual reviewer returned **ship** for the seven captured states, with no material findings; uncaptured variants remain outside that visual verdict.

An unfinished HTTP request reproducibly blocked preview replacement before changing development-only shutdown to close active connections. Its regression failed before the fix and passed afterward. The earlier intermittent content-root replacement failure was observed before this integration; the complete suite now passes, but this does not establish that all past intermittent failures had the same cause. No timeout was increased.

The dated October 8 sections below preserve historical results and limitations. No updated remote CI, package publication, or deployment was performed for this local integration.

## October 8 delivery check

The same local check suite was rerun before preparing `feature/initial-mdd` for the user's branch review: 32 tests / 387 assertions, all four packaged Node runtimes, lint, typecheck, build, and the dependency audit passed. A separate delivery inspection found no apparent secrets or generated files among the 42 candidate source/configuration/documentation files. Visual verification remains pending as documented below. Remote CI, publishing, and deployment are not claimed by these local checks.

## October 8 brand and theme update

The approved Page space artwork is preserved in `brand/source/`; the primary colour is blurple `#5865F2`. SVG structure checks passed for all 13 SVG assets. PNG transparency and dimensions, ICO sizes, manifest references, and the master artwork's byte-for-byte match were verified. Logo proof sheets were rendered and inspected, including small compact marks and reversed variants. The HTML presentation received source review only; its mockups are illustrative.

The default reader now uses blurple and neutral surfaces. MDD's example selects its own CSS theme to display the logo; other projects retain their site title. Actual example exports were checked at `/`, `/docs/`, `/repository/docs/`, and `/caf%C3%A9/`, including the not-found page and copied logo assets. Calculated text contrast is at least 5.5:1 on the defined reading surfaces. Independent review caught and resolved dark-mode specificity in the print/forced-colors fallback and the inherited text ellipsis in the logo link.

Lint and typecheck passed. The first full test attempt was blocked from binding local test ports; an unrestricted run then encountered a CLI test's five-second timeout. `bun test --timeout 15000` passed all 32 tests / 387 assertions, followed by a successful build. No runtime logic, dependencies, or package metadata changed, so the previously verified Node compatibility matrix was not repeated for this CSS/assets update.

Reader desktop/mobile appearance and interactions remain unverified because of the existing browser-policy block. Logo proof sheets do not close that gap.

## October 8 PR review fixes

PR #1 review found a collision between the reader's main-container ID and the engine's ID for a heading named `Main`. The shell now uses a separate ID namespace; a regression compiles real Markdown and verifies unique IDs and the correct outline and skip links. Theme documentation now matches the shipped blurple palette.

The first GitHub Actions run failed in the preview watcher test in its Node 22 job; the Node 24 and 26 jobs passed. These tests execute under Bun, so that result alone does not establish a Node 22 runtime incompatibility. Review identified a gap between building newly selected inputs and attaching their watchers. Preview now catches up after attaching changed watchers and retains existing watchers when the input directories are unchanged. A controlled-event regression failed before the fix and now covers edits during initial startup and a content-root change, preservation of the last valid site when the catch-up build fails, and subsequent recovery.

Final local validation after these fixes: `bun run check` passed lint, typecheck, all 34 tests / 395 assertions, and build using the normal suite timeout. The same 21-file package archive passed CLI/server smoke checks under Node 22.0.0, 22.16.0, 24.21.0, and 26.10.0. The dependency audit reported no known vulnerabilities. Independent final review found no remaining actionable issue in these fixes. Updated-head CI must still be verified on the PR; the browser verification gap below remains open.

CI on commit `25e1917` passed tests, coverage, and package smoke in the Node 22 and 26 jobs, but the Node 24 job still intermittently timed out while polling a new preview route. Review found that the test helper left unsuccessful HTTP response bodies unread. After correcting that helper, the original CLI preview test passed in all three jobs on `a5c0e65`; the new watcher regression then hit the same polling issue. Both helpers now consume every response and include the current stage or child output when polling times out. This corrects test resource handling without changing success criteria or increasing timeouts; the next CI run must establish its outcome.

On `7d5723e`, both watcher regressions passed, but an immediate preview request exposed a startup readiness race: the initial catch-up rebuild could restart the server after readiness was announced. An immediate request for an edit made during startup reproduced a 404 locally. Startup now waits for that tracked rebuild before announcing readiness, and the regression requires HTTP 200 immediately after `dev` returns.

The next CI run passed all normal tests but still intermittently failed preview polling during coverage, despite the child reporting a completed two-page rebuild. Those integration tests had launched Bun in every Node matrix job. They now launch the compiled CLI and preview under the matrix's Node runtime, matching the supported product contract. The test and coverage scripts build first; the controlled watcher remains isolated in a child process, with the same assertions and deadlines. This improves runtime coverage without claiming a diagnosis of Bun's Linux behavior or changing production connection handling. The updated check and coverage suites passed locally.

The same run's Gitleaks action could not start because `GITLEAKS_LICENSE` was absent. Its later generic failure message said secrets were detected, but the action log reported a missing organization license, not a completed scan. The secret must be made available to this repository and the scan rerun. The security gate remains enabled.

## October 8 scope

Portable static exporter, default reader, selected theme assets, Markdown/index output, check/build/dev/serve CLI, and Node static server. The application consumes published mdd-engine 0.1.1; it does not duplicate Markdown compilation.

## October 8 evidence

- Frozen Bun dependency installation, lint, TypeScript, and Node ESM/declaration build passed.
- The dependency audit reported no known vulnerabilities.
- Functional fixtures cover prefixes `/`, `/docs/`, `/repository/docs/`, encoded names, themes, output ownership, failed authoring preservation, path/symlink rejection, diagnostics, local serving, and preview recovery.
- Independent structure review found no maintainability blockers. Independent security review found and drove fixes for Git filter execution, incomplete server readiness/allowlisting, and watching resolved configuration symlinks.
- Reader metadata escaping, no-JavaScript navigation markup, fallback titles, theme URLs, and the not-found page have automated checks.
- Impeccable's source detector reported no findings.

Latest local checks after the integration and PR review fixes:

| Check | Result |
| --- | --- |
| `bun run check` | PASS: lint, typecheck, 34 tests / 395 assertions, compiled build |
| `bun run smoke` with four Node binaries | PASS: one installed 21-file archive; Node 22.0.0, 22.16.0, 24.21.0, 26.10.0 |
| Packaged runtime behavior | PASS: CLI, all three public prefixes, native Node preview rebuild/new route/health, source-free serving |
| `bun audit` | PASS: no known vulnerabilities reported |
| Source security regressions | PASS: Git filters not executed; output preserved on control-character paths/invalid prefixes; inventory and linked-config behavior |

The final independent integration finding was a mismatch between export and server URL validation. Both now share canonical prefix validation, and shared file checks reject controls before promotion; encoded Unicode whitespace remains valid. No framework or runtime dependency was added beyond the published engine.

## October 8 visual verification gap

The app's browser policy could not be verified before accessing the local preview. Browser access was refused; no workaround was attempted. Desktop/mobile screenshots, keyboard interaction, theme/copy controls, actual contrast, and custom-theme visual behavior have **not** been verified in a browser.

A fresh generic review agent used Impeccable's degraded finish-review contract because this harness cannot select its shipped agent definition. It returned `recapture`: desktop and mobile screenshots are required before a visual verdict. The visual stage remains open. Static checks do not replace it.

## Release and hosting gaps

- Railway container/template packaging and a live deployment belong to the next phase.
- Generic-host/browser deep-link rendering and configured static-host 404 behavior still need browser evidence; Node HTTP responses are tested separately.
- Publishing is gated pending first-package setup and npm OIDC verification. GitHub-hosted CI has run; the updated-head outcome is tracked on PR #1. Private CodeQL remains disabled unless the repository enables its entitlement flag.
- The Gitleaks secret scan is blocked until the organization license is available to this repository; the dependency audit is a separate check and does not replace it.
- Output is staged and replaced with rollback on a handled rename failure. It is not a cross-platform atomic directory exchange; a killed build can leave its lock or staging directory. Do not modify content or output concurrently with builds.
- The Node server treats a completed build as immutable; use a new server snapshot after a build. Local preview handles that transition.
