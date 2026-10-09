# Responsibilities

MDD Engine compiles documentation content. MDD turns that compiled content into a usable website. Themes control its visual identity. These boundaries apply to the default reader and every custom theme.

Here, **article rendering** means converting Markdown into semantic HTML; **reader rendering** means composing that article into a complete page. The engine owns the first and MDD owns the second. A headless engine can produce HTML without owning a website, browser, or server.

## Delivery contract

**MDD Engine is the registry package. MDD is the Railway template application.**

| Component | Delivery and ownership |
| --- | --- |
| `wgtechlabs/mdd-engine` | Publishes `@wgtechlabs/mdd-engine` to npm and GitHub Packages. Owns the headless compiler and search APIs. |
| `wgtechlabs/mdd` | Contains the reader frontend, Node server, CLI, static exporter, and bundled D Theme. Owns the Railway template and its application build/start configuration. Does not publish an MDD npm or GitHub Packages package. |
| User's content repository | Supplies Markdown, configuration, and optional theme assets under `mdd/`. It is an input to the application, not the Railway service's application source. |
| Planned `mdd-build-flow-action` | Invokes MDD for GitHub Pages builds or coordinates Railway content updates. It owns deployment triggers and provider credentials; it does not replace the engine or server. |

The Railway template will use `wgtechlabs/mdd` as the application source and accept
`MDD_REPO_URL` for a separate public content repository. One deployment serves one
documentation site. Its build consumes the published engine dependency and the
selected content snapshot; the Node runtime serves the resulting site.

MDD's `package.json` provides dependency, script, runtime, and application-version
metadata. Its local name and archive smoke tests do not make registry publication
part of delivery. Keep `private: true` and `enable-package: false`; MDD needs no npm
token, Trusted Publisher, or initial npm publication. A future container image is
an application deployment artifact, separate from the engine's npm package.

**Available now:** the engine package, reader, local CLI, static export, and Node
server. **Still planned:** the Railway template, external content-fetch build, and
deployment action. Static output also supports GitHub Pages. A passing local build
does not establish a working Railway template or deployment.

## Ownership

| Concern | MDD Engine | MDD | Themes |
| --- | --- | --- | --- |
| Authoring and validation | Read local configuration/content; validate paths, frontmatter, Markdown components, links, and assets; return diagnostics | Provide CLI/build feedback and preserve previous output on failed builds | Supply selected CSS, assets, and optional trusted browser JavaScript |
| Content | Parse Markdown once; emit sanitized article HTML, readable Markdown, metadata, and headings | Compose engine article output into the reader; escape shell metadata | Style content using documented selectors |
| Navigation | Derive routes, public URLs, ordered navigation, and heading anchors | Render sidebar, outline, previous/next links, and mobile navigation | Style their appearance and responsive layout |
| Search | Build a serializable index from compiled content and provide a browser-safe query API with validated result URLs and plain-text excerpts | Export the index/query module, load the index on demand, and provide the dialog, keyboard shortcut, result links, and recovery states | Style the shared controls and result hierarchy |
| Shared footer | Parse and validate the optional `mdd/footer.md` socials block into `site.footer` | Render validated social links and MDD credit in the page footer | Style link icons, spacing, and footer layout |
| Code blocks | Preserve code text, whitespace, and language labels in escaped semantic HTML | Provide code-copy controls and own future shared code presentation enhancements | Set code fonts, surfaces, borders, spacing, and future token colors |
| Theme selection and identity | Validate configuration and resolve local custom theme file locations into `site.theme` | Select the bundled base, validate bundled/custom `theme.json` display identity, render versions, load styles, and safely copy selected assets | Define visual styling, name, version, and optional release label; do not require a separate content compiler |
| Output and hosting | Return a framework-independent site model; write no site files and start no server | Export static HTML/assets/Markdown, preview, and serve validated output with Node | Have no output-writing, server, credential, or deployment role |

MDD consumes the published engine package. It must not duplicate Markdown parsing, invent different route rules, or bypass engine validation. Another frontend can use the same engine without importing MDD or selecting an MDD theme.

