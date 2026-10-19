# Themes

A theme styles the shared reader. A custom theme adds CSS and optional browser JavaScript over the bundled base. It does not replace the engine, execute during builds, or introduce plugins.

**D Theme** is developed and shipped in the MDD repository under `themes/d/`, with stable identifier `d`. It has its own version and release name and works without a custom theme selection. Shared markup and browser controls remain in `src/render.ts` and `assets/reader.js`; they are MDD behavior used by every theme. `examples/basic/mdd/themes/mdd/` is an example custom overlay with the MDD logo. The engine contains no reader styling.

The engine supplies semantic article markup; MDD supplies the page shell and shared behavior, including code-copy controls and the light/dark toggle. Themes style those features. New Markdown syntax, route rules, and shared reader controls must be implemented in their owning layer, not separately in each theme. See the [responsibility contract](ARCHITECTURE.md).

Code blocks have escaped code and language classes. The reader progressively highlights common syntax in JavaScript/TypeScript, JSON, CSS, HTML, Markdown, YAML, and shell blocks; unknown languages remain plain. Fenced blocks with a language show its name beside the copy control; themes can style that label with `.mdd-code-language`. Themes control the `.mdd-token-keyword`, `.mdd-token-string`, `.mdd-token-comment`, and `.mdd-token-literal` colors. Highlighting preserves `textContent`, so the shared copy control still returns original code. Switching themes must preserve content meaning, navigation, and access to shared controls.

## Select the base and custom overlay

D Theme is always the bundled base. Set `theme` in `mdd/config.json` only when selecting a local custom overlay; bundled theme identifiers are not part of the project configuration contract.

To add a custom overlay, create `mdd/themes/custom/theme.css` and set `"theme": "custom"` in `mdd/config.json`. With a custom `paths.themes`, put `custom/` inside that configured directory instead. Custom CSS loads after D Theme. Omit the configuration's `theme` field to use the base alone. Do not set `"theme": "d"` to select the bundled base: that configuration value means a local `d/` custom-theme folder.

## Version policy

D Theme has three distinct identifiers:

- **Theme name:** `D Theme`, with stable ID `d` for selection.
- **Release name:** initially `D26`, retained across minor and patch updates. The planned 1.0.0 major release introduces `D27`; each later major design release deliberately introduces its next release name. These are names for versions of the same theme, not separate annual themes. A new calendar year never renames a theme automatically.
- **Numeric version:** currently `0.3.0`, following the initial `0.1.0` development version, maintained independently of MDD and the engine. Change it when the theme changes; an unrelated MDD release does not bump it.

| Theme | Release name | Numeric version |
| --- | --- | --- |
| D Theme | D26 | 0.1.0 (initial) |
| D Theme | D26 | 0.2.0 |
| D Theme | D26 | 0.3.0 (current) |
| D Theme | D27 | 1.0.0 (planned next major) |
| D Theme | D27 | 1.1.0 (illustrative minor update) |

The source of truth is `themes/d/theme.json`:

```json
{
  "name": "D Theme",
  "release": "D26",
  "version": "0.2.0"
}
```

Keep stylesheet changes and version history in `themes/d/`, including `CHANGELOG.md`. MDD packages and ships that directory alongside its own code. Preserve released historical source snapshots under `themes/archive/` with the identity they had when archived; local development history alone does not establish a released snapshot. The archive is a source-history convention; there is no archive installer or runtime archive selector yet.

Custom themes have their own versions and release histories, managed by their authors independently of MDD, D Theme, and MDD Engine. Theme version and MDD compatibility are separate concepts.

Every page, including the 404 page, displays the installed **mdd** version and **D Theme — D26 · v0.2.0** without browser JavaScript. Custom themes remain visual layers selected through `mdd/config.json`; their styles and assets belong in the theme directory and do not add another version entry to the reader footer.

The bundled example's `mdd` theme supplies the project logo over D Theme. Its CSS and SVG assets live together in `examples/basic/mdd/themes/mdd/`.

## Tokens

| CSS variable | Default light value | Purpose |
| --- | --- | --- |
| `--mdd-background` | `#ffffff` | Reading surface |
| `--mdd-surface` | `#f6f6f9` | Sidebar and code surface |
| `--mdd-text` | `#242534` | Body text |
| `--mdd-muted` | `#5c5e73` | Secondary text |
| `--mdd-accent` | `#4752c4` | Links and active navigation |
| `--mdd-focus` | `#5865f2` | Keyboard focus outlines |
| `--mdd-accent-soft` | `#eceefd` | Selected/hover backgrounds |
| `--mdd-border` | `#dddde8` | Dividers |
| `--mdd-font` | System sans stack | Reading and navigation |
| `--mdd-mono` | System monospace stack | Source code |
| `--mdd-measure` | `70ch` | Maximum article width |
| `--mdd-radius` | `6px` | Small control corners |

The default follows `prefers-color-scheme`. The reader toggle sets `data-theme="light"` or `data-theme="dark"` on `<html>` and stores that preference locally. To override dark tokens, match `:root[data-theme="dark"]` and `:root:not([data-theme="light"])` inside a dark media query. A plain `:root` override alone has lower specificity than those selectors.

```css
:root { --mdd-accent: #6541a5; --mdd-accent-soft: #f0eafb; }
:root[data-theme="dark"] { --mdd-accent: #cbb5fa; --mdd-accent-soft: #382c48; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --mdd-accent: #cbb5fa; --mdd-accent-soft: #382c48; }
}
```

## Reader selectors