The separate `mdd-build-flow-action` is intended to invoke MDD for deployment and coordinate updates. Deployment credentials and provider APIs belong to that integration, outside the content compiler and themes. Railway packaging belongs to MDD; one deployment hosts one documentation site. Those deployment pieces remain planned.

## D Theme lives in MDD

Develop, test, version, and ship **D Theme** in the **`wgtechlabs/mdd` repository**, alongside the reader. Its stable identifier is `d`. Themes are a logical styling layer, not a requirement for another repository or package. MDD Engine must remain usable without importing D Theme.

D Theme has an independent numeric version and a release name. It started at **D26 / 0.1.0** and currently uses **D26 / 0.2.0**; minor and patch versions retain D26, and the planned **1.0.0** major release introduces D27. These are generations of one theme, not separate annual themes. Name changes are deliberate release decisions, never calendar-triggered. Archive released historical snapshots without rewriting their versions; do not invent a release from local development history.

MDD ships the selected D Theme version with the application, but an MDD version bump does not change the theme version. Custom themes also have independent versions and release histories. MDD reads theme identity from `theme.json` and shows the bundled identity beside the installed MDD version. When custom styling is selected, its identity is available inside the bundled theme's collapsed native disclosure. This is reader asset metadata, not Markdown authoring metadata. See the [theme version policy](THEMES.md#version-policy); compatibility checks and version installation remain deferred.

The current source boundaries are:

| Location in MDD | Owner and purpose |
| --- | --- |
| `src/render.ts` | MDD: page shell and semantic reader markup |
| `assets/reader.js` | MDD: shared behavior, including copy controls and the light/dark toggle |
| `assets/search-ui.js` | MDD: native search dialog, lazy index loading, keyboard interaction, and safe text rendering |
| `themes/d/theme.css` | D Theme: bundled styling, exported as `_mdd/reader.css` |
| `themes/d/theme.json` and `themes/d/CHANGELOG.md` | D Theme: display identity and its own change history |
| `themes/archive/` | Historical D Theme source snapshots with preserved release identities |
| `examples/basic/mdd/themes/mdd/` | Example custom theme: MDD-branded CSS and logo assets |

Custom themes in a documentation project's configured themes directory override the bundled styling. D Theme is the default base, with an explicit MDD CLI selector `--theme d` for check/build/dev. This does not change `config.theme`: omitting that configuration field selects no custom overlay, while a local custom name still resolves through the engine. Do not forge engine theme paths or reinterpret a local folder name as a bundled theme ID. Keep shared controls in MDD so their behavior is available to all themes; keep their colors, typography, and other visual choices in the styling layer.

## Code-block pipeline

For a fenced block tagged `ts`:

1. **Engine:** recognize the fence, preserve the code and indentation, and emit escaped `<pre><code class="language-ts">…</code></pre>`. Code is displayed as text, never executed.
2. **MDD:** place that HTML in the article and progressively add the copy control. The code remains readable without JavaScript or a custom theme.
3. **Theme:** style the code block and its controls. The default reader supplies usable styles; custom themes override their appearance.

Syntax highlighting is not implemented yet. When added, MDD will own the presentation step that identifies language tokens; themes will supply their colors. CSS alone cannot identify keywords in plain code text. A highlighting enhancement must preserve the engine's escaping guarantees, the original code copied by the reader, and plain-code fallback for unknown languages or a disabled enhancer. It must not reparse the Markdown source.

Language headers, code tabs, line numbers, and highlighted lines are also future reader features. If a feature needs new authoring syntax or metadata, the engine first defines and validates that content contract; MDD then presents it. Shared behavior belongs in MDD so every theme can use it.

## Components and API documentation

Engine 1.0.0 supports GitHub-style `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` alerts alongside ordinary Markdown, GFM, and `:::details`. It recognizes a standalone uppercase `[!TYPE]` opening line in a root-level blockquote and supplies static semantic `<aside>` markup, a readable type label, and the original marker in normalized Markdown. MDD embeds that compiled article; themes supply alert colors and decorative icons through `.mdd-alert`, the type class, and `.mdd-component-label`. MDD must not reparse author Markdown to identify alerts or add live-region roles to static content.