Use `.mdd-header`, `.mdd-sidebar`, `.mdd-reading`, `.mdd-article`, `.mdd-outline`, `.mdd-page-links`, and `.mdd-footer` for layout styling. Previous/next links follow the article above the footer divider. The optional `.mdd-page-actions` contribution row begins the footer, pairing **Help improve this page.** with **Edit this markdown** (`.mdd-edit-page`), with its own separator before the resources. The footer's `.mdd-agent-links` navigation groups **View Markdown** with **llms.txt for agents**, wrapping only when needed. The 404 footer retains the index but omits the page Markdown link. The edit destination is configured in MDD's build options, not in the theme. D Theme presents this link as an outlined button with a decorative GitHub mark for github.com destinations and a pencil for other hosts; it remains a native link with the accessible name **Edit this markdown**. The icon-only `.mdd-theme-toggle` remains in the header; MDD supplies its accessible name and sun/moon SVGs, while D Theme styles them. `.mdd-credit` is a compact attribution link in the main page footer, outside chapter navigation. The site brand and project links stay in the header. The built-in `.mdd-sidebar-toggle` sits inline with search above navigation; when collapsed, the navigation slides out and the same two controls remain available in a compact row. At mobile and tablet widths, a compact search trigger stays in the header and the chapter navigation and page outline share a sticky disclosure bar below it. Native `.mdd-nav-section` disclosures collapse folder groups on desktop and mobile. Current page links have `aria-current="page"`; the desktop outline uses `aria-current="location"` after enhancement. Engine 1.0.0 alerts use `.mdd-alert` with `.mdd-note`, `.mdd-tip`, `.mdd-important`, `.mdd-warning`, or `.mdd-caution`; their visible type label uses `.mdd-component-label`. D Theme supplies decorative vector icons and distinct light/dark label colors while the engine supplies meaning and static semantic markup. The reader does not reparse author Markdown or add live-region roles. The old `:::note`, `:::tip`, and `:::warning` directives now fail with `REMOVED_COMPONENT`; authors must migrate to root-level `> [!TYPE]` blockquotes. `:::details` and `.mdd-details` remain unchanged.

The full-width and compact `.mdd-search-toggle` controls open the native `.mdd-search-dialog` with its input, status, result list, close button, and retry control. Readers can also use Ctrl/Cmd+K. MDD owns dialog and keyboard behavior, lazy loading of `_mdd/search-index.json`, and safe text rendering of results; the engine owns index/query semantics. Themes style `.mdd-search-heading`, `.mdd-search-input`, `.mdd-search-status`, `.mdd-search-results`, `.mdd-search-close`, `.mdd-search-retry`, and `.mdd-search-shortcut`. Preserve accessible names, native focus behavior, visible focus indicators, and loading/error/empty states. D Theme keeps the dialog usable on narrow screens without adding motion.

The footer's `.mdd-footer-bottom` groups `.mdd-socials` links on the left and `.mdd-credit` on the right, below the agent resource links. Author social links once in the shared `mdd/footer.md` using a `:::socials` block containing a flat unordered list of plain-text labeled HTTPS links. The engine validates and returns that metadata; MDD renders it without parsing Markdown again. The theme controls icon size and layout. Known icons are decorative and links keep accessible labels; unknown destinations retain readable labels. An absent or empty footer file needs no replacement content.

The sidebar toggle shows the current state: a full divider for an open panel and a short inset bar for a closed panel. D Theme slides navigation left while smoothly reclaiming its grid space over 240ms. The renderer makes the closed panel inert immediately; reopening restores interaction. Motion is enabled only after a reader action, so restoring a saved preference does not animate. Reduced-motion readers receive an immediate state change. Custom themes must keep collapsed navigation inaccessible and preserve these controls.

The desktop outline hides below 1200px and becomes a disclosure above the article. Below 768px the sidebar becomes a separate native disclosure. These work without JavaScript. Test long titles, tables, code, keyboard focus, narrow screens, and both color schemes when changing styles.

## Assets and trust

D Theme's source stylesheet is `themes/d/theme.css`; its public URL remains `_mdd/reader.css`. Shared reader behavior is exported separately as `_mdd/reader.js`.

Custom theme CSS/JS/MJS/JSON, supported raster images, SVG, and WOFF/WOFF2/TTF/OTF fonts are copied below `_mdd/theme/` with their relative paths intact. Use relative CSS URLs or relative module URLs. Avoid root-relative asset references: those do not automatically inherit the documentation prefix. Other extensions are omitted. Hidden/sensitive paths and symlinks are refused. Referenced content assets have the engine's more restrictive allowlist.

Optional `theme.js` is a deferred classic browser script loaded after `reader.js`. It has the same page access as other scripts and may load network resources. Select only code you trust; theme files are not sandboxed or sanitized. No source JavaScript runs in the Node compilation process.

D Theme keeps sidebar labels at 14px, uses compact 36px desktop rows and 44px touch targets, and separates top-level groups with spacing. Native folder summaries use trailing chevrons and child lists use subtle nesting guides. The sidebar uses MDD's `--mdd-surface` and `--mdd-border` tokens, while hover and active links use `--mdd-accent-soft` and `--mdd-accent`. Linked folder titles still navigate while the rest of the summary toggles the group. Preserve the fixed inner navigation width during sidebar motion.

MDD owns folder-state persistence. Keep `data-mdd-nav-key` on native folder disclosures: its opaque value identifies the site prefix and encoded folder route separately, so sites with overlapping prefixes do not share preferences. The reader restores each group independently, synchronizes desktop/mobile copies, and ignores queued restore/sync toggle events. The default stays open without a saved preference or JavaScript. Storage failure must not disable navigation. Themes style disclosures without resetting their `open` state.