The old `:::note`, `:::tip`, and `:::warning` directives are removed and produce `REMOVED_COMPONENT`; this is a breaking authoring migration. Preserve their body and move an optional custom title into the replacement alert's body. `:::details` retains its existing syntax and native disclosure behavior, without a second implementation in MDD.

API endpoints can currently be documented with headings, tables, and request/response code blocks. Dedicated endpoint directives, OpenAPI import, and interactive request execution are not implemented. Future endpoint syntax belongs to the engine's content contract; reader controls belong to MDD; method badges, parameter tables, and response presentation are styled by themes. Interactive network requests would need a separate explicit design.

## Search and shared footer pipeline

MDD calls the published engine's `createSearchIndex()` after successful compilation and exports its serializable result at `_mdd/search-index.json`. The browser uses the engine's separate `@wgtechlabs/mdd-engine/search` query module, exported as `_mdd/search.js`; it never imports the Node compiler. MDD owns `_mdd/search-ui.js`, the lazy fetch, the Ctrl/Cmd+K shortcut, the native dialog, loading/error/retry/empty states, and result DOM. MDD requests section mode with bounded typo fallback. Page/heading labels, breadcrumbs, excerpts, and match ranges come from the engine and are rendered as text nodes with semantic marks. MDD does not normalize query text, infer matches, or rerank hits. An accessible combobox keeps input focus while selection moves through the result list. Engine scoring and URL/heading semantics remain in the engine. D Theme owns the dialog's appearance.

The engine reads `mdd/footer.md` once as shared source, validates its `:::socials` list, and returns plain labels and HTTPS URLs. MDD renders that model as footer links beside its credit, selecting decorative icons where supported. Themes style those links. The footer never becomes a documentation page, an article, or searchable content. Neither the reader nor theme reparses footer Markdown.

## Theme contract and trust

Themes customize colors, typography, spacing, borders, assets, and layout styling through [documented tokens and selectors](THEMES.md). MDD owns accessible markup, shared controls, and their behavior. Theme authors must preserve readable content, contrast, focus indicators, and usable responsive layouts. Full template replacement and plugin loading are deferred.

Switching between valid themes must preserve authored meaning, compiled routes, navigation order, content diagnostics, and normalized Markdown. Invalid theme configuration still produces its own diagnostics. Theme-specific scripts must not become a requirement for interpreting documentation or using shared reader features.

Optional theme JavaScript runs only in the browser. It is trusted code with full page access, not a sandboxed plugin. These ownership rules guide implementation; they do not restrict what malicious theme code can do in a browser. Neither the engine nor MDD executes theme scripts during compilation/builds or installs the content repository's dependencies.

## Choosing where a change belongs

- Changes to what documentation means or how it is validated belong in **MDD Engine**.
- Changes to how readers navigate, interact, preview, export, or serve documentation belong in **MDD**.
- Changes to visual identity using existing markup and behavior belong in **themes**.

For changes spanning layers, define the engine contract first, implement the shared reader behavior second, and style it third. Update the relevant specifications together; do not claim a planned capability is already supported.

| Example change | Where it belongs |
| --- | --- |
| New frontmatter field, Markdown directive, or code-fence metadata | Engine contract, validation, and semantic output; MDD consumes it if it needs reader UI |
| Different navigation ordering or link resolution | Engine; MDD displays the resulting model |
| Copy button, code tabs, search controls, or mobile menu behavior | MDD shared reader; any new content data contract is defined in the engine first |
| Edit this markdown link | MDD combines its configured source editor prefix with the engine's existing `Page.source`; themes style the link |
| Syntax highlighting | MDD tokenization/presentation; default or custom theme supplies token colors |
| Blurple palette, fonts, logo placement, or code-block borders | Default theme in MDD, or the selected custom theme |
| Theme display name/version/release and version footer | Theme authors supply `theme.json`; MDD validates identities and displays the MDD/base theme versions with optional custom styling details in a native disclosure, without changing the engine's content model |
| Static output, preview rebuilding, HTTP serving, or Railway packaging | MDD |
| Deployment triggers, provider credentials, or release automation | The relevant Build Flow action, outside the engine and theme layers |

These examples assign ownership; they do not imply that all listed features exist today.
